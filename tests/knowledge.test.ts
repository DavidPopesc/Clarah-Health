import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseKnowledgeFile, extractAliases } = require("../scripts/knowledge/parse.mjs");

test("extracts brand, common, and alternate names", () => {
  assert.deepEqual(extractAliases("Brand names: Tylenol, Panadol\nAlso called: fever reducer\nCommon Names: paracetamol; acetaminophen"), ["Tylenol", "Panadol", "fever reducer", "paracetamol", "acetaminophen"]);
});

test("parses metadata, summary, and bounded section passages", () => {
  const input = `# Metformin (drug label)\n\nSource: FDA\nURL: https://example.org/metformin\nRetrieved: today\n\n---\n\nBrand names: Glucophage, Fortamet\n\n## What it does\n\n${"Metformin helps control glucose. ".repeat(80)}\n\n## Safety\n\nAsk your clinician.`;
  const { library, passages } = parseKnowledgeFile("/tmp/drugs/metformin-drug-label.md", input);
  assert.equal(library.title, "Metformin");
  assert.equal(library.kind, "Medication");
  assert.deepEqual(library.aliases, ["Glucophage", "Fortamet"]);
  assert.ok(library.summary.length <= 400);
  assert.ok(passages.length >= 4);
  assert.ok(passages.every((p: { text: string }) => p.text.length <= 900));
  assert.equal(passages.at(-1).section, "Safety");
  assert.equal(passages.at(-1).doc_id, library.id);
});
