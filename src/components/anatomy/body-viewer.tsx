"use client";

import { useEffect, useRef, useState } from "react";
import { BODY_SYSTEMS, SYSTEM_LABELS, type BodyFocus, type BodySystem } from "@/lib/body";
import { CloseIcon } from "../icons";
import { LazyAnatomyScene, useReducedMotion } from "./lazy-scene";

export function BodyViewer({ focus, onClose }: { focus: BodyFocus; onClose: () => void }) {
  const [system, setSystem] = useState<BodySystem>(focus.system);
  const reducedMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-ink/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="body-viewer-title"
        aria-describedby="body-viewer-desc"
        onClick={(e) => e.stopPropagation()}
        className="sheet-3d mt-auto flex h-[82dvh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-20px_60px_-20px_rgba(10,79,73,0.5)]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold tracking-wide text-teal uppercase">3D body view</span>
            <h2 id="body-viewer-title" className="font-display text-[22px] leading-tight font-semibold">
              {focus.label}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close 3D view"
            className="tile-3d flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div className="stage-3d relative mx-4 grow overflow-hidden rounded-[22px]">
          <LazyAnatomyScene system={system} focus={focus} reducedMotion={reducedMotion} />
          <span className="pointer-events-none absolute bottom-2.5 left-0 w-full text-center text-[11px] text-subtle">
            Drag to turn · pinch to zoom
          </span>
        </div>

        <div className="flex flex-col gap-3 px-5 pt-3 pb-7">
          <div role="radiogroup" aria-label="Body system" className="flex gap-1.5 overflow-x-auto pb-1">
            {BODY_SYSTEMS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === system}
                onClick={() => setSystem(s)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-[12px] font-semibold transition-transform ${
                  s === system ? "press text-white" : "tile-3d text-muted"
                }`}
              >
                {SYSTEM_LABELS[s]}
              </button>
            ))}
          </div>
          <p id="body-viewer-desc" className="text-[13px] leading-snug text-body">
            <span className="font-semibold text-ink">{SYSTEM_LABELS[system]}</span>
            {focus.reason ? ` · ${focus.reason}` : ` · Highlighted in orange on the model.`}
          </p>
          <p className="text-[11px] leading-snug text-subtle">
            A simplified model to help you picture where this is. It isn&apos;t an image of your body.
          </p>
        </div>
      </div>
    </div>
  );
}
