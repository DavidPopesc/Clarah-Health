import { demoWeek, findDemoPatient } from "./demo-patients.ts";
import type { WearableSummary } from "./types";

// Amira, the first synthetic demo patient (see demo-patients.ts for all of them). Not a real person.
export const demoRecord = findDemoPatient("amira").record;

export function demoWearable(today = new Date()): WearableSummary {
  return demoWeek(findDemoPatient("amira"), today);
}
