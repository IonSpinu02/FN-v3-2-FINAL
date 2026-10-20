import { REGIONS, type Region } from "./constants";
import { PythonRandom } from "./pythonDistributions";
import type { ScenarioResult, ScenarioRow } from "./types";

export type SampleMode =
  | "fixed600"
  | "fixed1000"
  | "fixed2000"
  | "proportional";

export type ConfidenceLevel = 0.9 | 0.95 | 0.99;

export type RegionPollClass = "sicura" | "contesa" | "critica";

export interface RegionalPollConfig {
  sampleMode: SampleMode;
  confidenceLevel: ConfidenceLevel;
  designEffect: number;
  /** Soglia di sbarramento in punti percentuali (es. 3.0 = 3%) */
  thresholdPct: number;
  /** Variazione affluenza vs EU 2024, in punti percentuali */
  turnoutDeltaPct: number;
  pollSeed: number;
  pollDraws: number;
}

export const DEFAULT_POLL_CONFIG: RegionalPollConfig = {
  sampleMode: "fixed1000",
  confidenceLevel: 0.95,
  designEffect: 1.15,
  thresholdPct: 3.0,
  turnoutDeltaPct: 0,
  pollSeed: 42,
  pollDraws: 10_000,
};

export type StatoTesseramento =
  | "equilibrato"
  | "da_strutturare"
  | "anomalia_tessere";

export interface RegionPollResult {
  regione: Region;
  stimaBase: number;
  piHat: number;
  Nr: number;
  SE_sample: number;
  SE_model: number;
  SE_tot: number;
  moe: number;
  icLow: number;
  icHigh: number;
  probAboveThreshold: number;
  classificazione: RegionPollClass;
  votiAttesi: number;
  validiAttesi: number;
  votiStimatiSondaggio: number;
  votiSoglia: number;
  margineVotiSoglia: number;
  rapportoIscrittiFlussi: number;
  votiPerIscritto: number;
  statoTesseramento: StatoTesseramento;
  fdiShare2024: number;
  legaShare2024: number;
  scartoVsBenchmark: number;
  contribFlussi: number;
  contribPreferenze: number;
  contribIscritti: number;
  contribIstituzioni: number;
}

export function classifyStatoTesseramento(
  rapportoIscrittiFlussi: number,
): StatoTesseramento {
  if (rapportoIscrittiFlussi > 1.35) return "anomalia_tessere";
  if (rapportoIscrittiFlussi < 0.7) return "da_strutturare";
  return "equilibrato";
}

const Z_SCORE: Record<ConfidenceLevel, number> = {
  0.9: 1.6448536269514722,
  0.95: 1.959963984540054,
  0.99: 2.5758293035489004,
};

/** Normal approx.: distanza 10°–90° percentile ≈ 2.563σ */
const P10_P90_SIGMA = 2.563;

/** Allineato a `config_v3_2.json` → monte_carlo.sd_sondaggio (fast-path SE_model). */
export const SD_SONDAGGIO_NAZIONALE = 0.012;

export function resolveSampleSize(
  row: ScenarioRow,
  V: number,
  mode: SampleMode,
): number {
  switch (mode) {
    case "fixed600":
      return 600;
    case "fixed1000":
      return 1000;
    case "fixed2000":
      return 2000;
    case "proportional":
      return Math.max(600, Math.round((row.validi2024 / V) * 20_000));
    default:
      return 1000;
  }
}

/** Stima centrale sondaggio con correzione affluenza (simulazione demoscopica). */
export function adjustPiHatForTurnout(
  stima: number,
  affluenza2024: number,
  turnoutDeltaPct: number,
): number {
  const newAff = Math.max(25, Math.min(85, affluenza2024 + turnoutDeltaPct));
  const ratio = newAff / affluenza2024;
  const lift = 1 + (ratio - 1) * 0.35;
  return Math.min(0.45, Math.max(0.002, stima * lift));
}

export function seModelFromMc(row: ScenarioRow): number {
  const width = row.hi90 - row.lo10;
  if (width > 1e-9) {
    return width / P10_P90_SIGMA;
  }
  const seS = SD_SONDAGGIO_NAZIONALE * (row.p / row.q);
  const seW = Math.abs(row.max_pesi - row.min_pesi) / 3.2;
  return Math.hypot(seS, seW);
}

export function seSample(
  piHat: number,
  Nr: number,
  deff: number,
): number {
  if (Nr <= 0) return 0;
  return Math.sqrt((deff * piHat * (1 - piHat)) / Nr);
}

export function classifyThresholdProbability(p: number): RegionPollClass {
  if (p >= 0.9) return "sicura";
  if (p >= 0.35) return "contesa";
  return "critica";
}

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
