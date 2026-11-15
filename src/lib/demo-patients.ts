import { SAMPLE_VISIT } from "./sample-visit.ts";
import type { PatientRecord, WearableSummary } from "./types";

// Synthetic demo patients for presenting Clarah. None of them are real people. Each has a main
// health issue, the problems that usually come with it, a week of wearable data and a sample
// visit, so every part of the app tells the same story.

export interface DemoPatient {
  id: string;
  /** Main issue, shown on the switcher. */
  focus: string;
  age: number;
  /** One line under the name. */
  tagline: string;
  /** A few sentences on who they are and what Clarah helps with. */
  story: string;
  record: PatientRecord;
  week: { restingHeartRate: number[]; minutesAsleep: number[]; steps: number[] };
  sampleVisit: string;
  /** Whether the bundled sample lab report (public/samples/lab-report.pdf) is theirs. */
  sampleReport?: boolean;
  suggestions: string[];
}

const amira: DemoPatient = {
  id: "amira",
  focus: "Type 2 diabetes",
  age: 52,
  tagline: "Diabetes, cholesterol and ADHD, getting ready to fast for Ramadan",
  story:
    "Amira has had type 2 diabetes for seven years. Her A1c is improving but still above goal, her blood pressure is creeping up, and glipizide puts her at risk of low blood sugar. ADHD makes meals and medicines harder to keep on schedule. She wants to know if she can safely fast for Ramadan.",
  record: {
    source: "demo",
    identity: {
      name: "Amira Haddad",
      givenName: "Amira",
      birthDate: "1974-03-12",
      mrn: "DEMO-000123",
    },
    sex: "female",
    medications: [
      { name: "Metformin", dosage: "1000 mg twice daily", status: "active" },
      { name: "Glipizide", dosage: "5 mg once daily", status: "active" },
      { name: "Atorvastatin", dosage: "20 mg once daily", status: "active" },
    ],
    conditions: [
      { name: "Type 2 diabetes mellitus", since: "2019-05-01" },
      { name: "Hyperlipidemia", since: "2020-02-11" },
      { name: "Attention-deficit/hyperactivity disorder (ADHD)", since: "2012-08-20" },
    ],
    labs: [
      { name: "Hemoglobin A1c", value: 7.9, unit: "%", date: "2026-03-10" },
      { name: "Hemoglobin A1c", value: 7.4, unit: "%", date: "2026-09-15" },
      { name: "Glucose, fasting", value: 142, unit: "mg/dL", date: "2026-09-15" },
      { name: "LDL cholesterol", value: 96, unit: "mg/dL", date: "2026-09-15" },
      { name: "eGFR", value: 88, unit: "mL/min/1.73m2", date: "2026-09-15" },
    ],
    bloodPressure: [
      { systolic: 134, diastolic: 86, date: "2026-06-02" },
      { systolic: 138, diastolic: 88, date: "2026-09-15" },
    ],
  },
  week: {
    restingHeartRate: [67, 69, 68, 66, 68, 69, 68],
    minutesAsleep: [372, 341, 395, 360, 318, 402, 370],
    steps: [6210, 4870, 7320, 5530, 8010, 3990, 6640],
  },
  sampleVisit: SAMPLE_VISIT,
  sampleReport: true,
  suggestions: [
    "Ramadan starts in February. Is it okay for me to fast with my diabetes meds?",
    "Is my A1c getting better?",
    "Can I take turmeric supplements with my medicines?",
    "I sprained my left ankle. Can I take ibuprofen for the pain?",
  ],
};

