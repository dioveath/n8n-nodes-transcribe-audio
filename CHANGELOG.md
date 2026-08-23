# Changelog

## 0.2.1 — 2026-08-23

### Fixed

- Prevented persisted pre-0.2.0 installations from reusing the cached native `onnxruntime-node` resolution when upgraded on Alpine/musl.
- Ensured Transformers.js resolves through a package-specific WASM alias while preserving the existing n8n node type.

### Changed

- Replaced the synthetic package-copy smoke test with an end-to-end test that installs the packed release through n8n's Community Nodes HTTP endpoint.
- The installation test now reproduces an existing 0.1.23 native ONNX failure, upgrades to the candidate package, verifies that n8n loads it, and executes ONNX inference through WASM.

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
