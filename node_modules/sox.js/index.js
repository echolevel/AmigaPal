var spawn = require('child_process').spawn
var hashToArray = require('hash-to-array')
var onetime = require('onetime')

module.exports = function runSox(opts, callback) {
	if (!opts || typeof opts !== 'object') throw new Error('options must be an object')
	if (!opts.inputFile) throw new Error('options.inputFile is a required parameter')
	if (!opts.outputFile) throw new Error('options.outputFile is a required parameter')

	var cb = onetime(callback || function (e) { if (e) throw e })

	var args = []
		.concat(hashToArray(opts.global || []))
		.concat(hashToArray(opts.input || []))
		.concat(opts.inputFile)
		.concat(hashToArray(opts.output || []))
		.concat(opts.outputFile)
		.concat(opts.effects || [])
		.reduce(function (flattened, ele) {
			return flattened.concat(ele)
		}, [])

	var sox = null
	if (opts.errOnStderr === false) {
		sox = spawn(opts.soxPath || 'sox', args, { stdio: [ 'pipe', 'pipe', process.stderr ] })
	} else {
		sox = spawn(opts.soxPath || 'sox', args)
		sox.stderr.on('data', function (stderr) {
			cb(new Error(stderr))
		})
	}
	sox.on('error', cb)
	sox.on('close', function (code, signal) {
		if (code) {
			cb(new Error(signal || 'Exit code: ' + code))
		} else {
			cb(null, opts.outputFile)
		}
	})
}
