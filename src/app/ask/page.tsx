import { BottomNav } from "@/components/bottom-nav";
import { Chat } from "@/components/chat";
import { getMode } from "@/lib/mode";

export const metadata = { title: "Ask Clarah" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const [{ q }, { mode, patient }] = await Promise.all([searchParams, getMode()]);
  // The chat fills the screen below the demo/live bar (37px) and above the phone's tab bar, so the
  // message box sits just above the tabs.
  return (
    <div className="flex h-[calc(100dvh-37px)] flex-col">
      <Chat
        initialQuestion={typeof q === "string" ? q.slice(0, 500) : undefined}
        suggestions={mode === "demo" ? patient.suggestions : undefined}
      />
      <BottomNav active="/ask" />
    </div>
  );
}
