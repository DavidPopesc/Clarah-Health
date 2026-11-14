// Types for visit recaps, and the check that turns the AI's raw reply into a safe, well-formed
// recap. Kept free of runtime imports so it runs in the browser, the server and `node --test`.

export interface NextStep {
  step: string; // what the clinician asked the patient to do
  why?: string; // why it matters, in plain words
}

export interface VisitRecap {
  title: string;
  date?: string; // YYYY-MM-DD
  summary: string;
  script: string[]; // what Clara says out loud, one paragraph per item
  nextSteps: NextStep[];
  questions: string[];
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);

// Text meant to be spoken: no markdown symbols or list markers for the voice to read out.
const speakable = (s: string) =>
  s
    .replace(/[*_#`>]+/g, "")
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/, "")
    .trim();

// Recaps saved before steps had reasons stored them as plain strings; accept both.
export function toNextStep(v: unknown): NextStep | null {
  if (typeof v === "string") return str(v, 240) ? { step: str(v, 240) } : null;
  const o = (v ?? {}) as Record<string, unknown>;
  const step = str(o.step, 240);
  return step ? { step, why: str(o.why, 300) || undefined } : null;
}

export function normalizeRecap(raw: unknown): VisitRecap {
  const r = (raw ?? {}) as Record<string, unknown>;

  const script = (Array.isArray(r.script) ? r.script : typeof r.script === "string" ? r.script.split(/\n{2,}/) : [])
    .map((p) => speakable(str(p, 900)))
    .filter(Boolean)
    .slice(0, 9);

  const summary = str(r.summary, 600);
  return {
    title: str(r.title, 120) || "Your visit",
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : undefined,
    summary,
    // Never leave the player with nothing to say.
    script: script.length ? script : summary ? [summary] : [],
    nextSteps: list(r.nextSteps)
      .map(toNextStep)
      .filter((s): s is NextStep => s !== null)
      .slice(0, 8),
    questions: list(r.questions)
      .map((q) => str(q, 200))
      .filter(Boolean)
      .slice(0, 3),
  };
}

// Plain-text version of a recap, for copying or downloading the transcript of what Clara says.
export function recapToText(recap: VisitRecap, dateLabel?: string): string {
  const lines = [recap.title, dateLabel ?? "", "", "What Clara says", "", ...recap.script.flatMap((p) => [p, ""])];
  const steps = recap.nextSteps.map(toNextStep).filter((s): s is NextStep => s !== null);
  if (steps.length) lines.push("What to do next", ...steps.map((s) => `- ${s.step}${s.why ? ` (Why: ${s.why})` : ""}`), "");
  if (recap.questions.length) lines.push("Questions you could ask", ...recap.questions.map((q) => `- ${q}`), "");
  lines.push("Clara explains what was said at your visit. It does not replace your care team.");
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n").trim() + "\n";
}
