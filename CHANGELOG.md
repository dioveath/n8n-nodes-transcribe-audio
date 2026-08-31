# Version history

Use the latest version for the best compatibility and format support. Versions earlier than 0.2.3 are deprecated and no longer supported.

## 0.2.5 — 31 August 2026

### Improved

- Rewrote the documentation around practical transcription workflows and everyday usage.
- Added a ready-to-import example workflow for transcribing WAV and MP3 form uploads.
- Made the node's field descriptions and search terms clearer inside n8n.

## 0.2.4 — Not published

This version was skipped after its release tag referenced package metadata for 0.2.3. No 0.2.4 package was published to npm.

## 0.2.3 — 31 August 2026

### New

- Transcribe MP3 files directly, without adding FFmpeg or a conversion step.
- Continue to support mono and stereo WAV files.
- Save downloaded speech models in the n8n user folder so container restarts do not download them again.

### Improved

- More reliable setup in the official n8n Docker image.
- Tested installation on both x64 and ARM64 Linux servers.
- Added complete WAV and MP3 transcription checks before publishing.

## 0.2.2 — 31 August 2026

- Automatically uses the only incoming file when its field name is not `data`.
- Added clearer installation, update, and troubleshooting guidance.
- Improved testing for the official n8n Docker image.

## 0.2.1 — 23 August 2026

- Fixed upgrades from older versions that could prevent the node from loading in the official n8n Docker image.
- Improved installation through **Settings → Community Nodes**.

## 0.2.0 — 23 August 2026

- Added local WAV transcription for current self-hosted n8n 2.x installations.
- Added support for the official n8n Docker image.
- Improved handling of stereo recordings.

## Older versions

Versions earlier than 0.2.3 are deprecated and no longer supported. Update from **Settings → Community Nodes**, then restart n8n.
