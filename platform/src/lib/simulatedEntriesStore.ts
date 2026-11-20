import { useSyncExternalStore } from "react";
import { REGIONS, type Region } from "@/lib/engine/constants";
import type { SimulatedEntryProfile } from "@/lib/engine/forecastEngineV4";

/**
 * Profili attivati con «+ Simula» nella Rassegna stampa, condivisi con la previsione di crescita.
 * Persistiti in localStorage: restano attivi cambiando pagina.
 */
const STORAGE_KEY = "fn.simulatedEntries.v1";
const CHANGE_EVENT = "fn:simulated-entries";
const EMPTY: SimulatedEntryProfile[] = [];

let cacheRaw: string | null = null;
let cacheValue: SimulatedEntryProfile[] = EMPTY;

function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

function parse(raw: string | null): SimulatedEntryProfile[] {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return EMPTY;
    return data.filter(
      (p): p is SimulatedEntryProfile =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as SimulatedEntryProfile).id === "string" &&
        typeof (p as SimulatedEntryProfile).nome === "string" &&
        isRegion((p as SimulatedEntryProfile).regione) &&
        Number.isFinite((p as SimulatedEntryProfile).votiPortati),
    );
  } catch {
    return EMPTY;
  }
}

export function readSimulatedEntries(): SimulatedEntryProfile[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  cacheValue = parse(raw);
  return cacheValue;
}

export function writeSimulatedEntries(list: SimulatedEntryProfile[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function toggleSimulatedEntry(profile: SimulatedEntryProfile): void {
  const current = readSimulatedEntries();
  const exists = current.some((p) => p.id === profile.id);
  writeSimulatedEntries(
    exists ? current.filter((p) => p.id !== profile.id) : [...current, profile],
  );
}

export function clearSimulatedEntries(): void {
  writeSimulatedEntries([]);
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useSimulatedEntries(): SimulatedEntryProfile[] {
  return useSyncExternalStore(subscribe, readSimulatedEntries, () => EMPTY);
}
