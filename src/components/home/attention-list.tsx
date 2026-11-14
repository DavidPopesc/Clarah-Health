"use client";

import Link from "next/link";
import { useState } from "react";
import type { BodyFocus } from "@/lib/body";
import type { AttentionItem } from "@/lib/attention";
import { BodyViewer } from "../anatomy/body-viewer";
import { ChatIcon, CubeIcon } from "../icons";

const LEVEL = {
  urgent: { label: "Act now", rail: "border-l-alert", text: "text-alert" },
  attention: { label: "Needs attention", rail: "border-l-amber", text: "text-amber-ink" },
  watch: { label: "Monitor", rail: "border-l-[#d39425]", text: "text-amber-ink" },
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const [viewer, setViewer] = useState<BodyFocus | null>(null);

  if (items.length === 0) {
    return <p className="border border-line bg-white p-4 text-sm text-body">Nothing in your record needs attention right now. Upload a new lab report or visit summary to keep this up to date.</p>;
  }

  return (
    <>
      <ol className="flex flex-col gap-2.5">
        {items.map((item, index) => {
          const level = LEVEL[item.level];
          return (
            <li key={item.id}>
              <article className={`border border-line border-l-4 bg-white ${level.rail}`}>
                <div className="flex gap-3 p-4">
                  <span className="font-mono text-[12px] font-semibold text-subtle">{String(index + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 grow">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className={`clinical-label ${level.text}`}>{level.label}</span>
                      <span className="font-mono text-[10px] text-subtle">{item.source}</span>
                    </div>
                    <h3 className="text-[17px] leading-snug font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-normal text-body">{item.detail}</p>
                  </div>
                </div>

                <dl className="grid border-y border-line bg-[#f6eadc] text-[13px] leading-snug sm:grid-cols-2">
                  <div className="border-b border-line p-3 sm:border-r sm:border-b-0">
                    <dt className="clinical-label mb-1 text-muted">Why it matters</dt>
                    <dd className="text-body">{item.why}</dd>
                  </div>
                  <div className="p-3">
                    <dt className="clinical-label mb-1 text-muted">Recommended next step</dt>
                    <dd className="text-body">{item.todo}</dd>
                  </div>
                </dl>

                <div className="flex divide-x divide-line">
                  <Link href={`/ask?q=${encodeURIComponent(item.ask)}`} className="flex min-h-12 flex-1 items-center justify-center gap-2 text-[13px] font-semibold text-teal hover:bg-teal-soft">
                    <ChatIcon width={16} height={16} /> Ask Clara
                  </Link>
                  {item.focus && (
                    <button type="button" onClick={() => setViewer(item.focus!)} className="flex min-h-12 flex-1 items-center justify-center gap-2 text-[13px] font-semibold text-teal hover:bg-teal-soft">
                      <CubeIcon width={16} height={16} /> View anatomy
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ol>
      {viewer && <BodyViewer focus={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
