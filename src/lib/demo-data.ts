import type { PatientRecord, WearableSummary } from "./types";

// Synthetic demo patient. Not a real person. Used when no Epic account is linked.
export const demoRecord: PatientRecord = {
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
};

export function demoWearable(today = new Date()): WearableSummary {
  const rhr = [67, 69, 68, 66, 68, 69, 68];
  const sleep = [372, 341, 395, 360, 318, 402, 370];
  const steps = [6210, 4870, 7320, 5530, 8010, 3990, 6640];
  const days = rhr.map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (rhr.length - 1 - i));
    return {
      date: d.toISOString().slice(0, 10),
      restingHeartRate: rhr[i],
      minutesAsleep: sleep[i],
      steps: steps[i],
    };
  });
  return { source: "demo", days };
}
