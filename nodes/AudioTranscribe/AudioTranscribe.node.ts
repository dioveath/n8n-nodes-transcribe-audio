import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, UnexpectedError, UserError } from 'n8n-workflow';

// The package alias exposes a CommonJS entry at runtime, but TypeScript resolves its ESM declaration.
// @ts-expect-error -- n8n loads this node as CommonJS through the alias's require export.
import { env, pipeline } from 'transformers-wasm';
import os from 'node:os';
import path from 'node:path';
import { WaveFile } from 'wavefile';

// n8n's official image uses Alpine/musl, which is incompatible with the glibc
// binaries shipped by onnxruntime-node. Both Transformers.js and ONNX Runtime use
// package aliases so inference remains local on the portable WASM backend. The
// unique Transformers.js alias also avoids stale module-resolution cache entries
// left by pre-0.2.0 installations that failed while loading the native backend.
const wasmDirectory = path.dirname(require.resolve('onnxruntime-node'));
if (env.backends.onnx.wasm) {
	env.backends.onnx.wasm.wasmPaths = `${wasmDirectory}${path.sep}`;
	env.backends.onnx.wasm.numThreads = 1;
	env.backends.onnx.wasm.proxy = false;
}

const n8nUserDirectory = path.join(process.env.N8N_USER_FOLDER ?? os.homedir(), '.n8n');
env.cacheDir = path.join(n8nUserDirectory, 'models', 'transformers');

const TARGET_SAMPLE_RATE = 16_000;
type AudioChannel = Float32Array | Float64Array;

function downmixChannels(channels: AudioChannel[]): Float32Array {
	if (channels.length === 0 || channels[0].length === 0) {
		throw new UnexpectedError('The audio file does not contain any samples.');
	}

	const sampleCount = Math.min(...channels.map((channel) => channel.length));
	const mono = new Float32Array(sampleCount);

	for (const channel of channels) {
		for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
			mono[sampleIndex] += channel[sampleIndex] / channels.length;
		}
	}

	return mono;
}

function getWaveSamples(wav: WaveFile): Float32Array {
	const samples = wav.getSamples() as unknown as Float64Array | Float64Array[];
	return downmixChannels(Array.isArray(samples) ? samples : [samples]);
}

function decodeWav(buffer: Buffer): Float32Array {
	const wav = new WaveFile(buffer);
	wav.toBitDepth('32f');
	wav.toSampleRate(TARGET_SAMPLE_RATE);
	return getWaveSamples(wav);
}

async function decodeMp3(buffer: Buffer): Promise<Float32Array> {
	const { default: decode } = await import('@audio/decode-mp3');
	const { channelData, sampleRate } = await decode(buffer);
	const mono = downmixChannels(channelData);

	if (sampleRate === TARGET_SAMPLE_RATE) return mono;

	const wav = new WaveFile();
	wav.fromScratch(1, sampleRate, '32f', mono);
	wav.toSampleRate(TARGET_SAMPLE_RATE);
	return getWaveSamples(wav);
}

async function decodeAudio(
	buffer: Buffer,
	fileExtension?: string,
	mimeType?: string,
	fileName?: string,
): Promise<Float32Array> {
	const extension = fileExtension?.replace(/^\./, '').toLowerCase();
	const normalizedMimeType = mimeType?.toLowerCase();
	const header = buffer.subarray(0, 12);
	const isWavHeader =
		['RIFF', 'RIFX', 'RF64'].includes(header.toString('ascii', 0, 4)) &&
		header.toString('ascii', 8, 12) === 'WAVE';
	const isMp3Header =
		header.toString('ascii', 0, 3) === 'ID3' ||
		(header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0);

	if (
		isMp3Header ||
		extension === 'mp3' ||
		['audio/mpeg', 'audio/mp3'].includes(normalizedMimeType ?? '')
	) {
		return decodeMp3(buffer);
	}

	if (
		isWavHeader ||
		extension === 'wav' ||
		['audio/wav', 'audio/x-wav'].includes(normalizedMimeType ?? '')
	) {
		return decodeWav(buffer);
	}

	const inputDescription = fileName ? ` "${fileName}"` : '';
	throw new UserError(
		`Unsupported audio format for file${inputDescription}. Supported formats: WAV and MP3.`,
	);
}

