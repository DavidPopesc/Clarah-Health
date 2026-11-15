// Clarah Steady: the fall-prediction wearable (hardware/steady). The board POSTs a summary to
// /api/steady/ingest every 30 s; we keep the latest one per device in Typesense (collection
// steady_devices) and show it on /steady. Demo patients get a matching synthetic reading.

export type SteadyMode = "fall_prevention" | "prosthetic";
export type SteadyRisk = "unknown" | "low" | "moderate" | "high";
export type Adaptation = "adapting" | "adjusting" | "struggling" | "unknown";

export interface SteadyPayload {
  v: 1;
  device_id: string;
  sent_at: number;
  mode: SteadyMode;
  patient_name: string;
  balance: {
    score: number | null;
    smoothed: number | null;
    baseline: number | null;
    slope: number | null;
    projected: number | null;
    risk: SteadyRisk;
    walking: boolean;
  };
  daily: { day: string; score: number; windows: number }[];
  device: { state: string; online: boolean; sensor: string };
  alert: null | { kind: "fall" | "harsh_fall" | "help"; t: number; countdown_s: number | null; detail: string };
  emergency: {
    active: boolean;
    reason: null | "fall" | "harsh_fall" | "help";
    since: number | null;
    simulated_911: boolean;
    simulated_911_at: number | null;
  };
  prosthetic: null | {
    wear_min_today: number;
    walking_min_today: number;
    bouts_today: number;
    longest_bout_min: number;
    stumbles_today: number;
    adaptation: Adaptation;
    adaptation_note: string;
    daily: { day: string; wear_min: number; walking_min: number; bouts: number; stumbles: number; score: number }[];
  };
  warning: null | { risk: "moderate" | "high"; message: string; t: number };
  events: { t: number; kind: string; detail: string }[];
  /** The last ~10 s of acceleration in g (axes averaged, peak magnitude), for the live graph. */
  motion?: null | { hz: number; t_end: number | null; x: number[]; y: number[]; z: number[]; mag: number[] };
}

export interface SteadyReading {
  payload: SteadyPayload;
  /** When Clarah received it (ms). */
  receivedAt: number;
  source: "device" | "demo";
}

/** A reading older than this means the board is off or out of range. */
export const STALE_AFTER_MS = 2 * 60_000;

export function isStale(reading: SteadyReading | null, at = Date.now()): boolean {
  return !reading || at - reading.receivedAt > STALE_AFTER_MS;
}

export const WORSENING_ADVICE = "If you feel your walking is getting worse, call your doctor.";

