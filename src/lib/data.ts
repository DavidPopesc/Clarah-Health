import { demoRecord, demoWearable } from "./demo-data";
import { fetchEpicRecord } from "./epic";
import { fetchFitbitWeek } from "./fitbit";
import { EPIC_COOKIE, FITBIT_COOKIE, readSession } from "./session";
import type { PatientRecord, WearableSummary } from "./types";

// Loads the linked user's data, falling back to the synthetic demo patient when
// nothing is linked or a live API call fails, so the demo never breaks on stage.

export async function getRecord(): Promise<PatientRecord> {
  const epic = await readSession(EPIC_COOKIE);
  if (epic?.patient) {
    try {
      return await fetchEpicRecord(epic.accessToken, epic.patient);
    } catch (err) {
      console.error("Epic fetch failed, using demo record", err);
    }
  }
  return demoRecord;
}

export async function getWearable(): Promise<WearableSummary> {
  const fitbit = await readSession(FITBIT_COOKIE);
  if (fitbit) {
    try {
      return await fetchFitbitWeek(fitbit.accessToken);
    } catch (err) {
      console.error("Fitbit fetch failed, using demo data", err);
    }
  }
  return demoWearable();
}

export async function connectionStatus() {
  const [epic, fitbit] = await Promise.all([readSession(EPIC_COOKIE), readSession(FITBIT_COOKIE)]);
  return { epic: Boolean(epic?.patient), fitbit: Boolean(fitbit) };
}
