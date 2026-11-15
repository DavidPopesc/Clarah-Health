import { MissingApiKeyError } from "@/lib/agent";
import { AudioApiError, transcribeAudio } from "@/lib/gemini-audio";

// One chunk of a visit recording (16 kHz mono WAV, made in the browser) to text.
// The audio is passed to the AI for transcription and isn't kept.
const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  if (!request.headers.get("Content-Type")?.startsWith("audio/wav")) {
    return Response.json({ error: "Send the recording as WAV audio." }, { status: 415 });
  }
  const audio = new Uint8Array(await request.arrayBuffer());
  if (audio.byteLength < 1000) return Response.json({ text: "" });
  if (audio.byteLength > MAX_BYTES) {
    return Response.json({ error: "This part of the recording is too large." }, { status: 413 });
  }

  try {
    return Response.json({ text: await transcribeAudio(audio) });
  } catch (err) {
    console.error("Transcription error", err);
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "Recording needs a Gemini key (GEMINI_API_KEY). You can type or paste the conversation instead." }, { status: 500 });
    }
    if (err instanceof AudioApiError && (err.status === 429 || err.status === 503)) {
      return Response.json({ error: "Transcription is busy right now. Try again in a moment." }, { status: 429 });
    }
    return Response.json({ error: "Clarah Health couldn't transcribe this recording. Please try again." }, { status: 500 });
  }
}
