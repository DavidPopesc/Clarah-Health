import assert from "node:assert/strict";
import { test } from "node:test";
import { medInfoFor, medlinePlusSearch } from "../src/lib/med-info.ts";

test("finds the demo patient's medicines", () => {
  for (const name of ["Metformin", "Glipizide", "Atorvastatin"]) assert.ok(medInfoFor(name), name);
});

test("matches names as Epic writes them, and brand names", () => {
  assert.match(medInfoFor("metFORMIN 500 MG tablet")!.what, /diabetes/i);
  assert.match(medInfoFor("Lipitor 20mg")!.what, /statin/i);
  assert.match(medInfoFor("lisinopril-hydrochlorothiazide")!.what, /blood pressure/i);
});

test("doesn't match part of a word", () => {
  assert.equal(medInfoFor("Aspirinol"), null);
});

test("returns null for medicines without a summary", () => {
  assert.equal(medInfoFor("Zyxoprine 5 mg"), null);
});

test("every summary lists at least one side effect", () => {
  for (const name of ["metformin", "insulin glargine", "Ozempic", "sertraline", "Concerta"]) {
    assert.ok(medInfoFor(name)!.sideEffects.length > 0, name);
  }
});

test("MedlinePlus link searches by the medicine's first word", () => {
  assert.match(medlinePlusSearch("Atorvastatin 20 mg"), /query=Atorvastatin$/);
});
