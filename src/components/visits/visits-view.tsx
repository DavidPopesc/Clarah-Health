"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { SAMPLE_VISIT } from "@/lib/sample-visit";
import { removeVisit, saveVisit, visitStore, type StoredVisit } from "@/lib/visit-store";
import type { MedicationChange } from "@/lib/visit-verify";
import { ChevronIcon, MicIcon, TrashIcon } from "../icons";
import { fmtVisitDate, VisitPlayer } from "./player";

const CHANGE = {
  start: { label: "New", className: "border-[#aebde3] bg-teal-soft text-teal-dark" },
  change: { label: "Changed", className: "border-[#e3c899] bg-amber-soft text-amber-ink" },
  stop: { label: "Stop", className: "border-[#e8b4b8] bg-[#f8d7d9] text-alert" },
  continue: { label: "Keep taking", className: "border-[#c3d1bf] bg-[#eaf0e4] text-[#2f5443]" },
} satisfies Record<MedicationChange["change"], { label: string; className: string }>;

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

  return (
    <article className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="clinical-label text-subtle">{fmtVisitDate(recap.date) || "Visit recap"}</span>
        <h2 className="text-xl leading-snug font-semibold lg:text-[26px]">{recap.title}</h2>
        {recap.summary && <p className="text-[14px] leading-normal text-body lg:text-[15px]">{recap.summary}</p>}
      </div>

      <VisitPlayer key={visit.id} id={visit.id} recap={recap} />

      <div className="flex flex-col gap-5 xl:block xl:columns-2 xl:gap-x-6">
      {recap.medicationChanges.length > 0 && (
        <Section title="Your medicines">
          <ul className="flex flex-col gap-2">
            {recap.medicationChanges.map((m) => (
              <li key={m.name} className="slab flex items-start gap-3 rounded-md p-3">
                <span className={`clinical-label shrink-0 border px-1.5 py-1 ${CHANGE[m.change].className}`}>{CHANGE[m.change].label}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">{m.name}</span>
                  <span className="text-[13px] leading-snug text-body">{m.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {recap.nextSteps.length > 0 && (
        <Section title="What to do next">
          <ol className="flex flex-col gap-1.5">
            {recap.nextSteps.map((s, i) => (
              <li key={s} className="flex gap-2.5 text-[14px] leading-snug text-body">
                <span className="font-mono text-[12px] font-semibold text-teal">{String(i + 1).padStart(2, "0")}</span>
                {s}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {recap.watchFor.length > 0 && (
        <div className={`border-l-4 border-amber bg-amber-soft p-3.5 ${COLUMN_ITEM}`}>
          <h3 className="clinical-label mb-1.5 text-amber-ink">Call your care team if</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] leading-snug text-amber-ink">
            {recap.watchFor.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {recap.keyPoints.length > 0 && (
        <Section title="What your care team found">
          <ul className="flex flex-col gap-2">
            {recap.keyPoints.map((p) => (
              <li key={p.title} className="border-l-2 border-sage bg-white px-3 py-2.5">
                <span className="text-[14px] font-semibold">{p.title}</span>
                <p className="mt-0.5 text-[13px] leading-snug text-body">{p.detail}</p>
                {p.fromRecord && (
                  <p className="mt-1 text-[12px] leading-snug text-muted">
                    <span className="font-semibold text-ink">From your record: </span>
                    {p.fromRecord}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {recap.terms.length > 0 && (
        <Section title="Words from your visit">
          <dl className="grid grid-cols-1 gap-2">
            {recap.terms.map((t) => (
              <div key={t.term} className="well rounded-md px-3 py-2">
                <dt className="text-[13px] font-semibold text-ink">{t.term}</dt>
                <dd className="text-[13px] leading-snug text-body">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
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
