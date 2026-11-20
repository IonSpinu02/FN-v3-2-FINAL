/**
 * Motore di previsione elettorale v4.0 — Futuro Nazionale.
 *
 * Il punto di partenza S0 è il consenso nazionale del riquadro 01 (stima FN_DAILY_V2 o S impostata).
 * Ogni orizzonte è S0 più sette contributi additivi; i contributi sono arrotondati al centesimo
 * con il metodo dei resti, così la somma mostrata coincide col risultato. L'ottavo fattore è il
 * cono di incertezza lo10–hi90.
 *
 * Fattori:
 *  1. momentum filtrato (Kalman local-level + effetto istituto) e rientro verso il livello filtrato
 *  2. agenda e temi posseduti (salienza × possesso × copertura B.I.P. × elasticità)
 *  3. bacini contendibili FdI/Lega (costo del governare, crisi d'identità degli alleati)
 *  4. rete sul territorio (tesserati, comitati, entropia di Shannon)
 *  5. magnete istituzionale (presenze attuali, what-if, profili «+ Simula»)
 *  6. ciclo elettorale (manovra, inverno, mobilitazione dall'astensione)
 *  7. pavimento convesso e tetto di assorbimento
 *  8. cono di incertezza (sondaggi, storia, modello) calibrato sull'errore reale
 */

import pollReleasesFile from "../../../data/poll_releases.json";
import configFile from "../../../data/config_v3_2.json";
import scenarioFile from "../../../data/risultati_v3_2.json";
import { BIP_CHAPTERS } from "@/lib/bipProgramCatalog";
import { REGIONAL_PARTY_HISTORY, TOPIC_ELASTICITY } from "@/lib/fnProgramAndAffinityEngine";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { COCKPIT_TIER_VERDE } from "@/lib/osservatorioCockpitTiers";
import { REGIONS, type Region } from "./constants";
import {
  allocateVotesAcrossRegions,
  checkMonthlyCapacity,
  macroAreaOfRegion,
  runCorrelatedMonteCarlo,
  splitVotesIntoBasins,
  type BasinId,
} from "./territorialAllocationCore";
import {
  DEFAULT_FLUSSI_MATRIX_ID,
  detectFlussiMatrixId,
  flussiFromMatrix,
  type FlussiIpsos,
  type FlussiMatrixId,
} from "./flussiMatrices";
import {
  computeFnNationalAggregate,
  normalizeToUtcNoon,
  toValidDate,
} from "./fnNationalAggregate";
export { toValidDate } from "./fnNationalAggregate";
import { getCalibrationMetrics } from "./forecastCalibrationEngine";
import {
  consensusSlopePpPerMonth,
  dailyDiffusionSigma,
  dampedSlopePp,
  FALLBACK_SIGMA_PER_SQRT_DAY,
  isoDaysBetween,
  sortedConsensusPoints,
  type ConsensusPoint,
} from "./growthMath";
import type { PollRelease } from "./pollTypes";

export const FORECAST_V4_MODEL_ID = "FN_FORECAST_V4" as const;
export const FORECAST_V4_LABEL = "Modello v4.0 · 8 fattori";

// —— Costanti del modello (fonte o ipotesi dichiarata) ——

/** Momentum: pesi delle due finestre di pendenza e costante di decadimento dell'inerzia. */
const SLOPE_SHORT_DAYS = 21;
const SLOPE_LONG_DAYS = 60;
const SLOPE_SHORT_WEIGHT = 0.7;
const INERTIA_TAU_DAYS = 28;
const MOMENTUM_CAP_PP = 1.5;
const STABILITY_DAYS = 15;
const STABILITY_MIN_PP = 0.15;
const REVERSION_TAU_DAYS = 21;
/** Oltre questa distanza dal misurato, S0 è un'ipotesi dell'utente: niente rientro. */
const MEASURED_S0_TOLERANCE_PP = 0.3;

/** Kalman: rumore delle osservazioni. */
const SUPERMEDIA_SD_PP = 0.2;
const POLL_DESIGN_EFFECT = 1.6;
const HOUSE_RESIDUAL_SD_PP = 0.25;
const HOUSE_SHRINK_K = 2;
const DEFAULT_POLL_N = 1000;
const VOLATILITY_WINDOW_DAYS = 90;

/** Agenda: resa massima in pp e tempo di accumulo del priming. */
const AGENDA_YIELD_PP = 0.4;
const AGENDA_TAU_DAYS = 75;
const NEWS_SALIENCE_WEIGHT = 0.3;

/** Costo del governare: −2,25 pp per legislatura ≈ −0,64 pp/anno (Nannestad–Paldam). */
const COST_OF_RULING_PP_YEAR = 0.64;
const BUDGET_SEASON_MULTIPLIER = 1.3;
const ALLY_CRISIS_PP = 0.1;
const ALLY_CRISIS_TAU_DAYS = 30;

/** Rete: un voto ogni 20 contatti (Gerber–Green, elezioni ad alta affluenza). */
const VOTES_PER_CONTACT = 1 / 20;
const CONTACTS_PER_MEMBER_DEFAULT = 0.4;

/** Magnete: 2.000 voti per punto carica (deputato = 5 punti ≈ 85.000 voti di collegio × 22% personali × 55% trasferiti). */
const VOTES_PER_INSTITUTIONAL_POINT = 2000;
const LATENT_TRANSFER_SHARE = 0.15;
const LATENT_TRANSFER_DAYS = 180;
const ENTRY_REALIZATION_TAU_DAYS = 45;
const PROFILE_SUB_LABEL = "Profili «+ Simula»";

/** Ciclo: compensazione B.I.P. della manovra e riferimento della quota astenuti. */
const ABSTENTION_REFERENCE_SHARE = 0.36;

/** Pavimento e tetto. */
const SOFT_FLOOR_PCT = 6.8;
const CONTESTABLE_CDX_SHARE = 0.1;
const ABSTENTION_POOL_PP = 2;
const CEILING_TAU_DAYS = 90;

/** Cono: z al 90° percentile, esponente dell'orizzonte, quota d'incertezza dei fattori strutturali. */
const Z80 = 1.2816;
const HORIZON_EXPONENT = 0.55;
const STRUCTURAL_UNCERTAINTY_SHARE = 0.35;
const MOMENTUM_UNCERTAINTY_SHARE = 0.5;
const MIN_POLL_SIGMA_PP = 0.15;
const DEFAULT_POLL_SIGMA_PP = 0.35;

export const FORECAST_V4_SOURCES = {
  supermedia: { label: "Supermedia YouTrend/AGI", url: "https://www.youtrend.it/la-supermedia/" },
  eurobarometro: {
    label: "Eurobarometro Standard 104 · Rapporto Italia (autunno 2025)",
    url: "https://italy.representation.ec.europa.eu/document/download/43a46ab1-cf7e-4ced-9d61-d497b59b81b9_it?filename=National_Report_Edition_2025_IT_v2.pdf",
  },
  petrocik: { label: "Petrocik (1996), Issue Ownership in Presidential Elections, AJPS 40(3)" },
  costOfRuling: {
    label: "Nannestad & Paldam, The Cost of Ruling",
    url: "http://www.martin.paldam.dk/Papers/Gamle/Cost-of-ruling.PDF",
  },
  canvassingLocal: {
    label: "Green, Gerber & Nickerson (2003), Journal of Politics",
    url: "https://campaigninnovation.org/files/green-gerber-nickerson-jop-2003.pdf",
  },
  canvassingPnas: {
    label: "Gerber & Green (1999), PNAS",
    url: "https://www.pnas.org/doi/full/10.1073/pnas.96.19.10939",
  },
  manovra: {
    label: "Legge 196/2009 (sessione di bilancio)",
    url: "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2009-12-31;196",
  },
  europeePreferenze: {
    label: "Ministero dell'Interno · Europee 2024 · preferenze circoscrizione FN",
    url: "https://elezioni.interno.gov.it/",
  },
} as const;

// —— Tipi pubblici ——

export type ForecastScenarioId = "passivo" | "base" | "offensiva";
export const FORECAST_SCENARIO_ORDER: ForecastScenarioId[] = ["passivo", "base", "offensiva"];

export type ForecastHorizonKey = "d30" | "d90" | "d180";

export type ForecastFactorId =
  | "momentum"
  | "agenda"
  | "donor"
  | "ground"
  | "magnet"
  | "cycle"
  | "bounds";

export const FORECAST_FACTOR_ORDER: ForecastFactorId[] = [
  "momentum",
  "agenda",
  "donor",
  "ground",
  "magnet",
  "cycle",
  "bounds",
];

/** Fattori che non dipendono da input esterni: non devono mai valere zero. */
export const STRUCTURAL_FACTOR_IDS: ForecastFactorId[] = [
  "agenda",
  "donor",
  "ground",
  "magnet",
  "cycle",
];

export type ForecastProvenance = "dati" | "ipotesi" | "misto";

export type ForecastFactorRow = {
  id: ForecastFactorId;
  n: number;
  label: string;
  short: string;
  /** Contributo al centesimo: la somma delle righe più S0 è il risultato. */
  pp: number;
  rawPp: number;
  note: string;
  /** Per chi non è del mestiere: niente sigle né formule. */
  plain: string;
  provenance: ForecastProvenance;
  sources: { label: string; url?: string }[];
  sub: { label: string; pp: number }[];
};

export type ForecastSigma = { poll: number; hist: number; model: number; total: number };

export type ForecastHorizonResult = {
  key: ForecastHorizonKey | "custom";
  label: string;
  days: number;
  startPct: number;
  centralPct: number;
  deltaPp: number;
  lo10Pct: number;
  hi90Pct: number;
  sigma: ForecastSigma;
  factors: ForecastFactorRow[];
  uncertaintyNote: string;
  uncertaintyPlain: string;
};

export type ForecastScenarioResult = {
  id: ForecastScenarioId;
  label: string;
  tagline: string;
  horizons: ForecastHorizonResult[];
};

export type ForecastPoll = {
  institute: string;
  fieldEnd: string;
  fnPct: number;
  sampleSize?: number;
  id?: string;
  publishedAt?: string;
  sourceUrl?: string;
};

export type ForecastRegionInput = {
  regione: Region;
  /** Quota FN di oggi nella regione, in punti (0–100). */
  sharePct: number;
  elettori: number;
  validi: number;
  tesserati: number;
  puntiIstituzionali: number;
};

export type SimulatedEntryProfile = {
  id: string;
  nome: string;
  ruolo: string;
  regione: Region;
  votiPortati: number;
};

export type ForecastNetworkDelta = { comitati: number; tesserati: number };

export type ForecastIngressi = { dep: number; creg: number; sind: number; com?: number };

export type ForecastV4Input = {
  /** Accetta anche stringhe ISO (payload JSON / cache) — normalizzate in prepareContext. */
  asOf?: Date | string;
  /** S0 in punti percentuali. Se manca: FN_DAILY_V2 sui sondaggi, poi ultima Supermedia. */
  startPct?: number;
  history?: ConsensusPoint[];
  polls?: ForecastPoll[];
  /** true se il punto della serie alla data `asOf` è un'osservazione vera (backtest). */
  startIsObservation?: boolean;
  newsHeadlines?: string[];
  /** Tono medio dei titoli, −1…+1. */
  newsScore?: number;
  flussi?: FlussiIpsos;
  regions?: ForecastRegionInput[];
  tesserati?: number;
  comitati?: number;
  networkDelta?: ForecastNetworkDelta;
  /** Ingressi aggiuntivi rispetto alle presenze delle righe (deputati, consiglieri, sindaci). */
  ingressi?: ForecastIngressi;
  profiles?: SimulatedEntryProfile[];
  validiNazionali?: number;
  /** Moltiplicatore dello sforzo su agenda, bacini e rete (1 = scenario calibrato). */
  effort?: number;
};

