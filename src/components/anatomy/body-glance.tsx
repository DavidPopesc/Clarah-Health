"use client";

import { useState } from "react";
import type { BodyFocus } from "@/lib/body";
import { CubeIcon } from "../icons";
import { BodyViewer } from "./body-viewer";
import { LazyAnatomyScene, useReducedMotion } from "./lazy-scene";

export interface GlanceSpot {
  focus: BodyFocus;
  metric: string;
}

// Today page card: a slowly turning torso with the organs behind your numbers lit up.
export function BodyGlance({ spots }: { spots: GlanceSpot[] }) {
  const [open, setOpen] = useState<BodyFocus | null>(null);
  const reducedMotion = useReducedMotion();
  if (spots.length === 0) return null;

  return (
    <>
      <div className="flex gap-3">
        <div className="stage-3d h-[200px] w-[44%] shrink-0 overflow-hidden rounded-[16px]" aria-hidden="true">
          <LazyAnatomyScene
            system="organs"
            highlights={spots.map((s) => s.focus)}
            frame="torso"
            interactive={false}
            reducedMotion={reducedMotion}
          />
        </div>
        <ul className="flex grow flex-col justify-center gap-2">
          {spots.map((s) => (
            <li key={s.focus.region}>
              <button
                type="button"
                onClick={() => setOpen(s.focus)}
                className="tile-3d flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left"
              >
                <span className="flex grow flex-col">
                  <span className="text-[13px] font-semibold">{s.focus.label}</span>
                  <span className="text-[11px] leading-tight text-subtle">{s.metric}</span>
                </span>
                <CubeIcon width={16} height={16} className="shrink-0 text-teal" />
              </button>
            </li>
          ))}
        </ul>
      </div>
      {open && <BodyViewer focus={open} onClose={() => setOpen(null)} />}
    </>
  );
}
