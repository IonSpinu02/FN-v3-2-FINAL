import { describe, expect, it } from "vitest";
import { CIRC, REGIONS, type Region } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import {
  macroAreaOf,
  type BackcastRegionInput,
  type BridgeTheme,
  type MacroArea,
  computeStrategicBackcast,
} from "@/lib/engine/strategicBackcastEngine";

const THEME_OF: Record<MacroArea, BridgeTheme> = {
  "Nord-Ovest": "Sicurezza",
  "Nord-Est": "Energia PMI",
  Centro: "Casa/Mutui",
  Sud: "Liste d'attesa Sanità",
  Isole: "Trasporti/Flussi",
};

const VOTERS: Record<Region, number> = {
  Piemonte: 3_200_000,
  "Valle d'Aosta": 90_000,
  Liguria: 1_100_000,
  Lombardia: 7_400_000,
  "Trentino-Alto Adige": 790_000,
  Veneto: 3_600_000,
  "Friuli-Venezia Giulia": 880_000,
  "Emilia-Romagna": 3_250_000,
  Toscana: 2_700_000,
  Umbria: 640_000,
  Marche: 1_100_000,
  Lazio: 4_200_000,
  Abruzzo: 960_000,
  Molise: 220_000,
  Campania: 4_000_000,
  Puglia: 2_900_000,
  Basilicata: 400_000,
  Calabria: 1_350_000,
  Sicilia: 3_400_000,
  Sardegna: 1_180_000,
};

function areaOf(region: Region): MacroArea {
  return macroAreaOf(region);
}

function regionsAt(sharePct: number): BackcastRegionInput[] {
  return REGIONS.map((region) => {
    const macroArea = areaOf(region);
    const big = VOTERS[region] > 2_000_000;
    return {
      region,
      validVoters: VOTERS[region],
      currentSharePct: sharePct,
      priority: big ? 72 : region === "Molise" || region === "Valle d'Aosta" ? 28 : 55,
      affinity: region === "Veneto" ? 92 : region === "Lombardia" ? 80 : big ? 70 : 42,
      macroArea,
      cdxSharePct: big ? 48 : 36,
      abstentionPct: 14,
      themePressure: big ? 0.72 : 0.4,
      members: Math.round(VOTERS[region] / 80),
      committees: big ? 180 : region === "Molise" || region === "Valle d'Aosta" ? 3 : 40,
      localElected: big ? 35 : 4,
      primaryTheme: THEME_OF[macroArea],
    };
  });
}

function horizon(key: "d30" | "d90" | "d180", central: number, hi90: number, start: number): ForecastHorizonResult {
  return {
    key,
    label: key,
    days: key === "d30" ? 30 : key === "d90" ? 90 : 180,
    startPct: start,
    centralPct: central,
    deltaPp: central - start,
    lo10Pct: central - 0.4,
    hi90Pct: hi90,
    sigma: { poll: 0.2, hist: 0.1, model: 0.2, total: 0.3 },
    factors: [],
    uncertaintyNote: "",
    uncertaintyPlain: "",
  };
}

function forecast(start: number, passive: number, base: number, offensive: number, hi90: number): ForecastV4Result {
  const make = (id: ForecastScenarioId, central: number, upper: number) => ({
    id,
    label: id,
    tagline: id,
    horizons: (["d30", "d90", "d180"] as const).map((key) => horizon(key, central, upper, start)),
  });
  const passivo = make("passivo", passive, passive + 0.3);
  const baseRow = make("base", base, base + 0.4);
  const offensiva = make("offensiva", offensive, hi90);
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: start,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo, base: baseRow, offensiva },
    base: baseRow,
  };
}

function electorate(rows: BackcastRegionInput[]): number {
  return rows.reduce((sum, row) => sum + row.validVoters, 0);
}

function national(result: ReturnType<typeof computeStrategicBackcast>, rows: BackcastRegionInput[]): number {
  const total = electorate(rows);
  const votes = result.regions.reduce((sum, plan) => {
    const voters = rows.find((row) => row.region === plan.region)!.validVoters;
    return sum + (plan.targetPct / 100) * voters;
  }, 0);
  return (votes / total) * 100;
}

