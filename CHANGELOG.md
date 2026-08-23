# Changelog

## 0.2.0 — 2026-08-23

### Added

- Alpine-compatible ONNX Runtime WebAssembly inference for the official n8n Docker image.
- A packaged Alpine smoke test that executes an ONNX model through the WASM backend.
- CI coverage for the Alpine compatibility test.
- npm provenance publishing through GitHub Actions.

### Changed

- Upgraded to `@huggingface/transformers` 4.2.0.
- Updated compatibility to n8n 2.x and Node.js 22.22 or newer.
- Migrated development, linting, building, and release tasks to the official `@n8n/node-cli` toolchain.
- Corrected multichannel WAV downmixing and clarified that the current node accepts WAV input.

### Removed

- The glibc-dependent native ONNX Runtime path and obsolete starter credential files.
