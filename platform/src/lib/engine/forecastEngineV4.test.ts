import { describe, expect, it } from "vitest";
import scenarioFile from "../../../data/risultati_v3_2.json";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { flussiFromMatrix } from "./flussiMatrices";
import { computeFnNationalAggregate } from "./fnNationalAggregate";
import {
  apportionCents,
  computeForecastV4,
  cycleMonthPp,
  factorPp,
  fix2,
  FORECAST_FACTOR_ORDER,
  FORECAST_SCENARIO_ORDER,
  forecastHorizon,
  recommendForecastAction,
  forecastRegionsFromScenario,
  forecastV4AtDays,
  forecastV4HorizonDefs,
  forecastV4Regional,
  may2027Days,
  STRUCTURAL_FACTOR_IDS,
  staticForecastPolls,
  walkForwardBacktestV4,
  type ForecastPoll,
  type ForecastV4Input,
  type ForecastV4Result,
} from "./forecastEngineV4";
import { buildGrowthEvidence } from "./growthEvidence";
import type { ConsensusPoint } from "./growthMath";
import { forecastInputFromProjection, projectMonths } from "./growthTrajectory";
import { computePartyGrowthForecast } from "./partyGrowthForecast";
import type { Region } from "./constants";
import type { ScenarioResult } from "./types";

const ASOF_ISO = "2026-11-06";
const ASOF = new Date(`${ASOF_ISO}T12:00:00Z`);
const IPSOS = flussiFromMatrix("ipsos_luglio_2026");
const SKY = flussiFromMatrix("skytg24_ottobre_2026");

