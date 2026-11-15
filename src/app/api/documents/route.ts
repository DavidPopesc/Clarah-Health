import { APIError } from "openai";
import { MissingApiKeyError } from "@/lib/agent";
import { getRecord, getWearable } from "@/lib/data";
import { MAX_CHARS, MAX_PAGES, summarizeDocument } from "@/lib/documents";

// Receives the text of a PDF the patient uploaded (extracted in their browser) and returns
// a plain-language summary compared against their history, with references to the pages.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { pages?: unknown } | null;
  const pages = Array.isArray(body?.pages) ? body.pages.filter((p): p is string => typeof p === "string") : [];
  if (!pages.length || !pages.some((p) => p.trim().length > 20)) {
    return Response.json(
      { error: "We couldn't find any text in this PDF. Scanned or photographed pages can't be read yet." },
      { status: 400 },
    );
  }

  // Keep requests a reasonable size: the first pages, up to a character budget.
  let budget = MAX_CHARS;
  const trimmed = pages.slice(0, MAX_PAGES).map((p) => {
    const part = p.slice(0, Math.max(0, budget));
    budget -= part.length;
    return part;
  });

  try {
    const [record, wearable] = await Promise.all([getRecord(), getWearable()]);
    const summary = await summarizeDocument(trimmed, record, wearable);
    return Response.json({ summary, pagesRead: trimmed.filter(Boolean).length, totalPages: pages.length });
  } catch (err) {
    console.error("Document summary error", err);
    if (err instanceof MissingApiKeyError) {
      return Response.json({ error: "Clarah isn't set up yet: add an AI key." }, { status: 500 });
    }
    if (err instanceof APIError && (err.status === 429 || err.status === 503)) {
      return Response.json({ error: "Clarah is busy right now. Try again in a moment." }, { status: 429 });
    }
    return Response.json({ error: "Clarah couldn't read this document. Please try again." }, { status: 500 });
  }
}
