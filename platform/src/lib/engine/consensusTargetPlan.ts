import {
  forecastHorizon,
  forecastScenarioMeta,
  type ForecastFactorId,
  type ForecastHorizonKey,
  type ForecastScenarioId,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";

export type ConsensusHorizon = Extract<ForecastHorizonKey, "d30" | "d90" | "d180">;

export type ConsensusTargetRequest = {
  targetPct: number;
  horizon: ConsensusHorizon;
};

export type ConsensusLeverLine = {
  id: ForecastFactorId;
  label: string;
  /** Contributo già presente nel regime eseguito. Etichetta: STIMA MODELLO. */
  modelPp: number;
  /** Punti oltre il centrale Offensiva. Etichetta: IPOTESI. Zero se la leva non è azionabile. */
  hypothesisPp: number;
};

export type ConsensusTargetPlan = {
  targetPct: number;
  horizon: ConsensusHorizon;
  horizonLabel: string;
  /** Consenso di partenza. Etichetta: MISURATO. */
  startPct: number;
  passivoCentral: number;
  baseCentral: number;
  offensivaCentral: number;
  offensivaHi90: number;
  regimeId: ForecastScenarioId;
  regimeLabel: string;
  /** Parte del bersaglio già dentro i regimi calcolati. Etichetta: STIMA MODELLO. */
  modelPct: number;
  /** Buco sopra il centrale Offensiva, in punti. Zero se il bersaglio è già coperto. */
  gapPct: number;
  bandNote: string | null;
  equalFallback: boolean;
  equalFallbackNote: string | null;
  methodNote: string;
  levers: ConsensusLeverLine[];
  firstLeverLabel: string | null;
};

export type StoredConsensusTarget = ConsensusTargetRequest & {
  confirmedAt: string;
};

export const CONSENSUS_TARGET_STORAGE_KEY = "fn-consensus-target";
export const CONSENSUS_TARGET_EVENT = "fn:consensus-target-change";

export const ACTIONABLE_FACTOR_IDS = ["agenda", "donor", "ground", "magnet"] as const;
export const NON_ACTIONABLE_FACTOR_IDS = ["momentum", "cycle", "bounds"] as const;

const LEVER_ORDER: ForecastFactorId[] = [
  ...NON_ACTIONABLE_FACTOR_IDS.slice(0, 1),
  ...ACTIONABLE_FACTOR_IDS,
  ...NON_ACTIONABLE_FACTOR_IDS.slice(1),
];

export const TARGET_METHOD_NOTE =
  "Il riparto è un'allocazione d'ipotesi e non una nuova simulazione del modello.";

export const TARGET_BAND_INSIDE =
  "fuori dal valore centrale, dentro la fascia già calcolata";

export const TARGET_BAND_OUTSIDE = "oltre anche la fascia del modello";

const EQUAL_FALLBACK_NOTE =
  "Le quattro leve azionabili non hanno un contributo positivo: il buco è diviso in parti uguali.";

const HORIZONS: readonly ConsensusHorizon[] = ["d30", "d90", "d180"];

function cents(value: number): number {
  return Math.round(value * 100);
}

function factorLabel(
  forecast: ForecastV4Result,
  horizon: ConsensusHorizon,
  id: ForecastFactorId,
): string {
  const row = forecastHorizon(forecast, "offensiva", horizon).factors.find((item) => item.id === id);
  return row?.short || row?.label || id;
}

function modelPp(
  forecast: ForecastV4Result,
  regime: ForecastScenarioId,
  horizon: ConsensusHorizon,
  id: ForecastFactorId,
): number {
  return forecastHorizon(forecast, regime, horizon).factors.find((item) => item.id === id)?.pp ?? 0;
}

/** Riparto in centesimi. L'ultima leva assorbe il residuo, anche se un arrotondamento intermedio sfora. */
function allocateCents(total: number, weights: number[]): number[] {
  const count = weights.length;
  if (total <= 0 || count === 0) return Array(count).fill(0);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return Array(count).fill(0);
  const shares: number[] = [];
  let used = 0;
  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      shares.push(total - used);
      continue;
    }
    const share = Math.round((total * weights[index]!) / weightSum);
    shares.push(share);
    used += share;
  }
  if (shares[count - 1]! < 0) {
    let debt = -shares[count - 1]!;
    shares[count - 1] = 0;
    for (let index = count - 2; index >= 0 && debt > 0; index -= 1) {
      const take = Math.min(shares[index]!, debt);
      shares[index] = shares[index]! - take;
      debt -= take;
    }
  }
  return shares;
}

function pointsFromCents(totalCents: number, shares: number[]): number[] {
  const gapPct = totalCents / 100;
  const points = shares.map((share) => share / 100);
  if (points.length === 0) return points;
  const head = points.slice(0, -1).reduce((sum, value) => sum + value, 0);
  points[points.length - 1] = gapPct - head;
  return points;
}

