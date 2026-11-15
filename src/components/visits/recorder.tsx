"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SAMPLE_VISIT } from "@/lib/sample-visit";
import { saveVisit } from "@/lib/visit-store";
import { recordingToWavChunks } from "@/lib/wav";
import { BackIcon, MicIcon, StopIcon } from "../icons";

const MAX_SECONDS = 30 * 60;

type Phase = "idle" | "recording" | "transcribing" | "explaining";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The care team's side: record the conversation (with the patient's consent), check the
// transcript, then have Clarah turn it into a spoken explanation for the patient.
export function VisitRecorder() {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [progress, setProgress] = useState("");
  const [transcript, setTranscript] = useState("");
  const [date, setDate] = useState(todayIso);
  const [error, setError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const parts = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const release = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => release, []);

  async function transcribe(recording: Blob) {
    setPhase("transcribing");
    setProgress("Preparing the recording…");
    try {
      const chunks = await recordingToWavChunks(recording);
      if (!chunks.length) throw new Error("The recording was empty. Check the microphone and try again.");
      const texts: string[] = [];
      for (const [i, chunk] of chunks.entries()) {
        setProgress(chunks.length > 1 ? `Transcribing part ${i + 1} of ${chunks.length}…` : "Transcribing the conversation…");
        const res = await fetch("/api/visits/transcribe", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: chunk });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Clarah couldn't transcribe this recording.");
        if (data.text) texts.push(data.text);
      }
      if (!texts.length) throw new Error("Clarah didn't hear any speech in the recording. Check the microphone and try again.");
      setTranscript((prev) => [prev.trim(), texts.join("\n")].filter(Boolean).join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clarah couldn't transcribe this recording.");
    } finally {
      setPhase("idle");
      setProgress("");
    }
  }

  function stop() {
    recorder.current?.stop();
    release();
  }

  async function start() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Type or paste the conversation below instead.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("Clarah couldn't use the microphone. Allow microphone access in your browser, or type the conversation below.");
      return;
    }
    parts.current = [];
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => e.data.size && parts.current.push(e.data);
    rec.onstop = () => void transcribe(new Blob(parts.current, { type: rec.mimeType }));
    rec.start(1000);
    recorder.current = rec;
    setElapsed(0);
    setPhase("recording");
    const began = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setElapsed(s);
      if (s >= MAX_SECONDS) stop();
    }, 500);
  }

  async function explain() {
    setError("");
    setPhase("explaining");
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Clarah couldn't explain this visit.");
      await saveVisit(data.recap, data.transcript);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clarah couldn't explain this visit.");
      setPhase("idle");
    }
  }

  const busy = phase === "transcribing" || phase === "explaining";
  const ready = transcript.trim().length >= 40;

  return (
    <main className="flex grow flex-col gap-6 pb-8 lg:gap-8">
      <header className="bg-eucalyptus px-4 pt-10 pb-4 text-white lg:py-7">
        <div className="desk flex items-center gap-3">
          <Link href="/" aria-label="Back to Overview" className="flex size-11 items-center justify-center border border-white/30 bg-white/10">
            <BackIcon width={22} height={22} />
          </Link>
          <div className="flex flex-col">
            <span className="clinical-label text-[#dfe8d8]">For the care team</span>
            <h1 className="text-[18px] font-semibold lg:text-[26px]">Record a visit</h1>
          </div>
        </div>
      </header>

      {/* Desktop: consent and recording on the left, the transcript and explanation on the right. */}
      <div className="desk flex flex-col gap-6 px-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
        <div className="flex flex-col gap-6">
        <p className="text-[14px] leading-normal text-muted lg:text-[15px]">
          Record your conversation with the patient. Clarah transcribes it, pairs it with their record, and reads them a plain-English explanation they can replay at home.
        </p>

        <section className="flex flex-col gap-2" aria-labelledby="consent-heading">
          <h2 id="consent-heading" className="clinical-label border-b border-line pb-2 text-muted">1 · Consent</h2>
          <label className="slab flex cursor-pointer items-start gap-3 rounded-md p-3.5 text-[14px] leading-snug text-body">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={phase === "recording"}
              className="mt-0.5 size-5 shrink-0 accent-teal"
            />
            <span>The patient agreed to have this conversation recorded and explained by Clarah.</span>
          </label>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="record-heading">
          <h2 id="record-heading" className="clinical-label border-b border-line pb-2 text-muted">2 · Record</h2>
          {phase === "recording" ? (
            <button type="button" onClick={stop} className="press press-alert flex min-h-16 items-center justify-center gap-3 rounded-md text-[16px] font-semibold text-white">
              <StopIcon width={20} height={20} />
              Stop recording
              <span className="flex items-center gap-1.5 font-mono text-[14px]" aria-live="off">
                <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
                {clock(elapsed)}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={!consent || busy}
              className="press flex min-h-16 items-center justify-center gap-3 rounded-md text-[16px] font-semibold text-white"
            >
              <MicIcon width={22} height={22} />
              {transcript ? "Record more" : "Start recording"}
            </button>
          )}
          <p className="text-[12px] text-subtle" role="status">
            {phase === "transcribing" ? (
              <span className="flex items-center gap-2 text-body">
                <span className="size-2 animate-pulse rounded-full bg-teal" />
                {progress}
              </span>
            ) : phase === "recording" ? (
              `Recording. Speak normally; stops automatically at ${clock(MAX_SECONDS)}.`
            ) : consent ? (
              `Up to ${MAX_SECONDS / 60} minutes. You can review the transcript before Clarah explains it.`
            ) : (
              "Confirm consent to start recording."
            )}
          </p>
        </section>
        </div>

        <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2" aria-labelledby="transcript-heading">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h2 id="transcript-heading" className="clinical-label text-muted">3 · Check the transcript</h2>
            {!transcript && (
              <button type="button" onClick={() => setTranscript(SAMPLE_VISIT)} disabled={busy || phase === "recording"} className="text-[12px] font-semibold text-teal underline">
                Use a sample visit
              </button>
            )}
          </div>
          <label htmlFor="visit-transcript" className="sr-only">Visit transcript</label>
          <textarea
            id="visit-transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            disabled={busy || phase === "recording"}
            rows={10}
            placeholder={"The transcript appears here after recording. You can also type or paste the conversation, for example:\nClinician: Your A1c is 7.1…\nPatient: …"}
            className="well min-h-48 w-full rounded-md p-3 font-mono text-[12px] leading-relaxed text-ink outline-teal lg:min-h-96"
          />
          <label className="flex items-center justify-between gap-3 text-[13px] text-body">
            <span className="font-semibold">Visit date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} className="well rounded-md px-3 py-2 text-[13px] text-ink outline-teal" />
          </label>
        </section>

        {error && (
          <p role="alert" className="border-l-4 border-amber bg-amber-soft px-3 py-2.5 text-[13px] text-amber-ink">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={explain}
          disabled={!ready || busy || phase === "recording"}
          className="press flex min-h-14 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-semibold text-white"
        >
          {phase === "explaining" ? (
            <>
              <span className="size-2 animate-pulse rounded-full bg-white" />
              Clarah is pairing this with the patient&apos;s record…
            </>
          ) : (
            "Create Clarah's explanation"
          )}
        </button>

        <p className="text-[11px] leading-snug text-subtle">
          The audio is sent to the AI only to be transcribed and isn&apos;t saved. The patient&apos;s name and ID numbers are removed from the transcript before Clarah explains it. The explanation is saved only on this device.{" "}
          <Link href="/privacy" className="font-semibold text-teal">Privacy policy</Link>
        </p>
        </div>
      </div>
    </main>
  );
}
