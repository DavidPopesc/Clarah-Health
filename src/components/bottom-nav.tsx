import Link from "next/link";
import { ChatIcon, HomeIcon, LinkIcon } from "./icons";

const ITEMS = [
  { href: "/today", label: "Today", Icon: HomeIcon },
  { href: "/ask", label: "Ask", Icon: ChatIcon },
  { href: "/", label: "Connections", Icon: LinkIcon },
];

export function BottomNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 px-4 pt-2 pb-5"
    >
      <div className="slab grid grid-cols-3 gap-1 rounded-[22px] p-1.5">
        {ITEMS.map(({ href, label, Icon }) => {
          const current = href === active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] transition-transform ${
                current ? "tile-teal -translate-y-0.5 font-semibold text-teal-dark" : "lift text-subtle"
              }`}
            >
              <Icon width={22} height={22} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
