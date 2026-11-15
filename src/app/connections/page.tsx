import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { SourcesBody } from "@/components/sources-body";
import { ClaraLogo } from "@/components/icons";
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

        {/* Desktop: the content is centred; each source is pinned to the 3D body where its data comes from. */}
        <div className="desk flex grow flex-col gap-6 lg:gap-8">
        <div className="mx-5 flex flex-col gap-2 border-b-2 border-ink pb-4 lg:mx-0 lg:max-w-3xl">
          <span className="clinical-label text-teal">Private by design</span>
          <h1 className="text-[28px] leading-[1.15] font-semibold lg:text-[38px]">
            Answers about your health, from your own data.
          </h1>
          <p className="text-[15px] leading-normal text-muted lg:text-[16px]">
            Connect your records, your watch and your Steady wearable so Clarah can explain your numbers in plain language and check whether something is safe for you.
          </p>
        </div>

        {errorText && (
          <p role="alert" className="mx-5 border-l-4 border-amber bg-amber-soft p-3 text-sm text-amber-ink lg:mx-0">
            {errorText}
          </p>
        )}

        <SourcesBody
          items={[
            {
              title: "MyChart (Epic)",
              detail: "Meds, labs, diagnoses · read-only",
              icon: "record",
              linked: status.epic,
              enabled: epicEnabled(),
              connectHref: "/api/auth/epic/login",
              focus: { region: "heart", system: "circulatory", label: "Your whole health record", reason: "" },
            },
            {
              title: "Fitbit",
              detail: "Heart rate, sleep, activity",
              icon: "watch",
              linked: status.fitbit,
              enabled: fitbitEnabled(),
              connectHref: "/api/auth/fitbit/login",
              focus: { region: "wrist", side: "left", system: "skeletal", label: "Worn on the wrist", reason: "" },
            },
            {
              title: "Clarah Steady wearable",
              detail: "Walking steadiness, falls, prosthetic adaptation",
              icon: "watch",
              linked: steadyLinked,
              enabled: true,
              connectHref: "/steady",
              openHref: "/steady",
              focus: { region: "hip", side: "right", system: "skeletal", label: "Clipped at the waist", reason: "" },
            },
          ]}
        />

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
