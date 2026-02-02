export type Direction = "Long" | "Short";
export type BacktestDirection = "LONG" | "SHORT";

export type ExtractedSignal = {
  id: string;
  pair: string;
  direction: Direction;
  startTime: string;
};

export type SLTPHit = "NONE" | "SL" | "TP" | "BOTH";

export type BacktestQuality = {
  partial: boolean;
  gap: boolean;
  missingMinutes: number;
  error: string | null;
  debug?: Record<string, unknown>;
};

export type ResultRow = {
  id: string;
  pair: string;
  direction: BacktestDirection;
  startTimeUtcMs: number;
  entryPrice: number | null;
  slRoePct: number;
  tpRoePct: number;
  leverage: number;
  slPrice: number | null;
  tpPrice: number | null;
  mfePct: number | null;
  maePct: number | null;
  slTpHit: SLTPHit;
  slBeforeTp: boolean | null;
  hitOrder: "SL_FIRST" | "TP_FIRST" | "SAME_CANDLE_UNKNOWN" | null;
  lookaheadHours: number;
  timeframe: string;
  quality: BacktestQuality;
  source: { venue: "BINANCE_FUTURES_USDM"; endpoint: "/fapi/v1/klines" };
};

export type AnalysisOptionsState = {
  leverage: string;       // "5x"
  slRoePct: string;       // "100"
  tpRoePct: string;       // "300"
  timeframe: string;      // "1h"
  selectedDate: string;   // DD/MM/YYYY
  lookaheadHours: string; // "4"
};

export type AnalyticsRow = {
  pair: string;
  direction: Direction;
  slHitTrades: number;
  tpHitTrades: number;
  slBeforeTpTrades: number;
};
