// Shared by the server and the browser. The mode and demo patient live in plain cookies (not
// httpOnly, nothing sensitive) so saved visits and documents on the device can be kept apart
// per demo patient and for the user's own data.

export type AppMode = "demo" | "live";

export const MODE_COOKIE = "clara_mode";
export const PATIENT_COOKIE = "clara_demo_patient";

/** Which set of saved visits and documents to show: a demo patient's id, or "live". */
export function currentScope(): string {
  if (typeof document === "undefined") return "amira";
  const jar = Object.fromEntries(document.cookie.split("; ").map((c) => c.split("=")));
  return jar[MODE_COOKIE] === "live" ? "live" : (jar[PATIENT_COOKIE] ?? "amira");
}
