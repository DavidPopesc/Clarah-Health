// Writes synthetic test documents for the PDF upload to public/samples/test/.
// Every document is for the made-up demo patient and is marked as synthetic.
// Usage: node scripts/make-test-pdfs.mjs

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT_DIR = path.join(ROOT, "public/samples/test");
const grey = rgb(0.35, 0.38, 0.37);
const red = rgb(0.7, 0.1, 0.1);

async function build(file, title, render) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${title} (synthetic)`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = ({ org, heading, sub, patient = true }) => {
    const p = doc.addPage([612, 792]);
    let y = 740;
    const line = (text, { f = font, size = 10, color = rgb(0, 0, 0), x = 50, gap = 14 } = {}) => {
      p.drawText(text, { x, y, size, font: f, color });
      y -= gap;
    };
    const table = (rows, xs = [50, 250, 330, 440, 530]) => {
      rows.forEach((cells, r) => {
        cells.forEach((c, i) => p.drawText(c, { x: xs[i], y, size: 9.5, font: r === 0 ? bold : font }));
        y -= 16;
      });
    };
    line(org, { f: bold, size: 14, gap: 16 });
    line("SYNTHETIC SAMPLE FOR DEMONSTRATION - NOT A REAL PATIENT", { size: 8, color: red, gap: 22 });
    if (patient) line("Patient: Amira Haddad    DOB: 03/12/1974    MRN: DEMO-000123", { size: 9, color: grey, gap: 22 });
    line(heading, { f: bold, size: 12, gap: 18 });
    if (sub) line(sub, { size: 9, color: grey, gap: 20 });
    return { p, line, table, gap: (n) => (y -= n), head: (t) => line(t, { f: bold, size: 10.5, gap: 16 }) };
  };

  await render({ page, doc });
  fs.writeFileSync(path.join(OUT_DIR, file), await doc.save());
  console.log(`  ${file}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log(`Writing to ${OUT_DIR}`);

// 1. Urgent care visit and X-ray for a sprained ankle
await build("1-urgent-care-ankle-sprain.pdf", "Urgent care visit: left ankle", async ({ page }) => {
  const a = page({
    org: "Midtown Urgent Care",
    heading: "Visit Summary",
    sub: "Visit date: 11/10/2026    Provider: J. Alvarez, PA-C    Reason: Left ankle injury",
  });
  a.head("History");
  a.line("Rolled left ankle inward while playing soccer 2 hours ago. Able to take a few steps with pain.");
  a.line("Pain 6/10 on the outside of the ankle. No numbness or tingling. No prior ankle injury.");
  a.gap(6);
  a.head("Vitals");
  a.line("BP 146/92 mmHg (patient in pain). Pulse 84. Temp 98.4 F. SpO2 99%.");
  a.gap(6);
  a.head("Exam");
  a.line("Swelling and bruising over the left lateral malleolus. Tender over the anterior talofibular");
  a.line("ligament (ATFL). No tenderness at the base of the 5th metatarsal or posterior malleolus.");
  a.line("Foot warm with normal pulses and sensation.");
  a.gap(6);
  a.head("Diagnosis");
  a.line("Sprain of left ankle, lateral ligaments (ATFL), grade I-II. S93.402A");
  a.gap(6);
  a.head("Plan");
  for (const t of [
    "- Rest, ice 15-20 minutes every 2-3 hours, compression wrap, keep foot raised for 48-72 hours.",
    "- Lace-up ankle brace. Walk as pain allows; crutches given for the first few days.",
    "- Pain: acetaminophen 1000 mg every 8 hours as needed (max 3000 mg per day).",
    "- Avoid ibuprofen and naproxen for now given elevated blood pressure and recent urine protein.",
    "  Ask your primary care doctor before using any NSAID.",
    "- Start gentle range-of-motion exercises after 3 days (handout given).",
    "- Return or see your doctor if you cannot bear weight after 5 days, numbness, or worsening pain.",
    "- Recheck blood pressure with your primary care doctor this week.",
  ]) a.line(t);

  const b = page({
    org: "Midtown Urgent Care - Radiology",
    heading: "X-ray Report: Left Ankle, 3 views",
    sub: "Exam date: 11/10/2026    Read by: S. Nakamura, MD (Radiology)",
  });
  b.head("Findings");
  b.line("No acute fracture or dislocation. Ankle mortise is intact.");
  b.line("Moderate soft tissue swelling over the lateral malleolus.");
  b.line("Small plantar calcaneal spur, likely chronic and not related to this injury.");
  b.gap(6);
  b.head("Impression");
  b.line("1. No fracture. Findings consistent with a lateral ankle sprain.");
  b.line("2. Incidental small heel spur.");
});

// 2. Annual labs with low B12 and vitamin D
await build("2-annual-labs-b12-vitamin-d.pdf", "Annual labs: CBC, B12, vitamin D, thyroid", async ({ page }) => {
  const a = page({
    org: "Peachtree Family Medicine - Laboratory",
    heading: "Laboratory Results",
    sub: "Collected: 11/12/2026 07:45    Reported: 11/13/2026    Ordering: Dr. L. Okafor",
  });
  a.table([
    ["Test", "Result", "Units", "Reference", "Flag"],
    ["Hemoglobin", "11.4", "g/dL", "12.0 - 15.5", "L"],
    ["Hematocrit", "34.8", "%", "36 - 46", "L"],
    ["MCV", "102", "fL", "80 - 100", "H"],
    ["White blood cells", "6.8", "K/uL", "4.0 - 11.0", ""],
    ["Platelets", "241", "K/uL", "150 - 400", ""],
    ["Vitamin B12", "182", "pg/mL", "232 - 1245", "L"],
    ["Folate", "11.2", "ng/mL", "> 3.9", ""],
    ["Vitamin D, 25-hydroxy", "18", "ng/mL", "30 - 100", "L"],
    ["TSH", "2.1", "mIU/L", "0.45 - 4.5", ""],
  ]);
  a.gap(10);
  a.head("Comment");
  a.line("Mild anemia with large red blood cells (macrocytosis) and low vitamin B12.");
  a.line("Long-term metformin use can lower vitamin B12 levels. Vitamin D insufficiency.");
  a.line("Thyroid function normal. Provider will contact you about next steps.");
});

