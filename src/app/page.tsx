import Link from "next/link";
import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { AttentionList } from "@/components/home/attention-list";
import { Documents } from "@/components/home/documents";
import { UploadTile } from "@/components/home/upload-tile";
import { CheckIcon, HeartIcon, RecordIcon, WatchIcon } from "@/components/icons";
import { assessHealth } from "@/lib/attention";
import { connectionStatus, getRecord, getWearable } from "@/lib/data";

const ERRORS: Record<string, string> = {
  epic_not_configured: "MyChart linking isn't set up on this server yet, so Clara is using the demo patient.",
  epic_auth_failed: "We couldn't link MyChart. Please try again.",
  fitbit_not_configured: "Fitbit linking isn't set up on this server yet, so Clara is using demo wearable data.",
  fitbit_auth_failed: "We couldn't link Fitbit. Please try again.",
};

function ConnectRow({
  name,
  detail,
  Icon,
  linked,
  href,
}: {
  name: string;
  detail: string;
  Icon: typeof RecordIcon;
  linked: boolean;
  href: string;
}) {
  const content = (
    <>
      <span className="tile-teal flex size-10 shrink-0 items-center justify-center rounded-md text-teal">
        <Icon width={20} height={20} />
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="text-sm font-semibold text-ink">{name}</span>
        <span className="text-xs text-subtle">{linked ? "Read-only connection active" : detail}</span>
      </span>
      <span className={`clinical-label flex items-center gap-1 ${linked ? "text-teal-dark" : "text-teal"}`}>
        {linked && <CheckIcon width={14} height={14} strokeWidth={3} />}
        {linked ? "Linked" : "Connect"}
      </span>
    </>
  );

  const className = "slab lift flex min-h-16 items-center gap-3 rounded-md px-3.5 py-3 text-left";
  return linked ? <div className={className}>{content}</div> : <a href={href} className={className}>{content}</a>;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await connection();
  const { error } = await searchParams;
  const [record, wearable, status] = await Promise.all([getRecord(), getWearable(), connectionStatus()]);
  const { themes, good } = assessHealth(record, wearable);
  const errorText = typeof error === "string" ? ERRORS[error] : undefined;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const meds = record.medications.filter((medication) => medication.status === "active");

  return (
    <>
      <main className="flex grow flex-col gap-7 pb-7">
        <header className="bg-[#783120] px-5 pt-10 pb-6 text-white">
          <div className="mb-6 flex items-center justify-between border-b border-white/20 pb-3">
            <span className="clinical-label text-[#f3d9cc]">Clara health record</span>
            <span className="flex size-9 items-center justify-center border border-white/30 bg-white/10" aria-hidden="true">
              <HeartIcon width={19} height={19} />
            </span>
          </div>
          <p className="clinical-label mb-2 text-[#f3d9cc]">{today}{record.source === "demo" && " · Demo record"}</p>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-white/70">Patient overview</p>
              <h1 className="mt-0.5 text-[30px] leading-tight font-semibold">Hello, {record.identity.givenName}</h1>
            </div>
            <div className="border-l border-white/25 pl-4 text-right">
              <strong className="block text-2xl leading-none">{themes.length}</strong>
              <span className="clinical-label text-[#f3d9cc]">Focus areas</span>
            </div>
          </div>
        </header>

        <div className="flex flex-col gap-7 px-5">
          <section className="flex flex-col gap-2.5" aria-labelledby="sources-heading">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 id="sources-heading" className="clinical-label text-muted">Data sources</h2>
              <Link href="/connections" className="text-xs font-semibold text-teal">Manage access</Link>
            </div>
            <UploadTile />
            <ConnectRow name="MyChart" detail="Link medications, labs, and diagnoses" Icon={RecordIcon} linked={status.epic} href="/api/auth/epic/login" />
            <ConnectRow name="Fitbit" detail="Link sleep, activity, and heart rate" Icon={WatchIcon} linked={status.fitbit} href="/api/auth/fitbit/login" />
            {errorText && <p role="alert" className="border-l-4 border-amber bg-amber-soft px-3 py-2.5 text-[13px] text-amber-ink">{errorText}</p>}
            {!status.epic && !status.fitbit && !errorText && <p className="text-xs text-subtle">Demo data stays active until a source is linked.</p>}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="attention-heading">
            <div className="flex items-end justify-between border-b-2 border-ink pb-2">
              <div>
                <span className="clinical-label text-teal">Connected health picture</span>
                <h2 id="attention-heading" className="mt-1 text-xl font-semibold">Your health focus areas</h2>
              </div>
              <span className="clinical-label text-subtle">{String(themes.length).padStart(2, "0")} areas</span>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">Related labs, vital signs, medicines and clinician notes are grouped together. Open an area to see its subissues, evidence and overall next steps.</p>
            <AttentionList themes={themes} />
          </section>

          <Documents />

          {good.length > 0 && (
            <section aria-labelledby="good-heading">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h2 id="good-heading" className="clinical-label text-muted">Within expected range</h2>
                <span className="clinical-label text-teal-dark">Reviewed</span>
              </div>
              <ul className="divide-y divide-line border-x border-b border-line bg-white">
                {good.map((item) => (
                  <li key={item.label} className="flex items-center gap-3 px-3.5 py-3 text-sm">
                    <CheckIcon width={16} height={16} className="text-teal" />
                    <span className="grow font-medium">{item.label}</span>
                    <span className="font-mono text-xs text-subtle">{item.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meds.length > 0 && (
            <section aria-labelledby="meds-heading">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h2 id="meds-heading" className="clinical-label text-muted">Active medications</h2>
                <span className="clinical-label text-subtle">{meds.length} listed</span>
              </div>
              <ul className="divide-y divide-line border-x border-b border-line bg-white">
                {meds.map((medication) => (
                  <li key={medication.name} className="grid grid-cols-[1fr_auto] gap-4 px-3.5 py-3 text-sm">
                    <span className="font-semibold">{medication.name}</span>
                    <span className="text-right text-subtle">{medication.dosage}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Link href="/ask" className="press flex min-h-14 items-center justify-between rounded-md px-4 text-[15px] font-semibold text-white">
            <span>Ask Clara about this record</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </main>
      <BottomNav active="/" />
    </>
  );
}