export type ForecastDiagnostics = {
  levelPct: number;
  levelSdPp: number;
  slopeShortPpMonth: number;
  slopeLongPpMonth: number;
  momentumPpMonth: number;
  stable15: boolean;
  momentumNeutralized: boolean;
  s0Measured: boolean;
  aggregatePct: number | null;
  houseEffects: { institute: string; pp: number; polls: number }[];
  observations: { supermedia: number; polls: number };
  sigmaS0Pp: number;
  sigmaDailyPp: number;
  sigmaMonthPp: number;
  calibrationMaePp: number;
  agendaIndex: number;
  salience: Record<AgendaThemeId, number>;
  newsThemeHits: Record<AgendaThemeId, number>;
  tensionIndex: number;
  flussiMatrixId: FlussiMatrixId | null;
  donorShare: number;
  abstentionShare: number;
  tesserati: number;
  comitati: number;
  shannonH: number;
  comitatiDensityFactor: number;
  institutionalPoints: number;
  institutionalPointsBaseline: number;
  simulatedEntryVotes: number;
  hardFloorPct: number;
  softFloorPct: number;
  contestablePoolPp: number;
  validiNazionali: number;
};

export type ForecastV4Result = {
  modelId: typeof FORECAST_V4_MODEL_ID;
  asOf: string;
  startPct: number;
  startSource: "input" | "aggregato" | "serie";
  diagnostics: ForecastDiagnostics;
  scenarios: Record<ForecastScenarioId, ForecastScenarioResult>;
  base: ForecastScenarioResult;
};

// —— Dati statici di riserva: il motore non lavora mai su array vuoti ——

type ScenarioRowJson = {
  regione: string;
  validi2024: number;
  FdI2024: number;
  Lega2024: number;
  elettori_ricostruiti: number;
  iscritti: number;
  punti_istituzionali: number;
  stima: number;
};

const SCENARIO_ROWS = (scenarioFile as { righe: ScenarioRowJson[] }).righe;
const SCENARIO_S_PCT = (scenarioFile as { parametri: { S: number } }).parametri.S * 100;
const SCENARIO_PARAMS = (scenarioFile as {
  parametri: { iscritti_attribuiti: number; comitati: number; validi2024: number };
}).parametri;

type ConfigJson = {
  preferenze_totali: number;
  presenze_istituzionali: Record<"dep" | "creg" | "sind" | "com", Record<string, number>>;
  punteggi_cariche: Record<"dep" | "creg" | "sind" | "com", number>;
};
const CONFIG = configFile as ConfigJson;

export const FN_PREFERENZE_EUROPEE_2024 = CONFIG.preferenze_totali;

function isRegion(value: string): value is Region {
  return (REGIONS as readonly string[]).includes(value);
}

const BASELINE_POINTS_BY_REGION: Map<Region, number> = (() => {
  const out = new Map<Region, number>();
  for (const role of ["dep", "creg", "sind", "com"] as const) {
    const pts = CONFIG.punteggi_cariche[role];
    for (const [regione, count] of Object.entries(CONFIG.presenze_istituzionali[role])) {
      if (!isRegion(regione)) continue;
      out.set(regione, (out.get(regione) ?? 0) + count * pts);
    }
  }
  return out;
})();

const BASELINE_COUNTS = (["dep", "creg", "sind", "com"] as const).reduce(
  (acc, role) => {
    acc[role] = Object.values(CONFIG.presenze_istituzionali[role]).reduce((s, n) => s + n, 0);
    return acc;
  },
  { dep: 0, creg: 0, sind: 0, com: 0 } as Record<"dep" | "creg" | "sind" | "com", number>,
);

const CDX_2024_SHARE_PCT = (() => {
  const validi = SCENARIO_ROWS.reduce((s, r) => s + r.validi2024, 0);
  const cdx = SCENARIO_ROWS.reduce((s, r) => s + r.FdI2024 + r.Lega2024, 0);
  return validi > 0 ? (cdx / validi) * 100 : 37.8;
})();

export function staticForecastPolls(): ForecastPoll[] {
  return (pollReleasesFile as { releases: ForecastPoll[] }).releases.map((r) => ({ ...r }));
}

export function staticForecastRegions(startPct?: number): ForecastRegionInput[] {
  const scale = startPct != null && SCENARIO_S_PCT > 0 ? startPct / SCENARIO_S_PCT : 1;
  return SCENARIO_ROWS.filter((r) => isRegion(r.regione)).map((r) => ({
    regione: r.regione as Region,
    sharePct: r.stima * 100 * scale,
    elettori: r.elettori_ricostruiti,
    validi: r.validi2024,
    tesserati: r.iscritti,
    puntiIstituzionali: r.punti_istituzionali,
  }));
}

/** Righe dello scenario live (e sondaggio regionale, se c'è) → input regionale del motore. */
export function forecastRegionsFromScenario(
  rows: readonly {
    regione: Region;
    stima: number;
    elettori_ricostruiti: number;
    validi2024: number;
    iscritti: number;
    punti_istituzionali: number;
  }[],
  poll?: readonly { regione: Region; piHat: number }[],
): ForecastRegionInput[] {
  const pollShare = new Map((poll ?? []).map((p) => [p.regione, p.piHat]));
  return rows.map((r) => {
    const share = pollShare.get(r.regione) ?? r.stima;
    return {
      regione: r.regione,
      sharePct: finite(share) * 100,
      elettori: finite(r.elettori_ricostruiti),
      validi: finite(r.validi2024),
      tesserati: finite(r.iscritti),
      puntiIstituzionali: finite(r.punti_istituzionali),
    };
  });
}

function staticHistory(): ConsensusPoint[] {
  return FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({ isoDate: p.isoDate, pct: p.pct }));
}

// —— Utilità numeriche ——

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Stesso arrotondamento del riquadro 01 (`toFixed(2)`). */
export function fix2(n: number): number {
  return Number(finite(n).toFixed(2));
}

function round3(n: number): number {
  return Math.round(finite(n) * 1000) / 1000;
}

function ppIt(n: number, digits = 2): string {
  const v = Math.abs(n) < 0.5 / 10 ** digits ? 0 : n;
  const body = v.toFixed(digits).replace(".", ",");
  return v > 0 ? `+${body}` : v < 0 ? body : `+${body}`;
}

function numIt(n: number, digits = 2): string {
  return n.toFixed(digits).replace(".", ",");
}

/** «il 40%» ma «l'80%», «l'11%», «l'1,5%»: l'articolo segue la pronuncia del numero. */
function ilIt(numText: string, prep: "il" | "al" | "Il" = "il"): string {
  const elided = /^(8|11(?!\d)|1(?!\d))/.test(numText);
  if (!elided) return `${prep} ${numText}`;
  return `${prep === "al" ? "all'" : prep === "Il" ? "L'" : "l'"}${numText}`;
}

function intIt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function isoOf(d: Date | string | number | null | undefined): string {
  return normalizeToUtcNoon(d).toISOString().slice(0, 10);
}

