// Deterministic safety screen. Runs on every message BEFORE the model is called.
// If a rule matches, the app shows an escalation screen instead of an AI answer,
// so emergency handling never depends on the model's judgment.

export type RedFlagLevel = "emergency" | "urgent" | "crisis_line";

export interface RedFlag {
  level: RedFlagLevel;
  title: string;
  message: string;
  actions: { label: string; href: string; primary?: boolean }[];
  alsoCall911If?: string[];
}

const EMERGENCY_SYMPTOMS: { pattern: RegExp; label: string }[] = [
  { pattern: /chest (pain|pressure|tightness)/, label: "chest pain" },
  {
    pattern: /(can'?t|cannot|can not|trouble|hard to|struggling to) breathe|short(ness)? of breath|trouble breathing/,
    label: "trouble breathing",
  },
  { pattern: /face (is )?droop|drooping face/, label: "face drooping" },
  { pattern: /slurred speech|trouble speaking|can'?t speak|can'?t talk/, label: "trouble speaking" },
  {
    pattern: /(weak|numb)(ness)? (on|in) (one|my (left|right)) side|one side of my (body|face)/,
    label: "weakness on one side",
  },
  { pattern: /passed out|fainted|unconscious|blacked out/, label: "fainting" },
  { pattern: /seizure/, label: "seizure" },
  { pattern: /(won'?t|will not|can'?t) stop bleeding|severe bleeding|bleeding (a lot|heavily)/, label: "severe bleeding" },
  { pattern: /overdose|took too many (pills|tablets)/, label: "possible overdose" },
  { pattern: /(sudden(ly)?|lost) (my )?(vision|can'?t see)/, label: "sudden vision loss" },
];

// Symptoms that turn a severe BP reading into an emergency (AHA guidance).
const BP_EMERGENCY_SYMPTOMS =
  /headache|vision|blurr|confus|chest|breath|weak|numb|speak|speech|dizz/;

const CRISIS_LINE = /suicid|kill myself|end my life|self[- ]?harm|want to die|hurt myself/;

const NEGATION = /\b(no|not|without|denies|never|don'?t have)\b[^.!?]{0,20}$/;

function matchesUnnegated(text: string, pattern: RegExp): boolean {
  const global = new RegExp(pattern.source, "g");
  for (const m of text.matchAll(global)) {
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (!NEGATION.test(before)) return true;
  }
  return false;
}

const CALL_911 = { label: "Call 911", href: "tel:911", primary: true };
const STROKE_HEART_SIGNS = [
  "Chest pain or shortness of breath",
  "Weakness or numbness on one side",
  "Trouble speaking or seeing",
];

export function screenMessage(raw: string, careTeamPhone?: string): RedFlag | null {
  const text = raw.toLowerCase();
  const careTeam = {
    label: careTeamPhone ? `Call my care team: ${careTeamPhone}` : "Call my care team",
    href: careTeamPhone ? `tel:${careTeamPhone.replace(/[^\d+]/g, "")}` : "#",
  };

  if (matchesUnnegated(text, CRISIS_LINE)) {
    return {
      level: "crisis_line",
      title: "You don't have to go through this alone",
      message:
        "If you're thinking about suicide or hurting yourself, please reach out right now. The 988 Suicide & Crisis Lifeline is free, confidential, and open 24/7.",
      actions: [
        { label: "Call or text 988", href: "tel:988", primary: true },
        { label: "Call 911 if you're in danger", href: "tel:911" },
      ],
    };
  }

  const symptom = EMERGENCY_SYMPTOMS.find((s) => matchesUnnegated(text, s.pattern));
  if (symptom) {
    return {
      level: "emergency",
      title: "This needs emergency care now",
      message: `You mentioned ${symptom.label}. That can be a sign of a medical emergency. Please don't wait for an answer from Clarah Health.`,
      actions: [CALL_911, careTeam],
      alsoCall911If: STROKE_HEART_SIGNS,
    };
  }

  const bp = text.match(/\b(\d{2,3})\s*(?:\/|over)\s*(\d{2,3})\b/);
  if (bp) {
    const systolic = Number(bp[1]);
    const diastolic = Number(bp[2]);
    const plausible = systolic >= 60 && systolic <= 300 && diastolic >= 30 && diastolic <= 200;
    if (plausible && (systolic >= 180 || diastolic >= 120)) {
      if (matchesUnnegated(text, BP_EMERGENCY_SYMPTOMS)) {
        return {
          level: "emergency",
          title: "This needs emergency care now",
          message: `A reading of ${systolic}/${diastolic} with symptoms like the ones you described can be a hypertensive emergency. Please don't wait for an answer from Clarah Health.`,
          actions: [CALL_911, careTeam],
          alsoCall911If: STROKE_HEART_SIGNS,
        };
      }
      return {
        level: "urgent",
        title: "This reading is in the severe range",
        message: `${systolic}/${diastolic} is very high. Sit quietly for 5 minutes and measure again. If it's still 180/120 or higher, contact your care team right away.`,
        actions: [careTeam, { label: "Call 911", href: "tel:911" }],
        alsoCall911If: STROKE_HEART_SIGNS,
      };
    }
  }

  const glucose = text.match(/\b(?:blood sugar|sugar|glucose|bg|reading)\b[^\d]{0,20}(\d{2,3})\b/);
  if (glucose && Number(glucose[1]) < 70) {
    return {
      level: "urgent",
      title: "Treat low blood sugar now",
      message: `${glucose[1]} mg/dL is low. Have 15 grams of fast sugar (4 oz of juice or regular soda, or glucose tablets), wait 15 minutes, and check again. If you're fasting, break your fast. If it stays low or you feel confused, get help.`,
      actions: [careTeam, { label: "Call 911", href: "tel:911" }],
      alsoCall911If: ["You pass out or can't swallow safely", "Confusion that doesn't improve"],
    };
  }

  return null;
}