const grace: DemoPatient = {
  id: "grace",
  focus: "Breast cancer",
  age: 47,
  tagline: "In chemotherapy for breast cancer, managing low blood counts and nausea",
  story:
    "Grace was diagnosed with stage II breast cancer in July and is three cycles into chemotherapy. Her white cells and hemoglobin have dropped, which raises her infection risk and leaves her tired. She is managing nausea, tingling in her fingers and a lot of worry, and wants to understand her blood counts and when to call the oncology team.",
  record: {
    source: "demo",
    identity: { name: "Grace Okafor", givenName: "Grace", birthDate: "1979-06-03", mrn: "DEMO-000207" },
    sex: "female",
    medications: [
      { name: "Doxorubicin and cyclophosphamide (AC chemotherapy)", dosage: "Every 2 weeks at the infusion center, cycle 3 of 4", status: "active" },
      { name: "Pegfilgrastim", dosage: "6 mg injection the day after each chemotherapy", status: "active" },
      { name: "Ondansetron", dosage: "8 mg every 8 hours as needed for nausea", status: "active" },
      { name: "Prochlorperazine", dosage: "10 mg every 6 hours as needed for nausea", status: "active" },
      { name: "Lorazepam", dosage: "0.5 mg at bedtime as needed for anxiety or nausea", status: "active" },
    ],
    conditions: [
      { name: "Malignant neoplasm of left breast, stage IIA, hormone receptor positive", since: "2026-07-14" },
      { name: "Anemia due to chemotherapy", since: "2026-10-06" },
      { name: "Chemotherapy-induced nausea and vomiting", since: "2026-09-02" },
      { name: "Peripheral neuropathy due to chemotherapy", since: "2026-10-20" },
      { name: "Anxiety disorder", since: "2026-08-01" },
    ],
    labs: [
      { name: "Hemoglobin", value: 12.6, unit: "g/dL", date: "2026-08-25" },
      { name: "Hemoglobin", value: 11.2, unit: "g/dL", date: "2026-10-06" },
      { name: "Hemoglobin", value: 10.1, unit: "g/dL", date: "2026-11-10" },
      { name: "White blood cell count", value: 6.4, unit: "K/uL", date: "2026-08-25" },
      { name: "White blood cell count", value: 2.9, unit: "K/uL", date: "2026-11-10" },
      { name: "Absolute neutrophil count", value: 3.8, unit: "K/uL", date: "2026-08-25" },
      { name: "Absolute neutrophil count", value: 1.1, unit: "K/uL", date: "2026-11-10" },
      { name: "Platelet count", value: 168, unit: "K/uL", date: "2026-11-10" },
      { name: "CA 15-3 (tumor marker)", value: 31, unit: "U/mL", date: "2026-11-10" },
      { name: "eGFR", value: 94, unit: "mL/min/1.73m2", date: "2026-11-10" },
    ],
    bloodPressure: [
      { systolic: 118, diastolic: 74, date: "2026-10-06" },
      { systolic: 112, diastolic: 70, date: "2026-11-10" },
    ],
  },
  week: {
    restingHeartRate: [78, 81, 84, 86, 83, 80, 82],
    minutesAsleep: [455, 510, 380, 352, 420, 468, 441],
    steps: [3120, 1840, 980, 1450, 2630, 3380, 2910],
  },
  sampleVisit: `Clinician: Hi Grace. How have you been since your last infusion?
Patient: Honestly, tired. The first few days were rough with the nausea, and my fingers have been tingling.
Clinician: Thank you for telling me. Let's look at your blood counts from Monday. Your white count is 2.9 and your neutrophils, the cells that fight infection, are 1.1. That's low, which we expect partway through chemotherapy, but it means you can catch infections more easily right now.
Patient: What should I do about that?
Clinician: Wash your hands often, avoid people who are sick, and check your temperature if you feel unwell. If your temperature is 100.4 or higher, call our oncology line right away, day or night. Don't wait until morning, and don't take Tylenol first to bring it down.
Patient: Okay. And I've been so tired.
Clinician: Your hemoglobin is 10.1. In August it was 12.6, so you're a bit anemic from the chemotherapy. That explains a lot of the tiredness. We'll keep watching it. If you feel short of breath, your heart is racing, or you feel like you might faint, call us.
Patient: Is the tingling going to get worse?
Clinician: It can build up with treatment. Tell us if it makes it hard to button a shirt or you start dropping things, because we may adjust the dose. For the nausea, keep taking the ondansetron, 8 milligrams, up to every 8 hours as needed. You can add the prochlorperazine if it's not enough.
Patient: I've also been really anxious at night.
Clinician: That's very common, and you don't have to push through it alone. The lorazepam, half a milligram at bedtime, is there if you need it, and I'm going to refer you to our oncology social worker.
Patient: Thank you.
Clinician: Your fourth cycle of AC is on the 24th, with the pegfilgrastim shot the next day. We'll check your counts again that morning.`,
  suggestions: [
    "My neutrophils are 1.1. What does that mean for me?",
    "When should I call the oncology team?",
    "Can I take ginger for the nausea with my chemo?",
    "Why am I so tired all the time?",
  ],
};

