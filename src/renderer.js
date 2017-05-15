'use strict';
import RegionPlugin from 'wavesurfer.js/dist/plugin/wavesurfer.regions.min.js';

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

  var exec = require('child_process').exec;
  var fs = require('fs');
  var audioContext = new AudioContext();
  var remote = require('electron').remote;
  var dialog = remote.require('electron').dialog;
  var WaveSurfer = require('wavesurfer.js');
  
  const path = require('path');
  //var mainProcess = remote.require('index.js');

  Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  };

  $scope.working = false; // To disable the convert button while a batch is running
  $scope.foundsox = false;  // Set to true later if sox path is given and a test soxi command works

  $scope.chooseDir = function () {

  dialog.showOpenDialog({
      properties: ['openDirectory']
    }, function (dirpath) {
      $scope.options.defaultdir = dirpath[0];
      $scope.$apply();
      $scope.loadDir();
    });
  };
  
  $scope.chooseOutputDir = function() {
    dialog.showOpenDialog({
      properties: ['openDirectory']
    }, function (dirpath) {
      $scope.options.outputdir = dirpath[0];
      $scope.$apply();
    });
  }

  $scope.loadDir = function () {

    // Fired either on startup, if there's a saved path in localstorage, or by the select folder button
    
    var dirpath = $scope.options.defaultdir;

    if(dirpath.length > 0) {
      fs.readdir(dirpath, function(err,dir) {
        dir.filter(function(filename) {
          // We only want these. Everything else either won't work (ogg, for some reason) or is too ridiculously obscure even for an Amiga tool...
          return filename.match(/(\.aiff$)|(\.aif$)|(\.wav$)|(\.raw$)|(\.mp3$)/i);
        }).forEach(function(filename) {
        var pathname = dirpath + '/' + filename;
        createItem(pathname);
      })
      })
    }
    
  };

  if (!localStorage.getItem('config')) {
    console.log("No local storage found");
    // A load of defaults; mostly my own preferred Protracker sample conversion settings.
    var options = {
      normalise: true,
      dither: false,
      samplerate: 11025,
      mixdown: '-',
      transpose: 0,
      filterext: "",
      bitdepth: 8,
      defaultdir: '',
      output_format: '8svx',
      outputdir: '',
      fname_append: "_ami",
      append_type: "suffix",
      mono_enabled: true,
      playbackvolume: 50,
      soxpath: ''
    };
    localStorage.setItem('config', JSON.stringify(options));
    $scope.options = options;
  } else {
    // Get the saved options
    $scope.options = JSON.parse(localStorage.getItem('config'));
    // And load the saved directory, if there is one
    if ($scope.options.defaultdir != null && $scope.options.defaultdir.length > 0) {
      $scope.loadDir();
    }
  }

  $scope.saveOptions = function () {
    localStorage.setItem('config', JSON.stringify($scope.options));
  };

  var soxiopts = ['-t', '-r', '-c', '-D', '-b', '-e'];
  // soxi options:
  // -t (detected filetype), -r (samplerate), -c (channel count), -D (duration), -b (bit depth), -e (encoding)

  $scope.files = [];

  function soxCheck() {
    // Is sox installed? Reachable? It should be in the same place as soxi, and soxi gets used first, so we check that first.
    exec($scope.options.soxpath + 'sox', function(error, stdout, stderr) {
      if (!error) {
        $scope.foundsox = true;
      } else {
        var errortext = error + " ";
        if(errortext.indexOf('undefinedsoxi') > -1) {
          console.log("Couldn't find sox/soxi. Did you set the SoX path?");
          alert("Couldn't find sox/soxi on your system. Did you set the SoX path? Please check it and restart.");
        }
      }
    })
  }

  function soxInfo(input, opt, callback) {
    // General purpose wrapper, used for file object creation on loading
    exec($scope.options.soxpath + 'soxi ' + opt + ' "' + input + '"', function (error, stdout, stderr) {
      callback(error, stdout.replace(/\r?\n|\r/g, ''), stderr);
    });
  }

  function soxProcess(input, inputdir, fname, opt, output, effects, callback) {
    // Here's where we do the actual thing that this app is for
    
    var outfile = "";
    
    // Append the output filename
    if($scope.options.append_type == "suffix") {
        outfile = fname.substring(0, fname.lastIndexOf('.')) + $scope.options.fname_append + '.wav';
        console.log("It's a suffix");
    } else if($scope.options.append_type == "prefix"){
        outfile = $scope.options.fname_append + fname;
        console.log("It's a prefix");
    }
    

    // Using path.join in the hope that it keeps things largely platform-agnostic. Not sure how Windows will behave yet, but it's supposed to recognise / as well as \
    if(typeof $scope.options.outputdir != 'undefined' && $scope.options.outputdir.length > 1 ) {
      output = path.join($scope.options.outputdir, outfile);
    } else {
      output = path.join(inputdir, outfile);
    }

    output = output.substring(0, output.lastIndexOf('.')) + '.' + $scope.options.output_format;

    // Now we actually call actual sox, with our actual sox options and whatnot
    exec($scope.options.soxpath + 'sox "' + input + '" ' + opt + ' "' + output + '" ' + effects, function (error, stdout, stderr) {
      callback(error, stdout, stderr);
    });
    
  }

  $scope.removeFile = function(i) {
    $scope.files[i].player.pause();
    $scope.files.splice(i, 1);

  }

  $scope.$watch('options', function () {
    
    // Always watch for changes to options, and update localstorage and for other general purpose updates
    
    localStorage.setItem('config', JSON.stringify($scope.options));

    for (var i in $scope.files) {
      $scope.files[i].player.volume = $scope.options.playbackvolume / 100;
      $scope.files[i].wavesurfer.setVolume($scope.options.playbackvolume/100);
    }    
    
  }, true);


  $scope.$watch(function () {
    
    // Not sure how efficient it is, but it's a good way to update target filesize and duration on the fly
    
    if ($scope.files.length > 0) {
      //console.log("Updating target filesize");
      for (var i in $scope.files) {
        
        // Filename preview
        if($scope.options.append_type == "suffix") {
            $scope.files[i].appendedtargetfilename = $scope.files[i].targetfilename.substring(0, $scope.files[i].targetfilename.lastIndexOf('.')) + $scope.options.fname_append + '.' + $scope.options.output_format;
        } else if($scope.options.append_type == "prefix"){
            $scope.files[i].appendedtargetfilename = $scope.options.fname_append + $scope.files[i].targetfilename;
        }
        
        // This formula calculates the new internal samplerate when transposition by semitones is factored in.
        // Everything will be resampled to the target samplerate at the end.
        var temprate = Math.pow(2, $scope.files[i].transpose / 12) * $scope.options.samplerate;

        // This is the samplerate that the original file would have with the same transposition, regardless of its 
        // samplerate to begin with. We need this to calculate target file duration.
        var origtemprate = Math.pow(2, $scope.files[i].transpose / 12) * $scope.files[i].info.samplerate;

        var tempduration = $scope.files[i].originalsize / (origtemprate * $scope.files[i].info.channelcount * ($scope.files[i].info.bitdepth / 8));

        $scope.files[i].outputduration = Math.round(tempduration * 100) / 100;



        $scope.files[i].trimoptions.ceil = $scope.files[i].outputduration;
        if ($scope.files[i].trimend > $scope.files[i].trimoptions.ceil) {
          $scope.files[i].trimend = $scope.files[i].trimoptions.ceil;
        }

        $scope.files[i].trimrange = $scope.files[i].trimend - $scope.files[i].trimstart;

        //console.log("File"+i+" trimrange: " + $scope.files[i].trimrange);
        // Factor in trimrange
        // W T F
        $scope.files[i].outputsize = Math.round($scope.options.bitdepth * $scope.options.samplerate * $scope.files[i].trimrange / 8 * 100) / 100;

      }
    }
  }, true);
  

    

  $scope.$on('ngRepeatFinished', function (ngRepeatFinishedEvent) {});


  var drawAudio = function drawAudio(i) {


    $timeout(function() {
      $scope.files[i].wavesurfer = WaveSurfer.create({
        container: '#waveform-'+i,
        plugins: [
          RegionPlugin.create({
            dragSelection:true,
            id: "unique",
            loop: true,
            drag: false,
            resize: true
          })
        ]
      })
      $scope.files[i].wavesurfer.load($scope.files[i].fullpath);
      
      // Merge stereo to mono (L+R option). Need to figure out how to split channels to preview L/R separately.
      var tomono = $scope.files[i].wavesurfer.backend.ac.createChannelMerger(1);
      //var singlechan = $scope.files[i].wavesurfer.backend.ac.createChannelSplitter(1);
      $scope.files[i].wavesurfer.backend.setFilter(tomono);
      //$scope.files[i].wavesurfer.backend.setFilter(singlechan);
      
      $scope.files[i].wavesurfer.on('ready', function() {
        
        $scope.files[i].wavesurfer.setVolume($scope.options.playbackvolume/100);
        console.log($scope.files[i].wavesurfer.getDuration());
      })
      
      
      $scope.files[i].wavesurfer.on('finish', function() {
        $scope.files[i].wavesurfer.play();
      })
      
      $scope.files[i].wavesurfer.on('play', function() {
        $scope.files[i].playing = true;
        console.log("detected play start; now playing");
      })
      $scope.files[i].wavesurfer.on('pause', function() {
        $scope.files[i].playing = false;
        console.log("detected pause; now paused");
      })
      
      $scope.files[i].wavesurfer.on('region-created', function(newregion) {

        // Loop through all the regions (hopefully a maximum of 1) and delete any region that
        // doesn't match the ID of the new region. We only want one region to exist at a time.
        for (var key in $scope.files[i].wavesurfer.regions.list) {
          if($scope.files[i].wavesurfer.regions.list.hasOwnProperty(key)) {
            if(key.id != newregion.id) {
              console.log("found an old region");                                
              $scope.files[i].wavesurfer.regions.list[key].remove();
            }
          }
        }
        newregion.loop = true;
        console.log(newregion);
        
        //$scope.files[i].wavesurfer.pause();
        $scope.files[i].trimstart = newregion.start;
        $scope.files[i].trimend   = newregion.end;
        $scope.files[i].trimrange = newregion.end - newregion.start;
        $scope.files[i].wavesurfer.play(newregion.start, newregion.end);
      })
      
      $scope.files[i].wavesurfer.on('region-updated', function(region) {
        $scope.files[i].trimstart = region.start;
        $scope.files[i].trimend   = region.end;
        $scope.files[i].trimrange = region.end - region.start;
      })
      
      $scope.files[i].wavesurfer.on('region-update-end', function(region) {        
        $scope.files[i].trimstart = region.start;
        $scope.files[i].trimend   = region.end;
        $scope.files[i].trimrange = region.end - region.start;
        $scope.files[i].wavesurfer.play(region.start, region.end);
      })
      
      $scope.files[i].wavesurfer.on('dblclick', function(region) {
        region.start = 0;
        region.end = $scope.files[i].wavesurfer.getDuration();
      })
      
    }, 0)

    // All the unattached HTML5 media audio elements we created on load are grabbed here by XHR and fed into Web Audio API buffers so we can get the audio data for waveform drawing
    /*
    
    
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'file://' + $scope.files[i].fullpath, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = function (e) {
          var audioData = xhr.response;
          audioContext.decodeAudioData(audioData, function() {
            console.log("audio decoded");
          }, function() {
            console.log("audio not decoded");
            $scope.files[i].showplayer = false;
            $scope.$apply();
          }).then(function (buffer) {
            var audioBuffer = buffer;
            var canvas = document.getElementById('wform-canvas-' + i);
            var context = canvas.getContext('2d');
            var data = buffer.getChannelData(0);
            var step = Math.ceil(data.length / canvas.width);
            var amp = canvas.height / 2;
            for (var k = 0; k < canvas.width; k++) {
              var min = 1.0;
              var max = -1.0;
              for (var j = 0; j < step; j++) {
                var datum = data[k * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
              }
              context.fillStyle = "#888";
              context.fillRect(k, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
            }
            
            
           
                    
            // TEST
                  
            //$scope.files[i].source = audioContext.createMediaElementSource($scope.files[i].player);
            //$scope.files[i].gainNode = audioContext.createGain();
            //$scope.files[i].gainNode.gain.value = $scope.options.playbackvolume;
            //$scope.files[i].biquad = audioContext.createBiquadFilter();
            //$scope.files[i].biquad.frequency.value = 1000;
            //$scope.files[i].biquad.type = "highpass";
            //$scope.files[i].biquad.detune.value = -1200;
            //$scope.files[i].source.connect($scope.files[i].biquad);
            //$scope.files[i].biquad.connect($scope.files[i].gainNode);
            //$scope.files[i].gainNode.connect(audioContext.destination);
            
            // TEST END 
            
          });
        };
        xhr.send();
        */
    
  };

  $scope.processItem = function (idx, cb) {
    
    // Prepare a conversion, arranging all the option switches and effects arguments that sox needs
    
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
    //var noclobber = '--no-clobber';
    var noclobber = '';

    soxProcess($scope.files[idx].fullpath, $scope.files[idx].inputdir, $scope.files[idx].targetfilename, '-b 8 -r ' + $scope.options.samplerate + ' ' + normalise + ' ' + dither + ' ' + noclobber + ' ', $scope.files[idx].targetpath, 'remix ' + $scope.options.mixdown + ' speed ' + $scope.files[idx].transpose *100 + 'c' + ' trim ' + $scope.files[idx].trimstart + ' ' + $scope.files[idx].trimrange, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        console.log(stderr);
        var errortext = error + " ";
        if(errortext.indexOf('permission') > -1) {
                    
          console.log("Refused to overwrite source or existing file");
          alert("SoX --no-clobber option enabled: refused to overwrite existing file");
          // Reenable the Convert button/s after a success or failure. If it failed once it'll probably also fail the next time, but people should at least be given the illusion of hope...
          $scope.files[idx].processing = false;
          $scope.files[idx].buttontext = "Convert";
        } else {
          alert("Couldn't write the file, for some reason. Maybe this will give you a clue: " + errortext);
          $scope.files[idx].processing = false;
        } $scope.files[idx].buttontext = "Convert";
      } else {
        console.log("Done: " + $scope.files[idx].targetpath);
        $scope.files[idx].processing = false;
        $scope.files[idx].buttontext = "Convert";
        $scope.$apply();
        if (cb) {
          cb(idx);
        }
      }
    });
  };

  $scope.playerControl = function (idx) {
    
    
    $scope.files[idx].wavesurfer.playPause();
    /*
    var ply = $scope.files[idx].player;
    
    if (ply.paused) {
      if (ply.currentTime >= $scope.files[idx].trimend || ply.currentTime < $scope.files[idx].trimend) {
        ply.currentTime = $scope.files[idx].trimstart;
      }
      ply.play();
    } else {
      ply.pause();
    }
    */
  };
  
  $scope.highlight = function(idx) {
    console.log("highlighting");
    for (var i = 0, f; f = $scope.files[i]; i++) {
      if (i == idx) {
        f.highlight = true;
      } else {
        f.highlight = false;
      }
    }
  }
  
  function getKey(e) {
    //console.log(e.keyCode);
  }
  
  window.addEventListener('keydown', onKeyDown, true);
  
  function onKeyDown(e) {
    //console.log(e.keyCode);
    if(e.keyCode == 32 && !e.target.matches('textarea')) {
      e.preventDefault();
      for(var i=0, f; f = $scope.files[i]; i++ ) {
        if(f.highlight) {
          
          $scope.playerControl(i);
          
          
          if ($scope.files[i].player.currentTime >= $scope.files[i].trimend) {
            $scope.files[i].player.currentTime = $scope.files[i].trimstart;
          }
          //f.player.currentTime = 0;
          $scope.playerControl(i);
        }
      }
    }
  }

  $scope.convertAll = function () {
    for (var i in $scope.files) {
      $scope.processItem(i, function (msg) {
        console.log("File " + msg + " successfully converted");
        if (i == msg) {
          // Theoretically only fires after the entire job is done, but I'm terrible with promises and stuff.
          // Entirely possible that it triggers after all sox jobs have been *started*, but that they might continue 
          // in the background for quite a while if the files are big. For most oldschool (tracker/sampler) purposes,
          // the samples will be so tiny that a modern computer will let sox convert them nearly instantaneously.
          alert("All done!");
        }
      });
    }
  };

  document.ondragover = document.ondrop = function (ev) {
    ev.preventDefault();
  };

  document.body.ondrop = function (ev) {
    var files = ev.dataTransfer.files;

    // Is it a file or a directory?
    for (var i = 0, f; f = files[i]; i++) {
      if (!f.type) {
        //It's a directory.
        //console.log("it's a directory");

        fs.readdir(f.path, function (err, dir) {
          for (var i = 0, path; path = dir[i]; i++) {
            // do stuff with path

            // Not currently using the extension filter stuff; may add it back in future.
            if ($scope.options.filterext.length > 0 || $scope.options.filterext != '*') {
              if (path.indexOf($scope.options.filterext) > -1 || path.indexOf($scope.options.filterext.toUpperCase()) > -1 || path.indexOf($scope.options.filterext.toLowerCase()) > -1) {
                createItem(files[0].path + '/' + path);
              }
            } else {
              createItem(files[0].path + '/' + path);
            }
          }
        });
      } else {
        //It's a single file.
        createItem(f.path);
      }
    }

    ev.preventDefault();
  };

  function transUpdate(idx) {
        
    var transp = $scope.files[idx].transpose;    
    // Logarithmic scaling of semitones to playback rate, where 1 is original rate
    var detuneval = Math.pow(2, transp/12);
    console.log(detuneval);
    $scope.files[idx].wavesurfer.setPlaybackRate( detuneval);
    console.log($scope.files[idx].wavesurfer.regions.list);
    if($scope.files[idx].wavesurfer.regions.length > 0) {
      for (var i=0, reg; reg = $scope.files[idx].wavesurfer.regions[i]; i++) {
        $scope.files[idx].trimstart = reg.start;
        $scope.files[idx].trimend = reg.end;
        $scope.files[idx].trimrange = reg.end-reg.start;
        console.log("Updated region range");
      }
    } else {
      $scope.files[idx].trimstart = 0;
      $scope.files[idx].trimend = $scope.files[idx].wavesurfer.getDuration();
      $scope.files[idx].trimrange = $scope.files[idx].wavesurfer.getDuration()
    }
    
    
  }

  $scope.transposeUp = function(idx){
    $scope.files[idx].transpose +=1;
    transUpdate(idx);
  }
  
  $scope.transposeDown = function(idx){
    $scope.files[idx].transpose -=1;
    transUpdate(idx);        
  }

  function createItem(path) {
    var inpath = path;
    var indir = inpath.substring(0, inpath.lastIndexOf('/') + 1);
    var infile = inpath.substring(inpath.lastIndexOf('/') + 1, inpath.length);
    var outdir = indir;
    var outfile = infile;
    
    // If the input is an mp3, change its output target filename to wav. SoX will infer that it's 
    // supposed to convert to wav.
    var ext = outfile.substr(outfile.lastIndexOf('.')+1, 4);
    //if(ext == 'mp3' || ext == 'MP3' || ext == 'mP3' || ext == 'Mp3') {
    if(ext != 'wav') {
      outfile = outfile.substr(0, outfile.length-3) + 'wav';
    }


    var tmpfile = {
      fullpath: inpath,
      inputdir: indir,
      targetpath: outdir + outfile,
      filename: infile,
      targetfilename: outfile,
      name: outfile,
      processing: false,
      buttontext: "Convert",
      showplayer: true,
      highlight: false,
      trimstart: 0,
      trimend: 0,
      trimrange: 0,
      originalsize: 0,
      outputsize: 0,
      outputduration: 0,
      transpose: 0,
      playing: false,
      trimoptions: {
        floor: 0,
        ceil: 0,
        step: 0.01,
        precision: 2,
        minRange: 0.1,
        pushRange: true
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

    // Populate a load of those fields with soxi output

    soxInfo(inpath, '-t', function (error, stdout, stderr) {
      console.log(stdout);
      if (!error) {
        tmpfile.info.filetype = stdout;
      } else {
        var errortext = error + " ";
        if(errortext.indexOf('undefinedsox') > -1 || errortext.indexOf('such file or')) {
          console.log("Couldn't find sox/soxi. Did you set the SoX path?");
          alert("Couldn't find sox/soxi on your system. Did you set the SoX path? Please check it and restart.");
        }
      }
    });
    soxInfo(inpath, '-r', function (error, stdout, stderr) {
      console.log(stdout);
      if (!error) {
        tmpfile.info.samplerate = stdout;
      }
    });
    soxInfo(inpath, '-c', function (error, stdout, stderr) {
      console.log(stdout);
      if (!error) {
        tmpfile.info.channelcount = stdout;
      }
    });
    soxInfo(inpath, '-b', function (error, stdout, stderr) {
      console.log("Bitdepth: " + stdout);
      if (!error) {
        tmpfile.info.bitdepth = stdout;
        if(stdout == 0){
          // Mp3s return 0 for bitdepth, since they're variable.
          // This wrecks trim range calculations elsewhere, so we force it to 1.
          tmpfile.info.bitdepth = 1;
        }
      }
    });
    soxInfo(inpath, '-e', function (error, stdout, stderr) {
      console.log(stdout);
      if (!error) {
        tmpfile.info.encoding = stdout;
      }
    });
    $timeout(function () {
      
      // The last of the soxi calls, then a bit of maths to work out some more things
      
      soxInfo(inpath, '-D', function (error, stdout, stderr) {
        console.log(stdout);
        if (!error) {
          tmpfile.info.duration = Math.round(stdout * 100) / 100;
          //console.log("tmpfile info duration: " +tmpfile.info.duration);
          tmpfile.trimrange = tmpfile.info.duration;
          tmpfile.trimend = tmpfile.info.duration;
          tmpfile.trimoptions.ceil = tmpfile.info.duration;
          tmpfile.originalsize = tmpfile.info.bitdepth * tmpfile.info.samplerate * tmpfile.info.channelcount * tmpfile.info.duration / 8;
          //tmpfile.outputsize = $scope.options.bitdepth * $scope.options.samplerate * tmpfile.info.duration / 8;
          tmpfile.outputsize = Math.round($scope.options.bitdepth * $scope.options.samplerate * tmpfile.trimrange / 8 * 100) / 100;
        }
      });
    }, 200);

    //console.log(tmpfile);
    $timeout(function () {
      
      // Push our file into the list, then go back and create an audio player and a range slider for it
      
      var opt = {};
      //console.log(tmpfile);
      $scope.files.push(tmpfile);
      var i = $scope.files.length - 1;      
      
      if(i == 0) {
        $scope.files[i].highlight = true;  //highlight the first sample for keyboard shortcuts
      }

      $scope.files[i].player = new Audio();
      $scope.files[i].player.src = 'file://' + $scope.files[i].fullpath;
      $scope.files[i].player.isPlaying = false;
      $scope.files[i].player.volume = $scope.options.playbackvolume / 100;
      //console.log($scope.files[i].player);
      $scope.files[i].player.ontimeupdate = function () {
        var playhead = document.getElementById('playhead-' + i);
        console.log(playhead.style['left']);

        if (!$scope.files[i].player.paused) {
          setInterval(function () {
            //console.log($scope.files[i].player.currentTime);

            var phNewpos = Math.round($scope.files[i].player.currentTime.map(0, $scope.files[i].info.duration, 0, 509),2);
            playhead.style['left'] = phNewpos + 'px';

            if ($scope.files[i].player.currentTime >= $scope.files[i].trimend) {
              $scope.files[i].player.currentTime = $scope.files[i].trimstart;
            }
          }, 30);
        }
      };
      

      drawAudio($scope.files.length - 1);

      $scope.$apply();
    }, 300);
  }
});