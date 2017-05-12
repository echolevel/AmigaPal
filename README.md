# AmigaPal

A desktop app for preparing and converting 8bit samples to use in Protracker on Amiga. Also suitable for other trackers, old hardware
samplers, and similar obscure/obsolete purposes. Fundamentally a cross-platform GUI for [SoX - "the Swiss Army knife of sound processing programs"](http://sox.sourceforge.net/) 
(which must be installed on your system for AmigaPal to work). 

![AmigaPal screenshot](./screenshot.png "AmigaPal screenshot")

##Features: 

* Built with Electron, so should run on MacOS, Windows and Linux
* Drag and drop files to load, or load an entire directory for batch conversion
* Supports .wav, .mp3, .aiff, .aif and .raw as source audio files, at any bitdepths or samplerates that SoX can handle (lots)
* .wav and .mp3 files have a waveform display and preview player for selecting time ranges to which the output will be trimmed
* Estimated (but fairly close) target filesize and duration are calculated on the fly, so you can trim/downsample a sample to fit within your tracker module format's size limit (128kb for Protracker .MOD, though commonly believed to be 64kb - including by some popular replayers)
* Free entry field for target samplerate (AmigaPal assumes you have a familiarity with your target hardware/software so will know what's best to use here)
* Mono mixdown options for L+R mix, L channel only, R channel only; or disable Mono to retain the source audio's channel configuration.
* Normalise, togglable
* Dither, togglable - off by default because it's usually undesirable when converting for Protracker (with a target bit-depth of 8, most converters' dithering adds a lot of horrible noise)
* Transpose up or down by cents of semitones, so 100 = 1 semitone, 1200 = 1 octave (unfortunately this can't be previewed due to HTML5 audio limitations, but target filesize/duration reflect it)
* Custom output directory for converted files; if left blank, files will be saved to the same directory as the source files
* Custom string to append to converted files, positionable as a prefix or a suffix (without this you risk overwriting your original file; --no-clobber mode is NOT enabled in AmigaPal)
* Specify the directory path of the SoX binary you want to use, in case you have multiple versions
* Global volume control for preview audio
* Preview audio loops when adjusting trim ranges - the loop you hear is the loop you'll get in the output file, even if the waveform display isn't always *quite* accurate
* All options are saved automatically for next time
* If you've got a big list of files but want different settings for each of them, just tweak the settings between conversions - they all take immediate effect on any subsequent conversions
* The 'Convert All' button does exactly what you think it does. Be sure that's what you want before clicking it with a huge folder of samples loaded up...

##Installation

As long as you've got SoX installed, and can find the path to the sox binary, you should be all set. 

##More Info

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