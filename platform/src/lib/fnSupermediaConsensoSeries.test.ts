import { describe, expect, it } from "vitest";
import {
  FN_SUPERMEDIA_CONSENSO_SERIES,
  fnSupermediaChartMeta,
} from "./fnSupermediaConsensoSeries";

describe("fnSupermediaConsensoSeries", () => {
  it("serie ordinata cronologicamente con percentuali plausibili", () => {
    expect(FN_SUPERMEDIA_CONSENSO_SERIES.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < FN_SUPERMEDIA_CONSENSO_SERIES.length; i++) {
      const prev = FN_SUPERMEDIA_CONSENSO_SERIES[i - 1]!.isoDate;
      const cur = FN_SUPERMEDIA_CONSENSO_SERIES[i]!.isoDate;
      expect(cur >= prev).toBe(true);
    }
    for (const p of FN_SUPERMEDIA_CONSENSO_SERIES) {
      expect(p.pct).toBeGreaterThan(0);
      expect(p.pct).toBeLessThan(20);
    }
  });

  it("ultimo punto allineato a S ufficiale 7,2%", () => {
    const { latestPct } = fnSupermediaChartMeta();
    expect(latestPct).toBeCloseTo(7.2, 1);
  });
});
