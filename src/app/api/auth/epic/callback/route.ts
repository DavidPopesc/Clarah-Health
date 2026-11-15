import { NextResponse } from "next/server";
import { epicConfig } from "@/lib/epic";
import { appOrigin, EPIC_COOKIE, finishPkce, writeSession } from "@/lib/session";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verifier = await finishPkce("epic", params.get("state"));
  const code = params.get("code");
  if (!verifier || !code) {
    return NextResponse.redirect(new URL("/profile?error=epic_auth_failed", request.url));
  }

  const res = await fetch(epicConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appOrigin(request)}/api/auth/epic/callback`,
      client_id: epicConfig.clientId!,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    console.error("Epic token exchange failed", res.status, await res.text());
    return NextResponse.redirect(new URL("/profile?error=epic_auth_failed", request.url));
  }
  const token = await res.json();
  await writeSession(EPIC_COOKIE, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    patient: token.patient,
  });
  return NextResponse.redirect(new URL("/profile", request.url));
}
