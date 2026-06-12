// Server-side WAV helpers. Gemini TTS returns raw 16-bit PCM (mono, usually
// 24kHz) as base64 — we wrap it in a WAV header before storing, and duration
// is derived from the PCM byte length, so timestamps are exact.

export function parseRateFromMime(mimeType: string | undefined): number {
  // e.g. "audio/L16;codec=pcm;rate=24000"
  const m = /rate=(\d+)/.exec(mimeType ?? "");
  return m ? parseInt(m[1], 10) : 24000;
}

export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function pcmDurationMs(pcmBytes: number, sampleRate: number, channels = 1, bitsPerSample = 16): number {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  return Math.round((pcmBytes / byteRate) * 1000);
}

/** Parse a complete WAV file's header (e.g. OpenAI TTS output) to get its exact duration. */
export function wavDurationMs(buf: Buffer): number {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF") {
    throw new Error("Not a WAV file");
  }
  let offset = 12;
  let sampleRate = 24000;
  let channels = 1;
  let bitsPerSample = 16;
  let dataLength = -1;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === "fmt ") {
      channels = buf.readUInt16LE(offset + 10);
      sampleRate = buf.readUInt32LE(offset + 12);
      bitsPerSample = buf.readUInt16LE(offset + 22);
    } else if (chunkId === "data") {
      // Streaming writers sometimes leave a placeholder size — trust the file length then.
      const remaining = buf.length - (offset + 8);
      dataLength = chunkSize === 0 || chunkSize > remaining ? remaining : chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (dataLength < 0) throw new Error("WAV has no data chunk");
  return pcmDurationMs(dataLength, sampleRate, channels, bitsPerSample);
}
