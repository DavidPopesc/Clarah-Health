"use client";

import { useEffect, useRef, useState } from "react";
import { getAudio, putAudio } from "@/lib/visit-store";
import { recapToText, type VisitRecap } from "@/lib/visit-verify";
import { CopyIcon, DownloadIcon, PauseIcon, PlayIcon, RestartIcon } from "../icons";
import { loadRate, saveRate } from "@/lib/voice";
import { SpeedDial } from "../speed-dial";
import { ClaraAvatar } from "./clara-avatar";

type State = "idle" | "loading" | "playing" | "paused" | "done";
type Voice = "ai" | "device";

// Bump when the server voice changes so cached audio isn't reused.
const VOICE_VERSION = "v1";

export const fmtVisitDate = (iso?: string) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

// The best-sounding English voice the device offers, for when Clara's AI voice isn't available.
function deviceVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|online/i.test(v.name) ? 4 : 0) + (/google|aria|jenny|samantha|ava/i.test(v.name) ? 2 : 0) + (v.lang === "en-US" ? 1 : 0);
  return voices.sort((a, b) => score(b) - score(a))[0];
}

// Clara reads the recap aloud, one paragraph at a time. It's a one-way explanation: the patient
// can pause, replay, change the speed, or read along, but there's no conversation.
export function VisitPlayer({ id, recap }: { id: string; recap: VisitRecap }) {
  const script = recap.script;
  const [state, setState] = useState<State>("idle");
  const [index, setIndex] = useState(0);
  const [fraction, setFraction] = useState(0);
  const [rate, setRate] = useState(1);
  const [voice, setVoice] = useState<Voice>("ai");
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");

  const audio = useRef<HTMLAudioElement | null>(null);
  const clips = useRef(new Map<number, Promise<string>>());
  const run = useRef(0); // each play/stop starts a new run; stale callbacks check it and bail
  const rateRef = useRef(1);
  const voiceRef = useRef<Voice>("ai");

  useEffect(() => {
    // The patient's saved speed, shared with Ask Clara.
    const saved = loadRate();
    rateRef.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved speed once, after hydration
    setRate(saved);
    const clipMap = clips.current;
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- a counter, not a DOM ref: bumping it cancels playback in flight
      run.current++;
      audio.current?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      clipMap.forEach((p) => p.then(URL.revokeObjectURL, () => {}));
    };
  }, []);

  // Paragraph audio: from this device's cache, else Clara's voice from the server (then cached).
  function clip(i: number): Promise<string> {
    let p = clips.current.get(i);
    if (!p) {
      p = (async () => {
        const key = `${id}:${i}:${VOICE_VERSION}`;
        let blob = await getAudio(key);
        if (!blob) {
          const res = await fetch("/api/visits/speech", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: script[i] }),
          });
          if (!res.ok) throw new Error("voice unavailable");
          blob = await res.blob();
          void putAudio(key, blob);
        }
        return URL.createObjectURL(blob);
      })();
      p.catch(() => clips.current.delete(i));
      clips.current.set(i, p);
    }
    return p;
  }

  function speakWithDevice(i: number, current: number) {
    if (typeof speechSynthesis === "undefined") {
      setNotice("This browser can't read aloud. The transcript is shown below.");
      setShowText(true);
      setState("idle");
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(script[i]);
    u.rate = rateRef.current;
    u.lang = "en-US";
    const v = deviceVoice();
    if (v) u.voice = v;
    u.onend = () => current === run.current && void playFrom(i + 1);
    speechSynthesis.speak(u);
    setState("playing");
  }

  async function playFrom(i: number) {
    const current = ++run.current;
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setFraction(0);
    if (i >= script.length) {
      setState("done");
      setIndex(script.length - 1);
      return;
    }
    setIndex(i);
    if (voiceRef.current === "device") return speakWithDevice(i, current);

    setState("loading");
    let url: string;
    try {
      url = await clip(i);
    } catch {
      if (current !== run.current) return;
      voiceRef.current = "device";
      setVoice("device");
      setNotice("Clara's voice isn't available right now, so your device's voice is reading instead.");
      return speakWithDevice(i, current);
    }
    if (current !== run.current) return;
    if (i + 1 < script.length) clip(i + 1).catch(() => {}); // get the next part ready while this one plays

    const a = (audio.current ??= new Audio());
    a.src = url;
    a.playbackRate = rateRef.current;
    a.ontimeupdate = () => a.duration && setFraction(a.currentTime / a.duration);
    a.onended = () => current === run.current && void playFrom(i + 1);
    try {
      await a.play();
      if (current === run.current) setState("playing");
    } catch {
      if (current === run.current) setState("paused"); // autoplay blocked: wait for a tap
    }
  }

  function toggle() {
    if (state === "playing") {
      if (voiceRef.current === "ai") audio.current?.pause();
      else speechSynthesis.pause();
      setState("paused");
    } else if (state === "paused") {
      if (voiceRef.current === "ai") void audio.current?.play();
      else speechSynthesis.resume();
      setState("playing");
    } else if (state !== "loading") {
      void playFrom(state === "done" ? 0 : index);
    }
  }

  function changeRate(r: number) {
    rateRef.current = r;
    setRate(r);
    saveRate(r); // shared with Ask Clara
    if (audio.current) audio.current.playbackRate = r;
  }

  const dateLabel = fmtVisitDate(recap.date);
  const text = () => recapToText(recap, dateLabel);

  async function copy() {
    await navigator.clipboard.writeText(text());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text()], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${recap.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "visit"}-transcript.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const active = state === "playing" || state === "paused" || state === "loading";
  const status =
    state === "loading"
      ? "Getting Clara's voice ready…"
      : state === "playing"
        ? `Clara is speaking · part ${index + 1} of ${script.length}`
        : state === "paused"
          ? `Paused · part ${index + 1} of ${script.length}`
          : state === "done"
            ? "Finished. Tap to listen again."
            : `Tap to listen · about ${Math.max(1, Math.round(script.join(" ").split(/\s+/).length / 150))} min`;

  return (
    <div className="flex flex-col gap-3">
      <div className="border-l-4 border-teal bg-white p-4">
        <div className="mb-3 flex items-center gap-3 border-b border-panel pb-3">
          <ClaraAvatar speaking={state === "playing"} />
          <div className="flex flex-col">
            <span className="clinical-label text-teal">Clara explains your visit</span>
            <span className="text-[15px] font-semibold text-ink">Clara, your AI health nurse</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggle}
            aria-label={state === "playing" ? "Pause" : state === "paused" ? "Resume" : "Listen to Clara"}
            className="press flex size-16 shrink-0 items-center justify-center rounded-full text-white"
          >
            {state === "loading" ? (
              <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            ) : state === "playing" ? (
              <PauseIcon width={26} height={26} />
            ) : (
              <PlayIcon width={26} height={26} className="ml-1" />
            )}
          </button>
          <div className="flex min-w-0 grow flex-col gap-1">
            <span className="text-[13px] text-body" role="status" aria-live="polite">{status}</span>
            <div className="flex gap-1" aria-hidden="true">
              {script.map((_, i) => (
                <span key={i} className="h-2 grow overflow-hidden rounded-full bg-[#d8dfcc]">
                  <span
                    className="block h-full bg-linear-to-r from-[#3864c8] to-[#2a4fa8] transition-[width] duration-300"
                    style={{ width: state === "done" || i < index ? "100%" : i === index && active ? `${Math.round(fraction * 100)}%` : "0%" }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-panel pt-3">
          <SpeedDial rate={rate} onChange={changeRate} />
          {(active || state === "done") && (
            <button type="button" onClick={() => void playFrom(0)} className="flex min-h-9 items-center gap-1.5 text-[13px] font-semibold text-teal">
              <RestartIcon width={15} height={15} /> Start over
            </button>
          )}
        </div>
        {notice && <p className="mt-2 text-[12px] text-amber-ink">{notice}</p>}
        {voice === "device" && !notice && <p className="mt-2 text-[12px] text-subtle">Using your device&apos;s voice.</p>}
      </div>

      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => setShowText(!showText)}
          aria-expanded={showText}
          aria-controls={`visit-transcript-${id}`}
          className="tile-3d flex min-h-11 items-center justify-center rounded-md text-[14px] font-semibold text-teal"
        >
          {showText ? "Hide transcript" : "Show transcript"}
        </button>
        {showText && (
          <div id={`visit-transcript-${id}`} className="slab mt-2 flex flex-col gap-3 rounded-md p-4">
            <div className="flex items-center justify-between">
              <span className="clinical-label text-muted">What Clara says</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={copy} className="flex min-h-9 items-center gap-1 text-[12px] font-semibold text-teal">
                  <CopyIcon width={14} height={14} /> {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={download} className="flex min-h-9 items-center gap-1 text-[12px] font-semibold text-teal">
                  <DownloadIcon width={14} height={14} /> Download
                </button>
              </div>
            </div>
            {script.map((p, i) => {
              const current = active && i === index;
              return (
                <p key={i} className={`-mx-2 rounded px-2 py-1 text-[15px] leading-relaxed ${current ? "bg-teal-soft text-ink" : "text-body"}`}>
                  <button type="button" onClick={() => void playFrom(i)} className="text-left" title="Listen from here" aria-current={current || undefined}>
                    {p}
                  </button>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
