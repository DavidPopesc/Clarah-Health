"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";

// Tilts its card toward the pointer on devices with a mouse or trackpad.
// Touch and reduced-motion users get a static card.
export function Tilt({
  children,
  className = "",
  max = 5,
  order,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  order?: number; // staggers the .rise entrance
}) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--ry", `${(x - 0.5) * 2 * max}deg`);
    el.style.setProperty("--rx", `${(0.5 - y) * 2 * max}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.dataset.active = "true";
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.dataset.active = "false";
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`tilt relative ${className}`}
      style={order === undefined ? undefined : ({ "--i": order } as CSSProperties)}
    >
      {children}
      <span aria-hidden="true" className="tilt-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}
