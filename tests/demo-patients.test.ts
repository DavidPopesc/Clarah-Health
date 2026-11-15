import assert from "node:assert/strict";
import test from "node:test";

import { assessHealth } from "../src/lib/attention.ts";
import { DEMO_PATIENTS, demoWeek, findDemoPatient } from "../src/lib/demo-patients.ts";

const today = new Date("2026-11-15T12:00:00Z");

test("each demo patient's main issue is among their top health areas", () => {
  const expected: Record<string, string> = { amira: "cardiometabolic", grace: "cancer", marcus: "mental-health", sofia: "pregnancy" };
  for (const patient of DEMO_PATIENTS) {
    const { themes } = assessHealth(patient.record, demoWeek(patient, today));
    const top = themes.slice(0, 2).map((theme) => theme.id);
    assert.ok(top.includes(expected[patient.id] as never), `${patient.id}: ${top.join(", ")}`);
  }
});

test("chemotherapy blood counts flag infection risk and anemia", () => {
  const grace = findDemoPatient("grace");
  const { items } = assessHealth(grace.record, demoWeek(grace, today));
  assert.equal(items.find((item) => item.id === "anc")?.level, "attention");
  assert.ok(items.some((item) => item.id === "hemoglobin" && item.themeId === "blood"));
});

test("blood pressure in pregnancy is explained as a preeclampsia warning", () => {
  const sofia = findDemoPatient("sofia");
  const bp = assessHealth(sofia.record, demoWeek(sofia, today)).items.find((item) => item.id === "bp");
  assert.equal(bp?.themeId, "pregnancy");
  assert.match(bp?.why ?? "", /preeclampsia/);
});

test("PTSD symptom scores show their trend", () => {
  const marcus = findDemoPatient("marcus");
  const item = assessHealth(marcus.record, demoWeek(marcus, today)).items.find((i) => i.id === "mental-health");
  assert.match(item?.detail ?? "", /PCL-5 \(PTSD symptom score\) 39, down from 46/);
});

test("unknown demo patient ids fall back to Amira", () => {
  assert.equal(findDemoPatient("nobody").id, "amira");
});
