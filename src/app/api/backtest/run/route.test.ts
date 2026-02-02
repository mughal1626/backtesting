import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/backtest/run/route";
import { parseStartTimeUtcMs } from "@/lib/backtest";
import { resetExchangeInfoCache } from "@/lib/binance";

const baseOptions = {
  selectedDate: "15/04/2024",
  leverage: "5x",
  slRoePct: "100",
  tpRoePct: "200",
  lookaheadHours: "1",
  timeframe: "1h",
};

describe("backtest run route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetExchangeInfoCache();
  });

  it("returns symbol_not_on_usdm_futures without klines calls", async () => {
    const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }] };
    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/fapi/v1/exchangeInfo")) {
        return new Response(JSON.stringify(exchangeInfo), { status: 200 });
      }
      return new Response("unexpected", { status: 500 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal: { pair: "DOGE", direction: "Long", startTime: "12:00" },
        options: baseOptions,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(payload.result.quality.error).toBe("symbol_not_on_usdm_futures");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("flags timestamp mismatch when entry kline missing but latest exists", async () => {
    const startTime = parseStartTimeUtcMs("15/04/2024", "12:00", "utc");
    const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }] };
    const earliestOpenTime = startTime + 30_000;

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/fapi/v1/exchangeInfo")) {
        return new Response(JSON.stringify(exchangeInfo), { status: 200 });
      }
      if (url.includes("/fapi/v1/klines")) {
        const parsed = new URL(url);
        const interval = parsed.searchParams.get("interval");
        const limit = parsed.searchParams.get("limit");
        const startParam = parsed.searchParams.get("startTime");
        if (interval === "1h" && limit === "2") {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (interval === "1h" && limit === "5") {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (interval === "1h" && limit === "1") {
          return new Response(JSON.stringify([[startTime, "100", "110", "90", "105"]]), { status: 200 });
        }
        if (interval === "1m" && limit === "1" && startParam === "946684800000") {
          return new Response(JSON.stringify([[earliestOpenTime, "1", "1", "1", "1"]]), { status: 200 });
        }
      }
      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal: { pair: "BTC", direction: "Long", startTime: "12:00" },
        options: baseOptions,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(payload.result.quality.error).toBe("start_before_listing_history");
    expect(payload.result.quality.debug).toBeTruthy();
  });

  it("recovers entry kline from fallback window", async () => {
    const startTime = parseStartTimeUtcMs("15/04/2024", "12:00", "utc");
    const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }] };

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/fapi/v1/exchangeInfo")) {
        return new Response(JSON.stringify(exchangeInfo), { status: 200 });
      }
      if (url.includes("/fapi/v1/klines")) {
        const parsed = new URL(url);
        const interval = parsed.searchParams.get("interval");
        const limit = parsed.searchParams.get("limit");
        if (interval === "1h" && limit === "2") {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (interval === "1h" && limit === "5") {
          return new Response(
            JSON.stringify([[startTime, "100", "110", "90", "105"]]),
            { status: 200 },
          );
        }
        if (interval === "1m") {
          const startParam = parsed.searchParams.get("startTime");
          const baseStart = startParam ? Number(startParam) : startTime;
          const data = [
            [baseStart, "100", "101", "99", "100"],
            [baseStart + 60_000, "100", "102", "98", "101"],
          ];
          return new Response(JSON.stringify(data), { status: 200 });
        }
      }
      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal: { pair: "BTC", direction: "Long", startTime: "12:00" },
        options: baseOptions,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(payload.result.entryPrice).toBe(100);
    expect(payload.result.quality.error).toBe(null);
  });

  it("flags alignment issue when entry kline missing after fallback", async () => {
    const startTime = parseStartTimeUtcMs("15/04/2024", "12:00", "utc");
    const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }] };

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/fapi/v1/exchangeInfo")) {
        return new Response(JSON.stringify(exchangeInfo), { status: 200 });
      }
      if (url.includes("/fapi/v1/klines")) {
        const parsed = new URL(url);
        const interval = parsed.searchParams.get("interval");
        const limit = parsed.searchParams.get("limit");
        if (interval === "1h" && limit === "2") {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (interval === "1h" && limit === "5") {
          return new Response(JSON.stringify([]), { status: 200 });
        }
        if (interval === "1h" && limit === "1") {
          return new Response(JSON.stringify([[startTime, "100", "110", "90", "105"]]), { status: 200 });
        }
        if (interval === "1m" && limit === "1") {
          return new Response(JSON.stringify([[startTime - 60_000, "1", "1", "1", "1"]]), { status: 200 });
        }
      }
      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal: { pair: "BTC", direction: "Long", startTime: "12:00" },
        options: baseOptions,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(payload.result.quality.error).toBe("entry_kline_not_found_timestamp_alignment");
    expect(payload.result.quality.debug).toBeTruthy();
  });

  it("returns entry price when entry kline found", async () => {
    const startTime = parseStartTimeUtcMs("15/04/2024", "12:00", "utc");
    const exchangeInfo = { symbols: [{ symbol: "BTCUSDT" }] };

    const fetchMock = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/fapi/v1/exchangeInfo")) {
        return new Response(JSON.stringify(exchangeInfo), { status: 200 });
      }
      if (url.includes("/fapi/v1/klines")) {
        const parsed = new URL(url);
        const interval = parsed.searchParams.get("interval");
        const limit = parsed.searchParams.get("limit");
        if (interval === "1h" && limit === "2") {
          return new Response(JSON.stringify([[startTime, "100", "110", "90", "105"]]), { status: 200 });
        }
        if (interval === "1m") {
          const startParam = parsed.searchParams.get("startTime");
          const baseStart = startParam ? Number(startParam) : startTime;
          const data = [
            [baseStart, "100", "101", "99", "100"],
            [baseStart + 60_000, "100", "102", "98", "101"],
          ];
          return new Response(JSON.stringify(data), { status: 200 });
        }
      }
      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("http://localhost/api/backtest/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signal: { pair: "BTC", direction: "Long", startTime: "12:00" },
        options: baseOptions,
      }),
    });

    const response = await POST(request);
    const payload = await response.json();
    expect(payload.result.entryPrice).toBe(100);
    expect(payload.result.quality.error).toBe(null);
  });
});
