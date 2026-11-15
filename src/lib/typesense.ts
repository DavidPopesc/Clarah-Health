import "server-only";

export type LibraryKind = "Medication" | "Lab test" | "Condition" | "Herb & supplement";
export type LibraryDoc = { id: string; title: string; kind: LibraryKind; aliases: string[]; summary: string; body: string; url: string; source: string };
export type LibraryHit = { id: string; title: string; kind: LibraryKind; summary: string; source: string; titleHighlight: string; summaryHighlight: string };
export type LibraryResults = { hits: LibraryHit[]; facets: { value: LibraryKind; count: number }[]; found: number };

export function typesenseConfigured() {
  return Boolean(process.env.TYPESENSE_HOST && (process.env.TYPESENSE_SEARCH_KEY || process.env.TYPESENSE_ADMIN_KEY));
}

function endpoint(path: string) {
  return `${process.env.TYPESENSE_PROTOCOL ?? "https"}://${process.env.TYPESENSE_HOST}:${process.env.TYPESENSE_PORT ?? "443"}${path}`;
}

async function request<T>(path: string): Promise<T> {
  if (!typesenseConfigured()) throw new Error("Typesense is not configured");
  const response = await fetch(endpoint(path), { headers: { "X-TYPESENSE-API-KEY": process.env.TYPESENSE_SEARCH_KEY || process.env.TYPESENSE_ADMIN_KEY || "" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Typesense request failed (${response.status})`);
  return response.json() as Promise<T>;
}

const embeddingAvailable = new Map<string, boolean>();

type RawSearch<T> = {
  found: number;
  hits?: { document: T; highlights?: { field: string; snippet?: string; value?: string }[] }[];
  facet_counts?: { field_name: string; counts: { value: string; count: number }[] }[];
};

function searchPath(collection: string, params: URLSearchParams) {
  return `/collections/${collection}/documents/search?${params.toString()}`;
}

async function runSearch<T>(collection: string, params: URLSearchParams, fields: string) {
  params.set("query_by", fields);
  if (params.get("q") !== "*" && embeddingAvailable.get(collection) !== false) {
    params.set("query_by", `${fields},embedding`);
    params.set("vector_query", "embedding:([], alpha: 0.3)");
    try {
      const result = await request<RawSearch<T>>(searchPath(collection, params));
      embeddingAvailable.set(collection, true);
      return result;
    } catch (error) {
      if (embeddingAvailable.get(collection)) throw error;
      embeddingAvailable.set(collection, false);
    }
  }
  params.set("query_by", fields);
  params.delete("vector_query");
  return request<RawSearch<T>>(searchPath(collection, params));
}

export async function searchLibrary(q: string, kind?: LibraryKind): Promise<LibraryResults> {
  const query = q.trim().slice(0, 200) || "*";
  const params = new URLSearchParams({ q: query, facet_by: "kind", per_page: "24", prefix: "true", num_typos: "2", highlight_fields: "title,aliases,summary", highlight_start_tag: "<mark>", highlight_end_tag: "</mark>" });
  if (kind) params.set("filter_by", `kind:=${JSON.stringify(kind)}`);
  const data = await runSearch<LibraryDoc>("clarah_library", params, "title,aliases,summary");
  let facets = data.facet_counts?.find((facet) => facet.field_name === "kind")?.counts ?? [];
  if (kind) {
    params.delete("filter_by");
    params.set("per_page", "0");
    const all = await runSearch<LibraryDoc>("clarah_library", params, "title,aliases,summary");
    facets = all.facet_counts?.find((facet) => facet.field_name === "kind")?.counts ?? [];
  }
  return {
    found: data.found,
    facets: facets.map(({ value, count }) => ({ value: value as LibraryKind, count })),
    hits: (data.hits ?? []).map(({ document, highlights }) => ({
      id: document.id, title: document.title, kind: document.kind, summary: document.summary, source: document.source,
      titleHighlight: highlights?.find((h) => h.field === "title")?.snippet ?? document.title,
      summaryHighlight: highlights?.find((h) => h.field === "summary")?.snippet ?? document.summary,
    })),
  };
}

export async function getLibraryDoc(id: string) {
  return request<LibraryDoc>(`/collections/clarah_library/documents/${encodeURIComponent(id)}`);
}

export async function searchPassages(query: string, k = 5): Promise<{ title: string; kind: LibraryKind; section: string; text: string; url: string; source: string }[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];
  const params = new URLSearchParams({ q, per_page: String(Math.max(1, Math.min(k, 20))), prefix: "true", num_typos: "2" });
  const data = await runSearch<{ title: string; kind: LibraryKind; section: string; text: string; url: string; source: string }>("clarah_passages", params, "title,section,text");
  return (data.hits ?? []).map(({ document }) => ({ title: document.title, kind: document.kind, section: document.section, text: document.text, url: document.url, source: document.source }));
}
