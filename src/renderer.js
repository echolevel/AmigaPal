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

  var pathpath = require('path');
  var dataurl = require('dataurl');
  var exec = require('child_process').exec;
  var fs = require('fs');

  var remote = require('electron').remote;
  var dialog = remote.require('electron').dialog;
  var mainProcess = remote.require(__dirname + '/main.js');
  var bitcrusher = require('bitcrusher');
  var intervals = []; // zap this to tidy up orphaned playhead-progress intervals
  $scope.writingWav = false;
  $scope.statusmsg = "All is well";
  $scope.selectedItem = 0;


  Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
  };

  $scope.ptnotes = {
    "C-1": 4143, "C#1": 4389, "D-1": 4654, "D#1": 4926, "E-1": 5231, "F-1": 5542, "F#1": 5872, "G-1": 6222, "G#1": 6592, "A-1": 6982, "A#1": 7389, "B-1": 7829,
    "C-2": 8287, "C#2": 8779, "D-2": 9309, "D#2": 9852, "E-2": 10462, "F-2": 11084, "F#2": 11744, "G-2": 12445, "G#2": 13185, "A-2": 13964, "A#2": 14778, "B-2": 15694,
    "C-3": 16574, "C#3": 17558, "D-3": 18667, "D#3": 19704, "E-3": 20864, "F-3": 22168, "F#3": 23489, "G-3": 24803, "G#3": 26273, "A-3": 27928, "A#3": 29557, "B-3": 31388
  }

  $scope.mixdownTypes = {
    "L + R": '-',
    "Left"  : '1',
    "Right"  : '2'
  }

  $scope.filetypes = ['wav', 'mp3', 'ogg', 'flac', 'aac', 'aif', 'aiff'];


  $scope.working = false;
  

  function soxCheck() {
    // Is sox installed? Reachable?
    if(process.platform !== 'win32' && $scope.options.soxpath && $scope.options.soxpath.substr(-1) != '/') {
      // Force a trailing slash for MacOS and Linux
      $scope.options.soxpath += '/';
    }
    exec($scope.options.soxpath + 'sox', function(error, stdout, stderr) {
      var errortext = error + '';
      if (errortext.indexOf('FAIL sox') > -1) {
        $scope.foundsox = true;
        console.log("Found sox at " + $scope.options.soxpath);
      } else {
        console.log(errortext);
        console.log("Couldn't find sox/soxi. Did you set the SoX path?");
        alert("Couldn't find sox/soxi on your system. Did you set the SoX path? Please check it and restart.");
      }
    })
  }

  if (!localStorage.getItem('config')) {
    console.log("No local storage found");
    var options = {
      normalise: true,
      dither: false,
      samplerate: 27928,
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
      soxpath: '/usr/local/bin/',
      //lowpasscutoff: 10000,
      //highpasscutoff: 1,
      preview8bit: false,
      previewSamplerate: false
    };
    localStorage.setItem('config', JSON.stringify(options));
    $scope.options = options;
  } else {
    // Get the saved options
    $scope.options = JSON.parse(localStorage.getItem('config'));
    // Check to see if SoX is available (kinda important):
    soxCheck();
  }


  // Preview chain setup

  var audioContext = new AudioContext();
  var scriptNode = audioContext.createScriptProcessor(4096, 1, 1);

  var bitcrushNode = bitcrusher(audioContext, {
    bitDepth: 16,
    frequency: 1
  })

  var volumeGain = audioContext.createGain();
  bitcrushNode.connect(volumeGain);
  volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);
  volumeGain.connect(audioContext.destination);

  // Preview chain END


  $scope.saveOptions = function () {
    localStorage.setItem('config', JSON.stringify($scope.options));
  };

  var soxiopts = ['-t', '-r', '-c', '-D', '-b', '-e'];
  // soxi options:
  // -t (detected filetype), -r (samplerate), -c (channel count), -D (duration), -b (bit depth), -e (encoding)

  $scope.files = [];



  function soxInfo(input, opt, callback) {
    exec($scope.options.soxpath + 'sox --i ' + opt + ' "' + input + '"', function (error, stdout, stderr) {
      callback(error, stdout.replace(/\r?\n|\r/g, ''), stderr);
    });
  }

  function soxProcess(input, opt, output, effects, callback) {
    exec($scope.options.soxpath + 'sox "' + input + '" ' + opt + ' "' + output + '" ' + effects, function (error, stdout, stderr) {
      callback(error, stdout, stderr);
    });
  }


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
            var fileExt = path.substring(path.lastIndexOf('.')+1, path.length);
            if($scope.filetypes.indexOf(fileExt) > -1) {
              var promise = prepItem(files[0].path + '/' + path);
              promise.then(function(tmpfile) {
                createItem(tmpfile);
              })
            } else {
              console.log("Nope, not loading ", fileExt);
            }
            /*
            if ($scope.options.filterext.length > 0 || $scope.options.filterext != '*') {
              if (path.indexOf($scope.options.filterext) > -1 || path.indexOf($scope.options.filterext.toUpperCase()) > -1 || path.indexOf($scope.options.filterext.toLowerCase()) > -1) {
                var promise = prepItem(files[0].path + '/' + path);
                promise.then(function(tmpfile) {
                  createItem(tmpfile);
                })
              }
            } else {
              var promise = prepItem(files[0].path + '/' + path);
              promise.then(function(tmpfile) {
                createItem(tmpfile);
              })
            }*/
          }
        });
      } else {
        //It's a single file.
        //createItem(f.path);
        var fileExt = f.path.substring(f.path.lastIndexOf('.')+1, f.path.length);
        console.log(f.path);
        if($scope.filetypes.indexOf(fileExt) > -1) {
          var promise = prepItem(f.path);
          promise.then(function(tmpfile) {
            console.log("Promise returned, did a thing");
            console.log(tmpfile);
            createItem(tmpfile);
          })
        } else {
          console.log("Nope, not loading ", fileExt);
        }
      }
    }

    ev.preventDefault();
  };

  function prepItem(path) {
    return new Promise(function(resolve, reject) {
      var inpath = path;
      var indir = inpath.substring(0, inpath.lastIndexOf('/') + 1);
      var infile = inpath.substring(inpath.lastIndexOf('/') + 1, inpath.length);
      var outdir = indir;
      var outfile = infile.substring(0, infile.lastIndexOf('.')) + '.8svx';

      var tmpfile = {
        fullpath: inpath,
        targetpath: outdir + outfile,
        filename: infile,
        targetfilename: outfile,
        name: outfile,
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
        warningmessage: "",
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

      soxInfo(inpath, '-t', function (error, stdout, stderr) {
        if (!error) {
          tmpfile.info.filetype = stdout;
        }
      });
      soxInfo(inpath, '-r', function (error, stdout, stderr) {
        if (!error) {
          tmpfile.info.samplerate = stdout;
        }
      });
      soxInfo(inpath, '-c', function (error, stdout, stderr) {
        if (!error) {
          tmpfile.info.channelcount = stdout;
        }
      });
      soxInfo(inpath, '-b', function (error, stdout, stderr) {
        if (!error) {
          tmpfile.info.bitdepth = stdout;
        }
      });
      soxInfo(inpath, '-e', function (error, stdout, stderr) {
        if (!error) {
          tmpfile.info.encoding = stdout;
        }
      });
      $timeout(function () {
        soxInfo(inpath, '-D', function (error, stdout, stderr) {
          if (!error) {
            tmpfile.info.duration = Math.round(stdout * 100) / 100;
            tmpfile.trimrange = tmpfile.info.duration;
            tmpfile.trimend = tmpfile.info.duration;
            tmpfile.trimoptions.ceil = tmpfile.info.duration;
            tmpfile.originalsize = tmpfile.info.bitdepth * tmpfile.info.samplerate * tmpfile.info.channelcount * tmpfile.info.duration / 8;
            tmpfile.outputsize = $scope.options.bitdepth * $scope.options.samplerate * tmpfile.info.duration / 8;
            resolve(tmpfile);
          }
        });
      }, 200);
    })
  }


  function createItem(tmpfile) {

      $scope.files.push(tmpfile);
      var i = $scope.files.length - 1;
      $scope.selectedItem = i;

      fs.readFile($scope.files[i].fullpath, (err,data) => {
        if(err) { console.log("failed")} else {
          $scope.files[i].srcdata = dataurl.convert({ data, mimetype: 'audio/wav'});
          $scope.files[i].player = new Audio(dataurl.convert({ data, mimetype: 'audio/wav'}));
          $scope.files[i].preview = audioContext.createMediaElementSource($scope.files[i].player);
          $scope.files[i].filterLo = audioContext.createBiquadFilter();
          $scope.files[i].filterHi = audioContext.createBiquadFilter();
          $scope.files[i].filterLo.type = "lowpass";
          $scope.files[i].filterHi.type = "highpass";
          $scope.files[i].filterLo.frequency.setValueAtTime(20000, audioContext.currentTime);
          $scope.files[i].filterHi.frequency.setValueAtTime(40, audioContext.currentTime);

          $scope.files[i].preview.connect($scope.files[i].filterLo);
          $scope.files[i].filterLo.connect($scope.files[i].filterHi);


          $scope.files[i].leftGainLevel = 1;
          $scope.files[i].rightGainLevel = 1;
          $scope.files[i].splitter = audioContext.createChannelSplitter(2);
          $scope.files[i].leftGain = audioContext.createGain();
          $scope.files[i].rightGain = audioContext.createGain();
          $scope.files[i].outputmerger = audioContext.createChannelMerger(1);
          $scope.files[i].leftGain.gain.setValueAtTime($scope.files[i].leftGainLevel, audioContext.currentTime);
          $scope.files[i].rightGain.gain.setValueAtTime($scope.files[i].rightGainLevel, audioContext.currentTime);

          $scope.files[i].filterHi.connect($scope.files[i].splitter);
          $scope.files[i].splitter.connect($scope.files[i].leftGain, 0);
          $scope.files[i].splitter.connect($scope.files[i].rightGain, 1);

          $scope.files[i].leftGain.connect($scope.files[i].outputmerger, 0);
          $scope.files[i].rightGain.connect($scope.files[i].outputmerger, 0);

          $scope.files[i].filtercanvas = document.getElementById('filter-canvas-' + i);
          $scope.files[i].spectrumcanvas = document.getElementById('spectrum-canvas-' + i);
          $scope.files[i].spectrum = audioContext.createAnalyser();
          $scope.files[i].spectrum.fftSize= 128;
          $scope.files[i].spectrumData = new Uint8Array($scope.files[i].spectrum.frequencyBinCount);
          $scope.files[i].spectrumCtx = $scope.files[i].spectrumcanvas.getContext('2d');

          $scope.files[i].outputmerger.connect($scope.files[i].spectrum);
          $scope.files[i].spectrum.connect(bitcrushNode);

          $scope.files[i].player.isPlaying = false;
          $scope.files[i].player.unplayed = true;


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

          //$scope.files[i].draw();

          $scope.files[i].player.addEventListener('timeupdate', function() {

            if ($scope.files[i]) {
                if(!$scope.files[i].player.paused) {

                  // Move the playhead smoothly
                  var playhead = document.getElementById('playhead-' + i);
                  console.log(playhead.style['left']);


                  var tempinterval = setInterval(function () {

                        //console.log($scope.files[i].player.currentTime);
                        var phNewpos = Math.round($scope.files[i].player.currentTime.map(0, $scope.files[i].info.duration, 0, 325));
                        playhead.style['left'] = phNewpos + 'px';

                        if ($scope.files[i].player.currentTime >= $scope.files[i].trimend) {
                          $scope.files[i].player.currentTime = $scope.files[i].trimstart;
                        }
                  }, 30);
                  intervals.push(tempinterval);

                }
              }

          })

          /*
          $scope.files[i].player.ontimeupdate = function () {
            var playhead = document.getElementById('playhead-' + i);
            //console.log(playhead.style['left']);

            if (!$scope.files[i].player.paused) {
              setInterval(function () {
                //console.log($scope.files[i].player.currentTime);
                var phNewpos = Math.round($scope.files[i].player.currentTime.map(0, $scope.files[i].info.duration, 0, 325));
                playhead.style['left'] = phNewpos + 'px';

                if ($scope.files[i].player.currentTime >= $scope.files[i].trimend) {
                  $scope.files[i].player.currentTime = $scope.files[i].trimstart;
                }
              }, 30);
            }
          };
          */
          $scope.updateItemEffects(i);
          updateGlobalEffects();
        }

      }) //fs.readFile end

      drawAudio($scope.files.length - 1);
      $scope.$apply();

  }


  var drawAudio = function drawAudio(i) {

    fs.readFile($scope.files[i].fullpath, function(err, data) {
      if(data && !err) {
        console.log("loaded successfully...");
        var file = new window.Blob([data]);
        var abuffer;
        var fileReader = new FileReader();
        fileReader.onload = function(event) {
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
            $scope.files[i].canvas = document.getElementById('wform-canvas-' + i);
            var context = $scope.files[i].canvas.getContext('2d');
            var data = buffer.getChannelData(0);
            var step = Math.ceil(data.length / $scope.files[i].canvas.width);
            var amp = $scope.files[i].canvas.height / 2;
            for (var k = 0; k < $scope.files[i].canvas.width; k++) {
              var min = 1.0;
              var max = -1.0;
              for (var j = 0; j < step; j++) {
                var datum = data[k * step + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
              }
              context.fillStyle = "#7cca8f";
              context.fillRect(k, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
            }
          })
        }
        fileReader.readAsArrayBuffer(file);
      }
    })

  };



  $scope.processItem = function (idx, cb) {
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
    if($scope.options.samplerate/2 > 8202 && $scope.options.lowpass_enabled) {
      lowp = " lowpass 8202";
    }

    var infile = $scope.files[idx].fullpath;
    var outfile = $scope.files[idx].targetpath;
    var depthcmd = ' -b 8';
    var filtercmd = '';
    if($scope.files[idx].lowpassfrequency < 20000 || $scope.files[idx].highpassfrequency > 40 ) {
      //sinccmd = ' sinc ' + $scope.options.highpasscutoff + '-' + $scope.options.lowpasscutoff + ' ';
      filtercmd = ' highpass -1  ' + $scope.files[idx].highpassfrequency + ' lowpass -1 ' + $scope.files[idx].lowpassfrequency + ' ';
    }
    var trimcmd = ' trim ' + $scope.files[idx].trimstart + ' ' + $scope.files[idx].trimrange;
    if($scope.files[idx].info.channelcount > 1) {
        var remixcmd = ' remix ' + $scope.options.mixdown;
    } else {
      var remixcmd = '';
    }
    var normcmd = ' norm 0.5';
    var dithercmd = ' dither -S';
    var ratecmd = ' rate ' + $scope.options.samplerate;


    soxProcess(infile,' ', outfile, trimcmd + normcmd + remixcmd + filtercmd + ratecmd + lowp + normcmd + dithercmd, function (error, stdout, stderr) {
      if (error) {
        console.log(error);
        console.log(stderr);
        alert("Something went horribly wrong");
      } else {
        console.log("Done: " + $scope.files[idx].targetpath);
        $scope.files[idx].processing = false;
        $scope.files[idx].buttontext = "Convert";
        $scope.statusmsg = "Success!";
        $timeout(function() {
          $scope.statusmsg = "All is well";
        }, 5000)
        $scope.$apply();
        if (cb) {
          cb(idx);
        }
      }
    });
  };

  $scope.playerControl = function (idx) {
    //var player = document.getElementById('audio-'+idx);
    //player.play();
    if($scope.files[idx].player.unplayed) {
      $scope.files[idx].player.unplayed = false;
    }
    if ($scope.files[idx].player.paused) {
      $scope.files[idx].player.play();
    } else {
      $scope.files[idx].player.pause();
    }
  };

  $scope.playerControlRestart = function(idx) {
    if($scope.files[idx].player.unplayed) {
      $scope.files[idx].player.unplayed = false;
    }
    if ($scope.files[idx].player.paused) {
      $scope.files[idx].player.currentTime = $scope.files[idx].trimstart;
      $scope.files[idx].player.play();
    } else {
      $scope.files[idx].player.pause();
    }
  }

  $scope.convertAll = function () {
    for (var i in $scope.files) {
      //pause everything first
      $scope.files[i].player.pause();
      $scope.processItem(i, function (msg) {
        console.log("File " + msg + " successfully converted");
        if (i == msg) {
          $scope.statusmsg = "Success!";
          $timeout(function() {
            $scope.statusmsg = "All is well";
          }, 5000)
        }
      });
    }
  };


  $scope.removeFile = function(i) {
    $scope.files[i].player.pause();
    $scope.files[i].filterHi.disconnect(splitter);
    $scope.files[i].player.removeEventListener('timeupdate', function(){
      console.log("eventlistener removed");
    });
    $scope.files.splice(i, 1);
    intervals.forEach(clearInterval);
  }

  $scope.clearAll = function() {
    for (var i = 0; i < $scope.files.length; i++) {
      $scope.files[i].player.pause();
      $scope.files[i].player.removeEventListener('timeupdate', function(){
        console.log("eventlistener removed");
      });
      $scope.files[i].filterHi.disconnect(splitter);
    }
    $scope.files = [];
    intervals.forEach(clearInterval);
  }

  $scope.$watch('options', function () {
    // Always watch for changes to options, and update localstorage
    localStorage.setItem('config', JSON.stringify($scope.options));

    updateGlobalEffects();

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

  var toLin = function(value, width) {
    var minp = 0;
    var maxp = width;

    var minv = Math.log(40);
    var maxv = Math.log(20000);
    var scale = (maxv-minv) / (maxp-minp);
    return (Math.log(value)-minv) / scale + minp;
  }

  var drawFilters = function(i) {
    $scope.files[i].filterLo.frequency.setValueAtTime($scope.files[i].lowpassfrequency, audioContext.currentTime);
    $scope.files[i].filterHi.frequency.setValueAtTime($scope.files[i].highpassfrequency, audioContext.currentTime);

    // Test - draw on canvas
    var cnv = $scope.files[i].filtercanvas;
    var ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.fillStyle = "rgba(191, 115, 218, 0.5)";
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

  $scope.updateItemEffects = function() {
    if($scope.files) {
        for (var i in $scope.files) {
          drawFilters(i);
        }
    }
    return 1;
  }

  var updateGlobalEffects = function() {

    for (var f in $scope.files) {
      if($scope.files[f].info.channelcount > 1) {

        var leftGainLevel = 0
        var rightGainLevel = 0;

        if($scope.options.mixdown == '-') {
          leftGainLevel = 0.5;
          rightGainLevel = 0.5;
        } else if($scope.options.mixdown == '1') {
          leftGainLevel = 1;
          rightGainLevel = 0;
        } else if($scope.options.mixdown == '2') {
          leftGainLevel = 0;
          rightGainLevel = 1;
        }

        $scope.files[f].leftGain.gain.setValueAtTime(leftGainLevel, audioContext.currentTime);
        $scope.files[f].rightGain.gain.setValueAtTime(rightGainLevel, audioContext.currentTime);
      }


    }


      //filterLo.frequency.value = $scope.options.lowpasscutoff;
      //filterHi.frequency.value = $scope.options.highpasscutoff;

      if($scope.options.preview8bit) {
          bitcrushNode.bitDepth = 8
      } else {
          bitcrushNode.bitDepth = 16
      }

      var test = 31388;
      console.log("Map: ", test.map(0, 44100, 0, 1));
      if($scope.options.previewSamplerate) {
          bitcrushNode.frequency = $scope.options.samplerate.map(0, 44100, 0, 1);
      } else {
          bitcrushNode.frequency = 1
      }

      volumeGain.gain.setValueAtTime($scope.options.playbackvolume/100, audioContext.currentTime);

  }


  $scope.itemSelected = function(i) {
    $scope.selectedItem = i;
  }

  window.addEventListener('keydown', function(e) {

    if(e.keyCode === 27) {
      for(var i in $scope.files) {
        $scope.files[i].player.pause();
      }
      e.preventDefault();
    }

    if(e.keyCode === 40) {
      if($scope.files && $scope.selectedItem < $scope.files.length-1) {
        $scope.selectedItem++
        $scope.$apply();
      }
      e.preventDefault()
    }

    if(e.keyCode === 38) {
      if($scope.files && $scope.selectedItem-1 >= 0) {
        $scope.selectedItem--;
        $scope.$apply();
      }
      e.preventDefault();
    }

    if(e.keyCode === 32) {
      $scope.playerControlRestart($scope.selectedItem);
      e.preventDefault();
    }
  }, true);

});
