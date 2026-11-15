"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LibraryKind, LibraryResults } from "@/lib/typesense";

const EXAMPLES = ["tylenol", "metfromin", "sugar test", "water pill", "ashwagandha"];
const KINDS: LibraryKind[] = ["Medication", "Lab test", "Condition", "Herb & supplement"];

function Highlight({ value }: { value: string }) {
  return <>{value.split(/(<mark>.*?<\/mark>)/gi).map((part, i) => part.startsWith("<mark>") ? <mark key={i} className="bg-amber-soft px-0.5 text-ink">{part.slice(6, -7)}</mark> : part)}</>;
}

export function LibrarySearch() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKind | "">("");
  const [results, setResults] = useState<LibraryResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ q: query });
        if (kind) params.set("kind", kind);
        const response = await fetch(`/api/library/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        setResults(await response.json() as LibraryResults);
      } catch (cause) {
        if (!controller.signal.aborted) setError(true);
        void cause;
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, kind]);

  const counts = new Map(results?.facets.map((facet) => [facet.value, facet.count]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return <div className="max-w-4xl">
    <div className="slab p-4 lg:p-5">
      <label htmlFor="library-search" className="clinical-label block text-eucalyptus">Search the library</label>
      <input id="library-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Medicine, symptom, or lab test" autoComplete="off" className="mt-2 h-12 w-full border border-line bg-white px-3 text-base text-ink placeholder:text-subtle focus:border-teal" />
      <p className="mt-3 text-xs text-muted">Try a common name or a partial word. Spelling doesn’t have to be perfect.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Example searches">
        <span className="clinical-label mr-1 text-subtle">Try</span>
        {EXAMPLES.map((example) => <button type="button" key={example} onClick={() => setQuery(example)} className="border border-line bg-sage-soft px-2.5 py-1.5 text-xs font-medium text-eucalyptus hover:border-teal hover:text-teal">{example}</button>)}
      </div>
    </div>
    <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      <button type="button" aria-pressed={!kind} onClick={() => setKind("")} className={`min-h-10 border px-3 py-2 text-xs font-semibold ${!kind ? "border-teal bg-teal text-white" : "border-line bg-white text-body"}`}>All <span className="ml-1 opacity-75">{total || ""}</span></button>
      {KINDS.map((item) => <button type="button" key={item} aria-pressed={kind === item} onClick={() => setKind(item === kind ? "" : item)} className={`min-h-10 border px-3 py-2 text-xs font-semibold ${kind === item ? "border-teal bg-teal text-white" : "border-line bg-white text-body"}`}>{item} <span className="ml-1 opacity-75">{counts.get(item) ?? 0}</span></button>)}
    </div>
    <div className="mt-6" aria-busy={loading}>
      {loading && <p className="clinical-label text-subtle" role="status">Searching library…</p>}
      {!loading && error && <div className="slab p-5 text-sm text-body" role="alert">Search is temporarily unavailable. Please try again.</div>}
      {!loading && !error && results && <>
        <div className="mb-3 flex items-baseline justify-between border-b border-line pb-2"><h2 className="text-lg font-semibold">{query ? "Search results" : "Browse references"}</h2><span className="clinical-label text-subtle" role="status">{results.found} found</span></div>
        {results.hits.length ? <ul className="divide-y divide-line border border-line bg-[#fffdf7]">
          {results.hits.map((hit) => <li key={hit.id}><Link href={`/library/${encodeURIComponent(hit.id)}`} className="block px-4 py-4 hover:bg-sage-soft focus-visible:bg-sage-soft lg:px-5">
            <span className="clinical-label text-teal">{hit.kind}</span>
            <h3 className="mt-1 text-base font-semibold text-ink"><Highlight value={hit.titleHighlight} /></h3>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-body"><Highlight value={hit.summaryHighlight} /></p>
            <span className="clinical-label mt-3 block text-subtle">{hit.source}</span>
          </Link></li>)}
        </ul> : <div className="slab p-5 text-sm text-body">No references match this search. Try a different term or category.</div>}
      </>}
    </div>
  </div>;
}
