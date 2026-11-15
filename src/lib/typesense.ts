import "server-only";
import { serviceAccount, vertexAccessToken } from "./vertex-auth";

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

type Passage = { title: string; kind: LibraryKind; section: string; text: string; url: string; source: string };

// The passages carry Gemini Embedding vectors (`vec`, 256 dims, from scripts/knowledge/embed_passages.py).
// Embedding the question the same way lets the search match meaning, not just words.
async function questionVector(q: string): Promise<number[] | null> {
  const account = serviceAccount();
  if (!account) return null;
  try {
    const project = process.env.VERTEX_PROJECT ?? account.project_id;
    const res = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-central1/publishers/google/models/gemini-embedding-001:predict`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${await vertexAccessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ instances: [{ content: q, task_type: "RETRIEVAL_QUERY" }], parameters: { outputDimensionality: 256 } }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { predictions: { embeddings: { values: number[] } }[] };
    return data.predictions[0]?.embeddings.values ?? null;
  } catch {
    return null;
  }
}

export async function searchPassages(query: string, k = 5): Promise<Passage[]> {
  const q = query.trim().slice(0, 500);
  if (!q) return [];
  const perPage = Math.max(1, Math.min(k, 20));
  const pick = (hits: { document: Passage }[] = []) =>
    hits.map(({ document }) => ({ title: document.title, kind: document.kind, section: document.section, text: document.text, url: document.url, source: document.source }));

  // Hybrid: keyword match (typos, synonyms) fused with Gemini-embedding similarity.
  const vector = await questionVector(q);
  if (vector) {
    try {
      const res = await fetch(endpoint("/multi_search"), {
        method: "POST",
        headers: { "X-TYPESENSE-API-KEY": process.env.TYPESENSE_SEARCH_KEY || process.env.TYPESENSE_ADMIN_KEY || "", "Content-Type": "application/json" },
        body: JSON.stringify({
          searches: [{
            collection: "clarah_passages", q, query_by: "title,section,text", exclude_fields: "vec", per_page: perPage,
            prefix: true, num_typos: 2, vector_query: `vec:([${vector.map((x) => x.toFixed(5)).join(",")}], k:50, alpha:0.7)`,
          }],
        }),
        cache: "no-store",
      });
      const data = (await res.json()) as { results: (RawSearch<Passage> & { error?: string })[] };
      const result = data.results?.[0];
      if (res.ok && result && !result.error) return pick(result.hits);
    } catch (error) {
      console.warn("Hybrid passage search failed, using keywords", error);
    }
  }
  const params = new URLSearchParams({ q, per_page: String(perPage), prefix: "true", num_typos: "2", exclude_fields: "vec" });
  const data = await runSearch<Passage>("clarah_passages", params, "title,section,text");
  return pick(data.hits);
}
