"use client";

import { useEffect, useRef, useState } from "react";
import { loadRate, saveRate, speechParts } from "@/lib/voice";

export const CLARA_SPEAKING_EVENT = "clara-speaking";

// Reads text aloud in Clarah's voice (the same Gemini voice as the Overview player), one short
// part at a time, fetching the next part while the current one plays. If the AI voice isn't
// available, the device's own voice takes over. Only one thing is read at a time.

export function useClaraVoice() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rate, setRateState] = useState(1);
  const [notice, setNotice] = useState("");

  const audio = useRef<HTMLAudioElement | null>(null);
  const run = useRef(0); // bumped by every new read or stop; stale playback checks it and bails
  const rateRef = useRef(1);
  const deviceOnly = useRef(false);
  const clips = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    const saved = loadRate();
    rateRef.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved speed once, after hydration
    setRateState(saved);
    const clipMap = clips.current;
    const runRef = run;
    return () => {
      runRef.current++;
      audio.current?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
      clipMap.forEach((p) => p.then(URL.revokeObjectURL, () => {}));
    };
  }, []);

  // Tell the rest of the page (the big Clarah in the sidebar) when she's talking.
  useEffect(() => {
    const talking = speakingId !== null && !loading;
    window.dispatchEvent(new CustomEvent(CLARA_SPEAKING_EVENT, { detail: talking }));
    return () => {
      if (talking) window.dispatchEvent(new CustomEvent(CLARA_SPEAKING_EVENT, { detail: false }));
    };
  }, [speakingId, loading]);

  function clip(key: string, text: string): Promise<string> {
    let p = clips.current.get(key);
    if (!p) {
      p = fetch("/api/visits/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("voice unavailable");
        return URL.createObjectURL(await res.blob());
      });
      p.catch(() => clips.current.delete(key));
      clips.current.set(key, p);
    }
    return p;
  }

  const playUrl = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const a = (audio.current ??= new Audio());
      a.src = url;
      a.playbackRate = rateRef.current;
      a.onended = () => resolve();
      a.onerror = () => reject(new Error("playback failed"));
      a.play().catch(reject);
    });

  const sayWithDevice = (text: string) =>
    new Promise<void>((resolve) => {
      if (typeof speechSynthesis === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rateRef.current;
      u.lang = "en-US";
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });

  function stop() {
    run.current++;
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setSpeakingId(null);
    setLoading(false);
  }

  async function speak(id: string, text: string) {
    stop();
    const current = run.current;
    const parts = speechParts(text);
    if (!parts.length) return;
    setSpeakingId(id);
    for (const [i, part] of parts.entries()) {
      if (current !== run.current) return;
      if (!deviceOnly.current) {
        try {
          setLoading(true);
          const url = await clip(`${id}:${i}`, part);
          if (current !== run.current) return;
          if (i + 1 < parts.length) clip(`${id}:${i + 1}`, parts[i + 1]).catch(() => {});
          setLoading(false);
          await playUrl(url);
          continue;
        } catch {
          if (current !== run.current) return;
          deviceOnly.current = true;
          setLoading(false);
          setNotice("Clarah's voice isn't available right now, so your device's voice is reading instead.");
        }
      }
      await sayWithDevice(part);
    }
    if (current === run.current) setSpeakingId(null);
  }

  function setRate(r: number) {
    rateRef.current = r;
    setRateState(r);
    saveRate(r);
    if (audio.current) audio.current.playbackRate = r;
  }

  return { speak, stop, speakingId, loading, rate, setRate, notice };
}
