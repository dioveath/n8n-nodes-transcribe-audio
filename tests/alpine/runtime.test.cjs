'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const test = require('node:test');

// MIT-licensed ONNX Runtime mul_1 test model (130 bytes):
// https://github.com/microsoft/onnxruntime/blob/main/onnxruntime/test/testdata/mul_1.onnx
const MUL_MODEL_BASE64 =
	'CAMSBmNoZW50YTpwChUKAVgKAVcSAVkaBW11bF8xIgNNdWwSCG11bCB0ZXN0KiMIAwgCEAEiGAAAgD8AAABAAABAQAAAgEAAAKBAAADAQEIBV1oTCgFYEg4KDAgBEggKAggDCgIIAmITCgFZEg4KDAgBEggKAggDCgIIAkIECgAQBw==';

function findPackageJson(entryPath) {
	let directory = path.dirname(entryPath);

	while (directory !== path.dirname(directory)) {
		const packageJsonPath = path.join(directory, 'package.json');
		if (fs.existsSync(packageJsonPath)) return packageJsonPath;
		directory = path.dirname(directory);
	}

	throw new Error(`Could not find package.json for ${entryPath}`);
}

test('the packaged node runs ONNX inference through WASM on Alpine', async (context) => {
	const runtimeReport = process.report.getReport();
	assert.equal(
		runtimeReport.header.glibcVersionRuntime,
		undefined,
		'the smoke test must run on a musl-based Linux image',
	);

	const packageJsonPath = require.resolve('n8n-nodes-transcribe-audio/package.json');
	const packageRoot = path.dirname(packageJsonPath);
	const packageRequire = createRequire(packageJsonPath);
	const nodeEntry = path.join(packageRoot, 'dist/nodes/AudioTranscribe/AudioTranscribe.node.js');

	const { AudioTranscribe } = require(nodeEntry);
	assert.equal(typeof AudioTranscribe, 'function', 'the packaged n8n node should load');

	const ortEntry = packageRequire.resolve('onnxruntime-node');
	const ortPackage = JSON.parse(fs.readFileSync(findPackageJson(ortEntry), 'utf8'));
	assert.equal(
		ortPackage.name,
		'onnxruntime-web',
		'onnxruntime-node must resolve to the portable WASM package',
	);

	const { env } = packageRequire('@huggingface/transformers');
	const wasmDirectory = path.dirname(ortEntry);
	assert.equal(path.resolve(env.backends.onnx.wasm.wasmPaths), wasmDirectory);
	assert.equal(env.backends.onnx.wasm.numThreads, 1);
	assert.equal(env.backends.onnx.wasm.proxy, false);
	assert.ok(
		fs.readdirSync(wasmDirectory).some((fileName) => fileName.endsWith('.wasm')),
		'the installed package should contain an ONNX Runtime WASM binary',
	);

	const ort = packageRequire('onnxruntime-node');
	const model = Buffer.from(MUL_MODEL_BASE64, 'base64');
	const session = await ort.InferenceSession.create(model);
	context.after(() => session.release());

	const input = new ort.Tensor('float32', Float32Array.from([1, 2, 3, 4, 5, 6]), [3, 2]);
	const output = await session.run({ X: input });

	assert.deepEqual(Array.from(output.Y.data), [1, 4, 9, 16, 25, 36]);
});
