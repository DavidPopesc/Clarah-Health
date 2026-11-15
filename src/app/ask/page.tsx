import { Chat } from "@/components/chat";

export const metadata = { title: "Ask Clarah Health" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const { q } = await searchParams;
  return <Chat initialQuestion={typeof q === "string" ? q.slice(0, 500) : undefined} />;
}
