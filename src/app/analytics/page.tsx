"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WindowFrame } from "@/components/WindowFrame";
import { SectionCard } from "@/components/SectionCard";
import { RESULTS_STORAGE_KEY, summarizeResults } from "@/lib/analytics";
import type { ResultRow } from "@/lib/types";

export default function AnalyticsPage() {
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

  const summaryRows = useMemo(() => summarizeResults(results), [results]);

  return (
    <WindowFrame title="Analytics">
      <div className="mb-6 flex items-center justify-end">
        <Link
          href="/"
          className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Back to Uploads
        </Link>
      </div>
      <SectionCard title="Trade Outcome Summary">
        {summaryRows.length === 0 ? (
          <p className="text-sm text-white/70">
            No backtest results yet. Run a backtest on the main page to populate analytics.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase text-white/60">
                <tr>
                  <th className="px-4 py-3">Pair</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Trades SL Hit</th>
                  <th className="px-4 py-3">Trades TP Hit</th>
                  <th className="px-4 py-3">Trades SL before TP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {summaryRows.map((row) => (
                  <tr key={`${row.pair}-${row.direction}`} className="text-white/80">
                    <td className="px-4 py-3 font-semibold text-white">{row.pair}</td>
                    <td className="px-4 py-3">{row.direction}</td>
                    <td className="px-4 py-3">{row.slHitTrades}</td>
                    <td className="px-4 py-3">{row.tpHitTrades}</td>
                    <td className="px-4 py-3">{row.slBeforeTpTrades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </WindowFrame>
  );
}
