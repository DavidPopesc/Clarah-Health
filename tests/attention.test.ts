import { METRIC_INFO, changeSentence, goalSentence } from "../src/lib/metrics.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { assessHealth, classifyDocumentFinding, summarizeProgress } from "../src/lib/attention.ts";
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

test("recognizes improvement while a result is still above goal", () => {
  const { items, themes } = assessHealth(demoRecord, demoWearable());
  const progress = items.find((item) => item.id === "a1c")?.progress;
  assert.deepEqual(progress, {
    direction: "improving",
    label: "Closer to goal",
    key: "a1c",
    metric: "Average blood sugar",
    parts: [{ label: "Average blood sugar", previous: 7.9, current: 7.4 }],
    previousValue: "7.9%",
    currentValue: "7.4%",
    previousDate: "2026-03-10",
    currentDate: "2026-09-15",
  });
  const parent = themes.find((theme) => theme.id === "cardiometabolic");
  assert.ok(parent);
  assert.deepEqual(summarizeProgress(parent.items), { direction: "mixed", label: "Mixed progress" });
});

test("distinguishes worsening, unchanged, and missing comparisons", () => {
  for (const [value, direction] of [[8.4, "worsening"], [7.9, "unchanged"]] as const) {
    const record = structuredClone(demoRecord);
    record.labs.find((lab) => lab.name === "Hemoglobin A1c" && lab.date === "2026-09-15")!.value = value;
    const { items } = assessHealth(record, demoWearable());
    assert.equal(items.find((item) => item.id === "a1c")?.progress?.direction, direction);
  }
  const record = structuredClone(demoRecord);
  record.labs = record.labs.filter((lab) => lab.date !== "2026-03-10");
  const { items } = assessHealth(record, demoWearable());
  assert.equal(items.find((item) => item.id === "a1c")?.progress, undefined);
  assert.equal(items.find((item) => item.id === "adhd")?.progress, undefined);
  assert.deepEqual(summarizeProgress(items.filter((item) => item.id === "adhd")), { direction: "unknown", label: "New" });
});

test("compares blood pressure components separately rather than adding them", () => {
  const record = structuredClone(demoRecord);
  record.bloodPressure = [
    { date: "2026-06-02", systolic: 150, diastolic: 80 },
    { date: "2026-09-15", systolic: 140, diastolic: 85 },
  ];
  const { items } = assessHealth(record, demoWearable());
  assert.equal(items.find((item) => item.id === "bp")?.progress?.direction, "mixed");
});

test("keeps urgent action visible even when blood pressure improves", () => {
  const record = structuredClone(demoRecord);
  record.bloodPressure = [
    { date: "2026-06-02", systolic: 210, diastolic: 135 },
    { date: "2026-09-15", systolic: 190, diastolic: 125 },
  ];
  const { items } = assessHealth(record, demoWearable());
  const bp = items.find((item) => item.id === "bp");
  assert.equal(bp?.progress?.direction, "improving");
  assert.equal(bp?.level, "urgent");
});

test("retains improvement when a result reaches the expected range", () => {
  const record = structuredClone(demoRecord);
  record.labs.find((lab) => lab.name === "Hemoglobin A1c" && lab.date === "2026-09-15")!.value = 6.8;
  const { items, good } = assessHealth(record, demoWearable());
  assert.equal(items.some((item) => item.id === "a1c"), false);
  assert.equal(good.find((item) => item.label === "Average blood sugar")?.progress?.label, "Reached expected range");
});

test("does not compare duplicate-date results or incompatible units", () => {
  for (const previous of [
    { name: "Hemoglobin A1c", value: 8.4, unit: "%", date: "2026-09-15" },
    { name: "Hemoglobin A1c", value: 64, unit: "mmol/mol", date: "2026-03-10" },
  ]) {
    const record = structuredClone(demoRecord);
    record.labs = record.labs.filter((lab) => lab.name !== "Hemoglobin A1c");
    record.labs.push(previous, { name: "Hemoglobin A1c", value: 7.4, unit: "%", date: "2026-09-15" });
    const { items } = assessHealth(record, demoWearable());
    assert.equal(items.find((item) => item.id === "a1c")?.progress, undefined);
  }
});

test("uses the previous dated result even if history is unsorted", () => {
  const record = structuredClone(demoRecord);
  record.labs.reverse();
  record.labs.push({ name: "Hemoglobin A1c", value: 9, unit: "%", date: "2025-01-01" });
  const { items } = assessHealth(record, demoWearable());
  assert.equal(items.find((item) => item.id === "a1c")?.progress?.previousValue, "7.9%");
});

test("compares LDL and eGFR with their most recent earlier results", () => {
  const record = structuredClone(demoRecord);
  record.labs.push(
    { name: "LDL cholesterol", value: 150, unit: "mg/dL", date: "2026-03-10" },
    { name: "LDL cholesterol", value: 120, unit: "mg/dL", date: "2026-10-15" },
    { name: "eGFR", value: 45, unit: "mL/min/1.73m2", date: "2026-10-15" },
    { name: "eGFR", value: 55, unit: "mL/min/1.73m2", date: "2026-11-15" },
  );
  const { items } = assessHealth(record, demoWearable());
  assert.equal(items.find((item) => item.id === "ldl")?.progress?.direction, "worsening");
  assert.equal(items.find((item) => item.id === "ldl")?.progress?.previousValue, "96 mg/dL");
  assert.equal(items.find((item) => item.id === "egfr")?.progress?.direction, "improving");
});

test("summarizes improvement and stable results without counting unmeasured concerns", () => {
  const record = structuredClone(demoRecord);
  record.bloodPressure = [];
  const { items } = assessHealth(record, demoWearable());
  assert.deepEqual(summarizeProgress(items), { direction: "improving", label: "Making progress" });

  record.labs.find((lab) => lab.name === "Hemoglobin A1c" && lab.date === "2026-09-15")!.value = 7.9;
  assert.deepEqual(summarizeProgress(assessHealth(record, demoWearable()).items), { direction: "unchanged", label: "Holding steady" });
});

test("marks lower elevated LDL as progress", () => {
  const record = structuredClone(demoRecord);
  record.labs = record.labs.filter((lab) => !/ldl/i.test(lab.name));
  record.labs.push(
    { name: "LDL cholesterol", value: 150, unit: "mg/dL", date: "2026-03-10" },
    { name: "LDL cholesterol", value: 120, unit: "mg/dL", date: "2026-09-15" },
  );
  const { items } = assessHealth(record, demoWearable());
  assert.equal(items.find((item) => item.id === "ldl")?.progress?.direction, "improving");
});

test("explains changes and goal distance in plain language", () => {
  const blood = [{ label: "Top number", previous: 134, current: 138 }, { label: "Bottom number", previous: 86, current: 88 }];
  assert.equal(changeSentence("bp", blood), "Top number 3% higher than last time");
  assert.equal(goalSentence("bp", [138, 88]), "18 points over goal");
  assert.equal(goalSentence("bp", [118, 84]), "4 points over goal");
  assert.equal(changeSentence("a1c", [{ label: "Average blood sugar", previous: 7.9, current: 7.4 }]), "6% lower than last time");
  assert.equal(goalSentence("a1c", [7.4]), "0.4 over goal");
  assert.equal(goalSentence("egfr", [55]), "5 under goal");
  assert.equal(goalSentence("ldl", [96]), "Within goal");
  assert.equal(METRIC_INFO.a1c.category([7.4]), "Diabetes range");
});
