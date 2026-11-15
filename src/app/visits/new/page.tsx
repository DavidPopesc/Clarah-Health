import { VisitRecorder } from "@/components/visits/recorder";
import { getMode } from "@/lib/mode";

export const metadata = { title: "Record a visit · Clarah Health" };

export default async function NewVisitPage() {
  const { mode, patient } = await getMode();
  return <VisitRecorder sample={mode === "demo" ? patient.sampleVisit : undefined} />;
}
