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

function ConnectTile({
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
  const body = (
    <>
      <span className="flex w-full items-start justify-between">
        <Icon width={22} height={22} />
        {linked && (
          <span className="flex size-5 items-center justify-center rounded-full bg-teal text-white" aria-hidden="true">
            <CheckIcon width={13} height={13} strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="flex flex-col">
        <span className="text-[13px] leading-tight font-semibold">{name}</span>
        <span className={`text-[11px] leading-tight ${linked ? "font-semibold text-teal-dark" : "text-subtle"}`}>
          {linked ? "Connected" : detail}
        </span>
      </span>
    </>
  );
  const cls = "flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-2xl p-3 text-left";
  return linked ? (
    <div className={`tile-teal text-teal-dark ${cls}`} aria-label={`${name} connected`}>
      {body}
    </div>
  ) : (
    <a href={href} className={`slab lift text-teal ${cls}`}>
      {body}
    </a>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  // Today's date and the demo data depend on the current time, so render per request.
  await connection();
  const { error } = await searchParams;
  const [record, wearable, status] = await Promise.all([getRecord(), getWearable(), connectionStatus()]);
  const { items, good } = assessHealth(record, wearable);
  const errorText = typeof error === "string" ? ERRORS[error] : undefined;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const meds = record.medications.filter((m) => m.status === "active");

  return (
    <>
      <main className="flex grow flex-col gap-6 px-5 pt-12 pb-6">
        <header className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] text-subtle">
              {today}
              {record.source === "demo" && " · Demo patient"}
            </span>
            <h1 className="font-display text-[26px] leading-tight font-semibold">Hello, {record.identity.givenName}</h1>
          </div>
          <div className="press flex size-10 items-center justify-center rounded-xl text-white" aria-hidden="true">
            <HeartIcon />
          </div>
        </header>

        <section className="flex flex-col gap-2.5" aria-labelledby="add-heading">
          <h2 id="add-heading" className="text-[13px] font-semibold text-muted">
            Add your health info
          </h2>
          <div className="grid grid-cols-3 gap-2.5">
            <UploadTile />
            <ConnectTile name="MyChart" detail="Link records" Icon={RecordIcon} linked={status.epic} href="/api/auth/epic/login" />
            <ConnectTile name="Fitbit" detail="Link activity" Icon={WatchIcon} linked={status.fitbit} href="/api/auth/fitbit/login" />
          </div>
          {errorText && (
            <p role="alert" className="rounded-xl bg-amber-soft p-3 text-[13px] text-amber-ink">
              {errorText}
            </p>
          )}
          {!status.epic && !status.fitbit && !errorText && (
            <p className="text-xs text-subtle">Showing a demo patient until you link an account.</p>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="attention-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="attention-heading" className="font-display text-lg font-semibold">
              What needs your attention
            </h2>
            <span className="text-xs text-subtle">{items.length} {items.length === 1 ? "item" : "items"}</span>
          </div>
          <AttentionList items={items} />
        </section>

        <Documents />

        {good.length > 0 && (
          <section className="flex flex-col gap-2.5" aria-labelledby="good-heading">
            <h2 id="good-heading" className="text-[13px] font-semibold text-muted">
              Looking good
            </h2>
            <ul className="flex flex-wrap gap-2">
              {good.map((g) => (
                <li key={g.label} className="tile-3d flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px]">
                  <CheckIcon width={13} height={13} className="text-teal" />
                  <span className="font-semibold">{g.label}</span>
                  <span className="text-subtle">{g.value}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {meds.length > 0 && (
          <section className="well flex flex-col gap-1.5 rounded-[18px] p-4" aria-labelledby="meds-heading">
            <h2 id="meds-heading" className="text-[13px] font-semibold text-muted">
              Your medications
            </h2>
            <ul className="flex flex-col text-[13px]">
              {meds.map((m) => (
                <li key={m.name} className="flex justify-between gap-3 py-1">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-right text-subtle">{m.dosage}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          href="/ask"
          className="press flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] text-[15px] font-semibold text-white"
        >
          Ask Clara about your health
        </Link>
      </main>
      <BottomNav active="/" />
    </>
  );
}
