"use client";

import { useEffect, useState } from "react";
import { CheckIcon, PhoneIcon, WarningIcon } from "@/components/icons";
import {
  ADAPTATION_LABEL,
  eventLabel,
  RISK_LABEL,
  WORSENING_ADVICE,
  type SteadyMode,
  type SteadyPayload,
  type SteadyReading,
} from "@/lib/steady";

// Matches the board's fast sync while this page is open.
const POLL_MS = 1000;

interface Props {
  initial: SteadyReading | null;
  initialStale: boolean;
  demo: boolean;
  careTeamPhone?: string;
}

const ago = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

const RISK_TINT: Record<string, string> = {
  low: "bg-[#e3eedc] text-[#2f5443]",
  moderate: "bg-amber-soft text-amber-ink",
  high: "bg-[#f6dcdc] text-alert",
  unknown: "bg-panel text-muted",
};

// ---------------------------------------------------------------- charts

/** One series of daily values as bars, with an optional dashed reference line. */
function DailyBars({ values, days, max, reference, referenceLabel, unit, color }: {
  values: number[]; days: string[]; max: number; reference?: number | null; referenceLabel?: string; unit: string; color: string;
}) {
  const w = 640, h = 140, pad = 18, gap = 4;
  const bw = (w - gap * (values.length - 1)) / Math.max(1, values.length);
  const y = (v: number) => h - pad - (Math.min(v, max) / max) * (h - pad * 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Daily ${unit}, last ${values.length} days`}>
      <line x1="0" x2={w} y1={h - pad} y2={h - pad} stroke="#c9d2bd" />
      {values.map((v, i) => (
        <rect key={days[i]} x={i * (bw + gap)} y={y(v)} width={bw} height={Math.max(2, h - pad - y(v))} rx="3" fill={color}>
          <title>{`${days[i]}: ${Math.round(v)} ${unit}`}</title>
        </rect>
      ))}
      {reference != null && (
        <>
          <line x1="0" x2={w} y1={y(reference)} y2={y(reference)} stroke="#1e2824" strokeDasharray="4 4" strokeWidth="1.2" />
          <text x={w} y={y(reference) - 4} textAnchor="end" fontSize="10" fill="#505d56">{referenceLabel}</text>
        </>
      )}
      <text x="0" y={h - 3} fontSize="10" fill="#616d66">{days[0]?.slice(5)}</text>
      <text x={w} y={h - 3} textAnchor="end" fontSize="10" fill="#616d66">{days.at(-1)?.slice(5)}</text>
      <text x={w} y={y(values.at(-1) ?? 0) - 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#1e2824">{Math.round(values.at(-1) ?? 0)}</text>
    </svg>
  );
}

/** Daily scores as a line. Lines can zoom to the data's range honestly; bars can't. */
function DailyLine({ values, days, reference, referenceLabel, unit, color }: {
  values: number[]; days: string[]; reference?: number | null; referenceLabel?: string; unit: string; color: string;
}) {
  const w = 640, h = 160, padX = 6, padTop = 22, padBottom = 20;
  const all = reference != null ? [...values, reference] : values;
  const lo = Math.max(0, Math.floor((Math.min(...all) - 6) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...all) + 4) / 10) * 10);
  const x = (i: number) => padX + (i / Math.max(1, values.length - 1)) * (w - padX * 2 - 30);
  const y = (v: number) => padTop + (1 - (v - lo) / Math.max(1, hi - lo)) * (h - padTop - padBottom);
  const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Daily ${unit}, last ${values.length} days, from ${Math.round(values[0])} to ${Math.round(values[last])}`}>
      {[lo, hi].map((v) => (
        <g key={v}>
          <line x1={padX} x2={w - 30} y1={y(v)} y2={y(v)} stroke="#e6ebdf" />
          <text x={w} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#616d66">{v}</text>
        </g>
      ))}
      {reference != null && (
        <>
          <line x1={padX} x2={w - 30} y1={y(reference)} y2={y(reference)} stroke="#1e2824" strokeDasharray="5 5" strokeWidth="1.2" />
          <text x={padX} y={y(reference) - 6} fontSize="11" fill="#505d56">{referenceLabel} ({Math.round(reference)})</text>
        </>
      )}
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={days[i]} cx={x(i)} cy={y(v)} r={i === last ? 5 : 3.5} fill={i === last ? color : "#fff"} stroke={color} strokeWidth="2">
          <title>{`${days[i]}: ${Math.round(v)} ${unit}`}</title>
        </circle>
      ))}
      <text x={x(last)} y={y(values[last]) - 10} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1e2824">{Math.round(values[last])}</text>
      <text x={padX} y={h - 3} fontSize="11" fill="#616d66">{days[0]?.slice(5)}</text>
      <text x={x(last)} y={h - 3} textAnchor="end" fontSize="11" fill="#616d66">{days[last]?.slice(5)}</text>
    </svg>
  );
}

