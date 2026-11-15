import { createSign } from "node:crypto";

// Vertex AI authenticates with short-lived OAuth tokens. We mint them from a service
// account key (GOOGLE_SERVICE_ACCOUNT_KEY: the JSON itself or base64 of it) with a signed
// JWT, so no Google SDK is needed. Tokens last an hour; we refresh five minutes early.

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

let cached: { token: string; expires: number } | null = null;

export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  try {
    const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(json) as ServiceAccount;
    return parsed.client_email && parsed.private_key ? parsed : null;
  } catch {
    return null;
  }
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export async function vertexAccessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 5 * 60_000) return cached.token;
  const account = serviceAccount();
  if (!account) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing or invalid");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  const assertion = `${header}.${claims}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expires: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
