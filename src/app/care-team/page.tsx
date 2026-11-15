import { BottomNav } from "@/components/bottom-nav";
import { VisitRecorder } from "@/components/visits/recorder";
import { getMode } from "@/lib/mode";

export const metadata = { title: "Care team · Clarah Health" };

// For doctors and nurses: record a visit (with the patient's consent) so Clarah can explain it
// to the patient. The recap then appears on Overview.
export default async function CareTeamPage() {
  const { mode, patient } = await getMode();
  return (
    <>
      <VisitRecorder sample={mode === "demo" ? patient.sampleVisit : undefined} />
      <BottomNav active="/care-team" />
    </>
  );
}
