import assert from "node:assert/strict";
import { test } from "node:test";
import { screenMessage } from "../src/lib/red-flags.ts";

const cases: [string, string | null][] = [
  ["My BP is 184/122 and I have a bad headache", "emergency"],
  ["my blood pressure was 185 over 110", "urgent"],
  ["I have chest pain", "emergency"],
  ["I have no chest pain, just curious about fasting", null],
  ["my sugar is 62", "urgent"],
  ["glucose reading 140 this morning", null],
  ["sometimes I want to die", "crisis_line"],
  ["Ramadan starts in February. Is it okay for me to fast with my diabetes meds?", null],
  ["What does 138/88 mean?", null],
  ["I can't breathe well", "emergency"],
];

for (const [text, level] of cases) {
  test(`screens "${text}" as ${level ?? "safe"}`, () => {
    assert.equal(screenMessage(text)?.level ?? null, level);
  });
}
