import type { BodyFocus } from "./body";
import type { DocFinding } from "./documents";
import type { PatientRecord, WearableSummary } from "./types";
import { BP_LABELS, bpCategory, labHistory, latest } from "./vitals.ts";
import { METRIC_INFO, type MetricKey, type MetricPart } from "./metrics.ts";

export type AttentionLevel = "urgent" | "attention" | "watch";

export interface ResultProgress {
  direction: "improving" | "worsening" | "unchanged" | "mixed";
  label: string;
  key: MetricKey;
  metric: string;
  parts: MetricPart[];
  previousValue: string;
  currentValue: string;
  previousDate: string;
  currentDate: string;
}

export type HealthThemeId =
  | "cardiometabolic"
  | "kidney"
  | "daily-routines"
  | "mental-health"
  | "adhd"
  | "cancer";

export interface HealthEvidence {
  id: string;
  kind: "lab" | "vital" | "medication" | "wearable" | "condition";
  label: string;
  value: string;
  source: string;
}

export interface AttentionItem {
  id: string;
  themeId: HealthThemeId;
  level: AttentionLevel;
  title: string;
  detail: string;
  why: string;
  todo: string;
  source: string;
  ask: string;
  evidence: HealthEvidence[];
  progress?: ResultProgress;
  focus?: BodyFocus;
}

export interface HealthRelationship {
  themeId: HealthThemeId;
  label: string;
  note: string;
}

export interface HealthTheme {
  id: HealthThemeId;
  title: string;
  description: string;
  action: string;
  level: AttentionLevel;
  items: AttentionItem[];
  relationships: HealthRelationship[];
}

export interface DocumentThemeMatch {
  themeId: HealthThemeId;
  itemId?: string;
}

export interface GoodItem {
  label: string;
  value: string;
  progress?: ResultProgress;
}

interface ThemeDefinition {
  title: string;
  description: string;
  action: string;
  relationships: HealthRelationship[];
}

export const HEALTH_THEME_DEFINITIONS: Record<HealthThemeId, ThemeDefinition> = {
  cardiometabolic: {
    title: "Heart, blood sugar & metabolism",
    description: "These numbers affect each other and are often managed as one connected health picture.",
    action: "Focus on the shared plan: take medicines as directed, track the numbers your care team recommends, and bring the trends to your next visit.",
    relationships: [
      { themeId: "daily-routines", label: "Meals, sleep & routines", note: "Regular meals, activity and sleep can support blood sugar, cholesterol and blood pressure." },
      { themeId: "adhd", label: "ADHD", note: "ADHD may make planning meals, medicines and appointments harder, so simpler routines can help." },
    ],
  },
  kidney: {
    title: "Kidney health",
    description: "Kidney results, urine findings and related treatment plans are grouped here.",
    action: "Review kidney trends with your care team and ask how blood pressure, blood sugar and medicines fit into the plan.",
    relationships: [
      { themeId: "cardiometabolic", label: "Heart & metabolic health", note: "Blood pressure and blood sugar can affect kidney health over time." },
    ],
  },
  "daily-routines": {
    title: "Meals, sleep & daily routines",
    description: "This area collects patterns that can make other health goals easier or harder to manage.",
    action: "Choose one repeatable routine to work on first, such as a steady bedtime, regular meals or a medicine reminder.",
    relationships: [
      { themeId: "cardiometabolic", label: "Heart & metabolic health", note: "Sleep, food patterns and activity can influence several cardiometabolic numbers." },
      { themeId: "adhd", label: "ADHD", note: "ADHD can affect organization and consistency with daily health routines." },
      { themeId: "mental-health", label: "Emotional wellbeing", note: "Sleep and daily structure can affect how people feel and function." },
    ],
  },
  "mental-health": {
    title: "Mental health & emotional wellbeing",
    description: "Diagnoses and clinician notes about mood, anxiety, stress or emotional wellbeing appear here.",
    action: "Keep mental health in the same care plan as physical health, and tell your care team about symptoms that are new, worsening or affecting daily life.",
    relationships: [
      { themeId: "adhd", label: "ADHD", note: "ADHD and other mental health conditions can occur together, but one should not be assumed from the other." },
      { themeId: "daily-routines", label: "Sleep & routines", note: "Sleep and daily structure may affect emotional wellbeing." },
    ],
  },
  adhd: {
    title: "ADHD",
    description: "ADHD is shown as its own health area, with links to routines and emotional wellbeing rather than being treated as the cause of every related concern.",
    action: "Use simple supports for medicines, meals, sleep and appointments, and ask whether your current ADHD plan still fits your daily needs.",
    relationships: [
      { themeId: "daily-routines", label: "Meals, sleep & routines", note: "Attention and organization challenges can make consistent routines harder." },
      { themeId: "mental-health", label: "Emotional wellbeing", note: "Other mental health conditions may occur alongside ADHD and should be assessed separately." },
      { themeId: "cardiometabolic", label: "Heart & metabolic health", note: "The connection here is routine management, not proof that ADHD caused a lab or vital sign." },
    ],
  },
  cancer: {
    title: "Cancer & treatment",
    description: "Cancer diagnoses, imaging findings and treatment notes are kept together here.",
    action: "Use this area to keep the diagnosis, treatment plan, follow-up tests and questions for the oncology team in one place.",
    relationships: [],
  },
};

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const rank: Record<AttentionLevel, number> = { urgent: 0, attention: 1, watch: 2 };

