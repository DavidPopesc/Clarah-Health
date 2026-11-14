// Normalized shapes the app and the agent work with. Epic FHIR and Fitbit
// responses are mapped into these so the rest of the code never touches raw APIs.

export interface Medication {
  name: string;
  dosage: string; // e.g. "1000 mg twice daily"
  status: "active" | "stopped";
}

export interface Condition {
  name: string;
  since?: string; // ISO date
}

export interface LabResult {
  name: string; // e.g. "Hemoglobin A1c"
  value: number;
  unit: string;
  date: string; // ISO date
}

export interface BloodPressureReading {
  systolic: number;
  diastolic: number;
  date: string; // ISO date
}

export interface PatientRecord {
  source: "demo" | "epic";
  // Identifying fields stay server-side and are never sent to the model.
  identity: {
    name: string;
    givenName: string;
    birthDate?: string;
    mrn?: string;
  };
  sex?: string;
  medications: Medication[];
  conditions: Condition[];
  labs: LabResult[];
  bloodPressure: BloodPressureReading[];
}

export interface DailyWearable {
  date: string; // ISO date
  restingHeartRate?: number;
  minutesAsleep?: number;
  steps?: number;
}

export interface WearableSummary {
  source: "demo" | "fitbit";
  days: DailyWearable[];
}

export interface Source {
  id: string;
  title: string;
  url: string;
}
