import assert from "node:assert/strict";
import { test } from "node:test";
import { verifySummary } from "../src/lib/doc-verify.ts";

const pages = [
  "Laboratory Results\nHemoglobin A1c 7.1 % 4.0 - 5.6 H\nLDL cholesterol 108 mg/dL < 100 H",
  "Office Visit Summary\nBlood pressure 142/90 mmHg (repeat 140/88). Pulse 72.",
];

const raw = (refs: { page: number; quote: string }[]) => ({
  title: "Labs",
  kind: "lab",
  summary: "s",
  findings: [{ title: "A1c", status: "attention", explanation: "e", refs }],
  questions: [],
});

test("keeps quotes that appear in the document", () => {
  const s = verifySummary(raw([{ page: 1, quote: "Hemoglobin A1c 7.1 % 4.0 - 5.6 H" }]), pages);
  assert.deepEqual(s.findings[0].refs, [{ page: 1, quote: "Hemoglobin A1c 7.1 % 4.0 - 5.6 H" }]);
});

test("drops quotes that were made up or reworded", () => {
  const s = verifySummary(raw([{ page: 1, quote: "Hemoglobin A1c 6.5 %" }, { page: 2, quote: "BP was 150/95" }]), pages);
  assert.deepEqual(s.findings[0].refs, []);
});

test("fixes the page number when the quote is on another page", () => {
  const s = verifySummary(raw([{ page: 1, quote: "Blood pressure 142/90 mmHg" }]), pages);
  assert.equal(s.findings[0].refs[0].page, 2);
});

test("tolerates different spacing from PDF text extraction", () => {
  const s = verifySummary(raw([{ page: 1, quote: "LDL  cholesterol 108   mg/dL" }]), pages);
  assert.equal(s.findings[0].refs.length, 1);
});

test("puts findings that need attention first and cleans bad fields", () => {
  const s = verifySummary(
    {
      kind: "nonsense",
      findings: [
        { title: "Fine", status: "good", explanation: "ok", refs: [] },
        { title: "Bad", status: "attention", explanation: "act", refs: [] },
        { title: "", status: "info", explanation: "no title", refs: [] },
      ],
    },
    pages,
  );
  assert.equal(s.kind, "other");
  assert.deepEqual(s.findings.map((f) => f.title), ["Bad", "Fine"]);
});
