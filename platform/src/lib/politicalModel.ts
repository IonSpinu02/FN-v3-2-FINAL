/**
 * Matrici flussi elettorali (definite in `engine/flussiMatrices`) e previsione di crescita regionale.
 */

import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { buildGrowthEvidence, seriesWithCurrentPoint } from "@/lib/engine/growthEvidence";
import { horizonMonths, projectMonths, REGIME_SENSITIVITY } from "@/lib/engine/growthTrajectory";
import {
  detectFlussiMatrixId,
  flussiFromMatrix,
  formatFlussiPctIt,
  type FlussiIpsos,
  type FlussiMatrixId,
} from "@/lib/engine/flussiMatrices";
export * from "@/lib/engine/flussiMatrices";

// —— Previsione crescita regionale (etichette mensili da asOf) ——

export type GrowthRegimeId = "organica" | "territori" | "massima";

const MONTH_SHORT_IT = [
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
] as const;

/** Etichette allineate alla data di osservazione (niente mese cablato obsoleto). */
function trajectoryMonths(asOf = new Date(), steps = 8): string[] {
  const labels: string[] = [];
  for (let i = 0; i < steps; i++) {
    const d = new Date(asOf.getFullYear(), asOf.getMonth() + i, 1);
    const mon = MONTH_SHORT_IT[d.getMonth()]!;
    const yy = String(d.getFullYear()).slice(-2);
    if (i === 0 || i === steps - 1 || d.getMonth() === 0) {
      labels.push(`${mon} '${yy}`);
    } else {
      labels.push(mon);
    }
  }
  return labels;
}

export interface RegionalGrowthMonthPoint {
  month: string;
  sharePct: number;
  lowBandPct: number;
  highBandPct: number;
}

export interface RegionalGrowthRegionInput {
  regione: string;
  stima: number;
  p: number;
  q: number;
  f: number;
  voti_di_scenario: number;
  iscritti: number;
  piHat?: number;
}

export interface RegionalGrowthForecast {
  regione: string;
  currentSharePct: number;
  projectedShareMay27Pct: number;
  deltaPp: number;
  currentVotes: number;
  projectedVotesMay27: number;
  addedVotes: number;
  monthlyTrajectory: RegionalGrowthMonthPoint[];
  primaryGrowthDriver: string;
  territorialMultiplier: number;
  fasciaLabel: "ROCCAFORTE" | "IN CRESCITA" | "PRIORITÀ";
  iscritti: number;
}

function resolveFlussi(activeFlowMatrix: FlussiMatrixId | FlussiIpsos): {
  flussi: FlussiIpsos;
  matrixId: FlussiMatrixId | null;
} {
  if (typeof activeFlowMatrix === "string") {
    return { flussi: flussiFromMatrix(activeFlowMatrix), matrixId: activeFlowMatrix };
  }
  return {
    flussi: activeFlowMatrix,
    matrixId: detectFlussiMatrixId(activeFlowMatrix),
  };
}

function nationalAtMonths(
  startPct: number,
  months: number,
  mayMonths: number,
  sensitivity: number,
  flussi: FlussiIpsos,
) {
  if (months <= 0) {
    return { centralPct: startPct, bandLowPct: startPct, bandHighPct: startPct };
  }
  const evidence = buildGrowthEvidence({
    series: seriesWithCurrentPoint(FN_SUPERMEDIA_CONSENSO_SERIES, startPct),
  });
  return projectMonths({
    startPct,
    evidence,
    months,
    mayMonths,
    sensitivity,
    abstentionShare: flussi.ast,
    flussi,
  });
}

function regimeWeight(startPct: number, regime: GrowthRegimeId): number {
  if (regime === "organica") return 1;
  if (startPct < 6.5) return regime === "massima" ? 1.35 : 1.22;
  if (startPct > 9) return regime === "massima" ? 1.08 : 1.02;
  return 1.12;
}

