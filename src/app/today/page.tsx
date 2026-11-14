import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { ChatIcon } from "@/components/icons";
import { getRecord, getWearable } from "@/lib/data";
import { BP_LABELS, bpCategory, bpExplanation, labHistory, latest, type BpCategory } from "@/lib/vitals";

const SCALE: { key: BpCategory; label: string; color: string }[] = [
  { key: "normal", label: "Normal", color: "#CFE3DF" },
  { key: "elevated", label: "Elevated", color: "#E9D9B8" },
  { key: "stage1", label: "Stage 1", color: "#E3B27A" },
  { key: "stage2", label: "Stage 2+", color: "#E8C4BF" },
];

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values) - 2;
  const max = Math.max(...values) + 2;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 140},${26 - ((v - min) / (max - min)) * 24}`)
    .join(" ");
  return (
    <svg width="100%" height="28" viewBox="0 0 140 28" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke="#0F6E66" strokeWidth="2" />
    </svg>
  );
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function TodayPage() {
  const [record, wearable] = await Promise.all([getRecord(), getWearable()]);
  const bp = latest(record.bloodPressure);
  const category = bp ? bpCategory(bp.systolic, bp.diastolic) : undefined;
  const scaleIndex = category === "crisis" ? 3 : SCALE.findIndex((s) => s.key === category);
  const a1c = labHistory(record.labs, "Hemoglobin A1c");
  const a1cLatest = a1c.at(-1);
  const a1cPrev = a1c.at(-2);
  const rhrValues = wearable.days.map((d) => d.restingHeartRate).filter((v): v is number => typeof v === "number");
  const rhr = rhrValues.at(-1);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <>
      <main className="flex grow flex-col gap-5 px-6 pt-14 pb-6">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-subtle">
            {today}
            {record.source === "demo" && " · Demo patient"}
          </span>
          <h1 className="font-display text-[26px] font-semibold">Hello, {record.identity.givenName}</h1>
        </div>

        {bp && category && (
          <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-white p-[18px]" aria-labelledby="bp-heading">
            <div className="flex items-baseline justify-between">
              <h2 id="bp-heading" className="text-[13px] font-semibold text-muted">
                Blood pressure · {formatDate(bp.date)}
              </h2>
              <span className="text-xs text-subtle">{record.source === "epic" ? "MyChart" : "Demo"}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[40px] leading-none font-semibold">
                {bp.systolic}/{bp.diastolic}
              </span>
              <span className="text-sm text-subtle">mmHg</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="grid grid-cols-4 gap-1">
                {SCALE.map((s, i) => (
                  <div
                    key={s.key}
                    className={`h-2 rounded ${i === scaleIndex ? "outline-2 outline-offset-2 outline-ink" : ""}`}
                    style={{ background: s.color }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1 text-[11px] text-subtle">
                {SCALE.map((s, i) => (
                  <span key={s.key} className={i === scaleIndex ? "font-semibold text-amber-ink" : ""}>
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-sm leading-normal text-body">
              <span className="sr-only">Category: {BP_LABELS[category]}. </span>
              {bpExplanation(bp)}
            </p>
          </section>
        )}

        <div className="grid grid-cols-2 gap-3">
          <section className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-white p-4">
            <h2 className="text-[13px] font-semibold text-muted">Resting heart rate</h2>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[28px] font-semibold">{rhr ?? "—"}</span>
              <span className="text-[13px] text-subtle">bpm</span>
            </div>
            <Sparkline values={rhrValues} />
            <span className="text-xs leading-snug text-muted">
              {rhr && rhr >= 60 && rhr <= 100
                ? "Typical for adults (60–100). Last 7 days shown."
                : "Typical adult range is 60–100. Ask Clara what yours means."}
            </span>
          </section>
          <section className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-white p-4">
            <h2 className="text-[13px] font-semibold text-muted">A1c</h2>
            <div className="flex items-baseline gap-1">
              <span className="font-display text-[28px] font-semibold">{a1cLatest?.value ?? "—"}</span>
              <span className="text-[13px] text-subtle">%</span>
            </div>
            <Sparkline values={a1c.map((l) => l.value)} />
            <span className="text-xs leading-snug text-muted">
              {a1cPrev && a1cLatest
                ? `${a1cLatest.value < a1cPrev.value ? "Down" : "Up"} from ${a1cPrev.value}. A common goal is under 7.`
                : "A common goal is under 7."}
            </span>
          </section>
        </div>

        <section className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-white p-4">
          <h2 className="text-[13px] font-semibold text-muted">Your medications</h2>
          <ul className="flex flex-col divide-y divide-panel">
            {record.medications
              .filter((m) => m.status === "active")
              .map((m) => (
                <li key={m.name} className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0">
                  <span>{m.name}</span>
                  <span className="text-right text-subtle">{m.dosage}</span>
                </li>
              ))}
          </ul>
        </section>

        <Link
          href="/ask"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] bg-teal text-[15px] font-semibold text-white hover:bg-teal-dark"
        >
          <ChatIcon width={18} height={18} /> Ask Clara about your health
        </Link>
      </main>
      <BottomNav active="/today" />
    </>
  );
}
