import Link from "next/link";
import type { ReactNode } from "react";
import { BackIcon } from "./icons";

export const LEGAL_UPDATED = "November 14, 2026";
export const PROJECT_URL = "https://github.com/DavidPopesc/Clarah-Health";

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

// Shared layout for the Terms and Privacy pages: a header band, a short summary, a table of
// contents (beside the text on desktop), and numbered sections.
export function LegalPage({ label, title, summary, sections }: { label: string; title: string; summary: ReactNode; sections: LegalSection[] }) {
  return (
    <main className="flex grow flex-col gap-6 pb-10 lg:gap-8">
      <header className="bg-eucalyptus px-4 pt-10 pb-5 text-white lg:py-7">
        <div className="desk flex items-center gap-3">
          <Link href="/" aria-label="Back to Overview" className="flex size-11 shrink-0 items-center justify-center border border-white/30 bg-white/10">
            <BackIcon width={22} height={22} />
          </Link>
          <div className="flex flex-col">
            <span className="clinical-label text-[#dfe8d8]">{label}</span>
            <h1 className="text-[20px] font-semibold lg:text-[28px]">{title}</h1>
          </div>
        </div>
      </header>

      <div className="desk flex flex-col gap-6 px-5 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-12">
        <nav aria-label="On this page" className="flex flex-col gap-2 lg:sticky lg:top-6">
          <span className="clinical-label text-subtle">On this page</span>
          <ol className="flex flex-col gap-1.5 text-[13px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-teal underline-offset-2 hover:underline">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-subtle">Last updated {LEGAL_UPDATED}</p>
        </nav>

        <article className="flex max-w-3xl flex-col gap-7">
          <div className="border-l-4 border-teal bg-white px-4 py-3 text-[15px] leading-relaxed text-body">{summary}</div>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="flex scroll-mt-6 flex-col gap-2.5">
              <h2 className="border-b border-line pb-1.5 text-[17px] font-semibold text-ink">
                <span className="mr-2 font-mono text-[13px] text-teal">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="legal flex flex-col gap-2.5 text-[14px] leading-relaxed text-body">{s.body}</div>
            </section>
          ))}
          <p className="border-t border-line pt-4 text-[12px] text-subtle">
            See also: <Link href="/terms" className="font-semibold text-teal">Terms of use</Link> ·{" "}
            <Link href="/privacy" className="font-semibold text-teal">Privacy policy</Link>
          </p>
        </article>
      </div>
    </main>
  );
}
