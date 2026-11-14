"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { BodyFocus } from "@/lib/body";
import { SYSTEM_LABELS } from "@/lib/body";
import type { RedFlag } from "@/lib/red-flags";
import type { Source } from "@/lib/types";
import { BodyViewer } from "./anatomy/body-viewer";
import { BackIcon, CubeIcon, SendIcon } from "./icons";
import { UrgentScreen } from "./urgent-screen";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  usedData?: string[];
  focus?: BodyFocus;
  error?: boolean;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "Ramadan starts in February. Is it okay for me to fast with my diabetes meds?",
  "Can I take turmeric or herbal tea with my medicines?",
  "What does my blood pressure number mean?",
  "Is grapefruit okay with my cholesterol medicine?",
  "I sprained my left ankle. Can I take ibuprofen for the pain?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Checking your record…");
  const [flag, setFlag] = useState<RedFlag | null>(null);
  const [viewer, setViewer] = useState<BodyFocus | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, status]);

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
      if (!res.headers.get("Content-Type")?.includes("ndjson")) {
        const data = await res.json();
        if (data.kind === "red_flag") {
          setFlag(data.flag);
          setMessages([
            ...next,
            { role: "assistant", content: "I showed you an urgent safety screen for this message. If you're safe now, you can keep asking questions." },
          ]);
        } else {
          setMessages([...next, { role: "assistant", content: data.error ?? "Something went wrong.", error: true }]);
        }
        return;
      }

      // Streamed answer: status lines, then text as it's written, then sources and focus.
      const at = next.length;
      const update = (patch: Partial<Message>) =>
        setMessages((prev) => {
          const copy = [...prev];
          const base: Message = copy[at] ?? { role: "assistant", content: "", streaming: true };
          copy[at] = { ...base, ...patch };
          return copy;
        });
      let content = "";
      let focus: BodyFocus | undefined;
      let failed = false;

      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "status") setStatus(event.text);
          else if (event.type === "delta") update({ content: (content += event.text) });
          else if (event.type === "reset") {
            content = "";
            setMessages((prev) => prev.slice(0, at));
          } else if (event.type === "done") {
            focus = event.focus;
            update({ content, streaming: false, sources: event.sources, usedData: event.usedData, focus });
          } else if (event.type === "error") {
            failed = true;
            update({ content: event.error, error: true, streaming: false });
          }
        }
      }
      if (!failed && !content) update({ content: "Something went wrong. Please try again.", error: true, streaming: false });
      // Pop the 3D body up when the answer is about a specific body part.
      if (!failed && focus) setViewer(focus);
    } catch {
      setMessages([...next, { role: "assistant", content: "Couldn't reach Clara. Check your connection and try again.", error: true }]);
    } finally {
      setLoading(false);
      setStatus("Checking your record…");
    }
  }

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-10 flex items-center gap-2 border-b border-line/70 bg-white/80 px-4 pt-12 pb-3 shadow-[0_8px_20px_-14px_rgba(10,79,73,0.35)] backdrop-blur-md">
        <Link href="/today" aria-label="Back to Today" className="tile-3d flex size-11 items-center justify-center rounded-full">
          <BackIcon width={22} height={22} />
        </Link>
        <div className="flex flex-col">
          <h1 className="font-display text-[17px] font-semibold">Ask Clara</h1>
          <span className="text-xs text-subtle">Using your meds, labs and wearable data</span>
        </div>
      </header>

      <div className="flex grow flex-col gap-3.5 overflow-y-auto p-4" aria-live="polite" aria-busy={loading}>
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
                  className="slab lift rise min-h-11 rounded-2xl px-4 py-2.5 text-left text-sm text-ink"
                  style={{ "--i": SUGGESTIONS.indexOf(s) } as React.CSSProperties}
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
              className="press rise max-w-[80%] self-end rounded-[18px_18px_4px_18px] px-3.5 py-3 text-[15px] leading-snug text-white"
            >
              {m.content}
            </div>
          ) : (
            <div
              key={i}
              className={`rise flex flex-col gap-3 rounded-[18px_18px_18px_4px] p-4 ${
                m.error ? "border border-amber/30 bg-amber-soft text-amber-ink" : "slab"
              }`}
            >
              {m.usedData && m.usedData.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Data used">
                  {m.usedData.map((d) => (
                    <span key={d} className="tile-teal rounded-full px-2.5 py-1 text-[11px] font-semibold text-teal-dark">
                      {d}
                    </span>
                  ))}
                </div>
              )}
              <div className={`answer text-[15px] leading-normal text-body ${m.streaming ? "is-streaming" : ""}`}>
                <ReactMarkdown>{m.content}</ReactMarkdown>
                {m.streaming && <span className="stream-caret" aria-hidden="true" />}
              </div>
              {m.focus && (
                <button
                  type="button"
                  onClick={() => setViewer(m.focus!)}
                  className="tile-teal flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-left"
                >
                  <CubeIcon width={18} height={18} className="shrink-0 text-teal" />
                  <span className="flex grow flex-col">
                    <span className="text-[13px] font-semibold text-teal-dark">See it in 3D: {m.focus.label}</span>
                    <span className="text-[11px] text-muted">{SYSTEM_LABELS[m.focus.system]} view</span>
                  </span>
                </button>
              )}
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

        {loading && !messages[messages.length - 1]?.streaming && (
          <div className="slab flex items-center gap-2 self-start rounded-[18px] px-4 py-3 text-sm text-subtle">
            <span className="size-2 animate-pulse rounded-full bg-teal" />
            {status}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="relative z-10 flex items-center gap-2 border-t border-line/70 bg-white/85 px-4 pt-3 pb-7 shadow-[0_-8px_20px_-14px_rgba(10,79,73,0.35)] backdrop-blur-md"
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
          className="well min-h-[46px] grow rounded-full px-4 text-[15px] text-ink outline-teal"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={loading || !input.trim()}
          className="press flex size-[46px] shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </form>

      {viewer && !flag && <BodyViewer focus={viewer} onClose={() => setViewer(null)} />}
      {flag && <UrgentScreen flag={flag} onBack={() => setFlag(null)} />}
    </div>
  );
}
