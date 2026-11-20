import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import {
  detectFlussiMatrixId,
  type FlussiIpsos,
  type GrowthRegimeId,
} from "@/lib/politicalModel";

export type { GrowthRegimeId };
import type { RegionPollResult } from "./regionalPollShared";
import type { ScenarioRow } from "./types";
import type {
  ForecastNetworkDelta,
  ForecastRegionInput,
  SimulatedEntryProfile,
} from "./forecastEngineV4";
import { buildGrowthEvidence, seriesWithCurrentPoint } from "./growthEvidence";
import { checkMonthlyCapacity } from "./territorialAllocationCore";
import {
  explainGrowth,
  horizonMonths,
  projectAllHorizons,
  projectHorizon,
  projectMonths,
  REGIME_SENSITIVITY,
  type GrowthEvidence,
  type GrowthHorizonId,
  type HorizonProjection,
} from "./growthTrajectory";

export const GROWTH_REGIME_META: Record<
  GrowthRegimeId,
  { label: string; caption: string; deltaPp: number }
> = {
  organica: {
    label: "BASE ORGANICA",
    caption: "Scenario base v4.0 · fattori calibrati",
    deltaPp: REGIME_SENSITIVITY.organica,
  },
  territori: {
    label: "SPINTA TERRITORI",
    caption: "Sforzo ×1,15 su agenda, bacini e rete",
    deltaPp: REGIME_SENSITIVITY.territori,
  },
  massima: {
    label: "MASSIMA ESPANSIONE",
    caption: "Sforzo ×1,3 su agenda, bacini e rete",
    deltaPp: REGIME_SENSITIVITY.massima,
  },
};

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

