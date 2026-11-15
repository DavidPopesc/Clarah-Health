"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import type { BodyFocus } from "@/lib/body";
import { docStore } from "@/lib/doc-store";
import type { DocFinding } from "@/lib/documents";
import {
  classifyDocumentFinding,
  createDocumentOnlyTheme,
  summarizeProgress,
  type AttentionItem,
  type HealthTheme,
  type HealthThemeId,
} from "@/lib/attention";
import { BodyViewer } from "../anatomy/body-viewer";
import { ChatIcon, ChevronIcon, CubeIcon, FileIcon } from "../icons";
import { MetricRow, ProgressBadge } from "./result-progress";

const LEVEL = {
  urgent: { label: "Act now", rail: "border-l-alert", text: "text-alert", badge: "bg-[#f8d7d9] text-alert" },
  attention: { label: "Review with care team", rail: "border-l-amber", text: "text-amber-ink" },
  watch: { label: "Ongoing care", rail: "border-l-teal", text: "text-teal-dark" },
};

const DOCUMENT_SUBISSUE_TITLES: Record<string, string> = {
  bp: "Blood pressure",
  a1c: "Blood sugar",
  hypo: "Low blood sugar safety",
  ldl: "Cholesterol",
  rhr: "Heart rate",
  egfr: "Kidney findings",
  sleep: "Sleep",
  adhd: "ADHD",
  "mental-health": "Mental health",
  cancer: "Cancer care",
  pregnancy: "Pregnancy",
  gdm: "Gestational diabetes",
  hemoglobin: "Blood counts",
  anc: "White blood cells",
};

interface DocumentEvidence {
  id: string;
  themeId: HealthThemeId;
  itemId?: string;
  docTitle: string;
  docDate?: string;
  url?: string;
  finding: DocFinding;
}