function monthKeyOf(d: Date | string | number | null | undefined): string {
  const valid = toValidDate(d);
  return `${valid.getUTCFullYear()}-${String(valid.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Riconverte date serializzate (JSON) prima di passare l'input al motore. */
export function sanitizeForecastV4Input(input: ForecastV4Input): ForecastV4Input {
  return {
    ...input,
    asOf: toValidDate(input.asOf as Date | string | number | null | undefined),
  };
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export type MonthSlice = {
  key: string;
  year: number;
  month: number;
  days: number;
  /** Quota del mese di calendario coperta dall'orizzonte (0..1). */
  weight: number;
};

/** Giorni dell'orizzonte (da domani) raggruppati per mese di calendario. */
export function forecastMonthSlices(asOf: Date, days: number): MonthSlice[] {
  const start = normalizeToUtcNoon(asOf).getTime();
  const total = Math.max(0, Math.round(days));
  const buckets = new Map<string, MonthSlice>();
  for (let i = 1; i <= total; i++) {
    const d = new Date(start + i * 86_400_000);
    const key = monthKeyOf(d);
    const slice = buckets.get(key);
    if (slice) slice.days += 1;
    else
      buckets.set(key, {
        key,
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        days: 1,
        weight: 0,
      });
  }
  return [...buckets.values()].map((s) => ({
    ...s,
    weight: s.days / daysInMonth(s.year, s.month),
  }));
}

function decay(days: number, tau: number): number {
  return 1 - Math.exp(-Math.max(0, days) / tau);
}

/**
 * Arrotonda al centesimo una lista di contributi in modo che la somma arrotondata
 * coincida con l'arrotondamento della somma (metodo dei resti più grandi).
 */
export function apportionCents(values: number[]): number[] {
  const target = Math.round(values.reduce((s, v) => s + finite(v), 0) * 100);
  const cents = values.map((v) => Math.round(finite(v) * 100));
  let diff = target - cents.reduce((s, c) => s + c, 0);
  const order = values
    .map((v, i) => ({ i, err: finite(v) * 100 - cents[i]! }))
    .sort((a, b) => (diff > 0 ? b.err - a.err : a.err - b.err));
  let k = 0;
  while (diff !== 0 && order.length > 0) {
    const idx = order[k % order.length]!.i;
    const step = diff > 0 ? 1 : -1;
    cents[idx] = cents[idx]! + step;
    diff -= step;
    k += 1;
  }
  return cents.map((c) => c / 100);
}

// —— Fattore 1: filtro di Kalman local-level con effetto istituto ——

type KalmanObs = { day: number; y: number; r: number; houseKey: string | null };

type KalmanRun = {
  filtMean: number[];
  filtVar: number[];
  smoothMean: number[];
};

function kalmanLocalLevel(
  obs: KalmanObs[],
  nDays: number,
  q: number,
  house: Map<string, number>,
): KalmanRun {
  const byDay = new Map<number, KalmanObs[]>();
  for (const o of obs) {
    const list = byDay.get(o.day);
    if (list) list.push(o);
    else byDay.set(o.day, [o]);
  }
  const adjusted = (o: KalmanObs) => o.y - (o.houseKey ? (house.get(o.houseKey) ?? 0) : 0);
  let m = obs.length > 0 ? adjusted(obs[0]!) : 0;
  let v = 1;
  const fm: number[] = [];
  const fv: number[] = [];
  const pm: number[] = [];
  const pv: number[] = [];
  for (let d = 0; d <= nDays; d++) {
    if (d > 0) v += q;
    pm.push(m);
    pv.push(v);
    for (const o of byDay.get(d) ?? []) {
      const k = v / (v + o.r);
      m += k * (adjusted(o) - m);
      v *= 1 - k;
    }
    fm.push(m);
    fv.push(v);
  }
  const sm = [...fm];
  for (let d = nDays - 1; d >= 0; d--) {
    const c = fv[d]! / pv[d + 1]!;
    sm[d] = fm[d]! + c * (sm[d + 1]! - pm[d + 1]!);
  }
  return { filtMean: fm, filtVar: fv, smoothMean: sm };
}

function olsSlopePerDay(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i]! - meanY);
    den += (i - meanX) ** 2;
  }
  return den > 0 ? num / den : 0;
}

function pollObservationVariance(pct: number, n: number): number {
  const p = clamp(pct / 100, 0.005, 0.5);
  return ((p * (1 - p)) / n) * 1e4 * POLL_DESIGN_EFFECT + HOUSE_RESIDUAL_SD_PP ** 2;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

type MomentumState = {
  levelPct: number;
  levelSdPp: number;
  slopeShortPerDay: number;
  slopeLongPerDay: number;
  momentumPerDay: number;
  stable15: boolean;
  momentumNeutralized: boolean;
  houseEffects: { institute: string; pp: number; polls: number }[];
  observations: { supermedia: number; polls: number };
  sigmaDailyPp: number;
};

function volatilityDailySigma(history: ConsensusPoint[], asOfIso: string): number {
  const sorted = sortedConsensusPoints(history);
  let sum = 0;
  let n = 0;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!;
    const b = sorted[i]!;
    if (isoDaysBetween(a.isoDate, asOfIso) > VOLATILITY_WINDOW_DAYS) continue;
    const days = Math.max(1, isoDaysBetween(a.isoDate, b.isoDate));
    sum += (b.pct - a.pct) ** 2 / days;
    n += 1;
  }
  if (n >= 2) return Math.sqrt(sum / n);
  return sorted.length >= 2 ? dailyDiffusionSigma(sorted) : FALLBACK_SIGMA_PER_SQRT_DAY;
}

const momentumCache = new Map<string, MomentumState>();

function computeMomentumState(
  history: ConsensusPoint[],
  polls: ForecastPoll[],
  asOfIso: string,
  fallbackLevel: number,
): MomentumState {
  const cacheKey = JSON.stringify([asOfIso, fallbackLevel, history, polls]);
  const cached = momentumCache.get(cacheKey);
  if (cached) return cached;

  const sigmaDaily = volatilityDailySigma(history, asOfIso);
  const q = clamp(sigmaDaily ** 2, 0.0025, 0.04);
  const knownN = polls.map((p) => p.sampleSize).filter((n): n is number => n != null && n > 0);
  const nDefault = median(knownN) ?? DEFAULT_POLL_N;

  const dates = [...history.map((p) => p.isoDate), ...polls.map((p) => p.fieldEnd)].sort();
  const originIso = dates[0];
  if (!originIso) {
    const empty: MomentumState = {
      levelPct: fallbackLevel,
      levelSdPp: DEFAULT_POLL_SIGMA_PP,
      slopeShortPerDay: 0,
      slopeLongPerDay: 0,
      momentumPerDay: 0,
      stable15: true,
      momentumNeutralized: false,
      houseEffects: [],
      observations: { supermedia: 0, polls: 0 },
      sigmaDailyPp: sigmaDaily,
    };
    momentumCache.set(cacheKey, empty);
    return empty;
  }
  const nDays = Math.max(0, Math.round(isoDaysBetween(originIso, asOfIso)));
  const dayOf = (iso: string) => clamp(Math.round(isoDaysBetween(originIso, iso)), 0, nDays);

  const obs: KalmanObs[] = [
    ...history.map((p) => ({
      day: dayOf(p.isoDate),
      y: p.pct,
      r: SUPERMEDIA_SD_PP ** 2,
      houseKey: null,
    })),
    ...polls.map((p) => ({
      day: dayOf(p.fieldEnd),
      y: p.fnPct,
      r: pollObservationVariance(p.fnPct, p.sampleSize && p.sampleSize > 0 ? p.sampleSize : nDefault),
      houseKey: p.institute.trim().toLowerCase(),
    })),
  ].sort((a, b) => a.day - b.day);

  const firstPass = kalmanLocalLevel(obs, nDays, q, new Map());
  const residuals = new Map<string, { sum: number; n: number; label: string }>();
  for (const p of polls) {
    const key = p.institute.trim().toLowerCase();
    const row = residuals.get(key) ?? { sum: 0, n: 0, label: p.institute.trim() };
    row.sum += p.fnPct - firstPass.smoothMean[dayOf(p.fieldEnd)]!;
    row.n += 1;
    residuals.set(key, row);
  }
  const rawHouse = [...residuals.entries()].map(([key, r]) => ({
    key,
    label: r.label,
    n: r.n,
    h: r.sum / (r.n + HOUSE_SHRINK_K),
  }));
  const totalN = rawHouse.reduce((s, h) => s + h.n, 0);
  const center = totalN > 0 ? rawHouse.reduce((s, h) => s + h.h * h.n, 0) / totalN : 0;
  const house = new Map(rawHouse.map((h) => [h.key, h.h - center]));
  const run = kalmanLocalLevel(obs, nDays, q, house);

  const T = nDays;
  const sm = run.smoothMean;
  const window = (len: number) => sm.slice(Math.max(0, T - len), T + 1);
  const slopeShort = olsSlopePerDay(window(SLOPE_SHORT_DAYS));
  const slopeLong = olsSlopePerDay(window(SLOPE_LONG_DAYS));
  let momentum = SLOPE_SHORT_WEIGHT * slopeShort + (1 - SLOPE_SHORT_WEIGHT) * slopeLong;
  const levelSd = Math.sqrt(Math.max(0, run.filtVar[T]!));
  const past = sm[Math.max(0, T - STABILITY_DAYS)]!;
  const stable15 = Math.abs(sm[T]! - past) <= Math.max(STABILITY_MIN_PP, levelSd);
  let neutralized = false;
  if (stable15 && momentum < 0) {
    momentum = 0;
    neutralized = true;
  }

  const state: MomentumState = {
    levelPct: run.filtMean[T]!,
    levelSdPp: levelSd,
    slopeShortPerDay: slopeShort,
    slopeLongPerDay: slopeLong,
    momentumPerDay: momentum,
    stable15,
    momentumNeutralized: neutralized,
    houseEffects: rawHouse
      .map((h) => ({ institute: h.label, pp: round3(house.get(h.key) ?? 0), polls: h.n }))
      .sort((a, b) => a.pp - b.pp),
    observations: { supermedia: history.length, polls: polls.length },
    sigmaDailyPp: sigmaDaily,
  };
  if (momentumCache.size > 64) momentumCache.clear();
  momentumCache.set(cacheKey, state);
  return state;
}

// —— Fattore 2: agenda e temi posseduti ——

export type AgendaThemeId = "sicurezza" | "fisco" | "potere" | "sanita";

type AgendaTheme = {
  id: AgendaThemeId;
  label: string;
  /** Quota di italiani che citano il tema tra i due più importanti (Eurobarometro 104). */
  eurobarometro: number;
  /** Possesso del tema per FN (ipotesi di modello, Petrocik). */
  ownership: number;
  chapters: number[];
  elasticityKey: keyof typeof TOPIC_ELASTICITY;
  pattern: RegExp;
};

const AGENDA_THEMES: AgendaTheme[] = [
  {
    id: "sicurezza",
    label: "Sicurezza, confini e immigrazione",
    eurobarometro: 0.29,
    ownership: 0.9,
    chapters: [5, 7, 8, 10],
    elasticityKey: "SICUREZZA",
    pattern:
      /sicurezz|immigra|migrant|sbarc|confin|rotta balcanica|clandestin|criminal|rapin|furt|accoltell|baby gang|degrado|cpr|rimpatri|remigra|espuls|ius scholae|cittadinanza|\bong\b/i,
  },
  {
    id: "fisco",
    label: "Fisco, partite IVA, energia e industria",
    eurobarometro: 0.37,
    ownership: 0.55,
    chapters: [1, 2, 3, 9, 11],
    elasticityKey: "LAVORO",
    pattern:
      /fisc|tasse|irpef|\biva\b|partit[ae] iva|flat tax|cuneo|manovra|pension|bollett|energia|\bgas\b|nucleare|automotive|stellantis|industria|cassa integrazione|licenziament|\bpmi\b|impres/i,
  },
  {
    id: "potere",
    label: "Potere d'acquisto, mutui e casa",
    eurobarometro: 0.31,
    ownership: 0.45,
    chapters: [4, 13, 14],
    elasticityKey: "COSTO_VITA",
    pattern:
      /prezz|inflaz|caro ?vita|carovita|stipend|salar|mutu|affitt|\bcasa\b|case popolari|ceto medio|potere d.acquisto|carrello|spesa/i,
  },
  {
    id: "sanita",
    label: "Sanità, liste d'attesa e welfare familiare",
    eurobarometro: 0.1,
    ownership: 0.25,
    chapters: [12, 13],
    elasticityKey: "SANITA",
    pattern: /sanit|ospedal|liste d.attesa|pronto soccorso|medic|\basl\b|welfare|natalit|famigli/i,
  },
];

const BIP_MEASURES_BY_THEME: Record<AgendaThemeId, number> = (() => {
  const out = {} as Record<AgendaThemeId, number>;
  for (const theme of AGENDA_THEMES) {
    out[theme.id] = BIP_CHAPTERS.filter((c) => theme.chapters.includes(c.num)).reduce(
      (s, c) => s + c.flagMeasures.length,
      0,
    );
  }
  return out;
})();

const BIP_MAX_THEME_MEASURES = Math.max(1, ...Object.values(BIP_MEASURES_BY_THEME));

const MAJORITY_TENSION_PATTERN =
  /tension|scontr|litig|frattur|spaccat|frizion|crisi di governo|rimpasto|ultimatum|veto|maggioranza divisa|resa dei conti|salvini.{0,40}meloni|meloni.{0,40}salvini|tajani.{0,40}salvini|salvini.{0,40}tajani/i;

type AgendaState = {
  salience: Record<AgendaThemeId, number>;
  hits: Record<AgendaThemeId, number>;
  coverage: Record<AgendaThemeId, number>;
  index: number;
  tone: number;
  tensionIndex: number;
};

function analyzeAgenda(headlines: string[], _newsScore: number, salienceBoost: number): AgendaState {
  const hits = { sicurezza: 0, fisco: 0, potere: 0, sanita: 0 } as Record<AgendaThemeId, number>;
  let tensionHits = 0;
  for (const raw of headlines) {
    const h = raw.trim();
    if (!h) continue;
    for (const theme of AGENDA_THEMES) if (theme.pattern.test(h)) hits[theme.id] += 1;
    if (MAJORITY_TENSION_PATTERN.test(h)) tensionHits += 1;
  }
  const totalHits = Object.values(hits).reduce((s, n) => s + n, 0);
  const ebMass = AGENDA_THEMES.reduce((s, t) => s + t.eurobarometro, 0);
  const salience = {} as Record<AgendaThemeId, number>;
  const coverage = {} as Record<AgendaThemeId, number>;
  let index = 0;
  for (const theme of AGENDA_THEMES) {
    const newsShare = totalHits > 0 ? (hits[theme.id] / totalHits) * ebMass : theme.eurobarometro;
    const base =
      totalHits > 0
        ? (1 - NEWS_SALIENCE_WEIGHT) * theme.eurobarometro + NEWS_SALIENCE_WEIGHT * newsShare
        : theme.eurobarometro;
    const boosted =
      base + (theme.id === "sicurezza" || theme.id === "fisco" ? salienceBoost : 0);
    salience[theme.id] = boosted;
    coverage[theme.id] = BIP_MEASURES_BY_THEME[theme.id] / BIP_MAX_THEME_MEASURES;
    index +=
      boosted * theme.ownership * coverage[theme.id] * TOPIC_ELASTICITY[theme.elasticityKey];
  }
  return {
    salience,
    hits,
    coverage,
    index,
    tone: 0,
    tensionIndex: 1 + Math.min(1, 0.25 * tensionHits),
  };
}

// —— Fattore 4: rete sul territorio ——

/** Contatti medi per tesserato nel mese (rampa di campagna verso maggio 2027). */
const GROUND_CONTACTS_PER_MEMBER: Record<string, number> = {
  "2026-11": 0.5,
  "2026-12": 0.4,
  "2027-01": 0.6,
  "2027-02": 0.8,
  "2027-03": 1.0,
  "2027-04": 1.2,
  "2027-05": 1.5,
};

function shannonNormalized(values: number[]): number {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  const positive = values.filter((v) => v > 0);
  if (total <= 0 || positive.length < 2) return 0;
  let h = 0;
  for (const v of positive) {
    const p = v / total;
    h -= p * Math.log(p);
  }
  return h / Math.log(values.length);
}

// —— Fattore 6: ciclo elettorale ——

type CyclePhase = "autunno" | "inverno" | "primavera" | "fuori";

const CYCLE_MONTHS: Record<string, { phase: CyclePhase; basePp: number; label: string }> = {
  "2026-11": { phase: "autunno", basePp: -0.08, label: "nov · manovra" },
  "2026-12": { phase: "autunno", basePp: -0.05, label: "dic · fine manovra" },
  "2027-01": { phase: "inverno", basePp: 0.02, label: "gen · posizionamento" },
  "2027-02": { phase: "inverno", basePp: 0.02, label: "feb · quadri territoriali" },
  "2027-03": { phase: "primavera", basePp: 0.05, label: "mar · mobilitazione" },
  "2027-04": { phase: "primavera", basePp: 0.07, label: "apr · mobilitazione" },
  "2027-05": { phase: "primavera", basePp: 0.09, label: "mag · mobilitazione" },
};

/** Stagionalità fuori dal calendario elettorale 2026–27 (solo per backtest e date diverse). */
const GENERIC_MONTH_PP: Record<number, number> = {
  1: 0.01,
  2: 0.01,
  3: 0.01,
  4: 0.01,
  5: 0.01,
  6: -0.01,
  7: -0.02,
  8: -0.03,
  9: 0.01,
  10: -0.01,
  11: -0.08,
  12: -0.05,
};

export type CycleMonthOptions = {
  abstentionShare: number;
  fiscalCoverage: number;
  compensation: number;
  springMultiplier?: number;
};

/** Contributo del ciclo per un mese intero (pp), secondo la fase del calendario. */
export function cycleMonthPp(monthKey: string, opts: CycleMonthOptions): number {
  const entry = CYCLE_MONTHS[monthKey];
  if (!entry) {
    const month = Number(monthKey.slice(5, 7));
    return GENERIC_MONTH_PP[month] ?? 0;
  }
  if (entry.phase === "autunno") {
    return entry.basePp * (1 - clamp(opts.compensation * opts.fiscalCoverage, 0, 0.9));
  }
  if (entry.phase === "primavera") {
    return (
      entry.basePp *
      (opts.abstentionShare / ABSTENTION_REFERENCE_SHARE) *
      (opts.springMultiplier ?? 1)
    );
  }
  return entry.basePp;
}

export function cycleMonthLabel(monthKey: string): string | null {
  return CYCLE_MONTHS[monthKey]?.label ?? null;
}

// —— Fattore 7: pavimento convesso e tetto ——

function applyFloor(level: number, shock: number, hardFloor: number, softFloor: number): number {
  if (shock >= 0) return level + shock;
  let l0 = level;
  let s = shock;
  if (l0 > softFloor) {
    const free = l0 - softFloor;
    if (-s <= free) return l0 + s;
    s += free;
    l0 = softFloor;
  }
  // Partenza già sotto lo zoccolo duro: il pavimento scende con il livello, mai sopra di esso.
  const floor = l0 > hardFloor + 1e-6 ? hardFloor : l0 * 0.5;
  const d = Math.max(0.5, softFloor - floor);
  const u0 = Math.max(1e-6, l0 - floor);
  const u = 1 / (1 / u0 + -s / (d * d));
  return floor + u;
}

function applyCeiling(delta: number, capPp: number): number {
  if (delta <= 0 || capPp <= 0) return delta;
  return capPp * Math.tanh(delta / capPp);
}

// —— Scenari ——

type ScenarioProfile = {
  label: string;
  tagline: string;
  agenda: number;
  salienceBoost: number;
  donor: number;
  ground: number;
  verdeBoost: number;
  compensation: number;
  springMultiplier: number;
};

/**
 * Tasso ipotizzato di intercettazione sui flussi in uscita dal centrodestra:
 * P(FN | uscita CDX). NON confonderlo con P(origine CDX | voto FN) della matrice.
 * Range dichiarato: passivo conservativo → offensiva più alta; il resto disperde
 * verso astensione e altri partiti.
 */
export const CDX_EXIT_INTERCEPTION_RATE: Record<
  ForecastScenarioId,
  { rate: number; lo: number; hi: number; label: string }
> = {
  passivo: { rate: 0.08, lo: 0.04, hi: 0.12, label: "conservativo" },
  base: { rate: 0.18, lo: 0.1, hi: 0.28, label: "moderato" },
  offensiva: { rate: 0.32, lo: 0.2, hi: 0.45, label: "elevato (scenario)" },
};

const SCENARIO_PROFILES: Record<ForecastScenarioId, ScenarioProfile> = {
  passivo: {
    label: "Passivo · se restiamo fermi",
    tagline: "Nessuna iniziativa nuova: temi presidiati a metà, rete al minimo, manovra poco contrastata.",
    agenda: 0.5,
    salienceBoost: 0,
    donor: 0.6,
    ground: 0.35,
    verdeBoost: 0,
    compensation: 0.2,
    springMultiplier: 1,
  },
  base: {
    label: "Base · se continuiamo così",
    tagline: "Il lavoro attuale, con i dati di oggi e le ipotesi dichiarate.",
    agenda: 1,
    salienceBoost: 0,
    donor: 1,
    ground: 1,
    verdeBoost: 0,
    compensation: 0.4,
    springMultiplier: 1,
  },
  offensiva: {
    label: "Offensiva · B.I.P. + territorio",
    tagline:
      "Massima esposizione su sicurezza e fisco, rete rafforzata nelle 8 Regioni Verdi, contro-manovra B.I.P.",
    agenda: 1.25,
    salienceBoost: 0.05,
    donor: 1.25,
    ground: 1,
    verdeBoost: 1,
    compensation: 0.8,
    springMultiplier: 1.15,
  },
};

export function forecastScenarioMeta(id: ForecastScenarioId): { label: string; tagline: string } {
  const p = SCENARIO_PROFILES[id];
  return { label: p.label, tagline: p.tagline };
}

/** Opzioni del ciclo elettorale coerenti con lo scenario (per il calendario mese per mese). */
export function forecastCycleOptions(
  flussi: FlussiIpsos,
  scenarioId: ForecastScenarioId = "base",
): CycleMonthOptions {
  const profile = SCENARIO_PROFILES[scenarioId];
  return {
    abstentionShare: flussi.ast,
    fiscalCoverage: BIP_MEASURES_BY_THEME.fisco / BIP_MAX_THEME_MEASURES,
    compensation: profile.compensation,
    springMultiplier: profile.springMultiplier,
  };
}

// —— Contesto ——

type PreparedContext = {
  asOf: Date;
  asOfIso: string;
  s0: number;
  startSource: ForecastV4Result["startSource"];
  momentum: MomentumState;
  s0Measured: boolean;
  aggregatePct: number | null;
  sigmaS0: number;
  sigmaMonth: number;
  calibrationMae: number;
  headlines: string[];
  newsScore: number;
  flussi: FlussiIpsos;
  flussiMatrixId: FlussiMatrixId | null;
  regions: ForecastRegionInput[];
  tesserati: number;
  comitati: number;
  baseTesserati: number;
  baseComitati: number;
  shannonH: number;
  densityFactor: number;
  verdeTesseratiShare: number;
  verdePermRatio: number;
  institutionalPoints: number;
  baselinePoints: number;
  deltaPoints: number;
  profiles: SimulatedEntryProfile[];
  profileVotes: number;
  validi: number;
  hardFloor: number;
  contestablePool: number;
  effort: number;
};

function toPollRelease(p: ForecastPoll): PollRelease {
  return {
    id: p.id ?? `${p.institute}-${p.fieldEnd}`,
    institute: p.institute,
    fieldEnd: p.fieldEnd,
    publishedAt: p.publishedAt ?? p.fieldEnd,
    fnPct: p.fnPct,
    sampleSize: p.sampleSize,
    sourceUrl: p.sourceUrl,
  };
}

function weightedPollSigma(polls: ForecastPoll[], asOf: Date): number {
  const agg = computeFnNationalAggregate(polls.map(toPollRelease), { asOf });
  if (!agg || agg.pollsUsed.length === 0) return DEFAULT_POLL_SIGMA_PP;
  if (agg.pollsUsed.length === 1) {
    const only = agg.pollsUsed[0]!;
    const n = only.sampleSizeUsed ?? DEFAULT_POLL_N;
    return Math.max(MIN_POLL_SIGMA_PP, Math.sqrt(pollObservationVariance(only.fnPct, n)));
  }
  const sumW = agg.pollsUsed.reduce((s, p) => s + p.weight, 0);
  const sumW2 = agg.pollsUsed.reduce((s, p) => s + p.weight * p.weight, 0);
  const mean = agg.pollsUsed.reduce((s, p) => s + p.weight * p.fnPct, 0) / sumW;
  const variance = agg.pollsUsed.reduce((s, p) => s + p.weight * (p.fnPct - mean) ** 2, 0) / sumW;
  const nEff = sumW2 > 0 ? (sumW * sumW) / sumW2 : 1;
  return Math.max(MIN_POLL_SIGMA_PP, Math.sqrt(variance / Math.max(1, nEff)));
}

function prepareContext(input: ForecastV4Input): PreparedContext {
  const asOf = normalizeToUtcNoon(toValidDate(input.asOf));
  const asOfIso = isoOf(asOf);

  const allPolls = (input.polls ?? staticForecastPolls())
    .filter((p) => Number.isFinite(p.fnPct) && p.fnPct > 0 && p.fieldEnd.slice(0, 10) <= asOfIso && (p.publishedAt ?? p.fieldEnd).slice(0, 10) <= asOfIso)
    .map((p) => ({ ...p, fieldEnd: p.fieldEnd.slice(0, 10) }));
  const rawHistory = sortedConsensusPoints(
    input.history ?? staticHistory(),
  ).filter((p) => p.isoDate <= asOfIso);

  const aggregate = computeFnNationalAggregate(allPolls.map(toPollRelease), { asOf });
  let startSource: ForecastV4Result["startSource"] = "input";
  let rawStart = input.startPct;
  if (rawStart == null || !Number.isFinite(rawStart)) {
    if (aggregate) {
      rawStart = aggregate.fnPct;
      startSource = "aggregato";
    } else {
      rawStart = rawHistory[rawHistory.length - 1]?.pct ?? SCENARIO_S_PCT;
      startSource = "serie";
    }
  }
  const s0 = fix2(rawStart);

  const history = input.startIsObservation
    ? rawHistory
    : rawHistory.filter((p) => !(p.isoDate === asOfIso && Math.abs(p.pct - s0) < 0.006));

  const momentum = computeMomentumState(history, allPolls, asOfIso, s0);
  const reference =
    aggregate?.fnPct ?? (history.length > 0 ? history[history.length - 1]!.pct : null);
  const s0Measured =
    reference == null ? true : Math.abs(s0 - reference) <= MEASURED_S0_TOLERANCE_PP;

  const sigmaS0 = weightedPollSigma(allPolls, asOf);
  const calibrationSeries = history.filter(
    (p) => isoDaysBetween(p.isoDate, asOfIso) <= VOLATILITY_WINDOW_DAYS,
  );
  const calibration = getCalibrationMetrics(
    calibrationSeries.length >= 2 ? calibrationSeries : history,
  );
  const calibrationMae = finite(calibration.maePp);
  const sigmaMonth = Math.max(
    momentum.sigmaDailyPp * Math.sqrt(30.44),
    1.2533 * calibrationMae,
    0.2,
  );

  const flussi = input.flussi ?? flussiFromMatrix(DEFAULT_FLUSSI_MATRIX_ID);
  const regions =
    input.regions && input.regions.length > 0 ? input.regions : staticForecastRegions(s0);

  const regionTesserati = regions.reduce((s, r) => s + Math.max(0, r.tesserati), 0);
  const baseTesserati =
    input.tesserati ?? (regionTesserati > 0 ? regionTesserati : SCENARIO_PARAMS.iscritti_attribuiti);
  const baseComitati = input.comitati ?? SCENARIO_PARAMS.comitati;
  const tesserati = Math.max(0, baseTesserati + (input.networkDelta?.tesserati ?? 0));
  const comitati = Math.max(0, baseComitati + (input.networkDelta?.comitati ?? 0));
  const shannonH = shannonNormalized(regions.map((r) => r.tesserati));
  const refDensity = SCENARIO_PARAMS.comitati / SCENARIO_PARAMS.iscritti_attribuiti;
  const density = tesserati > 0 ? comitati / tesserati : refDensity;
  const densityFactor = clamp(Math.sqrt(density / refDensity), 0.5, 1.5);

  const verde = new Set<Region>(COCKPIT_TIER_VERDE);
  const verdeTesserati = regions
    .filter((r) => verde.has(r.regione))
    .reduce((s, r) => s + r.tesserati, 0);
  const verdeTesseratiShare = regionTesserati > 0 ? verdeTesserati / regionTesserati : 0.5;
  const permOf = (r: Region) => REGIONAL_PARTY_HISTORY[r]?.permeabilitaVannacciScore ?? 50;
  const permAll =
    regionTesserati > 0
      ? regions.reduce((s, r) => s + permOf(r.regione) * r.tesserati, 0) / regionTesserati
      : 50;
  const permVerde =
    verdeTesserati > 0
      ? regions
          .filter((r) => verde.has(r.regione))
          .reduce((s, r) => s + permOf(r.regione) * r.tesserati, 0) / verdeTesserati
      : permAll;
  const verdePermRatio = permAll > 0 ? permVerde / permAll : 1;

  const baselinePoints = [...BASELINE_POINTS_BY_REGION.values()].reduce((s, n) => s + n, 0);
  const rowPoints = regions.reduce((s, r) => s + Math.max(0, r.puntiIstituzionali), 0);
  const ingressiPoints = input.ingressi
    ? Math.max(0, input.ingressi.dep) * CONFIG.punteggi_cariche.dep +
      Math.max(0, input.ingressi.creg) * CONFIG.punteggi_cariche.creg +
      Math.max(0, input.ingressi.sind) * CONFIG.punteggi_cariche.sind +
      Math.max(0, input.ingressi.com ?? 0) * CONFIG.punteggi_cariche.com
    : 0;
  const institutionalPoints = rowPoints + ingressiPoints;
  const deltaPoints = institutionalPoints - baselinePoints;
  const profiles = (input.profiles ?? []).filter((p) => Number.isFinite(p.votiPortati));
  const profileVotes = profiles.reduce((s, p) => s + Math.max(0, p.votiPortati), 0);

  const regionValidi = regions.reduce((s, r) => s + Math.max(0, r.validi), 0);
  const validi =
    input.validiNazionali != null && input.validiNazionali > 0
      ? input.validiNazionali
      : regionValidi > 0
        ? regionValidi
        : SCENARIO_PARAMS.validi2024;
  /**
   * Soglia indicativa di smorzamento (ipotesi): NON somma Europee+tesserati come disgiunti.
   * Assunzione prudenziale: la maggior parte dei tesserati è già inclusa tra gli elettori
   * delle Europee; si aggiunge solo la quota stimata non sovrapposta, tenendo conto del
   * differenziale di partecipazione tra consultazioni.
   */
  const MEMBERSHIP_ALREADY_IN_EUROPEANS = 0.85;
  const PARTICIPATION_DIFFERENTIAL = 0.9;
  const uniqueMemberVotes =
    Math.max(0, tesserati) *
    (1 - MEMBERSHIP_ALREADY_IN_EUROPEANS) *
    PARTICIPATION_DIFFERENTIAL;
  const hardFloor =
    ((FN_PREFERENZE_EUROPEE_2024 + uniqueMemberVotes) / validi) * 100;
  const contestablePool =
    CONTESTABLE_CDX_SHARE * CDX_2024_SHARE_PCT + ABSTENTION_POOL_PP * flussi.ast;

  return {
    asOf,
    asOfIso,
    s0,
    startSource,
    momentum,
    s0Measured,
    aggregatePct: aggregate?.fnPct ?? null,
    sigmaS0,
    sigmaMonth,
    calibrationMae,
    headlines: (input.newsHeadlines ?? []).filter((h) => typeof h === "string" && h.trim()),
    newsScore: finite(input.newsScore ?? 0),
    flussi,
    flussiMatrixId: detectFlussiMatrixId(flussi),
    regions,
    tesserati,
    comitati,
    baseTesserati,
    baseComitati,
    shannonH,
    densityFactor,
    verdeTesseratiShare,
    verdePermRatio,
    institutionalPoints,
    baselinePoints,
    deltaPoints,
    profiles,
    profileVotes,
    validi,
    hardFloor,
    contestablePool,
    effort: clamp(finite(input.effort ?? 1, 1), 0, 3),
  };
}

// —— Valutazione di un orizzonte ——

function matrixLabel(ctx: PreparedContext): string {
  if (ctx.flussiMatrixId === "skytg24_ottobre_2026") return "Sky TG24";
  if (ctx.flussiMatrixId === "ipsos_luglio_2026") return "Ipsos";
  return "matrice personalizzata";
}

function evaluateHorizon(
  ctx: PreparedContext,
  days: number,
  scenarioId: ForecastScenarioId,
  key: ForecastHorizonResult["key"],
  label: string,
): ForecastHorizonResult {
  const profile = SCENARIO_PROFILES[scenarioId];
  const slices = forecastMonthSlices(ctx.asOf, days);
  const mom = ctx.momentum;

  // 1. Momentum filtrato e rientro
  const momentumRaw = clamp(
    mom.momentumPerDay * INERTIA_TAU_DAYS * decay(days, INERTIA_TAU_DAYS),
    -MOMENTUM_CAP_PP,
    MOMENTUM_CAP_PP,
  );
  const gapCap = 2 * ctx.sigmaS0;
  const rho = ctx.sigmaS0 ** 2 / (ctx.sigmaS0 ** 2 + mom.levelSdPp ** 2);
  const reversionRaw = ctx.s0Measured
    ? rho * clamp(mom.levelPct - ctx.s0, -gapCap, gapCap) * decay(days, REVERSION_TAU_DAYS)
    : 0;

  // 2. Agenda
  const agenda = analyzeAgenda(ctx.headlines, ctx.newsScore, profile.salienceBoost);
  const agendaRaw =
    AGENDA_YIELD_PP *
    agenda.index *
    decay(days, AGENDA_TAU_DAYS) *
    (1 + 0.5 * agenda.tone) *
    profile.agenda *
    ctx.effort;

  // 3. Bacini contendibili — probabilità condizionate distinte
  let seasonDays = 0;
  for (const s of slices) {
    seasonDays += s.days * (s.month === 11 || s.month === 12 ? BUDGET_SEASON_MULTIPLIER : 1);
  }
  /** Quota storica di provenienza nel bacino FN: P(origine CDX | voto FN). Solo diagnostica. */
  const provenanceShareFdI = ctx.flussi.FdI;
  const provenanceShareLega = ctx.flussi.Lega;
  const provenanceShareCdx = provenanceShareFdI + provenanceShareLega;
  const attritionPp = COST_OF_RULING_PP_YEAR * (seasonDays / 365);
  const crisisPp = ALLY_CRISIS_PP * agenda.tensionIndex * decay(days, ALLY_CRISIS_TAU_DAYS);
  /** Pressione di uscita dal CDX di governo (pp sul consenso nazionale), prima della dispersione. */
  const cdxExitPressurePp = attritionPp + crisisPp;
  const interception = CDX_EXIT_INTERCEPTION_RATE[scenarioId];
  /**
   * P(FN | uscita CDX): intercetta solo una frazione dello outflow; il resto disperde
   * verso astensione e altri partiti. Non usare provenanceShareCdx come tasso di cattura.
   */
  const donorRaw =
    cdxExitPressurePp * interception.rate * profile.donor * ctx.effort;
  const dispersedPp = cdxExitPressurePp * (1 - interception.rate);
  const donorFromFdI =
    provenanceShareCdx > 0
      ? donorRaw * (provenanceShareFdI / provenanceShareCdx)
      : donorRaw * 0.5;
  const donorShare = provenanceShareCdx;
  const donorFdI = provenanceShareFdI;
  const donorLega = provenanceShareLega;

  // 4. Rete sul territorio
  const contactsPerMember = slices.reduce(
    (s, sl) => s + sl.weight * (GROUND_CONTACTS_PER_MEMBER[sl.key] ?? CONTACTS_PER_MEMBER_DEFAULT),
    0,
  );
  const verdeMultiplier = 1 + profile.verdeBoost * ctx.verdeTesseratiShare * ctx.verdePermRatio;
  const groundVotesBase =
    ctx.tesserati * contactsPerMember * VOTES_PER_CONTACT * ctx.shannonH * ctx.densityFactor;
  const groundVotes = groundVotesBase * profile.ground * verdeMultiplier * ctx.effort;
  const groundRaw = (groundVotes / ctx.validi) * 100;

  // 5. Magnete istituzionale
  const latentVotes =
    Math.min(ctx.institutionalPoints, ctx.baselinePoints) *
    VOTES_PER_INSTITUTIONAL_POINT *
    LATENT_TRANSFER_SHARE *
    Math.min(1, days / LATENT_TRANSFER_DAYS);
  const entryRealization = decay(days, ENTRY_REALIZATION_TAU_DAYS);
  const whatIfVotes = ctx.deltaPoints * VOTES_PER_INSTITUTIONAL_POINT * entryRealization;
  const profileVotes = ctx.profileVotes * entryRealization;
  const magnetRaw = ((latentVotes + whatIfVotes + profileVotes) / ctx.validi) * 100;

  // 6. Ciclo elettorale
  const fiscalCoverage = agenda.coverage.fisco;
  const cycleOpts: CycleMonthOptions = {
    abstentionShare: ctx.flussi.ast,
    fiscalCoverage,
    compensation: profile.compensation,
    springMultiplier: profile.springMultiplier,
  };
  const cycleSub: { label: string; pp: number }[] = [];
  let cycleRaw = 0;
  for (const s of slices) {
    const v = cycleMonthPp(s.key, cycleOpts) * s.weight;
    cycleRaw += v;
    cycleSub.push({ label: cycleMonthLabel(s.key) ?? s.key, pp: v });
  }

  // 7. Pavimento e tetto
  const driversRaw =
    momentumRaw + reversionRaw + agendaRaw + donorRaw + groundRaw + magnetRaw + cycleRaw;
  const capPp = ctx.contestablePool * decay(days, CEILING_TAU_DAYS);
  const softFloor = Math.max(SOFT_FLOOR_PCT, ctx.hardFloor + 0.5);
  const afterCeiling = applyCeiling(driversRaw, capPp);
  const finalLevel = applyFloor(ctx.s0, afterCeiling, ctx.hardFloor, softFloor);
  const boundsRaw = finalLevel - ctx.s0 - driversRaw;

  const raws = [
    momentumRaw + reversionRaw,
    agendaRaw,
    donorRaw,
    groundRaw,
    magnetRaw,
    cycleRaw,
    boundsRaw,
  ];
  const rounded = apportionCents(raws);
  const deltaPp = fix2(rounded.reduce((s, v) => s + v, 0));
  const centralPct = fix2(ctx.s0 + deltaPp);

  // 8. Cono di incertezza
  const months = days / 30.44;
  const sigmaPoll = ctx.sigmaS0;
  const sigmaHist = ctx.sigmaMonth * Math.max(months, 0.05) ** HORIZON_EXPONENT;
  const structuralAbs =
    Math.abs(agendaRaw) + Math.abs(donorRaw) + Math.abs(groundRaw) + Math.abs(magnetRaw) + Math.abs(cycleRaw);
  const sigmaModel =
    STRUCTURAL_UNCERTAINTY_SHARE * structuralAbs +
    MOMENTUM_UNCERTAINTY_SHARE * Math.abs(momentumRaw + reversionRaw);
  const sigmaTotal = Math.sqrt(sigmaPoll ** 2 + sigmaHist ** 2 + sigmaModel ** 2);
  const lo10Pct = fix2(applyFloor(centralPct, -Z80 * sigmaTotal, ctx.hardFloor, softFloor));
  const hi90Pct = fix2(centralPct + Z80 * sigmaTotal);

  const momentumPpMonth = mom.momentumPerDay * 30.44;
  const ppMonth = (perDay: number) => numIt(perDay * 30.44, 2);
  const matrix = matrixLabel(ctx);
  const houseExtremes =
    mom.houseEffects.length >= 2
      ? ` (${mom.houseEffects[0]!.institute} ${ppIt(mom.houseEffects[0]!.pp)}, ${mom.houseEffects[mom.houseEffects.length - 1]!.institute} ${ppIt(mom.houseEffects[mom.houseEffects.length - 1]!.pp)})`
      : "";
  const lo10Shown = Math.min(lo10Pct, centralPct);
  const hi90Shown = Math.max(hi90Pct, centralPct);

  const votesIt = (v: number) => intIt(Math.round(v / 100) * 100);
  const gapToLevel = mom.levelPct - ctx.s0;
  const momentumPlain =
    `Mettendo in fila tutti i sondaggi e correggendo le differenze tra istituti, la nostra linea di fondo è intorno ${ilIt(numIt(mom.levelPct, 1), "al")}%.` +
    (mom.momentumNeutralized
      ? " Il calo delle settimane scorse si è fermato: non lo trasciniamo in avanti."
      : momentumPpMonth <= -0.05
        ? ` La tendenza è ancora in calo (${numIt(-momentumPpMonth)} punti al mese) e pesa sulle prossime settimane.`
        : momentumPpMonth >= 0.05
          ? ` La tendenza è in salita (${numIt(momentumPpMonth)} punti al mese) e spinge le prossime settimane.`
          : " La tendenza è piatta.") +
    (!ctx.s0Measured
      ? " Il punto di partenza è impostato a mano: non lo riavviciniamo ai sondaggi."
      : gapToLevel <= -0.05
        ? ` ${ilIt(numIt(ctx.s0), "Il")}% di oggi è sopra questa linea: una parte rientra.`
        : gapToLevel >= 0.05
          ? ` ${ilIt(numIt(ctx.s0), "Il")}% di oggi è sotto questa linea: una parte si recupera.`
          : " Il numero di oggi è già su questa linea.");
  const agendaPlain =
    "Sicurezza, fisco, prezzi e sanità sono tra le prime preoccupazioni degli italiani (Eurobarometro): sono temi su cui ci riconoscono e su cui il programma B.I.P. ha proposte concrete. " +
    `L'indice di salienza del periodo è ${numIt(agenda.index, 2)} su una resa massima di 0,40 punti; l'effetto cresce nei primi due-tre mesi e poi si stabilizza.` +
    (profile.salienceBoost > 0
      ? " In questo scenario spingiamo di più su sicurezza e fisco."
      : profile.agenda < 1
        ? " In questo scenario li presidiamo solo a metà."
        : "");
  const donorPlain =
    "Chi governa perde consenso col tempo: in media 0,64 punti l'anno, di più nei mesi della manovra (Nannestad e Paldam). " +
    `La matrice ${matrix} dice solo la quota storica di provenienza: circa ${ilIt(String(Math.round(donorShare * 100)))}% di chi ha già scelto FN arriva da FdI/Lega — non è il tasso di cattura sui flussi futuri. ` +
    `Sul logoramento stimato (${numIt(cdxExitPressurePp)} pt) applichiamo un tasso di intercettazione ipotizzato P(FN|uscita CDX) = ${numIt(interception.rate * 100, 0)}% (${interception.label}; range ${numIt(interception.lo * 100, 0)}–${numIt(interception.hi * 100, 0)}%): ` +
    `il resto (~${numIt(dispersedPp)} pt) disperde verso astensione e altri partiti. Contributo netto circa ${ppIt(donorRaw)}.` +
    (agenda.tensionIndex > 1 ? " Le tensioni nella maggioranza di questi giorni aumentano la pressione di uscita." : "") +
    (profile.donor > 1
      ? " In questo scenario l'intercettazione è spinta verso l'alto del range."
      : profile.donor < 1
        ? " In questo scenario l'intercettazione resta al minimo dello scenario."
        : "");
  const groundPlain =
    `${intIt(ctx.tesserati)} tesserati e ${intIt(ctx.comitati)} comitati parlano con le persone: in media una conversazione su venti porta un voto (esperimenti sul porta a porta). ` +
    `Nel periodo fanno circa ${votesIt(groundVotes)} voti (${ppIt(groundRaw)}), e l'effetto cresce verso maggio, quando la campagna entra nel vivo.` +
    (profile.verdeBoost > 0
      ? " In questo scenario la rete si rafforza nelle 8 Regioni Verdi."
      : profile.ground < 1
        ? " In questo scenario la rete lavora al minimo."
        : "");
  const magnetVotes = latentVotes + whatIfVotes + profileVotes;
  const magnetPlain =
    `I nostri eletti (${BASELINE_COUNTS.dep} deputati, ${BASELINE_COUNTS.creg} consiglieri regionali, ${BASELINE_COUNTS.sind} sindaci, ${BASELINE_COUNTS.com} consiglieri comunali) portano con sé elettori che non sono ancora tutti passati a noi.` +
    (ctx.deltaPoints > 0
      ? " Contano anche le nuove cariche aggiunte allo scenario."
      : ctx.deltaPoints < 0
        ? " Lo scenario toglie alcune cariche."
        : "") +
    (ctx.profiles.length === 1
      ? " Conta anche l'ingresso simulato con «+ Simula»."
      : ctx.profiles.length > 1
        ? ` Contano anche i ${ctx.profiles.length} ingressi simulati con «+ Simula».`
        : "") +
    (magnetVotes >= 0
      ? ` Nel periodo sono circa ${votesIt(magnetVotes)} voti.`
      : ` Nel periodo perdiamo circa ${votesIt(-magnetVotes)} voti.`);
  const phases = new Set(slices.map((s) => CYCLE_MONTHS[s.key]?.phase ?? "fuori"));
  const cyclePlainParts: string[] = [];
  if (phases.has("autunno")) {
    cyclePlainParts.push(
      `Novembre e dicembre sono i mesi della manovra: si parla del Governo e chi è all'opposizione ha meno spazio. Le proposte B.I.P. su fisco e pensioni recuperano circa ${ilIt(String(Math.round(clamp(profile.compensation * fiscalCoverage, 0, 0.9) * 100)))}% di questo svantaggio.`,
    );
  }
  if (phases.has("inverno")) {
    cyclePlainParts.push("Gennaio e febbraio servono a preparare il territorio.");
  }
  if (phases.has("primavera")) {
    cyclePlainParts.push(
      `Da marzo la mobilitazione riporta al voto una parte di chi si astiene${profile.springMultiplier > 1 ? ", e in questo scenario la spingiamo di più" : ""}.`,
    );
  }
  const cyclePlain =
    cyclePlainParts.length > 0
      ? cyclePlainParts.join(" ")
      : "In questo periodo il calendario politico sposta poco.";
  const boundsPlain =
    `Soglia indicativa di smorzamento del modello (ipotesi, non pavimento garantito): circa ${ilIt(numIt(ctx.hardFloor), "al")}%, calcolata sulle preferenze Europee 2024 con sovrapposizione prudenziale dei tesserati (non sommati come insiemi disgiunti). ` +
    `Sotto ${ilIt(numIt(softFloor))}% il modello smorza i cali; non è uno zoccolo «incomprimibile» tra consultazioni diverse. ` +
    `C'è anche un tetto di saturazione: i voti contendibili stimati valgono ${numIt(ctx.contestablePool, 1)} punti.` +
    (rounded[6] === 0
      ? " In questo periodo nessuno dei due limiti pesa."
      : rounded[6]! < 0
        ? " Qui il tetto frena un po' la crescita."
        : " Qui la soglia di smorzamento frena il calo.");
  const uncertaintyPlain =
    `Fascia di variabilità stimata dal modello (80% teorico): ${numIt(lo10Shown)}% – ${numIt(hi90Shown)}%. ` +
    `Costruita da disaccordo istituti, volatilità storica dei sondaggi (circa ${numIt(ctx.sigmaMonth, 1)} punti percentuali al mese) e incertezza delle ipotesi; si allarga quanto più si guarda lontano. Non è una probabilità calibrata sugli orizzonti a 90/180 giorni.` +
    (lo10Shown > centralPct - Z80 * sigmaTotal + 0.05
      ? ` Verso il basso è più stretta perché sotto ${ilIt(numIt(softFloor))}% il calo rallenta.`
      : "");

  const factors: ForecastFactorRow[] = [
    {
      id: "momentum",
      n: 1,
      label: "Andamento dei sondaggi",
      short: "Sondaggi",
      pp: rounded[0]!,
      rawPp: momentumRaw + reversionRaw,
      provenance: "dati",
      plain: momentumPlain,
      note:
        `Filtro di Kalman su ${mom.observations.supermedia} Supermedia e ${mom.observations.polls} sondaggi corretti per l'effetto istituto${houseExtremes}: livello oggi ${numIt(mom.levelPct)}% (±${numIt(mom.levelSdPp)}). ` +
        `Pendenza 21 giorni ${ppMonth(mom.slopeShortPerDay)} pp/mese (peso 70%), 60 giorni ${ppMonth(mom.slopeLongPerDay)} pp/mese (30%)` +
        (mom.momentumNeutralized
          ? `: gli ultimi 15 giorni sono stabili, quindi l'inerzia negativa è azzerata.`
          : `: inerzia ${numIt(momentumPpMonth)} pp/mese che si spegne con τ = 28 giorni.`) +
        (ctx.s0Measured
          ? ` Rientro verso il livello filtrato: ${ppIt(reversionRaw)} pp.`
          : ` S0 è impostato a mano lontano dal misurato: nessun rientro.`),
      sources: [FORECAST_V4_SOURCES.supermedia],
      sub: [
        { label: "Inerzia", pp: momentumRaw },
        { label: "Rientro al livello filtrato", pp: reversionRaw },
      ],
    },
    {
      id: "agenda",
      n: 2,
      label: "Temi del momento",
      short: "Temi",
      pp: rounded[1]!,
      rawPp: agendaRaw,
      provenance: ctx.headlines.length > 0 ? "misto" : "ipotesi",
      plain: agendaPlain,
      note:
        `Salienza Eurobarometro 104 (sicurezza e immigrazione 29%, economia e lavoro 37%, prezzi 31%, sanità 10%)` +
        (ctx.headlines.length > 0
          ? `, aggiornata al 30% con ${ctx.headlines.length} titoli in finestra`
          : "") +
        `, per il possesso del tema e la copertura B.I.P. (${BIP_MEASURES_BY_THEME.fisco} misure su fisco e lavoro, ${BIP_MEASURES_BY_THEME.sicurezza} su sicurezza, ${BIP_MEASURES_BY_THEME.potere} su casa e redditi, ${BIP_MEASURES_BY_THEME.sanita} su sanità e famiglia). ` +
        `Indice ${numIt(agenda.index, 3)} su una resa massima di 0,40 pp, che si accumula in circa 75 giorni.`,
      sources: [FORECAST_V4_SOURCES.eurobarometro, FORECAST_V4_SOURCES.petrocik],
      sub: AGENDA_THEMES.map((t) => ({
        label: t.label,
        pp:
          AGENDA_YIELD_PP *
          agenda.salience[t.id] *
          t.ownership *
          agenda.coverage[t.id] *
          TOPIC_ELASTICITY[t.elasticityKey] *
          decay(days, AGENDA_TAU_DAYS) *
          (1 + 0.5 * agenda.tone) *
          profile.agenda *
          ctx.effort,
      })),
    },
    {
      id: "donor",
      n: 3,
      label: "Delusi di FdI e Lega",
      short: "Delusi FdI-Lega",
      pp: rounded[2]!,
      rawPp: donorRaw,
      provenance: "misto",
      plain: donorPlain,
      note:
        `(1) Quota storica P(origine CDX|FN) da matrice ${matrix}: FdI ${numIt(donorFdI * 100, 1)}% + Lega ${numIt(donorLega * 100, 1)}% — diagnostica, non tasso di cattura. ` +
        `(2) Tasso ipotizzato P(FN|uscita CDX) = ${numIt(interception.rate * 100, 0)}% (${interception.label}; range ${numIt(interception.lo * 100, 0)}–${numIt(interception.hi * 100, 0)}%). ` +
        `Pressione di uscita CDX ${numIt(cdxExitPressurePp)} pt (costo del governare 0,64 pp/anno ×1,3 in manovra` +
        (Math.abs(crisisPp) >= 0.005 ? ` + crisi ${numIt(crisisPp)} pt` : "") +
        `); dispersione stimata verso astensione/altri ≈ ${numIt(dispersedPp)} pt. ` +
        `Astenuti in matrice: ${numIt(ctx.flussi.ast * 100, 1)}%.`,
      sources: [FORECAST_V4_SOURCES.costOfRuling],
      sub: [
        { label: "Intercettati (ipotesi) da FdI", pp: donorFromFdI },
        { label: "Intercettati (ipotesi) da Lega", pp: donorRaw - donorFromFdI },
      ],
    },
    {
      id: "ground",
      n: 4,
      label: "Lavoro dei tesserati",
      short: "Tesserati",
      pp: rounded[3]!,
      rawPp: groundRaw,
      provenance: "misto",
      plain: groundPlain,
      note:
        `${intIt(ctx.tesserati)} tesserati × ${numIt(contactsPerMember)} contatti a testa nel periodo × 1 voto ogni 20 contatti × copertura H = ${numIt(ctx.shannonH, 3)} × densità di ${intIt(ctx.comitati)} comitati (${numIt(ctx.densityFactor)})` +
        (profile.verdeBoost > 0
          ? ` × spinta nelle Regioni Verdi (${numIt(verdeMultiplier)})`
          : "") +
        ` = ${intIt(groundVotes)} voti su ${intIt(ctx.validi)} validi. Cresce verso maggio con la campagna.`,
      sources: [FORECAST_V4_SOURCES.canvassingLocal, FORECAST_V4_SOURCES.canvassingPnas],
      sub: [{ label: "Voti dalla rete", pp: groundRaw }],
    },
    {
      id: "magnet",
      n: 5,
      label: "Eletti e nuovi ingressi",
      short: "Eletti",
      pp: rounded[4]!,
      rawPp: magnetRaw,
      provenance: ctx.deltaPoints !== 0 || ctx.profiles.length > 0 ? "misto" : "ipotesi",
      plain: magnetPlain,
      note:
        `${intIt(Math.min(ctx.institutionalPoints, ctx.baselinePoints))} punti istituzionali attuali (${BASELINE_COUNTS.dep} deputati, ${BASELINE_COUNTS.creg} consiglieri regionali, ${BASELINE_COUNTS.sind} sindaci, ${BASELINE_COUNTS.com} consiglieri comunali) × 2.000 voti per punto × 15% ancora da trasferire in 180 giorni` +
        (ctx.deltaPoints !== 0
          ? `; what-if ${ctx.deltaPoints > 0 ? "+" : ""}${intIt(ctx.deltaPoints)} punti`
          : "") +
        (ctx.profiles.length > 0
          ? `; ${ctx.profiles.length} profili «+ Simula» con ${intIt(ctx.profileVotes)} voti portati`
          : "") +
        (ctx.deltaPoints !== 0 || ctx.profiles.length > 0
          ? `, realizzati al ${Math.round(entryRealization * 100)}% in questo orizzonte.`
          : "."),
      sources: [],
      sub: [
        { label: "Presenze attuali", pp: (latentVotes / ctx.validi) * 100 },
        { label: "What-if istituzionale", pp: (whatIfVotes / ctx.validi) * 100 },
        { label: PROFILE_SUB_LABEL, pp: (profileVotes / ctx.validi) * 100 },
      ],
    },
    {
      id: "cycle",
      n: 6,
      label: "Calendario politico",
      short: "Calendario",
      pp: rounded[5]!,
      rawPp: cycleRaw,
      provenance: "ipotesi",
      plain: cyclePlain,
      note:
        `Mesi attraversati: ${cycleSub.map((s) => `${s.label} ${ppIt(s.pp)}`).join(", ")}. ` +
        `La manovra pesa −0,08 pp a novembre, compensata al ${Math.round(profile.compensation * fiscalCoverage * 100)}% dalle misure B.I.P. su fisco e pensioni; ` +
        `da marzo il rientro dall'astensione scala con la quota astenuti della matrice (${numIt(ctx.flussi.ast * 100, 1)}%).`,
      sources: [FORECAST_V4_SOURCES.manovra],
      sub: cycleSub,
    },
    {
      id: "bounds",
      n: 7,
      label: "Soglia di smorzamento e tetto",
      short: "Limiti",
      pp: rounded[6]!,
      rawPp: boundsRaw,
      provenance: "ipotesi",
      plain: boundsPlain,
      note:
        `Soglia indicativa di smorzamento (ipotesi, non pavimento garantito): ${intIt(FN_PREFERENZE_EUROPEE_2024)} preferenze Europee 2024 + quota tesserati non sovrapposta (overlap assunto 85%, differenziale partecipazione 0,9) → ${numIt(ctx.hardFloor)}%. ` +
        `Smorzamento elastico sotto ${numIt(softFloor)}%; tetto di saturazione +${numIt(ctx.contestablePool)} pp su bacino contendibile CDX+Astenuti ` +
        `(assorbibile ${numIt(capPp)} pp in questo orizzonte). Attivazione: ${ppIt(rounded[6]!)}.`,
      sources: [FORECAST_V4_SOURCES.europeePreferenze],
      sub: [{ label: "Attivazione limiti nel periodo", pp: rounded[6]! }],
    },
  ];

  return {
    key,
    label,
    days,
    startPct: ctx.s0,
    centralPct,
    deltaPp,
    lo10Pct: lo10Shown,
    hi90Pct: hi90Shown,
    sigma: {
      poll: round3(sigmaPoll),
      hist: round3(sigmaHist),
      model: round3(sigmaModel),
      total: round3(sigmaTotal),
    },
    factors,
    uncertaintyNote:
      `Fascia 80% = centro ∓ 1,28 σ, con σ = ${numIt(sigmaTotal)} pp: sondaggi ${numIt(sigmaPoll)} (dispersione tra istituti), ` +
      `storia ${numIt(sigmaHist)} (${numIt(ctx.sigmaMonth)} pp/mese × mesi^0,55, calibrata sull'errore reale ${numIt(ctx.calibrationMae)} pp), ` +
      `modello ${numIt(sigmaModel)} (35% dei fattori strutturali e metà del momentum). Sotto il pavimento la fascia si comprime.`,
    uncertaintyPlain,
  };
}

