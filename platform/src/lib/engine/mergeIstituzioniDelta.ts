import type { CalculateOverrides, InstitutionalRow } from "./calculate";
import { REGIONS, type Region } from "./constants";

type Delta = CalculateOverrides["istituzioniDelta"];

const KEYS: (keyof InstitutionalRow)[] = ["dep", "creg", "sind", "com"];

export function mergeIstituzioniDeltas(...parts: (Delta | undefined)[]): Delta {
  const out: NonNullable<Delta> = {};
  for (const d of parts) {
    if (!d) continue;
    for (const [regionKey, row] of Object.entries(d)) {
      if (!row) continue;
      if (!REGIONS.includes(regionKey as Region)) continue;
      const region = regionKey as Region;
      if (!out[region]) out[region] = {};
      for (const k of KEYS) {
        const v = row[k];
        if (typeof v === "number" && v !== 0) {
          out[region][k] = (out[region][k] ?? 0) + v;
        }
      }
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function hasNonZeroIstituzioniDelta(delta: Delta | undefined): boolean {
  if (!delta) return false;
  for (const row of Object.values(delta)) {
    if (!row) continue;
    for (const k of KEYS) {
      const v = row[k];
      if (typeof v === "number" && Math.abs(v) > 1e-9) return true;
    }
  }
  return false;
}
