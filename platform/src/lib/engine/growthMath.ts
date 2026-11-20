/**
 * Primitive numeriche condivise da traiettoria, calibrazione e motore v4.
 * Nessuna dipendenza interna: evita gli import circolari tra i moduli di previsione.
 */

export type ConsensusPoint = { isoDate: string; pct: number };

const SLOPE_TAU_MONTHS = 3;
const SLOPE_CAP_PP = 2.5;

export const MS_PER_DAY = 86_400_000;

/** Giorni (anche frazionari) tra due date ISO `YYYY-MM-DD`, misurati a mezzogiorno UTC. */
export function isoDaysBetween(fromIso: string, toIso: string): number {
  return (
    (Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / MS_PER_DAY
  );
}

export function sortedConsensusPoints(points: ConsensusPoint[]): ConsensusPoint[] {
  return [...points]
    .filter((p) => Number.isFinite(p.pct) && Boolean(p.isoDate))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

/** Pendenza tra il punto più recente e quello di circa 2–4 mesi prima. */
export function consensusSlopePpPerMonth(points: ConsensusPoint[]): {
  slopePpPerMonth: number;
  from: string | null;
  to: string | null;
} {
  const sorted = sortedConsensusPoints(points);
  if (sorted.length < 2) {
    return { slopePpPerMonth: 0, from: sorted[0]?.isoDate ?? null, to: sorted[0]?.isoDate ?? null };
  }
  const last = sorted[sorted.length - 1]!;
  let earlier = sorted[0]!;
  for (let i = sorted.length - 2; i >= 0; i--) {
    const candidate = sorted[i]!;
    earlier = candidate;
    if (isoDaysBetween(candidate.isoDate, last.isoDate) >= 45) break;
  }
  const days = Math.max(1, isoDaysBetween(earlier.isoDate, last.isoDate));
  return {
    slopePpPerMonth: (last.pct - earlier.pct) / (days / 30.44),
    from: earlier.isoDate,
    to: last.isoDate,
  };
}

export function dampedSlopePp(slopePpPerMonth: number, months: number): number {
  const raw = slopePpPerMonth * SLOPE_TAU_MONTHS * (1 - Math.exp(-months / SLOPE_TAU_MONTHS));
  return Math.min(SLOPE_CAP_PP, Math.max(-SLOPE_CAP_PP, raw));
}

/** Scarto tipico di un giorno quando la serie non basta per stimarlo. */
export const FALLBACK_SIGMA_PER_SQRT_DAY = 0.1;

/** Scarto tipico di un giorno, stimato sui salti della serie (da luglio se c'è storia). */
export function dailyDiffusionSigma(points: ConsensusPoint[]): number {
  const sorted = sortedConsensusPoints(points);
  const fromJuly = sorted.filter((p) => p.isoDate >= "2026-07-01");
  const used = fromJuly.length >= 2 ? fromJuly : sorted;
  let sum = 0;
  let n = 0;
  for (let i = 1; i < used.length; i++) {
    const days = Math.max(1, isoDaysBetween(used[i - 1]!.isoDate, used[i]!.isoDate));
    const dp = used[i]!.pct - used[i - 1]!.pct;
    sum += (dp * dp) / days;
    n += 1;
  }
  if (n === 0) return FALLBACK_SIGMA_PER_SQRT_DAY;
  return Math.sqrt(sum / n);
}
