// Body regions and systems Clarah can show in the 3D anatomy viewer.
// Shared by the server (agent tool + keyword fallback) and the client viewer.

export const BODY_SYSTEMS = ["skeletal", "muscular", "circulatory", "nervous", "organs"] as const;
export type BodySystem = (typeof BODY_SYSTEMS)[number];

export const SYSTEM_LABELS: Record<BodySystem, string> = {
  skeletal: "Bones",
  muscular: "Muscles",
  circulatory: "Heart & vessels",
  nervous: "Nerves",
  organs: "Organs",
};

interface RegionInfo {
  label: string;
  paired: boolean;
  system: BodySystem;
}

export const BODY_REGIONS = {
  head: { label: "Head", paired: false, system: "skeletal" },
  brain: { label: "Brain", paired: false, system: "nervous" },
  neck: { label: "Neck", paired: false, system: "muscular" },
  chest: { label: "Chest", paired: false, system: "skeletal" },
  heart: { label: "Heart", paired: false, system: "circulatory" },
  lungs: { label: "Lungs", paired: false, system: "organs" },
  back: { label: "Lower back", paired: false, system: "skeletal" },
  abdomen: { label: "Belly", paired: false, system: "organs" },
  stomach: { label: "Stomach", paired: false, system: "organs" },
  liver: { label: "Liver", paired: false, system: "organs" },
  pancreas: { label: "Pancreas", paired: false, system: "organs" },
  kidneys: { label: "Kidneys", paired: false, system: "organs" },
  shoulder: { label: "Shoulder", paired: true, system: "muscular" },
  elbow: { label: "Elbow", paired: true, system: "skeletal" },
  wrist: { label: "Wrist", paired: true, system: "skeletal" },
  hand: { label: "Hand", paired: true, system: "skeletal" },
  hip: { label: "Hip", paired: true, system: "skeletal" },
  knee: { label: "Knee", paired: true, system: "skeletal" },
  ankle: { label: "Ankle", paired: true, system: "muscular" },
  foot: { label: "Foot", paired: true, system: "skeletal" },
} satisfies Record<string, RegionInfo>;

export type BodyRegion = keyof typeof BODY_REGIONS;
export type BodySide = "left" | "right" | "both";
export const REGION_IDS = Object.keys(BODY_REGIONS) as BodyRegion[];

export interface BodyFocus {
  region: BodyRegion;
  side?: BodySide;
  system: BodySystem;
  label: string;
  reason: string;
}

export function focusLabel(region: BodyRegion, side?: BodySide): string {
  const info = BODY_REGIONS[region];
  if (!info.paired || !side) return info.label;
  if (side === "both") return `Both ${info.label.toLowerCase()}s`;
  return `${side === "left" ? "Left" : "Right"} ${info.label.toLowerCase()}`;
}

// Validates model-provided tool arguments into a focus the viewer can show.
export function normalizeFocus(input: Record<string, unknown>): BodyFocus | null {
  const region = input.region as BodyRegion;
  if (!REGION_IDS.includes(region)) return null;
  const info = BODY_REGIONS[region];
  const system = BODY_SYSTEMS.includes(input.system as BodySystem) ? (input.system as BodySystem) : info.system;
  const side =
    info.paired && ["left", "right", "both"].includes(input.side as string) ? (input.side as BodySide) : undefined;
  const reason = typeof input.reason === "string" ? input.reason.slice(0, 160) : "";
  return { region, side, system, label: focusLabel(region, side), reason };
}

// Deterministic fallback so the viewer still appears if the model skips the tool.
const REGION_PATTERNS: [BodyRegion, RegExp][] = [
  ["ankle", /\bankles?\b|achilles/],
  ["foot", /\b(foot|feet|toes?|heels?|plantar|arch)\b/],
  ["knee", /\bknees?\b|\bacl\b|\bmeniscus\b/],
  ["hip", /\bhips?\b/],
  ["back", /\b(lower back|back pain|backache|spine|sciatica|herniated disc)\b/],
  ["shoulder", /\bshoulders?\b|rotator cuff/],
  ["elbow", /\belbows?\b/],
  ["wrist", /\bwrists?\b|carpal tunnel/],
  ["hand", /\b(hands?|fingers?|thumbs?|knuckles?)\b/],
  ["neck", /\bneck\b/],
  ["brain", /\b(migraines?|concussion|brain)\b/],
  ["head", /\b(head|headaches?|skull)\b/],
  ["heart", /\b(heart|palpitations?|cardiac)\b/],
  ["lungs", /\b(lungs?|asthma|inhaler)\b/],
  ["kidneys", /\b(kidneys?|egfr|renal)\b/],
  ["liver", /\bliver\b/],
  ["pancreas", /\bpancrea(s|tic)\b/],
  ["stomach", /\b(stomach|heartburn|acid reflux|nausea|ulcers?)\b/],
  ["abdomen", /\b(belly|abdomen|abdominal|gut)\b/],
  ["chest", /\b(chest|ribs?)\b/],
];

export function detectBodyFocus(raw: string): BodyFocus | null {
  const text = raw.toLowerCase();
  const match = REGION_PATTERNS.find(([, re]) => re.test(text));
  if (!match) return null;
  const [region, re] = match;
  const info = BODY_REGIONS[region];

  // Only trust "left"/"right" right before the body part ("my left ankle"), not "right away".
  let side: BodySide | undefined;
  if (info.paired) {
    const at = text.search(re);
    const before = text.slice(Math.max(0, at - 24), at);
    const left = /\bleft\b/.test(before);
    const right = /\bright\b/.test(before);
    side = left && right ? "both" : left ? "left" : right ? "right" : /\bboth\b/.test(before) ? "both" : undefined;
  }

  let system: BodySystem = info.system;
  if (/sprain|strain|pulled|tear|torn|ligament|tendon|muscle|cramp|twist|rolled/.test(text)) system = "muscular";
  else if (/fractur|broke|break|bone|arthritis|joint|osteo/.test(text)) system = "skeletal";
  else if (/numb|tingl|nerve|sciatica|pins and needles/.test(text)) system = "nervous";

  return { region, side, system, label: focusLabel(region, side), reason: "" };
}
