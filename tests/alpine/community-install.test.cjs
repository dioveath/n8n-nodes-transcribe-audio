'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire, Module } = require('node:module');
const { spawn } = require('node:child_process');

const BASE_URL = 'http://127.0.0.1:5678';
const PACKAGE_NAME = 'n8n-nodes-transcribe-audio';
const PACKAGE_ROOT = `/home/node/.n8n/nodes/node_modules/${PACKAGE_NAME}`;
const AUDIO_FIXTURE = '/test/fixtures/jfk-4s.wav';
const RUN_TRANSCRIPTION_TEST = process.env.RUN_TRANSCRIPTION_TEST !== 'false';
const candidateManifest = JSON.parse(fs.readFileSync('/test/candidate-package.json', 'utf8'));

// MIT-licensed ONNX Runtime mul_1 test model (130 bytes):
// https://github.com/microsoft/onnxruntime/blob/main/onnxruntime/test/testdata/mul_1.onnx
const MUL_MODEL_BASE64 =
	'CAMSBmNoZW50YTpwChUKAVgKAVcSAVkaBW11bF8xIgNNdWwSCG11bCB0ZXN0KiMIAwgCEAEiGAAAgD8AAABAAABAQAAAgEAAAKBAAADAQEIBV1oTCgFYEg4KDAgBEggKAggDCgIIAmITCgFZEg4KDAgBEggKAggDCgIIAkIECgAQBw==';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function findPackageJson(entryPath) {
	let directory = path.dirname(entryPath);

	while (directory !== path.dirname(directory)) {
		const packageJsonPath = path.join(directory, 'package.json');
		if (fs.existsSync(packageJsonPath)) return packageJsonPath;
		directory = path.dirname(directory);
	}

	throw new Error(`Could not find package.json for ${entryPath}`);
}

async function waitForN8n(logs) {
	for (let attempt = 0; attempt < 360; attempt++) {
		try {
			const response = await fetch(`${BASE_URL}/rest/settings`);
			const body = await response.text();
			if (body.startsWith('{') && JSON.parse(body).data) return;
		} catch {
			// n8n has not opened its HTTP port yet.
		}
		await sleep(500);
	}

	throw new Error(`n8n did not become ready.\n${logs()}`);
}

async function stopProcess(child) {
	if (child.exitCode !== null) return;
	child.kill('SIGTERM');

	await Promise.race([
		new Promise((resolve) => child.once('exit', resolve)),
		sleep(10_000).then(() => child.kill('SIGKILL')),
	]);
}