// —— API pubblica ——

export function may2027Days(asOf: Date | string | number | null | undefined): number {
  const d = normalizeToUtcNoon(asOf);
  const months = Math.max(1, (2027 - d.getUTCFullYear()) * 12 + (4 - d.getUTCMonth()));
  return months * 30;
}

export function forecastV4HorizonDefs(
  asOf: Date | string | number | null | undefined,
): { key: ForecastHorizonKey; days: number; label: string }[] {
  const mayDays = may2027Days(asOf);
  return [
    { key: "d30", days: 30, label: "30 giorni" },
    { key: "d90", days: 90, label: "90 giorni" },
    { key: "d180", days: mayDays, label: "Maggio 2027" },
  ];
}

function diagnosticsOf(ctx: PreparedContext): ForecastDiagnostics {
  const agenda = analyzeAgenda(ctx.headlines, ctx.newsScore, 0);
  return {
    levelPct: ctx.momentum.levelPct,
    levelSdPp: round3(ctx.momentum.levelSdPp),
    slopeShortPpMonth: round3(ctx.momentum.slopeShortPerDay * 30.44),
    slopeLongPpMonth: round3(ctx.momentum.slopeLongPerDay * 30.44),
    momentumPpMonth: round3(ctx.momentum.momentumPerDay * 30.44),
    stable15: ctx.momentum.stable15,
    momentumNeutralized: ctx.momentum.momentumNeutralized,
    s0Measured: ctx.s0Measured,
    aggregatePct: ctx.aggregatePct,
    houseEffects: ctx.momentum.houseEffects,
    observations: ctx.momentum.observations,
    sigmaS0Pp: round3(ctx.sigmaS0),
    sigmaDailyPp: round3(ctx.momentum.sigmaDailyPp),
    sigmaMonthPp: round3(ctx.sigmaMonth),
    calibrationMaePp: round3(ctx.calibrationMae),
    agendaIndex: round3(agenda.index),
    salience: agenda.salience,
    newsThemeHits: agenda.hits,
    tensionIndex: agenda.tensionIndex,
    flussiMatrixId: ctx.flussiMatrixId,
    donorShare: round3(ctx.flussi.FdI + ctx.flussi.Lega),
    abstentionShare: ctx.flussi.ast,
    tesserati: ctx.tesserati,
    comitati: ctx.comitati,
    shannonH: round3(ctx.shannonH),
    comitatiDensityFactor: round3(ctx.densityFactor),
    institutionalPoints: ctx.institutionalPoints,
    institutionalPointsBaseline: ctx.baselinePoints,
    simulatedEntryVotes: Math.round(ctx.profileVotes),
    hardFloorPct: round3(ctx.hardFloor),
    softFloorPct: Math.max(SOFT_FLOOR_PCT, round3(ctx.hardFloor + 0.5)),
    contestablePoolPp: round3(ctx.contestablePool),
    validiNazionali: ctx.validi,
  };
}

