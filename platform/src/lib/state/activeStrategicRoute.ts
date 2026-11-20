import type { Checkpoint, HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";

export type ActiveStrategicRouteState = {
  targetPct: number;
  horizonDays: HorizonDays;
  activatedAt: string;
  baselinePctAtActivation: number;
  /** Rete al momento dell'attivazione: serve a misurare i progressi. */
  baselineNetwork?: { committees: number; members: number; elected: number };
  /** Piano congelato all'attivazione: il monitoraggio non deve spostarsi quando cambiano i dati di oggi. */
  frozenPlan?: StrategicBackcastResult;
};

export type RouteTrackingStatus = "IN_ROTTA" | "DA_ACCELERARE" | "IN_ANTICIPO";

export type RouteTracking = {
  status: RouteTrackingStatus;
  nextCheckpointDays: number;
  nextCheckpointPct: number;
  deltaToNextCheckpointPct: number;
};

export const ACTIVE_ROUTE_KEY = "fn-active-strategic-route";
export const ACTIVE_ROUTE_EVENT = "fn:strategic-route-change";

const HORIZONS: readonly HorizonDays[] = [30, 90, 180, 360];

export type RouteStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** La rotta deve sopravvivere alla chiusura della scheda: è un impegno di mesi. */
function browserStorage(): RouteStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseBaselineNetwork(raw: unknown): ActiveStrategicRouteState["baselineNetwork"] {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as { committees?: unknown; members?: unknown; elected?: unknown };
  if (!finiteNumber(value.committees) || !finiteNumber(value.members) || !finiteNumber(value.elected)) return undefined;
  return { committees: value.committees, members: value.members, elected: value.elected };
}

function parseFrozenPlan(raw: unknown): StrategicBackcastResult | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as { currentPct?: unknown; checkpoints?: unknown; regions?: unknown; network?: unknown; themes?: unknown };
  if (!finiteNumber(value.currentPct) || !Array.isArray(value.checkpoints) || !Array.isArray(value.regions) || !Array.isArray(value.themes)) return undefined;
  const checkpointsOk = value.checkpoints.every((row) => {
    const point = row as Partial<Checkpoint> | null;
    return !!point && finiteNumber(point.day) && finiteNumber(point.expectedPct) && finiteNumber(point.minOnTrackPct) && finiteNumber(point.stretchPct);
  });
  const network = value.network as Record<string, unknown> | null;
  const networkOk =
    !!network &&
    ["deltaCommittees", "deltaMembers", "electedTarget", "monthlyCommitteeCap", "monthlyMemberCap", "monthlyElectedCap"].every((key) => finiteNumber(network[key]));
  if (!checkpointsOk || value.checkpoints.length === 0 || !networkOk) return undefined;
  return raw as StrategicBackcastResult;
}

export function parseActiveStrategicRoute(raw: unknown): ActiveStrategicRouteState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as {
    targetPct?: unknown;
    horizonDays?: unknown;
    activatedAt?: unknown;
    baselinePctAtActivation?: unknown;
  };
  const targetPct = typeof value.targetPct === "number" ? value.targetPct : Number.NaN;
  const baseline = typeof value.baselinePctAtActivation === "number" ? value.baselinePctAtActivation : Number.NaN;
  if (!Number.isFinite(targetPct) || targetPct < 0 || targetPct > 20) return null;
  if (!Number.isFinite(baseline)) return null;
  if (!HORIZONS.includes(value.horizonDays as HorizonDays)) return null;
  if (typeof value.activatedAt !== "string" || value.activatedAt.length < 8) return null;
  const extra = raw as { baselineNetwork?: unknown; frozenPlan?: unknown };
  const baselineNetwork = parseBaselineNetwork(extra.baselineNetwork);
  const frozenPlan = parseFrozenPlan(extra.frozenPlan);
  return {
    targetPct,
    horizonDays: value.horizonDays as HorizonDays,
    activatedAt: value.activatedAt,
    baselinePctAtActivation: baseline,
    ...(baselineNetwork ? { baselineNetwork } : {}),
    ...(frozenPlan ? { frozenPlan } : {}),
  };
}

