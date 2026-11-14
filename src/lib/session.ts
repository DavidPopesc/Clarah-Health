import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

// Hackathon-grade session: OAuth tokens live in httpOnly cookies scoped to this
// app. For production, move them to an encrypted server-side store.

export interface OAuthSession {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
  patient?: string; // Epic FHIR Patient id
}

export const EPIC_COOKIE = "clara_epic";
export const FITBIT_COOKIE = "clara_fitbit";
const PKCE_COOKIE = "clara_pkce";

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function readSession(name: string): Promise<OAuthSession | null> {
  const raw = (await cookies()).get(name)?.value;
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as OAuthSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export async function writeSession(name: string, session: OAuthSession) {
  (await cookies()).set(name, JSON.stringify(session), {
    ...baseCookie,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(name: string) {
  (await cookies()).delete(name);
}

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Creates PKCE + state values and stores the verifier for the callback.
export async function startPkce(provider: string) {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  (await cookies()).set(PKCE_COOKIE, JSON.stringify({ provider, verifier, state }), {
    ...baseCookie,
    maxAge: 600,
  });
  return { challenge, state };
}

export async function finishPkce(provider: string, state: string | null) {
  const store = await cookies();
  const raw = store.get(PKCE_COOKIE)?.value;
  store.delete(PKCE_COOKIE);
  if (!raw || !state) return null;
  const saved = JSON.parse(raw) as { provider: string; verifier: string; state: string };
  if (saved.provider !== provider || saved.state !== state) return null;
  return saved.verifier;
}

export function appOrigin(request: Request) {
  return process.env.APP_URL ?? new URL(request.url).origin;
}
