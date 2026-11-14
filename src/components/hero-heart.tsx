"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "./anatomy/lazy-scene";

const HeartScene = dynamic(() => import("./anatomy/heart-scene"), { ssr: false });

export function HeroHeart() {
  const reducedMotion = useReducedMotion();
  return (
    <div className="stage-3d h-[170px] overflow-hidden rounded-[24px]" aria-hidden="true">
      <HeartScene reducedMotion={reducedMotion} />
    </div>
  );
}
