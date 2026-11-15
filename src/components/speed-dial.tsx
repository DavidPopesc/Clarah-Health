import { RATE_LABELS, RATES } from "@/lib/voice";

// Clara's speaking speed: the same three choices in the Overview player and Ask Clara.
export function SpeedDial({ rate, onChange }: { rate: number; onChange: (rate: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Speaking speed">
      {RATES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          aria-pressed={rate === r}
          className={`min-h-9 rounded-md border px-2.5 font-mono text-[12px] ${rate === r ? "border-teal bg-teal-soft font-semibold text-teal-dark" : "border-line text-subtle"}`}
        >
          {RATE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
