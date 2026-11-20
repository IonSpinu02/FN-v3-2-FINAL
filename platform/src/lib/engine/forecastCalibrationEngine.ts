import { dampedSlopePp, type ConsensusPoint } from "@/lib/engine/growthMath";
import {
  evaluateWalkForward,
  resolveCalibrationApplication,
  type CalibrationReport,
  type WalkForwardObservation,
} from "@/lib/engine/calibrationReport";
/** Evita import circolari con forecastEngineV4 / computationFingerprint. */
const ENGINE_VERSION_LABEL = "forecast-v4";
const CALIBRATION_VERSION_LABEL = "cal-v1-walkforward";

export type CalibrationObservation = ConsensusPoint;

export type ForecastCalibrationMetrics = {
  /** Precisione storica ≈ 100 − MAE (punti percentuali). */
  accuracyScore: number;
  /** MAE assoluta media degli errori di previsione walk-forward (pp). */
  maePp: number;
  /** Correzione di bias da applicare al saldo futuro (pp). Positiva = modello sottostimava. */
  biasCorrectionPp: number;
  /** Peso adattivo sulla pendenza (tipicamente 0,55–1,35). */
  slopeWeight: number;
  /** Peso adattivo sul calendario (tipicamente 0,55–1,35). */
  calendarWeight: number;
  /** Smorzamento adattivo 0..1 (più alto = più conservativo). */
  adaptiveDamping: number;
  observationsCount: number;
  /** Errori walk-forward usati per la stima (ultimi N). */
  recentErrorsPp: number[];
  /** True se la correzione è applicata al valore primario. */
  appliedToPrimary: boolean;
  /** True se la calibrazione è solo sperimentale (non batte il riferimento). */
  experimentalOnly: boolean;
  /** Report ispezionabile walk-forward (metriche solo a 30g). */
  calibrationReport: CalibrationReport;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysBetween(a: string, b: string): number {
  const ms =
    Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  return Math.max(1, ms / 86400000);
}

/**
 * Predizione ingenua a un passo: pendenza recente smorzata sull'orizzonte
 * tra t_{i-1} e t_i (proxy del motore di traiettoria).
 */
function oneStepForecast(
  history: ConsensusPoint[],
  nextIso: string,
): number {
  if (history.length === 0) return 0;
  const last = history[history.length - 1]!;
  if (history.length === 1) return last.pct;
  const slopeWindow = history.slice(-4);
  const first = slopeWindow[0]!;
  const months =
    daysBetween(first.isoDate, last.isoDate) / 30.44;
  const slopePerMonth =
    months > 0.05 ? (last.pct - first.pct) / months : 0;
  const horizonMonths = daysBetween(last.isoDate, nextIso) / 30.44;
  const delta = dampedSlopePp(slopePerMonth, Math.max(0.25, horizonMonths));
  return last.pct + delta;
}

/**
 * Walk-forward validation sulla serie sondaggi reale + pesi adattivi.
 * Se il modello ha sovrastimato calo/crescita di recente, riduce slope/calendar weight.
 */
export function getCalibrationMetrics(
  pollSeries: CalibrationObservation[],
): ForecastCalibrationMetrics {
  const sorted = [...pollSeries]
    .filter((p) => Number.isFinite(p.pct) && Boolean(p.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const errors: number[] = [];
  const walkObs: WalkForwardObservation[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const history = sorted.slice(0, i);
    const actual = sorted[i]!;
    const predicted = oneStepForecast(history, actual.isoDate);
    const err = actual.pct - predicted;
    errors.push(err);
    const last = history[history.length - 1]!;
    walkObs.push({
      id: `${last.isoDate}->${actual.isoDate}`,
      actualDelta: actual.pct - last.pct,
      predictedUncalibrated: predicted - last.pct,
      predictedCalibrated: predicted - last.pct, // placeholder, filled after bias
      predictedConsensusInvariant: 0,
    });
  }

  const recent = errors.slice(-6);
  const maePp =
    recent.length === 0
      ? 0
      : recent.reduce((s, e) => s + Math.abs(e), 0) / recent.length;
  const meanBias =
    recent.length === 0
      ? 0
      : recent.reduce((s, e) => s + e, 0) / recent.length;

  // Sovrastima del calo ⇒ bias positivo (reale > previsto) ⇒ alza slopeWeight.
  // Sovrastima della crescita ⇒ bias negativo ⇒ abbassa slopeWeight.
  const slopeWeight = clamp(1 + meanBias * 0.35, 0.55, 1.35);
  const calendarWeight = clamp(1 + meanBias * 0.2, 0.55, 1.35);
  const adaptiveDamping = clamp(0.35 + maePp * 0.45, 0.25, 0.9);
  const biasCorrectionPp = round2(meanBias * (1 - adaptiveDamping * 0.5));
  const accuracyScore = round2(clamp(100 - maePp * 100, 0, 100));

  const recentWalk = walkObs.slice(-6).map((o) => ({
    ...o,
    predictedCalibrated: o.predictedUncalibrated + biasCorrectionPp,
  }));
  const walkForward = evaluateWalkForward(recentWalk);
  const calibrationReport = resolveCalibrationApplication({
    biasCorrection: biasCorrectionPp,
    damping: round2(adaptiveDamping),
    walkForward,
    observationIds: recentWalk.map((o) => o.id),
    engineVersion: ENGINE_VERSION_LABEL,
    calibrationVersion: CALIBRATION_VERSION_LABEL,
  });

  const appliedToPrimary = calibrationReport.activeParams.appliedToPrimary;
  const experimentalOnly = calibrationReport.activeParams.experimentalOnly;

  return {
    accuracyScore,
    maePp: round2(maePp),
    biasCorrectionPp: round2(biasCorrectionPp),
    slopeWeight: round2(slopeWeight),
    calendarWeight: round2(calendarWeight),
    adaptiveDamping: round2(adaptiveDamping),
    observationsCount: sorted.length,
    recentErrorsPp: recent.map(round2),
    appliedToPrimary,
    experimentalOnly,
    calibrationReport,
  };
}

/** Applica i pesi di calibrazione a slope/calendar del modello. */
export function applyCalibrationToParts(input: {
  slopePp: number;
  seasonalEventPp: number;
  newsPp: number;
  bipPp: number;
  calibration: ForecastCalibrationMetrics;
  /** Forza applicazione sperimentale anche se non batte il riferimento. */
  forceExperimental?: boolean;
}): {
  slopePp: number;
  seasonalEventPp: number;
  newsPp: number;
  bipPp: number;
  deltaPp: number;
  experimental: boolean;
} {
  const { calibration: c } = input;
  const useAdaptive = c.appliedToPrimary || Boolean(input.forceExperimental);
  const slopePp = round2(input.slopePp * (useAdaptive ? c.slopeWeight : 1));
  const seasonalEventPp = round2(
    input.seasonalEventPp * (useAdaptive ? c.calendarWeight : 1),
  );
  const newsPp = input.newsPp;
  const bipPp = input.bipPp;
  const bias = useAdaptive ? c.biasCorrectionPp : 0;
  const deltaPp = round2(slopePp + newsPp + bipPp + seasonalEventPp + bias);
  return {
    slopePp,
    seasonalEventPp,
    newsPp,
    bipPp,
    deltaPp,
    experimental: !c.appliedToPrimary && Boolean(input.forceExperimental),
  };
}

export type ForecastNewsDriver = {
  title: string;
  source: string;
  impactPp: number;
  whyItMatters: string;
};

export type ForecastMonthIntelligence = {
  monthKey: string;
  monthShort: string;
  eventTitle: string;
  calendarImpactPp: number;
  whyItMoves: {
    inertiaExplanation: string;
    calendarExplanation: string;
    newsOrWebDrivers: ForecastNewsDriver[];
  };
  actionPlan: {
    conflictTitle: string;
    strategicSummary: string;
    triggerCondition: string;
    moves: string[];
  };
  bipResponse: {
    levers: Array<{
      category: string;
      title: string;
      concreteMeasure: string;
    }>;
    readyStatement: string;
    targetRegions: Array<{ region: string; cdxPct: number }>;
  };
};

export type ForecastIntelligencePayload = {
  generatedAt: string;
  source: "anthropic_web" | "fallback_model" | "cache";
  calibration: ForecastCalibrationMetrics;
  months: ForecastMonthIntelligence[];
};