// ---------------------------------------------------------------- validation

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 300): string => (typeof v === "string" ? v.slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(-max) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

const REASONS = ["fall", "harsh_fall", "help"] as const;

/** Keeps only the fields we use, with the right types. Returns null if it isn't a v1 payload. */
export function sanitizePayload(input: unknown): SteadyPayload | null {
  const p = obj(input);
  if (p.v !== 1 || !str(p.device_id, 64)) return null;
  const b = obj(p.balance);
  const d = obj(p.device);
  const e = obj(p.emergency);
  const a = p.alert ? obj(p.alert) : null;
  const pr = p.prosthetic ? obj(p.prosthetic) : null;
  const w = p.warning ? obj(p.warning) : null;
  return {
    v: 1,
    device_id: str(p.device_id, 64),
    sent_at: num(p.sent_at) ?? 0,
    mode: oneOf(p.mode, ["fall_prevention", "prosthetic"] as const, "fall_prevention"),
    patient_name: str(p.patient_name, 80),
    balance: {
      score: num(b.score),
      smoothed: num(b.smoothed),
      baseline: num(b.baseline),
      slope: num(b.slope),
      projected: num(b.projected),
      risk: oneOf(b.risk, ["unknown", "low", "moderate", "high"] as const, "unknown"),
      walking: b.walking === true,
    },
    daily: list(p.daily, 14).map((x) => {
      const r = obj(x);
      return { day: str(r.day, 10), score: num(r.score) ?? 0, windows: num(r.windows) ?? 0 };
    }),
    device: { state: str(d.state, 32) || "unknown", online: d.online === true, sensor: str(d.sensor, 32) || "unknown" },
    alert: a && { kind: oneOf(a.kind, REASONS, "fall"), t: num(a.t) ?? 0, countdown_s: num(a.countdown_s), detail: str(a.detail) },
    emergency: {
      active: e.active === true,
      reason: REASONS.includes(e.reason as (typeof REASONS)[number]) ? (e.reason as (typeof REASONS)[number]) : null,
      since: num(e.since),
      simulated_911: e.simulated_911 === true,
      simulated_911_at: num(e.simulated_911_at),
    },
    prosthetic: pr && {
      wear_min_today: num(pr.wear_min_today) ?? 0,
      walking_min_today: num(pr.walking_min_today) ?? 0,
      bouts_today: num(pr.bouts_today) ?? 0,
      longest_bout_min: num(pr.longest_bout_min) ?? 0,
      stumbles_today: num(pr.stumbles_today) ?? 0,
      adaptation: oneOf(pr.adaptation, ["adapting", "adjusting", "struggling", "unknown"] as const, "unknown"),
      adaptation_note: str(pr.adaptation_note),
      daily: list(pr.daily, 14).map((x) => {
        const r = obj(x);
        return {
          day: str(r.day, 10),
          wear_min: num(r.wear_min) ?? 0,
          walking_min: num(r.walking_min) ?? 0,
          bouts: num(r.bouts) ?? 0,
          stumbles: num(r.stumbles) ?? 0,
          score: num(r.score) ?? 0,
        };
      }),
    },
    warning: w && { risk: oneOf(w.risk, ["moderate", "high"] as const, "moderate"), message: str(w.message), t: num(w.t) ?? 0 },
    events: list(p.events, 20).map((x) => {
      const r = obj(x);
      return { t: num(r.t) ?? 0, kind: str(r.kind, 40), detail: str(r.detail) };
    }),
    motion: sanitizeMotion(p.motion),
  };
}

function sanitizeMotion(input: unknown): SteadyPayload["motion"] {
  if (!input) return null;
  const m = obj(input);
  const series = (v: unknown) => list(v, 200).map((n) => Math.max(-4, Math.min(4, num(n) ?? 0)));
  const mag = series(m.mag);
  if (!mag.length) return null;
  return { hz: num(m.hz) ?? 10, t_end: num(m.t_end), x: series(m.x), y: series(m.y), z: series(m.z), mag };
}

/** A plain-language line for an event from the board, which sometimes sends bare codes. */
export function eventLabel(kind: string, detail: string): string {
  switch (kind) {
    case "fall_suspected": return "Possible fall, checking";
    case "fall_detected": return detail.includes("harsh") ? "Hard fall detected" : detail.includes("test") ? "Fall alarm test" : "Fall detected";
    case "fall_dismissed": return "Not a fall: movement looked normal afterwards";
    case "fall_cancelled": return "Wearer said they're OK after a fall alarm";
    case "help_pressed": return "Help button pressed";
    case "help_cancelled": return "Help request cancelled";
    case "emergency":
      return detail === "harsh_fall" ? "Emergency: no response after a hard fall" : detail === "help" ? "Emergency: help requested" : "Emergency: no response after a fall";
    case "resolved": return detail === "button" ? "Alarm resolved with the device button" : detail === "app" ? "Alarm resolved from the dashboard" : "Alarm resolved";
    case "silenced": return "Buzzer silenced";
    case "sensor_ok": return "Accelerometer connected";
    case "sensor_missing": return "Accelerometer not detected";
    case "simulated_911": return "Simulated 911 call (no real call placed)";
    default:
      return detail.includes(" ") ? detail : (detail || kind).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
  }
}

/** Synthetic walking motion for demo readings: steps at ~1.8 Hz, a little sway. */
function demoMotion(unsteady: boolean): NonNullable<SteadyPayload["motion"]> {
  const n = 100, hz = 10;
  const x: number[] = [], y: number[] = [], z: number[] = [], mag: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / hz;
    const step = Math.sin(2 * Math.PI * 1.8 * t);
    const wobble = unsteady ? 0.12 * Math.sin(2 * Math.PI * 0.4 * t + 1) : 0.03 * Math.sin(2 * Math.PI * 0.3 * t);
    const xi = +(0.08 * step + wobble).toFixed(2);
    const yi = +(0.05 * Math.cos(2 * Math.PI * 0.9 * t) + wobble / 2).toFixed(2);
    const zi = +(1 + 0.22 * step * (unsteady ? 1.3 : 1)).toFixed(2);
    x.push(xi); y.push(yi); z.push(zi);
    mag.push(+Math.sqrt(xi * xi + yi * yi + zi * zi).toFixed(2));
  }
  return { hz, t_end: null, x, y, z, mag };
}

