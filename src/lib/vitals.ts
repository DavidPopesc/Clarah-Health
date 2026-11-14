import type { BloodPressureReading, LabResult } from "./types";

// American Heart Association blood pressure categories.
// https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
export type BpCategory = "normal" | "elevated" | "stage1" | "stage2" | "crisis";

export const BP_LABELS: Record<BpCategory, string> = {
  normal: "Normal",
  elevated: "Elevated",
  stage1: "Stage 1 high",
  stage2: "Stage 2 high",
  crisis: "Severe (crisis range)",
};

export function bpCategory(systolic: number, diastolic: number): BpCategory {
  if (systolic > 180 || diastolic > 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage2";
  if (systolic >= 130 || diastolic >= 80) return "stage1";
  if (systolic >= 120) return "elevated";
  return "normal";
}

export function bpExplanation(reading: BloodPressureReading): string {
  switch (bpCategory(reading.systolic, reading.diastolic)) {
    case "normal":
      return "This is in the normal range (under 120 over 80).";
    case "elevated":
      return "This is elevated (120–129 over less than 80). Healthy habits can help keep it from rising.";
    case "stage1":
      return "This is in the stage 1 high range (130–139 over 80–89). It's not an emergency, but it's worth tracking. Your doctor may want home readings before your next visit.";
    case "stage2":
      return "This is in the stage 2 high range (140 or higher over 90 or higher). Talk with your care team about it soon.";
    case "crisis":
      return "This is in the severe range (over 180 or over 120). Recheck after resting 5 minutes. If it's still this high, contact your care team right away. Call 911 if you have chest pain, shortness of breath, vision changes, weakness, or trouble speaking.";
  }
}

export function latest<T extends { date: string }>(items: T[]): T | undefined {
  return [...items].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
}

export function labHistory(labs: LabResult[], name: string): LabResult[] {
  return labs
    .filter((l) => l.name.toLowerCase() === name.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function ageFrom(birthDate: string | undefined, now = new Date()): number | undefined {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
