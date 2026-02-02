"use client";

import React from "react";
import type { AnalysisOptionsState } from "@/lib/types";

const leverageOptions = ["1x", "2x", "3x", "5x", "10x", "20x", "50x"];
const timeframeOptions = ["5m", "15m", "1h", "4h", "1d"];
const lookaheadOptions = ["1", "2", "4", "6", "12", "24", "48", "72"];

export function AnalysisOptions({
  value,
  onChange,
  onAnalyze,
  onReset,
}: {
  value: AnalysisOptionsState;
  onChange: (next: AnalysisOptionsState) => void;
  onAnalyze: () => void;
  onReset: () => void;
}) {
  function set<K extends keyof AnalysisOptionsState>(key: K, v: AnalysisOptionsState[K]) {
    onChange({ ...value, [key]: v });
  }

  const toInputDate = (selectedDate: string) => {
    const match = selectedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return "";
    return `${match[3]}-${match[2]}-${match[1]}`;
  };

  const fromInputDate = (inputDate: string) => {
    if (!inputDate) return "";
    const [year, month, day] = inputDate.split("-");
    if (!year || !month || !day) return "";
    return `${day}/${month}/${year}`;
  };

  const inputBase =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 outline-none transition duration-200 ease-out focus:border-cyan-400/40 focus:bg-white/10";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">Leverage</span>
          <select className={inputBase} value={value.leverage} onChange={(e) => set("leverage", e.target.value)}>
            {leverageOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">Timeframe</span>
          <select className={inputBase} value={value.timeframe} onChange={(e) => set("timeframe", e.target.value)}>
            {timeframeOptions.map((x) => (
              <option key={x} value={x}>
                {x === "1h" ? "1 Hour" : x}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">SL ROE</span>
          <div className="relative">
            <input
              className={`${inputBase} pr-10 text-right tabular-nums`}
              value={value.slRoePct}
              onChange={(e) => set("slRoePct", e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="100"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              %
            </span>
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">TP ROE</span>
          <div className="relative">
            <input
              className={`${inputBase} pr-10 text-right tabular-nums`}
              value={value.tpRoePct}
              onChange={(e) => set("tpRoePct", e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric"
              placeholder="300"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              %
            </span>
          </div>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">Select Date</span>
          <input
            type="date"
            className={inputBase}
            value={toInputDate(value.selectedDate)}
            onChange={(e) => set("selectedDate", fromInputDate(e.target.value))}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm text-gray-400">Lookahead Window</span>
          <select
            className={inputBase}
            value={value.lookaheadHours}
            onChange={(e) => set("lookaheadHours", e.target.value)}
          >
            {lookaheadOptions.map((h) => (
              <option key={h} value={h}>
                {h} Hours
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="w-full rounded-xl border border-white/20 px-4 py-2 text-sm text-gray-300 transition duration-200 ease-out hover:bg-white/10"
          onClick={onReset}
        >
          Reset
        </button>
        <button
          type="button"
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2 text-sm font-semibold text-white transition duration-200 ease-out hover:opacity-90"
          onClick={onAnalyze}
        >
          Save
        </button>
      </div>
    </div>
  );
}
