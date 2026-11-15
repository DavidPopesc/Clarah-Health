"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LazyAnatomyScene, useReducedMotion } from "@/components/anatomy/lazy-scene";
import { CheckIcon, RecordIcon, WatchIcon } from "@/components/icons";
import type { BodyFocus } from "@/lib/body";

export interface SourceItem {
  title: string;
  detail: string;
  icon: "record" | "watch";
  linked: boolean;
  /** Linking is configured on this server (otherwise the card shows demo data). */
  enabled: boolean;
  /** Where "Connect" goes when it isn't linked yet. */
  connectHref: string;
  /** Makes the whole card a link, e.g. to the device's page. */
  openHref?: string;
  /** Where this source's data comes from on the body. */
  focus: BodyFocus;
}

const ICONS = { record: RecordIcon, watch: WatchIcon };

function SourceCard({ item, n, cardRef }: { item: SourceItem; n: number; cardRef: (el: HTMLDivElement | null) => void }) {
  const Icon = ICONS[item.icon];
  const status = item.linked ? (
    <span className="flex items-center gap-1 text-[13px] font-semibold text-teal"><CheckIcon width={16} height={16} /> Linked</span>
  ) : item.enabled ? (
    <a href={item.connectHref} className="tile-3d relative z-10 flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-teal">Connect</a>
  ) : (
    <span className="well shrink-0 rounded-md px-2.5 py-1 whitespace-nowrap text-[12px] font-medium text-muted">Demo data</span>
  );
  return (
    <div ref={cardRef} className={`slab relative flex items-center gap-3.5 rounded-md p-4 ${item.openHref ? "lift" : ""}`}>
      <span className="absolute -top-2.5 -left-2.5 flex size-6 items-center justify-center rounded-full bg-[#ffb347] text-[12px] font-bold text-ink shadow-sm lg:hidden">{n}</span>
      <div className="tile-teal flex size-11 shrink-0 items-center justify-center rounded-md text-teal">
        <Icon width={22} height={22} />
      </div>
      <div className="flex min-w-0 grow flex-col gap-0.5">
        {item.openHref ? (
          // The whole card opens the device page; the link's box covers it.
          <Link href={item.openHref} className="text-[15px] font-semibold after:absolute after:inset-0 after:content-['']">{item.title}</Link>
        ) : (
          <span className="text-[15px] font-semibold">{item.title}</span>
        )}
        <span className="text-[13px] text-muted">{item.detail}</span>
        <span className="text-[11px] font-medium text-subtle">{item.focus.label}</span>
      </div>
      {status}
    </div>
  );
}

type Pt = { x: number; y: number };

/**
 * The 3D body with each data source pinned where its data comes from (records at the heart,
 * Fitbit at the wrist, Steady at the hip). On desktop, lines run from each card to its pin; on
 * phones, numbered pins match numbered cards.
 */
export function SourcesBody({ items }: { items: SourceItem[] }) {
  const reducedMotion = useReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const [pins, setPins] = useState<Pt[]>([]);
  const [lines, setLines] = useState<{ from: Pt; to: Pt }[]>([]);
  const [wide, setWide] = useState(false);

  const layout = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    const s = stage.current?.getBoundingClientRect();
    if (!box || !s || pins.length !== items.length) return;
    setLines(
      items.map((_, i) => {
        const c = cards.current[i]?.getBoundingClientRect();
        const to = { x: s.left - box.left + pins[i].x, y: s.top - box.top + pins[i].y };
        if (!c) return { from: to, to };
        // Leave the card from the side that faces the body.
        const left = c.left + c.width / 2 < s.left + s.width / 2;
        return { from: { x: (left ? c.right : c.left) - box.left, y: c.top + c.height / 2 - box.top }, to };
      }),
    );
  }, [items, pins]);

  useLayoutEffect(layout, [layout]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    const ro = new ResizeObserver(() => layout());
    if (wrap.current) ro.observe(wrap.current);
    return () => {
      mq.removeEventListener("change", update);
      ro.disconnect();
    };
  }, [layout]);

  const [first, ...rest] = items;
  const left = [first, rest[0]].filter(Boolean);
  const right = rest.slice(1);

  return (
    <div ref={wrap} className="relative mx-5 flex flex-col gap-4 lg:mx-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)_minmax(0,1fr)] lg:items-center lg:gap-8">
      <div className="order-2 flex flex-col gap-4 lg:order-1 lg:gap-24">
        {left.map((item, i) => (
          <SourceCard key={item.title} item={item} n={i + 1} cardRef={(el) => { cards.current[i] = el; }} />
        ))}
      </div>

      <div ref={stage} className="stage-3d relative order-1 h-[320px] overflow-hidden rounded-md lg:order-2 lg:h-[500px]" aria-hidden="true">
        <LazyAnatomyScene system="muscular" highlights={items.map((i) => i.focus)} interactive={false} still reducedMotion={reducedMotion} onProject={setPins} />
        {!wide && pins.map((p, i) => (
          <span key={i} className="pointer-events-none absolute flex size-6 -translate-x-1/2 -translate-y-[150%] items-center justify-center rounded-full bg-[#ffb347] text-[12px] font-bold text-ink shadow" style={{ left: p.x, top: p.y }}>
            {i + 1}
          </span>
        ))}
      </div>

      <div className="order-3 flex flex-col gap-4">
        {right.map((item, i) => (
          <SourceCard key={item.title} item={item} n={left.length + i + 1} cardRef={(el) => { cards.current[left.length + i] = el; }} />
        ))}
      </div>

      {wide && lines.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {lines.map(({ from, to }, i) => {
            const mid = (from.x + to.x) / 2;
            return (
              <g key={i}>
                <path d={`M${from.x},${from.y} C${mid},${from.y} ${mid},${to.y} ${to.x},${to.y}`} fill="none" stroke="#2a4fa8" strokeWidth="2" strokeDasharray="5 5" opacity="0.7" />
                <circle cx={from.x} cy={from.y} r="4" fill="#2a4fa8" />
                <circle cx={to.x} cy={to.y} r="5" fill="#ffb347" stroke="#fff" strokeWidth="2" />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
