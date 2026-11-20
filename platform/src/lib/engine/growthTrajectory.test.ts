import { describe, expect, it } from "vitest";
import {
  buildGrowthEvidence,
  isForeignAngloNews,
  isValidNewsHeadline,
} from "./growthEvidence";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import {
  backtestFlatVsSlope,
  horizonMonths,
  projectHorizon,
  projectMonths,
  type GrowthEvidence,
} from "./growthTrajectory";

const falling: GrowthEvidence = {
  slopePpPerMonth: -1,
  newsScore: 0,
  bipMatches: 3,
  newsHeadlines: [],
  bipLabels: ["Sicurezza"],
  slopeFrom: "2026-08-15",
  slopeTo: "2026-10-15",
};

describe("growthTrajectory", () => {
  it("il punto di partenza è il consenso passato e non viene risottratto", () => {
    const asOf = new Date("2026-11-06T12:00:00Z");
    const evidence = buildGrowthEvidence({
      series: [
        { isoDate: "2026-09-08", pct: 7.7 },
        { isoDate: "2026-10-16", pct: 6.9 },
        { isoDate: "2026-11-06", pct: 6.59 },
      ],
    });
    const out = projectMonths({
      startPct: 6.59,
      evidence,
      months: 1,
      sensitivity: 1,
      asOf,
    });
    expect(out.breakdown?.startPct).toBe(6.59);
    expect(out.centralPct).toBeGreaterThan(6.04);
    expect(out.newsPp).not.toBe(0);
    expect(out.bipPp).toBeGreaterThan(0);
  });

  it("la velocità recente pesa di più gli ultimi 21 giorni del calo estivo", () => {
    const evidence = buildGrowthEvidence({
      series: [
        { isoDate: "2026-09-08", pct: 7.7 },
        { isoDate: "2026-10-16", pct: 6.6 },
        { isoDate: "2026-11-06", pct: 6.59 },
      ],
    });
    const longOnly = (6.59 - 7.7) / (59 / 30.44);
    expect(Math.abs(evidence.slopePpPerMonth)).toBeLessThan(Math.abs(longOnly));
  });

  it("lo shock delle notizie non è zero senza titoli e non supera 0,3 pp a 90 giorni", () => {
    const evidence = {
      ...falling,
      newsScore: 0,
      newsHeadlines: [] as string[],
      bipMatches: 0,
    };
    const out = projectHorizon({
      startPct: 6.2,
      evidence,
      horizon: "d90",
      sensitivity: 1,
      asOf: new Date("2026-11-02T12:00:00Z"),
    });
    expect(out.newsPp).toBeGreaterThan(0);
    expect(out.newsPp).toBeLessThanOrEqual(0.3);
    expect(out.bipPp).toBeGreaterThan(0);
  });

  it("la banda di maggio 2027 è più larga di quella a 30 giorni", () => {
    const asOf = new Date("2026-11-02T12:00:00Z");
    const near = projectHorizon({
      startPct: 6.2,
      evidence: falling,
      horizon: "d30",
      asOf,
    });
    const far = projectHorizon({
      startPct: 6.2,
      evidence: falling,
      horizon: "may27",
      asOf,
    });
    expect(far.bandHighPct - far.bandLowPct).toBeGreaterThan(
      near.bandHighPct - near.bandLowPct,
    );
  });

  it("projectHorizon e projectMonths coincidono su 30, 90 e maggio", () => {
    const asOf = new Date("2026-11-02T12:00:00Z");
    const may = horizonMonths("may27", asOf);
    const evidence = {
      ...falling,
      newsScore: 0.5,
      newsHeadlines: ["Futuro Nazionale scende nei sondaggi"],
      bipMatches: 1,
    };
    for (const horizon of ["d30", "d90", "may27"] as const) {
      const viaHorizon = projectHorizon({
        startPct: 6.2,
        evidence,
        horizon,
        asOf,
        sensitivity: 1,
      });
      const viaMonths = projectMonths({
        startPct: 6.2,
        evidence,
        months: horizonMonths(horizon, asOf),
        mayMonths: may,
        sensitivity: 1,
        asOf,
      });
      expect(viaHorizon.centralPct).toBe(viaMonths.centralPct);
      expect(viaHorizon.deltaPp).toBe(viaMonths.deltaPp);
      expect(viaHorizon.newsPp).toBe(viaMonths.newsPp);
      expect(viaHorizon.bipPp).toBe(viaMonths.bipPp);
      expect(viaHorizon.bandLowPct).toBe(viaMonths.bandLowPct);
      expect(viaHorizon.bandHighPct).toBe(viaMonths.bandHighPct);
    }
  });

  it("senza notizie il boost B.I.P. resta zero anche se ci sono match", () => {
    const evidence = buildGrowthEvidence({
      series: [
        { isoDate: "2026-08-01", pct: 7.2 },
        { isoDate: "2026-10-15", pct: 6.2 },
      ],
      headlines: [],
    });
    expect(evidence.bipMatches).toBe(0);
    expect(evidence.slopePpPerMonth).toBeLessThan(0);
  });

  it("scarta titoli spazzatura, hub UE, anglofoni e privilegi i temi dei 4 pilastri", () => {
    expect(isValidNewsHeadline("Instagram")).toBe(false);
    expect(
      isValidNewsHeadline("Your gateway to the EU, News, Highlights | European Union"),
    ).toBe(false);
    expect(
      isValidNewsHeadline("Lagarde lascia la BCE: mercati in allerta 🫨"),
    ).toBe(false);
    expect(
      isForeignAngloNews(
        "Budget 2026: Martin Lewis' instant reaction to £100 energy bill help",
        "https://www.moneysavingexpert.com/news/budget",
      ),
    ).toBe(true);
    expect(
      isValidNewsHeadline(
        "Your pay, energy bills and savings: How the Budget affects you - BBC",
        "https://www.bbc.com/news/articles/budget",
      ),
    ).toBe(false);
    expect(
      isForeignAngloNews(
        "Asian maritime security in Q3 – Less theft and armed robbery",
        "https://www.seatrade-maritime.com/piracy/asian-maritime-security",
      ),
    ).toBe(true);
    expect(
      isValidNewsHeadline(
        "Asian maritime security in Q3 – Less theft and armed robbery",
        "https://www.seatrade-maritime.com/piracy/asian-maritime-security",
      ),
    ).toBe(false);
    expect(
      isForeignAngloNews(
        "Italy's Meloni approves tougher measures on migration - The Spec",
        "https://www.flamboroughreview.com/news/italy-meloni",
      ),
    ).toBe(true);
    expect(
      isValidNewsHeadline(
        "Il Governo varano misure più dure sull'immigrazione dopo il Consiglio",
        "https://www.ansa.it/sito/notizie/politica/2026/11/10/governo.html",
      ),
    ).toBe(true);
    const thematic =
      "Liste d'attesa sanità: pronto soccorso al collasso in Calabria e Sicilia";
    const evidence = buildGrowthEvidence({
      series: [
        { isoDate: "2026-08-01", pct: 7.2 },
        { isoDate: "2026-10-15", pct: 6.2 },
      ],
      headlines: [
        "Instagram",
        "Your gateway to the EU, News, Highlights | European Union",
        "Futuro Nazionale scende nei sondaggi di ottobre",
        thematic,
        "Eventi e scadenze di Borsa Italiana per la settimana",
        "Il carovita presenta il conto a Trump: prezzi su del 30% in sei anni",
      ],
    });
    expect(evidence.newsHeadlines).toEqual([thematic]);
    expect(evidence.sources?.some((source) => source.url?.includes("youtrend.it"))).toBe(true);
  });

  it("dal 15 gennaio 2027 la timeline non ripropone i mesi già chiusi", () => {
    const out = projectMonths({
      startPct: 6.2,
      evidence: falling,
      months: 3,
      asOf: new Date("2027-01-15T12:00:00Z"),
      sensitivity: 1,
    });
    expect(out.timeline.map((item) => item.monthKey)).not.toContain("2026-11");
    expect(out.timeline[0]?.monthKey).toBe("2027-01");
    expect(out.timeline.at(-1)?.monthKey).toBe("2027-05");
  });

  it("il 2 novembre include la manovra e un deputato simulato alza il risultato", () => {
    const asOf = new Date("2026-11-02T12:00:00Z");
    const base = projectHorizon({
      startPct: 6.2,
      evidence: falling,
      horizon: "d30",
      asOf,
      sensitivity: 1,
    });
    expect(base.activeDrivers.some((d) => d.includes("manovra"))).toBe(true);
    const withEntry = projectHorizon({
      startPct: 6.2,
      evidence: falling,
      horizon: "d30",
      asOf,
      sensitivity: 1,
      ingressi: { dep: 1, creg: 0, sind: 0 },
    });
    expect(withEntry.centralPct).toBeGreaterThan(base.centralPct);
  });

  it("a 30 giorni il centro piatto non sbaglia più della pendenza smorzata", () => {
    const score = backtestFlatVsSlope(FN_SUPERMEDIA_CONSENSO_SERIES);
    expect(score.n).toBeGreaterThan(0);
    expect(score.flatMae).toBeLessThanOrEqual(score.slopeMae + 0.05);
  });
});