// ---------------------------------------------------------------- store

// Typesense Cloud holds one document per device. A key scoped to steady_devices is enough.
function storeConfig() {
  const host = process.env.TYPESENSE_STEADY_HOST || process.env.TYPESENSE_HOST;
  const key = process.env.TYPESENSE_STEADY_KEY || process.env.TYPESENSE_ADMIN_KEY;
  if (!host || !key) return null;
  const protocol = process.env.TYPESENSE_STEADY_HOST ? "https" : (process.env.TYPESENSE_PROTOCOL ?? "https");
  const port = process.env.TYPESENSE_STEADY_HOST ? "443" : (process.env.TYPESENSE_PORT ?? "443");
  return { base: `${protocol}://${host}:${port}/collections/steady_devices/documents`, key };
}

// Without a store (local development) readings live in memory for this server process.
const memory = new Map<string, SteadyReading>();

export async function saveReading(payload: SteadyPayload): Promise<void> {
  const reading: SteadyReading = { payload, receivedAt: Date.now(), source: "device" };
  memory.set(payload.device_id, reading);
  const cfg = storeConfig();
  if (!cfg) return;
  const res = await fetch(`${cfg.base}?action=upsert`, {
    method: "POST",
    headers: { "X-TYPESENSE-API-KEY": cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: payload.device_id, updated_at: reading.receivedAt, payload: JSON.stringify(payload) }),
  });
  if (!res.ok) throw new Error(`Steady store write failed (${res.status})`);
}

