import { PythonRandom } from "./pythonDistributions";
import type { ScenarioResult, ScenarioRow } from "./types";
import {
  adjustPiHatForTurnout,
  classifyStatoTesseramento,
  classifyThresholdProbability,
  DEFAULT_POLL_CONFIG,
  resolveSampleSize,
  seModelFromMc,
  seSample,
  type RegionalPollConfig,
  type RegionPollResult,
} from "./regionalPollShared";

export {
  adjustPiHatForTurnout,
  classifyStatoTesseramento,
  classifyThresholdProbability,
  DEFAULT_POLL_CONFIG,
  resolveSampleSize,
  seModelFromMc,
  seSample,
  SD_SONDAGGIO_NAZIONALE,
} from "./regionalPollShared";

export type {
  ConfidenceLevel,
  RegionPollClass,
  RegionPollResult,
  RegionalPollConfig,
  SampleMode,
  StatoTesseramento,
} from "./regionalPollShared";

const Z_SCORE: Record<RegionalPollConfig["confidenceLevel"], number> = {
  0.9: 1.6448536269514722,
  0.95: 1.959963984540054,
  0.99: 2.5758293035489004,
};

export function simulateThresholdProbability(
  piHat: number,
  seTot: number,
  threshold: number,
  draws: number,
  seed: number,
): number {
  if (draws <= 0) return piHat >= threshold ? 1 : 0;
  const rng = new PythonRandom(seed);
  let hits = 0;
  for (let i = 0; i < draws; i++) {
    const draw = rng.gauss(piHat, seTot);
    if (draw >= threshold) hits += 1;
  }
  return hits / draws;
}

function decompositionShares(
  row: ScenarioRow,
  pesi: ScenarioResult["parametri"]["pesi"],
): {
  contribFlussi: number;
  contribPreferenze: number;
  contribIscritti: number;
  contribIstituzioni: number;
} {
  const mix =
    pesi.flussi * row.f +
    pesi.pref * row.v +
    pesi.isc * row.s +
    pesi.ist * row.m;
  if (mix <= 0) {
    return {
      contribFlussi: 0,
      contribPreferenze: 0,
      contribIscritti: 0,
      contribIstituzioni: 0,
    };
  }
  return {
    contribFlussi: (pesi.flussi * row.f) / mix,
    contribPreferenze: (pesi.pref * row.v) / mix,
    contribIscritti: (pesi.isc * row.s) / mix,
    contribIstituzioni: (pesi.ist * row.m) / mix,
  };
}

export function computeRegionalPoll(
  scenario: ScenarioResult,
  config: RegionalPollConfig = DEFAULT_POLL_CONFIG,
): RegionPollResult[] {
  const V = scenario.parametri.validi2024;
  const threshold = config.thresholdPct / 100;
  const z = Z_SCORE[config.confidenceLevel];
  const pesi = scenario.parametri.pesi;

  return scenario.righe.map((row, idx) => {
    const piHat = adjustPiHatForTurnout(
      row.stima,
      row.affluenza2024,
      config.turnoutDeltaPct,
    );
    const Nr = resolveSampleSize(row, V, config.sampleMode);
    const SE_sample = seSample(piHat, Nr, config.designEffect);
    const SE_model = seModelFromMc(row);
    const SE_tot = Math.sqrt(SE_model ** 2 + SE_sample ** 2);
    const moe = z * SE_tot;
    const icLow = Math.max(0, piHat - moe);
    const icHigh = Math.min(1, piHat + moe);

    const validiAttesi = Math.round(
      row.validi2024 * (1 + config.turnoutDeltaPct / 100),
    );
    const votiStimatiSondaggio = Math.round(piHat * validiAttesi);
    const votiSoglia = Math.round(
      (config.thresholdPct / 100) * validiAttesi,
    );
    const margineVotiSoglia = votiStimatiSondaggio - votiSoglia;
    const rapportoIscrittiFlussi = row.s / Math.max(1e-6, row.f);
    const votiPerIscritto =
      row.voti_di_scenario / Math.max(1, row.iscritti);
    const statoTesseramento = classifyStatoTesseramento(rapportoIscrittiFlussi);
    const votiAttesi = votiStimatiSondaggio;

    const seed = config.pollSeed + idx * 997;
    const probAboveThreshold = simulateThresholdProbability(
      piHat,
      SE_tot,
      threshold,
      config.pollDraws,
      seed,
    );

    const dec = decompositionShares(row, pesi);

    return {
      regione: row.regione,
      stimaBase: row.stima,
      piHat,
      Nr,
      SE_sample,
      SE_model,
      SE_tot,
      moe,
      icLow,
      icHigh,
      probAboveThreshold,
      classificazione: classifyThresholdProbability(probAboveThreshold),
      votiAttesi,
      validiAttesi,
      votiStimatiSondaggio,
      votiSoglia,
      margineVotiSoglia,
      rapportoIscrittiFlussi,
      votiPerIscritto,
      statoTesseramento,
      fdiShare2024: row.FdI2024 / row.validi2024,
      legaShare2024: row.Lega2024 / row.validi2024,
      scartoVsBenchmark: piHat - row.benchmark,
      ...dec,
    };
  });
}
