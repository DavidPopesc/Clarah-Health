import type { DailyWearable, WearableSummary } from "./types";

// Fitbit Web API, OAuth 2.0 authorization code flow with PKCE.
// Register an app at https://dev.fitbit.com/apps (type "Personal" works for demos).

export const fitbitConfig = {
  clientId: process.env.FITBIT_CLIENT_ID,
  clientSecret: process.env.FITBIT_CLIENT_SECRET,
  authorizeUrl: "https://www.fitbit.com/oauth2/authorize",
  tokenUrl: "https://api.fitbit.com/oauth2/token",
  scope: "heartrate sleep activity",
};

export const fitbitEnabled = () => Boolean(fitbitConfig.clientId && fitbitConfig.clientSecret);

/* eslint-disable @typescript-eslint/no-explicit-any -- raw Fitbit JSON */

async function fitbitGet(path: string, token: string): Promise<any> {
  const res = await fetch(`https://api.fitbit.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fitbit ${path} failed: ${res.status}`);
  return res.json();
}

export async function fetchFitbitWeek(token: string, today = new Date()): Promise<WearableSummary> {
  const end = today.toISOString().slice(0, 10);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 6);
  const start = startDate.toISOString().slice(0, 10);

  const [heart, sleep, steps] = await Promise.all([
    fitbitGet(`/1/user/-/activities/heart/date/${end}/7d.json`, token),
    fitbitGet(`/1.2/user/-/sleep/date/${start}/${end}.json`, token),
    fitbitGet(`/1/user/-/activities/steps/date/${end}/7d.json`, token),
  ]);

  const byDate = new Map<string, DailyWearable>();
  const get = (date: string) => {
    if (!byDate.has(date)) byDate.set(date, { date });
    return byDate.get(date)!;
  };

  for (const d of heart["activities-heart"] ?? []) {
    if (d.value?.restingHeartRate) get(d.dateTime).restingHeartRate = d.value.restingHeartRate;
  }
  for (const s of sleep.sleep ?? []) {
    if (s.isMainSleep) get(s.dateOfSleep).minutesAsleep = s.minutesAsleep;
  }
  for (const d of steps["activities-steps"] ?? []) {
    get(d.dateTime).steps = Number(d.value);
  }

  return {
    source: "fitbit",
    days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
