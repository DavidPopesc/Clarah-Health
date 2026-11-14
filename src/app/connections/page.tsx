import Link from "next/link";
import { BottomNav } from "@/components/bottom-nav";
import { HeroHeart } from "@/components/hero-heart";
import { Tilt } from "@/components/tilt";
import { AnonIcon, CheckIcon, HeartIcon, LockIcon, RecordIcon, TrashIcon, WatchIcon } from "@/components/icons";
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
    <Tilt className="rise rounded-2xl" max={4} order={index}>
      <div className="slab flex items-center gap-3.5 rounded-2xl p-4">
        <div className="tile-teal flex size-11 shrink-0 items-center justify-center rounded-xl text-teal">
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
            className="tile-3d flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-teal"
          >
            Connect
          </a>
        ) : (
          <span className="well shrink-0 rounded-full px-2.5 py-1 whitespace-nowrap text-[12px] font-medium text-muted">Demo data</span>
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
      <main className="flex grow flex-col gap-6 px-6 pt-12 pb-8">
        <div className="flex items-center gap-2.5">
          <div className="press flex size-9 items-center justify-center rounded-xl text-white">
            <HeartIcon />
          </div>
          <span className="font-display text-xl font-semibold">Clara</span>
        </div>

        <div className="rise">
          <HeroHeart />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[30px] leading-[1.15] font-semibold">
            Answers about your health, from your own data.
          </h1>
          <p className="text-[15px] leading-normal text-muted">
            Connect your records and your watch so Clara can explain your numbers in plain language and check whether something is safe for you.
          </p>
        </div>

        {errorText && (
          <p role="alert" className="rounded-xl bg-amber-soft p-3 text-sm text-amber-ink">
            {errorText}
          </p>
        )}

        <div className="flex flex-col gap-3">
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

        <div className="well flex flex-col gap-2.5 rounded-2xl p-4">
          <span className="text-[13px] font-semibold">How your data is handled</span>
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

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="press flex min-h-[52px] items-center justify-center rounded-[14px] text-base font-semibold text-white"
          >
            Done
          </Link>
          <p className="text-center text-xs leading-snug text-subtle">
            Clara explains and informs. It does not diagnose or replace your care team.
          </p>
        </div>
      </main>
      <BottomNav active="/connections" />
    </>
  );
}
