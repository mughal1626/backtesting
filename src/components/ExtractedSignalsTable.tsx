"use client";

import React from "react";
import type { ExtractedSignal } from "@/lib/types";

export function ExtractedSignalsTable({
  rows,
  onRun,
  onStartTimeChange,
}: {
  rows: ExtractedSignal[];
  onRun: (id: string) => void;
  onStartTimeChange: (id: string, startTime: string) => void;
}) {
  const normalizeForInput = (value: string) => value.slice(0, 5);
  const normalizeForDisplay = (value: string) => value.slice(0, 5);

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
      <table className="min-w-full border-collapse text-left text-sm text-gray-300">
        <thead className="text-xs uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-4 py-3">Pair</th>
            <th className="px-4 py-3">Direction</th>
            <th className="px-4 py-3">Start Time</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((r, idx) => {
            const targetKey =
              "target" in r ? String((r as { target?: string }).target ?? "") : "";
            const rowKey = `${r.pair}-${r.direction}-${r.startTime}-${targetKey}-${idx}`;

            return (
              <tr key={rowKey} className="border-t border-white/10 transition hover:bg-white/5">
                <td className="px-4 py-3 font-medium text-white/90">{r.pair}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      r.direction === "Long"
                        ? "rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-400"
                        : "rounded-full bg-rose-500/20 px-3 py-1 text-rose-400"
                    }
                  >
                    {r.direction}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="time"
                    value={normalizeForInput(r.startTime)}
                    onChange={(event) => onStartTimeChange(r.id, normalizeForDisplay(event.target.value))}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white/90 focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    className="rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-1.5 text-xs font-semibold text-white transition duration-200 ease-out hover:opacity-90"
                    onClick={() => onRun(r.id)}
                  >
                    Run
                  </button>
                </td>
              </tr>
            );
          })}

          {!rows.length && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                No extracted signals yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
