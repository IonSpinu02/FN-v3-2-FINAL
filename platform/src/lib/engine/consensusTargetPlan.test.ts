import { describe, expect, it } from "vitest";
import type {
  ForecastFactorId,
  ForecastFactorRow,
  ForecastHorizonResult,
  ForecastScenarioId,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { FORECAST_V4_MODEL_ID } from "@/lib/engine/forecastEngineV4";
import {
  ACTIONABLE_FACTOR_IDS,
  NON_ACTIONABLE_FACTOR_IDS,
  TARGET_BAND_INSIDE,
  TARGET_BAND_OUTSIDE,
  TARGET_METHOD_NOTE,
  buildConsensusTargetPlan,
} from "@/lib/engine/consensusTargetPlan";

const SHORT: Record<ForecastFactorId, string> = {
  momentum: "Sondaggi",
  agenda: "Temi",
  donor: "Delusi FdI-Lega",
  ground: "Tesserati",
  magnet: "Eletti",
  cycle: "Calendario",
  bounds: "Limiti",
};

function factor(id: ForecastFactorId, pp: number): ForecastFactorRow {
  return {
    id,
    n: 1,
    label: SHORT[id],
    short: SHORT[id],
    pp,
    rawPp: pp,
    note: "",
    plain: "",
    provenance: "dati",
    sources: [],
    sub: [],
  };
}

function horizon(
  key: "d30" | "d90" | "d180",
  centralPct: number,
  hi90Pct: number,
  weights: Record<ForecastFactorId, number>,
): ForecastHorizonResult {
  return {
    key,
    label: key === "d30" ? "30 giorni" : key === "d90" ? "90 giorni" : "180 giorni",
    days: key === "d30" ? 30 : key === "d90" ? 90 : 180,
    startPct: 6.5,
    centralPct,
    deltaPp: centralPct - 6.5,
    lo10Pct: centralPct - 0.4,
    hi90Pct,
    sigma: { poll: 0.2, hist: 0.1, model: 0.2, total: 0.3 },
    factors: (Object.keys(SHORT) as ForecastFactorId[]).map((id) => factor(id, weights[id])),
    uncertaintyNote: "",
    uncertaintyPlain: "",
  };
}

function forecast(input: {
  passivo: number;
  base: number;
  offensiva: number;
  hi90: number;
  weights: Record<ForecastFactorId, number>;
}): ForecastV4Result {
  const make = (id: ForecastScenarioId, central: number, hi: number) => ({
    id,
    label: id,
    tagline: id,
    horizons: (["d30", "d90", "d180"] as const).map((key) =>
      horizon(key, central, hi, input.weights),
    ),
  });
  const passivo = make("passivo", input.passivo, input.passivo + 0.4);
  const base = make("base", input.base, input.base + 0.5);
  const offensiva = make("offensiva", input.offensiva, input.hi90);
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.5,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo, base, offensiva },
    base,
  };
}

const WEIGHTS: Record<ForecastFactorId, number> = {
  momentum: 0.2,
  agenda: 0.1,
  donor: 0.1,
  ground: 0.05,
  magnet: 0.04,
  cycle: 0.08,
  bounds: -0.03,
};

function hypothesisSum(plan: ReturnType<typeof buildConsensusTargetPlan>): number {
  return ACTIONABLE_FACTOR_IDS.reduce((sum, id) => {
    return sum + (plan.levers.find((line) => line.id === id)?.hypothesisPp ?? 0);
  }, 0);
}

