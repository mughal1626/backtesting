import type { BacktestDirection, SLTPHit } from "./types";

export type SignalInput = {
  pair: string;
  direction: string;
  startTime: string;
};

export type BacktestOptions = {
  selectedDate?: string;
  leverage?: string | number;
  slRoePct?: string | number;
  tpRoePct?: string | number;
  lookaheadHours?: string | number;
  timeframe?: string;
};

export type BacktestQuality = {
  partial: boolean;
  gap: boolean;
  missingMinutes: number;
  error: string | null;
  debug?: Record<string, unknown>;
};

export type BacktestResult = {
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

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const MS_PER_MINUTE = 60_000;

export function normalizeDirection(direction: string): BacktestDirection {
  const upper = direction.toUpperCase();
  if (upper === "LONG") return "LONG";
  if (upper === "SHORT") return "SHORT";
  throw new Error(`Invalid direction: ${direction}`);
}

export type TimezonePolicy = "utc";

export function parseStartTimeUtcMs(
  selectedDate: string,
  startTime: string,
  tzPolicy: TimezonePolicy = "utc",
) {
  const dateMatch = selectedDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dateMatch) {
    throw new Error(`Invalid selected date: ${selectedDate}`);
  }
  const [, day, month, year] = dateMatch;
  const timeMatch = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    throw new Error(`Invalid start time: ${startTime}`);
  }
  const [, hours, minutes] = timeMatch;
  if (tzPolicy !== "utc") {
    throw new Error(`Unsupported timezone policy: ${tzPolicy}`);
  }
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), 0, 0);
  if (Number.isNaN(utc)) {
    throw new Error(`Invalid datetime: ${selectedDate} ${startTime}`);
  }
  return utc;
}

export function parseLeverage(value?: string | number) {
  if (value === undefined || value === null || value === "") return 1;
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  const normalized = value.toLowerCase().replace(/x$/, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
}

export function parsePercentage(value?: string | number) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function ensureLookaheadMs(value?: string | number) {
  const hours = Number(value ?? 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    return MS_PER_MINUTE * 60 * 4;
  }
  return hours * 60 * MS_PER_MINUTE;
}

export function getLookaheadHours(value?: string | number) {
  const hours = Number(value ?? 0);
  return Number.isFinite(hours) && hours > 0 ? hours : 4;
}

export function mapTimeframeToInterval(timeframe?: string) {
  if (!timeframe) return "1h";
  const normalized = timeframe.trim().toLowerCase();
  const mapping: Record<string, string> = {
    "1 minute": "1m",
    "5 minutes": "5m",
    "15 minutes": "15m",
    "1 hour": "1h",
    "4 hours": "4h",
    "1 day": "1d",
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1h",
    "4h": "4h",
    "1d": "1d",
  };
  const interval = mapping[normalized];
  if (!interval) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }
  return interval;
}

export function getEntryOpenTime(startTimeUtcMs: number, intervalMs: number) {
  return Math.floor(startTimeUtcMs / intervalMs) * intervalMs;
}

export function calculateSlTpPrices({
  entryPrice,
  direction,
  leverage,
  slRoePct,
  tpRoePct,
}: {
  entryPrice: number;
  direction: BacktestDirection;
  leverage: number;
  slRoePct: number;
  tpRoePct: number;
}) {
  const safeLeverage = leverage || 1;
  const slMovePct = slRoePct / safeLeverage;
  const tpMovePct = tpRoePct / safeLeverage;
  const slMove = slMovePct / 100;
  const tpMove = tpMovePct / 100;

  if (direction === "LONG") {
    return {
      slPrice: entryPrice * (1 - slMove),
      tpPrice: entryPrice * (1 + tpMove),
    };
  }

  return {
    slPrice: entryPrice * (1 + slMove),
    tpPrice: entryPrice * (1 - tpMove),
  };
}