export function readActiveStrategicRoute(storage: RouteStorage | null = browserStorage()): ActiveStrategicRouteState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVE_ROUTE_KEY);
    if (!raw) return null;
    return parseActiveStrategicRoute(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTIVE_ROUTE_EVENT));
}

export function writeActiveStrategicRoute(
  value: ActiveStrategicRouteState,
  storage: RouteStorage | null = browserStorage(),
): void {
  const parsed = parseActiveStrategicRoute(value);
  if (!parsed || !storage) return;
  storage.setItem(ACTIVE_ROUTE_KEY, JSON.stringify(parsed));
  emit();
}

export function eraseActiveStrategicRoute(storage: RouteStorage | null = browserStorage()): void {
  if (!storage) return;
  storage.removeItem(ACTIVE_ROUTE_KEY);
  emit();
}

export function getActiveStrategicRoute(): ActiveStrategicRouteState | null {
  return readActiveStrategicRoute();
}

export function setActiveStrategicRoute(value: ActiveStrategicRouteState): void {
  writeActiveStrategicRoute(value);
}

export function clearActiveStrategicRoute(): void {
  eraseActiveStrategicRoute();
}

/**
 * Verdetto istantaneo su un solo dato. Senza giorni trascorsi usa il primo checkpoint; con i giorni
 * trascorsi interpola il corridoio a oggi e punta al prossimo checkpoint. Per un giudizio che tiene
 * conto del rumore dei sondaggi usare `monitorRoute`.
 */
export function evaluateRouteTrackingStatus(
  currentMeasuredPct: number,
  backcastResult: Pick<StrategicBackcastResult, "checkpoints"> & Partial<Pick<StrategicBackcastResult, "currentPct">>,
  elapsedDays = 0,
): RouteTracking {
  const points = backcastResult.checkpoints;
  const first: Checkpoint = points.find((row) => row.day === 30) ??
    points[0] ?? {
      day: 30,
      minOnTrackPct: currentMeasuredPct,
      expectedPct: currentMeasuredPct,
      stretchPct: currentMeasuredPct,
      status: "IN_ROTTA",
    };
  let checkpoint: Checkpoint = first;
  let nextPoint: Checkpoint = first;
  if (elapsedDays > 0 && points.length > 0) {
    const start = backcastResult.currentPct ?? points[0]!.expectedPct;
    const next = points.find((row) => row.day >= elapsedDays) ?? points[points.length - 1]!;
    nextPoint = next;
    const prior = [...points].reverse().find((row) => row.day < next.day);
    const fromDay = prior?.day ?? 0;
    const w = next.day === fromDay ? 1 : Math.min(1, Math.max(0, (elapsedDays - fromDay) / (next.day - fromDay)));
    const lerp = (a: number, b: number) => a + (b - a) * w;
    checkpoint = {
      day: next.day,
      expectedPct: lerp(prior?.expectedPct ?? start, next.expectedPct),
      minOnTrackPct: lerp(prior?.minOnTrackPct ?? start, next.minOnTrackPct),
      stretchPct: lerp(prior?.stretchPct ?? start, next.stretchPct),
      status: "IN_ROTTA",
    };
  }
  const delta = currentMeasuredPct - checkpoint.expectedPct;
  const status: RouteTrackingStatus =
    currentMeasuredPct < checkpoint.minOnTrackPct
      ? "DA_ACCELERARE"
      : currentMeasuredPct > checkpoint.stretchPct
        ? "IN_ANTICIPO"
        : "IN_ROTTA";
  return {
    status,
    nextCheckpointDays: nextPoint.day,
    nextCheckpointPct: nextPoint.expectedPct,
    deltaToNextCheckpointPct: delta,
  };
}
