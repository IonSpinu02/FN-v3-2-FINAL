import { describe, expect, it } from "vitest";
import {
  computeFnNationalAggregate,
  dedupeLatestPerInstitute,
  filterReleasesInWindow,
  normalizeToUtcNoon,
  toValidDate,
} from "./fnNationalAggregate";
import type { PollRelease } from "./pollTypes";

const base: PollRelease[] = [
  {
    id: "a1",
    institute: "SWG",
    fieldEnd: "2026-10-14",
    publishedAt: "2026-10-15",
    fnPct: 8.0,
    sampleSize: 3000,
    method: "mixed",
  },
  {
    id: "a2",
    institute: "SWG",
    fieldEnd: "2026-10-10",
    publishedAt: "2026-10-11",
    fnPct: 6.0,
    sampleSize: 3000,
    method: "mixed",
  },
  {
    id: "b1",
    institute: "Ipsos",
    fieldEnd: "2026-10-12",
    publishedAt: "2026-10-13",
    fnPct: 7.0,
    sampleSize: 2500,
    method: "CATI",
  },
];

describe("dedupeLatestPerInstitute", () => {
  it("tiene solo il sondaggio più recente per istituto", () => {
    const d = dedupeLatestPerInstitute(base);
    expect(d).toHaveLength(2);
    expect(d.find((x) => x.institute === "SWG")?.fnPct).toBe(8.0);
  });

  it("normalizza il nome istituto (trim + case-insensitive)", () => {
    const noisy: PollRelease[] = [
      { ...base[0]!, institute: "  swg  ", fieldEnd: "2026-10-20", fnPct: 9 },
      { ...base[1]!, institute: "SWG", fieldEnd: "2026-10-22", fnPct: 7.5 },
    ];
    const d = dedupeLatestPerInstitute(noisy);
    expect(d).toHaveLength(1);
    expect(d[0]!.fnPct).toBe(7.5);
  });
});

describe("filterReleasesInWindow / timezone", () => {
  const single: PollRelease[] = [
    {
      id: "today",
      institute: "Test",
      fieldEnd: "2026-10-28",
      publishedAt: "2026-10-28",
      fnPct: 7.0,
    },
  ];

  it("include fieldEnd nello stesso giorno UTC anche con asOf mattutino", () => {
    const asOf = new Date("2026-10-28T07:30:00.000Z");
    const inWin = filterReleasesInWindow(single, asOf, 14);
    expect(inWin).toHaveLength(1);
    const agg = computeFnNationalAggregate(single, { asOf });
    expect(agg).not.toBeNull();
  });

  it("toValidDate / normalizeToUtcNoon accettano stringhe ISO e timestamp", () => {
    const fromIso = toValidDate("2026-11-06");
    expect(fromIso).toBeInstanceOf(Date);
    expect(Number.isNaN(fromIso.getTime())).toBe(false);
    const noon = normalizeToUtcNoon("2026-11-06T07:30:00.000Z");
    expect(noon.getUTCHours()).toBe(12);
    expect(noon.getUTCFullYear()).toBe(2026);
    expect(normalizeToUtcNoon(Date.parse("2026-11-06T12:00:00Z")).getUTCDate()).toBe(6);
  });

  it("include esattamente asOf - 14 giorni ed esclude asOf - 15", () => {
    const ref = normalizeToUtcNoon(new Date("2026-10-28T07:30:00.000Z"));
    const at14 = new Date(ref);
    at14.setUTCDate(at14.getUTCDate() - 14);
    const at15 = new Date(ref);
    at15.setUTCDate(at15.getUTCDate() - 15);

    const iso14 = at14.toISOString().slice(0, 10);
    const iso15 = at15.toISOString().slice(0, 10);

    const p14: PollRelease[] = [
      {
        id: "d14",
        institute: "A",
        fieldEnd: iso14,
        publishedAt: iso14,
        fnPct: 7,
      },
    ];
    const p15: PollRelease[] = [
      {
        id: "d15",
        institute: "B",
        fieldEnd: iso15,
        publishedAt: iso15,
        fnPct: 7,
      },
    ];

    expect(filterReleasesInWindow(p14, ref, 14)).toHaveLength(1);
    expect(filterReleasesInWindow(p15, ref, 14)).toHaveLength(0);
  });
});

