"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// three.js only loads in the browser, and only when a 3D view is on screen.
export const LazyAnatomyScene = dynamic(() => import("./anatomy-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[13px] text-subtle">
      <span className="mr-2 size-2 animate-pulse rounded-full bg-teal" />
      Building 3D model…
    </div>
  ),
});

const query = "(prefers-reduced-motion: reduce)";

export function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
