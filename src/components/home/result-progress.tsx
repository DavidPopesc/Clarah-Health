"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ResultProgress } from "@/lib/attention";
import { METRIC_INFO, changeSentence, gapFromGoal, partInfo, percentChange, type MetricKey } from "@/lib/metrics";
import { ChatIcon, ChevronIcon } from "../icons";

const STYLES = {
  improving: "border-[#b9cddd] bg-[#edf3f8] text-[#27516e]",
  worsening: "border-[#e3c899] bg-amber-soft text-amber-ink",
  mixed: "border-[#e3c899] bg-amber-soft text-amber-ink",
  unchanged: "border-line bg-[#f6eadc] text-muted",
  unknown: "border-line bg-[#fffaf2] text-subtle",
};

const SYMBOLS = { improving: "↗", worsening: "!", mixed: "↔", unchanged: "→", unknown: "★" };
const TONE = { improving: "text-[#27516e]", worsening: "text-amber-ink", mixed: "text-amber-ink", unchanged: "text-muted" };

export function ProgressBadge({ direction, label }: { direction: keyof typeof STYLES; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[11px] leading-tight font-semibold ${STYLES[direction]}`}>
      <span aria-hidden="true">{SYMBOLS[direction]}</span>{label}
    </span>
  );
}

const dateLabel = (date: string, year = true) => new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });

export interface MetricContext {
  why?: string;
  todo?: string;
  ask?: string;
}

/** A tappable plain-language summary of one result that opens a detailed explanation. */
export function MetricRow({ progress, context, compact = false }: { progress: ResultProgress; context?: MetricContext; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const info = METRIC_INFO[progress.key];
  const current = progress.parts.map((part) => part.current);
  const arrow = progress.parts[0].current > progress.parts[0].previous ? "↑" : progress.parts[0].current < progress.parts[0].previous ? "↓" : "→";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`group grid w-full grid-cols-[1fr_auto] items-center gap-x-3 text-left hover:bg-[#fffaf2] ${compact ? "py-2" : "border border-line bg-white px-3 py-2.5"}`}>
        <span className="min-w-0">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-semibold text-ink">{info.name}</span>
            <span className="font-mono text-[13px] font-semibold text-ink">{info.format(current)}</span>
          </span>
          <span className={`mt-0.5 block text-[12px] font-medium ${TONE[progress.direction]}`}>
            <span aria-hidden="true">{arrow} </span>{changeSentence(progress.key, progress.parts)}
          </span>
          <MiniBar metric={progress.key} previous={progress.parts[0].previous} current={progress.parts[0].current} />
        </span>
        <span className="flex items-center gap-0.5 text-[11px] font-semibold text-teal">
          <span className="sr-only sm:not-sr-only">Details</span>
          <ChevronIcon width={14} height={14} className="-rotate-90" />
        </span>
      </button>
      {open && <MetricSheet progress={progress} context={context} onClose={() => setOpen(false)} />}
    </>
  );
}

function scaleGeometry(metric: MetricKey, index: number, previous: number, current: number) {
  const part = partInfo(metric, index);
  // Lay the scale out so "better" is always on the left: flip metrics where higher is healthier.
  const flip = part.healthy === "above" ? -1 : 1;
  const [limit, warn, prev, cur] = [part.limit, part.warn, previous, current].map((value) => value * flip);
  const span = Math.max(warn - limit, Math.abs(cur - limit), Math.abs(prev - limit));
  const lo = Math.min(limit - span * 0.6, prev - span * 0.15, cur - span * 0.15);
  const hi = Math.max(warn + span * 0.45, prev + span * 0.15, cur + span * 0.15);
  const pct = (value: number) => Math.min(Math.max(((value - lo) / (hi - lo)) * 100, 0), 100);
  const at = (value: number) => `${pct(value)}%`;
  return { part, limit, warn, prev, cur, pct, at };
}

/** Compact goal → high line for the summary row: green goal end, red high end, ○ previous, ● latest. */
function MiniBar({ metric, previous, current }: { metric: MetricKey; previous: number; current: number }) {
  const { limit, warn, prev, cur, pct, at } = scaleGeometry(metric, 0, previous, current);
  return (
    <span className="relative mt-2.5 mb-1 block h-3.5" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink" />
      <span className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#4f9a4f]" style={{ width: at(limit) }} />
      <span className="absolute top-1/2 right-0 h-[3px] -translate-y-1/2 rounded-full bg-[#d24a3f]" style={{ width: `${100 - pct(warn)}%` }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#8d939a] bg-[#d9dde1]" style={{ left: at(prev) }} />
      <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: at(cur) }} />
    </span>
  );
}

