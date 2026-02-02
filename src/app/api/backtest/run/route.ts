import { NextResponse } from "next/server";
import {
  calculateMfeMae,
  detectMissingMinutes,
  detectSlTpHits,
  ensureLookaheadMs,
  getLookaheadHours,
  getEntryOpenTime,
  mapTimeframeToInterval,
  normalizeDirection,
  parseStartTimeUtcMs,
  parseLeverage,
  parsePercentage,
  type BacktestOptions,
  type BacktestResult,
  type SignalInput,
} from "@/lib/backtest";
import {
  fetchKlinesOnce,
  fetchKlinesPaged,
  intervalToMs,
  isUsdmSymbolListed,
  resolveUsdmSymbol,
} from "@/lib/binance";

type RunRequest = {
  signal: SignalInput;
  options: BacktestOptions;
};

const DEFAULT_TIMEFRAME = "1h";
const MS_PER_MINUTE = 60_000;

function buildResultBase({
  pair,
  direction,
  startTimeUtcMs,
  options,
  quality,
  interval,
}: {
  pair: string;
  direction: "LONG" | "SHORT";
  startTimeUtcMs: number;
  options: BacktestOptions;
  quality: BacktestResult["quality"];
  interval?: string;
}): BacktestResult {
  const leverage = parseLeverage(options.leverage);
  const slRoePct = parsePercentage(options.slRoePct);
  const tpRoePct = parsePercentage(options.tpRoePct);
  const timeframe = interval ?? options.timeframe ?? DEFAULT_TIMEFRAME;
  return {
    id: `${pair}-${startTimeUtcMs}`,
    pair,
    direction,
    startTimeUtcMs,
    entryPrice: null,
    slRoePct,
    tpRoePct,
    leverage,
    slPrice: null,
    tpPrice: null,
    mfePct: null,
    maePct: null,
    slTpHit: "NONE",
    slBeforeTp: null,
    hitOrder: null,
    lookaheadHours: getLookaheadHours(options.lookaheadHours),
    timeframe,
    quality,
    source: { venue: "BINANCE_FUTURES_USDM", endpoint: "/fapi/v1/klines" },
  };
}

