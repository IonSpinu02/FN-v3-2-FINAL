import { describe, expect, it } from "vitest";
import {
  clearGeneratedStrategicPlan,
  parseGeneratedStrategicPlan,
  readGeneratedStrategicPlan,
  writeGeneratedStrategicPlan,
  type GeneratedStrategicPlan,
} from "@/lib/strategy/generatedStrategicPlan";
import { buildOperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import { buildStrategicCommandBrief } from "@/lib/engine/strategicCommandBrief";

function horizon(key: "d30" | "d90" | "d180", central: number): ForecastHorizonResult {
  return {
    key,
    label: key,
    days: key === "d30" ? 30 : key === "d90" ? 90 : 180,
    startPct: 6.62,
    centralPct: central,
    deltaPp: central - 6.62,
    lo10Pct: central - 0.3,
    hi90Pct: central + 0.4,
    sigma: { poll: 0.1, hist: 0.1, model: 0.1, total: 0.2 },
    factors: [],
    uncertaintyNote: "",
    uncertaintyPlain: "",
  };
}

function model(): ForecastV4Result {
  const make = (id: ForecastScenarioId, central: number) => ({
    id,
    label: id,
    tagline: id,
    horizons: (["d30", "d90", "d180"] as const).map((key) => horizon(key, central)),
  });
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.62,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo: make("passivo", 6.8), base: make("base", 7.1), offensiva: make("offensiva", 7.52) },
    base: make("base", 7.1),
  };
}

function regions(): BackcastRegionInput[] {
  return REGIONS.map((region) => ({
    region,
    validVoters: 1_000_000,
    currentSharePct: 6.62,
    priority: 70,
    affinity: 74,
    macroArea: macroAreaOf(region),
    cdxSharePct: 46,
    abstentionPct: 18,
    themePressure: 0.62,
    members: 2000,
    committees: 30,
    localElected: 6,
  }));
}

function samplePlan(): GeneratedStrategicPlan {
  const plan = computeStrategicBackcast({
    forecast: model(),
    targetPct: 10.5,
    horizonDays: 180,
    regions: regions(),
    currentMembers: 156_456,
    currentCommittees: 1_800,
    totalValidVoters: 23_257_062,
    seed: 3,
  });
  return {
    targetPct: 10.5,
    horizonDays: 180,
    plan,
    brief: buildStrategicCommandBrief(plan, 23_257_062),
    roadmap: buildOperationalRoadmap(plan, 180),
    ballots: 23_257_062,
    floor: 6.6,
    savedAt: "2026-11-12T08:00:00.000Z",
  };
}

function memory(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    key: (index) => [...data.keys()][index] ?? null,
  };
}

describe("generatedStrategicPlan", () => {
  it("modella la transizione INTAKE -> PLAN_READY tramite persistenza", () => {
    const store = memory();
    expect(readGeneratedStrategicPlan(store)).toBeNull();
    const plan = samplePlan();
    writeGeneratedStrategicPlan(plan, store);
    const loaded = readGeneratedStrategicPlan(store);
    expect(loaded?.targetPct).toBe(10.5);
    expect(loaded?.horizonDays).toBe(180);
    expect(loaded?.roadmap.stages).toHaveLength(4);
    expect(loaded?.roadmap.executiveThesis.length).toBeGreaterThan(10);
    clearGeneratedStrategicPlan(store);
    expect(readGeneratedStrategicPlan(store)).toBeNull();
  });

  it("scarta payload incompleti", () => {
    expect(parseGeneratedStrategicPlan({ targetPct: 12 })).toBeNull();
    expect(parseGeneratedStrategicPlan(null)).toBeNull();
  });
});
