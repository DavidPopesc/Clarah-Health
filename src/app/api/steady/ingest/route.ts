import { timingSafeEqual } from "node:crypto";
import { sanitizePayload, saveReading, takeCommands } from "@/lib/steady";

// The Clarah Steady board POSTs its summary here every 30 s (and right away when an alarm
// starts or ends), authenticated with the shared STEADY_INGEST_TOKEN.

const MAX_BYTES = 256 * 1024;

function authorized(header: string | null): boolean {
  const expected = process.env.STEADY_INGEST_TOKEN;
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.STEADY_INGEST_TOKEN) return Response.json({ error: "Steady sync is not set up" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "Payload too large" }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const payload = sanitizePayload(body);
  if (!payload) return Response.json({ error: "Expected a version 1 Steady payload" }, { status: 400 });
  try {
    await saveReading(payload);
  } catch (error) {
    console.error("Steady ingest failed", error);
    return Response.json({ error: "Could not store the reading" }, { status: 503 });
  }
  // Hand over anything the website asked the device to do (end or cancel its alarm).
  const commands = await takeCommands(payload.device_id).catch(() => []);
  return Response.json({ ok: true, device_id: payload.device_id, commands });
}
