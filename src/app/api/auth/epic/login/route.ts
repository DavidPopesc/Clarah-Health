import { NextResponse } from "next/server";
import { epicConfig, epicEnabled } from "@/lib/epic";
import { appOrigin, startPkce } from "@/lib/session";

export async function GET(request: Request) {
  if (!epicEnabled()) {
    return NextResponse.redirect(new URL("/profile?error=epic_not_configured", request.url));
  }
  const { challenge, state } = await startPkce("epic");
  const url = new URL(epicConfig.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: epicConfig.clientId!,
    redirect_uri: `${appOrigin(request)}/api/auth/epic/callback`,
    scope: epicConfig.scope,
    state,
    aud: epicConfig.fhirBase,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return NextResponse.redirect(url);
}
