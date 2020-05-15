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
  var exec = require('child_process').exec;
  var fs = require('fs');
  var fspromises = require('fs').promises;
  var uint64be = require('uint64be');

  var remote = require('electron').remote;
  const {getCurrentWindow } = require('electron').remote;
  const { shell } = require('electron');
  var dialog = remote.require('electron').dialog;
  var windie = remote.getCurrentWindow();
  var mainProcess = remote.require(__dirname + '/main.js');
  var bitcrusher = require('bitcrusher');
  var intervals = []; // zap this to tidy up orphaned playhead-progress intervals
  var displayCanvasWidth = 325;
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


  Number.prototype.clamp = function(min, max) {
    return Math.min(Math.max(this,min),max);
  }
  Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    let out = (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
    return out.clamp(out_min, out_max);
  };


  let playbackDetuneValue = 0;

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


  $scope.working = false;

  if (!localStorage.getItem('config')) {
    console.log("No local storage found");
    var options = {
      normalise: true,
      dither: false,
      samplerate: 27928,
      ptnote: 'A-3', //use indexOf on keyboardNotes to get numerical value
      mixdown: '-',
      transpose: 0,
      filterext: "",
      bitdepth: 8,
      defaultdir: '',
      //fname_append: "_ami",
      fname_append: "", // disabled for now
      append_type: "suffix",
      mono_enabled: true,
      lowpass_enabled: false,
      playbackvolume: 50,
      outputGain: -3, // I'm calling this "-3dBFS", but who knows really. Basically this is for normalising below maximum 8bit amplitude in case there's clipping
      //lowpasscutoff: 10000,
      //highpasscutoff: 1,
      preview8bit: false,
      truncateFilenames: true,
      truncateLimit: 8,
      previewSamplerate: false,
      filesizeWarning: -1,
      draggable: true,
      bigFileSize: true,
      outputToSource: false,
      looping: false
    };
    localStorage.setItem('config', JSON.stringify(options));
    $scope.options = options;
  } else {
    // Get the saved options
    $scope.options = JSON.parse(localStorage.getItem('config'));
  }


  // Preview chain setup

  var audioContext = new AudioContext({
    latencyHint: 'interactive' // This is default anyway
  });
  var source = audioContext.createBufferSource();
  var nowPlaying = false;
  var nowPlayingItem = -1;
  var globalPlaybackRate = 1;

  // The previewInputNode is connected to elsewhere, after a file has been loaded, to
  // hook up the file's buffer to the preview audio graph. It's just a gain that's
  // permanently set to level=1. It should never be changed.
  var previewInputNode = audioContext.createGain();
  previewInputNode.gain.setValueAtTime(1, audioContext.currentTime);


  // Initial filter setup
  let filterLo = audioContext.createBiquadFilter();
  let filterHi = audioContext.createBiquadFilter();
  filterLo.type = "lowpass";
  filterHi.type = "highpass";
  filterLo.frequency.setValueAtTime(20000, audioContext.currentTime);
  filterHi.frequency.setValueAtTime(40, audioContext.currentTime);
  filterHi.Q.setValueAtTime(0, audioContext.currentTime);
  filterLo.Q.setValueAtTime(0, audioContext.currentTime);

  let splitter = audioContext.createChannelSplitter(2);
  let outputmerger = audioContext.createChannelMerger(1);

  var volumeGain = audioContext.createGain();
  var bitcrushNode = bitcrusher(audioContext, {
    bitDepth: 16,
    frequency: 1
  })

  // Test DC-based hardlimiter
  let hardlimiter = audioContext.createDynamicsCompressor();
  let limiterMakeup = audioContext.createGain();


  hardlimiter.attack.value = 0.002; // hmm
  hardlimiter.release.value = 0.06; // okay
  hardlimiter.knee.value = 0.0; // yikes
  hardlimiter.ratio.value = 20; // OOF
  hardlimiter.threshold.value = -60.0; // SHIT THE BED

  // Preview audio graph
  source.connect(previewInputNode);

  if($scope.options.limiter_enabled) {
    previewInputNode.disconnect();
    hardlimiter.disconnect();
    previewInputNode.connect(hardlimiter);
    hardlimiter.connect(limiterMakeup);
  } else {
    // Make the makeup gain available even when the limiter's off, to offer a gain boost
    // that's still independent of playback volume (the normalisation might not always be enough,
    // e.g. if there's a rogue spike that's triggering the peak limit.)
    hardlimiter.disconnect();
    previewInputNode.disconnect()
    previewInputNode.connect(limiterMakeup);
  }

  limiterMakeup.connect(filterLo);

  filterLo.connect(filterHi);
  filterHi.connect(outputmerger);
  filterHi.connect(bitcrushNode);

  bitcrushNode.connect(volumeGain);


  volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);
  volumeGain.connect(audioContext.destination);

  // Preview chain END

  var inputOctave = 1; // lower octave: 0, upper octave: 1

  $scope.saveOptions = function () {
    localStorage.setItem('config', JSON.stringify($scope.options));
  };

  $scope.files = [];
  $scope.decodedFiles = [];



  document.ondragover = document.ondrop = function (ev) {
    ev.preventDefault();
  };

  document.body.ondrop = function (ev) {
    var files = ev.dataTransfer.files;

    // show loader. Loading status cheked at end of each waveform draw...seems cheaper
    // than an AJS watch?
    //$scope.loading = true;

    // Is it a file or a directory?
    for (var i = 0, f; f = files[i]; i++) {
      if (!f.type) {
        //It's a directory.
        //console.log("it's a directory");

        fs.readdir(f.path, function (err, dir) {
          for (var i = 0, path; path = dir[i]; i++) {
            // do stuff with path
            var fileExt = path.substring(path.lastIndexOf('.')+1, path.length);
            if($scope.filetypes.indexOf(fileExt.toUpperCase()) > -1) {
              var promise = prepItem(files[0].path + pathslash + path);
              promise.then(function(tmpfile) {
                createDecodedItem(tmpfile);
              })
            } else {
              console.log("Nope, not loading ", fileExt);
            }
          }
        });
      } else {
        //It's a single file.
        var fileExt = f.path.substring(f.path.lastIndexOf('.')+1, f.path.length);
        console.log(f.path);
        if($scope.filetypes.indexOf(fileExt.toUpperCase()) > -1) {
          var promise = prepItem(f.path);
          promise.then(function(tmpfile) {
            console.log("Promise returned, did a thing");
            console.log(tmpfile);
            createDecodedItem(tmpfile);
          })
        } else {
          console.log("Nope, not loading ", fileExt);
        }
      }
    }

    ev.preventDefault();
  };

  function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
  }

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


  function testDecodedAudio(tmpfile) {
    console.log("Testing decodedAudio on: " + tmpfile);
    $scope.decodedFiles.push(tmpfile);
    var i = $scope.decodedFiles.length -1;
    $scope.selectedItem = i;


    function readInputFile(writtenpath) {
      return new Promise((resolve, reject) => {

        fs.readFile(writtenpath, function(err, data) {
          //$scope.loading = true;
          if(data && !err) {
            console.log("loaded successfully...");
            var file = new window.Blob([data]);
            var abuffer;
            var fileReader = new FileReader();
            // Set up what happens after the file's been successfully read
            fileReader.onload = function(event) {
              // Read the input file to audio data (via a blob)
              abuffer = event.target.result;
              audioContext.decodeAudioData(abuffer, function() {
                console.log("audio decoded");
              }, function() {
                console.log("Audio not decoded, but can still be converted");
              }).then(function(buffer) {
                var audioBuffer = buffer;
                var data = buffer.getChannelData(0);
                resolve(buffer);
              })
            }
            // Do the actual file-read
            fileReader.readAsArrayBuffer(file);
          }
        })

      })
    }

    async function getDecodedData(paff, idx) {
      await readInputFile(paff).then(smpdata => {
        $scope.decodedFiles[idx].bufsource = audioContext.createBufferSource();
        $scope.decodedFiles[idx].bufsource.buffer = smpdata;
        $scope.decodedFiles[idx].bufsource.playbackRate.value = 0.5;
        $scope.decodedFiles[idx].bufsource.connect(audioContext.destination);
        $scope.decodedFiles[idx].bufsource.loop = false;
        return;
      });

    }

    var promises = []

    for (var i = 0; i < $scope.decodedFiles.length; i++) {
      var path = $scope.decodedFiles[i].fullpath;
      // get all the paths and fill the decode promise array
      promises.push(getDecodedData(path, i));
        //promises.push(readConvertedFile(path));
    }

    Promise.all(promises).then(() => {
      console.log("all the decodedAudio promises have been fulfilled");

      // ALL DONE, do something else
      for (var i in $scope.decodedFiles) {
        $scope.decodedFiles[i].bufsource.start(0);
      }
    })

  }


  $scope.renderOffline = function(idx, outputFilepath) {

    return new Promise((resolve, reject) => {



    })

  }

  function constructBufferPlayer(idx) {
    // Called every time we need to start playback
    destroyBufferPlayer(idx).then(() => {
      console.log("DESTROYED!");

      source = audioContext.createBufferSource();
      source.detune.value = playbackDetuneValue;
      source.buffer = $scope.files[idx].buffer;
      source.playbackRate.value = globalPlaybackRate;



      //$scope.files[i].preview.connect($scope.files[i].filterLo);
      source.connect(previewInputNode);

      outputmerger.connect($scope.files[idx].spectrum);

      $scope.files[idx].spectrum.connect(bitcrushNode);

      $scope.updateGlobalEffects();
      if($scope.options.previewSamplerate) {
          bitcrushNode.frequency = $scope.files[idx].samplerate.map(0, 44100, 0, 1);
      } else {
          bitcrushNode.frequency = 1
      }
      if($scope.options.preview8bit) {
          bitcrushNode.bitDepth = 8
      } else {
          bitcrushNode.bitDepth = 16
      }

      $scope.files[idx].contextTimeAtStart = audioContext.currentTime;
      $scope.files[idx].realtimeDuration = source.buffer.duration * (1/globalPlaybackRate);
      //source.start(0, $scope.files[idx].trimstart.map(0,source.buffer.duration,0,$scope.files[idx].realtimeDuration)); // offset is always relative to time at the sample's natural samplerate, regardless of globalPlaybackRate
      source.start(0, $scope.files[idx].trimstart); // offset is always relative to time at the sample's natural samplerate, regardless of globalPlaybackRate
      source.loop = false;
      nowPlaying = true;
      nowPlayingItem = idx;

      source.addEventListener('ended', () => {
        console.log("this sample source's playback has ended");
        //destroyBufferPlayer(idx);
      })

      $scope.files[idx].progressTimer = setInterval(() => {

        var scaledTrimstart = $scope.files[idx].trimstart.map(0,source.buffer.duration,0,$scope.files[idx].realtimeDuration);
        var scaledTrimend = $scope.files[idx].trimend.map(0, source.buffer.duration, 0, $scope.files[idx].realtimeDuration);
        var scaledRange = scaledTrimend - scaledTrimstart;
        console.log("Scaled trim range: " + scaledRange)

        var elapsed = audioContext.currentTime  - $scope.files[idx].contextTimeAtStart + scaledTrimstart;

        console.log("real elapsed: " + elapsed + " of: " + $scope.files[idx].realtimeDuration);
        //console.log("scaled trimstart: " + $scope.files[idx].trimstart.map(0,source.buffer.duration,0,$scope.files[idx].realtimeDuration))
        //console.log("scaled trimend: " + $scope.files[idx].trimend.map(0, source.buffer.duration, 0, $scope.files[idx].realtimeDuration));



        if(elapsed >= scaledTrimend) {
          destroyBufferPlayer(idx);
        }

        var realTimeElapsed = audioContext.currentTime - $scope.files[idx].contextTimeAtStart + ($scope.files[idx].trimstart);

        var proportionalElapsed = realTimeElapsed.map(0, source.buffer.duration, 0, source.buffer.duration * (1/globalPlaybackRate));
        //console.log("rtm: " + realTimeElapsed + " / dur: " + source.buffer.duration + "\nprp: "+ proportionalElapsed + " / dur: " + (source.buffer.duration * (1/globalPlaybackRate)))
        console.log("Global Playback Rate: " + globalPlaybackRate);

        //$scope.files[idx].elapsed = rawElapsed.map(0, source.buffer.duration * (1/globalPlaybackRate), 0, $scope.files[idx].info.duration)
        //console.log("Elapsed: " + $scope.files[idx].elapsed + " of: " + source.buffer.duration * (1/globalPlaybackRate))

        var playhead = document.getElementById('playhead-' + idx);
        var phNewpos = Math.round(elapsed.map(0, $scope.files[idx].realtimeDuration, 0, 325));
        playhead.style['left'] = phNewpos + 'px';

      },30)

    });



  }



  function destroyBufferPlayer(idx) {
    return new Promise((resolve, reject) => {
        if(nowPlaying) {
            source.disconnect(previewInputNode);
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




  function createDecodedItem(tmpfile) {

      //testDecodedAudio(tmpfile);

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
            }, function() {
              console.log("couldn't decode");
            }).then(function(buffer) {
              //var audioBuffer = buffer;
              //var data = buffer.getChannelData(0);
              //console.log(data);
              // DO STUFF
              $scope.files[i].buffer = buffer;
              $scope.files[i].realtimeDuration = buffer.duration * (1/globalPlaybackRate);
              $scope.files[i].displaybuffer = [0];
              $scope.files[i].filtercanvas = document.getElementById('filter-canvas-' + i);
              $scope.files[i].bytelimitcanvas = document.getElementById('bytelimit-canvas-' + i);
              $scope.files[i].spectrumcanvas = document.getElementById('spectrum-canvas-' + i);
              $scope.files[i].spectrum = audioContext.createAnalyser();
              $scope.files[i].spectrum.fftSize= 128;
              $scope.files[i].spectrumData = new Uint8Array($scope.files[i].spectrum.frequencyBinCount);
              $scope.files[i].spectrumCtx = $scope.files[i].spectrumcanvas.getContext('2d');
              $scope.files[i].bytelimitCtx = $scope.files[i].bytelimitcanvas.getContext('2d');

              // soxi replacement stuff:
              $scope.files[i].filetype = $scope.files[i].fullpath.substr(3).toUpperCase();
              $scope.files[i].info.samplerate = buffer.sampleRate;
              $scope.files[i].info.channelcount = buffer.numberOfChannels;
              $scope.files[i].info.bitdepth = 16; // KILL THIS
              $scope.files[i].info.duration = buffer.duration;
              $scope.files[i].trimrange = buffer.duration;
              $scope.files[i].trimend = buffer.duration;
              $scope.files[i].trimoptions.ceil = buffer.duration;
              $scope.files[i].outputsize = 8 * $scope.options.samplerate * buffer.duration;




              $scope.files[i].spectrum.connect(bitcrushNode);

              //$scope.files[i].player.isPlaying = false;
              //$scope.files[i].player.unplayed = true;



              // Set PT note to whatever the current global note is
              $scope.files[i].samplerate = $scope.options.samplerate;
              $scope.files[i].ptnote = $scope.options.ptnote;

              // Fix the trimoptions ID
              $scope.files[i].trimoptions.id = i;

              // This is a bit of a CPU-killer, needless to say. And it's completely unnecessary.
              // But if you really want it, uncomment $scope.files[i].draw(); below!
              $scope.files[i].draw = function() {
                  //draw some spectrum analyser bars
                  $scope.files[i].spectrumCtx.clearRect(0, 0, $scope.files[i].spectrumcanvas.width, $scope.files[i].spectrumcanvas.height);
                  var drawVisual = requestAnimationFrame($scope.files[i].draw);
                  $scope.files[i].spectrum.getByteFrequencyData($scope.files[i].spectrumData);
                  $scope.files[i].spectrumCtx.fillStyle = 'rgb(0, 0, 0, 0.2)';
                  $scope.files[i].spectrumCtx.fillRect(0, 0, $scope.files[i].spectrumcanvas.width, $scope.files[i].spectrumcanvas.height)
                  var barWidth = ($scope.files[i].spectrumcanvas.width / $scope.files[i].spectrum.frequencyBinCount) * 2.5;
                  var barHeight;
                  var x = 0;
                  for (var v = 0; v < $scope.files[i].spectrum.frequencyBinCount; v++) {
                    barHeight = $scope.files[i].spectrumData[v]/2;
                    $scope.files[i].spectrumCtx.fillStyle = 'rgb(' + (barHeight+128) + ' ,'+(barHeight+128)+','+(barHeight+128)+', 0.6)';
                    $scope.files[i].spectrumCtx.fillRect(x, $scope.files[i].spectrumcanvas.height-barHeight/2, barWidth, barHeight);
                    x += barWidth + 1;
                  }
              }


              $scope.updateGlobalEffects();

            })
          }

          fileReader.readAsArrayBuffer(file);
        }

      }) //fs.readFile end

      drawAudio($scope.files.length - 1);
      $scope.$apply();
  }



  var drawAudio = function drawAudio(i) {
    // Nothing we do here affects playback audio or the exported sample - display purposes only.
    fs.readFile($scope.files[i].fullpath, function(err, data) {
      //$scope.loading = true;
      if(data && !err) {
        console.log("loaded successfully...");
        var file = new window.Blob([data]);
        var abuffer;
        var fileReader = new FileReader();
        // Set up what happens after the file's been successfully read
        fileReader.onload = function(event) {
          // Read the input file to audio data (via a blob)
          abuffer = event.target.result;
          audioContext.decodeAudioData(abuffer, function() {
            console.log("audio decoded");
            $scope.files[i].warningmessage = "";
            $scope.$apply();
          }, function() {
            console.log("Audio not decoded, but can still be converted");
            $scope.files[i].warningmessage = "Preview unavailable but sample can still be converted to 8SVX";
            $scope.$apply();
          }).then(function(buffer) {
            var audioBuffer = buffer;
            // Get the item's canvas so we can draw the waveform onto it
            $scope.files[i].canvas = document.getElementById('wform-canvas-' + i);
            var context = $scope.files[i].canvas.getContext('2d');
            var data = buffer.getChannelData(0);
            // Work out a sensible height and width for the waveform chunks relative to canvas dimensions
            var step = Math.ceil(data.length / $scope.files[i].canvas.width);
            var amp = $scope.files[i].canvas.height / 2;
            // Find the peak (highest-amplitude sample), then normalise the waveform to that peak value. This
            // means that quiet samples can be visualised better; the sox process does peak-normalisation
            // anyway, regardless of what we do here.
            var peak = data.reduce(function(a, b) {
              return Math.max(a, b)
            })
            var normed = [];
            for (var b in data) {
              normed[b] = data[b] * 1/peak;
            }
            // Draw the waveform
            for (var k = 0; k < $scope.files[i].canvas.width; k++) {
              var min = 1.0;
              var max = -1.0;
              for (var j = 0; j < step; j++) {
                var datum = normed[k * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
              }
              //context.fillStyle = "#7cca8f";
              context.fillStyle = "#37946e";
              context.fillRect(k, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
            }
            // Try deleting the buffer now that the waveform's been drawn
            // to canvas. Hopefully save some memory.
            buffer = null;
          })
        }
        // Do the actual file-read
        fileReader.readAsArrayBuffer(file);
      }
    })

  };



  $scope.processItem = function (idx, cb) {
    return new Promise((resolve, reject) => {


        var dither, normalise;
        if ($scope.options.dither) {
          dither = "";
        } else {
          dither = "--no-dither";
        }
        if ($scope.options.normalise) {
          normalise = "--norm";
        } else {
          normalise = "";
        }

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

        var depthcmd = ' -b 8';
        var filtercmd = '';
        if($scope.files[idx].lowpassfrequency < 20000 || $scope.files[idx].highpassfrequency > 40 ) {
          //sinccmd = ' sinc ' + $scope.options.highpasscutoff + '-' + $scope.options.lowpasscutoff + ' ';
          filtercmd = ' highpass -1  ' + $scope.files[idx].highpassfrequency + ' lowpass -1 ' + $scope.files[idx].lowpassfrequency + ' ';
        }
        var trimcmd = ' trim ' + $scope.files[idx].trimstart + ' ' + $scope.files[idx].trimrange;
        if($scope.files[idx].info.channelcount > 1) {
            var remixcmd = ' remix ' + '-';
        } else {
          var remixcmd = '';
        }
        var normcmd = ' norm 0.5';
        var dithercmd = ' dither -S';
        var ratecmd = ' rate ' + $scope.files[idx].samplerate;

        // now RENDER OFFLINE:

        var trimstart = $scope.files[idx].trimstart;
        var trimend = $scope.files[idx].trimend;
        var duration = $scope.files[idx].info.duration;
        var realtimeDuration = $scope.files[idx].realtimeDuration;
        var samplerate = $scope.files[idx].samplerate;
        var origsamplerate = $scope.files[idx].info.samplerate;

        var scaledTrimstart = trimstart.map(0,duration,0,realtimeDuration);
        var scaledTrimend = trimend.map(0, duration, 0, realtimeDuration);
        var scaledTrimRange = scaledTrimend - scaledTrimstart;
        var scaledTrimLength = duration - trimstart;
        var targetDuration = $scope.files[idx].trimrange.map(0, duration, 0, realtimeDuration);
        var renderstart;
        var renderlength;

        if(trimstart > 0 || scaledTrimend < realtimeDuration) {
            renderstart = trimstart;
            renderlength = scaledTrimRange;
        } else {
            renderstart = 0;
            renderlength = realtimeDuration;
        }


        console.log("Testing the offline rendered process with samplerate: " + samplerate + " and renderlength: " + renderlength);
        let offcontext = new OfflineAudioContext(1, renderlength * samplerate, samplerate);
        let offsource = offcontext.createBufferSource();
        offsource.buffer = $scope.files[idx].buffer;

        offsource.channelInterpretation
        // OFFLINE DSP HAPPENS HERE



        let ccompressor = offcontext.createDynamicsCompressor();
        let cgain = offcontext.createGain(); // compressor gain
        let filterPost = offcontext.createBiquadFilter();
        filterPost.type="highshelf";
        filterPost.frequency.setValueAtTime(8000, offcontext.currentTime);
        filterPost.gain.setValueAtTime(-1, offcontext.currentTime);

        ccompressor.threshold.setValueAtTime($scope.options.limiterThresh,offcontext.currentTime)
        ccompressor.knee.setValueAtTime(0.0,offcontext.currentTime)
        ccompressor.ratio.setValueAtTime(20.0,offcontext.currentTime)
        ccompressor.attack.setValueAtTime(0.0002,offcontext.currentTime)
        ccompressor.release.setValueAtTime(0.06,offcontext.currentTime)
        cgain.gain.setValueAtTime(1+$scope.options.limiterMakeup/100, offcontext.currentTime);

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

        if($scope.options.limiter_enabled) {
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


        if(trimstart > 0 || trimend < duration) {
          offsource.start(0, trimstart, scaledTrimRange);
        } else {
          offsource.start();
        }

        offcontext.startRendering().then((renderedBuffer) => {
          console.log("Great Success!");
          var processed = audioContext.createBufferSource();
          processed.buffer = renderedBuffer;
          console.log(processed.buffer);

          var outData = Buffer.from(processed.buffer);
          var outData = processed.buffer.getChannelData(0);

          // Normalise it before we convert to 8bit
          var peak = outData.reduce(function(a,b) {
            return Math.max(a,b);
          })
          for (var b in outData) {
            outData[b] = outData[b] * 1/peak;
          }


          var outData8bitArr = [];

          let normRedux = Math.round($scope.options.outputGain.map(-42, 0, 0, 128));
          for(var i in outData) {
            outData8bitArr[i] = Math.round(outData[i] * normRedux);
          }
          // Trimming any leading silence due to Web Audio offline context latency that we can't reliably calculate
          var startPos = 0;
          for(var s in outData8bitArr) {
            if(outData8bitArr[s] > 0) {
              startPos = s;
              console.log("Found the startpoint! : " + s);
              outData8bitArr = outData8bitArr.slice(startPos);
              break;
            }
          }


          if(outData8bitArr.length % 2 == 0) {
            console.log("Nice even number: " + outData8bitArr.length)
          } else {
            console.log("Had to pad it!");
            outData8bitArr.push(0);
          }

          var outDataBuf = Buffer.from(outData8bitArr);
          // Now that we've got a buffer, I guess we can write it to 8SVX...
          // Work out the output filesize first: we need it both for the buffer allocation and for the FORM

          // FORM and outsize take up 8 bytes, and outsize states the length of the REST of the entire file:
          // 8SVXVHDR (8) + sampledata length (8) + repeats/hicycle (8) + samplerate (2) + octave (1) + comp (1) + volume (4)
          // = 32 + sampledatalength = FORM's size + 8 = *our* outsize.
          var formSize = 32 + outDataBuf.length;
          var outSize = formSize+8;
          console.log("output size: " + outSize);
          var tmpbuf = uint64be.encode(outDataBuf.length);
          console.log("buffer UInt64BE: " + tmpbuf)

          var smpOutBuf = Buffer.alloc(outSize);
          smpOutBuf.write('FORM', 0, 4, 'ascii');
          smpOutBuf.writeUInt32BE(formSize,4);
          smpOutBuf.write('8SVXVHDR',8,8,'ascii');
          smpOutBuf.writeInt8(0,16);
          smpOutBuf.writeInt8(0,17);
          smpOutBuf.writeInt8(0,18);
          smpOutBuf.writeInt8(20,19); // This header's own length, I think...
          //tmpbuf.copy(smpOutBuf,20,0,tmpbuf.length);
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

        })


      })

  };



  $scope.chooseOutputDir = function() {
    console.log("choose button clicked");
    //document.getElementById('outputDirChooser').click();
    // get this elsewhere with document.getElementById('outputDirChooser').files[0].path
    var path = dialog.showOpenDialog({
      properties: ['openDirectory','createDirectory'],
      defaultPath: ($scope.options.outputDir && $scope.options.outputDir.length > -1 ? $scope.options.outputDir : '')
    })
    if(path) {
      $scope.options.outputDir = path[0];
    } else {
      //$scope.options.outputDir = "";
    }

  }

  $scope.openOutputDir = function() {
    shell.showItemInFolder($scope.options.outputDir + pathslash);
  }

  // TO DO 2020-05-06 This needs to produce an array of file paths, but we also need to take
  // the first, strip the filename, and cache that directory path as inputDir (last-used
  // file location)

 $scope.chooseInputFiles = function() {
   console.log("choose input files button clicked");

   var paths = dialog.showOpenDialog({
     properties: ['openFile','multiSelections','createDirectory']
   })
   if(paths && paths.length > 0) {

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
           createDecodedItem(tmpfile);
         })
       } else {
         console.log("Nope, not loading ", fileExt);
         alert("Invalid input file - "+fileExt+"!\n\nAmigaPal outputs 8SVX files from any of the following input filetypes:\n\n.WAV\n.MP3\n.OGG\n.FLAC\n.AIFF\n.AIF\n.AAC")
       }

     }



   } else {
     $scope.options.inputDir = "";
   }
 }


  $scope.updateInfo = function(idx) {
    // This is fired when the trim ranges are adjusted. We recalculate all of the length/filesize info and also draw the
    // 64kb/128kb limit warnings if the option is enabled.
    $scope.files[idx].trimrange = $scope.files[idx].trimend - $scope.files[idx].trimstart;
    $scope.files[idx].outputsize = $scope.options.bitdepth * $scope.files[idx].samplerate * $scope.files[idx].trimrange / 8;

  }


  function d2h(d) {
    var s = (+d).toString(16);
    if(s.length < 2) {
        s = '0' + s;
    }
    return s;
  }


  $scope.writeMod = function() {

    // Read the template mod
    fspromises.readFile(pathpath.join(__dirname,'/res/empty.mod')).then(mdata => {

        if(mdata) {
          console.log("loaded successfully...");

            // Now get a test sample:

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


  $scope.applyToAll = function() {
    if(confirm("Are you sure you want to apply these settings to every sample in the list?")) {
        for (var i in $scope.files) {
          $scope.files[i].samplerate = $scope.options.samplerate;
          $scope.files[i].ptnote = $scope.options.ptnote;
        }
        $scope.updateGlobalEffects();
    }

  }


  $scope.removeFile = function(i) {
    $scope.files[i].player.pause();
    $scope.files[i].spectrum.disconnect(bitcrushNode);
    $scope.files[i].player.removeEventListener('timeupdate', function(){
      console.log("eventlistener removed");
    });
    $scope.files[i].player.removeEventListener('ended', function(){
      console.log("eventlistener removed");
    });
    $scope.files.splice(i, 1);
    intervals.forEach(clearInterval);
  }

  $scope.clearAll = function() {
    if(confirm("Are you sure you want to clear all samples from the list?")) {
      for (var i = 0; i < $scope.files.length; i++) {
        $scope.files[i].player.pause();
        $scope.files[i].player.removeEventListener('timeupdate', function(){
          console.log("eventlistener removed");
        });
        $scope.files[i].player.removeEventListener('ended', function(){
          console.log("eventlistener removed");
        });
        $scope.files[i].spectrum.disconnect(bitcrushNode);
      }
      $scope.files = [];
      intervals.forEach(clearInterval);
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
    if($scope.options.preview8bit) {
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

  $scope.togglePreviewSamplerate = function() {
    $scope.options.previewSamplerate = !$scope.options.previewSamplerate;
  }

  $scope.togglePreviewBitrate = function() {
    $scope.options.preview8bit = !$scope.options.preview8bit;
  }

  $scope.toggleTruncateFilenames = function() {
    $scope.options.truncateFilenames = !$scope.options.truncateFilenames;

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

  var toLin = function(value, width) {
    var minp = 0;
    var maxp = width;

    var minv = Math.log(40);
    var maxv = Math.log(20000);
    var scale = (maxv-minv) / (maxp-minp);
    return (Math.log(value)-minv) / scale + minp;
  }

  var drawFilters = function(i) {
    filterLo.frequency.setValueAtTime($scope.files[$scope.selectedItem].lowpassfrequency, audioContext.currentTime);
    filterHi.frequency.setValueAtTime($scope.files[$scope.selectedItem].highpassfrequency, audioContext.currentTime);

    // Test - draw on canvas
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

    // update any graph rerouting

    if($scope.options.limiter_enabled) {
      previewInputNode.disconnect();
      hardlimiter.disconnect();
      previewInputNode.connect(hardlimiter);
      hardlimiter.connect(limiterMakeup);
    } else {
      // Make the makeup gain available even when the limiter's off, to offer a gain boost
      // that's still independent of playback volume (the normalisation might not always be enough,
      // e.g. if there's a rogue spike that's triggering the peak limit.)
      hardlimiter.disconnect();
      previewInputNode.disconnect()
      previewInputNode.connect(limiterMakeup);
    }

    for (var f in $scope.files) {
      drawFilters(f);
      $scope.files[f].samplerate = $scope.ptnotes[$scope.files[f].ptnote];
      $scope.updateInfo(f);
    }
    volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);
    hardlimiter.threshold.setValueAtTime($scope.options.limiterThresh, audioContext.currentTime);
    limiterMakeup.gain.setValueAtTime(1+$scope.options.limiterMakeup/100, audioContext.currentTime);
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

    constructBufferPlayer($scope.selectedItem);
  }



  window.addEventListener('keydown', function(e) {
    console.log("Key: " + e.keyCode);

    // Right arrow: 39
    // Left arrow: 37

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
