import { NextResponse } from "next/server";
import { DEMO_PATIENTS } from "@/lib/demo-patients";
import { MODE_COOKIE, PATIENT_COOKIE } from "@/lib/scope";

// Switches between demo mode (a synthetic patient) and live mode (the user's linked data).
// /api/demo?patient=grace picks a demo patient; /api/demo?mode=live uses real data.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const next = params.get("next") ?? "/profile";
  const res = NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/profile", request.url));
  const cookie = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };
  const patient = DEMO_PATIENTS.find((p) => p.id === params.get("patient"));
  if (patient) res.cookies.set(PATIENT_COOKIE, patient.id, cookie);
  res.cookies.set(MODE_COOKIE, params.get("mode") === "live" ? "live" : "demo", cookie);
  return res;
}
