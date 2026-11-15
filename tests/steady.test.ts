import assert from "node:assert/strict";
import { test } from "node:test";
import { demoReading, isStale, sanitizePayload, summarizeForAgent, WORSENING_ADVICE } from "../src/lib/steady.ts";

const board = {
  v: 1,
  device_id: "uno-q",
  sent_at: 1794700000,
  mode: "prosthetic",
  patient_name: "Sam",
  balance: { score: 71.2, smoothed: 70.4, baseline: 82, slope: -0.4, projected: 66, risk: "moderate", walking: true },
  last_window: { sway: 7 },
  daily: [{ day: "2026-11-14", score: 78.5, windows: 40 }],
  device: { state: "fall_countdown", online: true, sensor: "ok", extra: "ignored" },
  alert: { kind: "harsh_fall", t: 1794700000, countdown_s: 10, detail: "harsh" },
  emergency: { active: false, reason: null, since: null, simulated_911: false, simulated_911_at: null },
  prosthetic: { wear_min_today: 312, walking_min_today: 48, bouts_today: 9, longest_bout_min: 7, stumbles_today: 1,
    adaptation: "struggling", adaptation_note: "Stumbling more", daily: [{ day: "2026-11-14", wear_min: 300, walking_min: 45, bouts: 8, stumbles: 1, score: 74 }] },
  warning: { risk: "moderate", message: `Take it slow. ${WORSENING_ADVICE}`, t: 1794700000 },
  events: Array.from({ length: 30 }, (_, i) => ({ t: i, kind: "walk", detail: "x" })),
  injected: "<script>",
};

test("sanitizePayload keeps the v1 fields and drops everything else", () => {
  const p = sanitizePayload(board)!;
  assert.equal(p.mode, "prosthetic");
  assert.equal(p.alert?.kind, "harsh_fall");
  assert.equal(p.prosthetic?.adaptation, "struggling");
  assert.equal(p.events.length, 20);
  assert.equal("injected" in p, false);
  assert.equal("extra" in p.device, false);
});

test("sanitizePayload rejects other versions and bad values", () => {
  assert.equal(sanitizePayload({ ...board, v: 2 }), null);
  assert.equal(sanitizePayload({ ...board, device_id: "" }), null);
  assert.equal(sanitizePayload("nope"), null);
  const p = sanitizePayload({ ...board, mode: "rocket", balance: { risk: "extreme", score: "high" } })!;
  assert.equal(p.mode, "fall_prevention");
  assert.equal(p.balance.risk, "unknown");
  assert.equal(p.balance.score, null);
});

test("Grace's demo reading slides to moderate risk with the call-your-doctor advice", () => {
  const r = demoReading("grace");
  assert.equal(r.payload.balance.risk, "moderate");
  assert.ok(r.payload.warning?.message.includes(WORSENING_ADVICE));
  assert.ok(r.payload.daily[13].score < r.payload.daily[0].score);
});

test("prosthetic preview shows a patient adapting over two weeks", () => {
  const p = demoReading("amira", "prosthetic").payload;
  assert.equal(p.prosthetic?.adaptation, "adapting");
  const d = p.prosthetic!.daily;
  assert.ok(d[13].wear_min > d[0].wear_min && d[13].score > d[0].score && d[13].stumbles < d[0].stumbles);
});

test("agent summary is plain and always carries the worsening advice", () => {
  const s = summarizeForAgent(demoReading("grace"));
  assert.equal(s.connected, true);
  assert.equal(s.advice, WORSENING_ADVICE);
  assert.equal(summarizeForAgent(null).connected, false);
});

test("readings go stale after two minutes", () => {
  const r = demoReading("amira");
  assert.equal(isStale(r, r.receivedAt + 60_000), false);
  assert.equal(isStale(r, r.receivedAt + 3 * 60_000), true);
  assert.equal(isStale(null), true);
});
