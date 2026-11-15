import type { BloodPressureReading, LabResult } from "./types";

// What the AI sees of the patient's results. Handing it a flat list of ISO-dated values led it to
// pick the wrong "latest" result, say values went up when they went down, and invent years. So
// the server works out the order and the change, labels the latest result as latest, and writes
// dates out in words; the model only has to explain.

export const dateWords = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const round = (n: number) => Math.round(n * 10) / 10;

export interface LabSummary {
  test: string;
  unit: string;
  latest: { value: number; date: string };
  earlier: { value: number; date: string }[]; // newest first
  change?: string; // e.g. "down 0.5 % from 7.9 on Mar 10, 2026"
}

export function summarizeLabs(labs: LabResult[]): LabSummary[] {
  const byTest = new Map<string, LabResult[]>();
  for (const lab of labs) byTest.set(lab.name, [...(byTest.get(lab.name) ?? []), lab]);
  return [...byTest.values()].map((results) => {
    const sorted = [...results].sort((a, b) => b.date.localeCompare(a.date)); // newest first
    const [latest, previous] = sorted;
    const diff = previous ? round(latest.value - previous.value) : 0;
    const unit = latest.unit === "%" ? " %" : ` ${latest.unit}`;
    return {
      test: latest.name,
      unit: latest.unit,
      latest: { value: latest.value, date: dateWords(latest.date) },
      earlier: sorted.slice(1).map((r) => ({ value: r.value, date: dateWords(r.date) })),
      change: previous
        ? diff === 0
          ? `unchanged from ${previous.value} on ${dateWords(previous.date)}`
          : `${diff > 0 ? "up" : "down"} ${Math.abs(diff)}${unit} from ${previous.value} on ${dateWords(previous.date)}`
        : undefined,
    };
  });
}

export function summarizeBloodPressure<T extends BloodPressureReading>(readings: T[], label: (r: T) => string) {
  const sorted = [...readings].sort((a, b) => b.date.localeCompare(a.date)); // newest first
  const [latest, ...earlier] = sorted;
  if (!latest) return { latest: null, earlier: [] };
  const show = (r: T) => ({ reading: `${r.systolic}/${r.diastolic}`, date: dateWords(r.date), category: label(r) });
  return { latest: show(latest), earlier: earlier.map(show) };
}
