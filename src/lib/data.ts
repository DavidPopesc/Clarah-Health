import { demoWeek } from "./demo-patients";
import { fetchEpicRecord } from "./epic";
import { fetchFitbitWeek } from "./fitbit";
import { getMode } from "./mode";
import { EPIC_COOKIE, FITBIT_COOKIE, readSession } from "./session";
import type { PatientRecord, WearableSummary } from "./types";

// Demo mode: the chosen demo patient. Live mode: the user's linked accounts, or an empty record
// when nothing is linked. A live call that fails falls back to the demo patient so the demo
// never breaks on stage.

const emptyRecord: PatientRecord = {
  source: "epic",
  identity: { name: "", givenName: "there" },
  medications: [],
  conditions: [],
  labs: [],
  bloodPressure: [],
};

export async function getRecord(): Promise<PatientRecord> {
  const { mode, patient } = await getMode();
  if (mode === "demo") return patient.record;
  const epic = await readSession(EPIC_COOKIE);
  if (!epic?.patient) return emptyRecord;
  try {
    return await fetchEpicRecord(epic.accessToken, epic.patient);
  } catch (err) {
    console.error("Epic fetch failed, using demo record", err);
    return patient.record;
  }
}

export async function getWearable(): Promise<WearableSummary> {
  const { mode, patient } = await getMode();
  if (mode === "demo") return demoWeek(patient);
  const fitbit = await readSession(FITBIT_COOKIE);
  if (!fitbit) return { source: "fitbit", days: [] };
  try {
    return await fetchFitbitWeek(fitbit.accessToken);
  } catch (err) {
    console.error("Fitbit fetch failed, using demo data", err);
    return demoWeek(patient);
  }
}

// In demo mode the patient's MyChart and Fitbit show as linked. `live` is only the accounts the
// user actually linked.
export async function connectionStatus() {
  const [{ mode }, epic, fitbit] = await Promise.all([getMode(), readSession(EPIC_COOKIE), readSession(FITBIT_COOKIE)]);
  const live = { epic: Boolean(epic?.patient), fitbit: Boolean(fitbit) };
  return mode === "demo" ? { mode, epic: true, fitbit: true, live } : { mode, ...live, live };
}
