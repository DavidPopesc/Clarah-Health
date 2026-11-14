"use client";

import Link from "next/link";
import { useState } from "react";
import type { BodyFocus } from "@/lib/body";
import type { AttentionItem } from "@/lib/attention";
import { BodyViewer } from "../anatomy/body-viewer";
import { ChatIcon, CubeIcon } from "../icons";
import { Tilt } from "../tilt";

const LEVEL = {
  urgent: { label: "Act now", dot: "bg-alert", text: "text-alert" },
  attention: { label: "Needs attention", dot: "bg-amber", text: "text-amber-ink" },
  watch: { label: "Keep an eye on", dot: "bg-[#c99a2e]", text: "text-amber-ink" },
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const [viewer, setViewer] = useState<BodyFocus | null>(null);

  if (items.length === 0) {
    return (
      <p className="slab rounded-[18px] p-4 text-sm text-body">
        Nothing in your record needs attention right now. Upload a new lab report or visit summary to keep this up to date.
      </p>
    );
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {items.map((item, i) => {
          const level = LEVEL[item.level];
          return (
            <li key={item.id}>
              <Tilt className="rise rounded-[18px]" max={3} order={i + 1}>
                <article className="slab flex flex-col gap-2.5 rounded-[18px] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase ${level.text}`}>
                      <span className={`size-2 rounded-full ${level.dot}`} aria-hidden="true" />
                      {level.label}
                    </span>
                    <span className="text-[11px] text-subtle">{item.source}</span>
                  </div>
                  <h3 className="font-display text-[17px] leading-snug font-semibold">{item.title}</h3>
                  <p className="text-sm leading-normal text-body">{item.detail}</p>
                  <dl className="well flex flex-col gap-1.5 rounded-xl p-3 text-[13px] leading-snug">
                    <div>
                      <dt className="inline font-semibold text-ink">Why it matters: </dt>
                      <dd className="inline text-body">{item.why}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold text-ink">What to do: </dt>
                      <dd className="inline text-body">{item.todo}</dd>
                    </div>
                  </dl>
                  <div className="flex gap-2">
                    <Link
                      href={`/ask?q=${encodeURIComponent(item.ask)}`}
                      className="tile-3d flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-teal"
                    >
                      <ChatIcon width={15} height={15} /> Ask Clara
                    </Link>
                    {item.focus && (
                      <button
                        type="button"
                        onClick={() => setViewer(item.focus!)}
                        className="tile-3d flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-teal"
                      >
                        <CubeIcon width={15} height={15} /> See in 3D
                      </button>
                    )}
                  </div>
                </article>
              </Tilt>
            </li>
          );
        })}
      </ul>
      {viewer && <BodyViewer focus={viewer} onClose={() => setViewer(null)} />}
    </>
  );
}
