import assert from "node:assert/strict";
import { test } from "node:test";
import { assessHealth, classifyDocumentFinding } from "../src/lib/attention.ts";
import { demoRecord, demoWearable } from "../src/lib/demo-data.ts";

test("groups related findings into parent health areas", () => {
  const { themes } = assessHealth(demoRecord, demoWearable(new Date("2026-11-14T12:00:00Z")));
  const cardiometabolic = themes.find((theme) => theme.id === "cardiometabolic");

  assert.ok(cardiometabolic);
  assert.deepEqual(cardiometabolic.items.map((item) => item.id), ["bp", "a1c", "hypo"]);
});

test("keeps ADHD separate and shows related care areas", () => {
  const { themes } = assessHealth(demoRecord, demoWearable(new Date("2026-11-14T12:00:00Z")));
  const adhd = themes.find((theme) => theme.id === "adhd");

  assert.ok(adhd);
  assert.equal(adhd.items[0]?.id, "adhd");
  assert.deepEqual(adhd.relationships.map((relationship) => relationship.themeId), ["daily-routines", "mental-health", "cardiometabolic"]);
});

test("routes uploaded document findings into the matching theme and subissue", () => {
  assert.deepEqual(classifyDocumentFinding({
    title: "LDL cholesterol is above goal",
    explanation: "LDL was 108 mg/dL.",
    comparison: "It was 96 mg/dL last year.",
  }), { themeId: "cardiometabolic", itemId: "ldl" });

  assert.deepEqual(classifyDocumentFinding({
    title: "Urine protein is new and high",
    explanation: "The clinician plans to repeat the kidney test.",
    comparison: undefined,
  }), { themeId: "kidney", itemId: "egfr" });

  assert.deepEqual(classifyDocumentFinding({
    title: "Anxiety follow-up",
    explanation: "The note reviews worsening anxiety symptoms.",
    comparison: undefined,
  }), { themeId: "mental-health", itemId: "mental-health" });
});