const AXES = [
  { key: "x", label: "Side to side", color: "#2a78d6" },
  { key: "y", label: "Front to back", color: "#eb6834" },
  { key: "z", label: "Up and down", color: "#1baf7a" },
] as const;

/** The last ~10 s of acceleration on each axis, in g. */
function LiveMotion({ motion, live }: { motion: NonNullable<SteadyPayload["motion"]>; live: boolean }) {
  const w = 640, h = 170, padL = 30, padR = 6, padT = 10, padB = 18;
  const n = Math.max(motion.x.length, 2);
  const lo = -1.6, hi = 1.6;
  const x = (i: number) => padL + (i / (n - 1)) * (w - padL - padR);
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const peak = Math.max(...motion.mag);
  const seconds = Math.round(motion.mag.length / (motion.hz || 10));
  return (
    <section aria-labelledby="motion-heading">
      <div className="flex items-end justify-between border-b border-line pb-2">
        <h3 id="motion-heading" className="clinical-label text-muted">Live motion · last {seconds} seconds</h3>
        <span className="clinical-label text-subtle">{live ? "live, every second" : "demo"}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Acceleration over the last ${seconds} seconds, peak ${peak.toFixed(2)} g`}>
        {[-1, 0, 1].map((g) => (
          <g key={g}>
            <line x1={padL} x2={w - padR} y1={y(g)} y2={y(g)} stroke={g === 0 ? "#c9d2bd" : "#e6ebdf"} />
            <text x={padL - 6} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#616d66">{g > 0 ? `+${g}` : g} g</text>
          </g>
        ))}
        {AXES.map((a) => (
          <path key={a.key} d={path(motion[a.key])} fill="none" stroke={a.color} strokeWidth="2" strokeLinejoin="round" />
        ))}
        <text x={padL} y={h - 3} fontSize="11" fill="#616d66">−{seconds} s</text>
        <text x={w - padR} y={h - 3} textAnchor="end" fontSize="11" fill="#616d66">now</text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
        {AXES.map((a) => (
          <span key={a.key} className="flex items-center gap-1.5"><i className="inline-block size-2.5 rounded-sm" style={{ background: a.color }} />{a.label}</span>
        ))}
        <span className="ml-auto font-mono text-[12px] text-body">peak {peak.toFixed(2)} g</span>
      </div>
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="slab rounded-md px-3.5 py-3">
      <span className="clinical-label text-muted">{label}</span>
      <strong className="mt-1 block font-mono text-[22px] leading-none text-ink">{value}</strong>
      {sub && <span className="mt-1 block text-[11px] text-subtle">{sub}</span>}
    </div>
  );
}

// ---------------------------------------------------------------- emergency

const SIM_STEPS = [
  "Calling 911 (simulation)",
  "Dialing…",
  "Connected (simulated)",
  "Sharing fall details and location with the dispatcher (simulated)",
];

function EmergencyScreen({ p, offsetMs, careTeamPhone, onClose, closeLabel = "Close", remote }: {
  p: SteadyPayload; offsetMs: number; careTeamPhone?: string; onClose?: () => void; closeLabel?: string;
  /** Live mode: the website can end the alarm on the device. */
  remote?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [sent, setSent] = useState<"" | "sending" | "sent" | "failed">("");
  async function imOk(command: "cancel" | "resolve") {
    setSent("sending");
    try {
      const res = await fetch("/api/steady/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command }) });
      setSent(res.ok ? "sent" : "failed");
    } catch {
      setSent("failed");
    }
  }
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const harsh = p.emergency.reason === "harsh_fall" || p.alert?.kind === "harsh_fall";
  const help = (p.emergency.reason ?? p.alert?.kind) === "help";
  const counting = !p.emergency.active && p.alert;
  // Board times are on the board's clock; offsetMs maps them onto ours.
  const remaining = counting && p.alert?.countdown_s != null
    ? Math.max(0, Math.ceil((p.alert.t * 1000 + offsetMs + p.alert.countdown_s * 1000 - now) / 1000))
    : null;
  const simStart = p.emergency.simulated_911_at != null ? p.emergency.simulated_911_at * 1000 + offsetMs : null;
  const step = simStart == null ? -1 : Math.min(SIM_STEPS.length - 1, Math.floor((now - simStart) / 2500));
  const title = counting
    ? harsh ? "Hard fall detected" : help ? "Help requested" : "Possible fall detected"
    : harsh ? "Hard fall: no response" : help ? "Emergency: help requested" : "Emergency: no response after a fall";

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="steady-emergency-title"
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[460px] flex-col overflow-y-auto bg-white lg:inset-y-10 lg:max-w-2xl lg:rounded-md lg:shadow-[0_0_0_100vmax_rgba(30,40,36,0.6)]">
      <div className="flex flex-col gap-3 bg-alert px-6 pt-14 pb-7 text-white">
        <WarningIcon width={34} height={34} />
        <h1 id="steady-emergency-title" className="text-[28px] leading-tight font-semibold">{title}</h1>
        {counting ? (
          <p className="text-[15px]">
            {help ? "The help button was pressed on the Steady device." : `Clarah Steady is checking on ${p.patient_name || "the wearer"}.`}
            {remaining != null && <> Unless it&apos;s cancelled in <strong className="font-mono text-xl">{remaining}s</strong>, {help ? "the emergency contact is alerted" : `an emergency starts${harsh ? " and a 911 call is simulated" : ""}`}.</>}
            {" "}Press the button on the device to cancel.
          </p>
        ) : (
          <p className="text-[15px]">
            {help ? "Help was requested on the Steady device and wasn't cancelled." : "Nobody responded after the fall."}
            {" "}The emergency contact has been alerted{help ? "" : " with the time and fall details"}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 p-6">
        {simStart != null && (
          <section aria-label="Simulated 911 call" className="rounded-md border-2 border-alert p-4">
            <ol className="flex flex-col gap-2">
              {SIM_STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-2 text-[14px] ${i <= step ? "font-semibold text-ink" : "text-subtle"}`}>
                  {i < step ? <CheckIcon width={16} height={16} className="text-[#2f5443]" /> : <span className={`size-2.5 rounded-full ${i === step ? "animate-pulse bg-alert" : "bg-line"}`} />}
                  {s}
                </li>
              ))}
            </ol>
            <p className="mt-3 bg-amber-soft px-3 py-2 text-[12px] font-semibold text-amber-ink">SIMULATION: no real call was placed. A production version would route this through a certified emergency dispatch service.</p>
          </section>
        )}
        <a href="tel:911" className="press press-alert flex min-h-14 items-center justify-center gap-2 rounded-md text-[17px] font-semibold text-white">
          <PhoneIcon /> Call 911 now
        </a>
        {careTeamPhone && (
          <a href={`tel:${careTeamPhone}`} className="tile-3d flex min-h-12 items-center justify-center rounded-md text-[15px] font-semibold text-ink">Call my care team</a>
        )}
        {remote && (
          <button type="button" onClick={() => imOk(counting ? "cancel" : "resolve")} disabled={sent === "sending" || sent === "sent"}
            className="tile-3d flex min-h-14 items-center justify-center gap-2 rounded-md border-2 border-[#3f8a5c] text-[16px] font-semibold text-[#2f5443] disabled:opacity-70">
            <CheckIcon width={18} height={18} />
            {sent === "sent" ? "Sent: the device will stop in a few seconds" : sent === "sending" ? "Sending…" : counting ? "I'm OK, cancel the alarm" : "Everyone's OK, end the alarm"}
          </button>
        )}
        {sent === "failed" && <p role="alert" className="text-[13px] font-semibold text-alert">Couldn&apos;t reach the device. Use the device button instead.</p>}
        {!counting && (
          <p className="well rounded-md p-3 text-[13px] leading-snug text-body">
            <strong className="text-ink">On the device:</strong> hold the button for 3 seconds to end the alarm (a short press only quiets the buzzer). This screen clears a few seconds later.
          </p>
        )}
        {onClose && <button type="button" onClick={onClose} className="min-h-11 text-sm font-semibold text-muted underline">{closeLabel}</button>}
      </div>
    </div>
  );
}