describe("FN_DAILY_V2", () => {
  it("il numero pubblicato si rifà dai pesi a 3 decimali", () => {
    const asOf = new Date("2026-11-06T12:00:00.000Z");
    const releases: PollRelease[] = [
      {
        id: "swg",
        institute: "SWG",
        fieldEnd: "2026-11-02",
        publishedAt: "2026-11-02",
        fnPct: 5.8,
        sampleSize: 1200,
        method: "mixed",
      },
      {
        id: "ipsos",
        institute: "Ipsos",
        fieldEnd: "2026-10-29",
        publishedAt: "2026-10-31",
        fnPct: 7.9,
        method: "mixed",
      },
      {
        id: "eumetra",
        institute: "Eumetra",
        fieldEnd: "2026-10-28",
        publishedAt: "2026-10-28",
        fnPct: 6.5,
      },
      {
        id: "piepoli",
        institute: "Piepoli",
        fieldEnd: "2026-10-27",
        publishedAt: "2026-10-27",
        fnPct: 6.5,
      },
      {
        id: "swg-old",
        institute: "SWG",
        fieldEnd: "2026-10-26",
        publishedAt: "2026-10-26",
        fnPct: 5.6,
        sampleSize: 1200,
      },
    ];
    const r = computeFnNationalAggregate(releases, { asOf });
    expect(r).not.toBeNull();
    expect(r!.formulaId).toBe("FN_DAILY_V2");
    expect(r!.pollsUsed.map((p) => p.institute)).toEqual([
      "SWG",
      "Ipsos",
      "Eumetra",
      "Piepoli",
    ]);
    expect(r!.pollsUsed.find((p) => p.institute === "SWG")?.fnPct).toBe(5.8);
    const sumW = r!.pollsUsed.reduce((s, p) => s + p.weight, 0);
    const sumWx = r!.pollsUsed.reduce((s, p) => s + p.weight * p.fnPct, 0);
    expect(r!.fnPct).toBe(Math.round((sumWx / sumW) * 100) / 100);
    const nextDay = computeFnNationalAggregate(releases, {
      asOf: new Date("2026-11-07T12:00:00.000Z"),
    });
    const swgToday = r!.pollsUsed.find((p) => p.institute === "SWG")!.weight;
    const swgTomorrow = nextDay!.pollsUsed.find((p) => p.institute === "SWG")!.weight;
    expect(swgTomorrow).toBeLessThan(swgToday);
  });
});

describe("computeFnNationalAggregate", () => {
  it("calcola media ponderata in finestra", () => {
    const asOf = new Date("2026-10-16T12:00:00.000Z");
    const r = computeFnNationalAggregate(base, { asOf });
    expect(r).not.toBeNull();
    expect(r!.pollsUsed.length).toBe(2);
    expect(r!.fnPct).toBeGreaterThan(7);
    expect(r!.fnPct).toBeLessThan(8.5);
    expect(r!.s).toBeCloseTo(r!.fnPct / 100, 4);
  });

  it("confidenceBandPp con una cifra decimale senza artefatti floating-point", () => {
    const releases: PollRelease[] = [
      {
        id: "x1",
        institute: "A",
        fieldEnd: "2026-10-27",
        publishedAt: "2026-10-27",
        fnPct: 7.11,
        sampleSize: 1000,
        method: "unknown",
      },
      {
        id: "x2",
        institute: "B",
        fieldEnd: "2026-10-26",
        publishedAt: "2026-10-26",
        fnPct: 7.19,
        sampleSize: 1000,
        method: "unknown",
      },
    ];
    const r = computeFnNationalAggregate(releases, {
      asOf: new Date("2026-10-28T07:30:00.000Z"),
    });
    expect(r).not.toBeNull();
    const [lo, hi] = r!.confidenceBandPp;
    expect(lo).toBe(Math.round(lo * 10) / 10);
    expect(hi).toBe(Math.round(hi * 10) / 10);
    expect(String(lo).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
    expect(String(hi).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