async function main() {
	let output = '';
	const n8n = spawn('/usr/local/bin/n8n', ['start'], {
		env: {
			...process.env,
			N8N_DIAGNOSTICS_ENABLED: 'false',
			N8N_PERSONALIZATION_ENABLED: 'false',
			N8N_RUNNERS_ENABLED: 'false',
			N8N_SECURE_COOKIE: 'false',
			N8N_UNVERIFIED_PACKAGES_ENABLED: 'true',
			N8N_VERSION_NOTIFICATIONS_ENABLED: 'false',
		},
		stdio: ['ignore', 'pipe', 'pipe'],
	});

	for (const stream of [n8n.stdout, n8n.stderr]) {
		stream.on('data', (chunk) => {
			output += chunk.toString();
		});
	}

	try {
		await waitForN8n(() => output);
		assert.match(
			output,
			/__vsnprintf_chk: symbol not found/,
			'the fixture must reproduce the native ONNX failure from a persisted 0.1.23 install',
		);

		const setupResponse = await fetch(`${BASE_URL}/rest/owner/setup`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'community-install-test@example.com',
				firstName: 'Community',
				lastName: 'Test',
				password: 'CommunityInstallTest123!',
			}),
		});
		assert.equal(setupResponse.status, 200, await setupResponse.text());

		const setCookie = setupResponse.headers.get('set-cookie');
		assert.ok(setCookie, 'owner setup must return an authentication cookie');
		const authCookie = setCookie.split(';', 1)[0];
		const outputBeforeInstall = output.length;

		// The npm wrapper substitutes the locally packed candidate when n8n fetches
		// the latest release. All installation and loading after `npm pack` is
		// n8n's real community-node code path.
		const installResponse = await fetch(`${BASE_URL}/rest/community-packages`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				cookie: authCookie,
			},
			body: JSON.stringify({ name: PACKAGE_NAME, verify: false }),
		});
		const installBody = await installResponse.text();
		assert.equal(installResponse.status, 200, installBody);

		const installedPackage = JSON.parse(installBody).data;
		assert.equal(installedPackage.packageName, PACKAGE_NAME);
		assert.equal(installedPackage.installedVersion, candidateManifest.version);
		assert.deepEqual(
			installedPackage.installedNodes.map((node) => node.type),
			[`${PACKAGE_NAME}.audioTranscribe`],
		);
		assert.doesNotMatch(
			output.slice(outputBeforeInstall),
			/__vsnprintf_chk: symbol not found/,
			'the candidate package must not load the stale native ONNX dependency',
		);

		const packageRequire = createRequire(path.join(PACKAGE_ROOT, 'package.json'));
		const transformersEntry = packageRequire.resolve('transformers-wasm');
		const transformersManifest = JSON.parse(
			fs.readFileSync(findPackageJson(transformersEntry), 'utf8'),
		);
		assert.equal(transformersManifest.name, '@huggingface/transformers');

		const ortEntry = packageRequire.resolve('onnxruntime-node');
		const ortManifest = JSON.parse(fs.readFileSync(findPackageJson(ortEntry), 'utf8'));
		assert.equal(
			ortManifest.name,
			'onnxruntime-web',
			'onnxruntime-node must resolve to the portable WASM package',
		);
		assert.equal(
			fs.existsSync(path.join(path.dirname(ortEntry), '..', 'bin')),
			false,
			'the candidate dependency tree must not contain native ONNX binaries',
		);

		const ort = packageRequire('onnxruntime-node');
		const model = Buffer.from(MUL_MODEL_BASE64, 'base64');
		const session = await ort.InferenceSession.create(model);
		const input = new ort.Tensor('float32', Float32Array.from([1, 2, 3, 4, 5, 6]), [3, 2]);
		const result = await session.run({ X: input });
		await session.release();
		assert.deepEqual(Array.from(result.Y.data), [1, 4, 9, 16, 25, 36]);

		if (RUN_TRANSCRIPTION_TEST) {
			// n8n exposes its peer packages to community nodes through its process-level
			// module setup. Mirror that setup before loading the node in this test process.
			process.env.NODE_PATH = [
				process.env.NODE_PATH,
				'/usr/local/lib/node_modules/n8n/node_modules',
			]
				.filter(Boolean)
				.join(path.delimiter);
			Module._initPaths();

			const nodeEntry = path.join(PACKAGE_ROOT, candidateManifest.n8n.nodes[0]);
			const { AudioTranscribe } = packageRequire(nodeEntry);
			const audioBuffer = fs.readFileSync(AUDIO_FIXTURE);
			const inputItems = [
				{
					json: {},
					binary: {
						audio: {
							data: '',
							fileExtension: 'wav',
							fileName: path.basename(AUDIO_FIXTURE),
							mimeType: 'audio/wav',
						},
					},
				},
			];
			const parameters = {
				operation: 'transcribe',
				audioInputType: 'binaryFile',
				binaryPropertyName: 'data',
				model: 'Xenova/whisper-tiny.en',
			};
			const executeContext = {
				continueOnFail: () => false,
				getInputData: () => inputItems,
				getNode: () => ({
					id: 'community-install-test',
					name: 'Transcribe Audio',
					parameters: {},
					position: [0, 0],
					type: `${PACKAGE_NAME}.audioTranscribe`,
					typeVersion: 1,
				}),
				getNodeParameter: (name) => parameters[name],
				helpers: {
					getBinaryDataBuffer: async (_itemIndex, propertyName) => {
						assert.equal(propertyName, 'audio');
						return audioBuffer;
					},
				},
				logger: {
					debug: () => {},
					error: () => {},
					info: () => {},
					warn: () => {},
				},
				prepareOutputData: (items) => [items],
			};

			const transcriptionOutput = await AudioTranscribe.prototype.execute.call(executeContext);
			const transcription = transcriptionOutput[0][0].json.transcription;
			assert.equal(typeof transcription.text, 'string');
			assert.match(transcription.text, /fellow americans/i);
		}

		console.log(
			`Community install passed: ${PACKAGE_NAME}@${candidateManifest.version} loaded ` +
				`${ortManifest.name}@${ortManifest.version}, executed WASM inference` +
				`${RUN_TRANSCRIPTION_TEST ? ', and transcribed the WAV fixture' : ''}.`,
		);
	} catch (error) {
		console.error(output);
		throw error;
	} finally {
		await stopProcess(n8n);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
