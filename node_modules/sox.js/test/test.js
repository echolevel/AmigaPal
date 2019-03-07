var test = require('tape')
var sox = require('../')
var fs = require('fs')
var os = require('os')
var path = require('path')
var rimraf = require('rimraf')
var mkdirp = require('mkdirp')
var testAudio = require('test-audio')()

var tmpDir = path.join(os.tmpdir(), 'sox_js_test')

function closeEnough(x, y) {
	var ratio = x / y
	var diff = Math.abs(ratio - 1)
	return diff < 0.01 // within 1/100th of the correct value
}

function assertSize(t, value) {
	return function (err, filename) {
		t.ifError(err)
		fs.stat(filename, function (err, stat) {
			t.ifError(err)
			t.ok(closeEnough(stat.size, value), stat.size + ' bytes is close enough to ' + value + ' bytes')
			t.end()
		})
	}
}

test('create temp dir', function (t) {
	mkdirp(tmpDir, function (err) {
		t.ifError(err)
		t.end()
	})
})

test('ogg > wav', function (t) {
	sox({
		inputFile: testAudio.ogg.path,
		outputFile: path.join(tmpDir, 'test_1i.wav')
	}, assertSize(t, 542884))
})

test('ogg > wav - options - adjusted volume', { timeout: 3000 }, function (t) {
	sox({
		input: { v: 0.9 },
		inputFile: testAudio.ogg.path,
		output: {
			b: 16,
			c: 1,
			r: 44100,
			C: 5
		},
		outputFile: path.join(tmpDir, 'test_2a.wav')
	}, assertSize(t, 271464))
})

test('wav > flac', function (t) {
	sox({
		inputFile: testAudio.wav.path,
		outputFile: path.join(tmpDir, 'test_4.flac')
	}, assertSize(t, 4711))
})

test('wav > ogg with effects string', function (t) {
	sox({
		inputFile: testAudio.wav.path,
		outputFile: path.join(tmpDir, 'test_5t.ogg'),
		effects: 'swap'
	}, assertSize(t, 5792))
})

test('wav > ogg with effects array of strings', function (t) {
	sox({
		inputFile: testAudio.wav.path,
		outputFile: path.join(tmpDir, 'test_5t.ogg'),
		effects: [ 'phaser', 0.6, 0.66, 3, 0.6, 2, '-t' ]
	}, assertSize(t, 5979))
})

test('wav > ogg with effects sub-array', function (t) {
	sox({
		inputFile: testAudio.wav.path,
		outputFile: path.join(tmpDir, 'test_5t.ogg'),
		effects: [
			[ 'phaser', 0.6, 0.66, 3, 0.6, 2, '-t' ],
			'swap'
		]
	}, assertSize(t, 5995))
})

test('flac > ogg', function (t) {
	sox({
		inputFile: testAudio.flac.path,
		outputFile: path.join(tmpDir, 'test_7.ogg')
	}, assertSize(t, 5086))
})

test('bad file errOnStderr=undefined', function (t) {
	sox({
		inputFile: path.join(__dirname, 'bad.wav'),
		outputFile: path.join(tmpDir, 'test_8.ogg')
	}, function (err, filename) {
		t.ok(err)
		t.notEqual(-1, err.message.indexOf('sox FAIL formats'))
		t.notEqual(-1, err.message.indexOf('WAVE: RIFF header not found'))
		t.end()
	})
})

test('bad file errOnStderr=false', function (t) {
	sox({
		errOnStderr: false,
		inputFile: path.join(__dirname, 'bad.wav'),
		outputFile: path.join(tmpDir, 'test_8.ogg')
	}, function (err, filename) {
		t.ok(err)
		t.equal(err.message, 'Exit code: 2')
		t.end()
	})
})

test('delete temp dir', function (t) {
	rimraf(tmpDir, function (err) {
		t.ifError(err)
		t.end()
	})
})
