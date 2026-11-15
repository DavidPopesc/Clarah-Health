import { APIError } from "openai";
import { MissingApiKeyError, runAgent, type AgentEvent, type ChatTurn } from "@/lib/agent";
import { getRecord, getWearable } from "@/lib/data";
import { screenMessage } from "@/lib/red-flags";

function errorMessage(err: unknown): string {
  const badKey = err instanceof APIError && (err.status === 401 || err.status === 403);
  if (err instanceof MissingApiKeyError || badKey) {
    return "Clarah isn't set up yet: set a valid GEMINI_API_KEY or OPENAI_API_KEY (.env.local locally, or the project's Environment Variables on Vercel).";
  }
  if (err instanceof APIError && (err.status === 429 || err.status === 503)) {
    return "Clarah is busy right now. Try again in a moment.";
  }
  return "Something went wrong. Please try again.";
}

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

  // Stream the answer as newline-delimited JSON events so text shows up as it's written.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AgentEvent | { type: "error"; error: string }) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const [record, wearable] = await Promise.all([getRecord(), getWearable()]);
        await runAgent(history.slice(-12), record, wearable, send);
      } catch (err) {
        console.error("Agent error", err);
        send({ type: "error", error: errorMessage(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
