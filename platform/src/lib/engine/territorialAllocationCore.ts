import { CIRC, type Region } from "@/lib/engine/constants";

export type MacroArea = "Nord-Ovest" | "Nord-Est" | "Centro" | "Sud" | "Isole";

export type BasinId =
  | "delusi_coalizione"
  | "astensione_recuperabile"
  | "voto_tematico_ponte"
  | "radicamento_civico_eletti";

export const BASIN_IDS: readonly BasinId[] = [
  "delusi_coalizione",
  "astensione_recuperabile",
  "voto_tematico_ponte",
  "radicamento_civico_eletti",
];

const AREA_ORDER: readonly MacroArea[] = ["Nord-Ovest", "Nord-Est", "Centro", "Sud", "Isole"];

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

export function macroAreaOfRegion(region: Region): MacroArea {
  if (CIRC.NO.includes(region)) return "Nord-Ovest";
  if (CIRC.NE.includes(region)) return "Nord-Est";
  if (CIRC.C.includes(region)) return "Centro";
  if (CIRC.S.includes(region)) return "Sud";
  return "Isole";
}

/** Quota logistica saturabile: da p0 verso il tetto `reach`, frenata da rho. */
export function logitShare(p0: number, pBar: number, rho: number, lambda: number): number {
  if (pBar <= p0 + 1e-10) return p0;
  const expo = Math.exp(Math.min(40, lambda / Math.max(rho, 1e-6)));
  return (p0 * pBar * expo) / (pBar - p0 + p0 * expo);
}

/** Costo di divergenza KL del salto di quota, usato come sforzo di allocazione. */
export function klTerm(p: number, p0: number, pBar: number): number {
  if (pBar <= p0 + 1e-10 || p <= p0 + 1e-12) return 0;
  const pp = clamp(p, p0 + 1e-12, pBar - 1e-12);
  const left = pp * Math.log(pp / Math.max(p0, 1e-12));
  const right = (pBar - pp) * Math.log((pBar - pp) / Math.max(pBar - p0, 1e-12));
  return Math.max(0, left + right);
}

export type AllocationSeat = {
  voters: number;
  /** Quota già occupata (0–1), inclusa la saturazione delle tappe precedenti. */
  p0: number;
  /** Tetto fisico saturabile (0–1). */
  reach: number;
  rho: number;
  active: boolean;
};

export type AllocationResult = {
  shares: number[];
  added: number[];
  effort: number;
};

/**
 * Distribuisce un delta di voti sulle regioni attive rispettando reach, rho e KL.
 * Stessa bisezione usata dal backcast: i risultati dell'Obiettivo non cambiano.
 */
