"use client";

import type { VisitRecap } from "./visit-verify";

// Visit recaps live only in this browser (IndexedDB), like uploaded documents: Clara's recap,
// the transcript it was made from, and the voice audio once it has been spoken (so replays
// don't ask the AI again). A separate database keeps the documents store untouched.

export interface StoredVisit {
  id: string;
  addedAt: string;
  recap: VisitRecap;
  transcript: string;
}

const DB_NAME = "clara-visits";
const VISITS = "visits";
const AUDIO = "audio";

let visits: StoredVisit[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: StoredVisit[]) {
  visits = next;
  listeners.forEach((l) => l());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(VISITS, { keyPath: "id" });
      req.result.createObjectStore(AUDIO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function load() {
  if (loaded || typeof indexedDB === "undefined") return;
  loaded = true;
  try {
    const all = await tx<StoredVisit[]>(VISITS, "readonly", (s) => s.getAll());
    emit(all.sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
  } catch (err) {
    console.error("Couldn't load saved visits", err);
  }
}

const EMPTY: StoredVisit[] = [];

export const visitStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => listeners.delete(listener);
  },
  getSnapshot: () => visits,
  getServerSnapshot: () => EMPTY,
};

export async function saveVisit(recap: VisitRecap, transcript: string): Promise<StoredVisit> {
  await load();
  const visit: StoredVisit = { id: crypto.randomUUID(), addedAt: new Date().toISOString(), recap, transcript };
  await tx(VISITS, "readwrite", (s) => s.put(visit));
  emit([visit, ...visits]);
  return visit;
}

export async function removeVisit(id: string) {
  emit(visits.filter((v) => v.id !== id));
  const keys = await tx<IDBValidKey[]>(AUDIO, "readonly", (s) => s.getAllKeys());
  await Promise.all([
    tx(VISITS, "readwrite", (s) => s.delete(id)),
    ...keys.filter((k) => String(k).startsWith(`${id}:`)).map((k) => tx(AUDIO, "readwrite", (s) => s.delete(k))),
  ]);
}

export const getAudio = (key: string) => tx<Blob | undefined>(AUDIO, "readonly", (s) => s.get(key)).catch(() => undefined);
export const putAudio = (key: string, blob: Blob) => tx(AUDIO, "readwrite", (s) => s.put(blob, key)).catch(() => undefined);
