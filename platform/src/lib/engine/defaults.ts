import type { FnConfig } from "./types";

export const OFFICIAL_S = 0.072;

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
): boolean {
  if (Math.abs(S - OFFICIAL_S) > S_TOL) return false;
  return (
    Math.abs(pesi.flussi - OFFICIAL_PESI.flussi) <= W_TOL &&
    Math.abs(pesi.pref - OFFICIAL_PESI.pref) <= W_TOL &&
    Math.abs(pesi.isc - OFFICIAL_PESI.isc) <= W_TOL &&
    Math.abs(pesi.ist - OFFICIAL_PESI.ist) <= W_TOL
  );
}
