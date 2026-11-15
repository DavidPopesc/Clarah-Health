"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { SAMPLE_VISIT } from "@/lib/sample-visit";
import { removeVisit, saveVisit, setStepDone, visitStore, type StoredVisit } from "@/lib/visit-store";
import { toNextStep, type NextStep } from "@/lib/visit-verify";
import { CheckIcon, ChevronIcon, MicIcon, TrashIcon } from "../icons";
import { fmtVisitDate, VisitPlayer } from "./player";

// On desktop the detail sections flow into two balanced columns; each stays in one piece.
const COLUMN_ITEM = "xl:mb-6 xl:break-inside-avoid";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-2 ${COLUMN_ITEM}`}>
      <h3 className="clinical-label border-b border-line pb-1.5 text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Recap({ visit }: { visit: StoredVisit }) {
  const { recap } = visit;
  const [showConversation, setShowConversation] = useState(false);
  const steps = recap.nextSteps.map(toNextStep).filter((s): s is NextStep => s !== null);
  const done = new Set(visit.done ?? []);
  const doneCount = steps.filter((s) => done.has(s.step)).length;

  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="clinical-label text-subtle">{fmtVisitDate(recap.date) || "Visit recap"}</span>
        <h2 className="text-xl leading-snug font-semibold lg:text-[26px]">{recap.title}</h2>
        {recap.summary && <p className="text-[14px] leading-normal text-body lg:text-[15px]">{recap.summary}</p>}
      </div>

      <VisitPlayer key={visit.id} id={visit.id} recap={recap} />

      <div className="flex flex-col gap-5 xl:block xl:columns-2 xl:gap-x-6">
      {steps.length > 0 && (
        <section className={`flex flex-col gap-2 ${COLUMN_ITEM}`}>
          <div className="flex items-center justify-between border-b border-line pb-1.5">
            <h3 className="clinical-label text-muted">What to do next</h3>
            <span className={`clinical-label ${doneCount === steps.length ? "text-[#2f5443]" : "text-subtle"}`} aria-live="polite">
              {doneCount === steps.length ? "All done" : `${doneCount} of ${steps.length} done`}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {steps.map((s) => {
              const isDone = done.has(s.step);
              return (
                <li key={s.step}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    onClick={() => void setStepDone(visit.id, s.step, !isDone)}
                    className={`flex w-full items-start gap-3 rounded-md border-[1.5px] px-3 py-2.5 text-left transition-colors ${
                      isDone ? "border-[#b3c6a6] bg-[#eef4e8]" : "border-line bg-white hover:border-teal hover:bg-[#f6f8fd]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-[2.5px] transition-colors ${
                        isDone ? "border-teal bg-teal text-white" : "border-[#8b98b8] bg-white text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <CheckIcon width={14} height={14} />
                    </span>
                    <span className="flex flex-col gap-0.5 text-[14px] leading-snug">
                      <span className={`font-medium ${isDone ? "text-muted line-through decoration-2" : "text-ink"}`}>{s.step}</span>
                      {s.why && <span className={`text-[13px] text-muted ${isDone ? "line-through" : ""}`}>Why: {s.why}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-subtle">Tap a step to mark it done. Saved on this device.</p>
        </section>
      )}

      {recap.questions.length > 0 && (
        <Section title="Questions you could ask">
          <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-snug text-body">
            {recap.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Section>
      )}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setShowConversation(!showConversation)}
          aria-expanded={showConversation}
          className="flex min-h-9 items-center justify-between text-[13px] font-semibold text-teal"
        >
          Original conversation
          <ChevronIcon width={16} height={16} className={`transition-transform ${showConversation ? "rotate-180" : ""}`} />
        </button>
        {showConversation && (
          <pre className="well max-h-80 overflow-y-auto rounded-md p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-body">{visit.transcript}</pre>
        )}
        <button
          type="button"
          onClick={() => removeVisit(visit.id)}
          className="flex min-h-9 items-center gap-1 self-end text-[13px] text-subtle hover:text-alert"
        >
          <TrashIcon width={14} height={14} /> Delete this recap
        </button>
      </div>
    </article>
  );
}

