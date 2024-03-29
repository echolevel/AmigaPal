'use strict';

angular.module('mainApp', ['electangular', 'rzModule', 'ui.bootstrap']).config(function () {}).directive('onFinishRender', ['$timeout', '$parse', function ($timeout, $parse) {
  return {
    restrict: 'A',
    link: function link(scope, element, attr) {
      if (scope.$last === true) {
        $timeout(function () {
          scope.$emit('ngRepeatFinished');
          if (!!attr.onFinishRender) {
            $parse(attr.onFinishRender)(scope);
          }
        });
      }
    }
  };
}]).controller('MainCtrl', function ($scope, $timeout) {

  const os = require('os');
  const platforms = {
    WINDOWS: 'Windows',
    MAC: 'MacOS',
    LINUX: 'Linux'
  }
  const platformNames = {
    win32: platforms.WINDOWS,
    darwin: platforms.MAC,
    linux: platforms.LINUX
  }
  $scope.currentPlatform = platformNames[os.platform()];

  var pathslash = '/'
  if($scope.currentPlatform === 'Windows') {
    pathslash = "\\"
  }


  console.log("Current platform: " + $scope.currentPlatform + ", pathslash: " + pathslash);



  var pathpath = require('path');
  var fs = require('fs');
  var fspromises = require('fs').promises;

  var remote = require('electron').remote;
  const {getCurrentWindow } = require('electron').remote;
  const { shell } = require('electron');
  //var dialog = remote.require('electron').dialog;
  const {dialog} = require('electron').remote
  var windie = remote.getCurrentWindow();
  var mainProcess = remote.require(__dirname + '/main.js');

  var displayCanvasWidth = 420;
  $scope.writingWav = false;
  $scope.statusmsg = "All is well";
  $scope.selectedItem = 0;
  $scope.loading = false;
  $scope.itemCount = 0;


  document.onreadystatechange = (event) => {
    if(document.readyState == 'complete') {
      handleWindowControls();
    }
  }

  windie.onbeforeunload = (event) => {
    /* If window is reloaded, remove win event listeners
    (DOM element listeners get auto garbage collected but not
    Electron win listeners as the win is not dereferenced unless closed) */
    windie.removeAllListeners();
  }

  function handleWindowControls() {
    // Make minimise/maximise/restore/close buttons work when they are clicked
    document.getElementById('min-button').addEventListener("click", event => {
        windie.minimize();
    });


    document.getElementById('close-button').addEventListener("click", event => {
        windie.close();
    });

}

  // Various useful maths and byte-wrangling helpers
  Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this,min),max);
  }
  Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    let out = (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    return out.clamp(out_min, out_max);
  };

  var toLin = function(value, width) {
    var minp = 0;
    var maxp = width;

    var minv = Math.log(40);
    var maxv = Math.log(20000);
    var scale = (maxv-minv) / (maxp-minp);
    return (Math.log(value)-minv) / scale + minp;
  }

  // For padding the output buffer if it needs to be rounded up to an even number of bytes
  function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

  function d2h(d) {
    var s = (+d).toString(16);
    if(s.length < 2) {
        s = '0' + s;
    }
    return s;
  }


  $scope.ptnotes = {
    "C-1": 4143, "C#1": 4389, "D-1": 4654, "D#1": 4926, "E-1": 5231, "F-1": 5542, "F#1": 5872, "G-1": 6222, "G#1": 6592, "A-1": 6982, "A#1": 7389, "B-1": 7829,
    "C-2": 8287, "C#2": 8779, "D-2": 9309, "D#2": 9852, "E-2": 10462, "F-2": 11084, "F#2": 11744, "G-2": 12445, "G#2": 13185, "A-2": 13964, "A#2": 14778, "B-2": 15694,
    "C-3": 16574, "C#3": 17558, "D-3": 18667, "D#3": 19704, "E-3": 20864, "F-3": 22168, "F#3": 23489, "G-3": 24803, "G#3": 26273, "A-3": 27928, "A#3": 29557, "B-3": 31388
  }

  $scope.keyboardNotes = [
    'C-1','C#1','D-1','D#1','E-1','F-1','F#1','G-1','G#1','A-1','A#1','B-1',
    'C-2','C#2','D-2','D#2','E-2','F-2','F#2','G-2','G#2','A-2','A#2','B-2',
    'C-3','C#3','D-3','D#3','E-3','F-3','F#3','G-3','G#3','A-3','A#3','B-3',
  ]


  $scope.fileSizes = {
    "off": -1,
    ">64kb": 64,
    ">128kb": 128
  }

  $scope.filetypes = ['WAV', 'MP3', 'OGG', 'FLAC', 'AAC', 'AIF', 'AIFF'];

  let playbackDetuneValue = 0;

  $scope.working = false;

  if (!localStorage.getItem('config')) {
    console.log("No local storage found");
    var options = {
      samplerate: 27928,
      ptnote: 'A-3', //use indexOf on keyboardNotes to get numerical value
      mixdown: '-',
      bitdepth: 8,
      defaultdir: '',
      lowpass_enabled: false,
      playbackvolume: 50,
      outputGain: 0, // I'm calling this "-3dBFS", but who knows really. Basically this is for normalising below maximum 8bit amplitude in case there's clipping
      //lowpasscutoff: 10000,
      //highpasscutoff: 1,
      previewOutput: false,
      truncateFilenames: true,
      saveWav: false,
      truncateLimit: 8,
      filesizeWarning: -1,
      draggable: true,
      bigFileSize: true,
      outputToSource: false,
      looping: false,
      modTitle: 'AMIGAPAL_MOD',
      outputDir: ''
    };
    localStorage.setItem('config', JSON.stringify(options));
    $scope.options = options;
  } else {
    // Get the saved options
    $scope.options = JSON.parse(localStorage.getItem('config'));
  }

  // Bren 2022-03-15 - forcing this to false because of shenanigans
  $scope.options.previewOutput = false;

  // Preview chain setup
  var audioContext = new AudioContext({
    latencyHint: 'interactive' // This is default anyway
  });
  var source = audioContext.createBufferSource();
  var offcontext;
  var offsource;
  var nowPlaying = false;
  var nowPlayingItem = -1;
  var globalPlaybackRate = 1;

  // previewInputNode is connected to by each file's audioContext when doing a non-preview playback.
  // It's just a gain that's permanently set to level=1. It should never be changed.
  var previewInputNode = audioContext.createGain();
  previewInputNode.gain.setValueAtTime(1, audioContext.currentTime);

  let outputmerger = audioContext.createChannelMerger(1);

  var volumeGain = audioContext.createGain();
  // Preview audio graph
  source.connect(previewInputNode);

  source.connect(outputmerger);
  outputmerger.connect(volumeGain);

  volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);
  volumeGain.connect(audioContext.destination);

  // Some input defaults and globals
  var inputOctave = 1; // lower octave: 0, upper octave: 1
  $scope.files = [];
  $scope.decodedFiles = [];

  $scope.saveOptions = function () {
    localStorage.setItem('config', JSON.stringify($scope.options));
  };

  document.ondragover = document.ondrop = function (ev) {
    ev.preventDefault();
  };

  // Handle file and folder import events
  document.body.ondrop = function (ev) {
    $scope.loading = true;
    $scope.$apply();
    var files = ev.dataTransfer.files;

    // Is it a file or a directory?
    for (var i = 0, f; f = files[i]; i++) {
      if (!f.type) {
        // It's a directory.        
        // Parse the files and create a decoded file item for anything that's valid
        fs.readdir(f.path, function (err, dir) {
          for (var i = 0, path; path = dir[i]; i++) {
            var fileExt = path.substring(path.lastIndexOf('.')+1, path.length);
            if($scope.filetypes.indexOf(fileExt.toUpperCase()) > -1) {
              var promise = prepItem(files[0].path + pathslash + path);
              promise.then(function(tmpfile) {
                createDecodedItem(tmpfile).then(() => {
                  console.log("created decoded item");
                }).catch((err) => {
                  console.log(err);
                });
              })
            } else {
              console.log("Nope, not loading ", fileExt);
            }
          }
        });
      } else {
        // It's a single file.
        // If it's valid, create a decoded file item
        var fileExt = f.path.substring(f.path.lastIndexOf('.')+1, f.path.length);
        console.log(f.path);
        if($scope.filetypes.indexOf(fileExt.toUpperCase()) > -1) {
          var promise = prepItem(f.path);
          promise.then(function(tmpfile) {
            console.log("Promise returned, did a thing");
            console.log(tmpfile);
            createDecodedItem(tmpfile).then(() => {
              console.log("created decoded item");
            }).catch((err) => {
              console.log(err);
            });
          })
        } else {
          console.log("Nope, not loading ", fileExt);
        }
      }
    }

    ev.preventDefault();
  };

 

  // Before creating a decoded file item, gather a load of info about the file 
  function prepItem(path) {
    return new Promise(function(resolve, reject) {
      var inpath = path;
      var indir = inpath.substring(0, inpath.lastIndexOf(pathslash) + 1);
      var infile = inpath.substring(inpath.lastIndexOf(pathslash) + 1, inpath.length);
      var outdir = indir;
      // What's this file's unique number in the files[] list?
      $scope.itemCount++;
      var uniqueID = $scope.itemCount + 1;
      var outfile = infile.substring(0, infile.lastIndexOf('.')) + '.8svx';
      var outfile_trunc = "" + pad(uniqueID, 2) + "_" + infile.replace("[^a-zA-Z0-9]+","").substr(0, 8) + '.8svx';
      outfile_trunc = outfile_trunc.toUpperCase();


      //outfile = infile.substring(0, infile.lastIndexOf('.')) + '.8svx';

      console.log("prepItem is happening");
      console.log($scope.files);
      for (var i = 0; i < $scope.files.length; i++) {
        console.log("test");
        console.log("item path: " + $scope.files[i].fullpath);
        console.log("what I think the path is: " + path);
        if($scope.files[i].path === path) {
          console.log("updated this file's uniqueID to " + f);
          uniqueID = i;
        }
      }
      //var outfile = infile.substring(0, infile.lastIndexOf('.')) + '.8svx';

      var tmpfile = {
        fullyLoaded: false,
        fullpath: inpath,
        inputDir: indir,
        targetpath: outdir + outfile,
        targetpath_trunc: outdir + outfile_trunc,
        filename: infile,
        targetfilename: outfile,
        targetfilename_trunc: outfile_trunc,
        name: outfile,
        name_trunc: outfile_trunc,
        samplename: outfile_trunc.substring(0, outfile_trunc.length-5),
        processing: false,
        buttontext: "Convert",
        trimstart: 0,
        trimend: 0,
        trimrange: 0,
        originalsize: 0,
        outputsize: 0,
        outputduration: 0,
        lowpassfrequency: 20000,
        highpassfrequency: 40,
        limiterThresh: 0,
        limiterMakeup: 100,
        warningmessage: "",
        trimoptions: {
          floor: 0,
          ceil: 0,
          step: 0.01,
          precision: 2,
          minRange: 0.1,
          pushRange: true,
          id: $scope.files.length,
          onChange: $scope.updateInfo,
          draggableRange: true
        },
        info: {
          duration: '',
          channelcount: '',
          encoding: '',
          samplerate: '',
          filetype: '',
          bitdepth: ''
        }
      };

      resolve(tmpfile);
    })
  }

  // Asynchronously convert all file items and write exported files to disk
  $scope.convertAll = function() {
    $scope.loading = true;
    var proms = [];
    for(var p in $scope.files) {
      proms.push($scope.processItem(true, p, function(msg) {
        console.log(msg);
      }));
    }
    Promise.all(proms)
    .then(result => {
      if(result.indexOf('error') < 0) {
        console.log("all files converted");
        if($scope.options.createMod) {
          $scope.writeMod();
        } else {
          $scope.statusmsg = "Samples converted!";
          $scope.loading = false;
          $scope.$apply();
        }
        $timeout(function() {
          $scope.statusmsg = "All is well";
        }, 5000)

      }
    })
  }

  // Called every time we need to start a playback.
  function constructRenderedBufferPlayer(idx, renbuf)
  {
    destroyBufferPlayer(idx).then(() => {
      console.log("DESTROYED RenderedBufferPlayer");

      if($scope.options.previewOutput)
      {
        $scope.loading = true;
        $scope.$apply();
        // Called every time we need to render a preview, then playback
        $scope.processItem(false, idx, function(msg) {
          console.log(msg);      
        })
        .then(
          function(value) {
            console.log("processItem done");
            $scope.loading = false;
            $scope.$apply();
            constructBufferPlayer(idx); 
          }
        );
      }
      else
      {
        constructBufferPlayer(idx); 
      }
      
    });
  }

  
  function constructBufferPlayer(idx) {        
        
        source = audioContext.createBufferSource();
        source.detune.value = playbackDetuneValue;

        // If we're in previewOutput mode, the offline rendering has been done and we can hook it up.
        // Otherwise we hook up the dry buffer.
        if($scope.options.previewOutput)
        {
          source.buffer = $scope.files[idx].renbuf;
        }      
        else
        {
          source.buffer = $scope.files[idx].buffer;
        }
        source.playbackRate.value = globalPlaybackRate;
        source.connect(outputmerger);

        $scope.files[idx].contextTimeAtStart = audioContext.currentTime;
        $scope.files[idx].realtimeDuration = source.buffer.duration * (1/globalPlaybackRate);
        //source.start(0, $scope.files[idx].trimstart.map(0,source.buffer.duration,0,$scope.files[idx].realtimeDuration)); // offset is always relative to time at the sample's natural samplerate, regardless of globalPlaybackRate
        if($scope.options.previewOutput)
        {
          source.start(0, 0); // offset is always relative to time at the sample's natural samplerate, regardless of globalPlaybackRate
        }
        else
        {
          source.start(0, $scope.files[idx].trimstart); // offset is always relative to time at the sample's natural samplerate, regardless of globalPlaybackRate
        }
        
        source.loop = false;
        nowPlaying = true;
        nowPlayingItem = idx;

        source.addEventListener('ended', () => {
          //destroyBufferPlayer(idx);
          window.cancelAnimationFrame($scope.drawVisual);
        })

        $scope.files[idx].progressTimer = setInterval(() => {

          // TO DO - this is a total mess for preview playback. Since we're playing an output buffer that's already been trimmed, 
          // all bets are off in terms of timing offsets. 

          //buffer.duration is always THE ENTIRE DURATIOn. renbuf.duration is always THE TRIMMED DURATION
          var outputDuration;
          var outputStartTime;
          
          var playhead = document.getElementById('playhead-' + idx);
                              
          var scaledTrimstart;
          var scaledTrimend;
          var elapsed;
          var phNewpos; 

           // The scaled region start time, factoring in pitch adjustment according to input note
           scaledTrimstart = $scope.files[idx].trimstart.map(0, source.buffer.duration, 0, $scope.files[idx].realtimeDuration);
           // The scaled region end time, used to stop playback when exceeded by elapsed
           scaledTrimend = $scope.files[idx].trimend.map(0, source.buffer.duration, 0, $scope.files[idx].realtimeDuration);

           elapsed = audioContext.currentTime  - $scope.files[idx].contextTimeAtStart + scaledTrimstart;

          if($scope.options.previewOutput)
          {
            // I can't work out how to make the playhead/progress line move properly when Preview Output is enabled
            phNewpos = Math.round(elapsed.map(0, $scope.files[idx].realtimeDuration, 0, displayCanvasWidth));       

            if(elapsed >= (scaledTrimend + scaledTrimstart)) {
              destroyBufferPlayer(idx);
            }
          }
          else
          { 
            phNewpos = Math.round(elapsed.map(0, $scope.files[idx].realtimeDuration, 0, displayCanvasWidth));       

            if(elapsed >= scaledTrimend) {
              destroyBufferPlayer(idx);
            }

          }

          playhead.style['left'] = phNewpos + 'px';    

          //console.log("TS: " + $scope.files[idx].trimstart + " TE: " + $scope.files[idx].trimend + " El: " + elapsed + " STS: " + scaledTrimstart + " STE: " + scaledTrimend);

        },30)

        // Offline preview rendering FINISHED

  }

  // Clean up players
  function destroyBufferPlayer(idx) {
    return new Promise((resolve, reject) => {
        if(nowPlaying) {
            source.disconnect();
            source.stop();
        }
        nowPlaying = false;
        nowPlayingItem = -1;
        for(var f in $scope.files) {
            clearInterval($scope.files[f].progressTimer);
        }

        resolve();
    })

  }

  // Load the imported file, creating a buffer we can use for playback and conversion as well as waveform display.
  // Here we also gather more info about the file, and we do an initial peak-normalisation pass.
  function createDecodedItem(tmpfile) {

    return new Promise((resolve, reject) => {

      // Always force this to false on load - it's a bodge for some trim point weirdness, but 
      // also good practice to confirm the 'before' sound before comparing against the output preview
      $scope.options.previewOutput = false;
      
      $scope.files.push(tmpfile);
      var i = $scope.files.length - 1;
      $scope.selectedItem = i;

      fs.readFile($scope.files[i].fullpath, (err,data) => {
        if(err) { console.log("failed")} else {


          var file = new window.Blob([data]);
          var abuffer;
          var fileReader = new FileReader();
          fileReader.onload = function(event) {
            abuffer = event.target.result;
            audioContext.decodeAudioData(abuffer, function() {
              console.log("decoded");
              $scope.loading = false;
              $scope.$apply();
            }, function() {
              console.log("couldn't decode");
            }).then(function(buffer) {
              //var audioBuffer = buffer;
              //var data = buffer.getChannelData(0);
              //console.log(data);
              // DO STUFF
              $scope.files[i].buffer = buffer;

              // Do a normalisation pass of the source before any processing. Usually you wouldn't
              // want this in a 'proper' audio editor, but when the target is 8bit audio there's
              // basically no reason not to maximise SNR at this stage. Attenuating later in Protracker
              // is always better than having to amplify a lower-resolution sample.
              var sourceData = buffer.getChannelData(0);
              let sourcepeak;
              // First get the peak (remember: this audiodata is 32bit float! -1 to 1 range!)
              sourcepeak = sourceData.reduce(function(a,b) {
                return Math.max(a,b);
              })
              // Now normalise it:
              for (var b in sourceData) {
                sourceData[b] = sourceData[b] * 1/sourcepeak;
                if(sourceData[b] > 1) {
                  sourceData[b] = 1;
                } else if(sourceData[b] < -1) {
                  sourceData[b] = -1;
                }
              }

              buffer.copyToChannel(sourceData, 0, 0);
              $scope.files[i].buffer = buffer;
              $scope.files[i].waveformBuffer = buffer;
              $scope.files[i].renbuf = buffer; // Bren 2022-03-14 target buffer for on-the-fly preview rendering              

              $scope.files[i].realtimeDuration = buffer.duration * (1/globalPlaybackRate);
              $scope.files[i].filtercanvas = document.getElementById('filter-canvas-' + i);

              // soxi replacement stuff:
              $scope.files[i].filetype = $scope.files[i].fullpath.substr(3).toUpperCase();
              $scope.files[i].info.samplerate = buffer.sampleRate;
              $scope.files[i].info.channelcount = buffer.numberOfChannels;
              $scope.files[i].info.bitdepth = 32; // Web Audio always returns a 32bit floating point buffer, -1.0,1.0 range
              $scope.files[i].info.duration = buffer.duration;
              $scope.files[i].info.length = buffer.length; // length of PCM data in sample-frames
              $scope.files[i].trimrange = buffer.duration;
              $scope.files[i].trimend = buffer.duration;
              $scope.files[i].trimoptions.ceil = buffer.duration;
              $scope.files[i].outputsize = 8 * $scope.options.samplerate * buffer.duration;
              $scope.files[i].limiter_enabled = false;

              // Set PT note to whatever the current global note is
              $scope.files[i].samplerate = $scope.options.samplerate;
              $scope.files[i].ptnote = $scope.options.ptnote;

              // Fix the trimoptions ID
              $scope.files[i].trimoptions.id = i;

              drawWaveform(i);

              $scope.$apply();
              resolve();
            }).catch((err) => {
              console.log("Couldn't read the audio data")
              console.log(err)
              $scope.loading = false;
              $scope.files = $scope.files.slice(0,$scope.files.length-1);
              $scope.statusmsg = "Couldn't decode audio";

              $timeout(function() {
                $scope.statusmsg = "All is well";
              }, 5000)
              $scope.$apply();
              throw err;
            })
          }

          fileReader.readAsArrayBuffer(file);
        }

      }) //fs.readFile end

    })

  }

  // Draw the static waveform image over which we'll draw trim markers and filter shelves
  var drawWaveform = function(i) {
    // Get the item's canvas so we can draw the waveform onto it
    // TO DO - I split this out in case I wanted to be able to update the
    // waveform display on the fly, e.g. to reflect limiter/gain settings, but
    // I've not yet worked out a method that's both efficient and accurate.
    var canvas = document.getElementById('wform-canvas-' + i);
    var context = canvas.getContext('2d');
    var data = $scope.files[i].waveformBuffer.getChannelData(0);
    // Work out a sensible height and width for the waveform chunks relative to canvas dimensions
    var step = Math.ceil(data.length / canvas.width);
    var amp = canvas.height / 2;
    // Draw the waveform
    for (var k = 0; k < canvas.width; k++) {
      var min = 1.0;
      var max = -1.0;
      for (var j = 0; j < step; j++) {
        var datum = data[k * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      context.fillStyle = "#ff99cc";
      context.fillRect(k, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  }

  // Draw an animated scope for the currently-playing sound
  var drawAnalyzer = function() {

    var canvas = document.getElementById('spectrum-canvas');
    var WIDTH = canvas.width;
    var HEIGHT = canvas.height;
    var canvasCtx = canvas.getContext('2d');
    var analyser = audioContext.createAnalyser();
    volumeGain.connect(analyser);

    analyser.fftSize= 1024;
    var bufferLength = analyser.fftSize;
    var dataArray = new Float32Array(bufferLength);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    function draw() {

      $scope.drawVisual = requestAnimationFrame(draw);

      analyser.getFloatTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(41,44,52)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = 'rgb(249, 150, 202)';

      canvasCtx.beginPath();

      var sliceWidth = WIDTH * 1.0 / bufferLength;
      var x = 0;

      for(var i = 0; i < bufferLength; i++) {

        var v = dataArray[i] * 200.0;
        var y = HEIGHT/2 + v;

        if(i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height/2);
      canvasCtx.stroke();
    };

    draw();

  }

  // Start an offline render of the output data, then either play it for preview purposes or write
  // it to a file according to user options.
  $scope.processItem = function (doWrite, idx, cb) {
    return new Promise((resolve, reject) => {

        $scope.files[idx].processing = true;
        $scope.files[idx].buttontext = "Converting...";

        var lowp = "";
        // Got caught out by Nyquist on this one!
        if($scope.files[idx].samplerate/2 > 8202 && $scope.options.lowpass_enabled) {
          lowp = " lowpass 8202";
        }

        var infile = $scope.files[idx].fullpath;
        var outfile;
        if($scope.options.outputDir && $scope.options.outputDir.length > 0 && !$scope.options.outputToSource) {
          var fpath = ($scope.options.truncateFilenames ? $scope.files[idx].targetpath_trunc : $scope.files[idx].targetpath);
          outfile = $scope.options.outputDir + fpath.substr(fpath.lastIndexOf(pathslash), fpath.length)
        } else {
          outfile = ($scope.options.truncateFilenames ? $scope.files[idx].targetpath_trunc : $scope.files[idx].targetpath);
        }

        // now RENDER OFFLINE:

        var renderstart = $scope.files[idx].trimstart;
        var samplerate = $scope.files[idx].samplerate;

        offcontext = new OfflineAudioContext(1, $scope.files[idx].outputsize, samplerate);
        offsource = offcontext.createBufferSource();
        offsource.buffer = $scope.files[idx].buffer;

        // OFFLINE DSP HAPPENS HERE
        // Set up the effects chain graph:
        let ccompressor = offcontext.createDynamicsCompressor();
        let cgain = offcontext.createGain(); // compressor gain
        let filterPost = offcontext.createBiquadFilter();
        filterPost.type="highshelf";
        filterPost.frequency.setValueAtTime(8000, offcontext.currentTime);
        filterPost.gain.setValueAtTime(-1, offcontext.currentTime);

        ccompressor.threshold.setValueAtTime($scope.files[idx].limiterThresh,offcontext.currentTime)
        ccompressor.knee.setValueAtTime(0.0,offcontext.currentTime)
        ccompressor.ratio.setValueAtTime(20.0,offcontext.currentTime)
        ccompressor.attack.setValueAtTime(0.0002,offcontext.currentTime)
        ccompressor.release.setValueAtTime(0.06,offcontext.currentTime)
        cgain.gain.setValueAtTime(1+$scope.files[idx].limiterMakeup/100, offcontext.currentTime);

        let outputFilterLo = offcontext.createBiquadFilter();
        let outputFilterHi = offcontext.createBiquadFilter();
        outputFilterLo.type = "lowpass";
        outputFilterHi.type = "highpass";
        let hipassVal = $scope.files[idx].lowpassfrequency
        let lopassVal = $scope.files[idx].highpassfrequency
        console.log("lopassVal: " + lopassVal + " hipassVal: " + hipassVal);
        outputFilterHi.frequency.setValueAtTime(lopassVal, offcontext.currentTime);
        outputFilterLo.frequency.setValueAtTime(hipassVal, offcontext.currentTime);
        outputFilterHi.Q.setValueAtTime(0, offcontext.currentTime);
        outputFilterLo.Q.setValueAtTime(0, offcontext.currentTime);

        if($scope.files[idx].limiter_enabled) {
          offsource.disconnect();
          ccompressor.disconnect();
          offsource.connect(ccompressor);
          ccompressor.connect(cgain);
        } else {
          // Make the makeup gain available even when the limiter's off, to offer a gain boost
          // that's still independent of playback volume (the normalisation might not always be enough,
          // e.g. if there's a rogue spike that's triggering the peak limit.)
          ccompressor.disconnect();
          offsource.disconnect()
          offsource.connect(cgain);
        }

        cgain.connect(outputFilterLo);
        outputFilterLo.connect(outputFilterHi);


        if($scope.options.lowpass_enabled && offsource.buffer.sampleRate > 8000) {
          console.log("Samplerate is " + $scope.files[idx].samplerate + " so we can apply the 8k filter")
          outputFilterHi.connect(filterPost);
          filterPost.connect(offcontext.destination);
        } else {
          outputFilterHi.connect(offcontext.destination);
        }


        offsource.start(0, renderstart, $scope.files[idx].outputsize / samplerate);

        offcontext.startRendering().then((renderedBuffer) => {
          console.log("Great Success!");
          var processed = audioContext.createBufferSource();
          processed.buffer = renderedBuffer;
          console.log(processed.buffer);

          var outData = Buffer.from(processed.buffer);
          var outData = processed.buffer.getChannelData(0);


          let peak;
          // First get the peak (remember: this audiodata is 32bit float! -1 to 1 range!)
          peak = outData.reduce(function(a,b) {
            return Math.max(a,b);
          })
          // Now normalise it:
          for (var b in outData) {
            outData[b] = outData[b] * 1/peak;
            if(outData[b] > 1) {
              outData[b] = 1;
            } else if(outData[b] < -1) {
              outData[b] = -1;
            }
          }

          // Convert from 32bit float to 8bit and clamp
          var outData8bitArr = [];

          for(var i in outData) {
            outData8bitArr[i] = Math.round(outData[i] * 128);
            if(outData8bitArr[i] > 127) {
              outData8bitArr[i] = 127;
            }
            if(outData8bitArr[i] < -128) {
              outData8bitArr[i] = -128;
            }
          }


          // Trimming any leading silence due to Web Audio offline context latency that we can't reliably calculate
          // This is bad and I should feel bad. Disabled for now.
          /*
          var startPos = 0;
          for(var s in outData8bitArr) {
            if(outData8bitArr[s] > 0) {
              startPos = s;
              console.log("Found the startpoint! : " + s);
              outData8bitArr = outData8bitArr.slice(startPos);
              break;
            }
          }
          */

          // Pad the output byte array if necessary to ensure an even number of bytes
          if(outData8bitArr.length % 2 == 0) {
            console.log("Nice even number: " + outData8bitArr.length)
          } else {
            console.log("Had to pad it!");
            outData8bitArr.push(0);
          }

          var outDataBuf = Buffer.from(outData8bitArr);

          
          if(!doWrite)
          {
            // Bren 2022-03-14
            // Test playing this buffer instead of writing it to wav/8svx                    
            $scope.files[idx].renbuf = audioContext.createBuffer(1, outData.length, samplerate);
            
            // Instead of converting our output 8bit buffer back to 32bit float, we do yet another bitcrush on the existing 32bit float buffer            

            var float32 = new Float32Array(outDataBuf.length);
            
            for(var i = 0; i < outDataBuf.length; i++)
            {
              const step = Math.pow(0.5, 8);
              float32[i] = step * Math.floor(outData[i]/step);
            }            

            $scope.files[idx].renbuf.copyToChannel(float32, 0);
            
            console.log("Not writing output, just putting the output buffer in renbuf");
            resolve("generated renbuf");
          }
          else
          {
            if($scope.options.saveWav) {
              // Prep to save RIFF WAV
              //              
              //  1-4   "RIFF"
              //  5-8   File size in UInt32. Data + 44b header
              //  9-12    "WAVE"
              //  13-16   "fmt " (includes trailing null)
              //  17-20   16   Length of format data as listed above
              //  21-22   1    Type of format (1 is PCM) - UInt16 integer
              //  23-24   1    Number of channels (always mono for us!)
              //  25-28        Sample rate - UInt32
              //  29-32        Sample rate * 8 (bits per sample) * 1 (channel) / 8
              //  33-34   1    (8 (bits per sample) * 1 (channel)) / 8
              //  35-36   8    Bits per sample
              //  37-40   "data"  Chunk header, marks start of data section
              //  41-44        Data size
              //
              
              var outSize = outDataBuf.length + 36;
  
              var outDataSigned = [];
              for (var b = 0; b < outDataBuf.length; b++) {
                outDataSigned[b] = outDataBuf.readInt8(b)  -128;
              }
              outDataBuf = Buffer.from(outDataSigned);
              console.log(outDataBuf);
  
              console.log("WAV outSize (should always be even) = " + outSize + " outDataBuf len: " + outDataBuf.length);
              var smpOutBuf = Buffer.alloc(outSize+8);
  
              smpOutBuf.write('RIFF', 0, 4, 'ascii');
              smpOutBuf.writeUInt32LE(outSize,4);
  
              smpOutBuf.write('WAVE', 8, 4, 'ascii');
  
              smpOutBuf.write('fmt', 12, 3, 'ascii');
              smpOutBuf.writeInt8(0x20,15);
  
              smpOutBuf.writeUInt32LE(16, 16);
              smpOutBuf.writeUInt16LE(1, 20);
              smpOutBuf.writeUInt16LE(1, 22);
              smpOutBuf.writeUInt32LE($scope.files[idx].samplerate, 24);
              smpOutBuf.writeUInt32LE($scope.files[idx].samplerate, 28);
              smpOutBuf.writeUInt16LE(1,32);
              smpOutBuf.writeUInt16LE(8,34);
              smpOutBuf.write("data", 36, 4, 'ascii');
              smpOutBuf.writeUInt32LE(outDataBuf.length,40);
              outDataBuf.copy(smpOutBuf, 44, 0, outDataBuf.length);
              // 8bit signed for WAV, rather than the 8bit unsigned we prepared for 8SVX
              for (var o = 44; o < outDataBuf.length; o++) {
                outDataBuf.writeInt8(outDataBuf.readUInt8(o)-128, o)
              }
              outfile = outfile.substring(0, outfile.lastIndexOf('.8SVX'));
              outfile += '.WAV';
              console.log('attempting to write WAV to ' + outfile);
              fs.writeFile(outfile, smpOutBuf, function(err) {
                if(err) {
                  console.log(err)
                  alert(err);
                } else {
                  console.log('WAV file written, maybe!');
                  $scope.loading = false;
                  resolve();
                }
              });
  
            } else {
              // Now that we've got a buffer, we can write it to 8SVX.
              // Work out the output filesize first: we need it both for the buffer allocation and for the FORM
  
              // FORM and outsize take up 8 bytes, and outsize states the length of the REST of the entire file:
              // 8SVXVHDR (8) + sampledata length (8) + repeats/hicycle (8) + samplerate (2) + octave (1) + comp (1) + volume (4)
              // = 32 + sampledatalength = FORM's size + 8 = *our* outsize.
              var formSize = 32 + outDataBuf.length;
              var outSize = formSize+8;
              console.log("output size: " + outSize);
  
              var smpOutBuf = Buffer.alloc(outSize);
              smpOutBuf.write('FORM', 0, 4, 'ascii');
              smpOutBuf.writeUInt32BE(formSize,4);
              smpOutBuf.write('8SVXVHDR',8,8,'ascii');
              smpOutBuf.writeInt8(0,16);
              smpOutBuf.writeInt8(0,17);
              smpOutBuf.writeInt8(0,18);
              smpOutBuf.writeInt8(20,19); // This header's own length, I think...
              smpOutBuf.writeUInt32BE(outDataBuf.length, 20);
              // Then it's 8 empty bytes, because we don't care about repeatHiSamples or samplesPerHiCycle
              // Then samplerate as a UInt16BE
              smpOutBuf.writeUInt16BE($scope.files[idx].samplerate,32);
              smpOutBuf.writeInt8(1, 34); // Octave is always 1
              smpOutBuf.writeInt8(0, 35); // Compression always 0
              smpOutBuf.writeInt8(0, 36); // These
              smpOutBuf.writeInt8(1, 37); // constitute
              smpOutBuf.writeInt8(0, 38); // the volume,
              smpOutBuf.writeInt8(0, 39); // always 256 (100h)
              smpOutBuf.write('BODY', 40, 4, 'ascii');
              smpOutBuf.writeUInt32BE(outDataBuf.length, 44);
  
              outDataBuf.copy(smpOutBuf, 48, 0, outDataBuf.length);
  
              //let outPath = $scope.files[idx].inputDir + 'TESTER.8SVX';
  
              console.log('attempting to write 8SVX to ' + outfile);
              fs.writeFile(outfile, smpOutBuf, function(err) {
                if(err) {
                  console.log(err)
                  alert(err);
                } else {
                  console.log('8SVX file written, maybe!');
                  $scope.loading = false;
                  resolve();
                }
              });
  
            }
          }
          

        })


      })

  };

  // if 'Save mod' is enabled, we create a blank PT module and put up to 31 samples in it.
  // The 128kb option applies exclusively to this feature, and decides whether the module's samples
  // will be capped at 128kb (2.3F compatible) rather than 64kb (2.3D and almost all other versions)
  $scope.writeMod = function() {

    // Read the template mod
    fspromises.readFile(pathpath.join(__dirname,'/res/empty.mod')).then(mdata => {

        if(mdata) {
          console.log("loaded successfully...");

            // Now get a test sample:

            // TO DO: this is no longer necessary - a hangover from sox. I just need to
            // abstract the processing chain and data buffer prep to a function that returns a promise,
            // which can then write 8SVX, or WAV, MOD, or all, or whatever.

            function readConvertedFile(writtenpath) {
              return new Promise((resolve, reject) => {

                fspromises.readFile(writtenpath).then(smpdata => {
                  resolve(smpdata);
                })

              })
            }

            async function getSampData(paff, idx) {
              await readConvertedFile(paff).then(smpdata => {
                $scope.files[idx].sampledata = smpdata.slice(103);
                // PT2.3F supports sample sizes up to 128kb, but the Win/Mac PT clone doesn't.
                // Disable the 128kb option to limit samples at 64kb.
                var maxsamplesize = ($scope.options.longSampleSupport ? 131070 : 65535);
                if($scope.files[idx].sampledata.length > maxsamplesize) {
                  console.log("this sample is too big so we're capping it at 131070 bytes");
                  $scope.files[idx].sampledata = $scope.files[idx].sampledata.slice(0, maxsamplesize);
                }
                console.log("sample " + $scope.files[idx].targetfilename_trunc + " is No. " + idx + ". It's meant to be " + $scope.files[idx].sampledata.length + " long.");
                return;
              });

            }

            var promises = []

            for (var i = 0; i < $scope.files.length; i++) {
              var path;
              if($scope.options.outputToSource) {
                path = ($scope.options.truncateFilenames ? $scope.files[i].targetpath_trunc : $scope.files[i].targetpath);
              } else {
                path = ($scope.options.truncateFilenames ? $scope.options.outputDir + pathslash + $scope.files[i].targetfilename_trunc : $scope.options.outputDir + pathslash + $scope.files[i].targetfilename);
              }
              /*
              getSampData(path).then(smpdata => {
                console.log(smpdata);
                console.log("YUP, GOT IT");
              }).catch(error => console.log(error));
              */

              promises.push(getSampData(path, i));
                //promises.push(readConvertedFile(path));
            }

            Promise.all(promises).then(() => {

              // First we need to calculate the total output module filesize, so we can allocate a buffer
              var modBuffer = Buffer.from(mdata);
              var outsize = modBuffer.length; // the empty template
              for (var i in $scope.files) {
                if(i < 31) {
                  outsize += $scope.files[i].sampledata.length;
                }
              }
              var outBuf = Buffer.alloc(outsize); // Now we can overwrite sample records and dump sampledata after the patterndata at the correct offsets

              /*
               Now we can edit at the appropriate offsets:
               0000   20b  Song title, padded with spaces
               0020d  31 x 30b Sample records:
                            22b  Sample name, padded with zeroes to full length
                            2b   Sample length / 2 (needs to be x2 for actual length. If sample length > 8000h, then sample is >64k)
                            1b    Sample finetune (0 for our purposes, but 0-F corresponds to 0 +1 +2 +3 +4 +5 +6 +7 -8 -7 -6 -5 -4 -3 -2 -1)
                            1b    Sample volume (0-40h)
                            2b   Sample loop start pos / 2
                            2b   Sample loop length /2

              All we're interested in is Song title, Sample name, Sample length. Each sample volume is 40,
              loop start/length are 0, finetune is 0.
              A sample record is 30bytes, and even an empty mod contains 31 of these.
              Sampledata begins immediately after patterndata, so we have to check offset 950d for song length
              in patterns (which we know is 1), ignore offset 951, ignore 952 to 1079 (song positions 0-127),
              ignore 1080 to 1083 (M.K. check), and 1084 to 2107 (empty pattern 0).
              Our sampledata will start at 2108, and each sample's start offset is:
                2108 + each_previous_sample_length
              When reading in 8svx buffers, chop them off at 131070 bytes (just under 128kb)

              */

              modBuffer.copy(outBuf, 0, 0, modBuffer.length) // Paste the template into our mod
              var title = (($scope.options.modTitle && $scope.options.modTitle.length > 0) ? $scope.options.modTitle.substring(0,21) : 'AMIGAPAL_TEMPLATE.MOD')
              console.log("found a mod title: " + $scope.options.modTitle);
              title = title.replace("[^a-zA-Z0-9]+","").substr(0, 16) + '.MOD';
              outBuf.write(title,0,21,'ascii');

              var offsetCounter = 2108;

              for (var d in $scope.files) {
                // Module only cares about the first 31 samples - the rest are ignored.
                if(d < 31) {
                    // Then we need to cap the sample off at 128kb:
                    //smpBuffer = smpBuffer.slice(0,131071)
                    //console.log(smpBuffer)
                    // Prep stuff for this sample's samplerecord
                    var smpname = ($scope.options.truncateFilenames ? $scope.files[d].targetfilename_trunc : $scope.files[d].targetfilename);
                    var smprecordOffset = 20 + (30 * d);
                    outBuf.write(smpname, smprecordOffset, smpname.length, 'ascii');
                    outBuf.writeUInt16BE($scope.files[d].sampledata.length/2, smprecordOffset + 22);
                    outBuf.writeUInt8(64,smprecordOffset+25); // volume to max
                    $scope.files[d].sampledata.copy(outBuf, offsetCounter, 0, $scope.files[d].sampledata.length);
                    offsetCounter += $scope.files[d].sampledata.length; // Now the data's written, we can move the offsetCounter forward for the next one
                }

              }


              // ALL DONE, WRITE THE OUTPUT BUFFER
              // If outputToSource is true, we could be looking at multiple source dirs for one mod output.
              // And that won't do. So we'll just use the first one.
              let modOutDir = ($scope.options.outputToSource ? $scope.files[0].fullpath.substring(0,$scope.files[0].fullpath.lastIndexOf(pathslash)): $scope.options.outputDir);
              fs.writeFile(modOutDir + pathslash + title, outBuf, function(err) {

                if(err) {
                  console.log(err)
                  alert(err);

                } else {
                  $scope.loading = false;
                  $scope.statusmsg = "Mod file written!";
                  $scope.$apply();
                }
              });
            })

        }

    })


  }

  $scope.chooseOutputDir = function() {
    console.log("choose button clicked");
    //document.getElementById('outputDirChooser').click();
    // get this elsewhere with document.getElementById('outputDirChooser').files[0].path

    dialog.showOpenDialog({
      properties: ['openDirectory'],
      //defaultPath: ($scope.options.outputDir && $scope.options.outputDir.length > -1 ? $scope.options.outputDir : '')
    }, (path) => {
      console.log(path)
      $scope.options.outputDir = path;
    })

  }

  $scope.openOutputDir = function() {
    shell.showItemInFolder($scope.options.outputDir + pathslash);
  }

  // TO DO 2020-05-06 This needs to produce an array of file paths, but we also need to take
  // the first, strip the filename, and cache that directory path as inputDir (last-used
  // file location)

 $scope.chooseInputFiles = function() {
   $scope.loading = true;

   console.log("choose input files button clicked");

   dialog.showOpenDialog({
     properties: ['openFile', 'multiSelections', 'createDirectory']
   }).then(result => {
     console.log(result.canceled)
     console.log(result.filePaths)
     if(result.canceled) {
       $scope.loading = false;
       $scope.$apply();
     } else if(result.filePaths.length > 0) {
       let paths = result.filePaths;
       var cachepath = paths[0].substring(0, paths[0].lastIndexOf(pathslash) + 1)
       console.log(cachepath)
       // Save this as the last-used source directory
       $scope.options.inputDir = cachepath;

       // Process file[s]
       for (var i = 0; i < paths.length; i++) {

         var fileExt = paths[i].substring(paths[i].lastIndexOf('.')+1, paths[i].length);
         console.log(paths[i]);
         if($scope.filetypes.indexOf(fileExt.toUpperCase()) > -1) {
           var promise = prepItem(paths[i]);
           promise.then(function(tmpfile) {
             console.log("Promise returned, did a thing");
             console.log(tmpfile);
             createDecodedItem(tmpfile).then(() => {
               console.log("created decoded item");
             }).catch((err) => {
               console.log(err);
             });
           })
         } else {
           console.log("Nope, not loading ", fileExt);
           $scope.loading = true;
           //alert("Invalid input file - "+fileExt+"!\n\nAmigaPal outputs 8SVX files from any of the following input filetypes:\n\n.WAV\n.MP3\n.OGG\n.FLAC\n.AIFF\n.AIF\n.AAC")
         }
       }

     } else {
       $scope.options.inputDir = "";
     }
   }).catch(err => {
     console.log(err);
   })

 }


  $scope.updateInfo = function(idx) {
    // This is fired when the trim ranges are adjusted. We recalculate all of the length/filesize info and also draw the
    // 64kb/128kb limit warnings if the option is enabled.
    $scope.files[idx].trimrange = $scope.files[idx].trimend - $scope.files[idx].trimstart;
    $scope.files[idx].outputsize = $scope.options.bitdepth * $scope.files[idx].samplerate * $scope.files[idx].trimrange / 8;

    let file = $scope.files[idx];
    /*
    console.log("buffer LENGTH in sample frames: " + file.info.length);
    console.log("buffer samplerate: " + file.info.samplerate)
    console.log("buffer channelcount: " + file.info.channelcount);
    console.log("buffer bit depth: " + file.info.bitdepth);
    console.log("trimstart: " + file.trimstart);
    console.log("trimend: " + file.trimend);
    console.log("output size: " + file.outputsize);
    */
  }


  $scope.applyToAll = function() {
    for (var i in $scope.files) {
      $scope.files[i].samplerate = $scope.options.samplerate;
      $scope.files[i].ptnote = $scope.options.ptnote;

      $scope.statusmsg = "Set all to " + $scope.options.ptnote;

      $timeout(function() {
        $scope.statusmsg = "All is well";
      }, 5000)
    }
    $scope.updateGlobalEffects();
  }

  $scope.copyLimiterToAll = function(idx) {
    for(var i in $scope.files) {
      if(i != idx)
      {
        $scope.files[i].limiterMakeup = $scope.files[idx].limiterMakeup;
        $scope.files[i].limiterThresh = $scope.files[idx].limiterThresh;
        $scope.files[i].limiter_enabled = $scope.files[idx].limiter_enabled;        
      }
    }
    $scope.updateGlobalEffects();
  }

  $scope.copyLoPassToAll = function(idx) {
    for(var i in $scope.files) {
      if(i != idx)
      {
        $scope.files[i].lowpassfrequency = $scope.files[idx].lowpassfrequency;
      }
    }
    $scope.updateGlobalEffects();
  }

  $scope.copyHiPassToAll = function(idx) {
    for(var i in $scope.files) {
      if(i != idx)
      {
        $scope.files[i].highpassfrequency = $scope.files[idx].highpassfrequency;
      }
    }
    $scope.updateGlobalEffects();
  }

  $scope.copyPTNoteToAll = function(idx) {
    for(var i in $scope.files) {
      if(i != idx)
      {
        $scope.files[i].ptnote = $scope.files[idx].ptnote;
      }
    }
    $scope.updateGlobalEffects();
  }

  $scope.removeFile = function(i) {
    destroyBufferPlayer(i);
    $scope.files.splice(i, 1);
  }

  $scope.clearAll = function() {
    if(confirm("Are you sure you want to clear all samples from the list?")) {
      for (var i = 0; i < $scope.files.length; i++) {
        destroyBufferPlayer(i);
      }
      $scope.files = [];
    }

  }

  $scope.$watch('options', function () {
    // Always watch for changes to options, and update localstorage
    localStorage.setItem('config', JSON.stringify($scope.options));
    $scope.updateFilesizeWarnings();
    $scope.updateGlobalEffects();

  }, true);



  $scope.$on('ngRepeatFinished', function (ngRepeatFinishedEvent) {});



  $scope.toggle8bit = function() {
    var depth;
    if($scope.options.previewOutput) {
      depth = 16;
    } else {
      depth = 8;
    }

  }

  $scope.toggleLPF = function() {
    $scope.options.lowpass_enabled = !$scope.options.lowpass_enabled;
  }

  $scope.toggleLimiter = function() {
    $scope.options.limiter_enabled = !$scope.options.limiter_enabled;
    $scope.updateGlobalEffects();
  }

  $scope.toggleItemLimiter = function(idx) {
    $scope.files[idx].limiter_enabled = !$scope.files[idx].limiter_enabled;
    // Whenever limiter is disabled, cut the makeup gain to zero for ear-safety...
    if(!$scope.files[idx].limiter_enabled) {
      $scope.files[idx].limiterMakeup = 0;
    }
    $scope.updateGlobalEffects();
  }

  $scope.togglePreviewOutput = function() {
    destroyBufferPlayer($scope.selectedItem);
    $scope.options.previewOutput = !$scope.options.previewOutput;
  }

  $scope.toggleTruncateFilenames = function() {
    $scope.options.truncateFilenames = !$scope.options.truncateFilenames;

  }

  $scope.toggleSaveWav = function() {
    $scope.options.saveWav = !$scope.options.saveWav;

  }

  $scope.toggleCreateMod = function() {
    $scope.options.createMod = !$scope.options.createMod;
  }

  $scope.toggleLongSampleSupport = function() {
    $scope.options.longSampleSupport = !$scope.options.longSampleSupport;
  }

  $scope.toggleOutputToSource = function() {
    $scope.options.outputToSource = !$scope.options.outputToSource;
  }

  // Draw the filter shelves on the canvas
  var drawFilters = function(i) {    
    var cnv = $scope.files[i].filtercanvas;
    var ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.fillStyle = "rgba(171, 115, 218, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, 70);
    ctx.lineTo(toLin($scope.files[i].highpassfrequency, $scope.files[i].filtercanvas.width), 70);
    ctx.quadraticCurveTo(toLin($scope.files[i].highpassfrequency, $scope.files[i].filtercanvas.width)+20, 70, toLin($scope.files[i].highpassfrequency, $scope.files[i].filtercanvas.width) + 20, 210);
    ctx.lineTo(0, 210);
    ctx.fill();

    ctx.fillStyle = "rgba(106, 176, 239, 0.5)";
    ctx.beginPath();
    ctx.moveTo(cnv.width, 70);
    ctx.lineTo(toLin($scope.files[i].lowpassfrequency, $scope.files[i].filtercanvas.width), 70);
    ctx.quadraticCurveTo(toLin($scope.files[i].lowpassfrequency, $scope.files[i].filtercanvas.width)-20, 70, toLin($scope.files[i].lowpassfrequency, $scope.files[i].filtercanvas.width) - 20, 210);
    ctx.lineTo(cnv.width, 210);
    ctx.fill();
  }


  $scope.updateGlobalEffects = function() {

    console.log("Updating global effects");

    $scope.options.samplerate = $scope.ptnotes[$scope.options.ptnote];

    if($scope.files.length > 0) {
        for (var f in $scope.files) {
          drawFilters(f);
          $scope.files[f].samplerate = $scope.ptnotes[$scope.files[f].ptnote];
          $scope.updateInfo(f);
        }
    }

    volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);
  }




  $scope.updateFilesizeWarnings = function() {

  }


  $scope.itemSelected = function(i) {
    // Cache the previously selected item, get the newly selected item
    var prevSelected = $scope.selectedItem;
    $scope.selectedItem = i;
  }

  function handleQwertyNote(freq, notenum) {

    // https://books.google.co.uk/books?id=6U7Y1gCi-5IC&pg=PA31&lpg=PA31&dq=%22playbackrate%22+%22pitch%22+%22frequency%22&source=bl&ots=ioLwDoKDS_&sig=ACfU3U2oF6scHuXWaTgjmTM4CXl5vDyV3g&hl=en&sa=X&ved=2ahUKEwizqse7n6jpAhUNTBUIHWGQC6AQ6AEwAXoECAoQAQ#v=onepage&q=%22playbackrate%22%20%22pitch%22%20%22frequency%22&f=false

    //incoming note is relative to semitones where 0 * 100 detune is original pitch.
    // So PT note is always original pitch, because after resampling you want to hear
    // the original pitch when you play that note! We don't need the Amiga sampling rate
    // for PT note, but we do need the note number.

    var inSemitone = notenum - $scope.keyboardNotes.indexOf($scope.files[$scope.selectedItem].ptnote);

    var semitoneRatio = Math.pow(2, 1/12);
    globalPlaybackRate = Math.pow(semitoneRatio, inSemitone);
    //playbackDetuneValue = inSemitone * 100;

    //constructBufferPlayer($scope.selectedItem);

    // Bren 2022-03-14
    // TEST - render proper preview on the fly, then play    
    // Ignore any notes that come in while loading is true (this probably means the PreviewOutput mode buffer is rendering)
    if(!$scope.loading)
    {
      constructRenderedBufferPlayer($scope.selectedItem);
    }
    
    
    drawAnalyzer()

  }



  window.addEventListener('keydown', function(e) {
    console.log("Key: " + e.keyCode);

    var modTitleInput = document.getElementById('mod_title_input');
    var outputDirInput = document.getElementById('outputDirTextInput');
    var modTitleIsFocused = (document.activeElement === modTitleInput);
    var outputInputIsFocused = (document.activeElement === outputDirInput);
    // Right arrow: 39
    // Left arrow: 37
    if(modTitleIsFocused || outputInputIsFocused) {

    } else {
      if(e.repeat) {

      } else {
        if(e.keyCode == 8) {
          // backspace: remove current item
          //$scope.removeFile($scope.selectedItem);
          //$scope.$apply();
        }

        if(e.keyCode === 39) {
          //right arrow - increment PT note
          // not sure how to do this the easy way, can't be arsed to do it the hard way
        }

        if(e.keyCode === 37) {
          //left arrow - decrement PT note
          // not sure how to do this the easy way, can't be arsed to do it the hard way
        }

        if(e.keyCode === 13) {
          // Return/Enter - convert the currently selected item
          //$scope.processItem($scope.selectedItem, null)
        }


        if(e.keyCode === 40) {
          if($scope.files && $scope.selectedItem < $scope.files.length-1) {
            $scope.itemSelected($scope.selectedItem+1);
            $scope.$apply();
            e.preventDefault()
          }

        }

        if(e.keyCode === 38) {
          if($scope.files && $scope.selectedItem-1 >= 0) {
            $scope.itemSelected($scope.selectedItem-1);
            $scope.$apply();
            e.preventDefault();
          }

        }

        if(e.keyCode === 32) {
          // Space bar. Plays item at last-used note offset. Maybe it should always play at target PT note?
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf($scope.files[$scope.selectedItem].ptnote));
          e.preventDefault();
        }

        if(e.keyCode === 116) {
          // Refresh window (F5) but non-global!
          getCurrentWindow().reload();
          e.preventDefault();
        }

        // QWERTYTIME!



        if(e.keyCode === 220) {
          // \ - kill note
          destroyBufferPlayer($scope.selectedItem);
          e.preventDefault();
        }

        if(e.keyCode === 90) {
          // z - lower octave C
          var note = 'C-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 83) {
          // s - lower octave C#
          var note = 'C#' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 88) {
          // x - lower octave D
          var note = 'D-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 68) {
          // d - lower octave D#
          var note = 'D#' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 67) {
          // c - lower octave E
          var note = 'E-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 86) {
          // v - lower octave F
          var note = 'F-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 71) {
          // g - lower octave F#
          var note = 'F#' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 66) {
          // b - lower octave G
          var note = 'G-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 72) {
          // h - lower octave G#
          var note = 'G#' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 78) {
          // n - lower octave A
          var note = 'A-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 74) {
          // j - lower octave Bb
          var note = 'A#' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 77) {
          // m - lower octave B
          var note = 'B-' + (1 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 188) {
          // < - Upper octave C
          var note = 'C-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 76) {
          // l - Upper octave C#
          var note = 'C#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 190) {
          // > - Upper octave D
          var note = 'D-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 186) {
          // ; - Upper octave D#
          var note = 'D#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 191) {
          // / - Upper octave E
          var note = 'E-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 81) {
          // q - Upper octave C
          var note = 'C-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 50) {
          // 2 - Upper octave C#
          var note = 'C#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 87) {
          // w - Upper octave D
          var note = 'D-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 51) {
          // 3 - Upper octave D#
          var note = 'D#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 69) {
          // e - Upper octave E
          var note = 'E-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 82) {
          // r - Upper octave F
          var note = 'F-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 53) {
          // 5 - Upper octave F#
          var note = 'F#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 84) {
          // t - Upper octave G
          var note = 'G-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 54) {
          // 6 - Upper octave G#
          var note = 'G#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 89) {
          // y - Upper octave A
          var note = 'A-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 55) {
          // 7 - Upper octave Bb
          var note = 'A#' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 85) {
          // u - Upper octave B
          var note = 'B-' + (2 + inputOctave)
          handleQwertyNote($scope.ptnotes[note], $scope.keyboardNotes.indexOf(note));
          e.preventDefault();
        }

        if(e.keyCode === 112) {
          // F1 Set lower octave:
          inputOctave = 0;
          e.preventDefault();
        }

        if(e.keyCode === 113) {
          // F2 Set upper octave:
          inputOctave = 1;
          e.preventDefault();
        }

      }
    }

  }, true);

  window.addEventListener('keyup', function(e) {

  }, true)

})
.directive('scrollIf', function() {
    return function(scope, element, attrs) {
        scope.$watch(attrs.scrollIf, function(value) {
            if (value) {
                element[0].scrollIntoView({block: "nearest", behavior: "smooth"});
            }
        });
    }
})
;
