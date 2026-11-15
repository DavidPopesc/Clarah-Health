import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { HeroHeart } from "@/components/hero-heart";
import { Tilt } from "@/components/tilt";
import { AnonIcon, CheckIcon, ClaraLogo, LockIcon, RecordIcon, TrashIcon, WatchIcon } from "@/components/icons";
import { connectionStatus } from "@/lib/data";
import { epicEnabled } from "@/lib/epic";
import { fitbitEnabled } from "@/lib/fitbit";

const ERRORS: Record<string, string> = {
  epic_not_configured: "MyChart isn't configured yet. Add EPIC_CLIENT_ID to use the Epic sandbox. Clara is using the demo patient for now.",
  epic_auth_failed: "We couldn't link MyChart. Please try again.",
  fitbit_not_configured: "Fitbit isn't configured yet. Add FITBIT_CLIENT_ID and FITBIT_CLIENT_SECRET. Clara is using demo wearable data for now.",
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

export const metadata = { title: "Connections · Clara" };

export default async function ConnectPage({ searchParams }: PageProps<"/connections">) {
  const { error } = await searchParams;
  const status = await connectionStatus();
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
              <span className="text-xl font-semibold lg:text-[26px]">Clara connections</span>
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
            Connect your records and your watch so Clara can explain your numbers in plain language and check whether something is safe for you.
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
        </div>

        <div className="well mx-5 flex flex-col gap-2.5 rounded-md p-4 lg:mx-0 lg:p-5">
          <span className="clinical-label text-muted">How your data is handled</span>
          {[
            { Icon: LockIcon, text: "Read-only access. Clara can never change your records." },
            { Icon: AnonIcon, text: "Your name and ID numbers are removed before anything reaches the AI." },
            { Icon: TrashIcon, text: "Disconnect and delete everything at any time." },
          ].map(({ Icon, text }) => (
            <div key={text} className="flex items-start gap-2.5 text-[13px] leading-snug text-muted">
              <Icon width={16} height={16} className="mt-0.5 shrink-0" />
              <span>{text}</span>
            </div>
          ))}
          {(status.epic || status.fitbit) && (
            <form action="/api/disconnect" method="post">
              <button type="submit" className="min-h-11 text-[13px] font-semibold text-alert underline">
                Disconnect all accounts
              </button>
            </form>
          )}
        </div>

        <div className="grow" />

        <div className="mx-5 flex flex-col gap-3 lg:mx-0 lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-6">
          <Link
            href="/profile"
            className="press flex min-h-[52px] items-center justify-center rounded-md text-base font-semibold text-white lg:w-56"
          >
            Done
          </Link>
          <p className="text-center text-xs leading-snug text-subtle lg:text-left">
            Clara explains and informs. It does not diagnose or replace your care team.{" "}
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
