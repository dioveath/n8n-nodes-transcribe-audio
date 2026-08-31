# n8n-nodes-transcribe-audio

This is an n8n community node for local speech-to-text with Whisper. Inference runs inside the n8n process through Hugging Face Transformers.js and ONNX Runtime WebAssembly (WASM).

Audio is processed locally. An internet connection is required the first time each model is downloaded from Hugging Face; cached models can then be used offline.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

- [Installation](#installation)
- [Updating an old installation](#updating-an-old-installation)
- [Operations](#operations)
- [Models](#models)
- [Credentials](#credentials)
- [Compatibility](#compatibility-and-requirements)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) and install `n8n-nodes-transcribe-audio` from **Settings → Community Nodes**.

- Install version **0.2.1 or newer**. Versions through 0.2.0 can load a native ONNX library that does not work on Alpine Linux.
- Do not copy `dist` or `node_modules` into n8n manually. The Community Nodes installer must install the package's isolated WASM dependencies.
- This package is for self-hosted n8n. It has runtime dependencies, so it is not eligible for n8n Cloud verification under the current community-package rules.
- If your n8n instance blocks unverified packages, set `N8N_UNVERIFIED_PACKAGES_ENABLED=true` and restart n8n before installing.

## Updating an old installation

1. Back up the persisted n8n user directory.
2. Update n8n to a release that uses Node.js 22.22 or newer.
3. Update this package to version 0.2.1 or newer from **Settings → Community Nodes**.
4. Restart n8n after the update.

Version 0.2.1 uses a new Transformers.js package alias so a running n8n process cannot reuse the native ONNX module path cached by versions through 0.2.0.

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

- **n8n**: Designed for current self-hosted n8n 2.x releases. The packed release is tested end to end through the Community Nodes HTTP installer on the stock n8n 2.35.7 Alpine / Node.js 24 image.
- **Node.js**: Requires Node.js `>=22.22`, matching the current n8n runtime requirement.
- **Official Docker image**: Supports the stock Alpine/musl-based `n8nio/n8n` image. No glibc compatibility layer or custom image is required.
- **CPU architecture**: CI runs the package-install and WASM smoke test on Linux x64 and ARM64. The complete Whisper WAV test runs on x64.
- **Inference backend**: CPU-only ONNX Runtime WASM. This is more portable but slower than native `onnxruntime-node` on glibc-based Linux.
- **Memory**: Whisper models are memory-intensive. Start with `whisper-tiny.en` or `whisper-base.en`; larger models may require substantially more container memory.
- **Network/storage**: The first execution downloads the selected quantized model. Persist the n8n user directory so the model cache survives container recreation.

## Usage

1.  **Input**: Provide an audio file via a binary property (default: `data`).
2.  **Binary Property Name**: Specify the name of the binary property containing the audio data if it's not `data`.
3.  **Model Selection**: Choose the desired Whisper model for transcription.
4.  **Output**: The node will output the transcribed text in `json.transcription` and potentially other related information.

## Troubleshooting

If installation appears to finish but the node is missing, read the n8n container log:

```sh
docker logs <your-n8n-container>
```

- A `__vsnprintf_chk: symbol not found` or `__sprintf_chk: symbol not found` error means an old native ONNX package was loaded. Update to 0.2.1 or newer and restart n8n.
- An engine warning means the n8n container's Node.js version is too old. Update n8n instead of forcing the package to install.
- A model-download error on first use is not an install error. Check container network access and free storage.
- An out-of-memory error is not an install error. Start with `Xenova/whisper-tiny.en` and give the container more memory if needed.

Maintainers can find the release and old-version deprecation checklist in [`docs/RELEASING.md`](docs/RELEASING.md).

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [Hugging Face Transformers.js](https://huggingface.co/docs/transformers.js)
- [Xenova Whisper Models on Hugging Face](https://huggingface.co/Xenova?search_models=whisper)
- [Project Repository](https://github.com/dioveath/n8n-nodes-transcribe-audio)
