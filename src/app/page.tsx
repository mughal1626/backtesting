"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { SectionCard } from "@/components/SectionCard";
import { UploadScreenshot } from "@/components/UploadScreenshot";
import { AnalysisOptions } from "@/components/AnalysisOptions";
import { ExtractedSignalsTable } from "@/components/ExtractedSignalsTable";
import { ResultsTable } from "@/components/ResultsTable";
import { RESULTS_STORAGE_KEY } from "@/lib/analytics";
import { defaultOptions } from "@/lib/mock";
import { extractSignalFromImage } from "@/lib/ocr";
import type { AnalysisOptionsState, ExtractedSignal, ResultRow } from "@/lib/types";

export default function Page() {
  const [confirmedFiles, setConfirmedFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<AnalysisOptionsState>(defaultOptions);
  const [isExtracting, setIsExtracting] = useState(false);

  const [signals, setSignals] = useState<ExtractedSignal[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(RESULTS_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as ResultRow[];
      setResults(parsed);
    } catch (error) {
      console.warn("Failed to parse stored results", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(results));
  }, [results]);

  function onConfirm(files: File[]) {
    setConfirmedFiles(files);
    // TODO: call backend upload endpoint
  }

  function guessPair(fileName: string) {
    const normalized = fileName.toLowerCase();
    const match = normalized.match(/\b(btc|eth|sol|xrp|ada|bnb)\b/);
    if (match?.[0]) {
      return `${match[0].toUpperCase()}USDT`;
    }
    return "BTCUSDT";
  }

  function guessDirection(fileName: string): ExtractedSignal["direction"] {
    const normalized = fileName.toLowerCase();
    if (/(short|sell|bear)/.test(normalized)) return "Short";
    return "Long";
  }

  async function onExtract(files: File[]) {
    const filesToProcess = files.length ? files : confirmedFiles;
    if (!filesToProcess.length) return;
    setIsExtracting(true);

    try {
      const extracted = [] as ExtractedSignal[];

      for (const [index, file] of filesToProcess.entries()) {
        try {
          const results = await extractSignalFromImage(file, {
            fallbackPair: guessPair(file.name),
            fallbackDirection: guessDirection(file.name),
          });

          results.forEach((result, signalIndex) => {
            extracted.push({
              id: `${file.name}-${index}-${signalIndex}`,
              ...result,
            });
          });
        } catch (error) {
          console.warn("OCR failed, falling back to filename parsing", error);
          const base = new Date();
          const startTime = base.toTimeString().slice(0, 5);
          extracted.push({
            id: `${file.name}-${index}`,
            pair: guessPair(file.name),
            direction: guessDirection(file.name),
            startTime,
          });
        }
      }

      setSignals(extracted);
    } finally {
      setIsExtracting(false);
    }
  }

  function onAnalyze() {
    // TODO: call backend analysis endpoint using confirmedFiles + options
    console.log("Analyze", { confirmedFilesCount: confirmedFiles.length, options });
  }

  function onReset() {
    setOptions(defaultOptions);
  }

  function onRun(signalId: string) {
    const signal = signals.find((item) => item.id === signalId);
    if (!signal) return;

    fetch("/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal,
        options,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Backtest failed");
        }
        return response.json() as Promise<{ result: ResultRow }>;
      })
      .then(({ result }) => {
        setResults((prev) => [result, ...prev]);
      })
      .catch((error) => {
        console.error("Backtest run failed", error);
      });
  }

  function onStartTimeChange(signalId: string, startTime: string) {
    setSignals((prev) =>
      prev.map((signal) => (signal.id === signalId ? { ...signal, startTime } : signal)),
    );
  }

  return (
    <WindowFrame title="Crypto Backtesting">
      <div className="mb-6 flex items-center justify-end">
        <Link
          href="/analytics"
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Analytics
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Upload Screenshots">
          <UploadScreenshot onConfirm={onConfirm} onExtract={onExtract} isExtracting={isExtracting} />
          {confirmedFiles.length > 0 && (
            <p className="mt-3 text-xs text-gray-500">
              Confirmed: {confirmedFiles.length} file(s)
            </p>
          )}
        </SectionCard>

        <SectionCard title="Analysis Options">
          <AnalysisOptions value={options} onChange={setOptions} onAnalyze={onAnalyze} onReset={onReset} />
        </SectionCard>
      </div>

      <div className="mt-6 space-y-6">
        <SectionCard title="Extracted Signals">
          <ExtractedSignalsTable rows={signals} onRun={onRun} onStartTimeChange={onStartTimeChange} />
        </SectionCard>

        <SectionCard title="Backtest Results">
          <ResultsTable rows={results} />
        </SectionCard>
      </div>
    </WindowFrame>
  );
}
