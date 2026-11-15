import { getMode } from "@/lib/mode";
import { demoReading, isStale, latestReading, markWatched, type SteadyMode } from "@/lib/steady";

// The /steady page polls this. Demo mode returns the demo patient's synthetic reading
// (?mode=prosthetic previews prosthetic mode); live mode returns the board's last push.
export async function GET(request: Request) {
  const { mode, patient } = await getMode();
  if (mode === "demo") {
    const preview: SteadyMode = new URL(request.url).searchParams.get("mode") === "prosthetic" ? "prosthetic" : "fall_prevention";
    return Response.json({ reading: demoReading(patient.id, preview), stale: false });
  }
  try {
    // Someone is watching: the board switches to syncing every second.
    const [reading] = await Promise.all([latestReading(), markWatched().catch(() => undefined)]);
    return Response.json({ reading, stale: isStale(reading) });
  } catch (error) {
    console.error("Steady read failed", error);
    return Response.json({ reading: null, stale: true, error: "Couldn't reach the device store" }, { status: 503 });
  }
}
