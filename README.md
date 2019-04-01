# AmigaPal

A desktop app for preparing and converting 8bit samples to use in Protracker on Amiga. Also suitable for some other trackers, perhaps certain old hardware
samplers, and similar obscure/obsolete purposes. Fundamentally a cross-platform GUI for [SoX - "the Swiss Army knife of sound processing programs"](http://sox.sourceforge.net/)
(which must be installed on your system for AmigaPal to work).

<img src="./screenshot.png" width="500">


Features:
---------

* Built with Electron, so should run on MacOS, Windows and Linux
* Drag and drop files to load, or load an entire directory for batch conversion to 8svx
* Supports .wav, .mp3, .ogg, .flac, .aiff/.aif and .aac as source audio files, at any bitdepths or samplerates that SoX can handle (lots)
* .wav, .mp3, .ogg and .flac files have a waveform display and preview player for selecting time ranges to which the output will be trimmed. .aiff/aif don't display or play back, but can still be converted to 8svx as normal. If your SoX version doesn't have ogg/flac libraries installed, importing those filetypes will fail silently.
* Estimated (but fairly close) target filesize and duration are calculated on the fly, so you can trim/downsample a sample to fit within your tracker module format's size limit (128kb for Protracker .MOD, though commonly believed to be 64kb - including by some popular replayers)
* Select a target ProTracker note to automatically set the relevant samplerate
* Optional preview of how the sample(s) will sound after being downsampled and converted to 8bit - not perfect, but a close approximation! The reduction factor of the samplerate preview is determined by the 'ProTracker target note'/'Sample rate' settings.
* Lowpass and highpass filters: they can be used separately, or together as a bandpass. Previewing in AmigaPal will let you hear a very close approximation of the way it'll sound in ProTracker. NEW: now these are per-sample, rather than global as before. Also the sliders are now logarithmic, allowing for greater precision at lower frequencies. The fixed 8k post-processing lowpass filter is still global.
* Waveform display is now peak-normalised, for extra visual clarity when trimming
* Free entry field for target samplerate (AmigaPal assumes you have a familiarity with your target hardware/software so will know what's best to use here)
* Mono mixdown options for L+R mix, L channel only, R channel only. Samples which are already mono aren't affected by this.
* 'Mono mixdown type' is now also previewed in AmigaPal, so you can check for phase cancellation issues or other unexpected phenomenon.
* SoX normalises to -0.5db and applies some dithering (-S option)
* Global volume control for previewing audio (does not affect output gain/normalisation)
* Preview audio loops when adjusting trim ranges - the loop you hear is the loop you'll get in the output file
* All options are saved automatically for next time
* If you've got a big list of files but want different settings for each of them, just tweak the settings between conversions - they all take immediate effect on any subsequent conversions
* As of v0.0.6-beta6, all sample rate, mixdown and post-LP settings are available per-sample, while the 'Apply to all' button can be used to apply global settings, overriding any per-sample customisation
* The 'Convert All' button does exactly what you think it does. Be sure that's what you want before clicking it with a huge folder of samples loaded up...
* There are now some keyboard shortcuts: clicking a sample will highlight it, then spacebar will toggle that sample's playback (restarting from the beginning each time, whereas the play/pause button continues from where you left off). Up/Down arrows change which sample is highlighted. Esc stops all sample playback globally. Enter/Return converts the currently selected sample. Backspace removes the currently selected sample from AmigaPal (does not delete the original file). L (left), R (right) and B (both) sets the current sample's mono mixdown type.
* 1st April: Dramatically reduced memory footprint and CPU load when large numbers of samples are loaded for batch conversion. This was achieved by fixing the packaged build's ability to stream files from disk as HTML5 audio player objects, rather than their being read into buffers in memory; zapping cached waveform display data after drawing it on the canvas (waveform displays have their own canvases, overlaid by translucent filter displays, so never need to be redrawn); and reverting Sample Rate/8bit preview effects to the global chain rather than per-sample. This means that when 'Sample rate preview' is enabled, sample playback is now monotimbral (only one sample can play at a time) - clicking on another sample while one sample is playing will stop playback and begin playback of the newly selected sample. If the new sample's target PT note is different, this will be reflected in the Sample rate preview effect. If 'Sample rate preview' is disabled, multiple samples can be played simultaneously as before. 8bit preview is independent of all this - it's either globally on or off, and doesn't affect playback timbrality/polyphony.



Known Bugs / To Do:
----------

* I might reinstate the old 'output directory' option, because selecting ~50 8svx files from amongst ~50 wav files in order to transfer them to Amiga can be a bit of a pain...

* It would be nice to be able to layer/mix samples in AmigaPal. You can do it in ProTracker, of course, but mixing at higher sample rates/bit depths might give better results in the end. We'd need to be able to select multiple samples, and also decide on an output filename template. Low priority for now!

Installation
------------

As long as you've got SoX installed, and can find the path to the sox binary, you should be all set. The default path is /usr/local/bin.

CLI
---

If you'd prefer to script the conversion process, or would just rather not use the Electron GUI, here's a guide to the SoX settings that AmigaPal uses:

`sox [infilename].wav [outfilename].8svx trim [starttime] [duration] norm 0.5 remix - highpass -1 [frequency in hz] lowpass -1 [frequency in hz] rate [sample rate] lowpass -1 8000 norm 0.5 dither -S`

The second lowpass filter is optional, being processed after the sample rate reduction in the event that some unwanted hiss needs to be removed. The conversion to 8bit is implicit in the 8SVX filetype, which is an explicitly 8bit format.

Values in square brackets are mapped to AmigaPal's controls. Here's an example for converting a 16bit stereo WAV to an 8bit 8SVX sample trimmed to 2.3 seconds starting at 0.2 seconds, normalised, highpassed (low cut) at 60hz, lowpassed (high cut) at 10000, reduced to the sample rate of ProTracker's note 'A-3' (~27928hz), lowpassed again at 8k to remove hiss, normalised again, then finally dithered:

`sox inputfile.wav outfile.8svx trim 0.2 2.3 norm 0.5 remix - highpass -1 60 lowpass -1 10000 rate 27928 lowpass -1 8000 norm 0.5 dither -S`

AmigaPal is doing nothing special that you can't do with this SoX syntax, but it makes batch-converting stuff a lot easier and removes some guesswork! You might find it's worth playing with the order in which SoX processes the effects (with some caveats, of which SoX's terse and only occasionally helpful error messages will inform you), but this is what works best for me.

Building (development only)
---------------------------

You'll need to have bower and npm installed.

Clone the repo:

`
https://github.com/echolevel/AmigaPal.git
`

Install all the dependencies:

`
cd AmigaPal && npm install  && bower install
`

Run:

`
electron-forge start
`

Package (optional - see [electron-packager](https://github.com/electron-userland/electron-packager) documentation for more on platform and arch options):

`
electron-forge package --platform=darwin,win32 --arch=x64
`

Publish (optional, and you'll need to use your own GitHub credentials in package.json - my access token is set locally as an environment variable):

`
electron-forge publish
`

Note that electron-forge's publish can only package a distributable for the architecture/platform you're building on. I'm on Mac, so for AmigaPal's Windows zip in the Releases section, I've just zipped and uploaded the package created with 'electron-forge package --platform=darwin,win32 --arch=x64'. This may or may not be wise ¯\\__(ツ)__/¯



More Info
---------

"Why is it called AmigaPal?" - I made this for myself, to speed up converting audio samples into the format
I generally use in ProTracker on the Amiga. They need to be mono, 8bit, and it's useful if they conform to the samplerates ProTracker uses for musical notes.
By default AmigaPal converts to 27928hz (A-3), which produces a relatively high quality 8bit 8svx file. So it's a helper tool (hence pal), plus I grew up
using PAL-region Amigas (hence pal), plus I like the redundancy of Amiga (friend) and Pal (friend). Also it currently defaults to using PAL samplerates for
ProTracker notes...I may add in NTSC as an alternative if there's any demand. AmigaPal is essentially a front-end for a SoX command that I baked with the help
of h0ffman, kebby and some of my own trial-and-error testing. The dream would be to replicate the lowpass filter 8bitbubsy has implemented in his MacOS/PC port
of ProTracker and use it as post-bit reduction processing to reduce some dithering noise, but I haven't been able to match it so far. Right now, AmigaPal gives the
best quality I've been able to achieve within ProTracker's limitations, according to my tastes - your mileage may vary!
