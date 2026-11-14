import { APIError } from "openai";
import { MissingApiKeyError } from "@/lib/agent";
import { getRecord, getWearable } from "@/lib/data";
import { explainVisit } from "@/lib/visits";

// Receives the transcript of a visit (recorded and transcribed, or typed in by the care team)
// and returns Clara's plain-language recap, paired with the patient's record. Nothing is stored.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { transcript?: unknown; date?: unknown } | null;
  const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
  const date = typeof body?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : undefined;
  if (transcript.length < 40) {
    return Response.json({ error: "The conversation is too short for Clara to explain. Record or paste a little more." }, { status: 400 });
  }

  try {
    const [record, wearable] = await Promise.all([getRecord(), getWearable()]);
    const result = await explainVisit(transcript, date, record, wearable);
    if (!result.recap.script.length) throw new Error("Empty recap");
    return Response.json(result);
  } catch (err) {
    console.error("Visit recap error", err);
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "Clara isn't set up yet: add an AI key." }, { status: 500 });
    }
    if (err instanceof APIError && (err.status === 429 || err.status === 503)) {
      return Response.json({ error: "Clara is busy right now. Try again in a moment." }, { status: 429 });
    }
    return Response.json({ error: "Clara couldn't explain this visit. Please try again." }, { status: 500 });
  }
}
