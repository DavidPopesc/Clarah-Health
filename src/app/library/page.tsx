import { BottomNav } from "@/components/bottom-nav";
import { LibrarySearch } from "@/components/library-search";
import { typesenseConfigured } from "@/lib/typesense";
import { connection } from "next/server";

export const metadata = { title: "Health library · Clarah Health" };
export default async function LibraryPage() {
  await connection();
  return <>
    <main className="flex grow flex-col pb-8">
      <header className="bg-eucalyptus px-5 pt-10 pb-6 text-white lg:py-8"><div className="desk">
        <span className="clinical-label block text-[#dfe8d8]">Trusted health references</span>
        <h1 className="mt-1 text-2xl font-semibold lg:text-[30px]">Health library</h1>
        <p className="mt-2 max-w-xl text-sm text-[#e5eee8]">Explore medications, lab tests, conditions, and supplements in plain language.</p>
      </div></header>
      <div className="desk w-full px-5 py-6 lg:py-8">
        {typesenseConfigured() ? <LibrarySearch /> : <div className="slab border-l-4 border-l-teal p-5" role="status">
          <h2 className="font-semibold">Search isn’t set up yet</h2>
          <p className="mt-2 text-sm leading-6 text-body">The health library will be available once its search service is connected.</p>
        </div>}
      </div>
    </main>
    <BottomNav active="/library" />
  </>;
}
