import { getMode } from "@/lib/mode";
import { queueCommand, REMOTE_COMMANDS, type RemoteCommand } from "@/lib/steady";

// "I'm OK" from the website: queue `resolve` (end the alarm) or `cancel` (stop a countdown) for
// the board, which picks it up on its next sync, within about 5 seconds.
export async function POST(request: Request) {
  const { mode } = await getMode();
  if (mode !== "live") return Response.json({ error: "Only in live mode" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { command?: string } | null;
  const command = body?.command as RemoteCommand;
  if (!REMOTE_COMMANDS.includes(command)) return Response.json({ error: "Unknown command" }, { status: 400 });
  try {
    await queueCommand(command);
  } catch (error) {
    console.error("Steady command failed", error);
    return Response.json({ error: "Couldn't reach the device store" }, { status: 503 });
  }
  return Response.json({ ok: true, command });
}