/** Tre orizzonti (30, 90, maggio 2027) per i tre scenari. */
export function computeForecastV4(input: ForecastV4Input = {}): ForecastV4Result {
  const ctx = prepareContext(input);
  const defs = forecastV4HorizonDefs(ctx.asOf);
  const scenarios = {} as Record<ForecastScenarioId, ForecastScenarioResult>;
  for (const id of FORECAST_SCENARIO_ORDER) {
    const meta = SCENARIO_PROFILES[id];
    scenarios[id] = {
      id,
      label: meta.label,
      tagline: meta.tagline,
      horizons: defs.map((h) => evaluateHorizon(ctx, h.days, id, h.key, h.label)),
    };
  }
  return {
    modelId: FORECAST_V4_MODEL_ID,
    asOf: ctx.asOfIso,
    startPct: ctx.s0,
    startSource: ctx.startSource,
    diagnostics: diagnosticsOf(ctx),
    scenarios,
    base: scenarios.base,
  };
}

/** Un solo orizzonte arbitrario (slider, ventaglio, mappa regionale). */
export function forecastV4AtDays(
  input: ForecastV4Input,
  days: number,
  scenarioId: ForecastScenarioId = "base",
): { horizon: ForecastHorizonResult; diagnostics: ForecastDiagnostics } {
  const ctx = prepareContext(input);
  const d = Math.max(1, Math.round(days));
  const label = d === 30 ? "30 giorni" : d === 90 ? "90 giorni" : `${d} giorni`;
  return {
    horizon: evaluateHorizon(ctx, d, scenarioId, "custom", label),
    diagnostics: diagnosticsOf(ctx),
  };
}