export function summarizeProgress(items: AttentionItem[]) {
  const comparisons = items.flatMap((item) => item.progress ? [item.progress] : []);
  const improving = comparisons.filter((progress) => progress.direction === "improving").length;
  const worsening = comparisons.filter((progress) => progress.direction === "worsening").length;
  if (comparisons.some((progress) => progress.direction === "mixed") || (improving && worsening)) return { direction: "mixed", label: "Mixed progress" } as const;
  if (worsening) return { direction: "worsening", label: "Further from goal" } as const;
  if (improving) return { direction: "improving", label: "Making progress" } as const;
  if (comparisons.length) return { direction: "unchanged", label: "Holding steady" } as const;
  return { direction: "unknown", label: "New" } as const;
}

function compareResults(
  key: MetricKey,
  current: { date: string; values: number[]; display: string },
  previous: { date: string; values: number[]; display: string } | undefined,
  ranges: { min: number; max: number }[],
): ResultProgress | undefined {
  if (!previous || previous.date >= current.date || [...current.values, ...previous.values].some((value) => !Number.isFinite(value))) return undefined;
  const distance = (value: number, range: { min: number; max: number }) => Math.max(range.min - value, value - range.max, 0);
  const changes = current.values.map((value, index) => distance(value, ranges[index]) - distance(previous.values[index], ranges[index]));
  const improved = changes.some((change) => change < 0);
  const worsened = changes.some((change) => change > 0);
  const direction = improved && worsened ? "mixed" : improved ? "improving" : worsened ? "worsening" : "unchanged";
  const inRange = current.values.every((value, index) => distance(value, ranges[index]) === 0);
  const label = direction === "mixed" ? "Mixed changes" : direction === "improving" ? inRange ? "Reached expected range" : "Closer to goal" : direction === "worsening" ? "Further from goal" : inRange ? "Within expected range" : "Unchanged";
  const parts = current.values.map((value, index) => ({ label: METRIC_INFO[key].parts[index].label, previous: previous.values[index], current: value }));
  return { direction, label, key, metric: METRIC_INFO[key].name, parts, previousValue: previous.display, currentValue: current.display, previousDate: previous.date, currentDate: current.date };
}

function compareLabs(labs: PatientRecord["labs"], key: MetricKey, range: { min: number; max: number }): ResultProgress | undefined {
  const current = latest(labs);
  if (!current) return undefined;
  const previous = latest(labs.filter((lab) => lab.date < current.date && lab.unit === current.unit));
  return compareResults(key,
    { date: current.date, values: [current.value], display: `${current.value}${current.unit === "%" ? "" : " "}${current.unit}` },
    previous ? { date: previous.date, values: [previous.value], display: `${previous.value}${previous.unit === "%" ? "" : " "}${previous.unit}` } : undefined,
    [range],
  );
}

