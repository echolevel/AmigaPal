sox.js
======

> A wrapper around [SoX](http://sox.sourceforge.net/). Transcode audio files easily!

[![Build Status](https://travis-ci.org/ArtskydJ/sox.js.svg)](https://travis-ci.org/ArtskydJ/sox.js)

# Examples

Simple transcode:
```js
var sox = require('sox.js')
sox({
	inputFile: 'song.wav',
	outputFile: 'song.flac'
})
```

Lower volume:
```js
var sox = require('sox.js')
sox({
	input: { volume: 0.8 },
	inputFile: 'song.flac',
	outputFile: 'song2.flac'
}, function done(err, outputFilePath) {
	console.log(err) // => null
	console.log(outputFilePath) // => song2.flac
})
```

Transcode with options and effects:
```js
var sox = require('sox.js')
sox({
	soxPath: 'C:\\Program Files (x86)\\sox-14-4-2\\sox.exe',
	inputFile: 'song.ogg',
	output: {
		bits: 16,
		rate: 44100,
		channels: 2
	},
	outputFile: 'song.wav'
	effects: 'phaser 0.6 0.66 3 0.6 2 −t'
}, function done(err, outputFilePath) {
	console.log(err) // => null
	console.log(outputFilePath) // => song.wav
})
```

# API
```js
var sox = require('sox.js')
```

## `sox(options, [cb])`

- `options` **object** *required* - The following parameters are supported:
	- `soxPath` **string** *optional* - The path to SoX. E.g. `'C:\Program Files\Sox\sox.exe'`. Defaults to `'sox'`, which works if the SoX binary is in your path.
	- `errOnStderr` **boolean** *optional* - SoX sometimes logs warnings to stderr. By default, sox.js will call the callback with an error. If you set this to `false`, then the errors will be passed along to `process.stderr`, and the callback will not be called with an error. Defaults to `true`.
	- `global` **object** *optional* - Global SoX options
	- `inputFile` **string** *required* - The file path of the input file
	- `outputFile` **string** *required* - The file path of the output file
	- `input` **object** *optional* - These options will be used to interpret the incoming stream.
	- `output` **object** *optional* - These options will be used to format the outgoing stream. When an output option isn't supplied, the output file will have the same format as the input file where possible.
	- `effects` **string|array of strings/numbers** *optional*
- `cb(err, outputFilePath)` **function** *optional* - A function that is called when the conversion process is complete. If omitted, errors are thrown. The function is passed the following parameters:
	- `err` **null|Error**
	- `outputFilePath` **string|undefined** - A string of the outgoing file path, or undefined if an error occurred. E.g. `'song.flac'`.


### `options` object

An object of options. Every option is optional except `options.inputFile` and `options.outputFile`.

If you want an exhaustive list of each option in depth, take a look at the [SoX documentation](http://sox.sourceforge.net/sox.html#OPTIONS).

Internally, these options are transformed into the command-line arguments passed to a SoX child process.


#### `options.inputFile` / `options.outputFile` string, required

A file path, like `'./song.wav'`.

#### `options.global` object|array of strings/numbers

You can supply an array of strings/numbers, or an object that will be transformed into an array of strings/numbers using [hash-to-array][hta].

Currently, `sox.js` only supports one input file, so some of these options don't really make sense.

| Command(s)                                         | Functionality                                                    |
|:---------------------------------------------------|:-----------------------------------------------------------------|
| `{ buffer: BYTES }`                                | Set the size of all processing buffers (default 8192)            |
| `{ combine: 'concatenate' }`                       | Concatenate all input files (default for sox, rec)               |
| `{ combine: 'sequence' }`                          | Sequence all input files (default for play)                      |
| `'-m'`, `{ m: true }`, `{ combine: 'mix' }`        | Mix multiple input files (instead of concatenating)              |
| `{ combine: 'mix-power' }`                         | Mix to equal power (instead of concatenating)                    |
| `'-M'`, `{ M: true }`, `{ combine: 'merge' }`      | Merge multiple input files (instead of concatenating)            |
| `'-T'`, `{ T: true }`, `{ combine: 'multiply' }`   | Multiply samples of corresponding channels from all input files (instead of concatenating) |
| `'-D'`, `{ D: true }`, `{ 'no-dither': true }`     | Don't dither automatically                                       |
| `{ 'effects-file': FILENAME }`                     | File containing effects and options                              |
| `'-G'`, `{ G: true }`, `{ guard: true }`           | Use temporary files to guard against clipping                    |
| `{ input-buffer: BYTES }`                          | Override the input buffer size (default: same as --buffer; 8192) |
| `'--norm'`, `{ norm: true }`                       | Guard (see --guard) & normalise                                  |
| `{ play-rate-arg: ARG }`                           | Default `rate` argument for auto-resample with `play'            |
| `{ plot: 'gnuplot'|'octave' }`                     | Generate script to plot response of filter effect                |
| `{ 'replay-gain': 'track'|'album'|'off' }`           | Default: 'off' (sox, rec), track (play)                          |
| `'-R'`, `{ R: true }`                              | Use default random numbers (same on each run of SoX)             |
| `'--single-threaded'`, `{ 'single-threaded': true }` | Disable parallel effects channels processing                     |
| `{ temp: DIRECTORY }`                              | Specify the directory to use for temporary files                 |

```js
sox({
	global: {
		buffer: 4096,
		norm: true,
		'single-threaded': true
	},
	output: { type: 'ogg' }
}, cb)
```


#### `options.input` / `options.output` object|array of strings/numbers

You can supply an array of strings/numbers, or an object that will be transformed into an array of strings/numbers using [hash-to-array][hta].

| Input | Output | Command(s)                                           | Functionality                                             |
|:-----:|:------:|:-----------------------------------------------------|:----------------------------------------------------------|
|   ✓  |    X   | `{ v: FACTOR }`, `{ volume: FACTOR }`                | Input file volume adjustment factor (Floating point number between 0 and 1) |
|   ✓  |    X   | `{ ignore-length: true }`                            | Ignore input file length given in header; read to EOF |
|   ✓  |    ✓  | `{ t: FILETYPE }`, `{ type: FILETYPE }`              | Audio [file type](https://en.wikipedia.org/wiki/Audio_file_format). E.g. `'wav'`, `'ogg'`        |
|   ✓  |    ✓  | `{ e: ENCODING }`, `{ encoding: ENCODING }`          | ENCODING can be `'signed-integer'`, `'unsigned-integer'`, `'floating-point'`, `'mu-law'`, `'a-law'`, `'ima-adpcm'`, `'ms-adpcm'`, or `'gsm-full-rate'` |
|   ✓  |    ✓  | `'-b'`, `{ b: BITS }`, `{ bits: BITS }`              | Encoded sample size in bits, A.K.A. the [bit depth](https://en.wikipedia.org/wiki/Audio_bit_depth). E.g. `16`, `24`. (Not applicable to complex encodings such as MP3 or GSM.) |
|   ✓  |    ✓  | `'-N'`, `{ N: true }`, `{ 'reverse-nibbles': true }` | Encoded nibble-order                                      |
|   ✓  |    ✓  | `'-X'`, `{ X: true }`, `{ 'reverse-bits': true }`    | Encoded bit-order                                         |
|   ✓  |    ✓  | `'-L'`, `{ endian: 'little' }`, `{ L: true }`        | Encoded byte-order: Little endian                         |
|   ✓  |    ✓  | `'-B'`, `{ endian: 'big' }`, `{ B: true }`           | Encoded byte-order: Big endian                            |
|   ✓  |    ✓  | `'-x'`, `{ endian: 'swap' }`, `{ x: true }`          | Encoded byte-order: swap means opposite to default        |
|   ✓  |    ✓  | `{ c: CHANNELS }`, `{ channels: CHANNELS }`          | Number of [channels](https://en.wikipedia.org/wiki/Audio_channel) of audio data. E.g. `2` for stereo |
|   ✓  |    ✓  | `'--no-glob'`, `{ 'no-glob': true }`                 | Don't `glob' wildcard match the following filename        |
|   ✓  |    ✓  | `{ r: RATE }`, `{ rate: RATE }`                      | [Sample rate](https://en.wikipedia.org/wiki/Sampling_(signal_processing)#Sampling_rate) of audio. E.g. `44100`, `48000` |
|   X   |    ✓  | `{ C: FACTOR }`, `{ compression: FACTOR }`           | Compression factor. See [SoX format docs](http://sox.sourceforge.net/soxformat.html) for more information. |
|   X   |    ✓  | `{ 'add-comment': TEXT }`                            | Append output file comment                                |
|   X   |    ✓  | `{ comment: TEXT }`                                  | Specify comment text for the output file                  |
|   X   |    ✓  | `{ 'comment-file': FILENAME }`                       | File containing comment text for the output file          |

```js
sox({
	input: [
		[ '--volume', 1.1 ],
		[ '--endian', 'big' ],
		[ '--no-glob' ]
	],
	output: { type: 'ogg' }
}, cb)
// same as
sox({
	input: {
		volume: 1.1,
		endian: 'big',
		'no-glob': true
	],
	output: [
		'--type', 'ogg'
	]
}, cb)
// same as
sox({
	input: '--volume 1.1 --endian big --no-glob',
	output: '--type ogg'
}, cb)
```

#### `options.effects` string|array of strings/numbers/arrays

Please see the [SoX Documentation on Effects](http://sox.sourceforge.net/sox.html#EFFECTS) to see all the options.

You can put strings/numbers into sub-arrays, which will be flattened internally.

Pass them into `sox.js` like this:

```js
sox({
	input: { type: 'ogg' },
	output: { type: 'wav' },


	effects: 'speed 1.5 swap'
	// same as
	effects: [
		'speed 1.5 swap'
	]
	// same as
	effects: [
		'speed', 1.5,
		'swap'
	]
	// same as
	effects: [
		[ 'speed', '1.5' ],
		'swap'
	]
}, cb)
```

# Install

- Install SoX. You can [download it][sox-1442], or you can do `apt-get install sox`.
- Install this package with [npm](https://nodejs.org/en/download): `npm install sox`

# Test

To run the tests, you must also have SoX in your PATH. Then run: `npm test`

I run the tests using [SoX 14.4.2][sox-1442], but other versions of SoX should work fine.

# Codec Support

### FLAC

- **Problem:** FLAC was disabled accidentally in 14.4.1. [[Stack Overflow][so-flac]]
- **Solution:** Install [SoX 14.4.2][sox-1442].

### MP3

- **Problem:** MP3 is [proprietary](https://en.wikipedia.org/wiki/LAME#Patents_and_legal_issues).
- **Solution:** Compile the [LAME](http://lame.sourceforge.net/) encoder, and/or the [MAD](http://www.underbit.com/products/mad) decoder.
- **Links:**
	- [Windows (Precompiled)](https://github.com/EaterOfCode/sux/tree/master/win_libs)
	- [Windows (How-To)](http://www.codeproject.com/Articles/33901/Compiling-SOX-with-Lame-and-Libmad-for-Windows)
	- [Ubuntu (How-To)](http://superuser.com/questions/421153/how-to-add-a-mp3-handler-to-sox)
	- [Ubuntu (How-To) 2](http://eggblog.invertedegg.com/?p=19)
	- [CentOS (How-To)](http://techblog.netwater.com/?p=4)

# License

[MIT](http://choosealicense.com/licenses/mit/)

[sox-1442]: http://sourceforge.net/projects/sox/files/sox/14.4.2/
[hta]:      https://github.com/ArtskydJ/hash-to-array
[so-flac]:  http://stackoverflow.com/questions/23382500/how-to-install-flac-support-flac-libraries-to-sox-in-windows/25755799
