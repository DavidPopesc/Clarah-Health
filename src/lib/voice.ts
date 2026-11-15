// Shared pieces of Clarah Health's voice, used by the Overview player and Ask Clarah Health: the speed choices,
// remembering the patient's speed and read-aloud preference on this device, and turning a written
// answer into short plain-text parts for the voice (the speech endpoint takes one part at a time).

export const RATES = [0.85, 1, 1.15] as const;
export const RATE_LABELS: Record<number, string> = { 0.85: "Slower", 1: "Normal", 1.15: "Faster" };

const RATE_KEY = "clara-voice-rate";
const READ_ALOUD_KEY = "clara-read-aloud";

const storage = () => (typeof window === "undefined" ? null : window.localStorage);

export function loadRate(): number {
  const value = Number(storage()?.getItem(RATE_KEY));
  return (RATES as readonly number[]).includes(value) ? value : 1;
}

export function saveRate(rate: number) {
  storage()?.setItem(RATE_KEY, String(rate));
}

export function loadReadAloud(): boolean {
  return storage()?.getItem(READ_ALOUD_KEY) === "on";
}

export function saveReadAloud(on: boolean) {
  storage()?.setItem(READ_ALOUD_KEY, on ? "on" : "off");
}

const MAX_PART = 600;

// Markdown answer -> short spoken parts: no symbols or list markers for the voice to read out,
// headings and bullets turned into sentences, and parts kept small so playback starts quickly.
export function speechParts(markdown: string): string[] {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|[*_`#>]/g, "");
  const sentences = plain
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean)
    .map((line) => (/[.!?:]$/.test(line) ? line : `${line}.`))
    .flatMap((line) => (line.length > MAX_PART ? (line.match(/[^.!?]+[.!?]+["')]*\s*/g) ?? [line]) : [line]))
    .map((s) => s.trim())
    .filter(Boolean);

  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length + 1 > MAX_PART) {
      parts.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) parts.push(current);
  return parts.map((p) => p.slice(0, 1400));
}
