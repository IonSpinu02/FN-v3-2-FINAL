import { formatIntIt } from "@/lib/formatIt";
import type { BasinId, HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

/** Schede valide nazionali Europee 2024, la stessa base di `01 · Scenario`. */
export const NATIONAL_VALID_BALLOTS = 23_257_062;

export type PayoutSummary = {
  label: "IPOTESI";
  projectedTotalVotes: number;
  netNewVotesFromToday: number;
  surplusVotesOverV4: number;
  regionsAboveDoubleDigit: { today: number; atTarget: number };
  estimatedParliamentSeatsRange: readonly [number, number];
  strategicTierLabel: string;
  validBallots: number;
};

export type ExecutionPhase = {
  id: 1 | 2 | 3;
  code: string;
  title: string;
  domain: string;
  fromDay: number;
  toDay: number;
  action: string;
  detail: string;
  targetPct: number;
};

export type StrategicCommandBrief = {
  payout: PayoutSummary;
  phases: readonly [ExecutionPhase, ExecutionPhase, ExecutionPhase];
};

export function strategicTierLabel(targetPct: number): string {
  if (targetPct >= 12) return "Polo Egemonico";
  if (targetPct >= 10) return "Doppia Cifra · Perno Coalizione";
  if (targetPct >= 8) return "Forza Determinante";
  return "Presidio Identitario";
}

/** Forchetta prudenziale su 400 seggi: non è una proporzionale pura. IPOTESI. */
export function parliamentSeatRange(targetPct: number): readonly [number, number] {
  const raw = 400 * (Math.max(0, targetPct) / 100);
  const min = Math.max(0, Math.round(raw * 0.62));
  const max = Math.max(min, Math.round(raw * 0.88));
  return [min, max];
}

function ballotsOf(result: StrategicBackcastResult): number {
  const gap = result.targetPct - result.currentPct;
  if (Math.abs(gap) < 1e-6 || result.totalDeltaVotes <= 0) return NATIONAL_VALID_BALLOTS;
  return Math.round(result.totalDeltaVotes / (gap / 100));
}

function phaseMarks(horizon: HorizonDays): readonly [number, number, number] {
  if (horizon === 360) return [90, 180, 360];
  if (horizon === 180) return [60, 120, 180];
  if (horizon === 90) return [30, 60, 90];
  return [10, 20, 30];
}

function expectedAt(result: StrategicBackcastResult, day: number): number {
  const points = [{ day: 0, expectedPct: result.currentPct }, ...result.checkpoints];
  let previous = points[0]!;
  for (const point of points) {
    if (point.day === day) return point.expectedPct;
    if (point.day > day) {
      const span = point.day - previous.day || 1;
      const t = (day - previous.day) / span;
      return previous.expectedPct + (point.expectedPct - previous.expectedPct) * t;
    }
    previous = point;
  }
  return result.achievablePct;
}

function dominantBasin(result: StrategicBackcastResult): BasinId {
  const totals: Record<BasinId, number> = {
    delusi_coalizione: 0,
    astensione_recuperabile: 0,
    voto_tematico_ponte: 0,
    radicamento_civico_eletti: 0,
  };
  for (const region of result.regions) {
    for (const key of Object.keys(totals) as BasinId[]) totals[key] += region.basins[key];
  }
  return (Object.entries(totals) as [BasinId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "voto_tematico_ponte";
}

const BASIN_NAME: Record<BasinId, string> = {
  delusi_coalizione: "dei delusi del centrodestra",
  astensione_recuperabile: "dell'astensione di protesta",
  voto_tematico_ponte: "del voto tematico e del ceto produttivo",
  radicamento_civico_eletti: "delle reti civiche e degli amministratori",
};

export function buildStrategicCommandBrief(
  result: StrategicBackcastResult,
  validBallots = ballotsOf(result),
): StrategicCommandBrief {
  const ballots = validBallots > 0 ? validBallots : ballotsOf(result);
  const [t1, t2, horizon] = phaseMarks(result.horizonDays);
  const fronts = [...result.regions].filter((row) => row.role === "FRONTE_PRIORITARIO").sort((a, b) => b.addedVotes - a.addedVotes);
  const theme = result.themes[0]?.theme ?? "Sicurezza";
  const second = result.themes[1]?.theme;
  const basin = BASIN_NAME[dominantBasin(result)];
  const electedMid = Math.max(0, Math.round(result.network.electedTarget * ((t2 - t1) / result.horizonDays)));
  const payout: PayoutSummary = {
    label: "IPOTESI",
    projectedTotalVotes: Math.round((result.targetPct / 100) * ballots),
    netNewVotesFromToday: result.totalDeltaVotes,
    surplusVotesOverV4: result.netSurplusVotes,
    regionsAboveDoubleDigit: {
      today: result.regions.filter((row) => row.todayPct >= 10).length,
      atTarget: result.regions.filter((row) => row.targetPct >= 10).length,
    },
    estimatedParliamentSeatsRange: parliamentSeatRange(result.targetPct),
    strategicTierLabel: strategicTierLabel(result.targetPct),
    validBallots: ballots,
  };
  const phases: readonly [ExecutionPhase, ExecutionPhase, ExecutionPhase] = [
    {
      id: 1,
      code: "01",
      title: "Fase innesco",
      domain: "Dominio dell'aria",
      fromDay: 1,
      toDay: t1,
      action: `Lancia subito ${theme} come tema ariete`,
      detail: `Apri il varco sul bacino ${basin}${second ? ` e prepara ${second}` : ""}.`,
      targetPct: expectedAt(result, t1),
    },
    {
      id: 2,
      code: "02",
      title: "Fase sfondamento",
      domain: "Assedio dei serbatoi",
      fromDay: t1,
      toDay: t2,
      action: `Concentra il 70% della presenza sui fronti ${fronts.slice(0, 4).map((row) => row.region).join(", ") || "prioritari"}`,
      detail: `Innesta circa ${electedMid} amministratori e quadri locali e cavalca i dossier regionali già aperti.`,
      targetPct: expectedAt(result, t2),
    },
    {
      id: 3,
      code: "03",
      title: "Fase conversione",
      domain: "Macchina d'urna",
      fromDay: t2,
      toDay: horizon,
      action: `Apri i presidi al ritmo di +${result.network.monthlyCommitteeNeed} comitati al mese`,
      detail: `Completa +${formatIntIt(result.network.deltaMembers)} tesserati per chiudere il divario tra notorietà e scheda.`,
      targetPct: result.targetPct,
    },
  ];
  return { payout, phases };
}
