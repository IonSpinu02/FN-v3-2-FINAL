import { describe, expect, it } from "vitest";
import { buildConsensoDailyTimeline } from "./consensoDailyTimeline";
import type { PollRelease } from "./pollTypes";

const polls: PollRelease[] = [
  {
    id: "a",
    institute: "SWG",
    fieldEnd: "2026-10-28",
    publishedAt: "2026-10-29",
    fnPct: 7.4,
    sampleSize: 3000,
    method: "mixed",
  },
  {
    id: "b",
    institute: "Ipsos",
    fieldEnd: "2026-10-26",
    publishedAt: "2026-10-27",
    fnPct: 7.0,
    sampleSize: 2800,
    method: "CATI",
  },
];

describe("buildConsensoDailyTimeline", () => {
  it("produce un punto per giorno e varia con il decadimento recency", () => {
    const series = buildConsensoDailyTimeline({
      mode: "aggregate",
      asOf: new Date("2026-10-30T15:00:00.000Z"),
      days: 5,
      pollReleases: polls,
      supermediaSeries: [],
    });
    expect(series).toHaveLength(5);
    expect(series[0]!.isoDate).toBe("2026-10-26");
    expect(series[series.length - 1]!.isoDate).toBe("2026-10-30");
    const first = series[0]!.sPct;
    const last = series[series.length - 1]!.sPct;
    expect(last).not.toBe(first);
  });
});
