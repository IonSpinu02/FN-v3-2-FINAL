import { CIRC, type Region } from "@/lib/engine/constants";
import {
  allocateVotesAcrossRegions,
  checkMonthlyCapacity,
  runCorrelatedMonteCarlo,
} from "@/lib/engine/territorialAllocationCore";
import type {
  ForecastHorizonKey,
  ForecastHorizonResult,
  ForecastScenarioId,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";

export type HorizonDays = 30 | 90 | 180 | 360;
export type MacroArea = "Nord-Ovest" | "Nord-Est" | "Centro" | "Sud" | "Isole";
export type EpistemicLabel = "MISURATO" | "STIMA MODELLO" | "IPOTESI";
export type BackcastRegime =
  | "INERZIA_COPERTA"
  | "CONSOLIDAMENTO_BASE"
  | "ESECUZIONE_OFFENSIVA_V4"
  | "ESPANSIONE_STRUTTURALE"
  | "OLTRE_FRONTIERA_ENDOGENA";
export type FeasibilityBand =
  | "COPERTA_DA_MODELLO"
  | "ESPANSIONE_ORGANICA"
  | "MOBILITAZIONE_STRAORDINARIA"
  | "SHOCK_ESOGENO_RICHIESTO";
export type RegionRole = "FRONTE_PRIORITARIO" | "SUPPORTO_ESPANSIONE" | "PRESIDIO_ORDINARIO";
export type TrackStatus = "IN_ROTTA" | "IN_RITARDO" | "IN_ANTICIPO";
export type BridgeTheme =
  | "Sicurezza"
  | "Liste d'attesa Sanità"
  | "Energia PMI"
  | "Fisco P.IVA"
  | "Casa/Mutui"
  | "Trasporti/Flussi";
export type BasinId =
  | "delusi_coalizione"
  | "astensione_recuperabile"
  | "voto_tematico_ponte"
  | "radicamento_civico_eletti";

export type BackcastRegionInput = {
  region: Region;
  validVoters: number;
  currentSharePct: number;
  priority: number;
  affinity: number;
  macroArea: MacroArea;
  cdxSharePct: number;
  abstentionPct: number;
  /** Urgenza problemi sociali, 0–1. */
  themePressure: number;
  members: number;
  committees: number;
  localElected: number;
  primaryTheme?: BridgeTheme;
};

export type StrategicBackcastInput = {
  forecast: ForecastV4Result;
  targetPct: number;
  horizonDays: HorizonDays;
  regions: readonly BackcastRegionInput[];
  currentMembers: number;
  currentCommittees: number;
  totalValidVoters?: number;
  seed?: number;
};

export type RegionPlan = {
  region: Region;
  macroArea: MacroArea;
  role: RegionRole;
  /** Tema-ponte assegnato al serbatoio. IPOTESI. */
  theme: BridgeTheme;
  anchorPct: number;
  targetPct: number;
  ceilingPct: number;
  physPct: number;
  addedVotes: number;
  resistance: number;
  basins: Record<BasinId, number>;
  /** Consenso regionale di oggi, in punti percentuali. MISURATO. */
  todayPct: number;
};

export type ThemeUnlock = {
  theme: BridgeTheme;
  votes: number;
  regions: Region[];
  label: "IPOTESI";
};

export type Checkpoint = {
  day: number;
  minOnTrackPct: number;
  expectedPct: number;
  stretchPct: number;
  status: TrackStatus;
};

export type StrategicBackcastResult = {
  epistemic: {
    currentPct: "MISURATO";
    modelAnchors: "STIMA MODELLO";
    surplus: "IPOTESI";
    network: "IPOTESI";
  };
  regime: BackcastRegime;
  feasibilityBand: FeasibilityBand;
  feasibilityIndex: number;
  extendedHorizon: boolean;
  horizonDays: HorizonDays;
  currentPct: number;
  passiveCentral: number;
  baseCentral: number;
  offensiveCentral: number;
  offensiveHi90: number;
  targetPct: number;
  achievablePct: number;
  maxEndogenousPct: number;
  netSurplusPct: number;
  netSurplusVotes: number;
  totalDeltaVotes: number;
  exogenousGapPct: number;
  offensiveCoverageRatio: number;
  baseIntensity: number;
  klEffort: number;
  groundingShare: number;
  successProbability: number;
  p10: number;
  p50: number;
  p90: number;
  cvar10: number;
  activeFronts: number;
  regions: RegionPlan[];
  themes: ThemeUnlock[];
  network: {
    label: "IPOTESI";
    deltaCommittees: number;
    deltaMembers: number;
    electedTarget: number;
    monthlyCommitteeCap: number;
    monthlyMemberCap: number;
    monthlyElectedCap: number;
    /** Cadenza mensile chiesta dal piano, prima del tetto di capacità. */
    monthlyCommitteeNeed: number;
    monthlyMemberNeed: number;
    monthlyElectedNeed: number;
  };
  checkpoints: Checkpoint[];
  methodNote: string;
};

const DEFAULT_VOTERS = 23_300_000;
const TAU_AIR = 78;
const MC_RUNS = 2000;
const BISECT_ITERS = 60;
const THEMES: BridgeTheme[] = [
  "Sicurezza",
  "Liste d'attesa Sanità",
  "Energia PMI",
  "Fisco P.IVA",
  "Casa/Mutui",
  "Trasporti/Flussi",
];

/** Serbatoi grandi su cui una campagna di 12 mesi concentra lo sforzo. */
const YEAR_RESERVOIRS = new Set<Region>([
  "Lombardia",
  "Veneto",
  "Lazio",
  "Piemonte",
  "Sicilia",
  "Campania",
  "Puglia",
  "Emilia-Romagna",
  "Toscana",
  "Calabria",
]);

const MACRO_OF: Record<string, MacroArea> = {
  NO: "Nord-Ovest",
  NE: "Nord-Est",
  C: "Centro",
  S: "Sud",
  I: "Isole",
};

export function macroAreaOf(region: Region): MacroArea {
  for (const code of Object.keys(CIRC)) {
    if (CIRC[code]?.includes(region)) return MACRO_OF[code] ?? "Centro";
  }
  return "Centro";
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function readCentral(
  forecast: ForecastV4Result,
  scenario: ForecastScenarioId,
  key: ForecastHorizonKey,
): ForecastHorizonResult {
  const list = forecast.scenarios[scenario].horizons;
  return list.find((row) => row.key === key) ?? list[list.length - 1]!;
}

function saturate360(at30: number, at90: number, at180: number): number {
  const step1 = at90 - at30;
  const step2 = at180 - at90;
  const decay = step1 > 1e-4 ? clamp(step2 / step1, 0, 1) : 0.4;
  const extra = Math.max(0, step2) * decay * Math.log(2) * 0.55;
  return at180 + extra;
}

type AnchorPack = {
  currentPct: number;
  passiveCentral: number;
  baseCentral: number;
  offensiveCentral: number;
  offensiveHi90: number;
  extendedHorizon: boolean;
};

function anchors(forecast: ForecastV4Result, horizonDays: HorizonDays): AnchorPack {
  const passive30 = readCentral(forecast, "passivo", "d30");
  const passive90 = readCentral(forecast, "passivo", "d90");
  const passive180 = readCentral(forecast, "passivo", "d180");
  const base30 = readCentral(forecast, "base", "d30");
  const base90 = readCentral(forecast, "base", "d90");
  const base180 = readCentral(forecast, "base", "d180");
  const off30 = readCentral(forecast, "offensiva", "d30");
  const off90 = readCentral(forecast, "offensiva", "d90");
  const off180 = readCentral(forecast, "offensiva", "d180");
  if (horizonDays === 360) {
    return {
      currentPct: forecast.startPct,
      passiveCentral: saturate360(passive30.centralPct, passive90.centralPct, passive180.centralPct),
      baseCentral: saturate360(base30.centralPct, base90.centralPct, base180.centralPct),
      offensiveCentral: saturate360(off30.centralPct, off90.centralPct, off180.centralPct),
      offensiveHi90: saturate360(off30.hi90Pct, off90.hi90Pct, off180.hi90Pct),
      extendedHorizon: true,
    };
  }
  const key: ForecastHorizonKey = horizonDays === 30 ? "d30" : horizonDays === 90 ? "d90" : "d180";
  return {
    currentPct: forecast.startPct,
    passiveCentral: readCentral(forecast, "passivo", key).centralPct,
    baseCentral: readCentral(forecast, "base", key).centralPct,
    offensiveCentral: readCentral(forecast, "offensiva", key).centralPct,
    offensiveHi90: readCentral(forecast, "offensiva", key).hi90Pct,
    extendedHorizon: false,
  };
}

type Prep = {
  input: BackcastRegionInput;
  voters: number;
  current: number;
  phys: number;
  psi: number;
  reach: number;
  rho: number;
  basins: Record<BasinId, number>;
  theme: BridgeTheme;
};

function airSpeed(horizonDays: number): number {
  return 1 - Math.exp(-horizonDays / TAU_AIR);
}

function prepare(regions: readonly BackcastRegionInput[], horizonDays: number): Prep[] {
  const nu = airSpeed(horizonDays);
  const months = horizonDays / 30;
  const openable = months * 3;
  const expansion = 1 - Math.exp(-openable / 8);
  return regions.map((input) => {
    const voters = Math.max(1, input.validVoters);
    const current = clamp(input.currentSharePct / 100, 0.001, 0.5);
    const affinity = clamp(input.affinity / 100, 0, 1);
    const priority = clamp(input.priority / 100, 0, 1);
    const cdx = clamp(input.cdxSharePct / 100, 0, 1);
    const abstention = clamp(input.abstentionPct / 100, 0, 1);
    const themePressure = clamp(input.themePressure, 0, 1);
    const per100k = input.committees / Math.max(1, voters / 100_000);
    const permanent = horizonDays >= 360;
    const pool = permanent ? 1.2 * (YEAR_RESERVOIRS.has(input.region) ? 1.08 : 1) : 1;
    const delusi = cdx * (0.08 + 0.22 * affinity) * 0.42 * pool;
    const astensione = abstention * (0.2 + 0.6 * priority) * 0.28 * pool;
    const tema = themePressure * (0.035 + 0.07 * affinity) * pool;
    const radicamento = clamp(0.012 + 0.006 * per100k + 0.0015 * input.localElected, 0.012, 0.09) * (permanent ? 1.15 : 1);
    const phys = clamp(current + delusi + astensione + tema + radicamento, current + 0.01, permanent ? 0.52 : 0.46);
    const networkNow = 1 - Math.exp(-per100k / 1.6);
    const psi = clamp(0.1 + 0.9 * (0.32 * networkNow + 0.68 * expansion) * (0.5 + 0.5 * affinity), 0.08, 1);
    const speed = Math.min(1, nu * psi);
    const reach = current + (phys - current) * speed;
    const media = 0.35 + 0.65 * affinity;
    const ground = 0.25 + 0.75 * psi;
    const long = horizonDays >= 180 ? 1 : horizonDays >= 90 ? 0.55 : 0;
    const rho = clamp(
      ((1 - long) / media + long / ground) * (permanent && YEAR_RESERVOIRS.has(input.region) ? 0.82 : 1),
      0.25,
      6,
    );
    const theme =
      input.primaryTheme ??
      (input.macroArea === "Nord-Ovest"
        ? "Sicurezza"
        : input.macroArea === "Nord-Est"
          ? "Energia PMI"
          : input.macroArea === "Centro"
            ? "Casa/Mutui"
            : input.macroArea === "Sud"
              ? "Liste d'attesa Sanità"
              : "Trasporti/Flussi");
    return {
      input,
      voters,
      current,
      phys,
      psi,
      reach,
      rho,
      basins: {
        delusi_coalizione: delusi,
        astensione_recuperabile: astensione,
        voto_tematico_ponte: tema,
        radicamento_civico_eletti: radicamento,
      },
      theme,
    };
  });
}

function weighted(prep: Prep[], values: number[]): number {
  let votes = 0;
  let weight = 0;
  for (let i = 0; i < prep.length; i += 1) {
    votes += prep[i]!.voters * values[i]!;
    weight += prep[i]!.voters;
  }
  return weight > 0 ? votes / weight : 0;
}

function fitToLevel(prep: Prep[], level: number, caps: number[]): number[] {
  const count = prep.length;
  const out = new Array<number>(count).fill(0);
  let weight = 0;
  let seed = 0;
  for (let i = 0; i < count; i += 1) {
    weight += prep[i]!.voters;
    seed += prep[i]!.voters * Math.min(prep[i]!.current, caps[i]!);
  }
  const targetVotes = level * weight;
  if (seed <= 0) {
    for (let i = 0; i < count; i += 1) out[i] = Math.min(caps[i]!, level);
  } else {
    for (let i = 0; i < count; i += 1) {
      const raw = (prep[i]!.current / (seed / weight)) * level;
      out[i] = clamp(raw, 0, Math.max(0, caps[i]! - 1e-8));
    }
  }
  for (let pass = 0; pass < 12; pass += 1) {
    let got = 0;
    let roomVotes = 0;
    for (let i = 0; i < count; i += 1) {
      got += prep[i]!.voters * out[i]!;
      roomVotes += prep[i]!.voters * Math.max(0, caps[i]! - 1e-8 - out[i]!);
    }
    const diff = targetVotes - got;
    if (Math.abs(diff) < 1e-4 || roomVotes <= 1) break;
    if (diff > 0) {
      const take = Math.min(1, diff / roomVotes);
      for (let i = 0; i < count; i += 1) {
        const room = Math.max(0, caps[i]! - 1e-8 - out[i]!);
        out[i] = out[i]! + room * take;
      }
    } else {
      let mass = 0;
      for (let i = 0; i < count; i += 1) mass += prep[i]!.voters * out[i]!;
      if (mass <= 1) break;
      const keep = (mass + diff) / mass;
      for (let i = 0; i < count; i += 1) out[i] = Math.max(0, out[i]! * keep);
    }
  }
  let got = 0;
  for (let i = 0; i < count - 1; i += 1) got += prep[i]!.voters * out[i]!;
  const last = count - 1;
  const exact = (targetVotes - got) / prep[last]!.voters;
  out[last] = clamp(exact, 0, Math.max(0, caps[last]! - 1e-8));
  return out;
}

type Solved = {
  shares: number[];
  added: number[];
  effort: number;
  active: boolean[];
  fronts: number;
};

function solvePortfolio(prep: Prep[], p0: number[], goalVotes: number): Solved {
  const count = prep.length;
  const order = prep
    .map((row, index) => ({
      index,
      score: (row.voters * Math.max(0, row.reach - p0[index]!) ) / row.rho,
    }))
    .sort((a, b) => b.score - a.score);
  const room = p0.map((value, index) => Math.max(0, prep[index]!.reach - value));
  let best: Solved | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let k = 4; k <= count; k += 1) {
    const active = new Array<boolean>(count).fill(false);
    let capacity = 0;
    for (let n = 0; n < k; n += 1) {
      const index = order[n]!.index;
      active[index] = true;
      capacity += prep[index]!.voters * room[index]!;
    }
    const goal = Math.min(goalVotes, Math.floor(capacity + 1e-6));
    const solved = allocate(prep, p0, active, goal);
    const cost = solved.effort + k * 1800;
    const covers = capacity + 1 >= goalVotes;
    if (covers && cost < bestCost) {
      bestCost = cost;
      best = { ...solved, active, fronts: k };
    }
    if (!covers && k === count) {
      best = { ...solved, active, fronts: k };
    }
  }
  if (best) return best;
  const fallback = allocate(prep, p0, prep.map(() => true), goalVotes);
  return { ...fallback, active: prep.map(() => true), fronts: count };
}

function allocate(prep: Prep[], p0: number[], active: boolean[], goalVotes: number): Omit<Solved, "active" | "fronts"> {
  return allocateVotesAcrossRegions({
    goalVotes,
    bisectIters: BISECT_ITERS,
    regions: prep.map((row, index) => ({
      voters: row.voters,
      p0: p0[index]!,
      reach: row.reach,
      rho: row.rho,
      active: active[index]!,
    })),
  });
}

function horizonMix(horizonDays: number): number {
  if (horizonDays <= 30) return 0;
  if (horizonDays < 90) return 0.35;
  if (horizonDays < 180) return 0.7;
  return 1;
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

function splitBasins(prep: Prep, votes: number, horizonDays: number): Record<BasinId, number> {
  const t = horizonMix(horizonDays);
  const prior = basinPrior(prep.input.region, prep.input.macroArea);
  const keys: BasinId[] = ["delusi_coalizione", "astensione_recuperabile", "voto_tematico_ponte", "radicamento_civico_eletti"];
  const pace: Record<BasinId, number> = {
    delusi_coalizione: 1.2 - 0.45 * t,
    astensione_recuperabile: 1.05 - 0.2 * t,
    voto_tematico_ponte: 1.1 - 0.15 * t,
    radicamento_civico_eletti: 0.22 + 1.25 * t,
  };
  const structural = Object.fromEntries(keys.map((key) => [key, prep.basins[key] * pace[key]])) as Record<BasinId, number>;
  const structuralSum = keys.reduce((sum, key) => sum + structural[key], 0) || 1;
  const priorSum = keys.reduce((sum, key) => sum + prior[key], 0) || 1;
  const mixed = Object.fromEntries(
    keys.map((key) => [key, 0.22 * (structural[key] / structuralSum) + 0.78 * (prior[key] / priorSum)]),
  ) as Record<BasinId, number>;
  const mixedSum = keys.reduce((sum, key) => sum + mixed[key], 0) || 1;
  return {
    delusi_coalizione: (votes * mixed.delusi_coalizione) / mixedSum,
    astensione_recuperabile: (votes * mixed.astensione_recuperabile) / mixedSum,
    voto_tematico_ponte: (votes * mixed.voto_tematico_ponte) / mixedSum,
    radicamento_civico_eletti: (votes * mixed.radicamento_civico_eletti) / mixedSum,
  };
}

function assignRoles(plans: RegionPlan[], surplusPp: number): RegionPlan[] {
  const ranked = plans
    .map((plan, index) => ({ index, votes: plan.addedVotes }))
    .filter((row) => row.votes > 0)
    .sort((a, b) => b.votes - a.votes);
  const total = ranked.reduce((sum, row) => sum + row.votes, 0);
  const aggressive = surplusPp > 0.4;
  const minFronts = aggressive ? Math.min(4, ranked.length) : 1;
  const maxFronts = aggressive ? 7 : 5;
  const roles = new Map<number, RegionRole>();
  let cum = 0;
  let fronts = 0;
  for (const row of ranked) {
    const before = total > 0 ? cum / total : 1;
    if (fronts < minFronts || (before < 0.68 && fronts < maxFronts)) {
      roles.set(row.index, "FRONTE_PRIORITARIO");
      fronts += 1;
    } else if (before < 0.92) {
      roles.set(row.index, "SUPPORTO_ESPANSIONE");
    } else {
      roles.set(row.index, "PRESIDIO_ORDINARIO");
    }
    cum += row.votes;
  }
  return plans.map((plan, index) => ({
    ...plan,
    role: plan.addedVotes > 0 ? roles.get(index) ?? "PRESIDIO_ORDINARIO" : "PRESIDIO_ORDINARIO",
  }));
}

function logistic(progress: number): number {
  const k = 6.2;
  const raw = (x: number) => 1 / (1 + Math.exp(-k * (x - 0.46)));
  const start = raw(0);
  const end = raw(1);
  return clamp((raw(progress) - start) / (end - start), 0, 1);
}

function checkpoints(currentPct: number, finalPct: number, horizonDays: HorizonDays): Checkpoint[] {
  const marks = horizonDays === 360 ? [30, 90, 180, 270, 360] : [30, 60, 90, 120, 180].filter((day) => day <= horizonDays);
  return marks.map((day) => {
    const expected = currentPct + (finalPct - currentPct) * logistic(day / horizonDays);
    return {
      day,
      minOnTrackPct: expected - 0.22,
      expectedPct: expected,
      stretchPct: expected + 0.28,
      status: "IN_ROTTA" as const,
    };
  });
}

function monteCarlo(
  prep: Prep[],
  planPct: number,
  targetPct: number,
  currentPct: number,
  seed: number,
): { successProbability: number; p10: number; p50: number; p90: number; cvar10: number } {
  return runCorrelatedMonteCarlo({
    regions: prep.map((row) => ({ voters: row.voters, macroArea: row.input.macroArea })),
    planPct,
    targetPct,
    currentPct,
    seed,
    runs: MC_RUNS,
  });
}

export function computeStrategicBackcast(input: StrategicBackcastInput): StrategicBackcastResult {
  const pack = anchors(input.forecast, input.horizonDays);
  const prep = prepare(input.regions, input.horizonDays);
  const electorate = prep.reduce((sum, row) => sum + row.voters, 0);
  const totalValidVoters = input.totalValidVoters ?? (electorate > 0 ? electorate : DEFAULT_VOTERS);
  const caps = prep.map((row) => row.reach);
  const maxEndogenousPct = weighted(prep, caps) * 100;
  const targetPct = input.targetPct;
  const aboveOffensive = targetPct > pack.offensiveCentral + 1e-9;
  const beyondFrontier = targetPct > maxEndogenousPct + 1e-6;
  const regime: BackcastRegime = !aboveOffensive
    ? targetPct <= pack.passiveCentral + 1e-9
      ? "INERZIA_COPERTA"
      : targetPct <= pack.baseCentral + 1e-9
        ? "CONSOLIDAMENTO_BASE"
        : "ESECUZIONE_OFFENSIVA_V4"
    : beyondFrontier
      ? "OLTRE_FRONTIERA_ENDOGENA"
      : "ESPANSIONE_STRUTTURALE";
  const achievablePct = Math.min(targetPct, maxEndogenousPct);
  const anchorPct = Math.min(targetPct, pack.offensiveCentral, maxEndogenousPct);
  const anchorLevel = anchorPct / 100;
  const p0 = fitToLevel(prep, anchorLevel, caps);
  const goalVotes = Math.max(0, Math.round(((achievablePct - anchorPct) / 100) * electorate));
  const solved = solvePortfolio(prep, p0, goalVotes);
  const surplusPp = aboveOffensive ? targetPct - pack.offensiveCentral : 0;
  const plans = assignRoles(
    prep.map((row, index) => {
      const added = solved.added[index] ?? 0;
      return {
        region: row.input.region,
        macroArea: row.input.macroArea,
        role: "PRESIDIO_ORDINARIO" as const,
        theme: row.theme,
        anchorPct: p0[index]! * 100,
        targetPct: solved.shares[index]! * 100,
        ceilingPct: row.reach * 100,
        physPct: row.phys * 100,
        addedVotes: added,
        resistance: row.rho,
        basins: splitBasins(row, added, input.horizonDays),
        todayPct: row.input.currentSharePct,
      };
    }),
    surplusPp,
  );
  let basinVotes = 0;
  let groundVotes = 0;
  for (const plan of plans) {
    const row = Object.values(plan.basins).reduce((sum, value) => sum + value, 0);
    basinVotes += row;
    groundVotes += plan.basins.radicamento_civico_eletti;
  }
  const themeMap = new Map<BridgeTheme, { votes: number; regions: Region[] }>();
  for (const theme of THEMES) themeMap.set(theme, { votes: 0, regions: [] });
  prep.forEach((row, index) => {
    const added = solved.added[index] ?? 0;
    if (added <= 0) return;
    const bucket = themeMap.get(row.theme)!;
    bucket.votes += added;
    bucket.regions.push(row.input.region);
  });
  const themes: ThemeUnlock[] = [...themeMap.entries()]
    .map(([theme, bucket]) => ({ theme, votes: Math.round(bucket.votes), regions: bucket.regions, label: "IPOTESI" as const }))
    .filter((row) => row.votes > 0)
    .sort((a, b) => b.votes - a.votes);
  const months = Math.max(1, input.horizonDays / 30);
  const frontCount = plans.filter((row) => row.role !== "PRESIDIO_ORDINARIO").length;
  const addedVotes = plans.reduce((sum, row) => sum + row.addedVotes, 0);
  const wantedCommittees = Math.max(frontCount * 2, Math.ceil(addedVotes / 12000));
  const monthlyCommitteePace = Math.max(4, frontCount * 2);
  const monthlyMemberCap = Math.min(3000, Math.max(2500, Math.round(Math.max(input.currentMembers, 1) * 0.018)));
  const monthlyElectedCap = 12;
  const capacity = checkMonthlyCapacity({
    horizonDays: input.horizonDays,
    deltaCommittees: wantedCommittees,
    deltaMembers: Math.max(0, Math.round(addedVotes / 40)),
    monthlyCommitteeCap: monthlyCommitteePace,
    monthlyMemberCap,
  });
  const monthlyCommitteeCap = Math.round(capacity.committeeCeiling);
  const deltaCommittees = Math.min(monthlyCommitteeCap, wantedCommittees);
  const deltaMembers = Math.min(
    Math.round(capacity.memberCeiling),
    Math.max(0, Math.round(addedVotes / 40)),
  );
  const electedTarget = Math.min(
    Math.round(monthlyElectedCap * months),
    Math.round(frontCount * Math.max(1, months)),
  );
  const monthlyCommitteeNeed = Math.ceil(deltaCommittees / months);
  const monthlyMemberNeed = Math.ceil(deltaMembers / months);
  const monthlyElectedNeed = Math.ceil(electedTarget / months);
  const finalPct = weighted(prep, solved.shares) * 100;
  const seed = input.seed ?? 20261111;
  const mc = monteCarlo(prep, finalPct, targetPct, pack.currentPct, seed);
  const span = Math.max(0.2, maxEndogenousPct - pack.offensiveCentral);
  const load = aboveOffensive ? (achievablePct - pack.offensiveCentral) / span : 0;
  const feasibilityBand: FeasibilityBand = beyondFrontier
    ? "SHOCK_ESOGENO_RICHIESTO"
    : targetPct <= pack.offensiveCentral + 1e-6
      ? "COPERTA_DA_MODELLO"
      : load < 0.55 && mc.successProbability >= 0.45
        ? "ESPANSIONE_ORGANICA"
        : "MOBILITAZIONE_STRAORDINARIA";
  const feasibilityIndex = clamp(
    Math.round((beyondFrontier ? 35 : 70) * (achievablePct / Math.max(targetPct, 0.1)) + 30 * mc.successProbability),
    0,
    100,
  );
  const baseSpan = Math.max(1e-6, pack.baseCentral - pack.passiveCentral);
  const offSpan = Math.max(1e-6, pack.offensiveCentral - pack.baseCentral);
  return {
    epistemic: {
      currentPct: "MISURATO",
      modelAnchors: "STIMA MODELLO",
      surplus: "IPOTESI",
      network: "IPOTESI",
    },
    regime,
    feasibilityBand,
    feasibilityIndex,
    extendedHorizon: pack.extendedHorizon,
    horizonDays: input.horizonDays,
    currentPct: pack.currentPct,
    passiveCentral: pack.passiveCentral,
    baseCentral: pack.baseCentral,
    offensiveCentral: pack.offensiveCentral,
    offensiveHi90: pack.offensiveHi90,
    targetPct,
    achievablePct: finalPct,
    maxEndogenousPct,
    netSurplusPct: aboveOffensive ? targetPct - pack.offensiveCentral : 0,
    netSurplusVotes: aboveOffensive
      ? Math.max(0, Math.round(((targetPct - pack.offensiveCentral) / 100) * totalValidVoters))
      : 0,
    totalDeltaVotes: Math.max(0, Math.round(((targetPct - pack.currentPct) / 100) * totalValidVoters)),
    exogenousGapPct: Math.max(0, targetPct - maxEndogenousPct),
    offensiveCoverageRatio:
      regime === "ESECUZIONE_OFFENSIVA_V4" ? clamp((targetPct - pack.baseCentral) / offSpan, 0, 1) : aboveOffensive ? 1 : 0,
    baseIntensity:
      regime === "CONSOLIDAMENTO_BASE" ? clamp((targetPct - pack.passiveCentral) / baseSpan, 0, 1) : regime === "INERZIA_COPERTA" ? 0 : 1,
    klEffort: solved.effort,
    groundingShare: basinVotes > 0 ? groundVotes / basinVotes : 0,
    successProbability: mc.successProbability,
    p10: mc.p10,
    p50: mc.p50,
    p90: mc.p90,
    cvar10: mc.cvar10,
    activeFronts: plans.filter((row) => row.role === "FRONTE_PRIORITARIO").length,
    regions: plans,
    themes,
    network: {
      label: "IPOTESI",
      deltaCommittees,
      deltaMembers,
      electedTarget,
      monthlyCommitteeCap: monthlyCommitteePace,
      monthlyMemberCap,
      monthlyElectedCap,
      monthlyCommitteeNeed,
      monthlyMemberNeed,
      monthlyElectedNeed,
    },
    checkpoints: checkpoints(pack.currentPct, finalPct, input.horizonDays),
    methodNote: beyondFrontier
      ? "La macchina organizzativa e tematica copre il tratto endogeno. La quota residua chiede fattori politici acceleratori ed è un'ipotesi, non una nuova simulazione del modello."
      : pack.extendedHorizon
        ? "Orizzonte esteso a 360 giorni: stima conservativa sulle tappe a 30, 90 e 180 giorni. Il riparto oltre lo scenario offensivo è un'ipotesi, non una nuova previsione."
        : "Il surplus oltre lo scenario offensivo è un'allocazione d'ipotesi. La traiettoria stimata resta fissa e non viene ricalcolata.",
  };
}