export function allocateVotesAcrossRegions(input: {
  regions: readonly AllocationSeat[];
  goalVotes: number;
  bisectIters?: number;
}): AllocationResult {
  const seats = input.regions;
  const count = seats.length;
  const shares = seats.map((row) => row.p0);
  const added = new Array<number>(count).fill(0);
  const goalVotes = input.goalVotes;
  if (goalVotes <= 0) return { shares, added, effort: 0 };
  const indexes: number[] = [];
  for (let i = 0; i < count; i += 1) if (seats[i]!.active) indexes.push(i);
  if (indexes.length === 0) return { shares, added, effort: 0 };
  const votesAt = (lambda: number) => {
    let total = 0;
    for (const index of indexes) {
      const row = seats[index]!;
      const p = logitShare(row.p0, row.reach, row.rho, lambda);
      total += row.voters * (p - row.p0);
    }
    return total;
  };
  let lo = 0;
  let hi = 1;
  while (votesAt(hi) < goalVotes && hi < 80) hi *= 2;
  const iters = input.bisectIters ?? 60;
  for (let step = 0; step < iters; step += 1) {
    const mid = (lo + hi) / 2;
    if (votesAt(mid) < goalVotes) lo = mid;
    else hi = mid;
  }
  const lambda = hi;
  const raw = new Array<number>(count).fill(0);
  for (const index of indexes) {
    const row = seats[index]!;
    const p = logitShare(row.p0, row.reach, row.rho, lambda);
    raw[index] = row.voters * Math.max(0, p - row.p0);
  }
  const floors = raw.map((value) => Math.floor(value + 1e-8));
  let left = goalVotes - floors.reduce((sum, value) => sum + value, 0);
  const rank = raw
    .map((value, index) => ({
      index,
      frac: value - floors[index]!,
      room: Math.floor(seats[index]!.voters * (seats[index]!.reach - seats[index]!.p0)) - floors[index]!,
    }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (left > 0 && cursor < rank.length * 3) {
    const slot = rank[cursor % rank.length]!;
    if (slot.room > 0 && seats[slot.index]!.active) {
      floors[slot.index] = floors[slot.index]! + 1;
      slot.room -= 1;
      left -= 1;
    }
    cursor += 1;
    if (cursor > count * 8) break;
  }
  let effort = 0;
  for (let index = 0; index < count; index += 1) {
    const votes = floors[index]!;
    added[index] = votes;
    const p = seats[index]!.p0 + votes / seats[index]!.voters;
    shares[index] = Math.min(seats[index]!.reach, p);
    if (votes > 0) {
      effort += seats[index]!.rho * seats[index]!.voters * Math.max(0, klTerm(shares[index]!, seats[index]!.p0, seats[index]!.reach));
    }
  }
  return { shares, added, effort };
}

export function splitVotesIntoBasins(input: {
  region: Region;
  macroArea: MacroArea;
  votes: number;
  horizonDays: number;
  structural: Record<BasinId, number>;
}): Record<BasinId, number> {
  const t = input.horizonDays <= 30 ? 0 : input.horizonDays < 90 ? 0.35 : input.horizonDays < 180 ? 0.7 : 1;
  const prior = basinPrior(input.region, input.macroArea);
  const pace: Record<BasinId, number> = {
    delusi_coalizione: 1.2 - 0.45 * t,
    astensione_recuperabile: 1.05 - 0.2 * t,
    voto_tematico_ponte: 1.1 - 0.15 * t,
    radicamento_civico_eletti: 0.22 + 1.25 * t,
  };
  const structural = Object.fromEntries(BASIN_IDS.map((key) => [key, input.structural[key] * pace[key]])) as Record<BasinId, number>;
  const structuralSum = BASIN_IDS.reduce((sum, key) => sum + structural[key], 0) || 1;
  const priorSum = BASIN_IDS.reduce((sum, key) => sum + prior[key], 0) || 1;
  const mixed = Object.fromEntries(
    BASIN_IDS.map((key) => [key, 0.22 * (structural[key] / structuralSum) + 0.78 * (prior[key] / priorSum)]),
  ) as Record<BasinId, number>;
  const mixedSum = BASIN_IDS.reduce((sum, key) => sum + mixed[key], 0) || 1;
  return {
    delusi_coalizione: (input.votes * mixed.delusi_coalizione) / mixedSum,
    astensione_recuperabile: (input.votes * mixed.astensione_recuperabile) / mixedSum,
    voto_tematico_ponte: (input.votes * mixed.voto_tematico_ponte) / mixedSum,
    radicamento_civico_eletti: (input.votes * mixed.radicamento_civico_eletti) / mixedSum,
  };
}

function basinPrior(region: Region, macro: MacroArea): Record<BasinId, number> {
  if (region === "Veneto" || region === "Lombardia" || region === "Piemonte" || region === "Emilia-Romagna") {
    return { delusi_coalizione: 1.45, astensione_recuperabile: 0.5, voto_tematico_ponte: 1.7, radicamento_civico_eletti: 0.72 };
  }
  if (region === "Lazio" || region === "Liguria" || region === "Toscana") {
    return { delusi_coalizione: 1.35, astensione_recuperabile: 0.7, voto_tematico_ponte: 1.65, radicamento_civico_eletti: 0.7 };
  }
  if (region === "Sicilia" || region === "Campania" || region === "Calabria" || region === "Puglia") {
    return { delusi_coalizione: 0.55, astensione_recuperabile: 3.2, voto_tematico_ponte: 1.05, radicamento_civico_eletti: 0.95 };
  }
  if (macro === "Sud" || macro === "Isole") {
    return { delusi_coalizione: 0.7, astensione_recuperabile: 2.2, voto_tematico_ponte: 1.1, radicamento_civico_eletti: 1 };
  }
  if (macro === "Nord-Ovest" || macro === "Nord-Est") {
    return { delusi_coalizione: 1.3, astensione_recuperabile: 0.6, voto_tematico_ponte: 1.45, radicamento_civico_eletti: 0.8 };
  }
  return { delusi_coalizione: 1.1, astensione_recuperabile: 0.85, voto_tematico_ponte: 1.25, radicamento_civico_eletti: 0.85 };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type MonteCarloRegion = { voters: number; macroArea: MacroArea };

/**
 * Shock correlati 62% nazionale, 23% macro-area, 15% idiosincratico.
 * Stessa sequenza casuale del backcast quando i pesi elettorali coincidono.
 */
export function runCorrelatedMonteCarlo(input: {
  regions: readonly MonteCarloRegion[];
  planPct: number;
  targetPct: number;
  currentPct: number;
  seed: number;
  runs?: number;
}): { successProbability: number; p10: number; p50: number; p90: number; cvar10: number } {
  const runs = input.runs ?? 2000;
  const rng = mulberry32(input.seed);
  const samples = new Float64Array(runs);
  let weight = 0;
  for (const row of input.regions) weight += row.voters;
  const slippage = 0.08 * Math.max(0, input.targetPct - input.currentPct);
  const sigma = 0.32;
  for (let run = 0; run < runs; run += 1) {
    const national = gaussian(rng);
    const areas = {} as Record<MacroArea, number>;
    for (const area of AREA_ORDER) areas[area] = gaussian(rng);
    let shock = 0;
    for (const row of input.regions) {
      const idio = gaussian(rng);
      const mix = 0.62 * national + 0.23 * areas[row.macroArea] + 0.15 * idio;
      shock += (weight > 0 ? row.voters / weight : 0) * sigma * mix;
    }
    samples[run] = input.planPct - slippage + shock;
  }
  const sorted = Array.from(samples).sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))))]!;
  const worst = Math.max(1, Math.floor(sorted.length * 0.1));
  let cvar = 0;
  for (let i = 0; i < worst; i += 1) cvar += sorted[i]!;
  let hits = 0;
  for (let i = 0; i < sorted.length; i += 1) if (samples[i]! >= input.targetPct) hits += 1;
  return {
    successProbability: hits / runs,
    p10: at(0.1),
    p50: at(0.5),
    p90: at(0.9),
    cvar10: cvar / worst,
  };
}

/** True se il delta di rete sta dentro i massimali mensili sull'orizzonte. */
export function checkMonthlyCapacity(input: {
  horizonDays: number;
  deltaCommittees: number;
  deltaMembers: number;
  monthlyCommitteeCap: number;
  monthlyMemberCap: number;
}): {
  feasible: boolean;
  months: number;
  committeeCeiling: number;
  memberCeiling: number;
  committeeOver: number;
  memberOver: number;
} {
  const months = Math.max(1, input.horizonDays / 30);
  const committeeCeiling = input.monthlyCommitteeCap * months;
  const memberCeiling = input.monthlyMemberCap * months;
  const committeeOver = Math.max(0, input.deltaCommittees - committeeCeiling);
  const memberOver = Math.max(0, input.deltaMembers - memberCeiling);
  return {
    feasible: committeeOver <= 0 && memberOver <= 0,
    months,
    committeeCeiling,
    memberCeiling,
    committeeOver,
    memberOver,
  };
}