function makeThemes(items: AttentionItem[]): HealthTheme[] {
  const groups = new Map<HealthThemeId, AttentionItem[]>();
  for (const item of items) groups.set(item.themeId, [...(groups.get(item.themeId) ?? []), item]);
  return [...groups.entries()]
    .map(([id, themeItems]) => {
      const definition = HEALTH_THEME_DEFINITIONS[id];
      const sortedItems = [...themeItems].sort((a, b) => rank[a.level] - rank[b.level]);
      return {
        id,
        title: definition.title,
        description: definition.description,
        action: definition.action,
        relationships: definition.relationships,
        level: sortedItems[0]?.level ?? "watch",
        items: sortedItems,
      } satisfies HealthTheme;
    })
    .sort((a, b) => rank[a.level] - rank[b.level] || b.items.length - a.items.length);
}

export function createDocumentOnlyTheme(id: HealthThemeId): HealthTheme {
  const definition = HEALTH_THEME_DEFINITIONS[id];
  return { id, ...definition, level: "watch", items: [] };
}

export function classifyDocumentFinding(finding: Pick<DocFinding, "title" | "explanation" | "comparison">): DocumentThemeMatch | null {
  const text = `${finding.title} ${finding.explanation} ${finding.comparison ?? ""}`.toLowerCase();
  if (/attention[- ]deficit|\badhd\b/.test(text)) return { themeId: "adhd", itemId: "adhd" };
  if (/depress|anxiety|panic|bipolar|post[- ]traumatic|\bptsd\b|obsessive|\bocd\b|mood|mental health|substance use|eating disorder/.test(text)) {
    return { themeId: "mental-health", itemId: "mental-health" };
  }
  if (/cancer|carcinoma|malignan|tumou?r|lymphoma|leukemia|melanoma|oncolog/.test(text)) return { themeId: "cancer", itemId: "cancer" };
  if (/kidney|renal|\begfr\b|creatinine|urine protein|urine albumin|albumin.*urine|\buacr\b/.test(text)) {
    return { themeId: "kidney", itemId: "egfr" };
  }
  if (/low blood sugar|hypoglyc|glipizide|glimepiride|glyburide|gliclazide/.test(text)) {
    return { themeId: "cardiometabolic", itemId: "hypo" };
  }
  if (/\ba1c\b|hemoglobin a1c|blood sugar|blood glucose|fasting glucose|diabetes/.test(text)) {
    return { themeId: "cardiometabolic", itemId: "a1c" };
  }
  if (/cholesterol|\bldl\b|triglyceride|lipid/.test(text)) return { themeId: "cardiometabolic", itemId: "ldl" };
  if (/blood pressure|hypertension|systolic|diastolic|lisinopril/.test(text)) return { themeId: "cardiometabolic", itemId: "bp" };
  if (/resting heart rate|\bheart rate\b|\bpulse\b/.test(text)) return { themeId: "cardiometabolic", itemId: "rhr" };
  if (/sleep|insomnia|bedtime|fatigue/.test(text)) return { themeId: "daily-routines", itemId: "sleep" };
  if (/diet|meal|nutrition|exercise|physical activity|sedentary|weight/.test(text)) return { themeId: "daily-routines" };
  return null;
}

