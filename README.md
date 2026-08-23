# n8n-nodes-transcribe-audio

This is an n8n community node for local speech-to-text with Whisper. Inference runs inside the n8n process through Hugging Face Transformers.js and ONNX Runtime WebAssembly (WASM).

Audio is processed locally. An internet connection is required the first time each model is downloaded from Hugging Face; cached models can then be used offline.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

[Installation](#installation)  
[Operations](#operations)  
[Models](#models)
[Credentials](#credentials)
[Compatibility](#compatibility)  
[Usage](#usage)
[Resources](#resources)  

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-transcribe-audio` from **Settings → Community Nodes**. Do not copy the compiled files into n8n manually; the Community Nodes installer must install the package's isolated WASM dependencies. This package is intended for self-hosted n8n.

## Operations

- **Transcribe**: Takes a WAV file from an n8n binary property, resamples it to 16 kHz, mixes multichannel audio to mono, and returns the Whisper transcription.

The current release accepts WAV input. Convert MP3, M4A, OGG, and other formats to WAV in an earlier workflow step.

## Models

The node allows you to select from a list of pre-configured Xenova Whisper models:
- `Xenova/whisper-tiny.en`
- `Xenova/whisper-base.en`
- `Xenova/whisper-small.en`
- `Xenova/whisper-medium.en`

Larger models generally provide better accuracy but require more processing power and time.

## Credentials

This node does not require any credentials.

## Compatibility and requirements

- **n8n**: Designed for current self-hosted n8n 2.x releases. The packed release is tested end to end through the Community Nodes HTTP installer on the stock n8n 2.34.5 Alpine 3.24 / Node.js 24.18 image.
- **Node.js**: Requires Node.js `>=22.22`, matching the current n8n runtime requirement.
- **Official Docker image**: Supports the stock Alpine/musl-based `n8nio/n8n` image. No glibc compatibility layer or custom image is required.
- **Inference backend**: CPU-only ONNX Runtime WASM. This is more portable but slower than native `onnxruntime-node` on glibc-based Linux.
- **Memory**: Whisper models are memory-intensive. Start with `whisper-tiny.en` or `whisper-base.en`; larger models may require substantially more container memory.
- **Network/storage**: The first execution downloads the selected quantized model. Persist the n8n user directory so the model cache survives container recreation.

## Usage

1.  **Input**: Provide an audio file via a binary property (default: `data`).
2.  **Binary Property Name**: Specify the name of the binary property containing the audio data if it's not `data`.
3.  **Model Selection**: Choose the desired Whisper model for transcription.
4.  **Output**: The node will output the transcribed text in `json.transcription` and potentially other related information.

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js)
* [Xenova Whisper Models on Hugging Face](https://huggingface.co/Xenova?search_models=whisper)
* [Project Repository](https://github.com/dioveath/n8n-nodes-transcribe-audio)
