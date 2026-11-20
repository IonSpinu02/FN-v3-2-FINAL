import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import { buildVannacciStrategicDirective } from "@/lib/engine/vannacciDirective";

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
  const passivo = make("passivo", 6.8);
  const base = make("base", 7.2);
  const offensiva = make("offensiva", 7.5);
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: "2026-11-11",
    startPct: 6.62,
    startSource: "input",
    diagnostics: {} as ForecastV4Result["diagnostics"],
    scenarios: { passivo, base, offensiva },
    base,
  };
}

function regions(): BackcastRegionInput[] {
  return REGIONS.map((region) => ({
    region,
    validVoters: region === "Lombardia" ? 7_400_000 : 1_200_000,
    currentSharePct: 6.62,
    priority: 70,
    affinity: 75,
    macroArea: macroAreaOf(region),
    cdxSharePct: 46,
    abstentionPct: 16,
    themePressure: 0.6,
    members: 2000,
    committees: 40,
    localElected: 8,
  }));
}

function plan(targetPct: number, horizonDays: 30 | 90 | 180 | 360) {
  return computeStrategicBackcast({
    forecast: model(),
    targetPct,
    horizonDays,
    regions: regions(),
    currentMembers: 156_456,
    currentCommittees: 1800,
    seed: 4,
  });
}

describe("buildVannacciStrategicDirective", () => {
  it("risponde in tre mosse e tiene il lessico operativo", () => {
    const low = buildVannacciStrategicDirective(plan(8, 180));
    const mid = buildVannacciStrategicDirective(plan(9.5, 180));
    const high = buildVannacciStrategicDirective(plan(12, 360));
    expect(low.scale).toContain("8,0%");
    expect(low.scale).toContain("180 giorni");
    expect(low.equation.toLowerCase()).toContain("sicurezza urbana");
    expect(low.moves).toHaveLength(3);
    expect(low.moves[0]).toContain("70%");
    expect(mid.equation.toLowerCase()).toContain("temi-ponte");
    expect(["Espansione", "Mobilitazione Straordinaria", "Sfondamento di Sistema"]).toContain(mid.phase);
    expect(high.scale).toContain("12,0%");
    expect(high.scale).toContain("360 giorni");
    expect(high.equation.toLowerCase()).toContain("radicamento fisico");
    expect(high.moves[2]).toContain("comitati/mese");
    const banned = [/Conv\.\s*\d/, /Interesse Google \(30[gG]\)/, /Cosa cercano su Google/];
    for (const directive of [low, mid, high]) {
      const text = `${directive.scale} ${directive.equation} ${directive.moves.join(" ")} ${directive.residual ?? ""}`;
      for (const rule of banned) expect(text).not.toMatch(rule);
      expect(directive.phase.length).toBeGreaterThan(0);
    }
  });
});
