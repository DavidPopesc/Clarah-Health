import { BottomNav } from "@/components/bottom-nav";
import { VisitsView } from "@/components/visits/visits-view";

export const metadata = { title: "Visit recaps · Clara" };

export default function VisitsPage() {
  return (
    <>
      <main className="flex grow flex-col gap-6 pb-8">
        <header className="bg-eucalyptus px-5 pt-10 pb-5 text-white">
          <span className="clinical-label block text-[#dfe8d8]">From your care team</span>
          <h1 className="text-xl font-semibold">Visit recaps</h1>
        </header>
        <VisitsView />
      </main>
      <BottomNav active="/visits" />
    </>
  );
}
