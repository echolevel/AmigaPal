# AmigaPal

A desktop app for preparing and converting 8bit samples to use in Protracker on Amiga. Also suitable for other trackers, old hardware
samplers, and similar obscure/obsolete purposes. Fundamentally a cross-platform GUI for [SoX - "the Swiss Army knife of sound processing programs"](http://sox.sourceforge.net/) 
(which must be installed on your system for AmigaPal to work). 


[![AmigaPal screen recording](./screenshot.png)](https://www.instagram.com/p/BUA2GN1Aot4/)

Features: 
---------

* Built with Electron, so should run on MacOS, Windows and Linux
* Drag and drop files to load, or load an entire directory for batch conversion
* Supports .wav, .mp3, .aiff/.aif and .raw as source audio files, at any bitdepths or samplerates that SoX can handle (lots)
* .wav and .mp3 files have a waveform display and preview player for selecting time ranges to which the output will be trimmed
* Estimated (but fairly close) target filesize and duration are calculated on the fly, so you can trim/downsample a sample to fit within your tracker module format's size limit (128kb for Protracker .MOD, though commonly believed to be 64kb - including by some popular replayers)
* Free entry field for target samplerate (AmigaPal assumes you have a familiarity with your target hardware/software so will know what's best to use here)
* Mono mixdown options for L+R mix, L channel only, R channel only; or disable Mono to retain the source audio's channel configuration.
* Normalise (togglable)
* Dither (togglable) - off by default because it's usually undesirable when converting for Protracker (with a target bit-depth of 8, most converters' dithering adds a lot of horrible noise)
* Per-file transpose up or down by semitones
* Custom output directory for converted files; if left blank, files will be saved to the same directory as the source files
* Custom string to append to converted files, positionable as a prefix or a suffix (without this you risk overwriting your original file; --no-clobber mode is NOT enabled in AmigaPal)
* Specify the directory path of the SoX binary you want to use, in case you have multiple versions
* Global volume control for preview audio
* Preview audio loops when adjusting trim ranges - the loop you hear is the loop you'll get in the output file
* All options are saved automatically for next time
* If you've got a big list of files but want different settings for each of them, just tweak the settings between conversions - they all take immediate effect on any subsequent conversions
* The 'Convert All' button does exactly what you think it does. Be sure that's what you want before clicking it with a huge folder of samples loaded up...


Installation
------------

As long as you've got SoX installed, and can find the path to the sox binary, you should be all set. 

soxi is also used to gather initial source file info, calculate target size/duration, and draw the waveform; it *should* be in the same directory as sox got installed to.


Building (development only)
---------------------------

You'll need to have bower and npm installed. 

Clone the repo:

`
https://github.com/echolevel/AmigaPal.git
`

Install all the dependencies:

`
cd AmigaPal && npm install && cd src && bower install
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

I'm sure there's more stuff that should be here. I'll add as I go. Meanwhile, an explanation of why AmigaPal: I made this for myself, to speed up converting audio samples into the format
I generally use in Protracker on the Amiga. They need to be mono, 8bit, and usually I want the samplerate to be 11025Hz. Adobe Audition doesn't get it quite right,
nor do many other full-scale editors; Renoise does it exactly the way I want, but that can be a pain to use on lots of small samples. With h0ffman and kebby's help,
I worked out the right SoX commands for what I wanted (--no-dither was the key).
So it's a helper tool (hence pal), plus I grew up on PAL-region Amigas (hence pal), plus I like the redundancy of Amiga (friend) and Pal (friend).
Plus I couldn't think of anything snappier to call it.

Also, "is it just for Amiga?"- by no means. As soon as I shared a video demo a few days ago, people started saying they'd use it to
prepare samples for Akai MPCs and other stuff, or just as a general sample editing/formatting utility. So you can bypass
the mono mixdown and leave channels the same as in the source file, and there's hopefully enough flexibility for most target hardware. I'm
open to some feature requests, but by and large, anything moderately fancier is probably a job for your full-scale audio editing suite.