import type { AnalyticsRow, ResultRow } from "@/lib/types";

export const RESULTS_STORAGE_KEY = "backtest_results";

const directionLabel: Record<ResultRow["direction"], AnalyticsRow["direction"]> = {
  LONG: "Long",
  SHORT: "Short",
};

export function summarizeResults(results: ResultRow[]): AnalyticsRow[] {
  const summary = new Map<string, AnalyticsRow>();

  results.forEach((result) => {
    const key = `${result.pair}-${result.direction}`;
    const existing =
      summary.get(key) ?? {
        pair: result.pair,
        direction: directionLabel[result.direction],
        slHitTrades: 0,
        tpHitTrades: 0,
        slBeforeTpTrades: 0,
      };

    if (result.slTpHit === "SL" || result.slTpHit === "BOTH") {
      existing.slHitTrades += 1;
    }
    if (result.slTpHit === "TP" || result.slTpHit === "BOTH") {
      existing.tpHitTrades += 1;
    }
    if (result.slBeforeTp) {
      existing.slBeforeTpTrades += 1;
    }

    summary.set(key, existing);
  });

  return Array.from(summary.values()).sort((a, b) => a.pair.localeCompare(b.pair));
}
