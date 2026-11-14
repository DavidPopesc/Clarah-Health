import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeRecap, recapToText, toNextStep } from "../src/lib/visit-verify.ts";

test("keeps next steps with the reason they matter", () => {
  const r = normalizeRecap({
    script: ["x"],
    nextSteps: [
      { step: "Blood test in two weeks", why: "Your new medicine can change potassium and kidney numbers." },
      { step: "Walk most days" },
      { why: "no step, so this is dropped" },
    ],
  });
  assert.deepEqual(r.nextSteps, [
    { step: "Blood test in two weeks", why: "Your new medicine can change potassium and kidney numbers." },
    { step: "Walk most days", why: undefined },
  ]);
});

test("reads next steps saved as plain text by older recaps", () => {
  assert.deepEqual(toNextStep("Come back in three months"), { step: "Come back in three months" });
  assert.equal(toNextStep("   "), null);
  assert.equal(toNextStep(42), null);
});

test("cleans the script so the voice doesn't read symbols", () => {
  const r = normalizeRecap({ script: ["**Good news:** your A1c is down.", "- Keep walking.", "   "] });
  assert.deepEqual(r.script, ["Good news: your A1c is down.", "Keep walking."]);
});

test("accepts a script given as one string with blank lines", () => {
  const r = normalizeRecap({ script: "First part.\n\nSecond part." });
  assert.deepEqual(r.script, ["First part.", "Second part."]);
});

test("falls back to the summary when there is no script", () => {
  const r = normalizeRecap({ summary: "Your A1c improved." });
  assert.deepEqual(r.script, ["Your A1c improved."]);
});

test("rejects malformed dates and fills a default title", () => {
  const r = normalizeRecap({ date: "Nov 14", script: ["x"] });
  assert.equal(r.date, undefined);
  assert.equal(r.title, "Your visit");
});

test("caps questions at three", () => {
  const r = normalizeRecap({ script: ["x"], questions: ["a", "b", "c", "d"] });
  assert.deepEqual(r.questions, ["a", "b", "c"]);
});

test("transcript text includes what Clara says, next steps with reasons, and questions", () => {
  const r = normalizeRecap({
    title: "Check-up",
    script: ["Para one.", "Para two."],
    nextSteps: [{ step: "Blood test in two weeks", why: "To check your kidneys on the new medicine." }],
    questions: ["When should I take it?"],
  });
  const text = recapToText(r, "November 14, 2026");
  assert.match(text, /^Check-up\nNovember 14, 2026\n\nWhat Clara says\n\nPara one\.\n\nPara two\./);
  assert.match(text, /What to do next\n- Blood test in two weeks \(Why: To check your kidneys on the new medicine\.\)/);
  assert.match(text, /Questions you could ask\n- When should I take it\?/);
  assert.doesNotMatch(text, /Medicine changes|Call your care team if|Words from your visit/);
  assert.doesNotMatch(text, /\n\n\n/);
});
