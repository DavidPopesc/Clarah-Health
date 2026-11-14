import type { BodyFocus } from "./body";
import type { PatientRecord, WearableSummary } from "./types";
import { BP_LABELS, bpCategory, labHistory, latest } from "./vitals";

// Decides what the home page should put in front of the patient: the few things worth
// acting on, and a short list of what looks fine. Fixed rules based on common guideline
// targets (AHA blood pressure, ADA A1c/glucose/LDL, CDC sleep), not the AI.

export interface AttentionItem {
  id: string;
  level: "urgent" | "attention" | "watch";
  title: string;
  detail: string; // what we saw, with the numbers
  why: string; // why it matters
  todo: string; // what to do next
  source: string;
  ask: string; // question to pre-fill in Ask Clara
  focus?: BodyFocus;
}

export interface GoodItem {
  label: string;
  value: string;
}

const fmt = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export function assessHealth(record: PatientRecord, wearable: WearableSummary) {
  const items: AttentionItem[] = [];
  const good: GoodItem[] = [];
  const from = record.source === "epic" ? "MyChart" : "Demo record";
  const hasDiabetes = record.conditions.some((c) => /diabetes/i.test(c.name));

  // Blood pressure
  const bp = latest(record.bloodPressure);
  if (bp) {
    const cat = bpCategory(bp.systolic, bp.diastolic);
    const prev = record.bloodPressure.filter((r) => r.date < bp.date).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    const trend = prev ? `, ${bp.systolic + bp.diastolic > prev.systolic + prev.diastolic ? "up" : "down"} from ${prev.systolic}/${prev.diastolic} on ${fmt(prev.date)}` : "";
    if (cat === "crisis" || cat === "stage2" || cat === "stage1") {
      items.push({
        id: "bp",
        level: cat === "crisis" ? "urgent" : "attention",
        title: cat === "crisis" ? "Your blood pressure reading was dangerously high" : "Your blood pressure is above the healthy range",
        detail: `${bp.systolic}/${bp.diastolic} on ${fmt(bp.date)} is ${BP_LABELS[cat].toLowerCase()}${trend}.`,
        why: "Over time, high blood pressure strains your heart, brain and kidneys, especially with diabetes.",
        todo:
          cat === "crisis"
            ? "If it's still above 180/120 when you recheck, contact your care team now. Call 911 with chest pain, trouble breathing, weakness or trouble speaking."
            : "Check it at home a few times a week and bring the readings to your next visit.",
        source: `${from} · ${fmt(bp.date)}`,
        ask: "My blood pressure has been going up. What does that mean for me and what can I do?",
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `Latest blood pressure ${bp.systolic}/${bp.diastolic}.` },
      });
    } else {
      good.push({ label: "Blood pressure", value: `${bp.systolic}/${bp.diastolic}` });
    }
  }

  // Blood sugar
  const a1c = labHistory(record.labs, "Hemoglobin A1c");
  const a1cNow = a1c.at(-1);
  const a1cPrev = a1c.at(-2);
  const fasting = record.labs.filter((l) => /glucose/i.test(l.name)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (a1cNow && a1cNow.value >= 7) {
    const better = a1cPrev && a1cNow.value < a1cPrev.value;
    items.push({
      id: "a1c",
      level: a1cNow.value >= 9 ? "attention" : "watch",
      title: better ? "Your blood sugar is improving but still above goal" : "Your average blood sugar is above goal",
      detail: `A1c ${a1cNow.value}% on ${fmt(a1cNow.date)}${a1cPrev ? ` (was ${a1cPrev.value}%)` : ""}. A common goal is under 7%.${fasting && fasting.value > 130 ? ` Fasting glucose was ${fasting.value} (goal 80–130).` : ""}`,
      why: "Keeping blood sugar near goal lowers the risk of damage to your eyes, kidneys, nerves and heart.",
      todo: better ? "Keep doing what's working. Ask your doctor what A1c goal is right for you." : "Talk with your care team about your plan to bring it down.",
      source: `${from} · ${fmt(a1cNow.date)}`,
      ask: "What does my A1c mean and how can I keep bringing it down?",
      focus: { region: "pancreas", system: "organs", label: "Pancreas", reason: `Your pancreas makes insulin. Latest A1c ${a1cNow.value}%.` },
    });
  } else if (a1cNow) {
    good.push({ label: "A1c", value: `${a1cNow.value}%` });
  }

  // Low blood sugar risk from medicines
  const sulfonylurea = record.medications.find((m) => m.status === "active" && /glipizide|glimepiride|glyburide|gliclazide|insulin/i.test(m.name));
  if (sulfonylurea) {
    items.push({
      id: "hypo",
      level: "watch",
      title: `${sulfonylurea.name} can make your blood sugar drop too low`,
      detail: `You take ${sulfonylurea.name.toLowerCase()} ${sulfonylurea.dosage}. The risk is higher if you skip meals, fast, or exercise more than usual.`,
      why: "Low blood sugar (under 70) can cause shakiness, sweating, confusion or fainting.",
      todo: "Know the signs and keep fast sugar with you, like juice or glucose tablets. Ask before fasting.",
      source: `${from} · Medications`,
      ask: `What should I know about low blood sugar with ${sulfonylurea.name.toLowerCase()}?`,
    });
  }

  // Cholesterol
  const ldl = record.labs.filter((l) => /ldl/i.test(l.name)).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (ldl) {
    if (ldl.value >= (hasDiabetes ? 100 : 130)) {
      items.push({
        id: "ldl",
        level: "watch",
        title: "Your LDL (bad) cholesterol is above goal",
        detail: `LDL ${ldl.value} mg/dL on ${fmt(ldl.date)}. With diabetes, a common goal is under 100.`,
        why: "High LDL builds up in blood vessels and raises the chance of heart attack and stroke.",
        todo: "Ask whether your cholesterol plan needs a change.",
        source: `${from} · ${fmt(ldl.date)}`,
        ask: "Is my cholesterol where it should be?",
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `LDL ${ldl.value} mg/dL.` },
      });
    } else {
      good.push({ label: "LDL cholesterol", value: `${ldl.value}` });
    }
  }

  // Kidneys
  const egfr = labHistory(record.labs, "eGFR").at(-1);
  if (egfr) {
    if (egfr.value < 60) {
      items.push({
        id: "egfr",
        level: "attention",
        title: "Your kidneys are filtering less than normal",
        detail: `eGFR ${egfr.value} on ${fmt(egfr.date)}. Below 60 for 3 months or more can mean kidney disease.`,
        why: "Kidneys clean your blood. Some medicines need different doses when kidneys slow down.",
        todo: "Ask your doctor about your kidney numbers and your medicines.",
        source: `${from} · ${fmt(egfr.date)}`,
        ask: "What does my eGFR mean for my kidneys?",
        focus: { region: "kidneys", system: "organs", label: "Kidneys", reason: `eGFR ${egfr.value}.` },
      });
    } else {
      good.push({ label: "Kidney function", value: `eGFR ${egfr.value}` });
    }
  }

  // Wearable: sleep and resting heart rate
  const nums = (xs: (number | undefined)[]) => xs.filter((v): v is number => typeof v === "number");
  const sleep = nums(wearable.days.map((d) => d.minutesAsleep));
  const avgSleep = sleep.length ? sleep.reduce((a, b) => a + b, 0) / sleep.length : null;
  const device = wearable.source === "fitbit" ? "Fitbit" : "Demo wearable";
  if (avgSleep !== null) {
    const h = Math.floor(avgSleep / 60);
    const m = Math.round(avgSleep % 60);
    if (avgSleep < 7 * 60) {
      items.push({
        id: "sleep",
        level: "watch",
        title: "You're not getting enough sleep",
        detail: `You averaged ${h}h ${m}m a night over the last ${sleep.length} days. Adults need 7 or more hours.`,
        why: "Short sleep makes blood sugar and blood pressure harder to control.",
        todo: "Try a regular bedtime and aim for at least 7 hours.",
        source: `${device} · last ${sleep.length} days`,
        ask: "How does my sleep affect my blood sugar and blood pressure?",
      });
    } else {
      good.push({ label: "Sleep", value: `${h}h ${m}m avg` });
    }
  }
  const rhr = nums(wearable.days.map((d) => d.restingHeartRate)).at(-1);
  if (rhr !== undefined) {
    if (rhr > 100 || rhr < 50) {
      items.push({
        id: "rhr",
        level: "attention",
        title: `Your resting heart rate is ${rhr > 100 ? "high" : "low"}`,
        detail: `${rhr} bpm. The typical adult range is 60–100.`,
        why: "A resting heart rate outside the usual range can have many causes, some worth checking.",
        todo: "Mention it to your care team, especially if you feel dizzy, short of breath or have chest pain.",
        source: device,
        ask: "What does my resting heart rate mean?",
        focus: { region: "heart", system: "circulatory", label: "Heart", reason: `Resting heart rate ${rhr} bpm.` },
      });
    } else {
      good.push({ label: "Resting heart rate", value: `${rhr} bpm` });
    }
  }

  const rank = { urgent: 0, attention: 1, watch: 2 };
  items.sort((a, b) => rank[a.level] - rank[b.level]);
  return { items, good };
}