export function forecastHorizon(
  result: ForecastV4Result,
  scenarioId: ForecastScenarioId,
  key: ForecastHorizonKey,
): ForecastHorizonResult {
  const list = result.scenarios[scenarioId].horizons;
  return list.find((h) => h.key === key) ?? list[list.length - 1]!;
}

/** Una sola azione dai tre regimi già calcolati (30 giorni): guadagno per unità di incertezza. */
export type ForecastActionRecommendation = {
  regimeId: ForecastScenarioId;
  regimeLabel: string;
  leverLabel: string;
  centralPct: number;
  lo10Pct: number;
  hi90Pct: number;
  horizonLabel: string;
  passivoPct: number;
  basePct: number;
  offensivaPct: number;
};

export function recommendForecastAction(
  result: ForecastV4Result,
): ForecastActionRecommendation {
  let bestId: ForecastScenarioId = "base";
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestHorizon = forecastHorizon(result, "base", "d30");
  for (const id of FORECAST_SCENARIO_ORDER) {
    const horizon = forecastHorizon(result, id, "d30");
    const score = horizon.deltaPp / Math.max(horizon.sigma.total, 0.05);
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
      bestHorizon = horizon;
    }
  }
  const lever = [...bestHorizon.factors].sort((a, b) => b.pp - a.pp)[0];
  return {
    regimeId: bestId,
    regimeLabel: forecastScenarioMeta(bestId).label,
    leverLabel: lever?.short || lever?.label || "passo attuale",
    centralPct: bestHorizon.centralPct,
    lo10Pct: bestHorizon.lo10Pct,
    hi90Pct: bestHorizon.hi90Pct,
    horizonLabel: bestHorizon.label,
    passivoPct: forecastHorizon(result, "passivo", "d30").centralPct,
    basePct: forecastHorizon(result, "base", "d30").centralPct,
    offensivaPct: forecastHorizon(result, "offensiva", "d30").centralPct,
  };
}

