import { BP_LABELS, bpCategory } from "./vitals.ts";

export type MetricKey = "bp" | "a1c" | "ldl" | "egfr";

export interface MetricPart {
  label: string;
  previous: number;
  current: number;
}

interface PartInfo {
  label: string;
  plain: string;
  /** Healthy is below this number ("below") or at/above it ("above"). */
  limit: number;
  healthy: "below" | "above";
  /** Past this number the result is in the clearly high (or low) zone. */
  warn: number;
}

interface MetricInfo {
  name: string;
  medicalName: string;
  unit: string;
  what: string;
  goalText: string;
  parts: PartInfo[];
  format: (values: number[]) => string;
  category: (values: number[]) => string;
}

export const METRIC_INFO: Record<MetricKey, MetricInfo> = {
  bp: {
    name: "Blood pressure",
    medicalName: "Blood pressure (mmHg)",
    unit: "mmHg",
    what: "How hard your blood pushes on the walls of your blood vessels. The top number is the push when your heart beats; the bottom number is the push while your heart rests between beats.",
    goalText: "under 120/80",
    parts: [
      { label: "Top number", plain: "pressure when your heart beats", limit: 120, healthy: "below", warn: 140 },
      { label: "Bottom number", plain: "pressure between beats", limit: 80, healthy: "below", warn: 90 },
    ],
    format: ([top, bottom]) => `${top}/${bottom}`,
    category: ([top, bottom]) => BP_LABELS[bpCategory(top, bottom)],
  },
  a1c: {
    name: "Average blood sugar",
    medicalName: "Hemoglobin A1c test",
    unit: "%",
    what: "Your average blood sugar over the past 2–3 months. It measures how much sugar has stuck to your red blood cells, so one test shows the long-term pattern rather than a single moment like a finger-stick does.",
    goalText: "under 7%",
    parts: [{ label: "Average blood sugar", plain: "3-month average", limit: 7, healthy: "below", warn: 9 }],
    format: ([value]) => `${value}%`,
    category: ([value]) => value < 5.7 ? "Normal range" : value < 6.5 ? "Prediabetes range" : "Diabetes range",
  },
  ldl: {
    name: "Bad cholesterol (LDL)",
    medicalName: "LDL cholesterol (mg/dL)",
    unit: "mg/dL",
    what: "The kind of cholesterol that can build up inside blood vessels and narrow them. Lower is better.",
    goalText: "under 100",
    parts: [{ label: "Bad cholesterol", plain: "LDL level", limit: 100, healthy: "below", warn: 160 }],
    format: ([value]) => `${value}`,
    category: ([value]) => value < 100 ? "Optimal" : value < 130 ? "Near optimal" : value < 160 ? "Borderline high" : value < 190 ? "High" : "Very high",
  },
  egfr: {
    name: "Kidney filtering",
    medicalName: "eGFR (mL/min/1.73m²)",
    unit: "",
    what: "A score for how well your kidneys clean waste from your blood. Higher is better; 90 or more is normal and under 60 for three months can mean kidney disease.",
    goalText: "60 or higher",
    parts: [{ label: "Kidney filtering score", plain: "eGFR", limit: 60, healthy: "above", warn: 30 }],
    format: ([value]) => `${value}`,
    category: ([value]) => value >= 90 ? "Normal" : value >= 60 ? "Mildly reduced" : value >= 45 ? "Mild to moderately reduced" : value >= 30 ? "Moderately to severely reduced" : value >= 15 ? "Severely reduced" : "Kidney failure range",
  },
};

const round = (value: number) => Math.round(value * 10) / 10;

export function percentChange(previous: number, current: number) {
  return previous === 0 ? 0 : Math.round(((current - previous) / previous) * 100);
}

/** How far the value sits outside the healthy side of the limit; 0 when it is within goal. */
export function gapFromGoal(value: number, part: PartInfo) {
  return round(part.healthy === "below" ? Math.max(value - part.limit, 0) : Math.max(part.limit - value, 0));
}

export function partInfo(key: MetricKey, index: number) {
  return METRIC_INFO[key].parts[index];
}

/** One plain sentence about how much the main number moved, e.g. "6% lower than last time". */
export function changeSentence(key: MetricKey, parts: MetricPart[]) {
  const main = parts[0];
  const pct = percentChange(main.previous, main.current);
  const diff = round(main.current - main.previous);
  if (diff === 0) return "Same as last time";
  const word = diff > 0 ? "higher" : "lower";
  const subject = key === "bp" ? "Top number " : "";
  return pct === 0 ? `${subject}slightly ${word} than last time` : `${subject}${Math.abs(pct)}% ${word} than last time`;
}

/** Plain sentence about distance to goal, e.g. "0.4 away from goal" or "Within goal". */
export function goalSentence(key: MetricKey, values: number[]) {
  const gaps = values.map((value, index) => gapFromGoal(value, partInfo(key, index)));
  const index = gaps[0] > 0 ? 0 : gaps.findIndex((value) => value > 0);
  if (index < 0) return "Within goal";
  const side = partInfo(key, index).healthy === "below" ? "over" : "under";
  return `${gaps[index]}${key === "bp" ? " points" : ""} ${side} goal`;
}
