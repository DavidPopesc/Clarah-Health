"use client";

import type { DocSummary } from "./documents";

// Uploaded documents live only in this browser (IndexedDB): the PDF file and Clarah Health's summary.
// The server only ever sees the extracted text, and keeps nothing.

export interface StoredDoc {
  id: string;
  name: string;
  addedAt: string;
  status: "reading" | "summarizing" | "ready" | "error";
  error?: string;
  summary?: DocSummary;
  pagesRead?: number;
  totalPages?: number;
}

interface State {
  docs: StoredDoc[];
  urls: Record<string, string>; // object URLs for opening the original PDFs
}

const DB_NAME = "clara";
const META = "docs";
const FILES = "files";

let state: State = { docs: [], urls: {} };
let loaded = false;
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META, { keyPath: "id" });
      req.result.createObjectStore(FILES);
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
    const docs = (await tx<StoredDoc[]>(META, "readonly", (s) => s.getAll())).filter((d) => d.status === "ready" || d.status === "error");
    docs.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    const urls: Record<string, string> = {};
    for (const d of docs) {
      const blob = await tx<Blob | undefined>(FILES, "readonly", (s) => s.get(d.id));
      if (blob) urls[d.id] = URL.createObjectURL(blob);
    }
    set({ docs, urls });
  } catch (err) {
    console.error("Couldn't load saved documents", err);
  }
}

export const docStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    void load();
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  getServerSnapshot: () => state,
};

function update(id: string, patch: Partial<StoredDoc>) {
  const docs = state.docs.map((d) => (d.id === id ? { ...d, ...patch } : d));
  set({ docs });
  const doc = docs.find((d) => d.id === id);
  if (doc && (doc.status === "ready" || doc.status === "error")) void tx(META, "readwrite", (s) => s.put(doc));
}

async function extractPages(file: Blob): Promise<string[]> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

export async function addPdf(file: File | Blob, name: string) {
  const id = crypto.randomUUID();
  const doc: StoredDoc = { id, name, addedAt: new Date().toISOString(), status: "reading" };
  set({ docs: [doc, ...state.docs], urls: { ...state.urls, [id]: URL.createObjectURL(file) } });
  void tx(FILES, "readwrite", (s) => s.put(file, id)).catch((err) => console.error("Couldn't save PDF", err));

  try {
    const pages = await extractPages(file);
    update(id, { status: "summarizing" });
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Clarah Health couldn't read this document.");
    update(id, { status: "ready", summary: data.summary, pagesRead: data.pagesRead, totalPages: data.totalPages });
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Clarah Health couldn't read this document.";
    update(id, { status: "error", error: /pdf|password|invalid/i.test(message) && !message.includes("Clarah Health") ? "This file couldn't be opened as a PDF." : message });
  }
}

export async function removeDoc(id: string) {
  const url = state.urls[id];
  if (url) URL.revokeObjectURL(url);
  const urls = { ...state.urls };
  delete urls[id];
  set({ docs: state.docs.filter((d) => d.id !== id), urls });
  await Promise.all([tx(META, "readwrite", (s) => s.delete(id)), tx(FILES, "readwrite", (s) => s.delete(id))]);
}
