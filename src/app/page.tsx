import { BottomNav } from "@/components/bottom-nav";
import { VisitsView } from "@/components/visits/visits-view";

export const metadata = { title: "Overview · Clarah Health" };

// The home page: Overview, the patient's visit recaps.
export default function OverviewPage() {
  return (
    <>
      <main className="flex grow flex-col gap-6 pb-8 lg:gap-8">
        <header className="bg-eucalyptus px-5 pt-10 pb-5 text-white lg:py-8">
          <div className="desk">
            <span className="clinical-label block text-[#dfe8d8]">From your care team</span>
            <h1 className="text-xl font-semibold lg:text-[30px]">Overview</h1>
          </div>
        </header>
        <VisitsView />
      </main>
      <BottomNav active="/" />
    </>
  );
}
