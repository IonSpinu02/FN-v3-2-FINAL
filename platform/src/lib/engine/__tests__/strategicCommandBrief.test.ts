import { describe, expect, it } from "vitest";
import { REGIONS } from "@/lib/engine/constants";
import { FORECAST_V4_MODEL_ID, type ForecastHorizonResult, type ForecastScenarioId, type ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { computeStrategicBackcast, macroAreaOf, type BackcastRegionInput } from "@/lib/engine/strategicBackcastEngine";
import {
  NATIONAL_VALID_BALLOTS,
  buildStrategicCommandBrief,
  parliamentSeatRange,
  strategicTierLabel,
} from "@/lib/engine/strategicCommandBrief";

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
  const base = make("base", 7.1);
  const offensiva = make("offensiva", 7.52);
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
    validVoters: region === "Lombardia" ? 4_200_000 : 1_000_000,
    currentSharePct: region === "Calabria" ? 11.2 : 6.62,
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

describe("strategicCommandBrief", () => {
  it("costruisce payout e tre fasi, con i seggi marcati come ipotesi", () => {
    expect(NATIONAL_VALID_BALLOTS).toBe(23_257_062);
    expect(strategicTierLabel(7.4)).toBe("Presidio Identitario");
    expect(strategicTierLabel(9)).toBe("Forza Determinante");
    expect(strategicTierLabel(10.5)).toBe("Doppia Cifra · Perno Coalizione");
    expect(strategicTierLabel(12)).toBe("Polo Egemonico");
    expect(parliamentSeatRange(10)).toEqual([25, 35]);
    const result = computeStrategicBackcast({
      forecast: model(),
      targetPct: 10,
      horizonDays: 180,
      regions: regions(),
      currentMembers: 156_456,
      currentCommittees: 1_800,
      totalValidVoters: NATIONAL_VALID_BALLOTS,
      seed: 5,
    });
    const brief = buildStrategicCommandBrief(result, NATIONAL_VALID_BALLOTS);
    expect(brief.payout.label).toBe("IPOTESI");
    expect(brief.payout.validBallots).toBe(NATIONAL_VALID_BALLOTS);
    expect(brief.payout.projectedTotalVotes).toBe(Math.round(0.1 * NATIONAL_VALID_BALLOTS));
    expect(brief.payout.netNewVotesFromToday).toBe(result.totalDeltaVotes);
    expect(brief.payout.strategicTierLabel).toBe("Doppia Cifra · Perno Coalizione");
    expect(brief.payout.regionsAboveDoubleDigit.today).toBeGreaterThanOrEqual(1);
    expect(brief.payout.regionsAboveDoubleDigit.atTarget).toBeGreaterThanOrEqual(brief.payout.regionsAboveDoubleDigit.today);
    expect(brief.phases.map((phase) => phase.id)).toEqual([1, 2, 3]);
    expect(brief.phases[0]?.toDay).toBe(60);
    expect(brief.phases[2]?.toDay).toBe(180);
    expect(brief.phases[0]?.action.length).toBeGreaterThan(8);
    const year = buildStrategicCommandBrief(
      computeStrategicBackcast({
        forecast: model(),
        targetPct: 12,
        horizonDays: 360,
        regions: regions(),
        currentMembers: 156_456,
        currentCommittees: 1_800,
        totalValidVoters: NATIONAL_VALID_BALLOTS,
        seed: 5,
      }),
    );
    expect(year.phases[2]?.toDay).toBe(360);
    expect(year.payout.strategicTierLabel).toBe("Polo Egemonico");
    const text = JSON.stringify(brief);
    expect(text).not.toMatch(/Conv\.\s*\d/);
    expect(text).not.toMatch(/Interesse Google/);
  });
});