import Link from "next/link";
import { ChevronIcon, WatchIcon } from "@/components/icons";
import { getMode } from "@/lib/mode";
import { ADAPTATION_LABEL, demoReading, isStale, latestReading, RISK_LABEL } from "@/lib/steady";

// A compact Steady summary for the profile page; links to /steady.
export async function SteadyCard() {
  const { mode, patient } = await getMode();
  const reading = mode === "demo" ? demoReading(patient.id) : await latestReading().catch(() => null);
  const p = reading?.payload;
  const headline = !p
    ? "Not connected"
    : p.mode === "prosthetic" && p.prosthetic
      ? ADAPTATION_LABEL[p.prosthetic.adaptation]
      : RISK_LABEL[p.balance.risk];
  const detail = !p
    ? "Turn on your Steady wearable to see how steadily you walk."
    : mode === "live" && isStale(reading)
      ? "Device offline. Showing the last reading."
      : p.balance.smoothed != null
        ? `Steadiness ${Math.round(p.balance.smoothed)}${p.balance.baseline != null ? ` · usual ${Math.round(p.balance.baseline)}` : ""}`
        : "Walk for a few minutes to get a score.";
  const warn = p && (p.balance.risk === "moderate" || p.balance.risk === "high");

  return (
    <Link href="/steady" className={`slab lift flex items-center gap-3 rounded-md p-3.5 ${warn ? "border-l-4 border-l-amber" : ""}`}>
      <span className="tile-teal flex size-10 shrink-0 items-center justify-center rounded-md text-teal">
        <WatchIcon width={20} height={20} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="clinical-label text-muted">Clarah Steady</span>
        <span className="text-[14px] font-semibold text-ink">{headline}</span>
        <span className="truncate text-[12px] text-subtle">{detail}</span>
      </span>
      <ChevronIcon width={16} height={16} className="shrink-0 -rotate-90 text-subtle" />
    </Link>
  );
}
