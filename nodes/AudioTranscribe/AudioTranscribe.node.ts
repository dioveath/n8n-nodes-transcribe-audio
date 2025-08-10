import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

import { WaveFile } from 'wavefile';
import { pipeline, env } from '@huggingface/transformers';

import path from 'path'
const wasmDir = path.dirname(require.resolve('onnxruntime-web'));

if (env.backends.onnx.wasm) {
	env.backends.onnx.wasm.wasmPaths = wasmDir + path.sep;
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
				default: ''
			}
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
						if (item.binary === undefined) {
							throw new NodeOperationError(this.getNode(), `No binary data found on item!`, { itemIndex });
						}

						this.logger.info(`Attempting to load model: "${model}" for item index ${itemIndex}`);
						const transcriber = await pipeline('automatic-speech-recognition', model, {
							progress_callback: (_progress: any) => { },
						});
						this.logger.info(`Model "${model}" loaded successfully for item index ${itemIndex}`);

						const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);

						// const tempDir = os.tmpdir()
						// const tempFilePath = path.join(tempDir, `audio_${itemIndex}_${Date.now()}.${binaryData.fileExtension || "wav"}`)
						// const buffer = Buffer.from(binaryItem.data, 'base64');
						// let url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/jfk.wav';
						// const response = await fetch(url);
						// const arrayBuffer = await response.arrayBuffer();
						// const buffer = Buffer.from(new Uint8Array(arrayBuffer));

						// const mimeType = binaryItem.mimeType
						// const fileExtension = binaryItem.fileExtension
						// let audioBufferWav: Buffer

						// if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3' || fileExtension === 'mp3') {
						// 	const readableMp3Stream = Readable.from(buffer);
						// 	audioBufferWav = await new Promise<Buffer>((resolve, reject) => {
						// 		const chunks: Uint8Array[] = [];
						// 		ffmpeg(readableMp3Stream)
						// 			.format('wav')
						// 			.audioCodec('pcm_s16le')
						// 			.audioFrequency(16000)
						// 			.audioChannels(1)
						// 			.on('start', (commnadLine: string) => {
						// 				this.logger.info(`Conversion started: ${commnadLine}`);
						// 			})
						// 			.on('error', (err: Error, stdout: string, stderr: string) => {
						// 				this.logger.error(`Std out: ${stdout}`);
						// 				this.logger.error(`Std err: ${stderr}`);
						// 				reject(new NodeOperationError(this.getNode(), `Conversion failed: ${err.message}`, { itemIndex }));
						// 			})
						// 			.on('end', (stdout: string, stderr: string) => {
						// 				resolve(Buffer.concat(chunks));
						// 			})
						// 			.pipe()
						// 			.on('data', (data: Uint8Array) => {
						// 				chunks.push(data);
						// 			});
						// 	})							
						// } else {
						// 	this.logger.info(`Input (item ${itemIndex}, mime: ${mimeType}, ext: ${fileExtension}) assumed to be WAV. Using directly.`);
						// 	audioBufferWav = buffer;
						// }

						const wav = new WaveFile(buffer);
						wav.toBitDepth('32f'); // pipeline expects input as a Float32Array
						wav.toSampleRate(16000); // pipeline expects input at 16kHz

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

						this.logger.info(`Starting transcription for item index ${itemIndex}`)
						let start = performance.now()
						let result = await transcriber(audioData, { chunk_length_s: 30, stride_length_s: 5 })
						let end = performance.now()
						this.logger.info(`Transcription took ${end - start}ms`)

						const newItem = { ...item, json: { ...item.json } };
						newItem.json.transcription = result;
						returnData.push(newItem)
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
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}

		}

		return this.prepareOutputData(returnData);
	}
}