function ScaleBar({ metric, index, previous, current }: { metric: MetricKey; index: number; previous: number; current: number }) {
  const { part, limit, warn, prev, cur, pct, at } = scaleGeometry(metric, index, previous, current);
  const highLabel = part.healthy === "below" ? "High" : "Low";
  const fmt = (value: number) => (metric === "a1c" ? `${value}%` : `${value}`);
  return (
    <div className="mt-3" role="img" aria-label={`Previous ${fmt(previous)}, latest ${fmt(current)}. Goal is ${part.healthy === "below" ? "under" : "at least"} ${part.limit}; ${highLabel.toLowerCase()} past ${part.warn}.`}>
      <div className="relative h-5 text-[10px] font-semibold text-ink">
        <span className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap" style={{ left: at(cur) }}>Latest · {fmt(current)}<span className="h-1.5 w-px bg-ink" /></span>
      </div>
      <div className="relative flex h-7 overflow-hidden rounded-md border-2 border-ink bg-white text-[11px] font-semibold">
        <div className="flex items-center justify-center border-r-2 border-ink bg-[#cfe8cf] text-[#2f5d34]" style={{ width: at(limit) }}>Goal</div>
        <div className="grow" />
        <div className="flex items-center justify-center border-l-2 border-ink bg-[#f6cfcf] text-[#8a2a2a]" style={{ width: `${100 - pct(warn)}%` }}>{highLabel}</div>
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-white" style={{ left: at(prev) }} />
        <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" style={{ left: at(cur) }} />
      </div>
      <div className="relative h-5 text-[10px] text-muted">
        <span className="absolute top-0 flex -translate-x-1/2 flex-col items-center whitespace-nowrap" style={{ left: at(prev) }}><span className="h-1.5 w-px bg-muted" />Previous · {fmt(previous)}</span>
      </div>
    </div>
  );
}

function MetricSheet({ progress, context, onClose }: { progress: ResultProgress; context?: MetricContext; onClose: () => void }) {
  const info = METRIC_INFO[progress.key];
  const current = progress.parts.map((part) => part.current);
  const previous = progress.parts.map((part) => part.previous);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="metric-sheet-title" onClick={(event) => event.stopPropagation()} className="max-h-[88vh] w-full max-w-md overflow-y-auto border-t-4 border-teal bg-[#fffaf2] sm:border">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-[#fffaf2] px-4 py-3">
          <div>
            <h2 id="metric-sheet-title" className="text-[18px] leading-tight font-semibold text-ink">{info.name}</h2>
            <p className="mt-0.5 text-[11px] text-subtle">Medical name: {info.medicalName}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-9 border border-line px-3 text-[12px] font-semibold text-teal">Close</button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 text-[13px] leading-relaxed text-body">
          <section>
            <h3 className="clinical-label mb-1 text-muted">What this measures</h3>
            <p>{info.what}</p>
          </section>

          <section className="border border-line bg-white">
            <div className="grid grid-cols-2 divide-x divide-line">
              <div className="p-3">
                <p className="text-[11px] text-subtle">Previous · {dateLabel(progress.previousDate)}</p>
                <p className="mt-1 font-mono text-[18px] text-muted">{info.format(previous)}</p>
                <p className="text-[11px] text-subtle">{info.category(previous)}</p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-subtle">Latest · {dateLabel(progress.currentDate)}</p>
                <p className="mt-1 font-mono text-[18px] font-semibold text-ink">{info.format(current)}</p>
                <p className="text-[11px] font-semibold text-ink">{info.category(current)}</p>
              </div>
            </div>
            <div className="border-t border-line px-3 py-2">
              <ProgressBadge direction={progress.direction} label={progress.label} />
            </div>
          </section>

          <section>
            <h3 className="clinical-label mb-2 text-muted">How much it changed</h3>
            <ul className="flex flex-col gap-3">
              {progress.parts.map((part, index) => {
                const meta = partInfo(progress.key, index);
                const diff = Math.round((part.current - part.previous) * 10) / 10;
                const pct = percentChange(part.previous, part.current);
                const gapNow = gapFromGoal(part.current, meta);
                const gapBefore = gapFromGoal(part.previous, meta);
                const unit = progress.key === "a1c" ? "%" : "";
                const goal = `${meta.healthy === "below" ? "under" : "at least"} ${meta.limit}${unit}`;
                const offWord = meta.healthy === "below" ? "over" : "under";
                return (
                  <li key={part.label} className="border border-line bg-white p-3">
                    <p className="font-semibold text-ink">{meta.label}{progress.parts.length > 1 && <span className="font-normal text-subtle"> ({meta.plain})</span>}</p>
                    <p className="mt-0.5">
                      {diff === 0
                        ? <>Stayed the same at {part.current}{unit}.</>
                        : <>Went {diff > 0 ? "up" : "down"} from {part.previous}{unit} to {part.current}{unit}{pct !== 0 && <> — <strong>{Math.abs(pct)}% {diff > 0 ? "higher" : "lower"}</strong></>}.</>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Goal: {goal}. {gapNow === 0
                        ? "You're within goal."
                        : `You're ${gapNow}${unit} ${offWord} goal${gapBefore !== gapNow ? ` (last time: ${gapBefore === 0 ? "within goal" : `${gapBefore}${unit} ${offWord}`})` : ""}.`}
                    </p>
                    <ScaleBar metric={progress.key} index={index} previous={part.previous} current={part.current} />
                  </li>
                );
              })}
            </ul>
          </section>

          {context?.why && (
            <section>
              <h3 className="clinical-label mb-1 text-muted">Why it matters</h3>
              <p>{context.why}</p>
            </section>
          )}
          {context?.todo && (
            <section className="border-l-2 border-teal bg-white px-3 py-2.5">
              <h3 className="clinical-label mb-1 text-teal">What to do</h3>
              <p>{context.todo}</p>
            </section>
          )}

          <p className="text-[11px] text-subtle">Goals shown are common targets. Your care team may set a different goal for you.</p>

          <Link href={`/ask?q=${encodeURIComponent(context?.ask ?? `Explain my ${info.name.toLowerCase()} results and how they changed.`)}`} className="flex min-h-11 items-center justify-center gap-2 border border-teal text-[13px] font-semibold text-teal hover:bg-teal-soft">
            <ChatIcon width={15} height={15} /> Ask Clara about this
          </Link>
        </div>
      </div>
    </div>
  );
}
