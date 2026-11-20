import { buildBackcastRegions } from "@/lib/engine/buildBackcastRegions";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import {
  computeForecastV4,
  forecastRegionsFromScenario,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { buildGrowthEvidence, seriesWithCurrentPoint } from "@/lib/engine/growthEvidence";
import { forecastInputFromProjection, REGIME_SENSITIVITY } from "@/lib/engine/growthTrajectory";
import type { Region } from "@/lib/engine/constants";
import { NATIONAL_VALID_BALLOTS } from "@/lib/engine/strategicCommandBrief";
import {
  computeStrategicBackcast,
  type HorizonDays,
  type StrategicBackcastResult,
} from "@/lib/engine/strategicBackcastEngine";
import type { ScenarioResult } from "@/lib/engine/types";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";

/** Stesso ingresso V4 di Scenario / Consenso nazionale: start da aggregato sondaggi, regioni da piHat. */
export function buildStrategicV4Input(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  poll: readonly { regione: Region; piHat: number }[] = [],
  asOf = new Date(),
): ForecastV4Input {
  const regions = forecastRegionsFromScenario(scenario.righe, poll);
  const anchor = computeForecastV4({
    asOf,
    flussi: flussiIpsos,
    regions,
    tesserati: scenario.parametri.iscritti_attribuiti,
    comitati: scenario.parametri.comitati,
  });
  const evidence = buildGrowthEvidence({
    series: seriesWithCurrentPoint(FN_SUPERMEDIA_CONSENSO_SERIES, anchor.startPct),
  });
  return forecastInputFromProjection(
    {
      startPct: anchor.startPct,
      evidence,
      sensitivity: REGIME_SENSITIVITY.organica,
      asOf,
      flussi: flussiIpsos,
      regions,
      comitati: scenario.parametri.comitati,
    },
    asOf,
  );
}

export function buildStrategicV4Forecast(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  poll: readonly { regione: Region; piHat: number }[] = [],
  asOf = new Date(),
): ForecastV4Result {
  return computeForecastV4(buildStrategicV4Input(scenario, flussiIpsos, poll, asOf));
}

export function runObiettivoStrategicBackcast(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  poll: readonly { regione: Region; piHat: number }[] = [],
  targetPct: number,
  horizonDays: HorizonDays,
): {
  plan: StrategicBackcastResult;
  forecast: ForecastV4Result;
  pack: ReturnType<typeof buildBackcastRegions>;
  ballots: number;
  safeTarget: number;
  floor: number;
} {
  const pack = buildBackcastRegions(scenario, poll);
  const forecast = buildStrategicV4Forecast(scenario, flussiIpsos, poll);
  const floor = Math.round(forecast.startPct * 10) / 10;
  const safeTarget = Math.min(20, Math.max(floor, targetPct));
  const ballots = scenario.parametri.validi2024 || NATIONAL_VALID_BALLOTS;
  const plan = computeStrategicBackcast({
    forecast,
    targetPct: safeTarget,
    horizonDays,
    regions: pack.regions,
    currentMembers: pack.currentMembers,
    currentCommittees: pack.currentCommittees,
    totalValidVoters: ballots,
  });
  return { plan, forecast, pack, ballots, safeTarget, floor };
}
