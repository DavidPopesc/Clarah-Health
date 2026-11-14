// Short, plain-language summaries of common medicines for the "What is it?" dropdown.
// Curated, not AI-generated, so the wording is fixed and reviewable. General information only,
// based on standard drug references (e.g. MedlinePlus); not advice for a specific patient.

export interface MedInfo {
  what: string; // what kind of medicine it is and what it's for
  does: string; // how it works, in one sentence
  sideEffects: string[]; // a few common ones
}

interface Entry extends MedInfo {
  names: string[]; // generic and common brand names, lowercase
}

const MEDS: Entry[] = [
  {
    names: ["metformin", "glucophage"],
    what: "A diabetes medicine.",
    does: "Lowers blood sugar by making the liver release less sugar and helping your body use insulin better.",
    sideEffects: ["Upset stomach or diarrhea", "Nausea", "Metallic taste"],
  },
  {
    names: ["glipizide", "glucotrol"],
    what: "A diabetes medicine (a sulfonylurea).",
    does: "Helps your pancreas release more insulin to lower blood sugar.",
    sideEffects: ["Low blood sugar: shaky, sweaty, or confused", "Weight gain", "Upset stomach"],
  },
  {
    names: ["glimepiride", "amaryl", "glyburide"],
    what: "A diabetes medicine (a sulfonylurea).",
    does: "Helps your pancreas release more insulin to lower blood sugar.",
    sideEffects: ["Low blood sugar: shaky, sweaty, or confused", "Weight gain", "Dizziness"],
  },
  {
    names: ["atorvastatin", "lipitor", "rosuvastatin", "crestor", "simvastatin", "zocor", "pravastatin"],
    what: "A cholesterol medicine (a statin).",
    does: "Lowers LDL, the “bad” cholesterol, which lowers the risk of heart attack and stroke.",
    sideEffects: ["Muscle or joint aches", "Upset stomach", "Diarrhea"],
  },
  {
    names: ["lisinopril", "zestril", "prinivil", "enalapril", "ramipril", "benazepril"],
    what: "A blood pressure medicine (an ACE inhibitor).",
    does: "Relaxes blood vessels to lower blood pressure, and helps protect the kidneys.",
    sideEffects: ["Dry cough", "Dizziness", "Headache", "Rarely, swelling of the face or lips: call 911"],
  },
  {
    names: ["losartan", "cozaar", "valsartan", "diovan", "olmesartan", "irbesartan"],
    what: "A blood pressure medicine (an ARB).",
    does: "Relaxes blood vessels to lower blood pressure, and helps protect the kidneys.",
    sideEffects: ["Dizziness", "Tiredness", "High potassium"],
  },
  {
    names: ["amlodipine", "norvasc"],
    what: "A blood pressure medicine (a calcium channel blocker).",
    does: "Relaxes and widens blood vessels so blood flows more easily.",
    sideEffects: ["Swollen ankles", "Flushing", "Headache", "Dizziness"],
  },
  {
    names: ["hydrochlorothiazide", "hctz", "chlorthalidone"],
    what: "A blood pressure medicine (a water pill).",
    does: "Helps your kidneys remove extra salt and water, which lowers blood pressure.",
    sideEffects: ["Peeing more often", "Dizziness", "Low potassium", "Sunburning more easily"],
  },
  {
    names: ["metoprolol", "lopressor", "toprol", "atenolol", "carvedilol", "propranolol"],
    what: "A heart and blood pressure medicine (a beta blocker).",
    does: "Slows your heart rate and lowers blood pressure, easing the heart's work.",
    sideEffects: ["Tiredness", "Dizziness", "Slow heartbeat", "Cold hands or feet"],
  },
  {
    names: ["insulin", "glargine", "lantus", "basaglar", "detemir", "levemir", "lispro", "humalog", "aspart", "novolog", "degludec", "tresiba"],
    what: "Insulin, a diabetes medicine.",
    does: "Replaces or adds to your body's own insulin to move sugar from the blood into cells.",
    sideEffects: ["Low blood sugar: shaky, sweaty, or confused", "Weight gain", "Redness where you inject"],
  },
  {
    names: ["semaglutide", "ozempic", "wegovy", "rybelsus", "dulaglutide", "trulicity", "liraglutide", "victoza", "tirzepatide", "mounjaro"],
    what: "A diabetes and weight medicine (a GLP-1 medicine).",
    does: "Helps your body release insulin after meals, slows digestion, and reduces appetite.",
    sideEffects: ["Nausea", "Vomiting or diarrhea", "Constipation"],
  },
  {
    names: ["empagliflozin", "jardiance", "dapagliflozin", "farxiga", "canagliflozin", "invokana"],
    what: "A diabetes medicine (an SGLT2 inhibitor) that also protects the heart and kidneys.",
    does: "Helps your kidneys remove extra sugar through your urine.",
    sideEffects: ["Peeing more often", "Genital yeast infections", "Dehydration or dizziness"],
  },
  {
    names: ["aspirin"],
    what: "A pain reliever that, in low doses, is used to prevent blood clots.",
    does: "Makes blood cells called platelets less sticky, so clots are less likely to form.",
    sideEffects: ["Upset stomach", "Bruising easily", "Bleeding"],
  },
  {
    names: ["levothyroxine", "synthroid", "levoxyl"],
    what: "A thyroid hormone medicine.",
    does: "Replaces the hormone your thyroid isn't making enough of.",
    sideEffects: ["If the dose is too high: fast heartbeat, shakiness, trouble sleeping"],
  },
  {
    names: ["omeprazole", "prilosec", "pantoprazole", "protonix", "esomeprazole", "nexium"],
    what: "A stomach acid medicine (a proton pump inhibitor).",
    does: "Lowers how much acid your stomach makes, easing heartburn and helping ulcers heal.",
    sideEffects: ["Headache", "Stomach pain", "Diarrhea"],
  },
  {
    names: ["sertraline", "zoloft", "escitalopram", "lexapro", "fluoxetine", "prozac", "citalopram"],
    what: "An antidepressant (an SSRI) for depression and anxiety.",
    does: "Raises serotonin, a brain chemical that helps balance mood.",
    sideEffects: ["Nausea", "Sleep changes", "Headache", "Sexual side effects"],
  },
  {
    names: ["methylphenidate", "ritalin", "concerta", "amphetamine", "adderall", "lisdexamfetamine", "vyvanse"],
    what: "An ADHD medicine (a stimulant).",
    does: "Boosts brain chemicals that help with focus, attention, and impulse control.",
    sideEffects: ["Less appetite", "Trouble sleeping", "Headache", "Faster heartbeat"],
  },
];

// Matches a medication as written in a record ("metFORMIN 500 MG tablet", "Lipitor 20mg")
// to its summary by any generic or brand name it contains.
export function medInfoFor(name: string): MedInfo | null {
  const words: string[] = name.toLowerCase().match(/[a-z]+/g) ?? [];
  const entry = MEDS.find((m) => m.names.some((n) => words.includes(n)));
  if (!entry) return null;
  const { what, does, sideEffects } = entry;
  return { what, does, sideEffects };
}

// A trusted place to read more about any medicine, including ones without a summary.
export const medlinePlusSearch = (name: string) =>
  `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus&query=${encodeURIComponent(name.split(/\s+/)[0])}`;