export function factorPp(h: ForecastHorizonResult, id: ForecastFactorId): number {
  return h.factors.find((f) => f.id === id)?.pp ?? 0;
}

// —— Proiezione regionale ——

export type ForecastRegionalRow = {
  regione: Region;
  verde: boolean;
  startPct: number;
  centralPct: number;
  deltaPp: number;
  addedVotes: number;
  /** Quota del tetto fisico già usata, 0–1. STIMA MODELLO. */
  reachSaturation: number;
  basins: Record<BasinId, number>;
};

export type ForecastStageCapacity = {
  horizonDays: 30 | 90 | 180;
  feasible: boolean;
  committeeOver: number;
  memberOver: number;
};

export type ForecastStage = {
  key: "today" | ForecastHorizonKey;
  label: string;
  horizonDays: number;
  epistemic: "MISURATO" | "STIMA MODELLO";
  centralPct: number;
  lo10: number;
  hi90: number;
  cvar10: number;
  addedVotes: number;
  topRegions: ForecastRegionalRow[];
  capacity: ForecastStageCapacity | null;
};

/**
 * Capienza Terra assorbibile nell'orizzonte.
 * Tesserati, comitati e bacino elettorale pesano insieme: un solo eletto allarga la stanza, non la chiude.
 */
function terraRoomVotes(input: {
  validi: number;
  tesserati: number;
  elected: number;
  committees: number;
  days: number;
}): number {
  const pace = input.days <= 30 ? 0.28 : input.days <= 90 ? 0.62 : 1;
  const validi = Math.max(1, input.validi);
  const electorate = validi * 0.01 * pace;
  const members = Math.max(0, input.tesserati) * 0.4 * pace;
  const committees = Math.max(0, input.committees) * 700 * pace;
  const elected = Math.max(0, input.elected) * 1500 * pace;
  const blended = electorate * 0.6 + members * 0.24 + committees * 0.1 + elected * 0.06;
  return Math.max(1200, blended);
}