export function assessHealth(record: PatientRecord, wearable: WearableSummary) {
  const items: AttentionItem[] = [];
  const good: GoodItem[] = [];
  const from = record.source === "epic" ? "MyChart" : "Demo record";
  const hasDiabetes = record.conditions.some((condition) => /diabetes/i.test(condition.name));

  const bp = latest(record.bloodPressure);
  if (bp) {
    const category = bpCategory(bp.systolic, bp.diastolic);
    const previous = record.bloodPressure.filter((reading) => reading.date < bp.date).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const progress = compareResults("bp",
      { date: bp.date, values: [bp.systolic, bp.diastolic], display: `${bp.systolic}/${bp.diastolic} mmHg` },
      previous ? { date: previous.date, values: [previous.systolic, previous.diastolic], display: `${previous.systolic}/${previous.diastolic} mmHg` } : undefined,
      [{ min: 90, max: 119 }, { min: 60, max: 79 }],
    );
    const trend = previous ? `; previously ${previous.systolic}/${previous.diastolic} on ${fmt(previous.date)}` : "";
    if (category === "crisis" || category === "stage2" || category === "stage1") {
      items.push({
        id: "bp",
        themeId: "cardiometabolic",
        progress,
        level: category === "crisis" ? "urgent" : "attention",
        title: category === "crisis" ? "Dangerously high blood pressure" : "Blood pressure above the healthy range",
        detail: `${bp.systolic}/${bp.diastolic} on ${fmt(bp.date)} is ${BP_LABELS[category].toLowerCase()}${trend}.`,
        why: "Over time, high blood pressure strains the heart, brain and kidneys, especially with diabetes.",
        todo: category === "crisis"
          ? "If it is still above 180/120 when you recheck, contact your care team now. Call 911 with chest pain, trouble breathing, weakness or trouble speaking."
          : "Check it at home a few times a week and bring the readings to your next visit.",
        source: `${from} · ${fmt(bp.date)}`,
        ask: "How has my blood pressure changed since the previous reading, and what should I do next?",
        evidence: [{ id: `bp-${bp.date}`, kind: "vital", label: "Blood pressure", value: `${bp.systolic}/${bp.diastolic}`, source: `${from} · ${fmt(bp.date)}` }],
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `Latest blood pressure ${bp.systolic}/${bp.diastolic}.` },
      });
    } else {
      good.push({ label: "Blood pressure", value: `${bp.systolic}/${bp.diastolic}`, progress });
    }
  }

  const a1c = labHistory(record.labs, "Hemoglobin A1c");
  const a1cNow = a1c.at(-1);
  const a1cPrevious = a1cNow ? latest(a1c.filter((lab) => lab.date < a1cNow.date && lab.unit === a1cNow.unit)) : undefined;
  const a1cProgress = compareLabs(a1c, "a1c", { min: 4, max: 6.99 });
  const fasting = record.labs.filter((lab) => /glucose/i.test(lab.name)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (a1cNow && a1cNow.value >= 7) {
    const better = Boolean(a1cPrevious && a1cNow.value < a1cPrevious.value);
    const evidence: HealthEvidence[] = [{ id: `a1c-${a1cNow.date}`, kind: "lab", label: "Average blood sugar (A1c test)", value: `${a1cNow.value}%`, source: `${from} · ${fmt(a1cNow.date)}` }];
    if (fasting && fasting.value > 130) evidence.push({ id: `glucose-${fasting.date}`, kind: "lab", label: "Fasting glucose", value: `${fasting.value} ${fasting.unit}`, source: `${from} · ${fmt(fasting.date)}` });
    items.push({
      id: "a1c",
      progress: a1cProgress,
      themeId: "cardiometabolic",
      level: a1cNow.value >= 9 ? "attention" : "watch",
      title: better ? "Blood sugar is improving but still above goal" : "Average blood sugar is above goal",
      detail: `Your 3-month average blood sugar was ${a1cNow.value}% on ${fmt(a1cNow.date)}${a1cPrevious ? ` (was ${a1cPrevious.value}%)` : ""}. A common goal is under 7%.${fasting && fasting.value > 130 ? ` Fasting glucose was ${fasting.value} (goal 80–130).` : ""}`,
      why: "Keeping blood sugar near goal lowers the risk of damage to the eyes, kidneys, nerves and heart.",
      todo: better ? "Keep doing what is working and ask what blood sugar goal is right for you." : "Talk with your care team about the plan to bring it down.",
      source: `${from} · ${fmt(a1cNow.date)}`,
      ask: "What does my 3-month average blood sugar (A1c) mean, and how can I keep bringing it down?",
      evidence,
      focus: { region: "pancreas", system: "organs", label: "Pancreas", reason: `3-month average blood sugar ${a1cNow.value}%.` },
    });
  } else if (a1cNow) {
    good.push({ label: "Average blood sugar", value: `${a1cNow.value}%`, progress: a1cProgress });
  }

  const sulfonylurea = record.medications.find((medication) => medication.status === "active" && /glipizide|glimepiride|glyburide|gliclazide|insulin/i.test(medication.name));
  if (sulfonylurea) {
    items.push({
      id: "hypo",
      themeId: "cardiometabolic",
      level: "watch",
      title: "Low blood sugar risk from medicine",
      detail: `${sulfonylurea.name} ${sulfonylurea.dosage} can make blood sugar drop too low, especially when meals are skipped, during fasting or with more activity than usual.`,
      why: "Low blood sugar under 70 can cause shakiness, sweating, confusion or fainting.",
      todo: "Know the signs and keep fast sugar with you, such as juice or glucose tablets. Ask before fasting.",
      source: `${from} · Medications`,
      ask: `What should I know about low blood sugar with ${sulfonylurea.name.toLowerCase()}?`,
      evidence: [{ id: `med-${sulfonylurea.name}`, kind: "medication", label: sulfonylurea.name, value: sulfonylurea.dosage, source: `${from} · Active medication` }],
    });
  }

  const ldlLabs = record.labs.filter((lab) => /ldl/i.test(lab.name));
  const ldl = latest(ldlLabs);
  const ldlProgress = compareLabs(ldlLabs, "ldl", { min: 0, max: hasDiabetes ? 99.99 : 129.99 });
  if (ldl) {
    if (ldl.value >= (hasDiabetes ? 100 : 130)) {
      items.push({
        id: "ldl",
        progress: ldlProgress,
        themeId: "cardiometabolic",
        level: "watch",
        title: "Bad cholesterol (LDL) is above goal",
        detail: `Bad cholesterol (LDL) was ${ldl.value} on ${fmt(ldl.date)}. With diabetes, a common goal is under 100.`,
        why: "High LDL can build up in blood vessels and raise the chance of heart attack and stroke.",
        todo: "Ask whether your cholesterol plan needs a change.",
        source: `${from} · ${fmt(ldl.date)}`,
        ask: "Is my cholesterol where it should be?",
        evidence: [{ id: `ldl-${ldl.date}`, kind: "lab", label: "Bad cholesterol (LDL)", value: `${ldl.value} ${ldl.unit}`, source: `${from} · ${fmt(ldl.date)}` }],
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `LDL ${ldl.value} mg/dL.` },
      });
    } else {
      good.push({ label: "Bad cholesterol (LDL)", value: `${ldl.value}`, progress: ldlProgress });
    }
  }

  const egfrLabs = labHistory(record.labs, "eGFR");
  const egfr = egfrLabs.at(-1);
  const egfrProgress = compareLabs(egfrLabs, "egfr", { min: 60, max: Infinity });
  if (egfr) {
    if (egfr.value < 60) {
      items.push({
        id: "egfr",
        progress: egfrProgress,
        themeId: "kidney",
        level: "attention",
        title: "Kidneys are filtering less than normal",
        detail: `Kidney filtering score (eGFR) was ${egfr.value} on ${fmt(egfr.date)}. Below 60 for 3 months or more can mean kidney disease.`,
        why: "Kidneys clean the blood, and some medicines need different doses when kidney function slows down.",
        todo: "Ask about the kidney trend and how it affects your medicines.",
        source: `${from} · ${fmt(egfr.date)}`,
        ask: "What does my kidney filtering score (eGFR) mean?",
        evidence: [{ id: `egfr-${egfr.date}`, kind: "lab", label: "Kidney filtering score (eGFR)", value: `${egfr.value}`, source: `${from} · ${fmt(egfr.date)}` }],
        focus: { region: "kidneys", system: "organs", label: "Kidneys", reason: `eGFR ${egfr.value}.` },
      });
    } else {
      good.push({ label: "Kidney filtering", value: `${egfr.value}`, progress: egfrProgress });
    }
  }

  const numbers = (values: (number | undefined)[]) => values.filter((value): value is number => typeof value === "number");
  const sleep = numbers(wearable.days.map((day) => day.minutesAsleep));
  const averageSleep = sleep.length ? sleep.reduce((sum, value) => sum + value, 0) / sleep.length : null;
  const device = wearable.source === "fitbit" ? "Fitbit" : "Demo wearable";
  if (averageSleep !== null) {
    const hours = Math.floor(averageSleep / 60);
    const minutes = Math.round(averageSleep % 60);
    if (averageSleep < 7 * 60) {
      items.push({
        id: "sleep",
        themeId: "daily-routines",
        level: "watch",
        title: "Not enough sleep",
        detail: `Average sleep was ${hours}h ${minutes}m a night over the last ${sleep.length} days. Adults generally need 7 or more hours.`,
        why: "Short sleep can make blood sugar and blood pressure harder to manage and can affect daily focus and mood.",
        todo: "Try a regular bedtime and aim for at least 7 hours.",
        source: `${device} · last ${sleep.length} days`,
        ask: "How does my sleep affect my blood sugar, blood pressure and focus?",
        evidence: [{ id: "sleep-average", kind: "wearable", label: "Average sleep", value: `${hours}h ${minutes}m`, source: `${device} · last ${sleep.length} days` }],
      });
    } else {
      good.push({ label: "Sleep", value: `${hours}h ${minutes}m avg` });
    }
  }

  const restingHeartRate = numbers(wearable.days.map((day) => day.restingHeartRate)).at(-1);
  if (restingHeartRate !== undefined) {
    if (restingHeartRate > 100 || restingHeartRate < 50) {
      items.push({
        id: "rhr",
        themeId: "cardiometabolic",
        level: "attention",
        title: `Resting heart rate is ${restingHeartRate > 100 ? "high" : "low"}`,
        detail: `${restingHeartRate} bpm. The typical adult range is 60–100.`,
        why: "A resting heart rate outside the usual range can have many causes, some worth checking.",
        todo: "Mention it to your care team, especially with dizziness, shortness of breath or chest pain.",
        source: device,
        ask: "What does my resting heart rate mean?",
        evidence: [{ id: "resting-heart-rate", kind: "wearable", label: "Resting heart rate", value: `${restingHeartRate} bpm`, source: device }],
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `Resting heart rate ${restingHeartRate} bpm.` },
      });
    } else {
      good.push({ label: "Resting heart rate", value: `${restingHeartRate} bpm` });
    }
  }

  const adhd = record.conditions.find((condition) => /attention[- ]deficit|\badhd\b/i.test(condition.name));
  if (adhd) {
    items.push({
      id: "adhd",
      themeId: "adhd",
      level: "watch",
      title: "ADHD is part of the care plan",
      detail: "The record lists ADHD. Clarah Health keeps it separate while showing where organization, sleep, meals and follow-through may overlap with other health goals.",
      why: "A plan that works with attention and organization challenges can make the rest of health care easier to manage.",
      todo: "Use simple reminders and routines, and ask whether your ADHD treatment and supports still fit your daily life.",
      source: `${from} · Conditions`,
      ask: "How can ADHD affect my health routines, and what could make them easier?",
      evidence: [{ id: "condition-adhd", kind: "condition", label: "Recorded condition", value: adhd.name, source: `${from}${adhd.since ? ` · since ${fmt(adhd.since)}` : ""}` }],
    });
  }

  const mentalHealthConditions = record.conditions.filter((condition) => /depress|anxiety|panic|bipolar|post[- ]traumatic|\bptsd\b|obsessive|\bocd\b|mood|substance use|eating disorder/i.test(condition.name));
  if (mentalHealthConditions.length > 0) {
    items.push({
      id: "mental-health",
      themeId: "mental-health",
      level: "watch",
      title: "Mental health conditions in the record",
      detail: mentalHealthConditions.map((condition) => condition.name).join(", "),
      why: "Mental and physical health can affect each other, so these diagnoses belong in the same overall care picture.",
      todo: "Keep follow-up current and tell your care team about symptoms that are worsening or affecting daily life.",
      source: `${from} · Conditions`,
      ask: "How might my mental and physical health plans affect each other?",
      evidence: mentalHealthConditions.map((condition) => ({ id: `condition-${condition.name}`, kind: "condition", label: "Recorded condition", value: condition.name, source: `${from}${condition.since ? ` · since ${fmt(condition.since)}` : ""}` })),
    });
  }

  const cancerConditions = record.conditions.filter((condition) => /cancer|carcinoma|malignan|tumou?r|lymphoma|leukemia|melanoma/i.test(condition.name));
  if (cancerConditions.length > 0) {
    items.push({
      id: "cancer",
      themeId: "cancer",
      level: "attention",
      title: "Cancer diagnosis and follow-up",
      detail: cancerConditions.map((condition) => condition.name).join(", "),
      why: "Keeping the diagnosis, treatment and follow-up evidence together makes the care plan easier to review.",
      todo: "Use this area to track the oncology plan, upcoming tests and questions for the care team.",
      source: `${from} · Conditions`,
      ask: "Can you help me understand my cancer care plan and what I should ask next?",
      evidence: cancerConditions.map((condition) => ({ id: `condition-${condition.name}`, kind: "condition", label: "Recorded condition", value: condition.name, source: `${from}${condition.since ? ` · since ${fmt(condition.since)}` : ""}` })),
    });
  }

  items.sort((a, b) => rank[a.level] - rank[b.level]);
  return { items, themes: makeThemes(items), good };
}
