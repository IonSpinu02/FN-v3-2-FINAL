import type { ConsensoObservation, ConsensoSource, NetworkObservation, RouteLedger } from "@/lib/engine/routeMonitoringEngine";

export const ROUTE_LEDGER_KEY = "fn-route-ledger-v1";
export const ROUTE_LEDGER_EVENT = "fn:route-ledger-change";

export type LedgerStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type StoredLedger = RouteLedger & { routeId: string };

const SOURCES: readonly ConsensoSource[] = ["sondaggio", "supermedia", "interno"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function browserStorage(): LedgerStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && DATE.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

export function emptyLedger(): RouteLedger {
  return { consenso: [], rete: [] };
}

export function parseLedger(raw: unknown, routeId: string): RouteLedger {
  if (!raw || typeof raw !== "object") return emptyLedger();
  const value = raw as Partial<StoredLedger>;
  if (value.routeId !== routeId) return emptyLedger();
  const consenso = (Array.isArray(value.consenso) ? value.consenso : []).filter(
    (row): row is ConsensoObservation =>
      !!row &&
      typeof row.id === "string" &&
      validDate(row.date) &&
      finite(row.pct) &&
      row.pct > 0 &&
      row.pct < 60 &&
      SOURCES.includes(row.source) &&
      (row.n === undefined || (finite(row.n) && row.n > 0)),
  );
  const rete = (Array.isArray(value.rete) ? value.rete : []).filter(
    (row): row is NetworkObservation =>
      !!row &&
      typeof row.id === "string" &&
      validDate(row.date) &&
      finite(row.committees) &&
      finite(row.members) &&
      finite(row.elected) &&
      row.committees >= 0 &&
      row.members >= 0 &&
      row.elected >= 0,
  );
  return { consenso, rete };
}

export function readLedger(routeId: string, storage: LedgerStorage | null = browserStorage()): RouteLedger {
  if (!storage) return emptyLedger();
  try {
    const raw = storage.getItem(ROUTE_LEDGER_KEY);
    return raw ? parseLedger(JSON.parse(raw) as unknown, routeId) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ROUTE_LEDGER_EVENT));
}

export function writeLedger(routeId: string, ledger: RouteLedger, storage: LedgerStorage | null = browserStorage()): void {
  if (!storage) return;
  const clean = parseLedger({ ...ledger, routeId }, routeId);
  storage.setItem(ROUTE_LEDGER_KEY, JSON.stringify({ routeId, ...clean }));
  emit();
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addConsensoObservation(
  routeId: string,
  entry: Omit<ConsensoObservation, "id">,
  storage: LedgerStorage | null = browserStorage(),
): RouteLedger {
  const ledger = readLedger(routeId, storage);
  const next: RouteLedger = { ...ledger, consenso: [...ledger.consenso, { ...entry, id: newId() }] };
  writeLedger(routeId, next, storage);
  return readLedger(routeId, storage);
}

export function addNetworkObservation(
  routeId: string,
  entry: Omit<NetworkObservation, "id">,
  storage: LedgerStorage | null = browserStorage(),
): RouteLedger {
  const ledger = readLedger(routeId, storage);
  const next: RouteLedger = { ...ledger, rete: [...ledger.rete, { ...entry, id: newId() }] };
  writeLedger(routeId, next, storage);
  return readLedger(routeId, storage);
}

export function removeObservation(routeId: string, id: string, storage: LedgerStorage | null = browserStorage()): RouteLedger {
  const ledger = readLedger(routeId, storage);
  writeLedger(
    routeId,
    { consenso: ledger.consenso.filter((row) => row.id !== id), rete: ledger.rete.filter((row) => row.id !== id) },
    storage,
  );
  return readLedger(routeId, storage);
}
