"use client";

import { useState, useSyncExternalStore } from "react";
import type { DocFinding } from "@/lib/documents";
import { addPdf, docStore, removeDoc, type StoredDoc } from "@/lib/doc-store";
import { ChevronIcon, FileIcon, TrashIcon } from "../icons";

const STATUS = {
  attention: { label: "Needs attention", dot: "bg-amber", ring: "border-amber/30 bg-amber-soft" },
  info: { label: "Good to know", dot: "bg-teal", ring: "border-line bg-white" },
  good: { label: "Looks good", dot: "bg-[#6f8a5c]", ring: "border-line bg-white" },
};

const fmtDate = (iso?: string) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

async function trySample() {
  const res = await fetch("/samples/lab-report.pdf");
  await addPdf(await res.blob(), "Sample lab report (synthetic).pdf");
}

function Finding({ f, url }: { f: DocFinding; url?: string }) {
  const s = STATUS[f.status];
  return (
    <li className={`flex flex-col gap-1.5 border p-3 ${s.ring}`}>
      <span className="flex items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
        <span className="text-sm leading-snug font-semibold text-ink">
          <span className="sr-only">{s.label}: </span>
          {f.title}
        </span>
      </span>
      <p className="pl-4 text-[13px] leading-snug text-body">{f.explanation}</p>
      {f.comparison && (
        <p className="pl-4 text-[13px] leading-snug text-muted">
          <span className="font-semibold text-ink">Compared with your history: </span>
          {f.comparison}
        </p>
      )}
      {f.refs.length > 0 && (
        <div className="flex flex-col gap-1 pl-4" aria-label="From your document">
          {f.refs.map((r) => (
            <a
              key={`${r.page}-${r.quote}`}
              href={url ? `${url}#page=${r.page}` : undefined}
              target="_blank"
              rel="noreferrer"
              title={`Open page ${r.page} of the original PDF`}
              className="well flex items-baseline gap-1.5 self-start rounded-lg px-2 py-1 font-mono text-[11px] leading-snug text-muted hover:text-teal-dark"
            >
              <span className="shrink-0 font-sans font-semibold text-teal-dark">p.{r.page}</span>
              <span>&ldquo;{r.quote}&rdquo;</span>
            </a>
          ))}
        </div>
      )}
    </li>
  );
}

function DocCard({ doc, url, defaultOpen }: { doc: StoredDoc; url?: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const s = doc.summary;
  const attention = s?.findings.filter((f) => f.status === "attention").length ?? 0;
  const busy = doc.status === "reading" || doc.status === "summarizing";

  return (
    <article className="slab rise flex flex-col gap-3 rounded-md p-4">
      <div className="flex items-start gap-3">
        <div className="tile-teal flex size-10 shrink-0 items-center justify-center rounded-md text-teal">
          <FileIcon width={20} height={20} />
        </div>
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <h3 className="text-[15px] leading-snug font-semibold">{s?.title ?? doc.name}</h3>
          <span className="truncate text-xs text-subtle">
            {s?.date ? `${fmtDate(s.date)} · ` : ""}
            {doc.name}
          </span>
        </div>
        {s && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? "Hide details" : "Show details"}
            className="tile-3d flex size-9 shrink-0 items-center justify-center rounded-md"
          >
            <ChevronIcon width={18} height={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-subtle" role="status">
          <span className="size-2 animate-pulse rounded-full bg-teal" />
          {doc.status === "reading" ? "Reading your PDF…" : "Clara is comparing this with your history…"}
        </p>
      )}
      {doc.status === "error" && <p className="rounded-xl bg-amber-soft p-3 text-sm text-amber-ink">{doc.error}</p>}

      {s && (
        <>
          <p className="text-sm leading-normal text-body">{s.summary}</p>
          {!open && attention > 0 && (
            <button type="button" onClick={() => setOpen(true)} className="self-start text-[13px] font-semibold text-amber-ink underline">
              {attention} {attention === 1 ? "thing needs" : "things need"} your attention
            </button>
          )}
          {open && (
            <>
              <ul className="flex flex-col gap-2">
                {s.findings.map((f) => (
                  <Finding key={f.title} f={f} url={url} />
                ))}
              </ul>
              {s.questions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">Questions for your doctor</span>
                  <ul className="list-disc pl-5 text-[13px] leading-snug text-body">
                    {s.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {doc.totalPages && doc.pagesRead && doc.pagesRead < doc.totalPages && (
                <p className="text-xs text-subtle">
                  Clara read the first {doc.pagesRead} of {doc.totalPages} pages.
                </p>
              )}
            </>
          )}
        </>
      )}

      {!busy && (
        <div className="flex items-center justify-between border-t border-panel pt-2.5">
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-teal">
              Open original PDF
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => removeDoc(doc.id)}
            className="flex min-h-9 items-center gap-1 text-[13px] text-subtle hover:text-alert"
          >
            <TrashIcon width={14} height={14} /> Delete
          </button>
        </div>
      )}
    </article>
  );
}

export function Documents() {
  const { docs, urls } = useSyncExternalStore(docStore.subscribe, docStore.getSnapshot, docStore.getServerSnapshot);

  return (
    <section id="documents" className="flex scroll-mt-4 flex-col gap-3" aria-labelledby="docs-heading">
      <div className="flex items-end justify-between border-b-2 border-ink pb-2">
        <h2 id="docs-heading" className="text-xl font-semibold">
          Your documents
        </h2>
        <span className="clinical-label text-subtle">Device only</span>
      </div>
      {docs.length === 0 ? (
        <div className="well flex flex-col gap-2 rounded-md p-4">
          <p className="text-sm leading-normal text-body">
            Upload a lab report or visit summary as a PDF. Clara explains it in plain English, compares it with your
            history, and shows exactly where each number came from.
          </p>
          <button type="button" onClick={trySample} className="self-start text-[13px] font-semibold text-teal underline">
            Try a sample lab report
          </button>
        </div>
      ) : (
        docs.map((d, i) => <DocCard key={d.id} doc={d} url={urls[d.id]} defaultOpen={i === 0} />)
      )}
      <p className="text-[11px] leading-snug text-subtle">
        Only the PDF&apos;s text is sent to the AI, with names and ID numbers removed wherever Clara can find them. Clara explains; it doesn&apos;t
        diagnose. Always check with your care team.
      </p>
    </section>
  );
}