export function calculateMfeMae({
  candles,
  entryPrice,
  direction,
  leverage,
}: {
  candles: Candle[];
  entryPrice: number;
  direction: BacktestDirection;
  leverage: number;
}) {
  if (!candles.length || entryPrice <= 0) {
    return { mfePct: null, maePct: null };
  }

  let maxHigh = -Infinity;
  let minLow = Infinity;
  for (const candle of candles) {
    maxHigh = Math.max(maxHigh, candle.high);
    minLow = Math.min(minLow, candle.low);
  }

  const mfePriceMove =
    direction === "LONG" ? (maxHigh - entryPrice) / entryPrice : (entryPrice - minLow) / entryPrice;
  const maePriceMove =
    direction === "LONG" ? (entryPrice - minLow) / entryPrice : (maxHigh - entryPrice) / entryPrice;

  return {
    mfePct: mfePriceMove * 100 * leverage,
    maePct: maePriceMove * 100 * leverage,
  };
}

export function detectSlTpHits({
  candles,
  entryPrice,
  direction,
  leverage,
  slRoePct,
  tpRoePct,
}: {
  candles: Candle[];
  entryPrice: number;
  direction: BacktestDirection;
  leverage: number;
  slRoePct: number;
  tpRoePct: number;
}) {
  if (entryPrice <= 0) {
    return {
      slTpHit: "NONE" as SLTPHit,
      slBeforeTp: null,
      hitOrder: null,
      slHitTs: null,
      tpHitTs: null,
      slPrice: null,
      tpPrice: null,
    };
  }

  const { slPrice, tpPrice } = calculateSlTpPrices({
    entryPrice,
    direction,
    leverage,
    slRoePct,
    tpRoePct,
  });
  if (!candles.length) {
    return {
      slTpHit: "NONE" as SLTPHit,
      slBeforeTp: null,
      hitOrder: null,
      slHitTs: null,
      tpHitTs: null,
      slPrice,
      tpPrice,
    };
  }
  let slHitTs: number | null = null;
  let tpHitTs: number | null = null;

  for (const candle of candles) {
    const tpHit =
      direction === "LONG" ? candle.high >= tpPrice : candle.low <= tpPrice;
    const slHit =
      direction === "LONG" ? candle.low <= slPrice : candle.high >= slPrice;

    if (tpHit && tpHitTs === null) tpHitTs = candle.openTime;
    if (slHit && slHitTs === null) slHitTs = candle.openTime;
    if (tpHitTs !== null && slHitTs !== null) break;
  }

  let slTpHit: SLTPHit = "NONE";
  if (tpHitTs !== null && slHitTs !== null) {
    slTpHit = "BOTH";
  } else if (tpHitTs !== null) {
    slTpHit = "TP";
  } else if (slHitTs !== null) {
    slTpHit = "SL";
  }

  let slBeforeTp: boolean | null = null;
  let hitOrder: BacktestResult["hitOrder"] = null;

  if (slTpHit === "BOTH" && slHitTs !== null && tpHitTs !== null) {
    if (slHitTs < tpHitTs) {
      slBeforeTp = true;
      hitOrder = "SL_FIRST";
    } else if (tpHitTs < slHitTs) {
      slBeforeTp = false;
      hitOrder = "TP_FIRST";
    } else {
      slBeforeTp = null;
      hitOrder = "SAME_CANDLE_UNKNOWN";
    }
  }

  return {
    slTpHit,
    slBeforeTp,
    hitOrder,
    slHitTs,
    tpHitTs,
    slPrice,
    tpPrice,
  };
}

export function detectMissingMinutes(candles: Candle[], intervalMs = MS_PER_MINUTE) {
  if (candles.length < 2) {
    return { gap: false, missingMinutes: 0 };
  }
  let missingMinutes = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const expected = candles[index - 1].openTime + intervalMs;
    if (candles[index].openTime > expected) {
      missingMinutes += Math.round((candles[index].openTime - expected) / intervalMs);
    }
  }
  return { gap: missingMinutes > 0, missingMinutes };
}
