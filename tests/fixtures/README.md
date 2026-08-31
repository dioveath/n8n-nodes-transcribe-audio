# Audio test fixture

`jfk-4s.wav` is a four-second, 16 kHz mono excerpt used to test the complete Whisper transcription path.

- Source: [`Xenova/transformers.js-docs/jfk.wav`](https://huggingface.co/datasets/Xenova/transformers.js-docs/blob/fbe92bd97d48f3ec17779d8d8f2964e1c6bc7634/jfk.wav)
- Source SHA-256: `aa81c2552465568567e670f3823117e633900d16bd6202346a72f3c8464c74c8`
- Fixture SHA-256: `d4353899488c9adfadc073a5c847c3ff54cc17e18f4d3837fb50f6dd916a7d20`
- Speech: excerpt from President John F. Kennedy's 1961 inaugural address, a work of the United States federal government

The fixture was made with:

```sh
ffmpeg -i jfk.wav -t 4 -ac 1 -ar 16000 -c:a pcm_s16le jfk-4s.wav
```

Do not replace the fixture without recording its source, hashes, and conversion command here.
