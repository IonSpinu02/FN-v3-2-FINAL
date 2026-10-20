import type { Region } from "./constants";
import type { ScenarioResult, ScenarioRow } from "./types";

/** Tipi e helper puri — sicuri per import lato client (no python-random). */

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
  thresholdPct: number;
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
  const P10_P90_SIGMA = 2.563;
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