function isoAt(offsetDays: number): string {
  const d = new Date(`${ASOF_ISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Serie sintetica: un punto ogni `step` giorni, da −span a oggi. */
function syntheticSeries(fn: (day: number) => number, span = 90, step = 3): ConsensusPoint[] {
  const out: ConsensusPoint[] = [];
  for (let d = -span; d <= 0; d += step) out.push({ isoDate: isoAt(d), pct: fix2(fn(d)) });
  return out;
}

function syntheticPolls(
  fn: (day: number) => number,
  institutes: { name: string; bias: number }[],
  span = 60,
  step = 6,
): ForecastPoll[] {
  const out: ForecastPoll[] = [];
  for (let d = -span; d <= 0; d += step) {
    institutes.forEach((inst, i) => {
      const day = Math.min(0, d - i);
      out.push({
        institute: inst.name,
        fieldEnd: isoAt(day),
        fnPct: fix2(fn(day) + inst.bias),
        sampleSize: 1000,
      });
    });
  }
  return out;
}

function numbersOf(value: unknown, path = "", out: [string, number][] = []): [string, number][] {
  if (typeof value === "number") out.push([path, value]);
  else if (Array.isArray(value)) value.forEach((v, i) => numbersOf(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) numbersOf(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function stringsOf(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsOf(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => stringsOf(v, out));
  return out;
}

function expectAllFinite(result: unknown) {
  const bad = numbersOf(result).filter(([, n]) => !Number.isFinite(n));
  expect(bad).toEqual([]);
  const badText = stringsOf(result).filter((s) => /NaN|undefined|Infinity/.test(s));
  expect(badText).toEqual([]);
}

function staticAggregatePct(): number {
  const agg = computeFnNationalAggregate(
    staticForecastPolls().map((p) => ({
      id: p.id ?? `${p.institute}-${p.fieldEnd}`,
      institute: p.institute,
      fieldEnd: p.fieldEnd,
      publishedAt: p.publishedAt ?? p.fieldEnd,
      fnPct: p.fnPct,
      sampleSize: p.sampleSize,
    })),
    { asOf: ASOF },
  );
  expect(agg).not.toBeNull();
  return agg!.fnPct;
}

function eachHorizon(
  result: ForecastV4Result,
  fn: (h: ForecastV4Result["base"]["horizons"][number], scenario: string) => void,
) {
  for (const id of FORECAST_SCENARIO_ORDER) {
    for (const h of result.scenarios[id].horizons) fn(h, id);
  }
}

describe("forecastEngineV4 · S0 = consenso nazionale aggregato", () => {
  it("senza startPct parte dall'aggregato FN_DAILY_V2 dei sondaggi, al centesimo", () => {
    const r = computeForecastV4({ asOf: ASOF });
    expect(r.startSource).toBe("aggregato");
    expect(r.startPct.toFixed(2)).toBe(staticAggregatePct().toFixed(2));
    eachHorizon(r, (h) => expect(h.startPct).toBe(r.startPct));
  });

  it("raccomanda un solo regime già calcolato, con leva e ampiezza", () => {
    const action = recommendForecastAction(computeForecastV4({ asOf: ASOF }));
    expect(FORECAST_SCENARIO_ORDER).toContain(action.regimeId);
    expect(action.leverLabel.length).toBeGreaterThan(0);
    expect(action.lo10Pct).toBeLessThanOrEqual(action.centralPct);
    expect(action.hi90Pct).toBeGreaterThanOrEqual(action.centralPct);
  });

  it("con startPct (riquadro 01) S0 coincide al centesimo con lo stesso toFixed(2)", () => {
    for (const s of [6.5899999, 6.585, 6.594999, 7.123456, 6.22, 12.005]) {
      const r = computeForecastV4({ asOf: ASOF, startPct: s });
      expect(r.startSource).toBe("input");
      expect(r.startPct.toFixed(2)).toBe(s.toFixed(2));
      eachHorizon(r, (h) => expect(h.startPct.toFixed(2)).toBe(s.toFixed(2)));
    }
  });

  it("gli adattatori (projectMonths e computePartyGrowthForecast) mantengono lo stesso S0", () => {
    const S = (scenarioFile as unknown as ScenarioResult).parametri.S;
    const evidence = buildGrowthEvidence({
      series: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct })),
    });
    const p = projectMonths({ startPct: S * 100, evidence, months: 1, asOf: ASOF });
    expect(p.v4?.startPct.toFixed(2)).toBe((S * 100).toFixed(2));
    const scenario = scenarioFile as unknown as ScenarioResult;
    const g = computePartyGrowthForecast({
      startS: S,
      totVoti: scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0),
      regime: "organica",
      flussi: IPSOS,
      rows: scenario.righe,
      poll: [],
      asOf: ASOF,
    });
    for (const h of g.horizons) expect(h.v4?.startPct.toFixed(2)).toBe((S * 100).toFixed(2));
  });

  it("startPct non finito ripiega sull'aggregato invece di produrre NaN", () => {
    const r = computeForecastV4({ asOf: ASOF, startPct: Number.NaN });
    expect(r.startSource).toBe("aggregato");
    expectAllFinite(r);
  });
});

describe("forecastEngineV4 · nessun NaN, nessun fattore strutturale bloccato a 0", () => {
  it("senza input esterni ogni fattore strutturale è diverso da zero su ogni orizzonte", () => {
    const r = computeForecastV4({ asOf: ASOF });
    expectAllFinite(r);
    for (const h of r.base.horizons) {
      for (const id of STRUCTURAL_FACTOR_IDS) {
        const f = h.factors.find((x) => x.id === id)!;
        expect(Number.isFinite(f.rawPp)).toBe(true);
        expect(Math.abs(f.rawPp)).toBeGreaterThan(1e-4);
        expect(f.pp).not.toBe(0);
      }
    }
  });

  it("vale anche con matrice Sky TG24; negli scenari alternativi nessun fattore è nullo ovunque", () => {
    const r = computeForecastV4({ asOf: ASOF, flussi: SKY });
    expectAllFinite(r);
    for (const h of r.base.horizons) {
      for (const id of STRUCTURAL_FACTOR_IDS) {
        expect(Math.abs(h.factors.find((x) => x.id === id)!.rawPp)).toBeGreaterThan(1e-4);
      }
    }
    for (const id of ["passivo", "offensiva"] as const) {
      for (const fid of STRUCTURAL_FACTOR_IDS) {
        const values = r.scenarios[id].horizons.map(
          (h) => h.factors.find((x) => x.id === fid)!.rawPp,
        );
        expect(Math.max(...values.map(Math.abs))).toBeGreaterThan(1e-3);
      }
    }
  });

  it("array vuoti e input degeneri: il motore ripiega sui dati statici e resta finito", () => {
    const cases: ForecastV4Input[] = [
      { asOf: ASOF, polls: [], history: [], regions: [], profiles: [], newsHeadlines: [] },
      { asOf: ASOF, polls: [{ institute: "Futuro", fieldEnd: "2027-01-01", fnPct: 7 }] },
      { asOf: ASOF, history: [{ isoDate: isoAt(-3), pct: 6.6 }] },
      { asOf: ASOF, networkDelta: { comitati: -100_000, tesserati: -10_000_000 } },
      { asOf: ASOF, validiNazionali: 0 },
      { asOf: ASOF, startPct: 1.2 },
      {
        asOf: ASOF,
        profiles: [
          { id: "x", nome: "X", ruolo: "deputato", regione: "Lazio", votiPortati: Number.NaN },
        ],
      },
    ];
    for (const input of cases) {
      const r = computeForecastV4(input);
      expectAllFinite(r);
      eachHorizon(r, (h) => {
        expect(h.lo10Pct).toBeLessThanOrEqual(h.centralPct);
        expect(h.hi90Pct).toBeGreaterThanOrEqual(h.centralPct);
      });
    }
  });

  it("l'agenda non va mai a zero, nemmeno con titoli tutti negativi", () => {
    const r = computeForecastV4({
      asOf: ASOF,
      newsHeadlines: [
        "Futuro Nazionale in calo nei sondaggi",
        "Vannacci perde consensi, crollo del partito",
      ],
      newsScore: -1,
    });
    for (const h of r.base.horizons) expect(factorPp(h, "agenda")).toBeGreaterThan(0);
  });
});

describe("forecastEngineV4 · aritmetica della cascata", () => {
  it("S0 + somma dei sette fattori = previsione, al centesimo esatto", () => {
    for (const flussi of [IPSOS, SKY]) {
      const r = computeForecastV4({ asOf: ASOF, flussi });
      eachHorizon(r, (h) => {
        expect(h.factors.map((f) => f.id)).toEqual(FORECAST_FACTOR_ORDER);
        const cents = h.factors.reduce((s, f) => s + Math.round(f.pp * 100), 0);
        expect(Math.round(h.startPct * 100) + cents).toBe(Math.round(h.centralPct * 100));
        expect(h.deltaPp).toBe(fix2(h.centralPct - h.startPct));
      });
    }
  });

  it("apportionCents conserva la somma arrotondata", () => {
    expect(apportionCents([0.004, 0.004, 0.004])).toEqual([0.01, 0, 0]);
    const values = [0.0144, -0.0437, 0.0655, 0.0737, 0.0195, 0.0004, 0];
    const out = apportionCents(values);
    const sum = values.reduce((s, v) => s + v, 0);
    expect(Math.round(out.reduce((s, v) => s + v, 0) * 100)).toBe(Math.round(sum * 100));
  });

  it("forecastV4AtDays e projectMonths danno gli stessi numeri del calcolo a tre orizzonti", () => {
    const evidence = buildGrowthEvidence({
      series: FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct })),
    });
    const base = { startPct: 6.59, evidence, asOf: ASOF, flussi: IPSOS };
    const input = forecastInputFromProjection(base, ASOF);
    const r = computeForecastV4(input);
    const defs = forecastV4HorizonDefs(ASOF);
    defs.forEach((def, i) => {
      const h = r.base.horizons[i]!;
      expect(forecastV4AtDays(input, def.days).horizon.centralPct).toBe(h.centralPct);
      const p = projectMonths({ ...base, months: def.days / 30 });
      expect(p.centralPct).toBe(h.centralPct);
      expect(p.bandLowPct).toBe(h.lo10Pct);
      expect(p.bandHighPct).toBe(h.hi90Pct);
      expect(fix2(p.slopePp + p.newsPp + p.bipPp + p.seasonalEventPp + factorPp(h, "bounds"))).toBe(
        h.deltaPp,
      );
    });
  });

  it("orizzonti: 30, 90 e maggio 2027 (180 giorni dal 6 novembre)", () => {
    expect(may2027Days(ASOF)).toBe(180);
    expect(forecastV4HorizonDefs(ASOF).map((h) => [h.key, h.days, h.label])).toEqual([
      ["d30", 30, "30 giorni"],
      ["d90", 90, "90 giorni"],
      ["d180", 180, "Maggio 2027"],
    ]);
  });

  it("ogni fattore e la fascia hanno una spiegazione semplice, senza sigle né formule", () => {
    const jargon = /\bpp\b|Kalman|σ|τ|\bS0\b|what-if|×/i;
    for (const flussi of [IPSOS, SKY]) {
      eachHorizon(computeForecastV4({ asOf: ASOF, flussi }), (h) => {
        for (const f of h.factors) {
          expect(f.plain.length, f.id).toBeGreaterThan(40);
          expect(f.plain, f.id).not.toMatch(jargon);
        }
        expect(h.uncertaintyPlain).toContain(formatPct(h.lo10Pct));
        expect(h.uncertaintyPlain).toContain(formatPct(h.hi90Pct));
        expect(h.uncertaintyPlain).not.toMatch(jargon);
      });
    }
  });
});

function formatPct(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

describe("forecastEngineV4 · scenari e cono di incertezza", () => {
  it("Passivo ≤ Base ≤ Offensiva su ogni orizzonte, con entrambe le matrici", () => {
    for (const flussi of [IPSOS, SKY]) {
      const r = computeForecastV4({ asOf: ASOF, flussi });
      r.base.horizons.forEach((h, i) => {
        expect(r.scenarios.passivo.horizons[i]!.centralPct).toBeLessThanOrEqual(h.centralPct);
        expect(h.centralPct).toBeLessThanOrEqual(r.scenarios.offensiva.horizons[i]!.centralPct);
      });
    }
  });

  it("la fascia 80% contiene il centro, si allarga con l'orizzonte e non scende sotto lo zoccolo", () => {
    const r = computeForecastV4({ asOf: ASOF });
    eachHorizon(r, (h) => {
      expect(h.lo10Pct).toBeLessThan(h.centralPct);
      expect(h.hi90Pct).toBeGreaterThan(h.centralPct);
      expect(h.lo10Pct).toBeGreaterThanOrEqual(r.diagnostics.hardFloorPct);
      expect(h.sigma.total).toBeCloseTo(
        Math.sqrt(h.sigma.poll ** 2 + h.sigma.hist ** 2 + h.sigma.model ** 2),
        2,
      );
    });
    const widths = r.base.horizons.map((h) => h.hi90Pct - h.lo10Pct);
    expect(widths[0]!).toBeLessThan(widths[1]!);
    expect(widths[1]!).toBeLessThan(widths[2]!);
    const hist = r.base.horizons.map((h) => h.sigma.hist);
    expect(hist[2]! / hist[0]!).toBeCloseTo(6 ** 0.55, 1);
  });
});

describe("forecastEngineV4 · flussi Ipsos contro Sky TG24", () => {
  it("la quota storica P(origine CDX|FN) resta distinta dal tasso di intercettazione", () => {
    const ipsos = computeForecastV4({ asOf: ASOF, flussi: IPSOS });
    const sky = computeForecastV4({ asOf: ASOF, flussi: SKY });
    // Provenienza storica (diagnostica) può differire tra matrici.
    expect(ipsos.diagnostics.donorShare).not.toBe(sky.diagnostics.donorShare);
    // Il contributo donor a scenario uguale usa P(FN|uscita CDX) di scenario,
    // non P(origine|FN): a parità di scenario i pp donor coincidono (stesso rate).
    for (const key of ["d30", "d90"] as const) {
      expect(factorPp(forecastHorizon(ipsos, "base", key), "donor")).toBeCloseTo(
        factorPp(forecastHorizon(sky, "base", key), "donor"),
        5,
      );
      const note = forecastHorizon(ipsos, "base", key).factors.find((f) => f.id === "donor")!
        .note;
      expect(note).toMatch(/P\(FN\|uscita CDX\)/);
      expect(note).toMatch(/P\(origine CDX\|FN\)/);
    }
  });

  it("Sky TG24 (57% di astenuti) pesa di più sul ciclo a maggio 2027", () => {
    const ipsos = computeForecastV4({ asOf: ASOF, flussi: IPSOS });
    const sky = computeForecastV4({ asOf: ASOF, flussi: SKY });
    const iCycle = forecastHorizon(ipsos, "base", "d180").factors.find((f) => f.id === "cycle")!;
    const sCycle = forecastHorizon(sky, "base", "d180").factors.find((f) => f.id === "cycle")!;
    expect(sCycle.rawPp).toBeGreaterThan(iCycle.rawPp);
  });

  it("la compensazione B.I.P. attenua la sessione di bilancio, la primavera scala con gli astenuti", () => {
    const opts = { abstentionShare: 0.36, fiscalCoverage: 1 };
    const weak = cycleMonthPp("2026-11", { ...opts, compensation: 0.2 });
    const strong = cycleMonthPp("2026-11", { ...opts, compensation: 0.8 });
    expect(weak).toBeLessThan(strong);
    expect(strong).toBeLessThan(0);
    const springIpsos = cycleMonthPp("2027-04", { ...opts, compensation: 0.4 });
    const springSky = cycleMonthPp("2027-04", {
      abstentionShare: 0.574,
      fiscalCoverage: 1,
      compensation: 0.4,
    });
    expect(springSky).toBeGreaterThan(springIpsos);
    expect(springIpsos).toBeGreaterThan(0);
  });
});

describe("forecastEngineV4 · momentum filtrato (Kalman)", () => {
  const institutes = [
    { name: "Alfa", bias: 0.5 },
    { name: "Beta", bias: -0.5 },
    { name: "Gamma", bias: 0 },
  ];

  it("stima l'effetto istituto: chi sovrastima è positivo, chi sottostima negativo", () => {
    const curve = () => 6.8;
    const r = computeForecastV4({
      asOf: ASOF,
      history: syntheticSeries(curve),
      polls: syntheticPolls(curve, institutes),
      startPct: 6.8,
    });
    const he = new Map(r.diagnostics.houseEffects.map((h) => [h.institute, h.pp]));
    expect(he.get("Alfa")!).toBeGreaterThan(0.2);
    expect(he.get("Beta")!).toBeLessThan(-0.2);
    expect(Math.abs(he.get("Gamma")!)).toBeLessThan(0.1);
  });

  it("ultimi 15 giorni stabili: l'inerzia negativa viene azzerata", () => {
    const curve = (d: number) => (d <= -18 ? 6.8 + (-18 - d) * 0.03 : 6.8);
    const r = computeForecastV4({
      asOf: ASOF,
      history: syntheticSeries(curve),
      polls: syntheticPolls(curve, [{ name: "Gamma", bias: 0 }]),
      startPct: 6.8,
      startIsObservation: true,
    });
    expect(r.diagnostics.slopeLongPpMonth).toBeLessThan(0);
    expect(r.diagnostics.stable15).toBe(true);
    expect(r.diagnostics.momentumNeutralized).toBe(true);
    expect(r.diagnostics.momentumPpMonth).toBe(0);
    for (const h of r.base.horizons) {
      expect(h.factors[0]!.sub[0]!.pp).toBe(0);
    }
  });

  it("calo ancora in corso: l'inerzia resta negativa", () => {
    const curve = (d: number) => 6.8 - d * 0.03;
    const r = computeForecastV4({
      asOf: ASOF,
      history: syntheticSeries(curve),
      polls: syntheticPolls(curve, [{ name: "Gamma", bias: 0 }]),
      startPct: 6.8,
      startIsObservation: true,
    });
    expect(r.diagnostics.stable15).toBe(false);
    expect(r.diagnostics.momentumNeutralized).toBe(false);
    expect(r.diagnostics.momentumPpMonth).toBeLessThan(-0.5);
    expect(factorPp(forecastHorizon(r, "base", "d30"), "momentum")).toBeLessThan(0);
  });

  it("pavimento convesso: un crollo forte viene frenato sopra lo zoccolo duro", () => {
    const curve = (d: number) => 6.9 - d * 0.05;
    const r = computeForecastV4({
      asOf: ASOF,
      history: syntheticSeries(curve),
      polls: syntheticPolls(curve, [{ name: "Gamma", bias: 0 }]),
      startPct: 6.9,
      startIsObservation: true,
    });
    const h = forecastHorizon(r, "base", "d180");
    expect(factorPp(h, "momentum")).toBeLessThan(-1);
    expect(factorPp(h, "bounds")).toBeGreaterThan(0);
    expect(h.centralPct).toBeGreaterThan(r.diagnostics.hardFloorPct);
    expect(h.lo10Pct).toBeGreaterThanOrEqual(r.diagnostics.hardFloorPct);
  });
});

describe("forecastEngineV4 · rete, istituzioni e «+ Simula»", () => {
  it("più comitati e tesserati alzano il fattore rete in tempo reale", () => {
    const base = computeForecastV4({ asOf: ASOF });
    const more = computeForecastV4({ asOf: ASOF, networkDelta: { comitati: 500, tesserati: 50_000 } });
    const less = computeForecastV4({ asOf: ASOF, networkDelta: { comitati: -500, tesserati: -50_000 } });
    expect(more.diagnostics.tesserati).toBe(base.diagnostics.tesserati + 50_000);
    expect(more.diagnostics.comitati).toBe(base.diagnostics.comitati + 500);
    base.base.horizons.forEach((h, i) => {
      const g = h.factors.find((f) => f.id === "ground")!.rawPp;
      expect(more.base.horizons[i]!.factors.find((f) => f.id === "ground")!.rawPp).toBeGreaterThan(g);
      expect(less.base.horizons[i]!.factors.find((f) => f.id === "ground")!.rawPp).toBeLessThan(g);
    });
  });

  it("i profili «+ Simula» e gli ingressi alzano il magnete istituzionale", () => {
    const base = computeForecastV4({ asOf: ASOF });
    const withProfiles = computeForecastV4({
      asOf: ASOF,
      profiles: [
        { id: "p1", nome: "Profilo 1", ruolo: "deputato", regione: "Lombardia", votiPortati: 40_000 },
      ],
    });
    const withIngressi = computeForecastV4({ asOf: ASOF, ingressi: { dep: 2, creg: 3, sind: 1 } });
    expect(withProfiles.diagnostics.simulatedEntryVotes).toBe(40_000);
    base.base.horizons.forEach((h, i) => {
      const m = h.factors.find((f) => f.id === "magnet")!.rawPp;
      expect(withProfiles.base.horizons[i]!.factors.find((f) => f.id === "magnet")!.rawPp).toBeGreaterThan(m);
      expect(withIngressi.base.horizons[i]!.factors.find((f) => f.id === "magnet")!.rawPp).toBeGreaterThan(m);
      expect(withProfiles.base.horizons[i]!.centralPct).toBeGreaterThanOrEqual(h.centralPct);
    });
    expect(forecastHorizon(withProfiles, "base", "d90").centralPct).toBeGreaterThan(
      forecastHorizon(base, "base", "d90").centralPct,
    );
  });
});

describe("forecastEngineV4 · ripartizione regionale", () => {
  const scenario = scenarioFile as unknown as ScenarioResult;

  it("le righe dello scenario diventano input regionale, con il sondaggio che prevale", () => {
    const first = scenario.righe[0]!;
    const regions = forecastRegionsFromScenario(scenario.righe, [
      { regione: first.regione, piHat: 0.1 },
    ]);
    expect(regions).toHaveLength(scenario.righe.length);
    expect(regions[0]!.sharePct).toBeCloseTo(10, 9);
    expect(regions[1]!.sharePct).toBeCloseTo(scenario.righe[1]!.stima * 100, 9);
    expect(regions.reduce((s, r) => s + r.tesserati, 0)).toBe(
      scenario.righe.reduce((s, r) => s + r.iscritti, 0),
    );
  });

  it("l'Offensiva aggiunge voti solo nelle Regioni Verdi, il Passivo resta sotto il Base", () => {
    const input: ForecastV4Input = {
      asOf: ASOF,
      regions: forecastRegionsFromScenario(scenario.righe),
    };
    const r = computeForecastV4(input);
    const base = forecastV4Regional(input, r, "d180", "base");
    const off = forecastV4Regional(input, r, "d180", "offensiva");
    const pas = forecastV4Regional(input, r, "d180", "passivo");
    const byRegion = new Map<Region, number>(base.map((x) => [x.regione, x.centralPct]));
    expect(off.some((x) => x.verde)).toBe(true);
    for (const x of off) {
      if (x.verde) expect(x.centralPct).toBeGreaterThan(byRegion.get(x.regione)!);
      else expect(x.centralPct).toBeCloseTo(byRegion.get(x.regione)!, 9);
    }
    const votes = (rows: typeof base) => rows.reduce((s, x) => s + x.addedVotes, 0);
    expect(votes(pas)).toBeLessThan(votes(base));
    expectAllFinite(off);
  });

  it("il Lazio a +30g non satura la Terra per poche centinaia di voti", () => {
    const input: ForecastV4Input = {
      asOf: ASOF,
      startPct: 7.2,
      regions: forecastRegionsFromScenario(scenario.righe),
      comitati: scenario.parametri.comitati,
    };
    const result = computeForecastV4(input);
    const lazio = forecastV4Regional(input, result, "d30", "base").find((row) => row.regione === "Lazio");
    expect(lazio).toBeDefined();
    expect(lazio!.addedVotes).toBeLessThan(5000);
    expect(lazio!.reachSaturation).toBeLessThan(0.55);
    expect(lazio!.reachSaturation).toBeGreaterThanOrEqual(0);
  });
});

describe("forecastEngineV4 · backtest walk-forward", () => {
  it("gira sulla serie statica con numeri finiti e righe ordinate nel tempo", () => {
    const bt = walkForwardBacktestV4();
    expect(bt.n).toBeGreaterThan(0);
    expect(bt.rows).toHaveLength(bt.n);
    for (const v of [bt.maeV4, bt.maeFlat, bt.maeSlope]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(bt.coverage80).toBeGreaterThanOrEqual(0);
    expect(bt.coverage80).toBeLessThanOrEqual(1);
    for (const row of bt.rows) {
      expect(row.origin < row.target).toBe(true);
      expect(row.lo10Pct).toBeLessThanOrEqual(row.v4Pct);
      expect(row.hi90Pct).toBeGreaterThanOrEqual(row.v4Pct);
    }
  });
});

describe("forecastEngineV4 · date serializzate JSON", () => {
  it("computeForecastV4 non crasha se asOf arriva come stringa dopo JSON.roundtrip", () => {
    const raw = {
      asOf: ASOF,
      startPct: 6.59,
      networkDelta: { comitati: 50, tesserati: 5_000 },
    } satisfies ForecastV4Input;
    const serialized = JSON.parse(JSON.stringify(raw)) as ForecastV4Input;
    expect(typeof serialized.asOf).toBe("string");
    const live = computeForecastV4(raw);
    const revived = computeForecastV4(serialized);
    expect(revived.asOf).toBe(live.asOf);
    expect(Number.isFinite(revived.startPct)).toBe(true);
    expect(Number.isFinite(forecastHorizon(revived, "base", "d180").centralPct)).toBe(true);
  });
});
