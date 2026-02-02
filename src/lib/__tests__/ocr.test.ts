import { describe, expect, it } from "vitest";
import { extractSignalsFromText } from "@/lib/ocr";

describe("extractSignalsFromText", () => {
  it("keeps distinct pairs that share the same start time", () => {
    const text = [
      "Long",
      "QNT",
      "Target",
      "69.616024",
      "03:51",
      "Long",
      "MANA",
      "Target",
      "0.1228",
      "03:56",
      "Long",
      "YFI",
      "Target",
      "3325.2",
      "03:56",
    ].join("\n");

    const signals = extractSignalsFromText(text, {
      fallbackPair: "BTCUSDT",
      fallbackDirection: "Long",
    });

    expect(signals).toHaveLength(3);
    const pairsAt356 = signals.filter((signal) => signal.startTime === "03:56").map((signal) => signal.pair);
    expect(pairsAt356).toEqual(expect.arrayContaining(["MANA", "YFI"]));
  });
});
