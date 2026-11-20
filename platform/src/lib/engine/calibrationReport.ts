/**
 * Report ispezionabile della calibrazione walk-forward.
 * Le metriche a 30 giorni NON si estendono a 90/180.
 */

export type WalkForwardMethodKey =
  | "uncalibrated"
  | "calibrated"
  | "consensus_invariant";

export type WalkForwardMethodMetrics = {
  method: WalkForwardMethodKey;
  label: string;
  mae: number | null;
  directionAccuracy: number | null;
  sampleSize: number;
};

export type CalibrationReport = {
  engineVersion: string;
  calibrationVersion: string;
  estimatedOn: {
    observationIds: string[];
    asOf: string;
    note: string;
  };
  activeParams: {
    biasCorrection: number;
    damping: number;
    appliedToPrimary: boolean;
    experimentalOnly: boolean;
  };
  walkForward30d: {
    methods: WalkForwardMethodMetrics[];
    winner: WalkForwardMethodKey;
    note: string;
  };
  /** Esplicitamente null: non si proiettano metriche 30d su 90/180. */
  walkForward90d: null;
  walkForward180d: null;
};

export type WalkForwardObservation = {
  id: string;
  actualDelta: number;
  predictedUncalibrated: number;
  predictedCalibrated: number;
  predictedConsensusInvariant: number;
};

export function computeMae(errors: number[]): number | null {
  if (!errors.length) return null;
  return errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;
}

export function computeDirectionAccuracy(
  pairs: Array<{ actual: number; predicted: number }>,
): number | null {
  if (!pairs.length) return null;
  let hits = 0;
  for (const p of pairs) {
    const a = Math.sign(p.actual);
    const b = Math.sign(p.predicted);
    if (a === 0 && Math.abs(p.predicted) < 1e-9) hits += 1;
    else if (a === b) hits += 1;
  }
  return hits / pairs.length;
}

export function evaluateWalkForward(
  observations: WalkForwardObservation[],
): WalkForwardMethodMetrics[] {
  const uncErr = observations.map((o) => o.predictedUncalibrated - o.actualDelta);
  const calErr = observations.map((o) => o.predictedCalibrated - o.actualDelta);
  const consErr = observations.map(
    (o) => o.predictedConsensusInvariant - o.actualDelta,
  );
  return [
    {
      method: "uncalibrated",
      label: "Metodo non calibrato",
      mae: computeMae(uncErr),
      directionAccuracy: computeDirectionAccuracy(
        observations.map((o) => ({
          actual: o.actualDelta,
          predicted: o.predictedUncalibrated,
        })),
      ),
      sampleSize: observations.length,
    },
    {
      method: "calibrated",
      label: "Metodo calibrato",
      mae: computeMae(calErr),
      directionAccuracy: computeDirectionAccuracy(
        observations.map((o) => ({
          actual: o.actualDelta,
          predicted: o.predictedCalibrated,
        })),
      ),
      sampleSize: observations.length,
    },
    {
      method: "consensus_invariant",
      label: "Riferimento consenso invariato",
      mae: computeMae(consErr),
      directionAccuracy: computeDirectionAccuracy(
        observations.map((o) => ({
          actual: o.actualDelta,
          predicted: o.predictedConsensusInvariant,
        })),
      ),
      sampleSize: observations.length,
    },
  ];
}

const WINNER_TIEBREAK: Record<WalkForwardMethodKey, number> = {
  // A parità di MAE/direzione preferiamo il riferimento semplice.
  consensus_invariant: 0,
  uncalibrated: 1,
  calibrated: 2,
};

export function pickWalkForwardWinner(
  methods: WalkForwardMethodMetrics[],
): WalkForwardMethodKey {
  const ranked = [...methods].sort((a, b) => {
    const maeA = a.mae ?? Number.POSITIVE_INFINITY;
    const maeB = b.mae ?? Number.POSITIVE_INFINITY;
    if (maeA !== maeB) return maeA - maeB;
    const dirA = a.directionAccuracy ?? 0;
    const dirB = b.directionAccuracy ?? 0;
    if (dirA !== dirB) return dirB - dirA;
    return WINNER_TIEBREAK[a.method] - WINNER_TIEBREAK[b.method];
  });
  return ranked[0]?.method ?? "consensus_invariant";
}

/**
 * Se la calibrazione non batte il riferimento fuori campione,
 * disattiva sul valore primario e marca come sperimentale.
 */
export function resolveCalibrationApplication(opts: {
  biasCorrection: number;
  damping: number;
  walkForward: WalkForwardMethodMetrics[];
  observationIds: string[];
  engineVersion: string;
  calibrationVersion: string;
}): CalibrationReport {
  const winner = pickWalkForwardWinner(opts.walkForward);
  const calibrated = opts.walkForward.find((m) => m.method === "calibrated");
  const consensus = opts.walkForward.find(
    (m) => m.method === "consensus_invariant",
  );
  const calibratedBeatsConsensus =
    calibrated?.mae != null &&
    consensus?.mae != null &&
    calibrated.mae < consensus.mae;

  const appliedToPrimary = winner === "calibrated" && calibratedBeatsConsensus;
  const experimentalOnly = !appliedToPrimary;

  return {
    engineVersion: opts.engineVersion,
    calibrationVersion: opts.calibrationVersion,
    estimatedOn: {
      observationIds: opts.observationIds,
      asOf: new Date().toISOString(),
      note: "Stima walk-forward rigorosa senza data leakage futuro; metriche solo a 30 giorni.",
    },
    activeParams: {
      biasCorrection: opts.biasCorrection,
      damping: opts.damping,
      appliedToPrimary,
      experimentalOnly,
    },
    walkForward30d: {
      methods: opts.walkForward,
      winner,
      note: appliedToPrimary
        ? "La calibrazione migliora il riferimento fuori campione e viene applicata al valore principale."
        : "La calibrazione non migliora il riferimento fuori campione: disattivata sul primario e qualificata come sperimentale.",
    },
    walkForward90d: null,
    walkForward180d: null,
  };
}
