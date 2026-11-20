import {
  cycleMonthPp,
  factorPp,
  fix2,
  forecastCycleOptions,
  forecastMonthSlices,
  forecastV4AtDays,
  type ForecastDiagnostics,
  type ForecastFactorRow,
  type ForecastHorizonResult,
  type ForecastNetworkDelta,
  type ForecastPoll,
  type ForecastRegionInput,
  type ForecastScenarioId,
  type ForecastV4Input,
  type SimulatedEntryProfile,
} from "./forecastEngineV4";
import { flussiFromMatrix, type FlussiIpsos } from "./flussiMatrices";
import {
  consensusSlopePpPerMonth,
  dampedSlopePp,
  isoDaysBetween,
  sortedConsensusPoints,
  type ConsensusPoint,
} from "./growthMath";

export {
  consensusSlopePpPerMonth,
  dailyDiffusionSigma,
  dampedSlopePp,
  FALLBACK_SIGMA_PER_SQRT_DAY,
} from "./growthMath";
export type { ConsensusPoint } from "./growthMath";

/** Moltiplicatore dello sforzo su agenda, bacini e rete. «organica» è lo scenario base calibrato. */
export type GrowthSensitivityId = "organica" | "territori" | "massima";

export const REGIME_SENSITIVITY: Record<GrowthSensitivityId, number> = {
  organica: 1,
  territori: 1.15,
  massima: 1.3,
};

export type GrowthHorizonId = "d30" | "d90" | "may27";

export const HORIZON_ORDER: GrowthHorizonId[] = ["d30", "d90", "may27"];

export const HORIZON_LABEL: Record<GrowthHorizonId, string> = {
  d30: "30 giorni",
  d90: "90 giorni",
  may27: "Maggio 2027",
};

export type GrowthEvidence = {
  forecastNews?: import("./nationalNewsSignals").ForecastNewsItem[];
  forecastNewsMeta?: {status:string;fetchedAt:string|null;nextAllowedRefreshAt:string|null};
  forecastEvents?: import("./nationalForecastEvents").NationalForecastEvent[];
  forecastEventSource?: "official-calendar" | "local-catalog";
  /** True quando il calendario BCE usa il catalogo locale di ripiego. */
  forecastEventUsedFallback?: boolean;
  /** Pendenza recente descrittiva (EWMA 21/60 giorni), punti percentuali al mese. */
  slopePpPerMonth: number;
  /** Da −1 (notizie negative) a +1. */
  newsScore: number;
  /** Quante misure B.I.P. combaciano con le notizie in agenda. 0 se non ci sono notizie. */
  bipMatches: number;
  newsHeadlines: string[];
  newsItems?: { title: string; url?: string }[];
  bipLabels: string[];
  slopeFrom: string | null;
  slopeTo: string | null;
  slope21PpPerMonth?: number;
  slope60PpPerMonth?: number;
  sources?: { kind: "consenso" | "notizia"; label: string; url?: string }[];
  /** Serie Supermedia per il filtro di Kalman e la volatilità. Se manca si usa la serie statica. */
  history?: ConsensusPoint[];
  /** Sondaggi dei singoli istituti (effetto istituto nel filtro). Se manca si usa l'archivio statico. */
  polls?: ForecastPoll[];
};

export type TimelineEventItem = {
  /** Stessa chiave di `monthKey`, es. "2026-11". */
  key: string;
  monthKey: string;
  monthShort: string;
  /**
   * Primo intero di orizzonte (1 = 30 giorni) in cui il mese pesa almeno un quarto.
   * Cliccando il mese, lo slider va qui.
   */
  stepMonth: number;
  /** true se il mese ricade dentro l'orizzonte attualmente selezionato dallo slider */
  inSelectedWindow: boolean;
  /** Peso frazionario del mese nella finestra selezionata (0..1) */
  weightInWindow: number;
  /** Contributo del ciclo elettorale nel mese, pesato per la parte di mese nella finestra. */
  netMonthPp: number;
  /** Contributo del mese intero, senza il peso della finestra. Serve all'istogramma. */
  fullMonthNetPp: number;
  ordinaryDeltaPp: number;
  extraordinaryRangePp: [number, number];
  ordinary: {
    title: string;
    deltaPp: number;
    why: string;
    sourceLabel: string;
    sourceUrl?: string;
    kind: "calendario" | "modello";
  };
  extraordinary: {
    title: string;
    potentialRangePp: [number, number];
    triggerCondition: string;
    why: string;
    bipLever: string;
  };
};

