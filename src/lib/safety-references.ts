import type { Source } from "./types";

// Curated, citable reference cards. The agent must ground any "is X safe with my
// meds" answer in one of these rather than inventing interactions.
// Extend this list for more demo cases; keep every card tied to a real source.

export interface SafetyReference extends Source {
  keywords: string[];
  summary: string;
}

export const SAFETY_REFERENCES: SafetyReference[] = [
  {
    id: "ramadan-diabetes",
    title: "IDF-DAR Diabetes and Ramadan Practical Guidelines",
    url: "https://idf.org/news-and-resources/resources/diabetes-and-ramadan-practical-guidelines-2021/",
    keywords: ["ramadan", "fast", "fasting", "iftar", "suhoor", "sehri", "religious fast", "lent", "yom kippur"],
    summary: [
      "Many people with type 2 diabetes can fast safely with a plan made with their clinician before the fast starts.",
      "Sulfonylureas (e.g. glipizide, glimepiride, gliclazide) and insulin carry the highest risk of low blood sugar while fasting; doses or timing are often adjusted. Patients should not change doses on their own.",
      "Metformin has a low risk of hypoglycemia; the daily dose is usually split between the pre-dawn meal (suhoor) and the sunset meal (iftar).",
      "Checking blood sugar with a finger prick does not break the fast. Check more often, especially in the afternoon and before iftar.",
      "Break the fast immediately if blood sugar is below 70 mg/dL or above 300 mg/dL, or with symptoms of low sugar, dehydration, or acute illness.",
    ].join(" "),
  },
  {
    id: "diabetes-supplements",
    title: "NCCIH: Diabetes and Dietary Supplements",
    url: "https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements",
    keywords: ["cinnamon", "bitter melon", "fenugreek", "berberine", "chromium", "herb", "herbs", "supplement", "supplements", "herbal", "tea"],
    summary: [
      "There is not enough evidence that dietary supplements such as cinnamon, chromium, or herbal products treat diabetes.",
      "Supplements are not a replacement for prescribed diabetes medicine.",
      "Some supplements may interact with medicines or affect blood sugar; tell your health care providers about any supplement you use.",
    ].join(" "),
  },
  {
    id: "st-johns-wort",
    title: "NCCIH: St. John's Wort",
    url: "https://www.nccih.nih.gov/health/st-johns-wort",
    keywords: ["st john", "st. john", "saint john", "hypericum"],
    summary: [
      "St. John's wort interacts with many medicines and can make them less effective, including antidepressants, birth control pills, warfarin and other blood thinners, digoxin, some HIV and cancer medicines, and drugs that prevent transplant rejection.",
      "Combining it with some antidepressants can cause serotonin syndrome.",
      "Anyone taking prescription medicine should talk to their provider before using it.",
    ].join(" "),
  },
  {
    id: "ginkgo",
    title: "NCCIH: Ginkgo",
    url: "https://www.nccih.nih.gov/health/ginkgo",
    keywords: ["ginkgo", "gingko"],
    summary: [
      "Ginkgo may increase the risk of bleeding, especially for people taking anticoagulant (blood-thinning) medicines or with bleeding disorders, and before surgery or dental procedures.",
      "Tell your health care providers if you use ginkgo.",
    ].join(" "),
  },
  {
    id: "turmeric",
    title: "NCCIH: Turmeric",
    url: "https://www.nccih.nih.gov/health/turmeric",
    keywords: ["turmeric", "curcumin", "haldi"],
    summary: [
      "Turmeric in food amounts is generally considered safe.",
      "High-dose turmeric or curcumin supplements may cause digestive upset, and there are reports of liver injury with some supplements.",
      "Supplements can interact with medicines; check with your provider or pharmacist, especially if you take blood thinners.",
    ].join(" "),
  },
  {
    id: "grapefruit",
    title: "FDA: Grapefruit Juice and Some Drugs Don't Mix",
    url: "https://www.fda.gov/consumers/consumer-updates/grapefruit-juice-and-some-drugs-dont-mix",
    keywords: ["grapefruit", "seville orange", "pomelo", "tangelo"],
    summary: [
      "Grapefruit and grapefruit juice can change how some medicines work, raising blood levels of the drug.",
      "Affected drugs include some statins (such as simvastatin and atorvastatin), some blood pressure drugs, some anti-anxiety and anti-rhythm drugs, and some antihistamines.",
      "Read the medication guide and ask your pharmacist whether grapefruit is safe with your specific medicines.",
    ].join(" "),
  },
  {
    id: "bp-categories",
    title: "American Heart Association: Understanding Blood Pressure Readings",
    url: "https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings",
    keywords: ["blood pressure", "bp", "hypertension", "systolic", "diastolic"],
    summary: [
      "Normal: under 120 and under 80. Elevated: 120–129 and under 80. Stage 1 high: 130–139 or 80–89. Stage 2 high: 140 or higher or 90 or higher.",
      "Severe: higher than 180 and/or higher than 120. Wait 5 minutes and retest; if still high, contact your provider immediately. With chest pain, shortness of breath, back pain, numbness, weakness, vision change or difficulty speaking, call 911.",
    ].join(" "),
  },
  {
    id: "a1c",
    title: "American Diabetes Association: Understanding A1C",
    url: "https://diabetes.org/about-diabetes/a1c",
    keywords: ["a1c", "hba1c", "hemoglobin a1c", "glucose", "blood sugar", "sugar"],
    summary: [
      "A1C reflects average blood sugar over roughly the past 2–3 months.",
      "A common goal for many adults with diabetes is an A1C below 7%, but goals are individualized by your care team.",
    ].join(" "),
  },
  {
    id: "resting-heart-rate",
    title: "American Heart Association: Target Heart Rates",
    url: "https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates",
    keywords: ["heart rate", "pulse", "resting heart rate", "rhr", "bpm"],
    summary: "A normal resting heart rate for most adults is between 60 and 100 beats per minute. Fitness, medicines, stress and illness can all affect it.",
  },
  {
    id: "sprains-strains",
    title: "MedlinePlus: Sprains and Strains",
    url: "https://medlineplus.gov/sprainsandstrains.html",
    keywords: ["sprain", "strain", "twisted", "rolled my", "ligament", "pulled muscle", "ankle", "wrist injury"],
    summary: [
      "A sprain is a stretched or torn ligament; ligaments connect bones at a joint. A strain is an injury to a muscle or tendon.",
      "At first, treatment of both usually involves resting the injured area, icing it, wearing a bandage or device that compresses it, and medicines.",
    ].join(" "),
  },
  {
    id: "ibuprofen",
    title: "MedlinePlus: Ibuprofen",
    url: "https://medlineplus.gov/druginfo/meds/a682159.html",
    keywords: ["ibuprofen", "advil", "motrin", "naproxen", "aleve", "nsaid", "anti-inflammatory", "pain reliever", "painkiller", "pain medicine"],
    summary: [
      "People who take NSAIDs (other than aspirin) such as ibuprofen may have a higher risk of heart attack or stroke.",
      "Tell your doctor before taking it if you have high cholesterol, high blood pressure, diabetes, heart disease, or kidney or liver disease.",
      "NSAIDs can cause stomach ulcers or bleeding; stop and call your doctor for stomach pain, black or bloody stools, or vomit that looks like coffee grounds. Taking it with food or milk can prevent stomach upset.",
    ].join(" "),
  },
];

export function findReferences(query: string): SafetyReference[] {
  const q = query.toLowerCase();
  return SAFETY_REFERENCES.filter((ref) => ref.keywords.some((k) => q.includes(k)));
}

export function referenceById(id: string): SafetyReference | undefined {
  return SAFETY_REFERENCES.find((r) => r.id === id);
}
