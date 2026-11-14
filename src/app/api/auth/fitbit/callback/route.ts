import { NextResponse } from "next/server";
import { fitbitConfig } from "@/lib/fitbit";
import { appOrigin, finishPkce, FITBIT_COOKIE, writeSession } from "@/lib/session";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const verifier = await finishPkce("fitbit", params.get("state"));
  const code = params.get("code");
  if (!verifier || !code) {
    return NextResponse.redirect(new URL("/?error=fitbit_auth_failed", request.url));
  }

  const basic = Buffer.from(`${fitbitConfig.clientId}:${fitbitConfig.clientSecret}`).toString("base64");
  const res = await fetch(fitbitConfig.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: fitbitConfig.clientId!,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appOrigin(request)}/api/auth/fitbit/callback`,
      code_verifier: verifier,
    }),
  });
  if (!res.ok) {
    console.error("Fitbit token exchange failed", res.status, await res.text());
    return NextResponse.redirect(new URL("/?error=fitbit_auth_failed", request.url));
  }
  const token = await res.json();
  await writeSession(FITBIT_COOKIE, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + (token.expires_in ?? 28800) * 1000,
  });
  return NextResponse.redirect(new URL("/", request.url));
}
