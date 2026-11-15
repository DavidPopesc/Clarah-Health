import { connection } from "next/server";
import { BottomNav } from "@/components/bottom-nav";
import { SteadyView } from "@/components/steady/steady-view";
import { getMode } from "@/lib/mode";
import { demoReading, isStale, latestReading, type SteadyReading } from "@/lib/steady";

export const metadata = { title: "Steady · Clarah Health" };

// Clarah Steady, the walking-steadiness wearable: live readings from the board, or the demo
// patient's synthetic ones.
export default async function SteadyPage() {
  await connection();
  const { mode, patient } = await getMode();
  let reading: SteadyReading | null = null;
  if (mode === "demo") reading = demoReading(patient.id);
  else reading = await latestReading().catch(() => null);
  const stale = mode === "live" ? isStale(reading) : !reading;

  return (
    <>
      <main className="flex grow flex-col gap-6 pb-8">
        <header className="bg-eucalyptus px-5 pt-10 pb-5 text-white lg:py-8">
          <div className="desk">
            <span className="clinical-label block text-[#dfe8d8]">Wearable</span>
            <h1 className="text-xl font-semibold lg:text-[30px]">Clarah Steady</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-[#dfe8d8]">How steadily you walk, day by day. Steady warns you as your balance slips, detects falls, and gets help if you don&apos;t respond.</p>
          </div>
        </header>
        <SteadyView initial={reading} initialStale={stale} demo={mode === "demo"} careTeamPhone={process.env.CARE_TEAM_PHONE} />
      </main>
      <BottomNav active="/steady" />
    </>
  );
}
