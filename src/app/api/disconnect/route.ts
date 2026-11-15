import { NextResponse } from "next/server";
import { clearSession, EPIC_COOKIE, FITBIT_COOKIE } from "@/lib/session";

// Clears all linked accounts. Clarah stores nothing else about the user.
export async function POST(request: Request) {
  await clearSession(EPIC_COOKIE);
  await clearSession(FITBIT_COOKIE);
  return NextResponse.redirect(new URL("/connections", request.url), 303);
}