/**
 * Riparte il risultato nazionale sulle regioni: swing proporzionale per i fattori nazionali,
 * voti dei profili simulati nella loro regione, extra dell'Offensiva sulle Regioni Verdi.
 */
export function forecastV4Regional(
  input: ForecastV4Input,
  result: ForecastV4Result,
  key: ForecastHorizonKey,
  scenarioId: ForecastScenarioId = "base",
): ForecastRegionalRow[] {
  const regions =
    input.regions && input.regions.length > 0
      ? input.regions
      : staticForecastRegions(result.startPct);
  const h = forecastHorizon(result, scenarioId, key);
  const anchor = scenarioId === "offensiva" ? forecastHorizon(result, "base", key) : h;
  const validiNat = result.diagnostics.validiNazionali;
  const profilePp =
    anchor.factors
      .find((f) => f.id === "magnet")
      ?.sub.find((s) => s.label === PROFILE_SUB_LABEL)?.pp ?? 0;
  const realization = decay(h.days, ENTRY_REALIZATION_TAU_DAYS);
  const nationalPart = anchor.centralPct - profilePp;
  const ratio = result.startPct > 0 ? nationalPart / result.startPct : 1;
  const extraPp = h.centralPct - anchor.centralPct;
  const verde = new Set<Region>(COCKPIT_TIER_VERDE);
  const permOf = (r: Region) => REGIONAL_PARTY_HISTORY[r]?.permeabilitaVannacciScore ?? 50;
  const verdeWeightTotal = regions
    .filter((r) => verde.has(r.regione))
    .reduce((s, r) => s + r.tesserati * permOf(r.regione), 0);
  const extraVotes = (extraPp / 100) * validiNat;
  const regionTesserati = regions.reduce((sum, row) => sum + Math.max(0, row.tesserati), 0);
  const nationalCommittees = Math.max(0, input.comitati ?? 0);
  const profileVotesByRegion = new Map<Region, number>();
  for (const p of input.profiles ?? []) {
    profileVotesByRegion.set(p.regione, (profileVotesByRegion.get(p.regione) ?? 0) + p.votiPortati);
  }
  const baseVotes = regions.map((r) => {
    const validi = Math.max(1, r.validi);
    return (r.sharePct / 100) * validi * ratio + (profileVotesByRegion.get(r.regione) ?? 0) * realization;
  });
  const verdeIndexes = regions.map((r, index) => (verde.has(r.regione) ? index : -1)).filter((index) => index >= 0);
  const extraByIndex = new Array<number>(regions.length).fill(0);
  if (extraVotes > 0 && verdeIndexes.length > 0) {
    const goal = Math.max(0, Math.round(extraVotes));
    const allocated = allocateVotesAcrossRegions({
      goalVotes: goal,
      regions: regions.map((r, index) => {
        const validi = Math.max(1, r.validi);
        const p0 = clamp01(baseVotes[index]! / validi);
        const perm = permOf(r.regione) / 100;
        const active = verde.has(r.regione);
        const committees =
          nationalCommittees > 0 && regionTesserati > 0
            ? nationalCommittees * (Math.max(0, r.tesserati) / regionTesserati)
            : Math.max(1, r.tesserati / 120);
        const room = terraRoomVotes({
          validi,
          tesserati: r.tesserati,
          elected: r.puntiIstituzionali,
          committees,
          days: h.days,
        });
        return {
          voters: validi,
          p0,
          reach: Math.min(0.46, p0 + room / validi),
          rho: active ? Math.max(0.35, 1.4 - perm) : 1,
          active,
        };
      }),
    });
    for (const index of verdeIndexes) {
      extraByIndex[index] = Math.max(1, allocated.added[index] ?? 0);
    }
    const got = extraByIndex.reduce((sum, value) => sum + value, 0);
    const gap = goal - got;
    if (gap > 0 && verdeWeightTotal > 0) {
      for (const index of verdeIndexes) {
        const r = regions[index]!;
        extraByIndex[index] = (extraByIndex[index] ?? 0) + gap * ((r.tesserati * permOf(r.regione)) / verdeWeightTotal);
      }
    }
  }
  return regions.map((r, index) => {
    const validi = Math.max(1, r.validi);
    const votes = baseVotes[index]! + (extraByIndex[index] ?? 0);
    const centralPct = (votes / validi) * 100;
    const addedVotes = votes - (r.sharePct / 100) * validi;
    const committees =
      nationalCommittees > 0 && regionTesserati > 0
        ? nationalCommittees * (Math.max(0, r.tesserati) / regionTesserati)
        : Math.max(1, r.tesserati / 120);
    const room = terraRoomVotes({
      validi,
      tesserati: r.tesserati,
      elected: r.puntiIstituzionali,
      committees,
      days: h.days,
    });
    const basins = splitVotesIntoBasins({
      region: r.regione,
      macroArea: macroAreaOfRegion(r.regione),
      votes: Math.max(0, addedVotes),
      horizonDays: h.days,
      structural: {
        delusi_coalizione: 1,
        astensione_recuperabile: 1,
        voto_tematico_ponte: 1,
        radicamento_civico_eletti: 1,
      },
    });
    return {
      regione: r.regione,
      verde: verde.has(r.regione),
      startPct: r.sharePct,
      centralPct,
      deltaPp: centralPct - r.sharePct,
      addedVotes,
      reachSaturation: room > 0 ? Math.min(1, Math.max(0, addedVotes) / room) : 0,
      basins,
    };
  });
}

function clamp01(value: number): number {
  return Math.min(0.45, Math.max(0, value));
}

const STAGE_KEYS = [
  { key: "d30" as const, days: 30 as const, label: "+30g" },
  { key: "d90" as const, days: 90 as const, label: "+90g" },
  { key: "d180" as const, days: 180 as const, label: "+180g" },
];

/** Catena Oggi → +30 → +90 → +180. La saturazione dei bacini si accumula tra una tappa e la successiva. */
export function forecastStages(input: {
  forecastInput: ForecastV4Input;
  result: ForecastV4Result;
  scenarioId?: ForecastScenarioId;
  networkDelta?: ForecastNetworkDelta;
  monthlyCommitteeCap?: number;
  monthlyMemberCap?: number;
}): ForecastStage[] {
  const scenarioId = input.scenarioId ?? "base";
  const regions = input.forecastInput.regions && input.forecastInput.regions.length > 0
    ? input.forecastInput.regions
    : staticForecastRegions(input.result.startPct);
  const mcRegions = regions.map((row) => ({ voters: Math.max(1, row.validi), macroArea: macroAreaOfRegion(row.regione) }));
  const today: ForecastStage = {
    key: "today",
    label: "Oggi",
    horizonDays: 0,
    epistemic: "MISURATO",
    centralPct: input.result.startPct,
    lo10: input.result.startPct,
    hi90: input.result.startPct,
    cvar10: input.result.startPct,
    addedVotes: 0,
    topRegions: [],
    capacity: null,
  };
  const used = new Map<Region, number>();
  const stages: ForecastStage[] = [today];
  for (const mark of STAGE_KEYS) {
    const horizon = forecastHorizon(input.result, scenarioId, mark.key);
    const rows = forecastV4Regional(input.forecastInput, input.result, mark.key, scenarioId).map((row) => {
      const previous = used.get(row.regione) ?? 0;
      const incremental = Math.max(0, row.addedVotes - previous);
      used.set(row.regione, Math.max(previous, row.addedVotes));
      return { ...row, addedVotes: incremental };
    });
    const mc = runCorrelatedMonteCarlo({
      regions: mcRegions,
      planPct: horizon.centralPct,
      targetPct: horizon.centralPct,
      currentPct: input.result.startPct,
      seed: 20261112 + mark.days,
      runs: 400,
    });
    const delta = input.networkDelta;
    const capacity = delta
      ? checkMonthlyCapacity({
          horizonDays: mark.days,
          deltaCommittees: Math.max(0, delta.comitati),
          deltaMembers: Math.max(0, delta.tesserati),
          monthlyCommitteeCap: input.monthlyCommitteeCap ?? 40,
          monthlyMemberCap: input.monthlyMemberCap ?? 3000,
        })
      : null;
    stages.push({
      key: mark.key,
      label: mark.label,
      horizonDays: mark.days,
      epistemic: "STIMA MODELLO",
      centralPct: horizon.centralPct,
      lo10: horizon.lo10Pct,
      hi90: horizon.hi90Pct,
      cvar10: mc.cvar10,
      addedVotes: rows.reduce((sum, row) => sum + row.addedVotes, 0),
      topRegions: [...rows].sort((a, b) => b.addedVotes - a.addedVotes).slice(0, 4),
      capacity: capacity
        ? {
            horizonDays: mark.days,
            feasible: capacity.feasible,
            committeeOver: capacity.committeeOver,
            memberOver: capacity.memberOver,
          }
        : null,
    });
  }
  return stages;
}

// —— Backtest walk-forward ——

export type ForecastBacktestRow = {
  origin: string;
  target: string;
  days: number;
  actualPct: number;
  v4Pct: number;
  flatPct: number;
  slopePct: number;
  lo10Pct: number;
  hi90Pct: number;
  inBand: boolean;
};

export type ForecastBacktestV4 = {
  n: number;
  maeV4: number;
  maeFlat: number;
  maeSlope: number;
  coverage80: number;
  rows: ForecastBacktestRow[];
};

/**
 * Per ogni Supermedia da luglio con un rilievo successivo a 14–50 giorni:
 * il modello vede SOLO dati con data ≤ origine (zero look-ahead):
 * history truncata, polls filtrati su fieldEnd e publishedAt, house effects /
 * volatilità / calibrazione ricalcolati dentro prepareContext su quel sottoinsieme.
 */
export function walkForwardBacktestV4(input: {
  series?: ConsensusPoint[];
  polls?: ForecastPoll[];
  fromIso?: string;
  minDays?: number;
  maxDays?: number;
} = {}): ForecastBacktestV4 {
  const series = sortedConsensusPoints(input.series ?? staticHistory());
  const polls = input.polls ?? staticForecastPolls();
  const fromIso = input.fromIso ?? "2026-07-01";
  const minDays = input.minDays ?? 14;
  const maxDays = input.maxDays ?? 50;
  const rows: ForecastBacktestRow[] = [];
  for (let i = 0; i < series.length; i++) {
    const origin = series[i]!;
    if (origin.isoDate < fromIso) continue;
    const target = series.slice(i + 1).find((p) => {
      const d = isoDaysBetween(origin.isoDate, p.isoDate);
      return d >= minDays && d <= maxDays;
    });
    if (!target) continue;
    const days = Math.round(isoDaysBetween(origin.isoDate, target.isoDate));
    const asOf = new Date(`${origin.isoDate}T12:00:00Z`);
    const past = series.slice(0, i + 1);
    const pollsAsOf = polls.filter((p) => {
      const field = p.fieldEnd.slice(0, 10);
      const pub = (p.publishedAt ?? p.fieldEnd).slice(0, 10);
      return field <= origin.isoDate && pub <= origin.isoDate;
    });
    const { horizon } = forecastV4AtDays(
      {
        asOf,
        startPct: origin.pct,
        history: past,
        polls: pollsAsOf,
        startIsObservation: true,
      },
      days,
      "base",
    );
    const slope = consensusSlopePpPerMonth(past).slopePpPerMonth;
    rows.push({
      origin: origin.isoDate,
      target: target.isoDate,
      days,
      actualPct: target.pct,
      v4Pct: horizon.centralPct,
      flatPct: origin.pct,
      slopePct: fix2(origin.pct + dampedSlopePp(slope, days / 30.44)),
      lo10Pct: horizon.lo10Pct,
      hi90Pct: horizon.hi90Pct,
      inBand: target.pct >= horizon.lo10Pct && target.pct <= horizon.hi90Pct,
    });
  }
  const n = rows.length;
  const mae = (pick: (r: ForecastBacktestRow) => number) =>
    n === 0 ? 0 : fix2(rows.reduce((s, r) => s + Math.abs(r.actualPct - pick(r)), 0) / n);
  return {
    n,
    maeV4: mae((r) => r.v4Pct),
    maeFlat: mae((r) => r.flatPct),
    maeSlope: mae((r) => r.slopePct),
    coverage80: n === 0 ? 0 : fix2(rows.filter((r) => r.inBand).length / n),
    rows,
  };
}