export function VisitsView() {
  const visits = useSyncExternalStore(visitStore.subscribe, visitStore.getSnapshot, visitStore.getServerSnapshot);
  const [selected, setSelected] = useState<string | null>(null);
  const [sampleState, setSampleState] = useState<"idle" | "busy" | string>("idle");
  const current = visits.find((v) => v.id === selected) ?? visits[0];

  async function trySample() {
    setSampleState("busy");
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: SAMPLE_VISIT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clara couldn't explain the sample visit.");
      const visit = await saveVisit(data.recap, data.transcript);
      setSelected(visit.id);
      setSampleState("idle");
    } catch (err) {
      setSampleState(err instanceof Error ? err.message : "Clara couldn't explain the sample visit.");
    }
  }

  // Phones: one column. Desktop: the recap and player on the left, the list of recaps and the
  // care team's recording link on the right.
  return (
    <div className="desk flex flex-col gap-6 px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-6">
      {current ? (
        <Recap key={current.id} visit={current} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="border-l-4 border-teal bg-white px-4 py-3">
            <span className="clinical-label text-teal">Hear your visit again</span>
            <h2 className="mt-1 text-xl font-semibold">No visit recaps yet</h2>
          </div>
          <p className="text-[14px] leading-normal text-muted">
            When your doctor or nurse records your visit, Clara explains what they said in everyday English, connects it to your health record, and reads it to you. You can replay it any time and read the transcript.
          </p>
          <button
            type="button"
            onClick={trySample}
            disabled={sampleState === "busy"}
            className="press flex min-h-12 items-center justify-center gap-2 rounded-md text-[15px] font-semibold text-white"
          >
            {sampleState === "busy" ? (
              <>
                <span className="size-2 animate-pulse rounded-full bg-white" /> Clara is preparing the sample…
              </>
            ) : (
              "Hear a sample visit"
            )}
          </button>
          {sampleState !== "idle" && sampleState !== "busy" && (
            <p role="alert" className="border-l-4 border-amber bg-amber-soft px-3 py-2.5 text-[13px] text-amber-ink">{sampleState}</p>
          )}
        </div>
      )}
      </div>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-6">
      {visits.length > 1 && (
        <section className="flex flex-col gap-2" aria-labelledby="past-visits">
          <h2 id="past-visits" className="clinical-label border-b border-line pb-2 text-muted">All visit recaps</h2>
          <ul className="divide-y divide-line border border-line bg-white">
            {visits.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(v.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  aria-current={v.id === current?.id || undefined}
                  className={`flex w-full flex-col gap-0.5 px-3.5 py-3 text-left ${v.id === current?.id ? "bg-sage-soft" : "hover:bg-[#fffdf7]"}`}
                >
                  <span className="text-[14px] font-semibold">{v.recap.title}</span>
                  <span className="text-[12px] text-subtle">{fmtVisitDate(v.recap.date) || fmtVisitDate(v.addedAt.slice(0, 10))}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/visits/new" className="tile-3d flex min-h-14 items-center gap-3 rounded-md px-4">
        <MicIcon width={20} height={20} className="shrink-0 text-teal" />
        <span className="flex grow flex-col">
          <span className="text-[14px] font-semibold text-ink">Care team: record a visit</span>
          <span className="text-[12px] text-subtle">For doctors and nurses, with the patient&apos;s consent</span>
        </span>
        <span aria-hidden="true" className="text-teal">→</span>
      </Link>

      <p className="text-[11px] leading-snug text-subtle">
        Clara explains what your care team said; it doesn&apos;t add advice of its own or replace your care team. Recaps are saved only on this device.
      </p>
      </aside>
    </div>
  );
}
