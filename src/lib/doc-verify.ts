import type { DocFinding, DocRef, DocSummary } from "./documents";

// Checks the AI's document summary against the document itself: every quoted reference
// must really appear in the PDF text, or it's dropped.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Finds which page a quote is really on. Accepts an exact match, or every word of the quote
// appearing in order on one line (PDF text spacing varies). Returns null if it isn't there.
function locate(quote: string, pages: string[], hint: number): number | null {
  const q = norm(quote);
  if (!q) return null;
  const order = [hint - 1, ...pages.map((_, i) => i).filter((i) => i !== hint - 1)].filter((i) => i >= 0 && i < pages.length);
  for (const i of order) if (norm(pages[i]).includes(q)) return i + 1;
  const words = q.split(" ");
  for (const i of order) {
    for (const line of pages[i].split("\n")) {
      let at = 0;
      const l = norm(line);
      if (words.every((w) => (at = l.indexOf(w, at)) >= 0 && (at += w.length) > 0)) return i + 1;
    }
  }
  return null;
}

// Keeps only references whose quotes really appear in the document, with corrected page numbers.
export function verifySummary(raw: unknown, pages: string[]): DocSummary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const kind = ["lab", "visit", "imaging", "other"].includes(r.kind as string) ? (r.kind as DocSummary["kind"]) : "other";

  const findings: DocFinding[] = (Array.isArray(r.findings) ? r.findings : [])
    .slice(0, 8)
    .map((f: Record<string, unknown>) => {
      const refs: DocRef[] = [];
      for (const ref of Array.isArray(f.refs) ? f.refs : []) {
        const quote = str(ref?.quote, 200);
        const page = locate(quote, pages, Number(ref?.page) || 1);
        if (page && !refs.some((x) => x.quote === quote)) refs.push({ page, quote });
      }
      const status = ["attention", "good", "info"].includes(f.status as string) ? (f.status as DocFinding["status"]) : "info";
      return { title: str(f.title, 140), status, explanation: str(f.explanation), comparison: str(f.comparison) || undefined, refs };
    })
    .filter((f) => f.title && f.explanation);

  const rank = { attention: 0, info: 1, good: 2 };
  findings.sort((a, b) => rank[a.status] - rank[b.status]);

  return {
    title: str(r.title, 120) || "Your document",
    kind,
    date: /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : undefined,
    summary: str(r.summary, 900),
    findings,
    questions: (Array.isArray(r.questions) ? r.questions : []).map((q) => str(q, 200)).filter(Boolean).slice(0, 3),
  };
}
