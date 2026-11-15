import { MissingApiKeyError } from "@/lib/agent";
import { AudioApiError, synthesizeSpeech } from "@/lib/gemini-audio";

// One paragraph of a visit recap to Clarah Health's voice. The player asks for each paragraph
// separately so playback can start before the whole recap is spoken.
const MAX_CHARS = 1500;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_CHARS) {
    return Response.json({ error: "Nothing to say, or too much at once." }, { status: 400 });
  }

  try {
    const { audio, mimeType } = await synthesizeSpeech(text);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": mimeType, "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Speech error", err);
    const status = err instanceof MissingApiKeyError ? 501 : err instanceof AudioApiError && err.status === 429 ? 429 : 502;
    return Response.json({ error: "Clarah Health's voice isn't available right now." }, { status });
  }
}
