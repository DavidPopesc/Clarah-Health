import { APIError } from "openai";
import { MissingApiKeyError, runAgent, type ChatTurn } from "@/lib/agent";
import { getRecord, getWearable } from "@/lib/data";
import { screenMessage } from "@/lib/red-flags";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { messages?: ChatTurn[] } | null;
  const history = (body?.messages ?? []).filter(
    (m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
  );
  const last = history.at(-1);
  if (!last || last.role !== "user" || !last.content.trim()) {
    return Response.json({ error: "Send a question to ask." }, { status: 400 });
  }

  // Safety screen runs first and never depends on the model.
  const flag = screenMessage(last.content, process.env.CARE_TEAM_PHONE);
  if (flag) return Response.json({ kind: "red_flag", flag });

  try {
    const [record, wearable] = await Promise.all([getRecord(), getWearable()]);
    const answer = await runAgent(history.slice(-12), record, wearable);
    return Response.json({ kind: "answer", ...answer });
  } catch (err) {
    console.error("Agent error", err);
    const badKey = err instanceof APIError && (err.status === 401 || err.status === 403);
    if (err instanceof MissingApiKeyError || badKey) {
      return Response.json(
        { error: "Clara isn't set up yet: set a valid OPENAI_API_KEY (.env.local locally, or the project's Environment Variables on Vercel)." },
        { status: 500 },
      );
    }
    if (err instanceof APIError && (err.status === 429 || err.status === 503)) {
      return Response.json({ error: "Clara is busy right now. Try again in a moment." }, { status: 429 });
    }
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
