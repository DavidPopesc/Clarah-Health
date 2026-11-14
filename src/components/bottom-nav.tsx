import Link from "next/link";
import { ChatIcon, HomeIcon, LinkIcon, VisitIcon } from "./icons";

export const NAV_ITEMS = [
  { href: "/", label: "Overview", Icon: HomeIcon },
  { href: "/ask", label: "Ask Clara", Icon: ChatIcon },
  { href: "/visits", label: "Visits", Icon: VisitIcon },
  { href: "/connections", label: "Sources", Icon: LinkIcon },
];

// Phone navigation. On a computer the sidebar (DesktopNav) replaces it.
export function BottomNav({ active }: { active: string }) {
  return (
    <nav aria-label="Main" className="sticky bottom-0 z-20 border-t border-line bg-white px-3 pb-4 lg:hidden">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const current = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${current ? "text-teal" : "text-subtle"}`}
            >
              {current && <span className="absolute inset-x-5 top-0 h-1 rounded-b bg-linear-to-r from-[#3864c8] to-[#2a4fa8]" />}
              <Icon width={20} height={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
