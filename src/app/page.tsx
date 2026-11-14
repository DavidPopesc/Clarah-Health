import Link from "next/link";
import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { AttentionList } from "@/components/home/attention-list";
import { Documents } from "@/components/home/documents";
import { UploadTile } from "@/components/home/upload-tile";
import { CheckIcon, ChevronIcon, RecordIcon, WatchIcon } from "@/components/icons";
import { medInfoFor, medlinePlusSearch } from "@/lib/med-info";
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
        <header className="bg-eucalyptus px-5 py-4 text-white lg:py-8">
          <div className="desk">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="clinical-label text-[#dfe8d8]">Clara health record</span>
              <span className="text-[11px] text-[#dfe8d8]">{today}{record.source === "demo" && " · Demo"}</span>
            </div>
            <div className="flex items-end justify-between gap-4">
              <h1 className="min-w-0 text-2xl leading-tight font-semibold lg:text-[34px]">Hello, {record.identity.givenName}</h1>
              <div className="shrink-0 border-l border-white/25 pl-3 text-right lg:pl-5">
                <strong className="block text-xl leading-none lg:text-3xl">{themes.length}</strong>
                <span className="clinical-label text-[#dfe8d8]">Focus areas</span>
              </div>
            </div>
          </div>
        </header>

        {/* Phones: one column in the order below (CSS order). Desktop: the main column holds focus
            areas and documents; the side column holds sources, results in range, meds and Ask. */}
        <div className="desk flex flex-col gap-7 px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-10 lg:pt-3">
          <div className="contents lg:flex lg:flex-col lg:gap-9">
          <section className="order-2 flex flex-col gap-3 lg:order-none" aria-labelledby="attention-heading">
            <div className="flex items-end justify-between border-b-2 border-ink pb-2">
              <div>
                <span className="clinical-label text-teal">Connected health picture</span>
                <h2 id="attention-heading" className="mt-1 text-xl font-semibold lg:text-2xl">Your health focus areas</h2>
              </div>
              <span className="clinical-label text-subtle">{String(themes.length).padStart(2, "0")} areas</span>
            </div>
            <p className="text-[12px] leading-relaxed text-muted lg:text-[13px]">See what improved since your previous results and what still needs follow-up. Open an area for dated comparisons and next steps. Progress uses common ranges; your care team may set different goals.</p>
            <AttentionList themes={themes} />
          </section>

          <div className="order-3 lg:order-none">
            <Documents />
          </div>
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-7">
          <section className="order-1 flex flex-col gap-2 lg:order-none" aria-labelledby="sources-heading">
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
            <section className="order-4 lg:order-none" aria-labelledby="good-heading">
              <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                <h2 id="good-heading" className="clinical-label text-muted">Within expected range</h2>
                <span className="clinical-label text-[#2f5443]">Reviewed</span>
              </div>
              {/* Simple green tiles: everything here is in its expected range. */}
              <ul className="grid grid-cols-2 gap-2 lg:grid-cols-1 xl:grid-cols-2">
                {good.map((item) => (
                  <li key={item.label} className="flex flex-col gap-1 rounded-md border border-[#c3d1bf] bg-[#eaf0e4] px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-3 xl:flex-col xl:items-stretch xl:justify-start xl:gap-1">
                    <span className="flex items-start gap-1.5 text-[12px] leading-snug font-semibold text-[#2f5443]">
                      <CheckIcon width={13} height={13} className="mt-0.5 shrink-0" />
                      {item.label}
                    </span>
                    <span className="pl-[19px] font-mono text-[15px] font-semibold text-[#22402f] lg:pl-0 xl:pl-[19px]">{item.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {meds.length > 0 && (
            <section className="order-5 lg:order-none" aria-labelledby="meds-heading">
              <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
                <h2 id="meds-heading" className="clinical-label text-muted">Active medications</h2>
                <span className="clinical-label text-teal-dark">{meds.length} listed</span>
              </div>
              {/* Medications always use the blue accent, so they're never mistaken for results. */}
              <ul className="flex flex-col gap-2">
                {meds.map((medication) => {
                  const info = medInfoFor(medication.name);
                  return (
                    <li key={medication.name} className="rounded-md border border-[#aebde3] bg-teal-soft px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="size-2.5 shrink-0 rounded-full bg-teal" aria-hidden="true" />
                        <span className="grow text-[14px] font-semibold text-teal-dark">{medication.name}</span>
                        <span className="text-right text-[12px] leading-snug text-body">{medication.dosage}</span>
                      </div>
                      <details className="group mt-1 pl-[22px]">
                        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[12px] font-semibold text-teal [&::-webkit-details-marker]:hidden">
                          What is it?
                          <ChevronIcon width={13} height={13} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-1.5 flex flex-col gap-1.5 rounded border border-[#c8d3ee] bg-white px-2.5 py-2 text-[12px] leading-snug text-body">
                          {info ? (
                            <>
                              <p><span className="font-semibold text-ink">{info.what}</span> {info.does}</p>
                              <p><span className="font-semibold text-ink">Possible side effects:</span> {info.sideEffects.join(" · ")}</p>
                            </>
                          ) : (
                            <p>Clara doesn&apos;t have a summary for this medicine yet. Your pharmacist can explain what it does.</p>
                          )}
                          <a href={medlinePlusSearch(medication.name)} target="_blank" rel="noreferrer" className="w-fit text-[11px] font-semibold text-teal underline-offset-2 hover:underline">
                            More on MedlinePlus
                          </a>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-[10px] leading-snug text-subtle">General information, not advice for you. Ask your pharmacist about other side effects.</p>
            </section>
          )}

          <Link href="/ask" className="press order-6 flex min-h-14 items-center justify-between rounded-md px-4 text-[15px] font-semibold text-white lg:order-none">
            <span>Ask Clara about this record</span>
            <span aria-hidden="true">→</span>
          </Link>
          </div>
        </div>
      </main>
      <BottomNav active="/" />
    </>
  );
}
