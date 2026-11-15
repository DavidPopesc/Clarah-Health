import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import ReactMarkdown from "react-markdown";
import { BottomNav } from "@/components/bottom-nav";
import { BackIcon } from "@/components/icons";
import { getLibraryDoc, typesenseConfigured } from "@/lib/typesense";

export default async function LibraryDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!typesenseConfigured()) notFound();
  const doc = await getLibraryDoc(id).catch((error) => {
    if (String(error).includes("404")) return null;
    throw error;
  });
  if (!doc) notFound();
  return <>
    <main className="flex grow flex-col pb-8">
      <header className="bg-eucalyptus px-5 pt-7 pb-6 text-white lg:py-8"><div className="desk">
        <Link href="/library" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-white/90 hover:text-white"><BackIcon width={16} height={16} /> Health library</Link>
        <span className="clinical-label block text-[#dfe8d8]">{doc.kind}</span>
        <h1 className="mt-1 max-w-3xl text-2xl font-semibold lg:text-[30px]">{doc.title}</h1>
      </div></header>
      <div className="desk w-full px-5 py-6 lg:py-8"><div className="max-w-3xl">
        <div className="slab border-l-4 border-l-sage p-4 text-sm text-body">
          <span className="clinical-label block text-subtle">Source</span><span className="mt-1 block font-semibold">{doc.source}</span>
          {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-semibold text-teal underline underline-offset-2">Read the original <span className="sr-only">(opens in a new tab)</span></a>}
        </div>
        <article className="library-body mt-6 text-sm leading-7 text-body"><ReactMarkdown>{doc.body}</ReactMarkdown></article>
        <Link href={`/ask?q=${encodeURIComponent(`What should I know about ${doc.title}?`)}`} className="press mt-8 inline-flex min-h-11 items-center px-5 py-2 text-sm font-semibold text-white">Ask Clarah about this</Link>
      </div></div>
    </main>
    <BottomNav active="/library" />
  </>;
}
