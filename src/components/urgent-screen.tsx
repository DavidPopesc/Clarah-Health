import type { RedFlag } from "@/lib/red-flags";
import { InfoIcon, PhoneIcon, WarningIcon } from "./icons";

export function UrgentScreen({ flag, onBack }: { flag: RedFlag; onBack: () => void }) {
  const isCrisisLine = flag.level === "crisis_line";
  const headerColor = isCrisisLine ? "bg-teal-dark" : "bg-alert";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="urgent-title"
      aria-describedby="urgent-message"
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[460px] flex-col overflow-y-auto bg-white lg:max-w-none lg:items-center lg:justify-center lg:bg-ink/60 lg:p-8"
    >
      <div className="flex min-h-full w-full flex-col bg-white lg:min-h-0 lg:max-w-xl lg:border lg:border-[#70141c]">
      <div className={`flex flex-col gap-3.5 px-6 pt-16 pb-7 text-white lg:pt-10 ${headerColor}`}>
        <div className="flex size-[52px] items-center justify-center rounded-2xl bg-white text-alert shadow-[inset_0_-3px_0_rgba(0,0,0,0.12),0_10px_20px_-8px_rgba(0,0,0,0.45)]">
          <WarningIcon width={28} height={28} className={isCrisisLine ? "text-teal-dark" : ""} />
        </div>
        <h1 id="urgent-title" className="font-display text-[30px] leading-[1.15] font-semibold">
          {flag.title}
        </h1>
        <p id="urgent-message" className="text-[15px] leading-normal">
          {flag.message}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-6">
        {flag.actions.map((action) =>
          action.primary ? (
            <a
              key={action.label}
              href={action.href}
              className={`press flex min-h-14 items-center justify-center gap-2.5 rounded-[14px] text-[17px] font-semibold text-white ${isCrisisLine ? "press-crisis" : "press-alert"}`}
            >
              <PhoneIcon /> {action.label}
            </a>
          ) : (
            <a
              key={action.label}
              href={action.href}
              className="tile-3d flex min-h-[52px] items-center justify-center rounded-[14px] border-[1.5px] border-ink text-[15px] font-semibold text-ink"
            >
              {action.label}
            </a>
          ),
        )}
      </div>

      {flag.alsoCall911If && (
        <div className="mx-6 flex flex-col gap-2 rounded-2xl bg-ground p-4">
          <span className="text-[13px] font-semibold text-muted">Call 911 if you have</span>
          <ul className="list-disc pl-[18px] text-sm leading-relaxed text-body">
            {flag.alsoCall911If.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grow" />

      <div className="flex flex-col gap-4 px-6 pt-6 pb-8">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 text-sm font-semibold text-muted underline"
        >
          I&apos;m safe, go back to chat
        </button>
        <div className="flex items-start gap-2.5 text-xs leading-snug text-subtle">
          <InfoIcon width={16} height={16} className="mt-px shrink-0" />
          <span>
            Clara always stops and shows this screen when a reading or symptom matches an emergency rule. A fixed safety check makes that call, not the AI.
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
