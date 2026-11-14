// Types for visit recaps, and the check that turns the AI's raw reply into a safe, well-formed
// recap. Kept free of runtime imports so it runs in the browser, the server and `node --test`.

export interface MedicationChange {
  name: string;
  change: "start" | "stop" | "change" | "continue";
  detail: string;
}

export interface VisitTerm {
  term: string;
  meaning: string;
}

export interface VisitRecap {
  title: string;
  date?: string; // YYYY-MM-DD
  summary: string;
  script: string[]; // what Clara says out loud, one paragraph per item
  medicationChanges: MedicationChange[];
  nextSteps: string[];
  watchFor: string[];
  terms: VisitTerm[];
  questions: string[];
}

const CHANGES = ["start", "stop", "change", "continue"] as const;

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);
const strings = (v: unknown, max: number, count: number) => list(v).map((x) => str(x, max)).filter(Boolean).slice(0, count);

// Text meant to be spoken: no markdown symbols or list markers for the voice to read out.
const speakable = (s: string) =>
  s
    .replace(/[*_#`>]+/g, "")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/, "")
    .trim();

// A medication change is kept only if the medicine was actually named in the conversation,
// so the recap can never introduce a drug the clinician didn't mention.
export function mentioned(name: string, transcript: string): boolean {
  const text = transcript.toLowerCase();
  const words = name.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [];
  return words.length > 0 && words.some((w) => text.includes(w));
}

export function normalizeRecap(raw: unknown, transcript: string): VisitRecap {
  const r = (raw ?? {}) as Record<string, unknown>;

  const script = (Array.isArray(r.script) ? r.script : typeof r.script === "string" ? r.script.split(/\n{2,}/) : [])
    .map((p) => speakable(str(p, 900)))
    .filter(Boolean)
    .slice(0, 8);

  const medicationChanges: MedicationChange[] = list(r.medicationChanges)
    .map((m: Record<string, unknown>) => ({
      name: str(m?.name, 80),
      change: CHANGES.includes(m?.change as MedicationChange["change"]) ? (m.change as MedicationChange["change"]) : "change",
      detail: str(m?.detail, 300),
    }))
    .filter((m) => m.name && m.detail && mentioned(m.name, transcript))
    .slice(0, 8);

  const terms: VisitTerm[] = list(r.terms)
    .map((t: Record<string, unknown>) => ({ term: str(t?.term, 60), meaning: str(t?.meaning, 240) }))
    .filter((t) => t.term && t.meaning)
    .slice(0, 8);

  const summary = str(r.summary, 600);
  return {
    title: str(r.title, 120) || "Your visit",
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : undefined,
    summary,
    // Never leave the player with nothing to say.
    script: script.length ? script : summary ? [summary] : [],
    medicationChanges,
    nextSteps: strings(r.nextSteps, 240, 6),
    watchFor: strings(r.watchFor, 240, 5),
    terms,
    questions: strings(r.questions, 200, 3),
  };
}

// Plain-text version of a recap, for copying or downloading the transcript of what Clara says.
export function recapToText(recap: VisitRecap, dateLabel?: string): string {
  const lines = [recap.title, dateLabel ?? "", "", "What Clara says", "", ...recap.script.flatMap((p) => [p, ""])];
  const section = (heading: string, items: string[]) => {
    if (items.length) lines.push(heading, ...items.map((i) => `- ${i}`), "");
  };
  section("Medicine changes", recap.medicationChanges.map((m) => `${m.name}: ${m.detail}`));
  section("Next steps", recap.nextSteps);
  section("Call your care team if", recap.watchFor);
  section("Words from your visit", recap.terms.map((t) => `${t.term}: ${t.meaning}`));
  section("Questions to ask", recap.questions);
  lines.push("Clara explains what was said at your visit. It does not replace your care team.");
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}