function DocumentFindingRow({ evidence }: { evidence: DocumentEvidence }) {
  const ref = evidence.finding.refs[0];
  const href = evidence.url && ref ? `${evidence.url}#page=${ref.page}` : evidence.url;
  return (
    <li className="border-l-2 border-teal bg-[#fffdf7] px-3 py-2.5">
      <div className="flex items-start gap-2">
        <FileIcon width={15} height={15} className="mt-0.5 shrink-0 text-teal" />
        <div className="min-w-0 grow">
          <p className="text-[13px] font-semibold text-ink">{evidence.finding.title}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-body">{evidence.finding.explanation}</p>
          {evidence.finding.comparison && <p className="mt-1 text-[12px] leading-relaxed text-muted">{evidence.finding.comparison}</p>}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] text-subtle">{evidence.docTitle}{evidence.docDate ? ` · ${evidence.docDate}` : ""}</span>
            {href && (
              <a href={href} target="_blank" rel="noreferrer" className="shrink-0 text-[11px] font-semibold text-teal underline underline-offset-2">
                {ref ? `Source · p.${ref.page}` : "Open document"}
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function EvidenceList({ item, documents }: { item: AttentionItem; documents: DocumentEvidence[] }) {
  return (
    <div className="border-y border-line bg-sage-soft">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="clinical-label text-muted">Evidence in your record</span>
        <span className="font-mono text-[10px] text-subtle">{item.evidence.length + documents.length} source{item.evidence.length + documents.length === 1 ? "" : "s"}</span>
      </div>
      <ul className="divide-y divide-line px-3">
        {item.evidence.map((evidence) => (
          <li key={evidence.id} className="grid grid-cols-[1fr_auto] gap-3 py-2.5 text-[12px]">
            <span><strong className="block text-ink">{evidence.label}</strong><span className="text-subtle">{evidence.source}</span></span>
            <span className="self-center text-right font-mono font-semibold text-body">{evidence.value}</span>
          </li>
        ))}
      </ul>
      {documents.length > 0 && <ul className="flex flex-col gap-2 border-t border-line p-3">{documents.map((evidence) => <DocumentFindingRow key={evidence.id} evidence={evidence} />)}</ul>}
    </div>
  );
}

function ConcernCard({ item, documents, onView }: { item: AttentionItem; documents: DocumentEvidence[]; onView: (focus: BodyFocus) => void }) {
  const level = LEVEL[item.level];
  const hasDocumentComparison = documents.some((document) => document.finding.comparison);
  return (
    <article className={`border border-line border-l-4 bg-white ${level.rail}`}>
      <div className="p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <ProgressBadge direction={item.progress?.direction ?? "unknown"} label={item.progress?.label ?? (hasDocumentComparison ? "Comparison in notes" : "New")} />
          <span className={`text-[10px] font-semibold ${level.text}`}>{level.label}</span>
        </div>
        <h3 className="text-[16px] leading-snug font-semibold">{item.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-body">{item.detail}</p>
        {item.progress ? <div className="mt-3"><MetricRow progress={item.progress} context={item} /></div> : <p className="mt-2 text-[11px] text-subtle">{hasDocumentComparison ? "See the document comparison below." : "First time this shows up in your record. Clarah will show how it changed after your next visit or test."}</p>}
      </div>
      <EvidenceList item={item} documents={documents} />
      <dl className="grid text-[12px] leading-relaxed sm:grid-cols-2">
        <div className="border-b border-line p-3 sm:border-r sm:border-b-0"><dt className="clinical-label mb-1 text-muted">Why it matters</dt><dd className="text-body">{item.why}</dd></div>
        <div className="p-3"><dt className="clinical-label mb-1 text-muted">What to do</dt><dd className="text-body">{item.todo}</dd></div>
      </dl>
      <div className="flex border-t border-line divide-x divide-line">
        <Link href={`/ask?q=${encodeURIComponent(item.ask)}`} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-[12px] font-semibold text-teal hover:bg-teal-soft">
          <ChatIcon width={15} height={15} /> Ask Clarah
        </Link>
        {item.focus && (
          <button type="button" onClick={() => onView(item.focus!)} className="flex min-h-11 flex-1 items-center justify-center gap-2 text-[12px] font-semibold text-teal hover:bg-teal-soft">
            <CubeIcon width={15} height={15} /> View anatomy
          </button>
        )}
      </div>
    </article>
  );
}

function DocumentOnlyConcern({ itemId, documents }: { itemId: string; documents: DocumentEvidence[] }) {
  return (
    <article className="border border-line border-l-4 border-l-teal bg-white">
      <div className="p-3.5">
        <span className="clinical-label text-teal-dark">From an uploaded document</span>
        <h3 className="mt-1 text-[16px] font-semibold">{DOCUMENT_SUBISSUE_TITLES[itemId] ?? "Related finding"}</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">This topic came from a lab report or clinician note and is grouped here with related health information.</p>
      </div>
      <ul className="flex flex-col gap-2 border-t border-line bg-sage-soft p-3">{documents.map((evidence) => <DocumentFindingRow key={evidence.id} evidence={evidence} />)}</ul>
    </article>
  );
}

export function AttentionList({ themes }: { themes: HealthTheme[] }) {
  const [viewer, setViewer] = useState<BodyFocus | null>(null);
  const [openTheme, setOpenTheme] = useState<HealthThemeId | null>(null);
  const { docs, urls } = useSyncExternalStore(docStore.subscribe, docStore.getSnapshot, docStore.getServerSnapshot);

  const documentEvidence = useMemo(() => docs.flatMap((doc) => {
    if (doc.status !== "ready" || !doc.summary) return [];
    return doc.summary.findings.flatMap((finding, index) => {
      const match = classifyDocumentFinding(finding);
      if (!match) return [];
      return [{ id: `${doc.id}-${index}`, ...match, docTitle: doc.summary!.title, docDate: doc.summary!.date, url: urls[doc.id], finding } satisfies DocumentEvidence];
    });
  }), [docs, urls]);

  const displayThemes = useMemo(() => {
    const byId = new Map(themes.map((theme) => [theme.id, theme]));
    for (const evidence of documentEvidence) {
      if (!byId.has(evidence.themeId)) byId.set(evidence.themeId, createDocumentOnlyTheme(evidence.themeId));
    }
    return [...byId.values()];
  }, [themes, documentEvidence]);

  if (displayThemes.length === 0) {
    return <p className="border border-line bg-white p-4 text-sm text-body">Nothing in your record needs attention right now. Upload a new lab report or visit summary to keep this up to date.</p>;
  }

  const themeIds = new Set(displayThemes.map((theme) => theme.id));

  function openRelated(themeId: HealthThemeId) {
    if (!themeIds.has(themeId)) return;
    setOpenTheme(themeId);
    requestAnimationFrame(() => document.getElementById(`health-theme-${themeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {displayThemes.map((theme, index) => {
          const level = LEVEL[theme.level];
          const progress = summarizeProgress(theme.items);
          const isOpen = openTheme === theme.id;
          const themeDocuments = documentEvidence.filter((evidence) => evidence.themeId === theme.id);
          const progressLabel = progress.direction === "unknown" && themeDocuments.some((document) => document.finding.comparison) ? "Comparison in notes" : progress.label;
          const itemIds = new Set(theme.items.map((item) => item.id));
          const documentOnlyGroups = new Map<string, DocumentEvidence[]>();
          for (const evidence of themeDocuments) {
            if (!evidence.itemId || itemIds.has(evidence.itemId)) continue;
            documentOnlyGroups.set(evidence.itemId, [...(documentOnlyGroups.get(evidence.itemId) ?? []), evidence]);
          }
          const ungroupedDocuments = themeDocuments.filter((evidence) => !evidence.itemId);
          const subissueCount = theme.items.length + documentOnlyGroups.size;
          return (
            <li key={theme.id} id={`health-theme-${theme.id}`} className="scroll-mt-4">
              <article className={`border border-line border-l-4 bg-white ${level.rail}`}>
                <button type="button" onClick={() => setOpenTheme(isOpen ? null : theme.id)} aria-expanded={isOpen} aria-controls={`health-theme-details-${theme.id}`} className="flex w-full items-start gap-3 p-4 text-left hover:bg-[#fffdf7]">
                  <span className="font-mono text-[12px] font-semibold text-subtle">{String(index + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 grow">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <ProgressBadge direction={progress.direction} label={progressLabel} />
                      {theme.level === "urgent" && <span className="clinical-label text-alert">Act now</span>}
                      <span className="font-mono text-[10px] text-subtle">{subissueCount} topic{subissueCount === 1 ? "" : "s"}</span>
                    </span>
                    <strong className="mt-1.5 block text-[18px] leading-tight text-ink">{theme.title}</strong>
                    <span className="mt-1.5 block text-[13px] leading-relaxed text-body">{theme.description}</span>
                  </span>
                  <span className="tile-3d flex size-9 shrink-0 items-center justify-center rounded-md text-teal"><ChevronIcon width={17} height={17} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} /></span>
                </button>

                {theme.items.some((item) => item.progress) && (
                  <div className="mx-4 mb-3 ml-11 flex flex-col divide-y divide-line border-t border-line">
                    <span className="pt-2 text-[10px] text-subtle">Since your last visit · tap a result to learn more</span>
                    {theme.items.flatMap((item) => item.progress ? [<MetricRow key={item.id} progress={item.progress} context={item} compact />] : [])}
                  </div>
                )}

                {theme.relationships.length > 0 && (
                  <div className="mx-4 mb-4 ml-11 flex flex-wrap gap-1.5">
                    {theme.relationships.slice(0, 3).map((relationship) => (
                      <span key={`${theme.id}-${relationship.themeId}`} className="border border-[#aebde3] bg-teal-soft px-2 py-1 text-[10px] font-semibold text-teal-dark">Related: {relationship.label}</span>
                    ))}
                  </div>
                )}

                {isOpen && (
                  <div id={`health-theme-details-${theme.id}`} className="border-t border-line bg-ground p-3.5">
                    <div className="mb-3 border-l-2 border-teal bg-white px-3 py-2.5">
                      <span className="clinical-label text-teal">Overall plan</span>
                      <p className="mt-1 text-[13px] leading-relaxed text-body">{theme.action}</p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {theme.items.map((item) => (
                        <ConcernCard key={item.id} item={item} documents={themeDocuments.filter((evidence) => evidence.itemId === item.id)} onView={setViewer} />
                      ))}
                      {[...documentOnlyGroups.entries()].map(([itemId, evidence]) => <DocumentOnlyConcern key={itemId} itemId={itemId} documents={evidence} />)}
                      {ungroupedDocuments.length > 0 && (
                        <div className="border border-line bg-white p-3">
                          <span className="clinical-label text-muted">Other related notes</span>
                          <ul className="mt-2 flex flex-col gap-2">{ungroupedDocuments.map((evidence) => <DocumentFindingRow key={evidence.id} evidence={evidence} />)}</ul>
                        </div>
                      )}
                    </div>

                    {theme.relationships.length > 0 && (
                      <div className="mt-3 border-t border-line pt-3">
                        <span className="clinical-label text-muted">How this connects</span>
                        <ul className="mt-2 flex flex-col gap-2">
                          {theme.relationships.map((relationship) => (
                            <li key={`${theme.id}-detail-${relationship.themeId}`} className="grid grid-cols-[auto_1fr] gap-2 text-[12px] leading-relaxed text-body">
                              {themeIds.has(relationship.themeId) ? (
                                <button type="button" onClick={() => openRelated(relationship.themeId)} className="min-h-8 border border-teal px-2 font-semibold text-teal">{relationship.label}</button>
                              ) : (
                                <span className="flex min-h-8 items-center border border-line px-2 font-semibold text-muted">{relationship.label}</span>
                              )}
                              <span className="self-center">{relationship.note}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[10px] leading-relaxed text-subtle">Related does not mean one issue caused another. Clarah only groups confirmed findings and commonly connected care areas.</p>
                      </div>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      {viewer && <BodyViewer focus={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
