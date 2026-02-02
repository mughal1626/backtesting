export type Kline = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

const BINANCE_BASE = "https://fapi.binance.com";
const EXCHANGE_INFO_TTL_MS = 30 * 60 * 1000;
const MAX_KLINES_LIMIT = 1500;

type ExchangeInfo = {
  symbols: Array<{ symbol: string }>;
};

type ExchangeInfoCache = {
  expiresAt: number;
  symbolsSet: Set<string>;
  symbolsList: string[];
};

let exchangeInfoCache: ExchangeInfoCache | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit, attempts = 3) {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (response.status >= 500 || response.status === 429) {
        lastError = new Error(`Binance request failed: ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error as Error;
    }
    await sleep(200 * 2 ** attempt);
  }
  if (lastError) throw lastError;
  throw new Error("Binance request failed");
}

export function normalizeSymbol(input: string) {
  const upper = input.trim().toUpperCase();
  if (upper.endsWith("USDT")) return upper;
  return `${upper}USDT`;
}

export async function fetchExchangeInfo(): Promise<ExchangeInfoCache> {
  const now = Date.now();
  if (exchangeInfoCache && exchangeInfoCache.expiresAt > now) {
    return exchangeInfoCache;
  }
  const response = await fetchWithRetry(`${BINANCE_BASE}/fapi/v1/exchangeInfo`);
  if (!response.ok) {
    throw new Error(`Exchange info request failed: ${response.status}`);
  }
  const data = (await response.json()) as ExchangeInfo;
  const symbolsList = data.symbols.map((entry) => entry.symbol);
  const symbolsSet = new Set(symbolsList);
  exchangeInfoCache = { symbolsList, symbolsSet, expiresAt: now + EXCHANGE_INFO_TTL_MS };
  return exchangeInfoCache;
}

export function resetExchangeInfoCache() {
  exchangeInfoCache = null;
}

export async function resolveUsdmSymbol(input: string) {
  const normalized = normalizeSymbol(input);
  const exchangeInfo = await fetchExchangeInfo();
  if (exchangeInfo.symbolsSet.has(normalized)) {
    return normalized;
  }

  const base = normalized.replace(/USDT$/, "");
  for (const prefix of ["1000", "10000"]) {
    const alt = `${prefix}${base}USDT`;
    if (exchangeInfo.symbolsSet.has(alt)) {
      return alt;
    }
  }

  const candidates = exchangeInfo.symbolsList.filter(
    (symbol) => symbol.endsWith("USDT") && symbol.includes(base),
  );
  if (candidates.length === 1) {
    return candidates[0];
  }
  return null;
}

export async function isUsdmSymbolListed(symbol: string) {
  const exchangeInfo = await fetchExchangeInfo();
  return exchangeInfo.symbolsSet.has(symbol);
}

export function intervalToMs(interval: string) {
  const match = interval.match(/^(\d+)(m|h|d|w)$/);
  if (!match) {
    throw new Error(`Unsupported interval: ${interval}`);
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "m" ? 60_000 : unit === "h" ? 60 * 60_000 : unit === "d" ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000;
  return value * multiplier;
}

export async function fetchKlinesPaged({
  symbol,
  interval,
  startTime,
  endTime,
  limit,
}: {
  symbol: string;
  interval: string;
  startTime: number;
  endTime: number;
  limit?: number;
}): Promise<{ klines: Kline[]; partial: boolean }> {
  const intervalMs = intervalToMs(interval);
  let currentStart = startTime;
  const map = new Map<number, Kline>();
  let partial = false;
  const pageLimit = limit ?? MAX_KLINES_LIMIT;

  while (currentStart < endTime) {
    const params = new URLSearchParams({
      symbol,
      interval,
      startTime: String(currentStart),
      endTime: String(endTime),
      limit: String(pageLimit),
    });
    const response = await fetchWithRetry(`${BINANCE_BASE}/fapi/v1/klines?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Binance request failed: ${response.status}`);
    }
    const data = (await response.json()) as Array<[number, string, string, string, string]>;
    if (!data.length) {
      partial = true;
      break;
    }
    for (const [openTime, open, high, low, close] of data) {
      if (openTime >= endTime) continue;
      map.set(openTime, {
        openTime,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
      });
    }
    const lastOpenTime = data[data.length - 1][0];
    if (lastOpenTime <= currentStart) {
      partial = true;
      break;
    }
    currentStart = lastOpenTime + intervalMs;
  }

  const klines = Array.from(map.values()).sort((a, b) => a.openTime - b.openTime);
  return { klines, partial };
}

export async function fetchKlinesOnce({
  symbol,
  interval,
  limit,
}: {
  symbol: string;
  interval: string;
  limit: number;
}): Promise<Kline[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });
  const response = await fetchWithRetry(`${BINANCE_BASE}/fapi/v1/klines?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Binance request failed: ${response.status}`);
  }
  const data = (await response.json()) as Array<[number, string, string, string, string]>;
  return data.map(([openTime, open, high, low, close]) => ({
    openTime,
    open: Number(open),
    high: Number(high),
    low: Number(low),
    close: Number(close),
  }));
}
