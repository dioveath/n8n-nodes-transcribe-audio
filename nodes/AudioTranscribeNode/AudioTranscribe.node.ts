import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

import { WaveFile } from 'wavefile';
import { Readable } from 'stream';

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

type TransformersModule = typeof import('@huggingface/transformers');
let transformersPromise: Promise<TransformersModule> | null = null;

async function getInitializedTransformers(): Promise<TransformersModule> {
	if (transformersPromise === null) {
		transformersPromise = (async () => {
			const T = await import('@huggingface/transformers');
			T.env.allowLocalModels = true;
			T.env.useBrowserCache = false;
			return T;
		})();
	}
	return transformersPromise;
}

const MODELS_LIST = [
	'Xenova/whisper-tiny.en',
	'Xenova/whisper-base.en',
	'Xenova/whisper-small.en',
	'Xenova/whisper-medium.en', // Medium and larger models can be demanding on CPU
	// You can add multilingual models too, e.g., 'Xenova/whisper-tiny' (without .en)
	// 'Xenova/whisper-large-v3', // Very resource-intensive
];

export class AudioTranscribe implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Audio Transcribe',
		name: 'audioTranscribe',
		group: ['transform'],
		version: 1,
		description: 'Transcribe audio',
		defaults: {
			name: 'Transcribe Audio (JS)',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
					}
				],
				default: "transcribe",
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
					}
				},
				options: [
					{
						name: 'Binary File',
						value: 'binaryFile',
						description: 'Transcribes audio from a binary file',
						action: 'Transcribes audio from a binary file',
					}
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
					}
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
					}
				},
				options: MODELS_LIST.map(model => ({
					name: model,
					value: model,
					description: model,
					action: `Transcribes audio from a binary file with ${model}`,
				})),
				default: 'Xenova/whisper-tiny.en'
			}
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();

		let item: INodeExecutionData;
		let operation: string;
		let audioInputType: string;
		let binaryPropertyName: string;
		let model: string;

		const { pipeline } = await getInitializedTransformers();


		// Iterates over all input items and add the key "myString" with the
		// value the parameter "myString" resolves to.
		// (This could be a different value for each item in case it contains an expression)
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				operation = this.getNodeParameter('operation', itemIndex, '') as string;
				audioInputType = this.getNodeParameter('audioInputType', itemIndex, '') as string;
				binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, '') as string;
				model = this.getNodeParameter('model', itemIndex, '') as string;

				item = items[itemIndex];

				if (operation === 'transcribe') {
					if (audioInputType === 'binaryFile') {
						if (item.binary === undefined) {
							throw new NodeOperationError(this.getNode(), `No binary data found on item!`, { itemIndex });
						}
						this.logger.info(`Attempting to load model: "${model}" for item index ${itemIndex}`);
						const transcriber = await pipeline('automatic-speech-recognition', model, {
							progress_callback: (_progress: any) => {}
						});
						const binaryItem = item.binary[binaryPropertyName] as IBinaryData;

						if (typeof binaryItem.data !== 'string') {
							throw new NodeOperationError(this.getNode(), `Expected binary data to be a string! Received type: ${typeof binaryItem.data}`, { itemIndex });
						}
						
						// const tempDir = os.tmpdir()
						// const tempFilePath = path.join(tempDir, `audio_${itemIndex}_${Date.now()}.${binaryData.fileExtension || "wav"}`)
						const buffer = Buffer.from(binaryItem.data, 'base64');
						// let url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
						// const response = await fetch(url);
						// const arrayBuffer = await response.arrayBuffer();
						// const buffer = Buffer.from(new Uint8Array(arrayBuffer));

						const mimeType = binaryItem.mimeType
						const fileExtension = binaryItem.fileExtension
						let audioBufferWav: Buffer

						if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3' || fileExtension === 'mp3') {
							const readableMp3Stream = Readable.from(buffer);
							audioBufferWav = await new Promise<Buffer>((resolve, reject) => {
								const chunks: Uint8Array[] = [];
								ffmpeg(readableMp3Stream)
									.format('wav')
									.audioCodec('pcm_s16le')
									.audioFrequency(16000)
									.audioChannels(1)
									.on('start', (commnadLine: string) => {
										this.logger.info(`Conversion started: ${commnadLine}`);
									})
									.on('error', (err: Error, stdout: string, stderr: string) => {
										this.logger.error(`Std out: ${stdout}`);
										this.logger.error(`Std err: ${stderr}`);
										reject(new NodeOperationError(this.getNode(), `Conversion failed: ${err.message}`, { itemIndex }));
									})
									.on('end', (stdout: string, stderr: string) => {
										resolve(Buffer.concat(chunks));
									})
									.pipe()
									.on('data', (data: Uint8Array) => {
										chunks.push(data);
									});
							})							
						} else {
							this.logger.info(`Input (item ${itemIndex}, mime: ${mimeType}, ext: ${fileExtension}) assumed to be WAV. Using directly.`);
							audioBufferWav = buffer;
						}

						const wav = new WaveFile(audioBufferWav);
						wav.toBitDepth('32f'); // pipeline expects input as a Float32Array
						wav.toSampleRate(16000); // pipeline expects input at 16kHz

						try {
							let audioData = wav.getSamples();
							if (Array.isArray(audioData)) {
								if (audioData.length > 0) {
									const SCALING_FACTOR = Math.sqrt(2);
									for (let i = 0; i < audioData.length; i++) {
										audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
									}
								}
								audioData = audioData[0]
							}

							let start = performance.now()
							let result = await transcriber(audioData)
							let end = performance.now()
							this.logger.info(`Transcription took ${end - start}ms`)

							item.json.transcription = result;
						} catch (error) {
							throw error
						} finally {
							// try {
							// 	await fs.promises.unlink(tempFilePath)
							// } catch (e) {
							// 	// Ignore error, we don't want to fail the node if we can't delete the file
							// }
						}

					}
				}

			} catch (error) {
				// This node should never fail but we want to showcase how
				// to handle errors.
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [items];
	}
}