import { REGIONS, type Region, type RegionMap } from "./constants";

export function norm(x: RegionMap): RegionMap {
  const z = REGIONS.reduce((s, r) => s + x[r], 0);
  if (z <= 0) throw new Error("Distribuzione nulla");
  const out = {} as RegionMap;
  for (const r of REGIONS) out[r] = x[r] / z;
  return out;
}

export function entropyH(x: RegionMap): number {
  const n = REGIONS.length;
  const logN = Math.log(n);
  let h = 0;
  for (const r of REGIONS) {
    const v = x[r];
    if (v > 0) h -= v * Math.log(v);
  }
  return h / logN;
}

export function kl(x: RegionMap, y: RegionMap): number {
  let s = 0;
  for (const r of REGIONS) {
    if (x[r] > 0) s += x[r] * Math.log(x[r] / y[r]);
  }
  return s;
}

export function js(x: RegionMap, y: RegionMap): number {
  const m = {} as RegionMap;
  for (const r of REGIONS) m[r] = (x[r] + y[r]) / 2;
  return (kl(x, m) + kl(y, m)) / 2;
}

export function corr(a: RegionMap, b: RegionMap): number | null {
  const xa = REGIONS.map((r) => a[r]);
  const xb = REGIONS.map((r) => b[r]);
  const m = xa.reduce((s, v) => s + v, 0) / 20;
  const n = xb.reduce((s, v) => s + v, 0) / 20;
  let u = 0;
  let v = 0;
  let w = 0;
  for (let i = 0; i < 20; i++) {
    u += (xa[i] - m) * (xb[i] - n);
    v += (xa[i] - m) ** 2;
    w += (xb[i] - n) ** 2;
  }
  return v * w ? u / Math.sqrt(v * w) : null;
}

export function quantile(xs: number[], p: number): number {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.round(p * (a.length - 1))];
}

export function mapFromRecord(
  record: Record<string, number>,
): RegionMap {
  const out = {} as RegionMap;
  for (const r of REGIONS) {
    if (!(r in record)) throw new Error(`Regione mancante: ${r}`);
    out[r] = record[r];
  }
  return out;
}
