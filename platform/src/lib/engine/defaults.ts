import type { CalculateOverrides } from "./calculate";
import { hasNonZeroIstituzioniDelta } from "./mergeIstituzioniDelta";
import type { FnConfig } from "./types";

export const OFFICIAL_S = 0.072;

export const OFFICIAL_FLUSSI = { FdI: 0.31, Lega: 0.25, ast: 0.36 } as const;

export type FlussiIpsos = { FdI: number; Lega: number; ast: number };

export const FLUSSI_PRESETS: Record<string, FlussiIpsos> = {
  "Default Ipsos v3.2 (31% / 25% / 36%)": { ...OFFICIAL_FLUSSI },
  "Spinta Ex-Lega Nord (26% / 38% / 28%)": {
    FdI: 0.26,
    Lega: 0.38,
    ast: 0.28,
  },
  "Recupero Astensione (25% / 20% / 48%)": {
    FdI: 0.25,
    Lega: 0.2,
    ast: 0.48,
  },
};

export const OFFICIAL_PESI: FnConfig["pesi"] = {
  flussi: 0.35,
  pref: 0.25,
  isc: 0.25,
  ist: 0.15,
};

export const WEIGHT_PRESETS: Record<string, FnConfig["pesi"]> = {
  "Default v3.2 (35/25/25/15)": { ...OFFICIAL_PESI },
  "Pesi uguali (25/25/25/25)": {
    flussi: 0.25,
    pref: 0.25,
    isc: 0.25,
    ist: 0.25,
  },
  "Solo flussi": { flussi: 1, pref: 0, isc: 0, ist: 0 },
  "Solo iscritti": { flussi: 0, pref: 0, isc: 1, ist: 0 },
  "Senza istituzioni": { flussi: 0.4, pref: 0.3, isc: 0.3, ist: 0 },
};

const S_TOL = 1e-6;
const W_TOL = 1e-6;
const FL_TOL = 1e-4;

export function isOfficialFlussi(flussi: FlussiIpsos): boolean {
  return (
    Math.abs(flussi.FdI - OFFICIAL_FLUSSI.FdI) <= FL_TOL &&
    Math.abs(flussi.Lega - OFFICIAL_FLUSSI.Lega) <= FL_TOL &&
    Math.abs(flussi.ast - OFFICIAL_FLUSSI.ast) <= FL_TOL
  );
}

export function isOfficialParams(
  S: number,
  pesi: FnConfig["pesi"],
  flussi_ipsos?: FlussiIpsos,
  istituzioniDelta?: CalculateOverrides["istituzioniDelta"],
): boolean {
  if (Math.abs(S - OFFICIAL_S) > S_TOL) return false;
  if (
    Math.abs(pesi.flussi - OFFICIAL_PESI.flussi) > W_TOL ||
    Math.abs(pesi.pref - OFFICIAL_PESI.pref) > W_TOL ||
    Math.abs(pesi.isc - OFFICIAL_PESI.isc) > W_TOL ||
    Math.abs(pesi.ist - OFFICIAL_PESI.ist) > W_TOL
  ) {
    return false;
  }
  if (flussi_ipsos !== undefined && !isOfficialFlussi(flussi_ipsos)) {
    return false;
  }
  if (hasNonZeroIstituzioniDelta(istituzioniDelta)) return false;
  return true;
}
