import type { CalculateOverrides } from "./calculate";
import { hasNonZeroIstituzioniDelta } from "./mergeIstituzioniDelta";
import type { FnConfig } from "./types";
import {
  OFFICIAL_FLUSSI,
  FLUSSI_PRESETS,
  isOfficialFlussi,
  type FlussiIpsos,
} from "@/lib/politicalModel";

/**
 * Baseline storica di laboratorio (golden). In UI Scenario, con live attivo, non
 * va renderizzata finché `/api/consenso/live` non risolve (evita flash 7,20%).
 */
export const OFFICIAL_S = 0.072;

/** Fonte input consenso nazionale (baseline piattaforma; live override via API). */
export const OFFICIAL_S_SOURCE_LABEL = "Supermedia YouTrend/AGI";
export const OFFICIAL_S_SOURCE_URL = "https://www.youtrend.it/la-supermedia/";

export { OFFICIAL_FLUSSI, FLUSSI_PRESETS, isOfficialFlussi, type FlussiIpsos };

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
