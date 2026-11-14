"use client";

import { useRef } from "react";
import { addPdf } from "@/lib/doc-store";
import { UploadIcon } from "../icons";

export function UploadTile() {
  const input = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void addPdf(file, file.name);
    document.getElementById("documents")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="press flex min-h-16 items-center gap-3 rounded-md px-3.5 py-3 text-left text-white"
      >
        <span className="flex size-10 shrink-0 items-center justify-center border border-white/30 bg-white/10">
          <UploadIcon width={20} height={20} />
        </span>
        <span className="flex grow flex-col">
          <span className="text-sm font-semibold">Upload a PDF</span>
          <span className="text-xs text-white/75">Lab report or visit summary</span>
        </span>
        <span className="clinical-label text-white/85">Choose file</span>
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" onChange={onFile} className="sr-only" tabIndex={-1} aria-label="Upload a PDF" />
    </>
  );
}
