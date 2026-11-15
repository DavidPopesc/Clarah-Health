import { cookies } from "next/headers";
import { findDemoPatient, type DemoPatient } from "./demo-patients";
import { MODE_COOKIE, PATIENT_COOKIE, type AppMode } from "./scope";

// Demo mode (the default) shows one of the synthetic demo patients. Live mode shows only what
// the user has linked (MyChart, Fitbit), with no filler data.

export async function getMode(): Promise<{ mode: AppMode; patient: DemoPatient }> {
  const store = await cookies();
  const mode: AppMode = store.get(MODE_COOKIE)?.value === "live" ? "live" : "demo";
  return { mode, patient: findDemoPatient(store.get(PATIENT_COOKIE)?.value) };
}