export async function latestReading(deviceId = process.env.STEADY_DEVICE_ID ?? "uno-q"): Promise<SteadyReading | null> {
  const cfg = storeConfig();
  if (!cfg) return memory.get(deviceId) ?? null;
  const res = await fetch(`${cfg.base}/${encodeURIComponent(deviceId)}`, { headers: { "X-TYPESENSE-API-KEY": cfg.key }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Steady store read failed (${res.status})`);
  const doc = (await res.json()) as { updated_at: number; payload: string };
  const payload = sanitizePayload(JSON.parse(doc.payload));
  return payload ? { payload, receivedAt: doc.updated_at, source: "device" } : null;
}

// ---------------------------------------------------------------- remote commands

// The website can end or cancel the device's alarm. Commands wait in a "<device>:commands"
// document until the board's next sync (every 5 s) picks them up in the ingest response.
export const REMOTE_COMMANDS = ["cancel", "resolve"] as const;
export type RemoteCommand = (typeof REMOTE_COMMANDS)[number];
const COMMAND_TTL_MS = 2 * 60_000;
const memoryCommands = new Map<string, { commands: RemoteCommand[]; at: number }>();

async function writeCommands(deviceId: string, commands: RemoteCommand[]) {
  const entry = { commands, at: Date.now() };
  memoryCommands.set(deviceId, entry);
  const cfg = storeConfig();
  if (!cfg) return;
  const res = await fetch(`${cfg.base}?action=upsert`, {
    method: "POST",
    headers: { "X-TYPESENSE-API-KEY": cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: `${deviceId}:commands`, updated_at: entry.at, payload: JSON.stringify(entry) }),
  });
  if (!res.ok) throw new Error(`Steady command write failed (${res.status})`);
}

export async function queueCommand(command: RemoteCommand, deviceId = process.env.STEADY_DEVICE_ID ?? "uno-q") {
  await writeCommands(deviceId, [command]);
}

/** Commands waiting for this device (dropped after 2 minutes), cleared once handed over. */
export async function takeCommands(deviceId: string): Promise<RemoteCommand[]> {
  const cfg = storeConfig();
  let entry = memoryCommands.get(deviceId) ?? null;
  if (cfg) {
    const res = await fetch(`${cfg.base}/${encodeURIComponent(`${deviceId}:commands`)}`, { headers: { "X-TYPESENSE-API-KEY": cfg.key }, cache: "no-store" });
    entry = res.ok ? (JSON.parse(((await res.json()) as { payload: string }).payload) as { commands: RemoteCommand[]; at: number }) : null;
  }
  if (!entry?.commands.length) return [];
  await writeCommands(deviceId, []);
  return Date.now() - entry.at < COMMAND_TTL_MS ? entry.commands.filter((c) => REMOTE_COMMANDS.includes(c)) : [];
}

// ---------------------------------------------------------------- sync pace

// While someone has /steady open the board syncs every second, so the live graph is smooth;
// otherwise every 30 s. The page's polling marks the device as watched.
export const FAST_SYNC_S = 1;
export const IDLE_SYNC_S = 30;
const WATCHED_FOR_MS = 15_000;
const memoryViewers = new Map<string, number>();

export async function markWatched(deviceId = process.env.STEADY_DEVICE_ID ?? "uno-q") {
  const at = Date.now();
  memoryViewers.set(deviceId, at);
  const cfg = storeConfig();
  if (!cfg) return;
  await fetch(`${cfg.base}?action=upsert`, {
    method: "POST",
    headers: { "X-TYPESENSE-API-KEY": cfg.key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: `${deviceId}:viewer`, updated_at: at }),
  });
}

/** How many seconds the board should wait before its next sync. */
export async function nextSyncSeconds(deviceId: string): Promise<number> {
  const cfg = storeConfig();
  let at = memoryViewers.get(deviceId) ?? 0;
  if (cfg) {
    const res = await fetch(`${cfg.base}/${encodeURIComponent(`${deviceId}:viewer`)}`, { headers: { "X-TYPESENSE-API-KEY": cfg.key }, cache: "no-store" });
    at = res.ok ? ((await res.json()) as { updated_at: number }).updated_at : 0;
  }
  return Date.now() - at < WATCHED_FOR_MS ? FAST_SYNC_S : IDLE_SYNC_S;
}

// ---------------------------------------------------------------- demo readings

const dayString = (offset: number, today: Date) => {
  const d = new Date(today);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
};

/**
 * A synthetic reading that fits the demo patient. Grace's chemotherapy neuropathy, anemia and
 * bedtime lorazepam make her steadiness slide (moderate risk); Amira is steady. `prosthetic`
 * previews prosthetic mode: a new below-knee prosthesis, improving over two weeks.
 */
export function demoReading(patientId: string, mode: SteadyMode = "fall_prevention", today = new Date()): SteadyReading {
  const t = today.getTime() / 1000;
  const declining = patientId === "grace";
  const scores = Array.from({ length: 14 }, (_, i) =>
    declining ? Math.round(84 - Math.max(0, i - 4) * 2.4 + (i % 3) - 1) : Math.round(85 + ((i * 7) % 5) - 2),
  );
  const smoothed = scores[13];
  const baseline = declining ? 84 : 86;
  const risk: SteadyRisk = declining ? "moderate" : "low";
  const base: SteadyPayload = {
    v: 1,
    device_id: "demo",
    sent_at: t,
    mode,
    patient_name: "",
    balance: {
      score: smoothed,
      smoothed,
      baseline,
      slope: declining ? -0.3 : 0.05,
      projected: declining ? smoothed - 3 : smoothed,
      risk,
      walking: false,
    },
    daily: scores.map((score, i) => ({ day: dayString(13 - i, today), score, windows: 30 + ((i * 11) % 25) })),
    device: { state: "normal", online: true, sensor: "ok" },
    alert: null,
    emergency: { active: false, reason: null, since: null, simulated_911: false, simulated_911_at: null },
    prosthetic: null,
    motion: demoMotion(declining),
    warning: declining
      ? {
          risk: "moderate",
          message: `Your walking has been less steady this week. Take it slow and use a handrail on stairs. ${WORSENING_ADVICE}`,
          t: t - 3 * 3600,
        }
      : null,
    events: declining
      ? [
          { t: t - 26 * 3600, kind: "balance_warning", detail: "Steadiness 68, 16 points below your usual" },
          { t: t - 3 * 3600, kind: "balance_warning", detail: `Steadiness ${smoothed}, trending down` },
        ]
      : [{ t: t - 5 * 3600, kind: "walk", detail: "22-minute walk, steady the whole way" }],
  };
  if (mode === "prosthetic") {
    const days = Array.from({ length: 14 }, (_, i) => ({
      day: dayString(13 - i, today),
      wear_min: Math.round(150 + i * 22 + ((i * 13) % 20)),
      walking_min: Math.round(14 + i * 3.1 + ((i * 7) % 6)),
      bouts: 4 + Math.round(i * 0.6),
      stumbles: Math.max(0, 5 - Math.floor(i / 3)),
      score: Math.round(56 + i * 1.9 + ((i * 5) % 4)),
    }));
    const now = days[13];
    base.balance = { ...base.balance, score: now.score, smoothed: now.score, baseline: days[0].score, slope: 0.2, projected: now.score + 1, risk: "low" };
    base.warning = null;
    base.events = [{ t: t - 2 * 3600, kind: "stumble", detail: "Small stumble while walking, recovered" }];
    base.prosthetic = {
      wear_min_today: now.wear_min,
      walking_min_today: now.walking_min,
      bouts_today: now.bouts,
      longest_bout_min: 9,
      stumbles_today: now.stumbles,
      adaptation: "adapting",
      adaptation_note: "Wearing the leg twice as long as in week one, walking more each day, and stumbling less. Steadiness is up 25 points.",
      daily: days,
    };
  }
  return { payload: base, receivedAt: today.getTime(), source: "demo" };
}

// ---------------------------------------------------------------- plain-language summary

export const RISK_LABEL: Record<SteadyRisk, string> = {
  unknown: "Not enough walking yet",
  low: "Low fall risk",
  moderate: "Moderate fall risk",
  high: "High fall risk",
};

export const ADAPTATION_LABEL: Record<Adaptation, string> = {
  adapting: "Adapting well",
  adjusting: "Still adjusting",
  struggling: "Struggling: the fit may need adjusting",
  unknown: "Not enough data yet",
};

/** What Clarah's agent sees: de-identified, plain numbers, with the worsening advice attached. */
export function summarizeForAgent(reading: SteadyReading | null) {
  if (!reading) return { connected: false, note: "No Clarah Steady wearable is connected." };
  const { payload: p, receivedAt, source } = reading;
  const week = p.daily.slice(-7);
  const earlier = p.daily.slice(-14, -7);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    connected: true,
    source: source === "demo" ? "demo wearable data" : "Clarah Steady wearable",
    lastUpdateMinutesAgo: Math.round((Date.now() - receivedAt) / 60_000),
    mode: p.mode === "prosthetic" ? "prosthetic adaptation (worn on a prosthetic leg)" : "fall prevention (worn at the waist)",
    steadinessScore: p.balance.smoothed,
    usualScore: p.balance.baseline,
    fallRisk: RISK_LABEL[p.balance.risk],
    thisWeekAverage: avg(week.map((d) => d.score)),
    previousWeekAverage: avg(earlier.map((d) => d.score)),
    latestWarning: p.warning?.message ?? null,
    emergencyActive: p.emergency.active,
    prosthetic: p.prosthetic && {
      adaptation: ADAPTATION_LABEL[p.prosthetic.adaptation],
      note: p.prosthetic.adaptation_note,
      wearMinutesToday: p.prosthetic.wear_min_today,
      walkingMinutesToday: p.prosthetic.walking_min_today,
      stumblesToday: p.prosthetic.stumbles_today,
    },
    advice: WORSENING_ADVICE,
  };
}
