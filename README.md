# Transcribe Audio for n8n

Turn English speech in WAV and MP3 files into text inside your self-hosted n8n instance. No transcription API key is required, and your audio is not sent to a third-party transcription service.

## What you can build

- Turn meeting recordings into notes
- Transcribe voice messages and form uploads
- Extract text from interviews and podcasts
- Prepare audio for summaries, search, subtitles, or AI workflows
- Process private recordings on your own n8n server

## Before you install

- This community node is for **self-hosted n8n**. It is not available on n8n Cloud.
- It supports **WAV and MP3** files with English speech.
- The first run downloads the selected speech model, so your n8n server needs internet access.
- Transcription runs on your server's CPU. Longer recordings and larger models take more time and memory.

## Installation

1. In n8n, open **Settings → Community Nodes**.
2. Select **Install a community node**.
3. Enter:

   ```text
   n8n-nodes-transcribe-audio
   ```

4. Accept the community-node warning and install it.
5. Restart n8n if the node does not appear immediately.

If your self-hosted instance blocks unverified community nodes, add this environment variable and restart n8n:

```text
N8N_UNVERIFIED_PACKAGES_ENABLED=true
```

## Quick start

1. Add a node that produces a WAV or MP3 file, such as a Form Trigger, Webhook, Google Drive, or Read/Write Files from Disk node.
2. Add **Transcribe Audio** after it.
3. Enter the binary field that contains the audio. The usual field is `data`. If the incoming item has only one file, the node can detect it automatically.
4. Choose a model. Start with `Xenova/whisper-tiny.en` for the quickest result.
5. Run the workflow.
6. Read the transcript from:

   ```text
   {{$json.transcription.text}}
   ```

Example output:

```json
{
  "transcription": {
    "text": "Your transcribed speech appears here."
  }
}
```

## Choosing a model

| Model | Best for | Trade-off |
| --- | --- | --- |
| `Xenova/whisper-tiny.en` | Testing, short clips, and lower-memory servers | Fastest, but less accurate |
| `Xenova/whisper-base.en` | Everyday voice notes and recordings | Good starting balance |
| `Xenova/whisper-small.en` | Clearer transcripts when accuracy matters | Slower and uses more memory |
| `Xenova/whisper-medium.en` | Higher accuracy on capable servers | Slowest and most memory-intensive |

All available models are English-only. Start small, then move to a larger model only if you need better accuracy.

## Supported input

- WAV
- MP3
- Mono or stereo audio
- Any sample rate; the node prepares the audio automatically

Convert M4A, OGG, AAC, FLAC, and other formats to WAV or MP3 before sending them to this node.

## Privacy and storage

The recording is processed inside your n8n instance. The node does not upload audio to a transcription API.

On first use, n8n downloads the selected model from Hugging Face and stores it in the n8n user folder. Keep that folder on persistent storage so the model does not need to be downloaded again when the container restarts.

## Troubleshooting

### The node does not appear after installation

- Confirm that you are using self-hosted n8n, not n8n Cloud.
- Confirm that `N8N_UNVERIFIED_PACKAGES_ENABLED=true` is set when required by your setup.
- Restart n8n and check the container logs:

  ```sh
  docker logs <your-n8n-container>
  ```

### The first run is slow

The first run downloads and opens the selected model. Later runs reuse the saved model and start faster.

### The model cannot be downloaded

Check that the n8n container can reach the internet and has enough free storage. The audio itself stays local; only the model is downloaded.

### The server runs out of memory

Use `Xenova/whisper-tiny.en` or `Xenova/whisper-base.en`, shorten the recording, or give the n8n container more memory.

### The audio format is rejected

Use a WAV or MP3 file. Convert M4A, OGG, AAC, FLAC, and other formats before this node.

### Logs mention `__vsnprintf_chk` or `__sprintf_chk`

An old package version is still installed. Remove it from **Settings → Community Nodes**, install the latest version, and restart n8n.

## Updating

Update the package from **Settings → Community Nodes**, then restart n8n. Back up your n8n user folder before updating your n8n installation.

## Links

- [n8n community-node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
- [Report a problem or request a feature](https://github.com/dioveath/n8n-nodes-transcribe-audio/issues)
- [Version history](CHANGELOG.md)
