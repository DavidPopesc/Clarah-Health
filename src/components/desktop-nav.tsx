"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./bottom-nav";
import { ClaraLogo } from "./icons";

// On a computer, the same navigation as the phone's bottom bar sits in a sidebar instead.
export function DesktopNav() {
  const path = usePathname();
  // Overview lives at "/"; its recording page (/visits/new) belongs to it too.
  const isActive = (href: string) =>
    href === "/" ? path === "/" || path.startsWith("/visits") : path === href || path.startsWith(`${href}/`);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-[#fffdf7] lg:flex">
      <Link href="/" className="flex items-center gap-3 bg-eucalyptus px-6 py-5 text-white">
        <span className="flex size-10 items-center justify-center border border-white/30 bg-white/10">
          <ClaraLogo width={24} height={24} />
        </span>
        <span className="flex flex-col">
          <span className="text-[20px] leading-none font-semibold">Clara</span>
          <span className="clinical-label mt-1 text-[#dfe8d8]">Health record</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const current = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[14px] font-semibold ${
                current ? "bg-teal-soft text-teal-dark" : "text-body hover:bg-sage-soft"
              }`}
            >
              {current && <span className="absolute inset-y-2 left-0 w-1 rounded-r bg-teal" aria-hidden="true" />}
              <Icon width={19} height={19} className={current ? "text-teal" : "text-subtle"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2 border-t border-line px-6 py-5 text-[11px] leading-snug text-subtle">
        <p>Clara explains and informs. It does not diagnose or replace your care team.</p>
        <p className="flex gap-3 font-semibold">
          <Link href="/terms" className="text-teal hover:underline">Terms</Link>
          <Link href="/privacy" className="text-teal hover:underline">Privacy</Link>
        </p>
      </div>
    </aside>
  );
}
