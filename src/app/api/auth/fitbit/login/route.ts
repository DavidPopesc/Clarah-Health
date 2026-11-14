import { NextResponse } from "next/server";
import { fitbitConfig, fitbitEnabled } from "@/lib/fitbit";
import { appOrigin, startPkce } from "@/lib/session";

export async function GET(request: Request) {
  if (!fitbitEnabled()) {
    return NextResponse.redirect(new URL("/?error=fitbit_not_configured", request.url));
  }
  const { challenge, state } = await startPkce("fitbit");
  const url = new URL(fitbitConfig.authorizeUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: fitbitConfig.clientId!,
    redirect_uri: `${appOrigin(request)}/api/auth/fitbit/callback`,
    scope: fitbitConfig.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return NextResponse.redirect(url);
}