export function buildConsensusTargetPlan(
  forecast: ForecastV4Result,
  input: ConsensusTargetRequest,
): ConsensusTargetPlan {
  const horizon = input.horizon;
  const passivo = forecastHorizon(forecast, "passivo", horizon);
  const base = forecastHorizon(forecast, "base", horizon);
  const offensiva = forecastHorizon(forecast, "offensiva", horizon);

  const targetCents = cents(input.targetPct);
  const passivoCents = cents(passivo.centralPct);
  const baseCents = cents(base.centralPct);
  const offensivaCents = cents(offensiva.centralPct);
  const hi90Cents = cents(offensiva.hi90Pct);
  const gapCents = Math.max(0, targetCents - offensivaCents);
  const gapPct = gapCents / 100;
  const targetPct = targetCents / 100;

  let regimeId: ForecastScenarioId = "offensiva";
  if (targetCents <= passivoCents) regimeId = "passivo";
  else if (targetCents <= baseCents) regimeId = "base";
  else regimeId = "offensiva";

  const positive = ACTIONABLE_FACTOR_IDS.map((id) => ({
    id,
    weight: modelPp(forecast, "offensiva", horizon, id),
  })).filter((item) => item.weight > 0);
  const equalFallback = gapCents > 0 && positive.length === 0;
  const recipients = equalFallback
    ? ACTIONABLE_FACTOR_IDS.map((id) => ({ id, weight: 1 }))
    : positive;
  const shares = allocateCents(
    gapCents,
    recipients.map((item) => item.weight),
  );
  const hypothesisById = new Map<ForecastFactorId, number>();
  pointsFromCents(gapCents, shares).forEach((points, index) => {
    const id = recipients[index]?.id;
    if (id) hypothesisById.set(id, points);
  });

  const levers: ConsensusLeverLine[] = LEVER_ORDER.map((id) => ({
    id,
    label: factorLabel(forecast, horizon, id),
    modelPp: modelPp(forecast, regimeId, horizon, id),
    hypothesisPp: hypothesisById.get(id) ?? 0,
  }));

  const actionableRanked = ACTIONABLE_FACTOR_IDS.map((id) => ({
    id,
    points: gapCents > 0 ? (hypothesisById.get(id) ?? 0) : modelPp(forecast, regimeId, horizon, id),
  })).sort((a, b) => b.points - a.points);
  const top = actionableRanked.find((item) => item.points > 0);

  const bandNote =
    gapCents <= 0 ? null : targetCents <= hi90Cents ? TARGET_BAND_INSIDE : TARGET_BAND_OUTSIDE;

  return {
    targetPct,
    horizon,
    horizonLabel: offensiva.label || horizon,
    startPct: forecast.startPct,
    passivoCentral: passivo.centralPct,
    baseCentral: base.centralPct,
    offensivaCentral: offensiva.centralPct,
    offensivaHi90: offensiva.hi90Pct,
    regimeId,
    regimeLabel: forecastScenarioMeta(regimeId).label,
    modelPct: (targetCents - gapCents) / 100,
    gapPct,
    bandNote,
    equalFallback,
    equalFallbackNote: equalFallback ? EQUAL_FALLBACK_NOTE : null,
    methodNote: TARGET_METHOD_NOTE,
    levers,
    firstLeverLabel: top ? factorLabel(forecast, horizon, top.id) : null,
  };
}

export function parseConsensusTargetRequest(raw: unknown): ConsensusTargetRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { targetPct?: unknown; horizon?: unknown };
  const targetPct = typeof value.targetPct === "number" ? value.targetPct : Number.NaN;
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 20) return null;
  if (!HORIZONS.includes(value.horizon as ConsensusHorizon)) return null;
  return { targetPct, horizon: value.horizon as ConsensusHorizon };
}

export function readConsensusTarget(): StoredConsensusTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CONSENSUS_TARGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { confirmedAt?: unknown };
    const request = parseConsensusTargetRequest(parsed);
    if (!request || typeof parsed.confirmedAt !== "string" || parsed.confirmedAt.length === 0) {
      window.sessionStorage.removeItem(CONSENSUS_TARGET_STORAGE_KEY);
      return null;
    }
    return { ...request, confirmedAt: parsed.confirmedAt };
  } catch {
    return null;
  }
}

function emitConsensusTargetChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CONSENSUS_TARGET_EVENT));
}

export function saveConsensusTarget(value: StoredConsensusTarget): void {
  if (typeof window === "undefined") return;
  const request = parseConsensusTargetRequest(value);
  if (!request) return;
  window.sessionStorage.setItem(
    CONSENSUS_TARGET_STORAGE_KEY,
    JSON.stringify({ ...request, confirmedAt: value.confirmedAt }),
  );
  emitConsensusTargetChange();
}

export function clearConsensusTarget(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(CONSENSUS_TARGET_STORAGE_KEY);
  emitConsensusTargetChange();
}
