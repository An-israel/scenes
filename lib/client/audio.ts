"use client";

import { Mp3Encoder } from "@breezystack/lamejs";

// Scene WAVs are produced by our own server (16-bit PCM mono), so we can
// parse headers directly instead of using WebAudio decoding.

interface ParsedWav {
  sampleRate: number;
  channels: number;
  samples: Int16Array;
}

export function parseWav(buf: ArrayBuffer): ParsedWav {
  const view = new DataView(buf);
  if (view.getUint32(0, false) !== 0x52494646 /* RIFF */) throw new Error("Not a WAV file");

  let offset = 12;
  let sampleRate = 24000;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = view.getUint32(offset, false);
    const chunkSize = view.getUint32(offset + 4, true);
    if (chunkId === 0x666d7420 /* fmt  */) {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 0x64617461 /* data */) {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, view.byteLength - dataOffset);
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  if (dataOffset < 0) throw new Error("WAV has no data chunk");
  if (bitsPerSample !== 16) throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);

  // Int16Array view needs 2-byte alignment; copy if needed.
  const bytes = new Uint8Array(buf, dataOffset, dataLength - (dataLength % 2));
  const aligned = new Uint8Array(bytes.length);
  aligned.set(bytes);
  return { sampleRate, channels, samples: new Int16Array(aligned.buffer) };
}

/** Concatenate scene WAVs (same format) and encode a single MP3. */
export function wavsToMp3(buffers: ArrayBuffer[], kbps = 128): Blob {
  const parsed = buffers.map(parseWav);
  const { sampleRate, channels } = parsed[0];

  const totalSamples = parsed.reduce((n, p) => n + p.samples.length, 0);
  const all = new Int16Array(totalSamples);
  let pos = 0;
  for (const p of parsed) {
    if (p.sampleRate !== sampleRate || p.channels !== channels) {
      throw new Error("Scene audio formats differ — regenerate the mismatched scene.");
    }
    all.set(p.samples, pos);
    pos += p.samples.length;
  }

  const encoder = new Mp3Encoder(channels, sampleRate, kbps);
  const chunks: Uint8Array[] = [];
  const BLOCK = 1152;
  for (let i = 0; i < all.length; i += BLOCK) {
    const slice = all.subarray(i, Math.min(i + BLOCK, all.length));
    const encoded = encoder.encodeBuffer(slice);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}
