import type { Checkpoint, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { OperationalRoadmap, RoadmapStage } from "@/lib/engine/operationalRoadmapBuilder";

/**
 * Motore di monitoraggio della Rotta Operativa.
 *
 * Confronta le misure reali (sondaggi, supermedia, conteggi di rete) con il piano congelato
 * al momento dell'attivazione. Il consenso è trattato come un segnale rumoroso: un filtro di
 * Kalman a livello + pendenza stima il livello vero e la sua incertezza, e ogni verdetto
 * porta con sé la confidenza. Non ricalcola mai il piano né le previsioni V4.
 */

export type ConsensoSource = "sondaggio" | "supermedia" | "interno";

export type ConsensoObservation = {
  id: string;
  /** Data della rilevazione, AAAA-MM-GG. */
  date: string;
  pct: number;
  /** Ampiezza del campione, se nota. */
  n?: number;
  source: ConsensoSource;
  label?: string;
};

/** Totali cumulati assoluti, non variazioni. */
export type NetworkObservation = {
  id: string;
  date: string;
  committees: number;
  members: number;
  elected: number;
};

export type NetworkTotals = { committees: number; members: number; elected: number };

export type RouteLedger = {
  consenso: ConsensoObservation[];
  rete: NetworkObservation[];
};

export type MonitorRoute = {
  targetPct: number;
  horizonDays: number;
  activatedAt: string;
  baselinePctAtActivation: number;
  baselineNetwork?: NetworkTotals;
};

export type MonitorStatus = "IN_ANTICIPO" | "IN_ROTTA" | "DA_ACCELERARE" | "NON_DETERMINABILE" | "NESSUN_DATO";
export type PaceStatus = "IN_ANTICIPO" | "IN_ROTTA" | "DA_ACCELERARE" | "CRITICO" | "NESSUN_DATO";
export type DiagnosisCode =
  | "PIANO_IN_LINEA"
  | "CONVERSIONE_LENTA"
  | "ESECUZIONE_IN_RITARDO"
  | "VENTO_ESTERNO"
  | "DATI_INSUFFICIENTI"
  | "ORIZZONTE_CONCLUSO";
export type AlertSeverity = "info" | "attenzione" | "allarme";

export type MonitorAlert = { severity: AlertSeverity; code: string; message: string };

export type ConsensoSeriesPoint = { day: number; pct: number; sd: number };

export type ConsensoMonitor = {
  status: MonitorStatus;
  observations: number;
  lastObservationAgeDays: number | null;
  /** Stima del livello vero oggi (STIMA MODELLO, filtrata su rilevazioni MISURATE). */
  levelPct: number;
  levelSd: number;
  slopePpPerMonth: number;
  expectedPct: number;
  minOnTrackPct: number;
  stretchPct: number;
  gapToExpectedPp: number;
  /** Probabilità che il livello vero sia sotto la soglia minima di oggi. */
  probBelowMin: number;
  probAboveStretch: number;
  projectedAtHorizonPct: number;
  projectedAtHorizonSd: number;
  /** Probabilità di raggiungere il traguardo a fine orizzonte al passo attuale. */
  probReachTarget: number;
  requiredSlopePpPerMonth: number;
  plannedRemainingSlopePpPerMonth: number;
  /** Rilevazioni indipendenti aggiuntive per ridurre l'incertezza sotto 0,4 pp. */
  extraPollsToResolve: number;
  filtered: ConsensoSeriesPoint[];
};

export type NetworkKey = "committees" | "members" | "elected";

export type NetworkKpi = {
  key: NetworkKey;
  label: string;
  status: PaceStatus;
  actual: number | null;
  planned: number;
  planTotal: number;
  ratio: number | null;
  currentMonthly: number | null;
  requiredMonthly: number;
  capMonthly: number;
  recoverable: boolean;
  projectedAtHorizon: number | null;
  lastObservationAgeDays: number | null;
};

export type GateCriterion = {
  key: "consenso" | NetworkKey;
  label: string;
  needed: number;
  value: number | null;
  pass: boolean | null;
};

export type StageGate = {
  stageId: 1 | 2 | 3 | 4;
  label: string;
  fromDay: number;
  toDay: number;
  state: "CHIUSA" | "IN_CORSO" | "FUTURA";
  verdict: "SUPERATO" | "A_RISCHIO" | "NON_SUPERATO" | "DA_VALUTARE";
  daysToGate: number;
  criteria: GateCriterion[];
};

export type RouteMonitorReport = {
  epistemic: { observations: "MISURATO"; levelEstimate: "STIMA MODELLO"; plan: "IPOTESI" };
  elapsedDays: number;
  horizonDays: number;
  daysLeft: number;
  currentStageId: 1 | 2 | 3 | 4;
  consenso: ConsensoMonitor;
  network: NetworkKpi[];
  executionRatio: number | null;
  gates: StageGate[];
  diagnosis: { code: DiagnosisCode; headline: string; detail: string };
  alerts: MonitorAlert[];
  weeklyOrders: string[];
  nextMeasurement: { date: string; what: string };
};

export type MonitorInput = {
  route: MonitorRoute;
  plan: StrategicBackcastResult;
  roadmap: OperationalRoadmap;
  ledger: RouteLedger;
  now: Date;
  /** Volatilità giornaliera del livello da V4 (pp/giorno). Facoltativa. */
  sigmaDailyPp?: number;
};

const DAY_MS = 86_400_000;
const DEFF = 1.15;
const HOUSE_SD_PP = 0.3;
const SUPERMEDIA_SD_PP = 0.25;
const INTERNAL_SD_PP = 0.6;
const DEFAULT_POLL_N = 1000;
const STALE_CONSENSO_DAYS = 21;
const STALE_NETWORK_DAYS = 45;
const RESOLVED_SD_PP = 0.4;
const GATE_NETWORK_TOLERANCE = 0.9;

export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function dayIndex(date: string, activatedAt: string): number {
  const a = Date.parse(`${activatedAt.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export function elapsedDaysAt(activatedAt: string, now: Date): number {
  const a = Date.parse(`${activatedAt.slice(0, 10)}T00:00:00Z`);
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/** Varianza (pp²) di una rilevazione: campionamento con effetto di disegno più rumore tra istituti. */
export function consensoObservationVariance(obs: Pick<ConsensoObservation, "pct" | "n" | "source">): number {
  if (obs.source === "supermedia") return SUPERMEDIA_SD_PP ** 2;
  if (obs.source === "interno" && !obs.n) return INTERNAL_SD_PP ** 2;
  const n = Math.max(50, obs.n ?? DEFAULT_POLL_N);
  const p = Math.min(0.5, Math.max(0.005, obs.pct / 100));
  const sampling = ((p * (1 - p) * DEFF) / n) * 10_000;
  return sampling + (obs.source === "sondaggio" ? HOUSE_SD_PP ** 2 : 0);
}

type KState = { day: number; level: number; slope: number; p00: number; p01: number; p11: number };

function predict(state: KState, toDay: number, qLevel: number, qSlope: number): KState {
  const dt = Math.max(0, toDay - state.day);
  return {
    day: toDay,
    level: state.level + state.slope * dt,
    slope: state.slope,
    p00: state.p00 + 2 * dt * state.p01 + dt * dt * state.p11 + qLevel * dt,
    p01: state.p01 + dt * state.p11,
    p11: state.p11 + qSlope * dt,
  };
}

function update(state: KState, value: number, variance: number): KState {
  const s = state.p00 + variance;
  const k0 = state.p00 / s;
  const k1 = state.p01 / s;
  const innovation = value - state.level;
  return {
    day: state.day,
    level: state.level + k0 * innovation,
    slope: state.slope + k1 * innovation,
    p00: state.p00 - k0 * state.p00,
    p01: state.p01 - k0 * state.p01,
    p11: state.p11 - k1 * state.p01,
  };
}

/** Corridoio atteso (minimo, atteso, anticipo) interpolato a un giorno qualsiasi dell'orizzonte. */
export function planCorridorAt(plan: Pick<StrategicBackcastResult, "currentPct" | "checkpoints">, day: number) {
  return interpolatePlan(plan, day);
}

function interpolatePlan(plan: Pick<StrategicBackcastResult, "currentPct" | "checkpoints">, day: number) {
  const anchor: Pick<Checkpoint, "day" | "expectedPct" | "minOnTrackPct" | "stretchPct"> = {
    day: 0,
    expectedPct: plan.currentPct,
    minOnTrackPct: plan.currentPct,
    stretchPct: plan.currentPct,
  };
  const points = [anchor, ...plan.checkpoints];
  let previous = points[0]!;
  for (const point of points) {
    if (point.day === day) return { expected: point.expectedPct, min: point.minOnTrackPct, stretch: point.stretchPct };
    if (point.day > day) {
      const span = point.day - previous.day || 1;
      const w = (day - previous.day) / span;
      return {
        expected: previous.expectedPct + (point.expectedPct - previous.expectedPct) * w,
        min: previous.minOnTrackPct + (point.minOnTrackPct - previous.minOnTrackPct) * w,
        stretch: previous.stretchPct + (point.stretchPct - previous.stretchPct) * w,
      };
    }
    previous = point;
  }
  const last = points[points.length - 1]!;
  return { expected: last.expectedPct, min: last.minOnTrackPct, stretch: last.stretchPct };
}

function monitorConsenso(input: MonitorInput, elapsed: number): ConsensoMonitor {
  const { route, plan, ledger } = input;
  const horizon = route.horizonDays;
  const sigmaDaily = Math.min(0.2, Math.max(0.05, input.sigmaDailyPp ?? 0.08));
  const qLevel = sigmaDaily ** 2;
  const qSlope = 4e-6;
  const usable = ledger.consenso
    .map((obs) => ({ obs, day: dayIndex(obs.date, route.activatedAt) }))
    .filter((row) => row.day >= 0 && Number.isFinite(row.obs.pct))
    .sort((a, b) => a.day - b.day);

  let state: KState = { day: 0, level: route.baselinePctAtActivation, slope: 0, p00: 0.3 ** 2, p01: 0, p11: 0.02 ** 2 };
  const filtered: ConsensoSeriesPoint[] = [];
  for (const row of usable) {
    state = update(predict(state, row.day, qLevel, qSlope), row.obs.pct, consensoObservationVariance(row.obs));
    filtered.push({ day: row.day, pct: state.level, sd: Math.sqrt(Math.max(0, state.p00)) });
  }
  const now = predict(state, elapsed, qLevel, qSlope);
  const levelSd = Math.sqrt(Math.max(1e-9, now.p00));
  const band = interpolatePlan(plan, Math.min(elapsed, horizon));
  const gap = now.level - band.expected;
  const probBelowMin = normalCdf((band.min - now.level) / levelSd);
  const probAboveStretch = 1 - normalCdf((band.stretch - now.level) / levelSd);
  const daysLeft = Math.max(0, horizon - elapsed);
  const end = predict(now, Math.max(elapsed, horizon), qLevel, qSlope);
  const endSd = Math.sqrt(Math.max(1e-9, end.p00));
  const probReach = 1 - normalCdf((route.targetPct - end.level) / endSd);
  const lastDay = usable.length > 0 ? usable[usable.length - 1]!.day : null;
  const age = lastDay == null ? null : Math.max(0, elapsed - lastDay);
  const monthsLeft = Math.max(daysLeft, 1) / 30;
  const planNow = interpolatePlan(plan, Math.min(elapsed, horizon));
  const planEnd = interpolatePlan(plan, horizon);

  let status: MonitorStatus;
  if (usable.length === 0) status = "NESSUN_DATO";
  else if (probBelowMin >= 0.8) status = "DA_ACCELERARE";
  else if (probAboveStretch >= 0.8) status = "IN_ANTICIPO";
  else if (levelSd <= RESOLVED_SD_PP) status = "IN_ROTTA";
  else status = "NON_DETERMINABILE";

  const singleVar = consensoObservationVariance({ pct: Math.max(now.level, 0.5), n: DEFAULT_POLL_N, source: "sondaggio" });
  const extra = Math.max(0, Math.ceil((1 / RESOLVED_SD_PP ** 2 - 1 / Math.max(now.p00, 1e-6)) * singleVar));

  return {
    status,
    observations: usable.length,
    lastObservationAgeDays: age,
    levelPct: now.level,
    levelSd,
    slopePpPerMonth: now.slope * 30,
    expectedPct: band.expected,
    minOnTrackPct: band.min,
    stretchPct: band.stretch,
    gapToExpectedPp: gap,
    probBelowMin,
    probAboveStretch,
    projectedAtHorizonPct: end.level,
    projectedAtHorizonSd: endSd,
    probReachTarget: probReach,
    requiredSlopePpPerMonth: (route.targetPct - now.level) / monthsLeft,
    plannedRemainingSlopePpPerMonth: (planEnd.expected - planNow.expected) / monthsLeft,
    extraPollsToResolve: Math.min(extra, 40),
    filtered,
  };
}

function cumulative(total: number, day: number, horizon: number): number {
  return Math.max(0, Math.round(total * (Math.min(day, horizon) / horizon)));
}

function paceStatus(ratio: number | null): PaceStatus {
  if (ratio == null) return "NESSUN_DATO";
  if (ratio >= 1.05) return "IN_ANTICIPO";
  if (ratio >= 0.85) return "IN_ROTTA";
  if (ratio >= 0.6) return "DA_ACCELERARE";
  return "CRITICO";
}

function latestNetwork(ledger: RouteLedger, route: MonitorRoute, uptoDay: number) {
  return ledger.rete
    .map((obs) => ({ obs, day: dayIndex(obs.date, route.activatedAt) }))
    .filter((row) => row.day >= 0 && row.day <= uptoDay)
    .sort((a, b) => a.day - b.day)
    .at(-1);
}

function monitorNetwork(input: MonitorInput, elapsed: number): NetworkKpi[] {
  const { route, plan, ledger } = input;
  const horizon = route.horizonDays;
  const base: NetworkTotals = route.baselineNetwork ?? { committees: 0, members: 0, elected: 0 };
  const latest = latestNetwork(ledger, route, Math.max(elapsed, 0));
  const monthsLeft = Math.max(horizon - elapsed, 1) / 30;
  const defs: { key: NetworkKey; label: string; total: number; cap: number }[] = [
    { key: "committees", label: "Comitati", total: plan.network.deltaCommittees, cap: plan.network.monthlyCommitteeCap },
    { key: "members", label: "Tesserati", total: plan.network.deltaMembers, cap: plan.network.monthlyMemberCap },
    { key: "elected", label: "Amministratori ed eletti", total: plan.network.electedTarget, cap: plan.network.monthlyElectedCap },
  ];
  return defs.map((def) => {
    const planned = cumulative(def.total, elapsed, horizon);
    const actual = latest ? Math.max(0, latest.obs[def.key] - base[def.key]) : null;
    const ratio = actual == null ? null : planned < 1 ? (actual > 0 ? 1.2 : 1) : actual / planned;
    const obsDay = latest ? latest.day : null;
    const currentMonthly = actual == null || obsDay == null ? null : actual / (Math.max(obsDay, 7) / 30);
    const remaining = Math.max(0, def.total - (actual ?? 0));
    const requiredMonthly = remaining / monthsLeft;
    const projected = actual == null || currentMonthly == null ? null : actual + currentMonthly * ((horizon - (obsDay ?? 0)) / 30);
    return {
      key: def.key,
      label: def.label,
      status: paceStatus(ratio),
      actual,
      planned,
      planTotal: def.total,
      ratio,
      currentMonthly,
      requiredMonthly,
      capMonthly: def.cap,
      recoverable: requiredMonthly <= def.cap * 1.0001,
      projectedAtHorizon: projected,
      lastObservationAgeDays: obsDay == null ? null : Math.max(0, elapsed - obsDay),
    };
  });
}

function stageAt(roadmap: OperationalRoadmap, day: number): RoadmapStage {
  return roadmap.stages.find((stage) => day >= stage.fromDay && day <= stage.toDay) ?? (day < 1 ? roadmap.stages[0] : roadmap.stages[3]);
}

function evaluateGates(input: MonitorInput, elapsed: number, consenso: ConsensoMonitor, network: NetworkKpi[]): StageGate[] {
  const { route, roadmap, ledger } = input;
  const base: NetworkTotals = route.baselineNetwork ?? { committees: 0, members: 0, elected: 0 };
  return roadmap.stages.map((stage) => {
    const state: StageGate["state"] = elapsed > stage.toDay ? "CHIUSA" : elapsed >= stage.fromDay ? "IN_CORSO" : "FUTURA";
    const needed: Record<GateCriterion["key"], number> = {
      consenso: stage.verificationMilestone.minOnTrackPct,
      committees: Math.round(stage.committees * GATE_NETWORK_TOLERANCE),
      members: Math.round(stage.members * GATE_NETWORK_TOLERANCE),
      elected: Math.round(stage.elected * GATE_NETWORK_TOLERANCE),
    };
    const value: Record<GateCriterion["key"], number | null> = { consenso: null, committees: null, elected: null, members: null };
    if (state === "CHIUSA") {
      const lastPoint = [...consenso.filtered].filter((point) => point.day <= stage.toDay).at(-1);
      value.consenso = lastPoint?.pct ?? null;
      const snap = latestNetwork(ledger, route, stage.toDay);
      if (snap) for (const key of ["committees", "members", "elected"] as const) value[key] = Math.max(0, snap.obs[key] - base[key]);
    } else if (state === "IN_CORSO") {
      const daysAhead = stage.toDay - elapsed;
      if (consenso.observations > 0) value.consenso = consenso.levelPct + (consenso.slopePpPerMonth / 30) * daysAhead;
      for (const kpi of network) {
        if (kpi.actual != null && kpi.currentMonthly != null) value[kpi.key] = kpi.actual + kpi.currentMonthly * (daysAhead / 30);
      }
    }
    const labels: Record<GateCriterion["key"], string> = {
      consenso: "Consenso minimo",
      committees: "Comitati",
      members: "Tesserati",
      elected: "Eletti",
    };
    const criteria: GateCriterion[] = (["consenso", "committees", "members", "elected"] as const).map((key) => ({
      key,
      label: labels[key],
      needed: needed[key],
      value: value[key],
      pass: value[key] == null || state === "FUTURA" ? null : value[key]! >= needed[key],
    }));
    const known = criteria.filter((item) => item.pass != null);
    const failed = known.some((item) => item.pass === false);
    let verdict: StageGate["verdict"] = "DA_VALUTARE";
    if (state !== "FUTURA" && known.length > 0) {
      verdict = failed ? (state === "CHIUSA" ? "NON_SUPERATO" : "A_RISCHIO") : "SUPERATO";
    }
    return {
      stageId: stage.stageId,
      label: stage.label,
      fromDay: stage.fromDay,
      toDay: stage.toDay,
      state,
      verdict,
      daysToGate: Math.max(0, stage.toDay - elapsed),
      criteria,
    };
  });
}

function addDays(dateIso: string, days: number): string {
  return new Date(Date.parse(`${dateIso.slice(0, 10)}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function monitorRoute(input: MonitorInput): RouteMonitorReport {
  const { route, plan, roadmap } = input;
  const elapsed = elapsedDaysAt(route.activatedAt, input.now);
  const horizon = route.horizonDays;
  const consenso = monitorConsenso(input, elapsed);
  const network = monitorNetwork(input, elapsed);
  const gates = evaluateGates(input, elapsed, consenso, network);
  const stage = stageAt(roadmap, Math.max(1, elapsed));
  const known = network.filter((kpi) => kpi.ratio != null);
  const executionRatio = known.length === 0 ? null : known.reduce((sum, kpi) => sum + Math.min(1.5, kpi.ratio!), 0) / known.length;
  const todayIso = input.now.toISOString().slice(0, 10);

  const alerts: MonitorAlert[] = [];
  const concluded = elapsed > horizon;
  const insufficient = consenso.status === "NESSUN_DATO" || consenso.status === "NON_DETERMINABILE";
  const below = consenso.status === "DA_ACCELERARE";
  const above = consenso.status === "IN_ANTICIPO";
  const execOk = executionRatio == null ? null : executionRatio >= 0.85;

  if (concluded) alerts.push({ severity: "info", code: "ORIZZONTE", message: `L'orizzonte di ${horizon} giorni è concluso: valuta l'esito e imposta una nuova rotta.` });
  if (consenso.observations === 0) {
    alerts.push({ severity: "attenzione", code: "NESSUN_CONSENSO", message: "Nessuna rilevazione di consenso dopo l'attivazione: il piano non può essere verificato." });
  } else if (consenso.lastObservationAgeDays != null && consenso.lastObservationAgeDays > STALE_CONSENSO_DAYS) {
    alerts.push({ severity: "attenzione", code: "DATO_VECCHIO", message: `L'ultima rilevazione di consenso ha ${consenso.lastObservationAgeDays} giorni: la stima è molto incerta.` });
  }
  if (consenso.status === "NON_DETERMINABILE") {
    alerts.push({
      severity: "info",
      code: "INCERTEZZA",
      message: `Con ±${fmt(consenso.levelSd, 2)} pp di incertezza non si distingue la rotta dal corridoio (±0,25 pp). Servono circa ${consenso.extraPollsToResolve} rilevazioni in più.`,
    });
  }
  if (below) {
    alerts.push({
      severity: consenso.probBelowMin >= 0.95 ? "allarme" : "attenzione",
      code: "SOTTO_CORRIDOIO",
      message: `Consenso stimato ${fmt(consenso.levelPct, 2)}% contro soglia ${fmt(consenso.minOnTrackPct, 2)}%: sotto il corridoio con confidenza ${Math.round(consenso.probBelowMin * 100)}%.`,
    });
  } else if (consenso.probBelowMin >= 0.5 && consenso.observations > 0) {
    alerts.push({ severity: "info", code: "SEGNALE_DEBOLE", message: "Il consenso è sotto la linea attesa ma il segnale non è ancora netto: non reagire a una sola rilevazione." });
  }
  for (const kpi of network) {
    if (kpi.status === "CRITICO") alerts.push({ severity: "allarme", code: `RETE_${kpi.key}`, message: `${kpi.label}: ${kpi.actual} contro ${kpi.planned} previsti a oggi.` });
    if (kpi.actual != null && !kpi.recoverable && !concluded) {
      alerts.push({
        severity: "attenzione",
        code: `CAPACITA_${kpi.key}`,
        message: `${kpi.label}: per chiudere il piano servono ${fmt(kpi.requiredMonthly, 0)}/mese, oltre la capacità di ${fmt(kpi.capMonthly, 0)}/mese. Va rivisto il traguardo o la capacità.`,
      });
    }
    if (kpi.lastObservationAgeDays != null && kpi.lastObservationAgeDays > STALE_NETWORK_DAYS) {
      alerts.push({ severity: "info", code: `DATO_VECCHIO_${kpi.key}`, message: `${kpi.label}: ultimo conteggio di ${kpi.lastObservationAgeDays} giorni fa.` });
    }
  }
  if (known.length === 0) alerts.push({ severity: "info", code: "NESSUNA_RETE", message: "Nessun conteggio di comitati, tesserati ed eletti: manca la metà del quadro." });
  const atRisk = gates.find((gate) => gate.state === "IN_CORSO" && gate.verdict === "A_RISCHIO");
  if (atRisk) alerts.push({ severity: "attenzione", code: "GATE_A_RISCHIO", message: `La tappa ${atRisk.stageId} chiude tra ${atRisk.daysToGate} giorni e, al passo attuale, non supera la verifica.` });

  let diagnosis: RouteMonitorReport["diagnosis"];
  if (concluded) {
    const reached = consenso.levelPct >= route.targetPct - 0.1;
    diagnosis = {
      code: "ORIZZONTE_CONCLUSO",
      headline: reached ? "Traguardo raggiunto" : "Traguardo non raggiunto",
      detail: `Stima finale ${fmt(consenso.levelPct, 2)}% contro traguardo ${fmt(route.targetPct, 1)}%.`,
    };
  } else if (insufficient && execOk !== false) {
    diagnosis = {
      code: "DATI_INSUFFICIENTI",
      headline: "Dati insufficienti per un giudizio",
      detail: consenso.status === "NESSUN_DATO"
        ? "Inserisci almeno due rilevazioni di consenso e un conteggio di rete."
        : `Il consenso è nel corridoio ma troppo incerto: servono circa ${consenso.extraPollsToResolve} rilevazioni in più.`,
    };
  } else if (below && execOk === true) {
    diagnosis = {
      code: "CONVERSIONE_LENTA",
      headline: "La macchina gira, il voto non risponde",
      detail: "La rete rispetta il piano ma il consenso è sotto la soglia. Aumentare i volumi non basta: i contatti sul territorio mobilitano chi è già vicino, non convincono. Cambia messaggio e bersaglio.",
    };
  } else if (below && execOk !== true) {
    diagnosis = {
      code: "ESECUZIONE_IN_RITARDO",
      headline: "Piano in ritardo sul consenso e sulla rete",
      detail: "Sia il consenso sia la costruzione della rete sono sotto il piano. Prima si recupera il ritmo di esecuzione, poi si giudica il messaggio.",
    };
  } else if (!below && execOk === false) {
    diagnosis = {
      code: "VENTO_ESTERNO",
      headline: above ? "Consenso sopra il piano, rete indietro" : "Consenso in linea, rete indietro",
      detail: "Il risultato non nasce dalla rete: non attribuirlo al piano e non rallentare la costruzione, o la crescita non resta.",
    };
  } else {
    diagnosis = {
      code: "PIANO_IN_LINEA",
      headline: above ? "Piano in anticipo" : "Piano in linea",
      detail: `Consenso stimato ${fmt(consenso.levelPct, 2)}% contro ${fmt(consenso.expectedPct, 2)}% atteso, rete al ${executionRatio == null ? "n.d." : `${Math.round(executionRatio * 100)}%`} del ritmo.`,
    };
  }

  const orders: string[] = [];
  const places = stage.placesToPresidiate.slice(0, 2).map((place) => place.place);
  if (diagnosis.code === "CONVERSIONE_LENTA") {
    orders.push(`Non aumentare i volumi. Prova due formulazioni del tema ${plan.themes[0]?.theme ?? "ariete"} in una regione fronte (${stage.regions[0] ?? "fronte"}) e misura la risposta entro 14 giorni.`);
    orders.push(`Concentra le risorse sulle regioni della tappa: ${stage.regions.join(", ")}.`);
  } else if (diagnosis.code === "ESECUZIONE_IN_RITARDO") {
    const worst = [...known].sort((a, b) => a.ratio! - b.ratio!)[0];
    if (worst) {
      orders.push(`Recupera ${worst.label.toLowerCase()}: servono ${fmt(worst.requiredMonthly, 0)}/mese contro ${worst.currentMonthly == null ? "n.d." : fmt(worst.currentMonthly, 0)}/mese attuali.`);
      if (!worst.recoverable) orders.push(`Al ritmo massimo (${fmt(worst.capMonthly, 0)}/mese) la rete non chiude il piano: sposta il traguardo di tappa o aggiungi capacità.`);
    }
    orders.push("Misura il consenso solo dopo aver recuperato il ritmo: oggi il confronto non è equo.");
  } else if (diagnosis.code === "VENTO_ESTERNO") {
    orders.push("Non ridurre gli sforzi: la crescita senza rete tende a rientrare.");
    orders.push(`Trasforma la crescita in struttura: comitati e tesserati nelle regioni della tappa (${stage.regions.join(", ")}).`);
  } else if (diagnosis.code === "DATI_INSUFFICIENTI") {
    orders.push("Registra le rilevazioni di consenso disponibili (sondaggi con campione e supermedia) e i conteggi di comitati, tesserati ed eletti.");
  } else if (diagnosis.code === "PIANO_IN_LINEA") {
    orders.push(`Mantieni il ritmo della tappa ${stage.stageId}: ${stage.focus}`);
  } else {
    orders.push("Valuta l'esito e imposta una nuova rotta con un traguardo realistico.");
  }
  if (places.length > 0 && !concluded) orders.push(`Presidia ora: ${places.join("; ")}.`);
  const nextDate = consenso.observations > 0 && consenso.lastObservationAgeDays != null ? addDays(todayIso, Math.max(0, 14 - consenso.lastObservationAgeDays)) : todayIso;

  return {
    epistemic: { observations: "MISURATO", levelEstimate: "STIMA MODELLO", plan: "IPOTESI" },
    elapsedDays: elapsed,
    horizonDays: horizon,
    daysLeft: Math.max(0, horizon - elapsed),
    currentStageId: stage.stageId,
    consenso,
    network,
    executionRatio,
    gates,
    diagnosis,
    alerts,
    weeklyOrders: orders.slice(0, 4),
    nextMeasurement: {
      date: nextDate,
      what: "Un sondaggio con campione di almeno 1.000 interviste (o la supermedia) e il conteggio di comitati, tesserati ed eletti.",
    },
  };
}
