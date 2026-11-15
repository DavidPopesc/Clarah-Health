import assert from "node:assert/strict";
import { test } from "node:test";
import { demoRecord } from "../src/lib/demo-data.ts";
import { dateWords, summarizeBloodPressure, summarizeLabs } from "../src/lib/record-summary.ts";

test("marks the newest A1c as latest even when the record lists the older one first", () => {
  const a1c = summarizeLabs(demoRecord.labs).find((l) => l.test === "Hemoglobin A1c")!;
  assert.deepEqual(a1c.latest, { value: 7.4, date: "Sep 15, 2026" });
  assert.deepEqual(a1c.earlier, [{ value: 7.9, date: "Mar 10, 2026" }]);
  assert.equal(a1c.change, "down 0.5 % from 7.9 on Mar 10, 2026");
});

test("orders by date, not by position, and lists earlier results newest first", () => {
  const labs = [
    { name: "LDL cholesterol", value: 108, unit: "mg/dL", date: "2026-11-02" },
    { name: "LDL cholesterol", value: 120, unit: "mg/dL", date: "2025-01-20" },
    { name: "LDL cholesterol", value: 96, unit: "mg/dL", date: "2026-09-15" },
  ];
  const [ldl] = summarizeLabs(labs);
  assert.equal(ldl.latest.value, 108);
  assert.deepEqual(ldl.earlier.map((e) => e.value), [96, 120]);
  assert.equal(ldl.change, "up 12 mg/dL from 96 on Sep 15, 2026");
});

test("a single result has no change", () => {
  const [egfr] = summarizeLabs([{ name: "eGFR", value: 88, unit: "mL/min/1.73m2", date: "2026-09-15" }]);
  assert.equal(egfr.change, undefined);
  assert.deepEqual(egfr.earlier, []);
});

test("blood pressure: latest reading first, with its category", () => {
  const bp = summarizeBloodPressure(demoRecord.bloodPressure, (r) => (r.systolic >= 130 ? "Stage 1" : "Elevated"));
  assert.deepEqual(bp.latest, { reading: "138/88", date: "Sep 15, 2026", category: "Stage 1" });
  assert.equal(bp.earlier[0].date, "Jun 2, 2026");
});

test("dates are written in words without timezone drift", () => {
  assert.equal(dateWords("2026-01-01"), "Jan 1, 2026");
  assert.equal(dateWords("2026-12-31"), "Dec 31, 2026");
});
