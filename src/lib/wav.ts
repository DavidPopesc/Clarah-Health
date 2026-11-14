"use client";

// Browsers record compressed audio (usually WebM/Opus), which the transcription model doesn't
// accept. This decodes a recording, downmixes it to 16 kHz mono (plenty for speech), and cuts it
// into WAV chunks small enough to send one at a time.

const RATE = 16_000;
export const CHUNK_SECONDS = 240;

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function recordingToWavChunks(recording: Blob): Promise<Blob[]> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await recording.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const length = Math.ceil(decoded.duration * RATE);
  if (!length) return [];
  const offline = new OfflineAudioContext(1, length, RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const size = CHUNK_SECONDS * RATE;
  const chunks: Blob[] = [];
  for (let start = 0; start < samples.length; start += size) {
    chunks.push(encodeWav(samples.subarray(start, start + size)));
  }
  return chunks;
}
