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
        className="press flex min-h-[92px] flex-col items-start justify-between gap-2 rounded-2xl p-3 text-left text-white"
      >
        <UploadIcon width={22} height={22} />
        <span className="flex flex-col">
          <span className="text-[13px] leading-tight font-semibold">Upload PDF</span>
          <span className="text-[11px] leading-tight text-white/80">Labs, visit notes</span>
        </span>
      </button>
      <input ref={input} type="file" accept="application/pdf,.pdf" onChange={onFile} className="sr-only" tabIndex={-1} aria-label="Upload a PDF" />
    </>
  );
}
