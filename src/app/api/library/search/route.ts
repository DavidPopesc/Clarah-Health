import { searchLibrary, typesenseConfigured, type LibraryKind } from "@/lib/typesense";

const kinds: LibraryKind[] = ["Medication", "Lab test", "Condition", "Herb & supplement"];

export async function GET(request: Request) {
  if (!typesenseConfigured()) return Response.json({ error: "Search is not set up yet" }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") || undefined;
  if (kind && !kinds.includes(kind as LibraryKind)) return Response.json({ error: "Invalid kind" }, { status: 400 });
  try {
    return Response.json(await searchLibrary(params.get("q") ?? "", kind as LibraryKind | undefined));
  } catch (error) {
    console.error("Library search failed", error);
    return Response.json({ error: "Search is temporarily unavailable" }, { status: 503 });
  }
}
