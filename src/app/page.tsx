import Link from "next/link";
import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { AttentionList } from "@/components/home/attention-list";
import { Documents } from "@/components/home/documents";
import { UploadTile } from "@/components/home/upload-tile";
import { MetricRow } from "@/components/home/result-progress";
import { CheckIcon, RecordIcon, WatchIcon } from "@/components/icons";
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
  Icon,
  linked,
  href,
}: {
  name: string;
  Icon: typeof RecordIcon;
  linked: boolean;
  href: string;
}) {
  const content = (
    <>
      <span className="flex items-center gap-1.5 text-teal">
        <Icon width={15} height={15} />
        <span className="text-xs font-semibold text-ink">{name}</span>
      </span>
      <span className={`flex items-center gap-1 text-[11px] ${linked ? "text-teal-dark" : "text-subtle"}`}>
        {linked && <CheckIcon width={12} height={12} strokeWidth={3} />}
        {linked ? "Linked" : "Connect"}
      </span>
    </>
  );

  const className = "slab lift flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2";
  return linked ? <div className={className} aria-label={`${name}: read-only connection active`}>{content}</div> : <a href={href} className={className} aria-label={`Connect ${name}`}>{content}</a>;
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  await connection();
  const { error } = await searchParams;
  const [record, wearable, status] = await Promise.all([getRecord(), getWearable(), connectionStatus()]);
  const { themes, good } = assessHealth(record, wearable);
  const errorText = typeof error === "string" ? ERRORS[error] : undefined;
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const meds = record.medications.filter((medication) => medication.status === "active");

  return (
    <>
      <main className="flex grow flex-col gap-5 pb-7">
        <header className="bg-[#783120] px-5 py-4 text-white lg:border-b lg:border-[#5e2618] lg:px-10 lg:py-8">
          <div className="lg:mx-auto lg:max-w-6xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="clinical-label text-[#f3d9cc]">Clara health record</span>
            <span className="text-[11px] text-[#f3d9cc]">{today}{record.source === "demo" && " · Demo"}</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <h1 className="min-w-0 text-2xl leading-tight font-semibold lg:text-3xl">Hello, {record.identity.givenName}</h1>
            <div className="shrink-0 border-l border-white/25 pl-3 text-right">
              <strong className="block text-xl leading-none">{themes.length}</strong>
              <span className="clinical-label text-[#f3d9cc]">Focus areas</span>
            </div>
          </div>
          </div>
        </header>

        <div className="flex flex-col gap-7 px-5 lg:mx-auto lg:grid lg:w-full lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10 lg:px-10 lg:pt-3">
          <div className="contents lg:flex lg:flex-col lg:gap-8">
          <section className="order-2 flex flex-col gap-3" aria-labelledby="attention-heading">
            <div className="flex items-end justify-between border-b-2 border-ink pb-2">
              <div>
                <span className="clinical-label text-teal">Connected health picture</span>
                <h2 id="attention-heading" className="mt-1 text-xl font-semibold">Your health focus areas</h2>
              </div>
              <span className="clinical-label text-subtle">{String(themes.length).padStart(2, "0")} areas</span>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">See what improved since your previous results and what still needs follow-up. Open an area for dated comparisons and next steps. Progress uses common ranges; your care team may set different goals.</p>
            <AttentionList themes={themes} />
          </section>

          <div className="order-3"><Documents /></div>
          </div>

          <aside className="contents lg:flex lg:flex-col lg:gap-7" aria-label="Record summary">
          <section className="order-1 flex flex-col gap-2" aria-labelledby="sources-heading">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h2 id="sources-heading" className="clinical-label text-muted">Data sources</h2>
              <Link href="/connections" className="text-xs font-semibold text-teal">Manage access</Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <UploadTile />
              <ConnectRow name="MyChart" Icon={RecordIcon} linked={status.epic} href="/api/auth/epic/login" />
              <ConnectRow name="Fitbit" Icon={WatchIcon} linked={status.fitbit} href="/api/auth/fitbit/login" />
            </div>
            {errorText && <p role="alert" className="border-l-4 border-amber bg-amber-soft px-3 py-2.5 text-[13px] text-amber-ink">{errorText}</p>}
            {!status.epic && !status.fitbit && !errorText && <p className="text-[11px] text-subtle">Using demo data until you link a source.</p>}
          </section>

          {good.length > 0 && (
            <section className="order-4" aria-labelledby="good-heading">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h2 id="good-heading" className="clinical-label text-muted">Within expected range</h2>
                <span className="clinical-label text-teal-dark">Reviewed</span>
              </div>
              <ul className="divide-y divide-line border-x border-b border-line bg-white">
                {good.map((item) => (
                  <li key={item.label} className="px-3.5 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <CheckIcon width={16} height={16} className="shrink-0 text-teal" />
                      <span className="grow font-medium">{item.label}</span>
                      <span className="font-mono text-xs text-subtle">{item.value}</span>
                    </div>
                    {item.progress && <div className="mt-2"><MetricRow progress={item.progress} /></div>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meds.length > 0 && (
            <section className="order-5" aria-labelledby="meds-heading">
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

          <Link href="/ask" className="press order-6 flex min-h-14 items-center justify-between rounded-md px-4 text-[15px] font-semibold text-white">
            <span>Ask Clara about this record</span>
            <span aria-hidden="true">→</span>
          </Link>
          </aside>
        </div>
      </main>
      <BottomNav active="/" />
    </>
  );
}
