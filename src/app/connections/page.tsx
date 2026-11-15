import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { HeroHeart } from "@/components/hero-heart";
import { Tilt } from "@/components/tilt";
import { CheckIcon, ClaraLogo, RecordIcon, WatchIcon } from "@/components/icons";
import { connectionStatus } from "@/lib/data";
import { DEMO_PATIENTS } from "@/lib/demo-patients";
import { epicEnabled } from "@/lib/epic";
import { getMode } from "@/lib/mode";
import { fitbitEnabled } from "@/lib/fitbit";
import { isStale, latestReading } from "@/lib/steady";

const ERRORS: Record<string, string> = {
  epic_not_configured: "MyChart isn't configured yet. Add EPIC_CLIENT_ID to use the Epic sandbox. Clarah is using the demo patient for now.",
  epic_auth_failed: "We couldn't link MyChart. Please try again.",
  fitbit_not_configured: "Fitbit isn't configured yet. Add FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET. Clarah is using demo wearable data for now.",
  fitbit_auth_failed: "We couldn't link Fitbit. Please try again.",
};

function ConnectionCard({
  title,
  detail,
  Icon,
  linked,
  enabled,
  href,
  index,
}: {
  title: string;
  detail: string;
  Icon: typeof RecordIcon;
  linked: boolean;
  enabled: boolean;
  href: string;
  index: number;
}) {
  return (
    <Tilt className="rise rounded-md" max={4} order={index}>
      <div className="slab flex items-center gap-3.5 rounded-md p-4">
        <div className="tile-teal flex size-11 shrink-0 items-center justify-center rounded-md text-teal">
          <Icon width={22} height={22} />
        </div>
        <div className="flex grow flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className="text-[13px] text-muted">{detail}</span>
        </div>
        {linked ? (
          <span className="flex items-center gap-1 text-[13px] font-semibold text-teal">
            <CheckIcon width={16} height={16} /> Linked
          </span>
        ) : enabled ? (
          <a
            href={href}
            className="tile-3d flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-teal"
          >
            Connect
          </a>
        ) : (
          <span className="well shrink-0 rounded-md px-2.5 py-1 whitespace-nowrap text-[12px] font-medium text-muted">Demo data</span>
        )}
      </div>
    </Tilt>
  );
}

export const metadata = { title: "Connections · Clarah Health" };

