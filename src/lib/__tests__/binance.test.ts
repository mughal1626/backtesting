import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchKlinesPaged, resolveUsdmSymbol, resetExchangeInfoCache } from "@/lib/binance";

describe("binance helpers", () => {
  beforeEach(() => {
    resetExchangeInfoCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("paginates klines across >1500 minutes", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount += 1;
      if (callCount === 1) {
        const data = Array.from({ length: 1500 }, (_, index) => [
          index * 60_000,
          "1",
          "2",
          "0.5",
          "1.5",
        ]);
        return new Response(JSON.stringify(data), { status: 200 });
      }
      const data = [[1500 * 60_000, "1", "2", "0.5", "1.5"]];
      return new Response(JSON.stringify(data), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchKlinesPaged({
      symbol: "BTCUSDT",
      interval: "1m",
      startTime: 0,
      endTime: 1501 * 60_000,
    });

    expect(result.klines).toHaveLength(1501);
    expect(callCount).toBe(2);
  });

  it("resolves USDT-M symbols including prefixes", async () => {
    const exchangeInfo = {
      symbols: [{ symbol: "ADAUSDT" }, { symbol: "BTCUSDT" }, { symbol: "1000SHIBUSDT" }],
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(exchangeInfo), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const ada = await resolveUsdmSymbol("ada");
    expect(ada).toBe("ADAUSDT");

    const btc = await resolveUsdmSymbol("BTCUSDT");
    expect(btc).toBe("BTCUSDT");

    const btcBase = await resolveUsdmSymbol("BTC");
    expect(btcBase).toBe("BTCUSDT");

    const shib = await resolveUsdmSymbol("shib");
    expect(shib).toBe("1000SHIBUSDT");

    const doge = await resolveUsdmSymbol("doge");
    expect(doge).toBe(null);
  });
});
