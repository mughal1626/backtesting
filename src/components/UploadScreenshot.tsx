"use client";

import React, { useMemo, useRef, useState } from "react";

export function UploadScreenshot({
  onConfirm,
  onExtract,
  isExtracting = false,
}: {
  onConfirm: (files: File[]) => void;
  onExtract: (files: File[]) => void;
  isExtracting?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const hint = useMemo(() => {
    if (!files.length) return "Drag & Drop Screenshots Here";
    if (files.length === 1) return `1 file selected: ${files[0].name}`;
    return `${files.length} files selected`;
  }, [files]);

  function handleFiles(next: FileList | null) {
    if (!next) return;
    const arr = Array.from(next).filter((f) => f.type.startsWith("image/"));
    setFiles(arr);
    if (arr.length) {
      onConfirm(arr);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={[
          "rounded-2xl border-2 border-dashed border-gray-600/40 p-8 text-center text-gray-400",
          "transition hover:border-cyan-400/50 hover:ring-2 hover:ring-cyan-500/30",
          isDragging ? "ring-2 ring-cyan-500/40" : "",
        ].join(" ")}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-gray-400">{hint}</p>
        <p className="mt-2 text-xs text-gray-500">or</p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/20 bg-white/5 px-5 py-2 text-sm text-gray-200 transition duration-200 ease-out hover:bg-white/10"
            onClick={() => inputRef.current?.click()}
          >
            Upload Files
          </button>

          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-5 py-2 text-sm font-semibold text-white transition duration-200 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onExtract(files)}
            disabled={!files.length || isExtracting}
          >
            {isExtracting ? "Extracting..." : "Extract"}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
}