export default async function ConnectPage({ searchParams }: PageProps<"/connections">) {
  const { error } = await searchParams;
  const [status, { patient }] = await Promise.all([connectionStatus(), getMode()]);
  const demo = status.mode === "demo";
  // In demo mode the patient's Steady shows as linked; live, only if the board reported recently.
  const steadyLinked = demo || !isStale(await latestReading().catch(() => null));
  const errorText = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <>
      <main className="flex grow flex-col gap-6 pb-8 lg:gap-8">
        <div className="bg-eucalyptus px-5 pt-10 pb-5 text-white lg:py-7">
          <div className="desk flex items-center gap-3">
            <div className="flex size-10 items-center justify-center border border-white/30 bg-white/10">
              <ClaraLogo width={24} height={24} />
            </div>
            <div>
              <span className="clinical-label block text-[#dfe8d8]">Data access</span>
              <span className="text-xl font-semibold lg:text-[26px]">Clarah Health connections</span>
            </div>
          </div>
        </div>

        {/* Desktop: the content is centred, with the 3D heart beside the intro. */}
        <div className="desk flex grow flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-10">
        <div className="mx-5 rise lg:mx-0 lg:[&>div]:h-[300px]">
          <HeroHeart />
        </div>

        <div className="mx-5 flex flex-col gap-2 border-b-2 border-ink pb-4 lg:mx-0">
          <span className="clinical-label text-teal">Private by design</span>
          <h1 className="text-[28px] leading-[1.15] font-semibold lg:text-[38px]">
            Answers about your health, from your own data.
          </h1>
          <p className="text-[15px] leading-normal text-muted lg:text-[16px]">
            Connect your records and your watch so Clarah can explain your numbers in plain language and check whether something is safe for you.
          </p>
        </div>
        </div>

        {errorText && (
          <p role="alert" className="mx-5 border-l-4 border-amber bg-amber-soft p-3 text-sm text-amber-ink lg:mx-0">
            {errorText}
          </p>
        )}

        <div className="mx-5 flex flex-col gap-3 lg:mx-0 lg:grid lg:grid-cols-2">
          <ConnectionCard
            title="MyChart (Epic)"
            detail="Meds, labs, diagnoses · read-only"
            Icon={RecordIcon}
            linked={status.epic}
            enabled={epicEnabled()}
            href="/api/auth/epic/login"
            index={1}
          />
          <ConnectionCard
            title="Fitbit"
            detail="Heart rate, sleep, activity"
            Icon={WatchIcon}
            linked={status.fitbit}
            enabled={fitbitEnabled()}
            href="/api/auth/fitbit/login"
            index={2}
          />
          <ConnectionCard
            title="Clarah Steady wearable"
            detail="Walking steadiness, falls, prosthetic adaptation"
            Icon={WatchIcon}
            linked={steadyLinked}
            enabled
            href="/steady"
            index={3}
          />
        </div>

        <section className="mx-5 flex flex-col gap-3 lg:mx-0" aria-labelledby="mode-heading">
          <div className="flex items-end justify-between gap-3 border-b-2 border-ink pb-2">
            <div>
              <span className="clinical-label text-teal">For presentations</span>
              <h2 id="mode-heading" className="mt-1 text-xl font-semibold">Whose data is shown</h2>
            </div>
          </div>
          <div className="well grid grid-cols-2 gap-1 rounded-md p-1 text-[13px] font-semibold" role="group" aria-label="Mode">
            <a href={`/api/demo?patient=${patient.id}&next=/connections`} aria-current={demo ? "true" : undefined} className={`flex min-h-10 items-center justify-center rounded ${demo ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
              Demo patients
            </a>
            <a href="/api/demo?mode=live&next=/connections" aria-current={!demo ? "true" : undefined} className={`flex min-h-10 items-center justify-center rounded ${!demo ? "bg-white text-ink shadow-sm" : "text-muted"}`}>
              My own data
            </a>
          </div>
          <p className="text-[13px] leading-snug text-muted">
            {demo
              ? "Demo mode uses made-up patients with full records, wearable data and a sample visit. None of them are real people."
              : "Live mode shows only what you link above, with no filler data."}
          </p>
          {demo && (
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
              {DEMO_PATIENTS.map((p) => {
                const current = p.id === patient.id;
                return (
                  <a
                    key={p.id}
                    href={`/api/demo?patient=${p.id}&next=/profile`}
                    aria-current={current ? "true" : undefined}
                    className={`slab flex flex-col gap-2 rounded-md border-l-4 p-4 ${current ? "border-teal" : "border-transparent"}`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-[15px] font-semibold text-ink">{p.record.identity.name}, {p.age}</span>
                        <span className="clinical-label text-teal">{p.focus}</span>
                      </span>
                      <span className={`shrink-0 text-[12px] font-semibold ${current ? "text-teal-dark" : "text-teal underline"}`}>
                        {current ? "Viewing" : "Switch"}
                      </span>
                    </span>
                    <span className="text-[13px] leading-snug text-body">{p.story}</span>
                    <span className="text-[12px] leading-snug text-subtle">
                      Also: {p.record.conditions.slice(1).map((c) => c.name.replace(/\s*\(.*\)$/, "")).join(" · ")}
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </section>

        {(status.live.epic || status.live.fitbit) && (
          <form action="/api/disconnect" method="post" className="mx-5 lg:mx-0">
            <button type="submit" className="min-h-11 text-[13px] font-semibold text-alert underline">
              Disconnect all accounts
            </button>
          </form>
        )}

        <div className="grow" />

        <div className="mx-5 flex flex-col gap-3 lg:mx-0 lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-6">
          <Link
            href="/profile"
            className="press flex min-h-[52px] items-center justify-center rounded-md text-base font-semibold text-white lg:w-56"
          >
            Done
          </Link>
          <p className="text-center text-xs leading-snug text-subtle lg:text-left">
            Clarah explains and informs. It does not diagnose or replace your care team.{" "}
            <Link href="/terms" className="font-semibold text-teal">Terms</Link> ·{" "}
            <Link href="/privacy" className="font-semibold text-teal">Privacy</Link>
          </p>
        </div>
        </div>
      </main>
      <BottomNav active="/connections" />
    </>
  );
}
