import { BODY_REGIONS, type BodyFocus } from "@/lib/body";
import { ANCHORS } from "./anchors.generated";

// The body is BodyParts3D anatomy, built into public/anatomy/body.glb by scripts/build-anatomy.mjs.
// Units are meters, feet at y=0, facing +z. The patient's left side is +x.

export const MODEL_URL = "/anatomy/body.glb";
export const ATTRIBUTION = "Anatomy: BodyParts3D, © The Database Center for Life Science, CC BY 4.0";

export type V = [number, number, number];

interface View {
  p: V;
  dist: number;
  dir: V;
}

// How far the camera sits from each region, and the side it looks from.
const UNPAIRED: Record<string, { dist: number; dir?: V }> = {
  head: { dist: 0.85 },
  brain: { dist: 0.75, dir: [0.7, 0.3, 1] },
  neck: { dist: 0.8 },
  chest: { dist: 1.0 },
  heart: { dist: 0.75 },
  lungs: { dist: 0.95 },
  back: { dist: 1.0, dir: [0.35, 0.15, -1] },
  abdomen: { dist: 0.95 },
  stomach: { dist: 0.75 },
  liver: { dist: 0.75 },
  pancreas: { dist: 0.7 },
  kidneys: { dist: 0.8, dir: [0.3, 0.15, -1] },
};

const PAIRED: Record<string, (sx: number) => { dist: number; dir: V }> = {
  shoulder: (sx) => ({ dist: 0.75, dir: [sx * 0.7, 0.2, 1] }),
  elbow: (sx) => ({ dist: 0.65, dir: [sx * 0.8, 0.15, 1] }),
  wrist: (sx) => ({ dist: 0.55, dir: [sx * 0.8, 0.15, 1] }),
  hand: (sx) => ({ dist: 0.55, dir: [sx * 1, 0.1, 0.6] }),
  hip: (sx) => ({ dist: 0.85, dir: [sx * 0.6, 0.15, 1] }),
  knee: (sx) => ({ dist: 0.75, dir: [sx * 0.6, 0.2, 1] }),
  ankle: (sx) => ({ dist: 0.6, dir: [sx * 1, 0.35, 0.7] }),
  foot: (sx) => ({ dist: 0.65, dir: [sx * 0.8, 0.6, 1] }),
};

const DEFAULT_DIR: V = [0.35, 0.15, 1];

export const WHOLE_BODY: View = { p: ANCHORS.body, dist: 3.0, dir: [0.25, 0.1, 1] };
export const TORSO: View = { p: ANCHORS.torso, dist: 1.0, dir: [0.25, 0.1, 1] };

export function focusKeys(f: Pick<BodyFocus, "region" | "side">): string[] {
  if (!BODY_REGIONS[f.region].paired) return [f.region];
  if (f.side === "left") return [`${f.region}_l`];
  if (f.side === "right") return [`${f.region}_r`];
  return [`${f.region}_l`, `${f.region}_r`];
}

export function viewFor(f: Pick<BodyFocus, "region" | "side">): View {
  if (!BODY_REGIONS[f.region].paired) {
    const cfg = UNPAIRED[f.region];
    return { p: ANCHORS[f.region], dist: cfg.dist, dir: cfg.dir ?? DEFAULT_DIR };
  }
  if (f.side === "left" || f.side === "right") {
    const s = f.side === "left" ? "l" : "r";
    return { p: ANCHORS[`${f.region}_${s}`], ...PAIRED[f.region](s === "l" ? 1 : -1) };
  }
  // Both sides: center between them and pull back.
  const [l, r] = [ANCHORS[`${f.region}_l`], ANCHORS[`${f.region}_r`]];
  const cfg = PAIRED[f.region](1);
  return { p: [(l[0] + r[0]) / 2, l[1], l[2]], dist: cfg.dist + 0.35, dir: DEFAULT_DIR };
}

// Marker points for each highlighted key (one per side).
export function markerPoints(f: Pick<BodyFocus, "region" | "side">): V[] {
  return focusKeys(f).map((k) => ANCHORS[k]);
}