const MODELS_LIST = [
	'Xenova/whisper-tiny.en',
	'Xenova/whisper-base.en',
	'Xenova/whisper-small.en',
	'Xenova/whisper-medium.en',
	// 'Xenova/whisper-large-v3', // Very resource-intensive
];

export class AudioTranscribe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Transcribe Audio',
		name: 'audioTranscribe',
		group: ['transform'],
		version: 1,
		description: 'Transcribe audio',
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["model"] }}',
		icon: { light: 'file:AudioTranscribe.light.svg', dark: 'file:AudioTranscribe.dark.svg' },
		defaults: {
			name: 'Transcribe Audio',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				description: 'The description text',
				noDataExpression: true,
				options: [
					{
						name: 'Transcribe',
						value: 'transcribe',
						description: 'Transcribe audio',
						action: 'Transcribe audio',
					},
				],
				default: 'transcribe',
			},
			{
				displayName: 'Audio Input Type',
				name: 'audioInputType',
				type: 'options',
				description: 'The description text',
				noDataExpression: true,
				displayOptions: {
					show: {
						operation: ['transcribe'],
					},
				},
				options: [
					{
						name: 'Binary File',
						value: 'binaryFile',
						description: 'Transcribes audio from a binary file',
						action: 'Transcribes audio from a binary file',
					},
				],
				default: 'binaryFile',
			},
			{
				displayName: 'Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				description: 'The name of the binary property to use for transcription',
				required: true,
				displayOptions: {
					show: {
						operation: ['transcribe'],
						audioInputType: ['binaryFile'],
					},
				},
				default: 'data',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				description: 'The model to use for transcription',
				noDataExpression: true,
				displayOptions: {
					show: {
						operation: ['transcribe'],
					},
				},
				options: MODELS_LIST.map((model) => ({
					name: model,
					value: model,
					description: model,
					action: `Transcribes audio from a binary file with ${model}`,
				})),
				default: '',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let item: INodeExecutionData;
		let operation: string;
		let audioInputType: string;
		let binaryPropertyName: string;
		let model: string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				operation = this.getNodeParameter('operation', itemIndex, '') as string;
				audioInputType = this.getNodeParameter('audioInputType', itemIndex, '') as string;
				binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, '') as string;
				model = this.getNodeParameter('model', itemIndex, '') as string;

				item = items[itemIndex];

				if (operation === 'transcribe') {
					if (audioInputType === 'binaryFile') {
						const availableBinaryProperties = Object.keys(item.binary ?? {});
						if (!item.binary?.[binaryPropertyName]) {
							if (availableBinaryProperties.length === 1) {
								const detectedBinaryProperty = availableBinaryProperties[0];
								this.logger.warn(
									`Binary property "${binaryPropertyName}" was not found on item ${itemIndex}; using the only available property, "${detectedBinaryProperty}"`,
								);
								binaryPropertyName = detectedBinaryProperty;
							} else {
								const availableProperties =
									availableBinaryProperties.length === 0
										? 'none'
										: availableBinaryProperties.map((property) => `"${property}"`).join(', ');
								throw new NodeOperationError(
									this.getNode(),
									`Binary property "${binaryPropertyName}" was not found. Available binary properties: ${availableProperties}`,
									{ itemIndex },
								);
							}
						}

						const binaryData = item.binary![binaryPropertyName];
						const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
						const audioData = await decodeAudio(
							buffer,
							binaryData.fileExtension,
							binaryData.mimeType,
							binaryData.fileName,
						);

						this.logger.info(`Attempting to load model: "${model}" for item index ${itemIndex}`);
						const transcriber = await pipeline('automatic-speech-recognition', model, {
							device: 'cpu',
							dtype: 'q8',
							progress_callback: () => {},
						});
						this.logger.info(`Model "${model}" loaded successfully for item index ${itemIndex}`);

						this.logger.info(`Starting transcription for item index ${itemIndex}`);
						const start = performance.now();
						const result = await transcriber(audioData, { chunk_length_s: 30, stride_length_s: 5 });
						const end = performance.now();
						this.logger.info(`Transcription took ${end - start}ms`);

						const newItem = { ...item, json: { ...item.json } };
						newItem.json.transcription = result;
						returnData.push(newItem);
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const errorItem = {
						json: { ...items[itemIndex].json },
						error,
						pairedItem: itemIndex,
					};
					returnData.push(errorItem);
				} else {
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}