/** Etichette mensili allineate a `asOf` (niente "OTT '26" cablato a novembre). */
export function monthLabelsFromAsOf(asOf: Date, steps = 8): string[] {
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

export interface RegionalVoteGain {
  regione: string;
  gainVotes: number;
  startPct: number;
  endPct: number;
}

export interface PartyGrowthForecast {
  regime: GrowthRegimeId;
  startS: number;
  targetS: number;
  deltaPp: number;
  flussiBoostPp: number;
  sAdjustPp: number;
  newVotes: number;
  totalVotesMay: number;
  bandLowPct: number;
  bandHighPct: number;
  monthlyCentral: number[];
  monthlyLow: number[];
  monthlyHigh: number[];
  monthLabels: readonly string[];
  trainanti: number;
  inCrescita: number;
  daRecuperare: number;
  topGains: RegionalVoteGain[];
  badgeLabel: string;
  badgeTone: "emerald" | "cyan" | "amber";
  horizon: GrowthHorizonId;
  horizons: HorizonProjection[];
  ingressi?: { dep: number; creg: number; sind: number };
  explanation: string;
  evidence: GrowthEvidence;
  /** Esito dei massimali mensili sul what-if di rete. Non modifica la stima forward. */
  networkCapacity: ReturnType<typeof checkMonthlyCapacity> | null;
}

/** Etichetta della traiettoria per uno scarto in punti. */
export function growthBadge(deltaPp: number): {
  label: string;
  tone: PartyGrowthForecast["badgeTone"];
} {
  if (deltaPp < 0.15 && deltaPp > -0.15) return { label: "◆ CONSENSO STABILE", tone: "cyan" };
  if (deltaPp < 0) return { label: "▼ TRAIETTORIA IN CALO", tone: "amber" };
  if (deltaPp < 0.8) return { label: "◆ CRESCITA MODERATA", tone: "cyan" };
  return { label: "▲ TRAIETTORIA IN ESPANSIONE", tone: "emerald" };
}

/** Incremento pp aggiuntivo legato alla matrice flussi attiva. */
export function flussiGrowthBoostPp(flussi: FlussiIpsos): number {
  const id = detectFlussiMatrixId(flussi);
  if (id === "skytg24_ottobre_2026") return 0.35;
  return 0;
}

function regionalGrowthWeight(
  startPct: number,
  regime: GrowthRegimeId,
): number {
  const base = 1;
  if (regime === "organica") return base;
  if (startPct < 6.5) return regime === "massima" ? 1.35 : 1.22;
  if (startPct > 9) return regime === "massima" ? 1.08 : 1.02;
  return 1.12;
}

export function computePartyGrowthForecast(input: {
  startS: number;
  totVoti: number;
  regime: GrowthRegimeId;
  flussi: FlussiIpsos;
  rows: ScenarioRow[];
  poll: RegionPollResult[];
  horizon?: GrowthHorizonId;
  evidence?: GrowthEvidence;
  /** false: scenario passivo (inerziale). Default: scenario base. */
  levers?: boolean;
  ingressi?: { dep: number; creg: number; sind: number };
  regions?: ForecastRegionInput[];
  comitati?: number;
  profiles?: SimulatedEntryProfile[];
  networkDelta?: ForecastNetworkDelta;
  asOf?: Date;
}): PartyGrowthForecast {
  const { startS, totVoti, regime, flussi, rows, poll } = input;
  const safeS = Math.max(0.01, startS);
  const startPct = safeS * 100;
  const evidence =
    input.evidence ??
    buildGrowthEvidence({
      series: seriesWithCurrentPoint(FN_SUPERMEDIA_CONSENSO_SERIES, startPct),
    });
  const sensitivity = REGIME_SENSITIVITY[regime];
  const horizon = input.horizon ?? "may27";
  const levers = input.levers !== false;
  const asOf = input.asOf ?? new Date();
  const shared = {
    startPct,
    evidence,
    sensitivity,
    levers,
    asOf,
    flussi,
    ingressi: input.ingressi,
    regions: input.regions,
    comitati: input.comitati,
    profiles: input.profiles,
    networkDelta: input.networkDelta,
  };
  const horizons = projectAllHorizons(shared);
  const selected = projectHorizon({ ...shared, horizon });
  const flussiBoostPp = 0;
  const deltaPp = selected.deltaPp;
  const targetS = safeS + deltaPp / 100;

  const newVotes = totVoti * (targetS / safeS - 1);
  const totalVotesMay = totVoti + newVotes;

  const bandLowPct = selected.bandLowPct;
  const bandHighPct = selected.bandHighPct;

  const monthLabels = monthLabelsFromAsOf(asOf);
  const steps = monthLabels.length;
  const mayMonths = horizonMonths("may27", asOf);
  const monthlyCentral: number[] = [];
  const monthlyLow: number[] = [];
  const monthlyHigh: number[] = [];
  for (let i = 0; i < steps; i++) {
    if (i === 0) {
      monthlyCentral.push(startPct);
      monthlyLow.push(startPct);
      monthlyHigh.push(startPct);
      continue;
    }
    const step = projectMonths({
      ...shared,
      months: Math.max(0.25, (i / (steps - 1)) * mayMonths),
      mayMonths,
    });
    monthlyCentral.push(step.centralPct);
    monthlyLow.push(step.bandLowPct);
    monthlyHigh.push(step.bandHighPct);
  }

  const pollByRegion = new Map(poll.map((p) => [p.regione, p]));
  const projected: { pct: number; row: ScenarioRow }[] = rows.map((row) => {
    const p = pollByRegion.get(row.regione);
    const startPct = (p?.piHat ?? row.stima) * 100;
    const w = regionalGrowthWeight(startPct, regime);
    const endPct = startPct + deltaPp * w;
    return { pct: endPct, row };
  });

  let trainanti = 0;
  let inCrescita = 0;
  let daRecuperare = 0;
  for (const { pct } of projected) {
    if (pct > 8) trainanti++;
    else if (pct >= 6.5) inCrescita++;
    else daRecuperare++;
  }

  const topGains: RegionalVoteGain[] = rows
    .map((row) => {
      const p = pollByRegion.get(row.regione);
      const startPct = (p?.piHat ?? row.stima) * 100;
      const w = regionalGrowthWeight(startPct, regime);
      const endPct = startPct + deltaPp * w;
      const startVotes = row.voti_di_scenario;
      const endVotes = startVotes * (endPct / Math.max(0.01, startPct));
      return {
        regione: row.regione,
        gainVotes: endVotes - startVotes,
        startPct,
        endPct,
      };
    })
    .sort((a, b) => b.gainVotes - a.gainVotes)
    .slice(0, 3);

  const { label: badgeLabel, tone: badgeTone } = growthBadge(deltaPp);

  return {
    regime,
    startS: safeS,
    targetS,
    deltaPp,
    flussiBoostPp,
    sAdjustPp: selected.slopePp,
    newVotes,
    totalVotesMay,
    bandLowPct,
    bandHighPct,
    monthlyCentral,
    monthlyLow,
    monthlyHigh,
    monthLabels,
    trainanti,
    inCrescita,
    daRecuperare,
    topGains,
    badgeLabel,
    badgeTone,
    horizon,
    horizons,
    ingressi: input.ingressi,
    explanation: explainGrowth({ startPct, evidence, horizons }),
    evidence,
    networkCapacity: input.networkDelta
      ? checkMonthlyCapacity({
          horizonDays: 180,
          deltaCommittees: Math.max(0, input.networkDelta.comitati),
          deltaMembers: Math.max(0, input.networkDelta.tesserati),
          monthlyCommitteeCap: 40,
          monthlyMemberCap: 3000,
        })
      : null,
  };
}
