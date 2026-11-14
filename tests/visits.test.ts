import assert from "node:assert/strict";
import { test } from "node:test";
import { mentioned, normalizeRecap, recapToText } from "../src/lib/visit-verify.ts";

const transcript = "Clinician: I'd like to start you on lisinopril, 10 milligrams once a day. Keep the metformin the same.";

test("keeps medication changes named in the conversation", () => {
  const r = normalizeRecap(
    {
      script: ["Your doctor is starting lisinopril."],
      medicationChanges: [
        { name: "Lisinopril", change: "start", detail: "10 milligrams once a day" },
        { name: "Metformin", change: "continue", detail: "Same as now" },
      ],
    },
    transcript,
  );
  assert.deepEqual(
    r.medicationChanges.map((m) => [m.name, m.change]),
    [
      ["Lisinopril", "start"],
      ["Metformin", "continue"],
    ],
  );
});

test("drops medication changes the clinician never mentioned", () => {
  const r = normalizeRecap(
    { script: ["x"], medicationChanges: [{ name: "Amlodipine", change: "start", detail: "5 mg daily" }] },
    transcript,
  );
  assert.deepEqual(r.medicationChanges, []);
});

test("unknown change types become 'change', not dropped", () => {
  const r = normalizeRecap({ script: ["x"], medicationChanges: [{ name: "lisinopril", change: "increase", detail: "d" }] }, transcript);
  assert.equal(r.medicationChanges[0].change, "change");
});

test("cleans the script so the voice doesn't read symbols", () => {
  const r = normalizeRecap({ script: ["**Good news:** your A1c is down.", "- Keep walking.", "   "] }, transcript);
  assert.deepEqual(r.script, ["Good news: your A1c is down.", "Keep walking."]);
});

test("accepts a script given as one string with blank lines", () => {
  const r = normalizeRecap({ script: "First part.\n\nSecond part." }, transcript);
  assert.deepEqual(r.script, ["First part.", "Second part."]);
});

test("falls back to the summary when there is no script", () => {
  const r = normalizeRecap({ summary: "Your A1c improved." }, transcript);
  assert.deepEqual(r.script, ["Your A1c improved."]);
});

test("rejects malformed dates and fills a default title", () => {
  const r = normalizeRecap({ date: "Nov 14", script: ["x"] }, transcript);
  assert.equal(r.date, undefined);
  assert.equal(r.title, "Your visit");
});

test("matches medication names by word, case-insensitively", () => {
  assert.equal(mentioned("Lisinopril (Zestril)", transcript), true);
  assert.equal(mentioned("ASA", transcript), false);
});

test("transcript text includes what Clara says and the sections", () => {
  const r = normalizeRecap(
    { title: "Check-up", script: ["Para one.", "Para two."], nextSteps: ["Blood test in two weeks"], medicationChanges: [{ name: "Lisinopril", change: "start", detail: "10 mg daily" }] },
    transcript,
  );
  const text = recapToText(r, "November 14, 2026");
  assert.match(text, /^Check-up\nNovember 14, 2026\n\nWhat Clara says\n\nPara one\.\n\nPara two\./);
  assert.match(text, /Medicine changes\n- Lisinopril: 10 mg daily/);
  assert.match(text, /Next steps\n- Blood test in two weeks/);
  assert.doesNotMatch(text, /\n\n\n/);
});
