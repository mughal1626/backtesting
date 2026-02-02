import type { AnalysisOptionsState } from "./types";

export const defaultOptions: AnalysisOptionsState = {
  leverage: "5x",
  slRoePct: "100",
  tpRoePct: "300",
  timeframe: "1h",
  selectedDate: "15/04/2024",
  lookaheadHours: "4",
};
