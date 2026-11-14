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
      className="sticky bottom-0 grid grid-cols-3 border-t border-line bg-white px-6 pt-2.5 pb-6"
    >
      {ITEMS.map(({ href, label, Icon }) => {
        const current = href === active;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={`flex min-h-11 flex-col items-center gap-1 text-[11px] ${
              current ? "font-semibold text-teal" : "text-subtle"
            }`}
          >
            <Icon width={22} height={22} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
