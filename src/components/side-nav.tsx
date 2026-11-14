"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./bottom-nav";
import { HeartIcon } from "./icons";

// Desktop navigation (lg and up). Phones use the bottom bar instead.
export function SideNav() {
  const pathname = usePathname();
  if (pathname === "/today") return null;

  return (
    <nav aria-label="Main" className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#5e2618] bg-[#783120] text-white lg:flex">
      <Link href="/" className="flex items-center gap-3 px-6 pt-7 pb-8">
        <span className="flex size-10 items-center justify-center border border-white/30 bg-white/10">
          <HeartIcon width={20} height={20} />
        </span>
        <span className="flex flex-col">
          <span className="text-lg leading-tight font-semibold">Clara</span>
          <span className="clinical-label text-[#f3d9cc]">Health record</span>
        </span>
      </Link>
      <ul className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`relative flex min-h-11 items-center gap-3 px-3 text-sm font-semibold transition-colors ${
                  current ? "bg-white/15 text-white" : "text-[#f3d9cc] hover:bg-white/10 hover:text-white"
                }`}
              >
                {current && <span className="absolute inset-y-0 left-0 w-[3px] bg-[#f3d9cc]" />}
                <Icon width={18} height={18} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto px-6 pb-6 text-[11px] leading-snug text-[#f3d9cc]/80">
        Clara explains and informs. It does not diagnose or replace your care team.
      </p>
    </nav>
  );
}