describe("buildConsensusTargetPlan", () => {
  const baseForecast = forecast({
    passivo: 7,
    base: 8,
    offensiva: 9,
    hi90: 10.2,
    weights: WEIGHTS,
  });

  it("copre il bersaglio anche restando nel Passivo", () => {
    const plan = buildConsensusTargetPlan(baseForecast, { targetPct: 6.8, horizon: "d180" });
    expect(plan.regimeId).toBe("passivo");
    expect(plan.gapPct).toBe(0);
    expect(plan.bandNote).toBeNull();
    expect(plan.equalFallback).toBe(false);
    expect(plan.startPct).toBe(6.5);
    expect(hypothesisSum(plan)).toBe(0);
  });

  it("tra Base e Offensiva esegue l'Offensiva senza buco", () => {
    const plan = buildConsensusTargetPlan(baseForecast, { targetPct: 8.5, horizon: "d180" });
    expect(plan.regimeId).toBe("offensiva");
    expect(plan.gapPct).toBe(0);
    expect(plan.bandNote).toBeNull();
    expect(plan.modelPct).toBe(8.5);
  });

  it("tra centrale Offensiva e hi90 segna la fascia già calcolata", () => {
    const plan = buildConsensusTargetPlan(baseForecast, { targetPct: 9.4, horizon: "d90" });
    expect(plan.regimeId).toBe("offensiva");
    expect(plan.gapPct).toBeCloseTo(0.4, 10);
    expect(plan.bandNote).toBe(TARGET_BAND_INSIDE);
    expect(hypothesisSum(plan)).toBe(plan.gapPct);
  });

  it("sopra hi90 segna il fuori fascia", () => {
    const plan = buildConsensusTargetPlan(baseForecast, { targetPct: 11, horizon: "d30" });
    expect(plan.gapPct).toBe(2);
    expect(plan.bandNote).toBe(TARGET_BAND_OUTSIDE);
    expect(plan.methodNote).toBe(TARGET_METHOD_NOTE);
    expect(hypothesisSum(plan)).toBe(plan.gapPct);
  });

  it("chiude il buco al centesimo e lascia a zero le leve non azionabili", () => {
    for (const targetPct of [9.29, 10.13]) {
      const plan = buildConsensusTargetPlan(baseForecast, { targetPct, horizon: "d180" });
      expect(hypothesisSum(plan)).toBe(plan.gapPct);
      for (const id of NON_ACTIONABLE_FACTOR_IDS) {
        expect(plan.levers.find((line) => line.id === id)?.hypothesisPp).toBe(0);
      }
    }
    const awkward = buildConsensusTargetPlan(baseForecast, { targetPct: 9.29, horizon: "d180" });
    expect(awkward.gapPct).toBeCloseTo(0.29, 10);
    const wider = buildConsensusTargetPlan(baseForecast, { targetPct: 10.13, horizon: "d180" });
    expect(wider.gapPct).toBeCloseTo(1.13, 10);
  });

  it("divide in parti uguali quando le quattro leve sono a zero", () => {
    const flat = forecast({
      passivo: 7,
      base: 8,
      offensiva: 9,
      hi90: 9.4,
      weights: {
        momentum: 0.4,
        agenda: 0,
        donor: -0.2,
        ground: 0,
        magnet: 0,
        cycle: 0.1,
        bounds: 0,
      },
    });
    const plan = buildConsensusTargetPlan(flat, { targetPct: 10.13, horizon: "d180" });
    expect(plan.equalFallback).toBe(true);
    expect(plan.equalFallbackNote).toMatch(/parti uguali/);
    expect(hypothesisSum(plan)).toBe(plan.gapPct);
    const shares = ACTIONABLE_FACTOR_IDS.map(
      (id) => plan.levers.find((line) => line.id === id)?.hypothesisPp ?? 0,
    );
    expect(shares[3]).toBe(plan.gapPct - shares[0]! - shares[1]! - shares[2]!);
    expect(plan.levers.find((line) => line.id === "momentum")?.hypothesisPp).toBe(0);
  });

  it("non muta il ForecastV4Result né i centrali", () => {
    const before = structuredClone(baseForecast);
    const offensivaBefore = before.scenarios.offensiva.horizons.map((row) => row.centralPct);
    buildConsensusTargetPlan(baseForecast, { targetPct: 12.37, horizon: "d180" });
    expect(baseForecast).toEqual(before);
    expect(baseForecast.scenarios.offensiva.horizons.map((row) => row.centralPct)).toEqual(
      offensivaBefore,
    );
    expect(baseForecast.scenarios.passivo.horizons[2]?.centralPct).toBe(7);
    expect(baseForecast.scenarios.base.horizons[2]?.centralPct).toBe(8);
    expect(baseForecast.scenarios.offensiva.horizons[2]?.hi90Pct).toBe(10.2);
  });
});
