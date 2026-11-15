import { MissingApiKeyError } from "./agent";

// Speech in and out through Gemini's native API (the OpenAI-compatible endpoint the chat uses
// doesn't do audio). Transcription and the voice both need GEMINI_API_KEY; the backup provider
// has no audio support.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const TRANSCRIBE_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL ?? "gemini-3.5-flash";
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE ?? "Sulafat"; // a warm, calm prebuilt voice

export class AudioApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function generate(model: string, body: unknown, timeoutMs: number): Promise<Part[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new MissingApiKeyError("Set GEMINI_API_KEY for recording and Clarah's voice");
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AudioApiError(`${model} failed (${res.status}): ${detail.slice(0, 300)}`, res.status);
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
  return json.candidates?.[0]?.content?.parts ?? [];
}

const TRANSCRIBE_PROMPT = `Transcribe this recording of a medical visit word for word.
- Start each turn on a new line with "Clinician:", "Patient:", or "Other:" based on who is speaking.
- Keep medicine names, doses, numbers, and dates exactly as spoken. Don't summarize, correct, or add anything.
- Mark words you can't make out as [unclear].
- If there is no speech, reply with nothing.`;

// One WAV chunk of a recording to text.
export async function transcribeAudio(wav: Uint8Array): Promise<string> {
  const parts = await generate(
    TRANSCRIBE_MODEL,
    {
      contents: [
        {
          parts: [{ inlineData: { mimeType: "audio/wav", data: Buffer.from(wav).toString("base64") } }, { text: TRANSCRIBE_PROMPT }],
        },
      ],
      generationConfig: { temperature: 0 },
    },
    120_000,
  );
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

// Wraps raw 16-bit mono PCM in a WAV header so browsers can play it.
function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

// Text to Clarah's voice. Only the words to say are sent: this model reads style hints out loud.
export async function synthesizeSpeech(text: string): Promise<{ audio: Buffer; mimeType: string }> {
  const parts = await generate(
    TTS_MODEL,
    {
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
      },
    },
    60_000,
  );
  const inline = parts.find((p) => p.inlineData)?.inlineData;
  if (!inline?.data) throw new AudioApiError("No audio in the voice reply", 502);
  const bytes = Buffer.from(inline.data, "base64");
  const mime = inline.mimeType.toLowerCase();
  if (mime.includes("l16") || mime.includes("pcm")) {
    return { audio: pcmToWav(bytes, Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000)), mimeType: "audio/wav" };
  }
  return { audio: bytes, mimeType: mime.split(";")[0] || "audio/wav" };
}