// 3. Echocardiogram
await build("3-echocardiogram.pdf", "Echocardiogram report", async ({ page }) => {
  const a = page({
    org: "Northside Heart & Vascular",
    heading: "Transthoracic Echocardiogram Report",
    sub: "Study date: 10/28/2026    Indication: Hypertension, diabetes    Reading: R. Mensah, MD",
  });
  a.head("Measurements");
  a.table([
    ["Measurement", "Value", "", "Normal", ""],
    ["LV ejection fraction", "60%", "", "52 - 72%", ""],
    ["Interventricular septum", "1.2 cm", "", "0.6 - 0.9 cm", ""],
    ["LV posterior wall", "1.1 cm", "", "0.6 - 0.9 cm", ""],
    ["Left atrial volume index", "33 mL/m2", "", "< 34 mL/m2", ""],
    ["E/e' ratio", "11", "", "< 14", ""],
  ]);
  a.gap(8);
  a.head("Findings");
  a.line("Normal left ventricular size with normal pumping function (EF 60%).");
  a.line("Mild concentric left ventricular hypertrophy (thickened heart muscle).");
  a.line("Grade I diastolic dysfunction (impaired relaxation).");
  a.line("Aortic, mitral, tricuspid and pulmonic valves are structurally normal without significant leaks.");
  a.line("No pericardial effusion.");
  a.gap(6);
  a.head("Impression");
  a.line("1. Normal heart pumping function.");
  a.line("2. Mild left ventricular hypertrophy and grade I diastolic dysfunction, often seen with");
  a.line("   long-standing high blood pressure. Recommend blood pressure control and clinical follow-up.");
});

// 4. Follow-up where things improved
await build("4-follow-up-improved.pdf", "Three-month follow-up", async ({ page }) => {
  const a = page({
    org: "Peachtree Family Medicine",
    heading: "Office Visit Summary and Labs",
    sub: "Visit date: 02/09/2027    Provider: Dr. L. Okafor, MD    Reason: 3-month diabetes and BP follow-up",
  });
  a.head("Vitals");
  a.line("Blood pressure 126/78 mmHg. Pulse 70. Weight 76.9 kg (down 1.5 kg).");
  a.gap(6);
  a.head("Labs (collected 02/05/2027)");
  a.table([
    ["Test", "Result", "Units", "Reference", "Flag"],
    ["Hemoglobin A1c", "6.8", "%", "4.0 - 5.6", "H"],
    ["LDL cholesterol", "88", "mg/dL", "< 100", ""],
    ["Urine albumin/creatinine ratio", "24", "mg/g", "< 30", ""],
    ["eGFR", "75", "mL/min/1.73m2", "> 59", ""],
    ["Potassium", "4.8", "mmol/L", "3.5 - 5.2", ""],
    ["Vitamin B12", "410", "pg/mL", "232 - 1245", ""],
  ]);
  a.gap(8);
  a.head("Assessment and Plan");
  for (const t of [
    "1. Hypertension: well controlled on lisinopril 10 mg daily. Continue.",
    "2. Type 2 diabetes: A1c 6.8%, at goal. Continue metformin and glipizide.",
    "3. Kidney: urine protein back in normal range on lisinopril. Recheck in 6 months.",
    "4. Cholesterol: LDL at goal on atorvastatin 40 mg. Continue.",
    "5. B12 back to normal on supplement. Continue B12 1000 mcg daily.",
    "Follow up in 6 months. Great progress.",
  ]) a.line(t);
});

// 5. Not medical: a pharmacy receipt
await build("5-not-medical-receipt.pdf", "Store receipt", async ({ page }) => {
  const a = page({ org: "CornerMart Pharmacy & Goods", heading: "Receipt #48213", sub: "11/11/2026 5:42 PM    Register 3", patient: false });
  a.table(
    [
      ["Item", "Qty", "Price", "", ""],
      ["Paper towels 6-pack", "1", "$8.99", "", ""],
      ["Bananas", "1", "$1.89", "", ""],
      ["Elastic bandage 3 in", "1", "$5.49", "", ""],
      ["Instant ice pack", "2", "$6.98", "", ""],
      ["Greeting card", "1", "$4.25", "", ""],
    ],
    [50, 330, 420],
  );
  a.gap(8);
  a.line("Subtotal $27.60    Tax $2.21    Total $29.81");
  a.line("Paid: VISA ending 0000. Thank you for shopping with us!");
});

// 6. "Scanned" document: only graphics, no text layer, to test the can't-read path
{
  const doc = await PDFDocument.create();
  doc.setTitle("Scanned page with no text layer (synthetic)");
  const p = doc.addPage([612, 792]);
  p.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.96, 0.95, 0.92) });
  for (let i = 0; i < 28; i++) {
    const w = 180 + ((i * 97) % 300);
    p.drawRectangle({ x: 60, y: 700 - i * 22, width: w, height: 7, color: rgb(0.45, 0.45, 0.45), opacity: 0.6 });
  }
  fs.writeFileSync(path.join(OUT_DIR, "6-scanned-no-text.pdf"), await doc.save());
  console.log("  6-scanned-no-text.pdf");
}
