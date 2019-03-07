var test = require('tap').test
var hashToArray = require('./index.js')

function deepEqual(t0, description, obj, expected, ignoreIndex) {
	t0.test(description, function (t) {
		var result = hashToArray(obj)
		//console.log(expected)
		//console.log(result)
		t.equal(result.length, expected.length, 'lengths are equal')
		expected.forEach(function (r, i) {
			t.notEqual(result.indexOf(r), -1, typeof r + ' "' + r + '" found in new array')
			if (!ignoreIndex) {
				t.equal(i%2, result.indexOf(r)%2,
					'both things are ' + (i%2? 'values' : 'arguments'))
			}
		})
		t.end()
	})
}

test('basic argument building', function (t0) {
	deepEqual(t0, 'short arguments', {
		x: 2,
		v: 50,
		j: 'hello'
	}, [
		'-x', 2,
		'-v', 50,
		'-j', 'hello'
	])

	deepEqual(t0, 'long arguments', {
		rate: 48000,
		bits: 'mp3'
	}, [
		'--bits', 'mp3',
		'--rate', 48000
	])

	t0.end()
})

test('special cases', function (t0) {
	deepEqual(t0, 'boolean values', {
		thingy: true,
		anotherthingy: false,
		kool: 'lol',
		trixy: 'true'
	}, [
		'--thingy',
		'anotherthingy',
		'--kool', 'lol',
		'--trixy', 'true'
	])

	deepEqual(t0, 'boolean value edge cases', {
		dashes: false,
		'': true,
		'-': false
	}, [
		'dashes',
		'--',
		'-'
	])

	deepEqual(t0, 'array-like object', {
		0: 8,
		1: false,
		length: 2
	}, [
		'-0', 8,
		'1',
		'--length', 2
	])

	t0.end()
})

function passThru(t, expected) {
	var found = hashToArray(expected)
	t.deepEqual(expected, found, typeof expected + ':' + expected + ' passes through unmodified')
}

function arrayified(t, expected) {
	var found = hashToArray(expected)[0]
	t.deepEqual(expected, found, typeof expected + ':' + expected + ' is in an array')
}

test('non arrays turn into arrays; arrays pass through unmodified', function (t) {
	passThru(t, ['array', {}, 'haz object'])
	passThru(t, [['wat']])
	arrayified(t, 7)
	arrayified(t, null)
	arrayified(t, 'heh heh heh')
	arrayified(t, true)
	t.end()
})

