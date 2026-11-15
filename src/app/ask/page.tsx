import { Chat } from "@/components/chat";
import { getMode } from "@/lib/mode";

export const metadata = { title: "Ask Clarah" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const [{ q }, { mode, patient }] = await Promise.all([searchParams, getMode()]);
  return (
    <Chat
      initialQuestion={typeof q === "string" ? q.slice(0, 500) : undefined}
      suggestions={mode === "demo" ? patient.suggestions : undefined}
    />
  );
}
