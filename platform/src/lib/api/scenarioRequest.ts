import type { FnConfig } from "@/lib/engine/types";

export const S_MIN = 0.005;
export const S_MAX = 0.5;
export const NSIM_MAX = 25_000;

export function clampNSim(raw: unknown, defaultSim: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) {
    return Math.min(Math.max(0, defaultSim), NSIM_MAX);
  }
  return Math.min(Math.max(0, n), NSIM_MAX);
}

export function clampS(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const s = Number(raw);
  if (!Number.isFinite(s)) {
    throw new Error("S non valido");
  }
  if (s < S_MIN || s > S_MAX) {
    throw new Error(`S deve essere tra ${S_MIN * 100}% e ${S_MAX * 100}%`);
  }
  return s;
}

export function validateFlussiIpsos(flussi: {
  FdI: number;
  Lega: number;
  ast: number;
}): void {
  const { FdI, Lega, ast } = flussi;
  for (const v of [FdI, Lega, ast]) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error("flussi_ipsos non validi");
    }
  }
  if (FdI + Lega + ast > 1 + 1e-9) {
    throw new Error("flussi_ipsos: somma FdI+Lega+ast non può superare 1");
  }
}

export type ScenarioPostBody = {
  S?: number;
  pesi?: FnConfig["pesi"];
  nSim?: number;
  includePoll?: boolean;
  pollConfig?: Record<string, unknown>;
  flussi_ipsos?: { FdI: number; Lega: number; ast: number };
  istituzioniDelta?: Record<
    string,
    Partial<{ dep: number; creg: number; sind: number; com: number }>
  >;
};