describe("computeStrategicBackcast", () => {
  it("non muta il ForecastV4Result e azzera il surplus dentro il modello", () => {
    const model = forecast(6.2, 6.4, 7.1, 8.2, 8.8);
    const before = structuredClone(model);
    const rows = regionsAt(6.2);
    const voters = electorate(rows);
    const atBase = computeStrategicBackcast({
      forecast: model,
      targetPct: 7.1,
      horizonDays: 180,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: voters,
    });
    const atOffensive = computeStrategicBackcast({
      forecast: model,
      targetPct: 8.2,
      horizonDays: 180,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: voters,
    });
    expect(model).toEqual(before);
    expect(atBase.netSurplusVotes).toBe(0);
    expect(atBase.netSurplusPct).toBe(0);
    expect(atOffensive.netSurplusVotes).toBe(0);
    expect(atOffensive.regime).toBe("ESECUZIONE_OFFENSIVA_V4");
    expect(atBase.epistemic.currentPct).toBe("MISURATO");
    expect(atBase.epistemic.modelAnchors).toBe("STIMA MODELLO");
    expect(atBase.epistemic.surplus).toBe("IPOTESI");
  });

  it("conserva i voti e rispetta il tetto regionale", () => {
    const model = forecast(6.2, 6.4, 7.0, 7.6, 8.4);
    const rows = regionsAt(6.2);
    const voters = electorate(rows);
    const result = computeStrategicBackcast({
      forecast: model,
      targetPct: 8.4,
      horizonDays: 180,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: voters,
    });
    expect(result.targetPct).toBeLessThanOrEqual(result.maxEndogenousPct);
    expect(Math.abs(national(result, rows) - 8.4)).toBeLessThan(0.01);
    for (const plan of result.regions) {
      expect(plan.targetPct).toBeLessThanOrEqual(plan.ceilingPct + 1e-6);
    }
  });

  it("cresce in modo monotono nello sforzo e cala nella probabilità", () => {
    const model = forecast(6.0, 6.15, 6.35, 6.55, 7.1);
    const rows = regionsAt(6.0);
    const voters = electorate(rows);
    const points = [];
    for (let target = 6.8; target <= 11.0001; target = Math.round((target + 0.1) * 10) / 10) {
      points.push(
        computeStrategicBackcast({
          forecast: model,
          targetPct: target,
          horizonDays: 180,
          regions: rows,
          currentMembers: 150_000,
          currentCommittees: 2_000,
          totalValidVoters: voters,
          seed: 7,
        }),
      );
    }
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1]!;
      const next = points[i]!;
      expect(next.totalDeltaVotes).toBeGreaterThan(prev.totalDeltaVotes);
      expect(next.klEffort).toBeGreaterThan(prev.klEffort);
      expect(next.successProbability).toBeLessThanOrEqual(prev.successProbability + 1e-12);
    }
  });

  it("a 180 giorni alza il tetto e il peso del radicamento rispetto a 30", () => {
    const model = forecast(6.2, 6.4, 6.9, 7.4, 8.2);
    const rows = regionsAt(6.2);
    const voters = electorate(rows);
    const common = {
      forecast: model,
      targetPct: 9,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: voters,
      seed: 11,
    };
    const short = computeStrategicBackcast({ ...common, horizonDays: 30 });
    const long = computeStrategicBackcast({ ...common, horizonDays: 180 });
    expect(long.maxEndogenousPct).toBeGreaterThan(short.maxEndogenousPct);
    expect(long.groundingShare).toBeGreaterThan(short.groundingShare);
  });

  it("concentra un surplus moderato e non apre un fronte primario su Molise o Valle d'Aosta", () => {
    const model = forecast(6.2, 6.5, 7.2, 8.0, 8.7);
    const rows = regionsAt(6.2);
    const result = computeStrategicBackcast({
      forecast: model,
      targetPct: 8.4,
      horizonDays: 180,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: electorate(rows),
    });
    expect(result.activeFronts).toBeGreaterThan(0);
    expect(result.activeFronts).toBeLessThan(20);
    const molise = result.regions.find((row) => row.region === "Molise")!;
    const aosta = result.regions.find((row) => row.region === "Valle d'Aosta")!;
    expect(molise.role).not.toBe("FRONTE_PRIORITARIO");
    expect(aosta.role).not.toBe("FRONTE_PRIORITARIO");
  });

  it("satura oltre la frontiera endogena senza produrre valori non finiti", () => {
    const model = forecast(6.2, 6.5, 7.2, 8.0, 8.8);
    const rows = regionsAt(6.2);
    const result = computeStrategicBackcast({
      forecast: model,
      targetPct: 18,
      horizonDays: 90,
      regions: rows,
      currentMembers: 150_000,
      currentCommittees: 2_000,
      totalValidVoters: electorate(rows),
    });
    expect(result.feasibilityBand).toBe("SHOCK_ESOGENO_RICHIESTO");
    expect(result.regime).toBe("OLTRE_FRONTIERA_ENDOGENA");
    expect(Number.isFinite(result.achievablePct)).toBe(true);
    expect(Number.isFinite(result.cvar10)).toBe(true);
    expect(result.maxEndogenousPct).toBeLessThan(18);
    expect(result.exogenousGapPct).toBeCloseTo(18 - result.maxEndogenousPct, 8);
    expect(result.achievablePct).toBeLessThanOrEqual(result.maxEndogenousPct + 0.05);
  });

  it("è deterministico e resta sotto i 25ms", () => {
    const model = forecast(6.2, 6.5, 7.1, 7.8, 8.5);
    const rows = regionsAt(6.2);
    const call = () =>
      computeStrategicBackcast({
        forecast: model,
        targetPct: 9.2,
        horizonDays: 180,
        regions: rows,
        currentMembers: 150_000,
        currentCommittees: 2_000,
        totalValidVoters: electorate(rows),
        seed: 99,
      });
    const first = call();
    const second = call();
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const started = performance.now();
    call();
    expect(performance.now() - started).toBeLessThan(25);
  });

  it("a 360 giorni alza la frontiera e scandisce l'anno, anche sul 12%", () => {
    const model = forecast(6.2, 6.4, 6.9, 7.4, 8.2);
    const rows = regionsAt(6.2);
    const common = {
      forecast: model,
      targetPct: 12,
      regions: rows,
      currentMembers: 156_456,
      currentCommittees: 2_000,
      totalValidVoters: electorate(rows),
      seed: 12,
    };
    const half = computeStrategicBackcast({ ...common, horizonDays: 180 });
    const year = computeStrategicBackcast({ ...common, horizonDays: 360 });
    expect(year.maxEndogenousPct).toBeGreaterThan(half.maxEndogenousPct);
    expect(year.checkpoints.map((point) => point.day)).toEqual([30, 90, 180, 270, 360]);
    expect(year.checkpoints[4]!.expectedPct).toBeGreaterThan(year.checkpoints[0]!.expectedPct);
    for (const point of year.checkpoints) {
      expect(Number.isFinite(point.expectedPct)).toBe(true);
      expect(Number.isFinite(point.minOnTrackPct)).toBe(true);
    }
    const votesOf = (region: string) => year.regions.find((row) => row.region === region)!.addedVotes;
    const reservoirs = ["Lombardia", "Veneto", "Lazio", "Piemonte", "Sicilia", "Campania", "Puglia", "Emilia-Romagna", "Toscana", "Calabria"];
    const reservoirVotes = reservoirs.reduce((sum, region) => sum + votesOf(region), 0);
    expect(reservoirVotes).toBeGreaterThan(votesOf("Molise") + votesOf("Valle d'Aosta"));
    expect(votesOf("Lombardia")).toBeGreaterThan(votesOf("Molise"));
    expect(year.exogenousGapPct).toBeGreaterThanOrEqual(0);
    expect(year.achievablePct).toBeLessThanOrEqual(year.maxEndogenousPct + 0.05);
    expect(Number.isFinite(year.cvar10)).toBe(true);
    if (year.targetPct > year.maxEndogenousPct) {
      expect(year.feasibilityBand).toBe("SHOCK_ESOGENO_RICHIESTO");
      expect(year.exogenousGapPct).toBeGreaterThan(0);
    }
  });

  it("usa i voti validi nazionali e apre più fronti con bacini diversi", () => {
    const validi = 23_257_062;
    const model = forecast(6.62, 6.8, 7.1, 7.52, 8.1);
    const rows = regionsAt(6.62);
    const result = computeStrategicBackcast({
      forecast: model,
      targetPct: 10,
      horizonDays: 180,
      regions: rows,
      currentMembers: 156_456,
      currentCommittees: 2_000,
      totalValidVoters: validi,
      seed: 10,
    });
    const expected = Math.round(((10 - 6.62) / 100) * validi);
    expect(result.totalDeltaVotes).toBe(expected);
    expect(result.totalDeltaVotes).toBeGreaterThan(700_000);
    expect(result.totalDeltaVotes).toBeLessThan(900_000);
    const fronts = result.regions.filter((row) => row.role === "FRONTE_PRIORITARIO");
    expect(fronts.length).toBeGreaterThanOrEqual(4);
    expect(fronts.length).toBeLessThanOrEqual(7);
    expect(fronts.some((row) => row.region === "Lombardia")).toBe(true);
    expect(result.regions.find((row) => row.region === "Molise")!.role).not.toBe("FRONTE_PRIORITARIO");
    expect(result.regions.find((row) => row.region === "Valle d'Aosta")!.role).not.toBe("FRONTE_PRIORITARIO");
    const primary = (region: string) => {
      const plan = result.regions.find((row) => row.region === region)!;
      return (Object.entries(plan.basins) as [string, number][]).sort((a, b) => b[1] - a[1])[0]![0];
    };
    const veneto = primary("Veneto");
    const sicilia = primary("Sicilia");
    expect(["voto_tematico_ponte", "delusi_coalizione"]).toContain(veneto);
    expect(["astensione_recuperabile", "voto_tematico_ponte"]).toContain(sicilia);
    expect(veneto).not.toBe(sicilia);
    const year = computeStrategicBackcast({ ...{
      forecast: model,
      targetPct: 12,
      horizonDays: 360 as const,
      regions: rows,
      currentMembers: 156_456,
      currentCommittees: 2_000,
      totalValidVoters: validi,
      seed: 12,
    } });
    expect(year.regions.filter((row) => row.role === "FRONTE_PRIORITARIO").length).toBeGreaterThanOrEqual(4);
  });

  it("conosce le cinque macro-aree del repository", () => {
    expect(macroAreaOf("Lombardia")).toBe("Nord-Ovest");
    expect(macroAreaOf("Veneto")).toBe("Nord-Est");
    expect(macroAreaOf("Lazio")).toBe("Centro");
    expect(macroAreaOf("Campania")).toBe("Sud");
    expect(macroAreaOf("Sicilia")).toBe("Isole");
    expect(CIRC.I).toContain("Sardegna");
  });
});
