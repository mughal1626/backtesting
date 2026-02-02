import { describe, expect, it } from "vitest";
import {
  calculateMfeMae,
  calculateSlTpPrices,
  detectSlTpHits,
  getEntryOpenTime,
  parseStartTimeUtcMs,
  type Candle,
} from "@/lib/backtest";

describe("backtest calculations", () => {
  it("calculates SL/TP prices for long and short", () => {
    const long = calculateSlTpPrices({
      entryPrice: 100,
      direction: "LONG",
      leverage: 5,
      slRoePct: 100,
      tpRoePct: 200,
    });
    expect(long.slPrice).toBeCloseTo(80);
    expect(long.tpPrice).toBeCloseTo(140);

    const short = calculateSlTpPrices({
      entryPrice: 100,
      direction: "SHORT",
      leverage: 5,
      slRoePct: 100,
      tpRoePct: 200,
    });
    expect(short.slPrice).toBeCloseTo(120);
    expect(short.tpPrice).toBeCloseTo(60);
  });

  it("calculates MFE/MAE for long and short", () => {
    const candles: Candle[] = [
      { openTime: 0, open: 100, high: 110, low: 95, close: 105 },
      { openTime: 60_000, open: 105, high: 112, low: 90, close: 95 },
    ];

    const long = calculateMfeMae({ candles, entryPrice: 100, direction: "LONG", leverage: 2 });
    expect(long.mfePct).toBeCloseTo(24);
    expect(long.maePct).toBeCloseTo(20);

    const short = calculateMfeMae({ candles, entryPrice: 100, direction: "SHORT", leverage: 2 });
    expect(short.mfePct).toBeCloseTo(20);
    expect(short.maePct).toBeCloseTo(24);
  });

  it("detects TP/SL hits including same-candle ambiguity", () => {
    const base: Candle[] = [
      { openTime: 0, open: 100, high: 104, low: 99, close: 102 },
      { openTime: 60_000, open: 102, high: 106, low: 100, close: 105 },
    ];

    const tpOnly = detectSlTpHits({
      candles: base,
      entryPrice: 100,
      direction: "LONG",
      leverage: 1,
      slRoePct: 5,
      tpRoePct: 5,
    });
    expect(tpOnly.slTpHit).toBe("TP");

    const slOnly = detectSlTpHits({
      candles: [{ openTime: 0, open: 100, high: 101, low: 94, close: 95 }],
      entryPrice: 100,
      direction: "LONG",
      leverage: 1,
      slRoePct: 5,
      tpRoePct: 5,
    });
    expect(slOnly.slTpHit).toBe("SL");

    const bothDifferent = detectSlTpHits({
      candles: [
        { openTime: 0, open: 100, high: 101, low: 94, close: 95 },
        { openTime: 60_000, open: 95, high: 106, low: 94, close: 105 },
      ],
      entryPrice: 100,
      direction: "LONG",
      leverage: 1,
      slRoePct: 5,
      tpRoePct: 5,
    });
    expect(bothDifferent.slTpHit).toBe("BOTH");
    expect(bothDifferent.slBeforeTp).toBe(true);
    expect(bothDifferent.hitOrder).toBe("SL_FIRST");

    const bothSame = detectSlTpHits({
      candles: [{ openTime: 0, open: 100, high: 106, low: 94, close: 100 }],
      entryPrice: 100,
      direction: "LONG",
      leverage: 1,
      slRoePct: 5,
      tpRoePct: 5,
    });
    expect(bothSame.slTpHit).toBe("BOTH");
    expect(bothSame.hitOrder).toBe("SAME_CANDLE_UNKNOWN");
  });

  it("parses selected date and time as UTC", () => {
    const utcMs = parseStartTimeUtcMs("15/04/2024", "12:30", "utc");
    const expected = Date.UTC(2024, 3, 15, 12, 30, 0, 0);
    expect(utcMs).toBe(expected);
  });

  it("rejects start time that includes a date", () => {
    expect(() => parseStartTimeUtcMs("15/04/2024", "2024-04-15 12:30", "utc")).toThrow(
      /Invalid start time/,
    );
  });

  it("aligns entry open time to timeframe boundary", () => {
    const hourMs = 60 * 60_000;
    const fifteenMs = 15 * 60_000;
    const startTime = Date.UTC(2024, 3, 15, 12, 7, 0, 0);
    expect(getEntryOpenTime(startTime, hourMs)).toBe(Date.UTC(2024, 3, 15, 12, 0, 0, 0));
    expect(getEntryOpenTime(startTime, fifteenMs)).toBe(Date.UTC(2024, 3, 15, 12, 0, 0, 0));
  });
});
