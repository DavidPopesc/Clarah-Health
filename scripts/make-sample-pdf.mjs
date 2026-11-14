// Writes public/samples/lab-report.pdf: a synthetic lab report and visit note for the
// demo patient, so the PDF summary can be tried without real medical records.
// Usage: node scripts/make-sample-pdf.mjs

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "public/samples/lab-report.pdf");

const doc = await PDFDocument.create();
doc.setTitle("Sample lab results and visit summary (synthetic)");
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const grey = rgb(0.35, 0.38, 0.37);

function page(title) {
  const p = doc.addPage([612, 792]);
  let y = 740;
  const line = (text, { f = font, size = 10, color = rgb(0, 0, 0), x = 50, gap = 15 } = {}) => {
    p.drawText(text, { x, y, size, font: f, color });
    y -= gap;
  };
  line("Peachtree Family Medicine", { f: bold, size: 14, gap: 16 });
  line("SYNTHETIC SAMPLE FOR DEMONSTRATION - NOT A REAL PATIENT", { size: 8, color: rgb(0.7, 0.1, 0.1), gap: 22 });
  line("Patient: Amira Haddad    DOB: 03/12/1974    MRN: DEMO-000123", { size: 9, color: grey, gap: 22 });
  line(title, { f: bold, size: 12, gap: 20 });
  return { line, row: (cells, opts = {}) => {
    const xs = [50, 250, 330, 420, 520];
    cells.forEach((c, i) => p.drawText(c, { x: xs[i], y, size: 9.5, font: opts.f ?? font }));
    y -= 16;
  }, gap: (n) => (y -= n) };
}

// Page 1: lab results
const p1 = page("Laboratory Results");
p1.line("Collected: 11/02/2026 08:10    Reported: 11/03/2026    Ordering: Dr. L. Okafor", { size: 9, color: grey, gap: 22 });
p1.row(["Test", "Result", "Units", "Reference", "Flag"], { f: bold });
const labs = [
  ["Hemoglobin A1c", "7.1", "%", "4.0 - 5.6", "H"],
  ["Glucose, fasting", "128", "mg/dL", "70 - 99", "H"],
  ["LDL cholesterol", "108", "mg/dL", "< 100", "H"],
  ["HDL cholesterol", "48", "mg/dL", "> 45", ""],
  ["Triglycerides", "162", "mg/dL", "< 150", "H"],
  ["Creatinine", "0.92", "mg/dL", "0.57 - 1.00", ""],
  ["eGFR", "79", "mL/min/1.73m2", "> 59", ""],
  ["Urine albumin/creatinine ratio", "42", "mg/g", "< 30", "H"],
  ["Potassium", "4.4", "mmol/L", "3.5 - 5.2", ""],
  ["ALT", "38", "U/L", "7 - 35", "H"],
];
for (const r of labs) p1.row(r);
p1.gap(12);
p1.line("H = above reference range. Reference ranges are for adults and may vary by lab.", { size: 8.5, color: grey });

// Page 2: visit summary
const p2 = page("Office Visit Summary");
p2.line("Visit date: 11/05/2026    Provider: Dr. L. Okafor, MD    Reason: Diabetes follow-up", { size: 9, color: grey, gap: 22 });
const note = [
  ["Vitals", true],
  ["Blood pressure 142/90 mmHg (repeat 140/88). Pulse 72. Weight 78.4 kg.", false],
  ["", false],
  ["Assessment", true],
  ["1. Type 2 diabetes: A1c improved to 7.1% from 7.4%. Continue metformin 1000 mg twice daily", false],
  ["   and glipizide 5 mg daily.", false],
  ["2. Hypertension, stage 2 range today. Not yet on blood pressure medication.", false],
  ["3. Moderately increased albuminuria (UACR 42 mg/g). Recheck in 3 months.", false],
  ["4. Hyperlipidemia: LDL 108 mg/dL on atorvastatin 20 mg.", false],
  ["", false],
  ["Plan", true],
  ["- Check blood pressure at home twice daily for 2 weeks and send readings via MyChart.", false],
  ["- If home readings stay at or above 130/80, plan to start lisinopril 10 mg daily.", false],
  ["- Repeat urine albumin/creatinine ratio and basic metabolic panel in 3 months.", false],
  ["- Discuss increasing atorvastatin at next visit.", false],
  ["- Follow up in 3 months, sooner if needed.", false],
];
for (const [text, isHead] of note) p2.line(text, { f: isHead ? bold : font, size: isHead ? 10.5 : 10, gap: isHead ? 16 : 14 });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, await doc.save());
console.log(`Wrote ${OUT}`);
