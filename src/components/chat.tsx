"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { RedFlag } from "@/lib/red-flags";
import type { Source } from "@/lib/types";
import { BackIcon, SendIcon } from "./icons";
import { UrgentScreen } from "./urgent-screen";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  usedData?: string[];
  error?: boolean;
}

const SUGGESTIONS = [
  "Ramadan starts in February. Is it okay for me to fast with my diabetes meds?",
  "Can I take turmeric or herbal tea with my medicines?",
  "What does my blood pressure number mean?",
  "Is grapefruit okay with my cholesterol medicine?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flag, setFlag] = useState<RedFlag | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json();
      if (data.kind === "red_flag") {
        setFlag(data.flag);
        setMessages([
          ...next,
          { role: "assistant", content: "I showed you an urgent safety screen for this message. If you're safe now, you can keep asking questions." },
        ]);
      } else if (data.kind === "answer") {
        setMessages([
          ...next,
          { role: "assistant", content: data.text, sources: data.sources, usedData: data.usedData },
        ]);
      } else {
        setMessages([...next, { role: "assistant", content: data.error ?? "Something went wrong.", error: true }]);
      }
    } catch {
      setMessages([...next, { role: "assistant", content: "Couldn't reach Clara. Check your connection and try again.", error: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center gap-2 border-b border-line bg-white px-4 pt-12 pb-3">
        <Link href="/today" aria-label="Back to Today" className="flex size-11 items-center justify-center">
          <BackIcon width={22} height={22} />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-[17px] font-semibold">Ask Clara</h1>
          <span className="text-xs text-subtle">Using your meds, labs and wearable data</span>
        </div>
      </header>

      <div className="flex grow flex-col gap-3.5 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-[15px] leading-normal text-muted">
              Ask about your numbers, your diagnosis, or whether something is safe for you, like a fast, an herb, or a food.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="min-h-11 rounded-2xl border border-[#C9D2CE] bg-white px-4 py-2.5 text-left text-sm text-ink hover:border-teal"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div
              key={i}
              className="max-w-[80%] self-end rounded-[18px_18px_4px_18px] bg-teal px-3.5 py-3 text-[15px] leading-snug text-white"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className={`flex flex-col gap-3 rounded-[18px_18px_18px_4px] border p-4 ${
                m.error ? "border-amber/30 bg-amber-soft text-amber-ink" : "border-line bg-white"
              }`}
            >
              {m.usedData && m.usedData.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Data used">
                  {m.usedData.map((d) => (
                    <span key={d} className="rounded-full bg-teal-soft px-2.5 py-1 text-[11px] font-semibold text-teal-dark">
                      {d}
                    </span>
                  ))}
                </div>
              )}
              <div className="answer text-[15px] leading-normal text-body">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-panel pt-2.5">
                  <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Sources</span>
                  {m.sources.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-teal underline-offset-2 hover:underline"
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ),
        )}

        {loading && (
          <div className="flex items-center gap-2 self-start rounded-[18px] border border-line bg-white px-4 py-3 text-sm text-subtle">
            <span className="size-2 animate-pulse rounded-full bg-teal" />
            Checking your record…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-line bg-white px-4 pt-3 pb-7"
      >
        <label htmlFor="ask-input" className="sr-only">
          Ask a health question
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your health…"
          autoComplete="off"
          className="min-h-[46px] grow rounded-full border border-[#C9D2CE] bg-ground px-4 text-[15px] text-ink outline-teal"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={loading || !input.trim()}
          className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-teal text-white disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </form>

      {flag && <UrgentScreen flag={flag} onBack={() => setFlag(null)} />}
    </div>
  );
}