/** A client-only preview of the hard-fall flow, for demos without the device. */
function previewHardFall(p: SteadyPayload): SteadyPayload {
  const t = Date.now() / 1000;
  return {
    ...p,
    alert: { kind: "harsh_fall", t: t - 10, countdown_s: 10, detail: "preview" },
    emergency: { active: true, reason: "harsh_fall", since: t, simulated_911: true, simulated_911_at: t },
  };
}

// ---------------------------------------------------------------- view

export function SteadyView({ initial, initialStale, demo, careTeamPhone }: Props) {
  const [reading, setReading] = useState(initial);
  const [stale, setStale] = useState(initialStale);
  const [previewMode, setPreviewMode] = useState<SteadyMode>("fall_prevention");
  const [preview, setPreview] = useState<SteadyPayload | null>(null);
  const [hiddenAlert, setHiddenAlert] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/steady/latest?mode=${previewMode}`, { cache: "no-store" });
        const data = (await res.json()) as { reading: SteadyReading | null; stale: boolean };
        if (!cancelled) { setReading(data.reading); setStale(data.stale); setNow(Date.now()); }
      } catch { /* keep the last reading */ }
    };
    void load();
    if (demo) return () => { cancelled = true; };
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [demo, previewMode]);

  if (!reading) {
    return (
      <div className="desk px-5">
        <div className="slab rounded-md p-5 text-[14px] text-body">
          <h2 className="text-lg font-semibold text-ink">No Steady wearable connected yet</h2>
          <p className="mt-2">Turn on the Clarah Steady device. Once it&apos;s on Wi-Fi, it sends a reading here every 30 seconds.</p>
        </div>
      </div>
    );
  }

  const p = reading.payload;
  const offsetMs = reading.receivedAt - p.sent_at * 1000;
  const live = !demo && !stale;
  // Each alarm is identified by when it started, so hiding one doesn't hide the next.
  const alertId = p.emergency.since ?? p.alert?.t ?? null;
  const showEmergency = preview ?? ((p.emergency.active || p.alert) && !stale && alertId !== hiddenAlert ? p : null);
  const prosthetic = p.mode === "prosthetic" && p.prosthetic;
  const days = p.daily.map((d) => d.day);

  return (
    <div className="desk flex flex-col gap-6 px-5">
      {showEmergency && (
        <EmergencyScreen
          p={showEmergency}
          offsetMs={preview ? 0 : offsetMs}
          careTeamPhone={careTeamPhone}
          onClose={preview ? () => setPreview(null) : () => setHiddenAlert(alertId)}
          closeLabel={preview ? "Close preview" : "Hide this screen (the alarm stays on)"}
          remote={!preview && !demo}
        />
      )}
      {!showEmergency && !stale && (p.emergency.active || p.alert) && (
        <button type="button" onClick={() => setHiddenAlert(null)} className="flex items-center gap-2 border-l-4 border-alert bg-[#f6dcdc] px-4 py-3 text-left text-[14px] font-semibold text-alert">
          <WarningIcon width={18} height={18} /> The device alarm is still on. Show the alert
        </button>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`clinical-label flex items-center gap-1.5 ${live ? "text-[#2f5443]" : "text-subtle"}`}>
          <span className={`size-2 rounded-full ${live ? "animate-pulse bg-[#3f8a5c]" : "bg-line"}`} />
          {demo ? "Demo data" : stale ? `Device offline · last reading ${ago(now - reading.receivedAt)}` : `Live · updated ${ago(now - reading.receivedAt)}`}
        </span>
        {demo ? (
          <div role="group" aria-label="Mode" className="flex rounded-md border border-line bg-white p-0.5 text-[12px] font-semibold">
            {(["fall_prevention", "prosthetic"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={previewMode === m} onClick={() => setPreviewMode(m)}
                className={`rounded px-3 py-1.5 ${previewMode === m ? "bg-eucalyptus text-white" : "text-muted"}`}>
                {m === "prosthetic" ? "Prosthetic (preview)" : "Fall prevention"}
              </button>
            ))}
          </div>
        ) : (
          <span className="clinical-label text-muted">{p.mode === "prosthetic" ? "Prosthetic mode" : "Fall prevention mode"}</span>
        )}
      </div>

      {prosthetic ? (
        <>
          <section className="slab rounded-md p-5" aria-labelledby="adapt-heading">
            <span className="clinical-label text-teal">Prosthetic adaptation</span>
            <h2 id="adapt-heading" className="mt-1 text-2xl font-semibold">{ADAPTATION_LABEL[prosthetic.adaptation]}</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-body">{prosthetic.adaptation_note}</p>
            {prosthetic.adaptation === "struggling" && (
              <p className="mt-3 border-l-4 border-amber bg-amber-soft px-3 py-2 text-[13px] text-amber-ink">Share this with your prosthetist: the fit or alignment may need adjusting. {WORSENING_ADVICE}</p>
            )}
          </section>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Worn today" value={`${Math.floor(prosthetic.wear_min_today / 60)}h ${prosthetic.wear_min_today % 60}m`} />
            <Tile label="Walking today" value={`${prosthetic.walking_min_today} min`} sub={`${prosthetic.bouts_today} walks · longest ${prosthetic.longest_bout_min} min`} />
            <Tile label="Steadiness" value={`${Math.round(p.balance.smoothed ?? 0)}`} sub={p.balance.baseline != null ? `started at ${Math.round(p.balance.baseline)}` : undefined} />
            <Tile label="Stumbles today" value={`${prosthetic.stumbles_today}`} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="wear-heading">
              <h3 id="wear-heading" className="clinical-label border-b border-line pb-2 text-muted">Hours worn per day</h3>
              <DailyBars values={prosthetic.daily.map((d) => d.wear_min / 60)} days={prosthetic.daily.map((d) => d.day)} max={10} unit="hours worn" color="#3c5a4e" />
            </section>
            <section aria-labelledby="pst-heading">
              <h3 id="pst-heading" className="clinical-label border-b border-line pb-2 text-muted">Steadiness per day</h3>
              <DailyLine values={prosthetic.daily.map((d) => d.score)} days={prosthetic.daily.map((d) => d.day)} reference={p.balance.baseline} referenceLabel="first day" unit="steadiness" color="#2a4fa8" />
            </section>
          </div>
        </>
      ) : (
        <>
          <section className="slab flex flex-wrap items-end justify-between gap-4 rounded-md p-5" aria-labelledby="score-heading">
            <div>
              <span className="clinical-label text-teal">Walking steadiness</span>
              <h2 id="score-heading" className="mt-1 flex items-baseline gap-2">
                <strong className="font-mono text-[44px] leading-none">{p.balance.smoothed != null ? Math.round(p.balance.smoothed) : "–"}</strong>
                <span className="text-[14px] text-muted">/ 100</span>
              </h2>
              {p.balance.baseline != null && <p className="mt-1 text-[13px] text-muted">Your usual: {Math.round(p.balance.baseline)}</p>}
            </div>
            <span className={`rounded-md px-3 py-1.5 text-[13px] font-semibold ${RISK_TINT[p.balance.risk]}`}>{RISK_LABEL[p.balance.risk]}</span>
          </section>

          {(p.balance.risk === "moderate" || p.balance.risk === "high") && (
            <section role="status" className="border-l-4 border-amber bg-amber-soft px-4 py-3 text-[14px] text-amber-ink">
              <strong className="block">Your walking is less steady than usual</strong>
              {(p.warning?.risk === p.balance.risk && p.warning.message.replace(WORSENING_ADVICE, "").trim()) || (p.balance.risk === "high" ? "Please slow down, hold on to something or sit and rest." : "Take it slow, use handrails, and sit down if you feel unsteady.")}
              <strong className="mt-2 block">{WORSENING_ADVICE}</strong>
              {careTeamPhone && <a href={`tel:${careTeamPhone}`} className="mt-2 inline-block font-semibold underline">Call my doctor</a>}
            </section>
          )}

          {p.daily.length > 1 && (
            <section aria-labelledby="trend-heading">
              <h3 id="trend-heading" className="clinical-label border-b border-line pb-2 text-muted">Steadiness, last {p.daily.length} days</h3>
              <DailyLine values={p.daily.map((d) => d.score)} days={days} reference={p.balance.baseline} referenceLabel="your usual" unit="steadiness" color={p.balance.risk === "low" ? "#3c5a4e" : "#a85d0b"} />
            </section>
          )}
        </>
      )}

      {p.motion && p.motion.mag.length > 1 && <LiveMotion motion={p.motion} live={live} />}

      {p.events.length > 0 && (
        <section aria-labelledby="events-heading">
          <h3 id="events-heading" className="clinical-label border-b border-line pb-2 text-muted">Recent activity</h3>
          <ul className="divide-y divide-line">
            {[...p.events].reverse().slice(0, 6).map((e) => (
              <li key={`${e.t}-${e.kind}`} className="flex justify-between gap-3 py-2.5 text-[13px]">
                <span className="text-body">{eventLabel(e.kind, e.detail)}</span>
                <span className="shrink-0 font-mono text-[11px] text-subtle">{ago(now - (e.t * 1000 + offsetMs))}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="well rounded-md p-4 text-[13px] text-body">
        <strong className="text-ink">Falls and emergencies</strong>
        <p className="mt-1">Steady detects falls in every mode. After a fall it counts down 30 seconds, or 10 seconds after a hard fall. With no response it alerts your emergency contact, and after a hard fall it shows a simulated 911 call. Steady can&apos;t call 911 by itself.</p>
        <button type="button" onClick={() => setPreview(previewHardFall(p))} className="mt-3 min-h-11 rounded-md border border-alert px-3 text-[13px] font-semibold text-alert">
          Preview the hard-fall alert
        </button>
      </section>
    </div>
  );
}