function buildDriver(
  flussi: FlussiIpsos,
  matrixId: FlussiMatrixId | null,
  regionF: number,
): string {
  const astPct = formatFlussiPctIt(flussi.ast);
  if (matrixId === "skytg24_ottobre_2026") {
    return `Traino principale: Mobilitazione Astenuti (${astPct} Sky TG24)`;
  }
  if (flussi.ast >= 0.34) {
    return "Traino principale: Recupero Astenuti + Bacino Nord";
  }
  if (regionF > 0.38) {
    return "Traino principale: Bacino elettorale consolidato (35%)";
  }
  return "Traino principale: Mix FdI/Lega + tesseramento locale";
}

function fasciaFromPct(pct: number): RegionalGrowthForecast["fasciaLabel"] {
  if (pct > 8) return "ROCCAFORTE";
  if (pct >= 6.5) return "IN CRESCITA";
  return "PRIORITÀ";
}

export function computeRegionalGrowthForecast(
  regionData: RegionalGrowthRegionInput,
  sNazionale: number,
  growthRegime: GrowthRegimeId,
  activeFlowMatrix: FlussiMatrixId | FlussiIpsos,
): RegionalGrowthForecast {
  const { flussi, matrixId } = resolveFlussi(activeFlowMatrix);
  const share = regionData.piHat ?? regionData.stima;
  const currentSharePct = share * 100;
  const startNational = Math.max(1, sNazionale * 100);
  const mayMonths = horizonMonths("may27");
  const sensitivity = REGIME_SENSITIVITY[growthRegime];
  const TRAJECTORY_MONTHS = trajectoryMonths();
  const steps = TRAJECTORY_MONTHS.length;
  const monthlyTrajectory = TRAJECTORY_MONTHS.map((month, i) => {
    const national = nationalAtMonths(
      startNational,
      (i / (steps - 1)) * mayMonths,
      mayMonths,
      sensitivity,
      flussi,
    );
    const ratio = national.centralPct / startNational;
    const lowRatio = national.bandLowPct / startNational;
    const highRatio = national.bandHighPct / startNational;
    return {
      month,
      sharePct: currentSharePct * ratio,
      lowBandPct: currentSharePct * lowRatio,
      highBandPct: currentSharePct * highRatio,
    };
  });
  const projectedShareMay27Pct = monthlyTrajectory[monthlyTrajectory.length - 1]!.sharePct;
  const deltaPp = projectedShareMay27Pct - currentSharePct;
  const piOverQ = regionData.q > 1e-9 ? regionData.p / regionData.q : 1;
  const astTemper = 0.78 + flussi.ast * 0.42;
  const territorialMultiplier = Math.min(
    2.15,
    Math.max(
      0.7,
      piOverQ ** 0.38 * astTemper * regimeWeight(currentSharePct, growthRegime),
    ),
  );
  const currentVotes = regionData.voti_di_scenario;
  const projectedVotesMay27 =
    currentSharePct > 0.01
      ? currentVotes * (projectedShareMay27Pct / currentSharePct)
      : currentVotes;
  const addedVotes = projectedVotesMay27 - currentVotes;

  return {
    regione: regionData.regione,
    currentSharePct,
    projectedShareMay27Pct,
    deltaPp,
    currentVotes,
    projectedVotesMay27,
    addedVotes,
    monthlyTrajectory,
    primaryGrowthDriver: buildDriver(flussi, matrixId, regionData.f),
    territorialMultiplier,
    fasciaLabel: fasciaFromPct(projectedShareMay27Pct),
    iscritti: regionData.iscritti,
  };
}

export function buildRegionalGrowthMap(
  rows: RegionalGrowthRegionInput[],
  sNazionale: number,
  growthRegime: GrowthRegimeId,
  activeFlowMatrix: FlussiMatrixId | FlussiIpsos,
): Record<string, RegionalGrowthForecast> {
  const out: Record<string, RegionalGrowthForecast> = {};
  for (const row of rows) {
    out[row.regione] = computeRegionalGrowthForecast(
      row,
      sNazionale,
      growthRegime,
      activeFlowMatrix,
    );
  }
  return out;
}
