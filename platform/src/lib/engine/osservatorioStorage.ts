import type { OsservatorioCloudPayload } from "./osservatorioTypes";

const STATE_KEY = "fn_v32_osservatorio_cloud";

export function loadOsservatorioLocal(): OsservatorioCloudPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OsservatorioCloudPayload;
  } catch {
    return null;
  }
}

export function saveOsservatorioLocal(payload: OsservatorioCloudPayload): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(payload));
}

/** @deprecated use loadOsservatorioLocal */
export function loadOsservatorioEventsLocal() {
  return loadOsservatorioLocal()?.events ?? [];
}

/** @deprecated use saveOsservatorioLocal */
export function saveOsservatorioEventsLocal(
  events: OsservatorioCloudPayload["events"],
) {
  const prev = loadOsservatorioLocal() ?? {
    events: [],
    trendsSeries: [],
    prioritaDichiarate: {},
    monthlyNotes: {},
  };
  saveOsservatorioLocal({ ...prev, events });
}
