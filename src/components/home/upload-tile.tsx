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
        aria-label="Upload a PDF lab report or visit summary"
        className="press flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-white"
      >
        <span className="flex items-center gap-1.5">
          <UploadIcon width={15} height={15} />
          <span className="text-xs font-semibold">PDF</span>
        </span>
        <span className="text-[11px] text-white/85">Upload</span>
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" onChange={onFile} className="sr-only" tabIndex={-1} aria-label="Upload a PDF" />
    </>
  );
}