export async function POST(request: Request) {
  let payload: RunRequest;
  try {
    payload = (await request.json()) as RunRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { signal, options } = payload;
  if (!signal?.pair || !signal?.direction || !signal?.startTime) {
    return NextResponse.json({ error: "Signal is missing required fields" }, { status: 400 });
  }

  if (!options?.selectedDate) {
    return NextResponse.json({ error: "selected_date_required" }, { status: 400 });
  }

  let direction: "LONG" | "SHORT";
  try {
    direction = normalizeDirection(signal.direction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  let startTimeUtcMs: number;
  try {
    startTimeUtcMs = parseStartTimeUtcMs(options.selectedDate, signal.startTime, "utc");
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  console.info("[backtest] startTimeUtcMs", startTimeUtcMs);

  const lookaheadMs = ensureLookaheadMs(options.lookaheadHours);
  const endTimeUtcMs = startTimeUtcMs + lookaheadMs;

  let interval: string;
  try {
    interval = mapTimeframeToInterval(options.timeframe ?? DEFAULT_TIMEFRAME);
  } catch (error) {
    return NextResponse.json({ error: "unsupported_timeframe" }, { status: 400 });
  }

  const tfMs = intervalToMs(interval);
  const entryOpenTime = getEntryOpenTime(startTimeUtcMs, tfMs);
  const entryEndTime = entryOpenTime + tfMs - 1;

  let resolvedSymbol: string | null;
  try {
    resolvedSymbol = await resolveUsdmSymbol(signal.pair);
  } catch (error) {
    const partial = buildResultBase({
      pair: signal.pair.toUpperCase(),
      direction,
      startTimeUtcMs,
      options,
      interval,
      quality: {
        partial: true,
        gap: false,
        missingMinutes: 0,
        error: (error as Error).message,
        debug: {
          requestedSymbol: signal.pair,
          interval,
          selectedDate: options.selectedDate,
          signalTime: signal.startTime,
          startTsUtcMs: startTimeUtcMs,
          entryOpenTime,
          entryEndTime,
        },
      },
    });
    return NextResponse.json({ result: partial });
  }

  if (!resolvedSymbol) {
    const partial = buildResultBase({
      pair: signal.pair.toUpperCase(),
      direction,
      startTimeUtcMs,
      options,
      interval,
      quality: {
        partial: true,
        gap: false,
        missingMinutes: 0,
        error: "symbol_not_on_usdm_futures",
        debug: {
          requestedSymbol: signal.pair,
          interval,
          selectedDate: options.selectedDate,
          signalTime: signal.startTime,
          startTsUtcMs: startTimeUtcMs,
          entryOpenTime,
          entryEndTime,
        },
      },
    });
    return NextResponse.json({ result: partial });
  }

  const isListed = await isUsdmSymbolListed(resolvedSymbol);
  if (!isListed) {
    const partial = buildResultBase({
      pair: resolvedSymbol,
      direction,
      startTimeUtcMs,
      options,
      interval,
      quality: {
        partial: true,
        gap: false,
        missingMinutes: 0,
        error: "symbol_not_on_usdm_futures",
        debug: {
          requestedSymbol: resolvedSymbol,
          interval,
          selectedDate: options.selectedDate,
          signalTime: signal.startTime,
          startTsUtcMs: startTimeUtcMs,
          entryOpenTime,
          entryEndTime,
        },
      },
    });
    return NextResponse.json({ result: partial });
  }

  try {
    const debugPayload: Record<string, unknown> = {
      requestedSymbol: resolvedSymbol,
      interval,
      selectedDate: options.selectedDate,
      signalTime: signal.startTime,
      startTsUtcMs: startTimeUtcMs,
      entryOpenTime,
      entryEndTime,
      entryReq: {
        symbol: resolvedSymbol,
        interval,
        startTime: entryOpenTime,
        endTime: entryEndTime,
        limit: 2,
      },
    };
    const entryResponse = await fetchKlinesPaged({
      symbol: resolvedSymbol,
      interval,
      startTime: entryOpenTime,
      endTime: entryEndTime,
      limit: 2,
    });

    let entryKline: (typeof entryResponse.klines)[number] | undefined = entryResponse.klines[0];
    if (!entryKline) {
      console.warn("[backtest] entry kline empty", debugPayload);
      const fallbackResponse = await fetchKlinesPaged({
        symbol: resolvedSymbol,
        interval,
        startTime: entryOpenTime - tfMs,
        endTime: entryEndTime,
        limit: 5,
      });
      entryKline = fallbackResponse.klines.find((kline) => kline.openTime === entryOpenTime);
    }

    if (!entryKline) {
      const sanityKlines = await fetchKlinesOnce({
        symbol: resolvedSymbol,
        interval,
        limit: 1,
      });
      debugPayload.latestReqOk = sanityKlines.length > 0;
      debugPayload.latestKlineOpenTime = sanityKlines.at(0)?.openTime ?? null;

      if (!sanityKlines.length) {
        const partial = buildResultBase({
          pair: resolvedSymbol,
          direction,
          startTimeUtcMs,
          options,
          interval,
          quality: {
            partial: true,
            gap: false,
            missingMinutes: 0,
            error: "symbol_kline_unavailable",
            debug: debugPayload,
          },
        });
        return NextResponse.json({ result: partial });
      }

      const earliestKlines = await fetchKlinesPaged({
        symbol: resolvedSymbol,
        interval: "1m",
        startTime: 946_684_800_000,
        endTime: startTimeUtcMs + MS_PER_MINUTE,
        limit: 1,
      });
      const earliestOpenTime = earliestKlines.klines[0]?.openTime ?? null;
      debugPayload.earliestKlineOpenTime = earliestOpenTime;
      if (earliestOpenTime && startTimeUtcMs < earliestOpenTime) {
        const partial = buildResultBase({
          pair: resolvedSymbol,
          direction,
          startTimeUtcMs,
          options,
          interval,
          quality: {
            partial: true,
            gap: false,
            missingMinutes: 0,
            error: "start_before_listing_history",
            debug: debugPayload,
          },
        });
        return NextResponse.json({ result: partial });
      }

      const partial = buildResultBase({
        pair: resolvedSymbol,
        direction,
        startTimeUtcMs,
        options,
        interval,
        quality: {
          partial: true,
          gap: false,
          missingMinutes: 0,
          error: "entry_kline_not_found_timestamp_alignment",
          debug: debugPayload,
        },
      });
      return NextResponse.json({ result: partial });
    }

    const entryPrice = entryKline.open;
    const lookaheadResponse = await fetchKlinesPaged({
      symbol: resolvedSymbol,
      interval: "1m",
      startTime: startTimeUtcMs,
      endTime: endTimeUtcMs,
    });

    const candles = lookaheadResponse.klines;
    const { gap, missingMinutes } = detectMissingMinutes(candles);
    const leverage = parseLeverage(options.leverage);
    const slRoePct = parsePercentage(options.slRoePct);
    const tpRoePct = parsePercentage(options.tpRoePct);

    const { slPrice, tpPrice, slTpHit, slBeforeTp, hitOrder } = detectSlTpHits({
      candles,
      entryPrice,
      direction,
      leverage,
      slRoePct,
      tpRoePct,
    });
    const { mfePct, maePct } = calculateMfeMae({ candles, entryPrice, direction, leverage });

    const result: BacktestResult = {
      id: `${resolvedSymbol}-${startTimeUtcMs}`,
      pair: resolvedSymbol,
      direction,
      startTimeUtcMs,
      entryPrice,
      slRoePct,
      tpRoePct,
      leverage,
      slPrice,
      tpPrice,
      mfePct,
      maePct,
      slTpHit,
      slBeforeTp,
      hitOrder,
      lookaheadHours: getLookaheadHours(options.lookaheadHours),
      timeframe: interval,
      quality: {
        partial: gap || lookaheadResponse.partial || entryResponse.partial,
        gap,
        missingMinutes,
        error: null,
      },
      source: { venue: "BINANCE_FUTURES_USDM", endpoint: "/fapi/v1/klines" },
    };

    if (!candles.length) {
      result.quality.partial = true;
      result.quality.error = "no_candles_returned";
      result.mfePct = null;
      result.maePct = null;
      result.slTpHit = "NONE";
    }

    return NextResponse.json({ result });
  } catch (error) {
    const partial = buildResultBase({
      pair: resolvedSymbol ?? signal.pair.toUpperCase(),
      direction,
      startTimeUtcMs,
      options,
      interval,
      quality: {
        partial: true,
        gap: false,
        missingMinutes: 0,
        error: (error as Error).message,
        debug: {
          requestedSymbol: resolvedSymbol ?? signal.pair,
          interval,
          selectedDate: options.selectedDate,
          signalTime: signal.startTime,
          startTsUtcMs: startTimeUtcMs,
          entryOpenTime,
          entryEndTime,
        },
      },
    });
    return NextResponse.json({ result: partial });
  }
}
