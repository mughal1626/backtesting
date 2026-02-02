"use client";

import React from "react";
import type { ResultRow } from "@/lib/types";

export function ResultsTable({ rows }: { rows: ResultRow[] }) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.trades += 1;
      acc.mfe += row.mfePct ?? 0;
      acc.mae += row.maePct ?? 0;
      if (row.slTpHit === "TP") acc.wins += 1;
      return acc;
    },
    { trades: 0, wins: 0, mfe: 0, mae: 0 },
  );

  const winRate = totals.trades ? (totals.wins / totals.trades) * 100 : 0;
  const avgMfe = totals.trades ? totals.mfe / totals.trades : 0;
  const avgMae = totals.trades ? totals.mae / totals.trades : 0;

  const slBeforeTpLabel = (value: ResultRow["slBeforeTp"]) => {
    if (value === true) return "yes";
    if (value === false) return "no";
    return "N/A";
  };

  const formatNumber = (value: number | null, digits = 2) =>
    value === null ? "—" : value.toFixed(digits);

  const qualityLabel = (error: ResultRow["quality"]["error"], partial: boolean) => {
    if (error === "symbol_not_on_usdm_futures") {
      return "Not listed on Binance USDT-M futures";
    }
    if (error === "start_before_listing_history") {
      return "No history at selected date (listed later)";
    }
    if (error === "entry_kline_not_found_timestamp_alignment") {
      return "Time alignment issue (check timezone/rounding)";
    }
    if (error === "symbol_kline_unavailable") {
      return "No kline data available right now";
    }
    if (error) return error;
    return partial ? "partial" : "ok";
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
        <table className="min-w-full border-collapse text-left text-sm text-gray-300">
          <thead className="sticky top-0 bg-gray-900/70 text-xs uppercase tracking-wide text-gray-400 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3">Pair</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3 text-right">Entry Price</th>
              <th className="px-4 py-3 text-right">SL ROE%</th>
              <th className="px-4 py-3 text-right">TP ROE%</th>
              <th className="px-4 py-3 text-right">SL Price</th>
              <th className="px-4 py-3 text-right">TP Price</th>
              <th className="px-4 py-3 text-right">MFE%</th>
              <th className="px-4 py-3 text-right">MAE%</th>
              <th className="px-4 py-3">SL/TP Hit</th>
              <th className="px-4 py-3">SL b4 TP</th>
              <th className="px-4 py-3">Quality</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-white/10 transition hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white/90">{r.pair}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.direction === "LONG"
                        ? "rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-400"
                        : "rounded-full bg-rose-500/20 px-3 py-1 text-rose-400"
                    }
                  >
                    {r.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.entryPrice === null ? "—" : r.entryPrice.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{r.slRoePct}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.tpRoePct}%</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.slPrice === null ? "—" : r.slPrice.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.tpPrice === null ? "—" : r.tpPrice.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.mfePct, 1)}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(r.maePct, 1)}%</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs",
                      r.slTpHit === "TP"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : r.slTpHit === "SL"
                          ? "bg-rose-500/20 text-rose-400"
                          : "bg-gray-700/30 text-gray-400",
                    ].join(" ")}
                  >
                    {r.slTpHit}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{slBeforeTpLabel(r.slBeforeTp)}</td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {qualityLabel(r.quality.error, r.quality.partial)}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                  No results yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-4 border-t border-white/10 pt-3 text-sm text-gray-400">
        <span>Total Trades: {totals.trades}</span>
        <span>Win Rate: {winRate.toFixed(1)}%</span>
        <span>Avg MFE: {avgMfe.toFixed(2)}%</span>
        <span>Avg MAE: {avgMae.toFixed(2)}%</span>
      </div>
    </div>
  );
}