const marcus: DemoPatient = {
  id: "marcus",
  focus: "PTSD",
  age: 34,
  tagline: "Army veteran with PTSD, nightmares and poor sleep, improving with treatment",
  story:
    "Marcus served two tours in the Army and was diagnosed with PTSD after coming home. Nightmares and insomnia keep his sleep short and his resting heart rate high, and he has depression and chronic back pain from an injury. Since starting sertraline, prazosin and therapy, his symptom scores are coming down. He wants help sticking with the plan and knowing what's safe to take for sleep and pain.",
  record: {
    source: "demo",
    identity: { name: "Marcus Bell", givenName: "Marcus", birthDate: "1992-02-19", mrn: "DEMO-000318" },
    sex: "male",
    medications: [
      { name: "Sertraline", dosage: "100 mg once daily", status: "active" },
      { name: "Prazosin", dosage: "2 mg at bedtime for nightmares", status: "active" },
      { name: "Hydroxyzine", dosage: "25 mg as needed for anxiety, up to 3 times a day", status: "active" },
      { name: "Meloxicam", dosage: "7.5 mg once daily with food for back pain", status: "active" },
      { name: "Zolpidem", dosage: "5 mg at bedtime", status: "stopped" },
    ],
    conditions: [
      { name: "Post-traumatic stress disorder (PTSD), chronic", since: "2021-04-12" },
      { name: "Major depressive disorder, recurrent, moderate", since: "2021-04-12" },
      { name: "Insomnia with nightmares", since: "2021-09-30" },
      { name: "Chronic low back pain", since: "2019-11-05" },
      { name: "Alcohol use, at-risk drinking", since: "2025-12-02" },
    ],
    labs: [
      { name: "PCL-5 (PTSD symptom score)", value: 58, unit: "points", date: "2026-05-04" },
      { name: "PCL-5 (PTSD symptom score)", value: 46, unit: "points", date: "2026-08-10" },
      { name: "PCL-5 (PTSD symptom score)", value: 39, unit: "points", date: "2026-11-02" },
      { name: "PHQ-9 (depression score)", value: 17, unit: "points", date: "2026-05-04" },
      { name: "PHQ-9 (depression score)", value: 11, unit: "points", date: "2026-11-02" },
      { name: "ALT (liver enzyme)", value: 58, unit: "U/L", date: "2026-11-02" },
      { name: "LDL cholesterol", value: 118, unit: "mg/dL", date: "2026-11-02" },
      { name: "eGFR", value: 101, unit: "mL/min/1.73m2", date: "2026-11-02" },
    ],
    bloodPressure: [
      { systolic: 136, diastolic: 88, date: "2026-05-04" },
      { systolic: 124, diastolic: 78, date: "2026-11-02" },
    ],
  },
  week: {
    restingHeartRate: [79, 82, 77, 84, 80, 78, 81],
    minutesAsleep: [298, 341, 265, 312, 384, 290, 335],
    steps: [9840, 7210, 11030, 6480, 12350, 8120, 9460],
  },
  sampleVisit: `Clinician: Good to see you, Marcus. How have the last couple of months been?
Patient: Better, I think. The nightmares aren't every night anymore. Maybe two or three times a week.
Clinician: That's real progress. Your PTSD checklist score today is 39. In May it was 58, so it's come down a lot. Your depression score is 11, down from 17.
Patient: I still don't sleep much. Maybe five hours.
Clinician: Your watch data shows about the same, and your resting heart rate is around 80, which often goes along with poor sleep and stress. I'd like to raise the prazosin from 2 milligrams to 3 milligrams at bedtime, since it's helping the nightmares. Stand up slowly at night, because it can make you dizzy.
Patient: Okay. Should I go back on the zolpidem?
Clinician: I'd rather not. It can cause sleepwalking and doesn't help nightmares. Keep it stopped. Instead, I'm referring you to the CBT for insomnia group, which works well with PTSD.
Patient: Alright.
Clinician: One more thing. Your liver enzyme, the ALT, came back a little high at 58. That can happen with regular drinking. How much are you drinking these days?
Patient: A few beers most nights. It helps me fall asleep.
Clinician: Alcohol actually makes sleep lighter and can make nightmares and mood worse, and it doesn't mix well with hydroxyzine. Let's work on cutting back, and we'll recheck the liver test in three months.
Patient: I can try.
Clinician: Keep the sertraline at 100 milligrams every day, and keep your therapy sessions on Thursdays. If you ever have thoughts of hurting yourself, call or text 988 and press 1 for the Veterans Crisis Line, any time.`,
  suggestions: [
    "Is it okay to drink a few beers with my medicines?",
    "Can I take melatonin to help me sleep?",
    "Are my PTSD scores getting better?",
    "Can I take ibuprofen for my back with meloxicam?",
  ],
};