export type HorizonProjection = {
  id: GrowthHorizonId;
  label: string;
  months: number;
  deltaPp: number;
  /** Fattore 1: momentum filtrato e rientro. */
  slopePp: number;
  /** Fattore 2: agenda e temi posseduti. */
  newsPp: number;
  /** Fattori 3–5: bacini contendibili, rete sul territorio, magnete istituzionale. */
  bipPp: number;
  /** Fattore 6: ciclo elettorale (manovra, inverno, mobilitazione dall'astensione). */
  seasonalEventPp: number;
  /** Scomposizione che somma al risultato. */
  breakdown?: ForecastBreakdown;
  /** Mesi di calendario attivi fino all'orizzonte. */
  activeDrivers: string[];
  /** Fonte del fattore, se esiste. Altrimenti è un'ipotesi di modello. */
  driverSources: { label: string; url?: string; kind: "calendario" | "modello" }[];
  timeline: TimelineEventItem[];
  centralPct: number;
  bandLowPct: number;
  bandHighPct: number;
  /** Righe del motore v4 (7 fattori additivi). */
  factors?: ForecastFactorRow[];
  v4?: ForecastHorizonResult;
  diagnostics?: ForecastDiagnostics;
};

export function monthsUntilMay2027(asOf: Date): number {
  const months = (2027 - asOf.getUTCFullYear()) * 12 + (4 - asOf.getUTCMonth());
  return Math.max(1, months);
}

export function horizonMonths(id: GrowthHorizonId, asOf = new Date()): number {
  if (id === "d30") return 1;
  if (id === "d90") return 3;
  return monthsUntilMay2027(asOf);
}

export type IngressiFn = { dep: number; creg: number; sind: number };

export type ForecastBreakdown = {
  startPct: number;
  inertiaPp: number;
  calendarPp: number;
  newsPp: number;
  bipPp: number;
  ingressiPp: number;
  resistancePp: number;
  netPp: number;
  centralPct: number;
  bandLowPct: number;
  bandHighPct: number;
  inertiaNote: string;
  calendarNote: string;
  newsNote: string;
  bipNote: string;
  resistanceNote: string;
  factors: ForecastFactorRow[];
};

/**
 * Velocità recente descrittiva: 65% ultimi ~21 giorni, 35% ultimi ~60 giorni.
 * Il motore v4 usa invece le pendenze del livello filtrato (70/30).
 */
