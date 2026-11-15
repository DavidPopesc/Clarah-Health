#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { parseKnowledgeFile } from "./parse.mjs";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const embed = !args.includes("--no-embed");
// Small clusters (e.g. Typesense Cloud's 0.5 GB tier) can't hold the model plus 12k passage vectors:
// --embed-library-only keeps hybrid search for the library and keyword search for passages.
const embedPassages = embed && !args.includes("--embed-library-only");
const root = path.resolve(args.find((a) => !a.startsWith("--")) ?? "data/knowledge/upload");
const host = process.env.TYPESENSE_HOST;
const key = process.env.TYPESENSE_ADMIN_KEY;
if (!host || !key) throw new Error("Set TYPESENSE_HOST and TYPESENSE_ADMIN_KEY before indexing");
const base = `${process.env.TYPESENSE_PROTOCOL ?? "https"}://${host}:${process.env.TYPESENSE_PORT ?? "443"}`;

async function api(route, init = {}) {
  const response = await fetch(`${base}${route}`, { ...init, headers: { "X-TYPESENSE-API-KEY": key, "Content-Type": "application/json", ...init.headers } });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${route}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const embeddingField = (from) => ({ name: "embedding", type: "float[]", embed: { from, model_config: { model_name: "ts/all-MiniLM-L12-v2" } } });
const libraryFields = [
  { name: "title", type: "string" }, { name: "kind", type: "string", facet: true },
  { name: "aliases", type: "string[]", optional: true }, { name: "summary", type: "string" },
  { name: "body", type: "string", index: false }, { name: "url", type: "string", index: false },
  { name: "source", type: "string", index: false },
];
const passageFields = [
  { name: "doc_id", type: "string", facet: true }, { name: "title", type: "string" },
  { name: "kind", type: "string", facet: true }, { name: "section", type: "string" },
  { name: "text", type: "string" }, { name: "url", type: "string", index: false },
  { name: "source", type: "string", index: false },
];

async function ensureCollection(name, fields) {
  if (reset) {
    try { await api(`/collections/${name}`, { method: "DELETE" }); } catch (error) { if (!String(error).includes("404")) throw error; }
  }
  try {
    await api("/collections", { method: "POST", body: JSON.stringify({ name, fields: (name === "clarah_library" ? embed : embedPassages) ? [...fields, embeddingField(name === "clarah_library" ? ["title", "aliases", "summary"] : ["title", "section", "text"])] : fields }) });
  } catch (error) {
    if (!String(error).includes("409")) throw error;
  }
}

const synonyms = [
  ["sugar", "glucose"], ["blood sugar test", "a1c", "hemoglobin a1c", "glucose test", "sugar test"],
  ["water pill", "diuretic", "furosemide"], ["blood thinner", "anticoagulant"],
  ["high blood pressure", "hypertension"], ["low blood pressure", "hypotension"],
  ["heart attack", "myocardial infarction"], ["kidney", "renal"], ["liver", "hepatic"],
  ["tylenol", "acetaminophen", "paracetamol"], ["advil", "motrin", "ibuprofen"],
  // Labels say "pregnant" and "breast-feeding"; people ask about "pregnancy" and "nursing".
  ["pregnancy", "pregnant", "expecting"], ["breastfeeding", "breast-feeding", "nursing", "lactation"],
  ["heartburn", "acid reflux", "gerd"], ["stroke", "cerebrovascular accident"],
  ["high cholesterol", "hyperlipidemia"], ["low blood sugar", "hypoglycemia"],
  ["high blood sugar", "hyperglycemia"], ["shortness of breath", "dyspnea"],
  ["swelling", "edema"], ["fever", "pyrexia"], ["painkiller", "analgesic"],
  ["pee", "urine"], ["blood count", "cbc", "complete blood count"],
  ["thyroid test", "tsh"], ["iron deficiency", "anemia"], ["vitamin b12", "cobalamin"],
  ["vitamin d", "cholecalciferol"], ["inflammation", "swelling"],
  ["water pills", "diuretics"], ["chest pain", "angina"], ["bone thinning", "osteoporosis"],
  ["joint pain", "arthralgia"], ["itching", "pruritus"], ["nausea", "queasiness"],
  ["fast heartbeat", "tachycardia"], ["slow heartbeat", "bradycardia"],
  ["breathing test", "spirometry"], ["kidney function", "creatinine", "egfr"],
];

async function installSynonyms() {
  const name = "clarah-lay-medical";
  await api(`/synonym_sets/${name}`, { method: "PUT", body: JSON.stringify({ items: synonyms.map((terms, index) => ({ id: `lay-medical-${index + 1}`, synonyms: terms })) }) });
  // Both collections: the library page and Clarah's passage search ("tylenol" finds acetaminophen).
  for (const collection of ["clarah_library", "clarah_passages"]) {
    await api(`/collections/${collection}`, { method: "PATCH", body: JSON.stringify({ synonym_sets: [name] }) });
  }
}

async function importDocs(name, docs) {
  let failures = 0;
  for (let i = 0; i < docs.length; i += 100) {
    const response = await fetch(`${base}/collections/${name}/documents/import?action=upsert`, {
      method: "POST", headers: { "X-TYPESENSE-API-KEY": key, "Content-Type": "text/plain" },
      body: docs.slice(i, i + 100).map((doc) => JSON.stringify(doc)).join("\n"),
    });
    // One JSON result per document; under memory pressure Typesense can drop the newlines.
    const lines = (await response.text()).trim().split(/\n|(?<=\})(?=\{)/);
    if (!response.ok) throw new Error(`Import ${name}: ${response.status} ${lines[0]}`);
    for (const line of lines) {
      const result = JSON.parse(line);
      if (!result.success) {
        failures++;
        if (failures <= 3) console.error(`${name} import error:`, result.error ?? result.message);
      }
    }
    process.stdout.write(`\r${name}: ${Math.min(i + 100, docs.length)}/${docs.length}`);
  }
  console.log();
  if (failures) throw new Error(`${failures} ${name} documents failed to import`);
}

if (args.includes("--synonyms-only")) {
  await installSynonyms();
  console.log(`Installed ${synonyms.length} synonyms`);
} else {
  await ensureCollection("clarah_library", libraryFields);
  await ensureCollection("clarah_passages", passageFields);
  const library = [], passages = [];
  for (const folder of ["topics", "labtests", "herbs", "drugs"]) {
    for (const name of (await fs.readdir(path.join(root, folder))).filter((n) => n.endsWith(".md"))) {
      const file = path.join(root, folder, name);
      const parsed = parseKnowledgeFile(file, await fs.readFile(file, "utf8"));
      library.push(parsed.library);
      passages.push(...parsed.passages);
    }
  }
  console.log(`Parsed ${library.length} library documents and ${passages.length} passages (embeddings: library ${embed ? "on" : "off"}, passages ${embedPassages ? "on" : "off"})`);
  await importDocs("clarah_library", library);
  await importDocs("clarah_passages", passages);
  await installSynonyms();
  console.log(`Indexed ${library.length} documents, ${passages.length} passages, and ${synonyms.length} synonyms`);
}