const sofia: DemoPatient = {
  id: "sofia",
  focus: "Pregnancy",
  age: 31,
  tagline: "28 weeks pregnant with gestational diabetes, low iron and rising blood pressure",
  story:
    "Sofia is expecting her first baby in February. At her 26-week visit she was diagnosed with gestational diabetes, and her iron is low, which is why she's been so tired. Her blood pressure has been slowly rising, so her midwife is watching for preeclampsia. She wants to know what's safe to eat and take, and which symptoms mean she should call right away.",
  record: {
    source: "demo",
    identity: { name: "Sofia Ramirez", givenName: "Sofia", birthDate: "1995-08-27", mrn: "DEMO-000429" },
    sex: "female",
    medications: [
      { name: "Prenatal vitamin with DHA", dosage: "1 tablet once daily", status: "active" },
      { name: "Ferrous sulfate (iron)", dosage: "325 mg every other day", status: "active" },
      { name: "Aspirin (low dose)", dosage: "81 mg once daily to lower preeclampsia risk", status: "active" },
      { name: "Glucose meter and test strips", dosage: "Check fasting and 1 hour after each meal", status: "active" },
    ],
    conditions: [
      { name: "Pregnancy, third trimester (due 2027-02-05)", since: "2026-05-01" },
      { name: "Gestational diabetes mellitus, diet-controlled", since: "2026-10-30" },
      { name: "Iron deficiency anemia of pregnancy", since: "2026-10-30" },
      { name: "Elevated blood pressure in pregnancy", since: "2026-11-12" },
    ],
    labs: [
      { name: "Glucose tolerance test, 1 hour", value: 162, unit: "mg/dL", date: "2026-10-16" },
      { name: "Glucose tolerance test, 3 hour (fasting)", value: 98, unit: "mg/dL", date: "2026-10-28" },
      { name: "Hemoglobin A1c", value: 5.6, unit: "%", date: "2026-07-02" },
      { name: "Hemoglobin", value: 11.8, unit: "g/dL", date: "2026-07-02" },
      { name: "Hemoglobin", value: 10.2, unit: "g/dL", date: "2026-10-28" },
      { name: "Ferritin (iron stores)", value: 11, unit: "ng/mL", date: "2026-10-28" },
      { name: "Urine protein to creatinine ratio", value: 0.12, unit: "mg/mg", date: "2026-11-12" },
      { name: "Platelet count", value: 214, unit: "K/uL", date: "2026-11-12" },
    ],
    bloodPressure: [
      { systolic: 112, diastolic: 70, date: "2026-07-02" },
      { systolic: 124, diastolic: 78, date: "2026-10-16" },
      { systolic: 134, diastolic: 86, date: "2026-11-12" },
    ],
  },
  week: {
    restingHeartRate: [84, 86, 85, 88, 87, 85, 89],
    minutesAsleep: [402, 365, 418, 340, 390, 425, 372],
    steps: [5120, 4380, 6240, 3970, 5510, 4860, 4120],
  },
  sampleVisit: `Clinician: Hi Sofia, you're 28 weeks today. How are you and the baby doing?
Patient: The baby's kicking a lot. I'm just exhausted all the time.
Clinician: That fits with your bloodwork. Your hemoglobin is 10.2 and your ferritin, which shows your iron stores, is 11. That's iron deficiency anemia, which is common in pregnancy. Keep taking the iron, 325 milligrams every other day, with orange juice, and not at the same time as your prenatal vitamin or dairy.
Patient: Okay. And the sugar test?
Clinician: Your glucose tolerance test confirmed gestational diabetes. The good news is we can usually manage it with food and walking. Check your sugar when you wake up and one hour after each meal. We want fasting under 95 and one hour after meals under 140. A short walk after dinner really helps.
Patient: Will I need insulin?
Clinician: Only if your numbers stay high for a week or two. Bring your log to your next visit and we'll decide together.
Patient: My blood pressure was a little high at the pharmacy too.
Clinician: It was 134 over 86 today. In July it was 112 over 70, so it's been rising. Your urine protein is normal and your platelets are fine, so there's no sign of preeclampsia right now, but we're going to watch closely. Keep taking the baby aspirin, 81 milligrams every day.
Patient: What should I watch for?
Clinician: Call us right away or go to labor and delivery if you get a bad headache that won't go away, vision changes like spots or blurring, pain under your right ribs, sudden swelling of your face or hands, or if the baby is moving less. Also if your blood pressure at home is 160 over 110 or higher.
Patient: Got it.
Clinician: I'd like you to check your blood pressure at home twice a day, and come back in one week instead of two.`,
  suggestions: [
    "Is it safe to take Tylenol for a headache while pregnant?",
    "What can I eat for breakfast with gestational diabetes?",
    "My blood pressure is rising. What should I watch for?",
    "Can I drink coffee while I'm pregnant?",
  ],
};

export const DEMO_PATIENTS: DemoPatient[] = [amira, grace, marcus, sofia];
export const DEFAULT_DEMO_PATIENT = amira;

export function findDemoPatient(id: string | undefined): DemoPatient {
  return DEMO_PATIENTS.find((patient) => patient.id === id) ?? DEFAULT_DEMO_PATIENT;
}

export function demoWeek(patient: DemoPatient, today = new Date()): WearableSummary {
  const { restingHeartRate, minutesAsleep, steps } = patient.week;
  const days = restingHeartRate.map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (restingHeartRate.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), restingHeartRate: restingHeartRate[i], minutesAsleep: minutesAsleep[i], steps: steps[i] };
  });
  return { source: "demo", days };
}
