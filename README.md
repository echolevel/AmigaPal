# AmigaPal

A desktop app for preparing and converting 8bit samples to use in Protracker on the Commodore Amiga. Also suitable for some other trackers, perhaps certain old hardware samplers, Nintendo Game Boy running LSDJ, and similar stuff.

<p align="center">
  <img align src="./screenshot.png" width="450" height="664">
</p>

Features:
---------

* Built with Electron, so should run on MacOS, Windows and Linux.
* Drag and drop files to load, or load an entire directory for batch conversion to 8SVX or WAV
* Supports PCM WAV, MP3, AAC, OGG, and FLAC as source audio files
* Waveform display and preview player for selecting time ranges to which the output will be trimmed
* Keyboard controls: preview notes with classic tracker-style QWERTY pianokey layout, F1/F2 to shift octaves and `\` (next to Left Shift on UK keyboards) to kill a currently-playing note. Up/down arrows highlight previous or next file items
* Target filesize and duration are calculated on the fly, so you can trim/downsample a sample to fit within your tracker module format's size limit (128kb for Protracker MOD, though commonly believed to be 64kb - including by some older replayers)
* Select a target ProTracker note to automatically set the relevant samplerate
* Optional preview of how the sample(s) will sound after being downsampled and converted to 8bit. The reduction factor of the samplerate preview is determined by the 'ProTracker note' setting
* Lowpass and highpass filters: they can be used separately, or together as a bandpass. Previewing in AmigaPal will let you hear a very close approximation of the way it'll sound in ProTracker
* Waveform display is now peak-normalised, for extra visual clarity when trimming
* Global volume control for previewing audio (does not affect output gain/normalisation)
* All options are saved automatically for next time
* If you've got a big list of files but want different settings for each of them, just tweak the settings between conversions - they all take immediate effect on any subsequent conversions
* Output to the same directory as the source, or choose a target path for all converted files (this option will be saved)
* Optional per-item brickwall limiter, for beefing up samples before conversion. See changelog for details
* WAV export option added - writes 8bit mono RIFF PCM WAVs which might be useful for Game Boy musicians. Let me know how this works out!
* Optionally save a 4-channel Amiga Protracker MOD file as well as the converted samples. This MOD will have whatever title you give it, or a default title and filename, and will contain all the samples you've converted occupying sample slots in whatever order they appear in AmigaPal. This is probably as fast as it's possible to get started with Protracker!

Changelog:
----------

**13th May 2020 -**
* SoX is no longer a dependency! No more messing about with unreliable installation paths, environment variables or stdin/stdout. Now all file reading, signal processing, resampling, bit-reduction and file export is done natively in the app.
* Migrating away from SoX means that what you hear in AmigaPal when previewing a sample is much closer to what you'll hear after exporting. Previously the preview system used vague approximations of the settings that were passed to SoX, but now the offline processing and export system uses exactly the same DSP chains as the preview system. Any further difference is due to your tracker's internal resampling algorithm or the Amiga's hardware.
* Previewing notes is now done with the QWERTY keys and mimics Protracker's non-keyjazz-mode behaviour almost exactly: preview the note on three octaves (switch between upper and lower octave pairs using F1 and F2), and kill a playing note with the `\` key (the one next to Left Shift on my keyboard).
* One major improvement in that area is the addition of a per-item brickwall limiter/maximiser, which lets you smash the hell out of a sample before conversion - often desirable when trying to get good signal to noise performance out of Protracker on a hardware Amiga. It has a very fast attack and a pretty quick release, and the only exposed controls are threshold (reduce this to slam down the dynamic range) and make-up gain, which is usually necessary for bringing the level back up once the dynamics have been flattened. Experiment with this...
* The limiter's makeup gain can also be used when the limiter is switched off, if you simply want to boost a track's level before it's downsampled and bit-reduced. Every time you turn off an item's limiter, however, the makeup gain will drop to zero. This is to protect your ears in case you had the makeup gain way up and the threshold right down while using the limiter...
* Stereo-mono mixdown has been simplified: now everything is merged with a pan-law gain drop to avoid clipping
* AmigaPal still exports Protracker-friendly 8SVX files, but can optionally save 8bit mono RIFF PCM WAVs instead. The audio is identical, and as with 8SVX the samplerate is dictated by the 'Protracker note' option (global or per-item). There was a request for WAV export by Game Boy musician tobokegao so hopefully this is useful to some people. I believe the samplerate you need for LSDJ is 11468hz and the closest Protracker note to this value is F#2 (11744), so hopefully that works. If not, please let me know and I'll add an option to export 11468hz WAV.
* Everything should be running more quickly as a whole bunch of code's been optimised.
* AmigaPal can now (optionally) save a Protracker mod file along with the converted 8SVX samples! It simply writes your samples into the mod's instrument slots (to a maximum of 31) and takes an optional songname/filename, then all you need to do is load that module into a tracker, add some notes, and you've got a hit on your hands. By default the samples will be limited to 64kb no matter how large the converted 8SVX file is, but the 128kb option limits them to 128kb (the latest Amiga version of Protracker 2.3F supports 128kb samples, whereas the Win/Mac Protracker clone currently does not...it's a bit more complicated than that, but that's the short version).
* A load of UI improvements all over the place - some visible (such as the wider waveform display) and some behind the scenes.
* The 8k post filter is disabled for now because I'm not sure it's having any noticeable effect. Maybe I need to play with its ordering in the chain. If you're desperate to have it back, let me know!

**6th May 2020 -**
* Whoops, the fontawesome icons have been broken for months - fixed
* Now there's a 'Load...' button for loading single or multiple files via your operating system's file dialogue, and it caches the enclosing directory of the most recently loaded file for future use. If that directory becomes unavailable, it'll fall back to AmigaPal's root directory.
* There's now a confirmation popup on 'Clear All' in case you didn't, in fact, want to clear all.
* And one on 'Apply to all', because that's also a good way to ruin lots of hard work.
* 'Truncate Filenames' option: this strips out special characters and spaces, trims the output filename to a limit, and prefixes with a numerical ID that's just the file's position in the AmigaPal file list (to keep files unique if the truncation removes their original numbering system). Filenames under the Amiga filesystem are usually limited to 31 characters, though some trackers might struggle with even much shorter filenames - not to mention enormous full path lengths from nested long drawer names. I've decided to default to 3 (prefix) + 8 (name) + 5 (extension) = 16. Let me know if that's too restrictive or doesn't solve your problem. I also capitalise them because, I dunno, I think it looks cool. But it's also sometimes good for visually distinguishing converted files if your target dir is the same as the source dir.
* Output directory can be opened in Explorer/Finder/etc, for added convenience.
* Fixed a bug where the pause button wouldn't switch back to a play button after a sample's playback had ended.

**5th May 2020 -**
* Finally got an Electron dev environment up and running on Windows 10
* Updated some dependencies and did a bit of browser security futureproofing (there is basically no security, by the way - you use AmigaPal at your own risk, running locally and with local media files, but in order to achieve this it's got all the safeties turned off)
* I've hopefully made AmigaPal platform agnostic, at last. As usual I haven't been able/willing to test on Linux, but slash direction when parsing/rewriting paths and some other quirks have been accounted for.
* Minor UI tweaks, including the ability to adjust AmigaPal's height. (Width is still locked, otherwise things go crazy.)


Known Bugs / To Do:
----------

* I have managed to get the latest version (v0.0.7-beta.1) to run on MacOS Sierra, but when I package it with electron-forge it crashes instantly after the app is launched without any kind of useful error log. I can't say when I'll have time to bug-hunt this, but if anyone else is able to package for MacOS or Linux please let me know. Previous versions of MacOS should still work fine, although you'll need to set up sox as before (e.g. install with brew and point AmigaPal at /usr/local/bin or wherever).

* If it doesn't make the app too sluggish, it'd be nice for the waveform display to reflect limiter/gain changes and give an impression of how the sample will look in Protracker after conversion, in terms of transients and dynamics.

* It would be nice to be able to layer/mix samples in AmigaPal. You can do it in ProTracker, of course, but mixing at higher sample rates/bit depths might give better results in the end. We'd need to be able to select multiple samples, and also decide on an output filename template. Low priority for now!

* I wish I could get the app Icon working properly. There IS one, I just can't get Electron-Forge
to add it when packaging.


* Output directory chooser has stopped working in Windows since I updated the Electron version. Until it's fixed, please try typing or pasting your output path into the box.

* Output normalisation is a bit wonky so I've disabled the controls and hardcoded it for now - I need to untangle a lot of messy code and redo it from scratch. Meanwhile it _works_...but you won't be able to drive the level past any rogue peaks. Ultimately I'd like to do it in multiple stages, or with a discrete non-brickwall limiter stage, or RMS, or a more forgiving peak average, or something.

Installation
------------

**MacOS/Linux**

As long as you've got SoX installed, and can find the path to the sox binary, you should be all set. The default path is /usr/local/bin. When I get a chance, I'll zip up a MacOS version to bring the MacOS release up to date with the latest Windows one.

**Windows**

It's no longer necessary to have SoX installed, or to know where it lives. In theory you should be able to unzip the Windows release and just run the exe.



Troubleshooting
---------------

**My sample plays through fine in AmigaPal but when I load it into Protracker, the end is chopped off**

Check the 'size' value to the left of the waveform. Is it over 65534? If so, then lots of Protracker versions will be loading only data up to that limit, ignoring the rest. Some versions with proper 128KB sample support might load samples up to that size; some will simply allow them to be created (by increasing PT sample length and copy/pasting) but won't load them in one go from disk. Your mileage may vary! But ultimately if you want to fit all of a long sample's duration into Protracker, you'll have to compromise on quality by lowering the PT note, which lowers the samplerate (while increasing the relative pitch, so you'll have to enter lower note values to get the 'real life' note you wanted). Or, if you can't sacrifice quality, consider loading the sample into AmigaPal multiple times, trimming them into chunks, and converting them all at a high PT note value (therefore high samplerate and high quality), then loading them into multiple Protracker sample slots and adjusting them until they can be played back seamlessly. And if _that_ seems like a pain...welcome to tracking!

**I tried to load a sample but nothing happened**

Please check the 'STATUS:' message - if audio data can't be decoded from an incoming file, the message should notify you. I've tested with malformed WAV headers and the warning appears, but AmigaPal otherwise carries on silently without locking up (but if anything crazy happens please let me know). The underlying audio subsystem in AmigaPal is the Web Audio API so any of the filetypes listed above, in most channel/samplerate configurations, should at least be decoded - by which point AmigaPal treats everything like it's a single channel of 32bit float amplitudes anyway.

**It doesn't work on my operating system of choice**

Up until late 2019 all AmigaPal dev was done on MacOS, so Windows and Linux were always slightly behind in terms of testing and updates. Now I'm primarily on Windows, so expect the Windows version to get updated first - though I'll try my best to keep parity across all three platforms. I don't typically keep a modern Linux installation running these days, so if someone else can test and report back to me I'd be grateful.


CLI
---

If you'd prefer to script the conversion process, or would just rather not use the Electron GUI, here's a guide to the SoX settings that earlier versions of AmigaPal used:

`sox [infilename].wav [outfilename].8svx trim [starttime] [duration] norm 0.5 remix - highpass -1 [frequency in hz] lowpass -1 [frequency in hz] rate [sample rate] lowpass -1 8000 norm 0.5 dither -S`

The second lowpass filter is optional, being processed after the sample rate reduction in the event that some unwanted hiss needs to be removed. The conversion to 8bit is implicit in the 8SVX filetype, which is an explicitly 8bit format.

Values in square brackets were mapped to AmigaPal's controls. Here's an example for converting a 16bit stereo WAV to an 8bit 8SVX sample trimmed to 2.3 seconds starting at 0.2 seconds, normalised, highpassed (low cut) at 60hz, lowpassed (high cut) at 10000, reduced to the sample rate of ProTracker's note 'A-3' (~27928hz), lowpassed again at 8k to remove hiss, normalised again, then finally dithered:

`sox inputfile.wav outfile.8svx trim 0.2 2.3 norm 0.5 remix - highpass -1 60 lowpass -1 10000 rate 27928 lowpass -1 8000 norm 0.5 dither -S`

AmigaPal was doing nothing special that you couldn't do with this SoX syntax, but it makes batch-converting stuff a lot easier and removes some guesswork! You might find it's worth playing with the order in which SoX processes the effects (with some caveats, of which SoX's terse and only occasionally helpful error messages will inform you), but this is what works best for me.

Now AmigaPal does everything internally, including writing 8SVX files, without SoX. This means the preview audio is slightly closer to what you end up with after conversion, and also that you save a few bytes per sample (because AmigaPal doesn't write the optional ANNO chunk)

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