export function ewmaRecentSlope(points: ConsensusPoint[]): {
  slopePpPerMonth: number;
  slope21PpPerMonth: number;
  slope60PpPerMonth: number;
  from21: string | null;
  from60: string | null;
  to: string | null;
} {
  const sorted = sortedConsensusPoints(points);
  const last = sorted[sorted.length - 1];
  if (!last || sorted.length < 2) {
    return {
      slopePpPerMonth: 0,
      slope21PpPerMonth: 0,
      slope60PpPerMonth: 0,
      from21: null,
      from60: null,
      to: last?.isoDate ?? null,
    };
  }
  const nearest = (daysBack: number): ConsensusPoint | null => {
    const past = sorted.filter((p) => p.isoDate < last.isoDate);
    let best: ConsensusPoint | null = null;
    let bestDist = Infinity;
    for (const p of past) {
      const dist = Math.abs(isoDaysBetween(p.isoDate, last.isoDate) - daysBack);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  };
  const slopeFrom = (from: ConsensusPoint) =>
    (last.pct - from.pct) / (Math.max(1, isoDaysBetween(from.isoDate, last.isoDate)) / 30.44);
  const at21 = nearest(21);
  const at60 = nearest(60);
  const slope21 = at21 ? slopeFrom(at21) : 0;
  const slope60 = at60 ? slopeFrom(at60) : slope21;
  return {
    slopePpPerMonth: 0.65 * slope21 + 0.35 * slope60,
    slope21PpPerMonth: slope21,
    slope60PpPerMonth: slope60,
    from21: at21?.isoDate ?? null,
    from60: at60?.isoDate ?? null,
    to: last.isoDate,
  };
}

type MonthFactor = {
  label: string;
  monthShort: string;
  kind: "calendario" | "modello";
  ordinary: Omit<TimelineEventItem["ordinary"], "deltaPp">;
  extraordinary: TimelineEventItem["extraordinary"];
};

const MANOVRA_URL = "https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2009-12-31;196";

/** Calendario Nov 2026 – Mag 2027. I valori del mese vengono dal fattore 6 del motore v4. */
const MONTH_FACTORS: Record<string, MonthFactor> = {
  "2026-11": {
    label: "Nov 2026 · manovra di bilancio",
    monthShort: "NOV '26",
    kind: "calendario",
    ordinary: {
      title: "Manovra di bilancio",
      why: "La sessione di bilancio sposta l'attenzione sulla maggioranza: −0,08 punti di visibilità per chi è fuori dal governo. Le misure B.I.P. su fisco, partite IVA e pensioni ne recuperano una parte se vengono portate nel dibattito.",
      sourceLabel: "Legge 196/2009",
      sourceUrl: MANOVRA_URL,
      kind: "calendario",
    },
    extraordinary: {
      title: "Scontro sulla manovra o voto di fiducia",
      potentialRangePp: [-0.12, 0.18],
      triggerCondition:
        "Tensioni tra Lega e FdI su tasse, canone, pensioni o invio di armi aprono lo spazio mediatico per l'affondo di Vannacci.",
      why: "Se il partito viene citato come ago della bilancia, la visibilità può recuperare il terreno perso. Se viene descritto solo come opposizione rumorosa, il calo di novembre si accentua.",
      bipLever: "Fisco e costo della vita",
    },
  },
  "2026-12": {
    label: "Dic 2026 · fine manovra e pausa festiva",
    monthShort: "DIC '26",
    kind: "calendario",
    ordinary: {
      title: "Approvazione della manovra",
      why: "Il voto finale sulla legge di bilancio chiude la sessione: −0,05 punti di visibilità, compensati in parte dalle stesse misure fiscali del B.I.P.",
      sourceLabel: "Legge 196/2009",
      sourceUrl: MANOVRA_URL,
      kind: "calendario",
    },
    extraordinary: {
      title: "Fatto di cronaca natalizia ad alta visibilità",
      potentialRangePp: [-0.1, 0.2],
      triggerCondition: "Un episodio di sicurezza o di caro-vita entra nei tg per più giorni.",
      why: "In un mese povero di politica, un singolo fatto può diventare l'unica storia. Il segno dipende da come viene inquadrato il partito.",
      bipLever: "Sicurezza urbana",
    },
  },
  "2027-01": {
    label: "Gen 2027 · posizionamento",
    monthShort: "GEN '27",
    kind: "modello",
    ordinary: {
      title: "Posizionamento e rientro in aula",
      why: "Gennaio riapre l'agenda su bollette e sicurezza: +0,02 punti di posizionamento, senza bisogno di un evento eccezionale.",
      sourceLabel: "Ipotesi di modello",
      kind: "modello",
    },
    extraordinary: {
      title: "Picco eccezionale dei prezzi energetici",
      potentialRangePp: [0.05, 0.22],
      triggerCondition: "Un rincaro superiore allo stagionale finisce sui titoli per una settimana.",
      why: "Un caro-bollette fuori scala sposta il consenso verso chi ha già una misura pronta, più che verso chi commenta il fatto.",
      bipLever: "Energia e bollette",
    },
  },
  "2027-02": {
    label: "Feb 2027 · quadri territoriali",
    monthShort: "FEB '27",
    kind: "modello",
    ordinary: {
      title: "Quadri territoriali e candidature",
      why: "Febbraio è il mese dei quadri locali e delle liste: +0,02 punti, la rete prepara la campagna di primavera.",
      sourceLabel: "Ipotesi di modello",
      kind: "modello",
    },
    extraordinary: {
      title: "Ondata di cronaca nera o fatto in una grande città",
      potentialRangePp: [-0.08, 0.2],
      triggerCondition: "Un fatto di sicurezza urbana resta in apertura per più giorni.",
      why: "Il tema è già nel programma. Il segno dipende da se il partito viene associato a una proposta o solo alla polemica.",
      bipLever: "Sicurezza e degrado urbano",
    },
  },
  "2027-03": {
    label: "Mar 2027 · mobilitazione dall'astensione",
    monthShort: "MAR '27",
    kind: "modello",
    ordinary: {
      title: "Avvio della mobilitazione",
      why: "Da marzo rientra una parte degli astenuti: +0,05 punti con il 36% di astenuti della matrice Ipsos, di più con il 57,4% di Sky TG24.",
      sourceLabel: "Ipotesi di modello sulla matrice flussi",
      kind: "modello",
    },
    extraordinary: {
      title: "Errore di campagna o endorsement pesante",
      potentialRangePp: [-0.2, 0.25],
      triggerCondition: "Una dichiarazione del leader o un ingresso eccellente cambia la copertura per una settimana.",
      why: "In fase di mobilitazione la visibilità amplifica sia il consenso nuovo sia il rifiuto. È lo shock con la forbice più larga.",
      bipLever: "Presenza territoriale",
    },
  },
  "2027-04": {
    label: "Apr 2027 · precampagna territoriale",
    monthShort: "APR '27",
    kind: "modello",
    ordinary: {
      title: "Precampagna sui territori",
      why: "Aprile sposta il peso dalle tv ai territori: +0,07 punti di mobilitazione, scalati sulla quota di astenuti della matrice.",
      sourceLabel: "Ipotesi di modello sulla matrice flussi",
      kind: "modello",
    },
    extraordinary: {
      title: "Risultato locale o suppletiva a sorpresa",
      potentialRangePp: [-0.15, 0.2],
      triggerCondition: "Un voto locale viene letto come test nazionale sul partito.",
      why: "Un singolo comune non sposta il consenso nazionale da solo. Lo sposta se i media lo usano come prova della tenuta o del cedimento.",
      bipLever: "Candidature e radicamento",
    },
  },
  "2027-05": {
    label: "Mag 2027 · orizzonte di verifica",
    monthShort: "MAG '27",
    kind: "modello",
    ordinary: {
      title: "Orizzonte di verifica",
      why: "Maggio chiude la finestra: +0,09 punti a mese intero dalla mobilitazione pre-elettorale. È un contributo di modello, non una previsione di voto.",
      sourceLabel: "Ipotesi di modello sulla matrice flussi",
      kind: "modello",
    },
    extraordinary: {
      title: "Inversione netta dei sondaggi nazionali",
      potentialRangePp: [-0.25, 0.3],
      triggerCondition: "Due istituti consecutivi spostano Futuro Nazionale di almeno mezzo punto nella stessa direzione.",
      why: "È l'unico shock che il modello tratta come verifica, non come causa. Se arriva, la traiettoria va ricalcolata sul nuovo S.",
      bipLever: "Nessuna leva nuova: si rilegge il consenso",
    },
  },
};

/** Sotto ~8 giorni su 30 il mese non è nel lasso. */
const ACTIVE_MONTH_WEIGHT = 0.25;

function monthKeyOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function horizonDays(months: number): number {
  return Math.max(1, Math.round(months * 30));
}

function buildTimeline(input: {
  asOf: Date;
  months: number;
  flussi: FlussiIpsos;
  scenario: ForecastScenarioId;
}): TimelineEventItem[] {
  const opts = forecastCycleOptions(input.flussi, input.scenario);
  const weights = new Map(
    forecastMonthSlices(input.asOf, horizonDays(input.months)).map((s) => [s.key, s.weight]),
  );
  const currentKey = monthKeyOf(input.asOf);
  const keys = Object.keys(MONTH_FACTORS)
    .filter((key) => key >= currentKey)
    .sort();
  const weightCache = new Map<number, Map<string, number>>();
  const weightAt = (step: number, key: string) => {
    let row = weightCache.get(step);
    if (!row) {
      row = new Map(
        forecastMonthSlices(input.asOf, horizonDays(step)).map((s) => [s.key, s.weight]),
      );
      weightCache.set(step, row);
    }
    return row.get(key) ?? 0;
  };
  return keys.map((monthKey, index) => {
    const factor = MONTH_FACTORS[monthKey]!;
    let stepMonth = index + 1;
    for (let m = 1; m <= 12; m++) {
      if (weightAt(m, monthKey) >= ACTIVE_MONTH_WEIGHT) {
        stepMonth = m;
        break;
      }
    }
    const weight = Math.min(1, weights.get(monthKey) ?? 0);
    const inWindow = weight >= ACTIVE_MONTH_WEIGHT;
    const full = cycleMonthPp(monthKey, opts);
    return {
      key: monthKey,
      monthKey,
      monthShort: factor.monthShort,
      stepMonth,
      inSelectedWindow: inWindow,
      weightInWindow: Math.round(weight * 100) / 100,
      netMonthPp: inWindow ? fix2(full * weight) : 0,
      fullMonthNetPp: fix2(full),
      ordinaryDeltaPp: fix2(full),
      extraordinaryRangePp: factor.extraordinary.potentialRangePp,
      ordinary: { ...factor.ordinary, deltaPp: fix2(full) },
      extraordinary: factor.extraordinary,
    };
  });
}

function horizonIdForMonths(months: number, mayMonths: number): GrowthHorizonId {
  if (Math.abs(months - mayMonths) < 1e-6) return "may27";
  if (months <= 1.2) return "d30";
  if (months <= 3.2) return "d90";
  return "may27";
}

function mayLabel(months: number): string {
  return Math.abs(months - 6) < 1e-6 ? "180 giorni · Maggio 2027" : "Maggio 2027";
}

/** Matrice flussi coerente con la quota astenuti passata dai chiamanti storici. */
function flussiForAbstention(abstentionShare?: number): FlussiIpsos {
  const ipsos = flussiFromMatrix("ipsos_luglio_2026");
  if (abstentionShare == null || Math.abs(abstentionShare - ipsos.ast) < 0.005) return ipsos;
  const sky = flussiFromMatrix("skytg24_ottobre_2026");
  if (Math.abs(abstentionShare - sky.ast) < 0.005) return sky;
  return { ...ipsos, ast: abstentionShare, altri: undefined };
}

export type ProjectMonthsInput = {
  startPct: number;
  evidence: GrowthEvidence;
  months: number;
  /** Moltiplicatore dello sforzo (REGIME_SENSITIVITY). 1 = scenario base. */
  sensitivity?: number;
  mayMonths?: number;
  asOf?: Date;
  /** Quota astenuti della matrice flussi, 0..1, se non si passa la matrice intera. */
  abstentionShare?: number;
  flussi?: FlussiIpsos;
  /** Ingressi what-if oltre alle presenze delle righe (deputati, consiglieri, sindaci). */
  ingressi?: IngressiFn;
  regions?: ForecastRegionInput[];
  /** Comitati attivi dello scenario live. Se manca: valore dello scenario congelato. */
  comitati?: number;
  networkDelta?: ForecastNetworkDelta;
  profiles?: SimulatedEntryProfile[];
  scenario?: ForecastScenarioId;
  /** false = scenario passivo (inerziale). */
  levers?: boolean;
};

export function forecastInputFromProjection(
  input: Omit<ProjectMonthsInput, "months" | "mayMonths">,
  asOf: Date,
): ForecastV4Input {
  return {
    asOf,
    startPct: input.startPct,
    history: input.evidence.history,
    polls: input.evidence.polls,
    newsHeadlines: input.evidence.newsHeadlines,
    newsScore: 0,
    flussi: input.flussi ?? flussiForAbstention(input.abstentionShare),
    regions: input.regions,
    comitati: input.comitati,
    networkDelta: input.networkDelta,
    ingressi: input.ingressi,
    profiles: input.profiles,
    effort: input.sensitivity ?? 1,
  };
}

export function projectMonths(input: ProjectMonthsInput): HorizonProjection {
  const asOf = input.asOf ?? new Date();
  const months = Math.max(0.25, input.months);
  const mayMonths = input.mayMonths ?? horizonMonths("may27", asOf);
  const id = horizonIdForMonths(months, mayMonths);
  const scenario: ForecastScenarioId =
    input.levers === false ? "passivo" : (input.scenario ?? "base");
  const v4Input = forecastInputFromProjection(input, asOf);
  const { horizon, diagnostics } = forecastV4AtDays(v4Input, horizonDays(months), scenario);
  const slopePp = factorPp(horizon, "momentum");
  const newsPp = factorPp(horizon, "agenda");
  const bipPp = fix2(
    factorPp(horizon, "donor") + factorPp(horizon, "ground") + factorPp(horizon, "magnet"),
  );
  const seasonalEventPp = factorPp(horizon, "cycle");
  const noteOf = (fid: ForecastFactorRow["id"]) =>
    horizon.factors.find((f) => f.id === fid)?.note ?? "";
  const breakdown: ForecastBreakdown = {
    startPct: horizon.startPct,
    inertiaPp: slopePp,
    calendarPp: seasonalEventPp,
    newsPp,
    bipPp: fix2(factorPp(horizon, "donor") + factorPp(horizon, "ground")),
    ingressiPp: factorPp(horizon, "magnet"),
    resistancePp: factorPp(horizon, "bounds"),
    netPp: horizon.deltaPp,
    centralPct: horizon.centralPct,
    bandLowPct: horizon.lo10Pct,
    bandHighPct: horizon.hi90Pct,
    inertiaNote: noteOf("momentum"),
    calendarNote: noteOf("cycle"),
    newsNote: noteOf("agenda"),
    bipNote: `${noteOf("donor")} ${noteOf("ground")}`,
    resistanceNote: noteOf("bounds"),
    factors: horizon.factors,
  };
  const activeDrivers = forecastMonthSlices(asOf, horizonDays(months))
    .filter((s) => s.weight >= ACTIVE_MONTH_WEIGHT && MONTH_FACTORS[s.key])
    .map((s) => MONTH_FACTORS[s.key]!.label);
  const driverSources = forecastMonthSlices(asOf, horizonDays(months))
    .filter((s) => s.weight >= ACTIVE_MONTH_WEIGHT && MONTH_FACTORS[s.key])
    .map((s) => {
      const f = MONTH_FACTORS[s.key]!;
      return { label: f.label, url: f.ordinary.sourceUrl, kind: f.kind };
    });
  const label =
    months <= 1.05
      ? "30 giorni"
      : Math.abs(months - 3) < 1e-6
        ? "90 giorni"
        : Math.abs(months - mayMonths) < 1e-6
          ? mayLabel(months)
          : `${Math.round(months)} mesi`;
  return {
    id,
    label,
    months,
    deltaPp: horizon.deltaPp,
    slopePp,
    newsPp,
    bipPp,
    seasonalEventPp,
    breakdown,
    activeDrivers,
    driverSources,
    timeline: buildTimeline({ asOf, months, flussi: v4Input.flussi!, scenario }),
    centralPct: horizon.centralPct,
    bandLowPct: horizon.lo10Pct,
    bandHighPct: horizon.hi90Pct,
    factors: horizon.factors,
    v4: horizon,
    diagnostics,
  };
}

export function projectHorizon(
  input: Omit<ProjectMonthsInput, "months" | "mayMonths"> & { horizon: GrowthHorizonId },
): HorizonProjection {
  const asOf = input.asOf ?? new Date();
  const months = horizonMonths(input.horizon, asOf);
  const projected = projectMonths({
    ...input,
    months,
    mayMonths: horizonMonths("may27", asOf),
    asOf,
  });
  return {
    ...projected,
    id: input.horizon,
    label: input.horizon === "may27" ? mayLabel(months) : HORIZON_LABEL[input.horizon],
  };
}

export function projectAllHorizons(
  input: Omit<ProjectMonthsInput, "months" | "mayMonths">,
): HorizonProjection[] {
  return HORIZON_ORDER.map((horizon) => projectHorizon({ ...input, horizon }));
}

/**
 * Dal 30 luglio: per ogni coppia di rilievi a circa 30 giorni,
 * errore del «resta dov'è» contro la pendenza smorzata.
 */
export function backtestFlatVsSlope(points: ConsensusPoint[]): {
  flatMae: number;
  slopeMae: number;
  n: number;
} {
  const sorted = sortedConsensusPoints(points).filter((p) => p.isoDate >= "2026-07-01");
  let flat = 0;
  let slope = 0;
  let n = 0;
  for (let i = 0; i < sorted.length; i++) {
    const now = sorted[i]!;
    const later = sorted.slice(i + 1).find((p) => {
      const days = isoDaysBetween(now.isoDate, p.isoDate);
      return days >= 20 && days <= 50;
    });
    if (!later) continue;
    const days = isoDaysBetween(now.isoDate, later.isoDate);
    const slopeNow = consensusSlopePpPerMonth(sorted.slice(0, i + 1)).slopePpPerMonth;
    const predicted = now.pct + dampedSlopePp(slopeNow, days / 30.44);
    flat += Math.abs(later.pct - now.pct);
    slope += Math.abs(later.pct - predicted);
    n += 1;
  }
  return {
    flatMae: n === 0 ? 0 : Math.round((flat / n) * 100) / 100,
    slopeMae: n === 0 ? 0 : Math.round((slope / n) * 100) / 100,
    n,
  };
}

function ppIt(n: number): string {
  const v = Math.abs(n) < 0.005 ? 0 : n;
  return `${v > 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")} pp`;
}

function pctIt(n: number): string {
  return `${n.toFixed(2).replace(".", ",")}%`;
}

export function explainGrowth(input: {
  startPct: number;
  evidence: GrowthEvidence;
  horizons: HorizonProjection[];
}): string {
  const d30 = input.horizons.find((h) => h.id === "d30");
  const may = input.horizons.find((h) => h.id === "may27");
  const diag = d30?.diagnostics ?? may?.diagnostics;
  const open = `Modello v4.0: si parte dal consenso di oggi, ${pctIt(input.startPct)}, e si sommano sette fattori; l'ottavo è la fascia all'80%.`;
  const near = d30
    ? `A 30 giorni ${pctIt(d30.centralPct)} (${ppIt(d30.deltaPp)}): momentum ${ppIt(d30.slopePp)}, agenda ${ppIt(d30.newsPp)}, bacini, rete e istituzioni ${ppIt(d30.bipPp)}, ciclo ${ppIt(d30.seasonalEventPp)}.`
    : "";
  const momentum = diag
    ? `Il filtro di Kalman legge il livello a ${pctIt(diag.levelPct)} con pendenza a 21 giorni di ${diag.slopeShortPpMonth.toFixed(2).replace(".", ",")} pp/mese${diag.momentumNeutralized ? "; gli ultimi 15 giorni sono stabili, quindi l'inerzia negativa è azzerata" : ""}.`
    : "";
  const far = may
    ? `A ${may.label.toLowerCase()} ${pctIt(may.centralPct)}, fascia 80% ${pctIt(may.bandLowPct)}–${pctIt(may.bandHighPct)}: più larga perché i mesi sono di più.`
    : "";
  return [open, near, momentum, far].filter(Boolean).join(" ");
}
