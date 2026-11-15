import { DEMO_PATIENTS } from "@/lib/demo-patients";
import { getMode } from "@/lib/mode";
import { ChevronIcon } from "./icons";

// A slim bar at the top of every page showing whose data is on screen, with a menu to switch
// demo patients (or to the user's own data) in one tap during a presentation. Plain links, so
// the page reloads with the new patient's saved visits and documents.
export async function DemoBar() {
  const { mode, patient } = await getMode();
  const live = mode === "live";

  return (
    <details className="group relative z-20 border-b border-line bg-[#fffdf7] text-[12px]">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 px-5 [&::-webkit-details-marker]:hidden">
        <span className={`clinical-label rounded-sm px-1.5 py-0.5 text-white ${live ? "bg-teal" : "bg-amber"}`}>{live ? "Live" : "Demo"}</span>
        <span className="min-w-0 truncate text-body">
          {live ? "Your linked data" : <><strong className="text-ink">{patient.record.identity.name}</strong> · {patient.focus}</>}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-teal">
          Switch <ChevronIcon width={14} height={14} className="transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <nav aria-label="Demo patients" className="absolute inset-x-0 top-full flex flex-col border-b border-line bg-white shadow-lg">
        {DEMO_PATIENTS.map((p) => {
          const current = !live && p.id === patient.id;
          return (
            <a
              key={p.id}
              href={`/api/demo?patient=${p.id}&next=/profile`}
              aria-current={current ? "true" : undefined}
              className={`flex flex-col gap-0.5 border-l-4 px-5 py-2.5 ${current ? "border-teal bg-teal-soft" : "border-transparent hover:bg-sage-soft"}`}
            >
              <span className="text-[13px] font-semibold text-ink">
                {p.record.identity.name}, {p.age} <span className="font-normal text-muted">· {p.focus}</span>
              </span>
              <span className="text-[12px] leading-snug text-muted">{p.tagline}</span>
            </a>
          );
        })}
        <a
          href="/api/demo?mode=live&next=/connections"
          aria-current={live ? "true" : undefined}
          className={`flex flex-col gap-0.5 border-t border-l-4 border-t-line px-5 py-2.5 ${live ? "border-l-teal bg-teal-soft" : "border-l-transparent hover:bg-sage-soft"}`}
        >
          <span className="text-[13px] font-semibold text-ink">Live mode · my own data</span>
          <span className="text-[12px] leading-snug text-muted">No filler data. Shows only what you link from MyChart and Fitbit.</span>
        </a>
      </nav>
    </details>
  );
}
