import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import { toGoalViewModel } from "@/components/obiettivo/goalViewModel";

function horizon(key: "d30" | "d90" | "d180", central: number): ForecastHorizonResult {
  return {
    key,
    label: key,
    days: key === "d30" ? 30 : key === "d90" ? 90 : 180,
    startPct: 6.2,
    centralPct: central,
    deltaPp: central - 6.2,
    lo10Pct: central - 0.3,
    hi90Pct: central + 0.5,
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
  const passivo = make("passivo", 6.4);
  const base = make("base", 7);
  const offensiva = make("offensiva", 7.8);
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.2,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo, base, offensiva },
    base,
  };
}

describe("vista Piano Obiettivo", () => {
  it("mappa il risultato del motore sulle etichette della vista", () => {
    const regions: BackcastRegionInput[] = REGIONS.map((region) => ({
      region,
      validVoters: region === "Lombardia" ? 5_000_000 : 900_000,
      currentSharePct: 6.2,
      priority: 60,
      affinity: 70,
      macroArea: macroAreaOf(region),
      cdxSharePct: 45,
      abstentionPct: 14,
      themePressure: 0.5,
      members: 1000,
      committees: 20,
      localElected: 4,
    }));
    const result = computeStrategicBackcast({
      forecast: model(),
      targetPct: 8.5,
      horizonDays: 180,
      regions,
      currentMembers: 20_000,
      currentCommittees: 400,
      seed: 3,
    });
    const view = toGoalViewModel(result);
    expect(view.measuredLabel).toBe("MISURATO");
    expect(view.modelLabel).toBe("STIMA MODELLO");
    expect(view.hypothesisLabel).toBe("IPOTESI");
    expect(view.currentPct).toBe(result.currentPct);
    expect(view.offensivePct).toBe(result.offensiveCentral);
    expect(view.activeFronts).toBe(result.regions.filter((row) => row.role === "FRONTE_PRIORITARIO").length);
    expect(view.regions).toHaveLength(20);
    expect(view.surplusVotes).toBe(result.netSurplusVotes);
  });

  it("non introduce etichette bandite nella vista obiettivo", () => {
    const root = path.join(process.cwd(), "src", "components", "obiettivo");
    const banned = [/Conv\.\s*\d/, /Interesse Google \(30[gG]\)/, /Cosa cercano su Google/];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(tsx|ts)$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const rule of banned) if (rule.test(text)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });
});
