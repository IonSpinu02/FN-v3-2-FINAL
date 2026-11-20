import type { PollRelease } from "./pollTypes";

/**
 * Stima FN giornaliera (FN_DAILY_V2).
 *
 * Ogni giorno, su tutti i sondaggi nazionali con fine-campo negli ultimi 14 giorni:
 * - un solo sondaggio per istituto (l'ultimo): le repliche dello stesso istituto
 *   non sono campioni indipendenti;
 * - peso = freschezza × radice del campione.
 *   Freschezza: il peso si dimezza ogni 7 giorni (2^(−giorni/7)).
 *   Campione: √n, perché la precisione di un sondaggio cresce con la radice
 *   degli intervistati. Se n non è pubblicato, si usa la mediana degli n noti
 *   nella stessa finestra (nessuno sconto inventato).
 * - il numero pubblicato è calcolato sui pesi arrotondati a 3 decimali,
 *   così il foglio che mostriamo rifà il risultato al centesimo.
 *
 * Non usiamo un coefficiente segreto per istituto né uno sconto per il metodo
 * (telefono/online): quel metodo non è dichiarato allo stesso modo da tutti,
 * e penalizzarlo solo quando manca sarebbe un bias, non una correzione.
 */
export const AGGREGATE_FORMULA_ID = "FN_DAILY_V2" as const;

/** Finestra mobile, ricalcolata ogni giorno (non congelata al giovedì). */
export const AGGREGATE_WINDOW_DAYS = 14;

/** Il peso di un sondaggio si dimezza dopo questi giorni. */
export const RECENCY_HALF_LIFE_DAYS = 7;

export type AggregateOptions = {
  /** Data di riferimento (default: oggi UTC). */
  asOf?: Date;
  windowDays?: number;
};

export type AggregatePollRow = {
  institute: string;
  fieldEnd: string;
  fnPct: number;
  /** Peso usato nel conto (3 decimali). La media è fatta su questi numeri. */
  weight: number;
  /** Quota del peso sul totale, in percentuale. */
  sharePct: number;
  ageDays: number;
  sampleSizeUsed: number | null;
  sampleImputed: boolean;
  sourceUrl?: string;
};

export type AggregateResult = {
  fnPct: number;
  s: number;
  formulaId: typeof AGGREGATE_FORMULA_ID;
  /** Frase unica: come si rifà il numero. */
  formula: string;
  pollsUsed: AggregatePollRow[];
  confidenceBandPp: [number, number];
  windowDays: number;
};

/**
 * Converte stringhe ISO / timestamp / Date in una `Date` valida.
 * Dopo `JSON.stringify`/`req.json()` i campi data arrivano spesso come stringhe:
 * senza questa guardia `getUTCFullYear` crasha a runtime.
 */
export function toValidDate(
  value: Date | string | number | null | undefined,
  fallback: Date = new Date(),
): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const fromNum = new Date(value);
    if (!Number.isNaN(fromNum.getTime())) return fromNum;
  }
  if (typeof value === "string" && value.trim()) {
    const raw = value.trim();
    const fromIsoDay = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? new Date(`${raw}T12:00:00.000Z`)
      : new Date(raw);
    if (!Number.isNaN(fromIsoDay.getTime())) return fromIsoDay;
  }
  if (fallback instanceof Date && !Number.isNaN(fallback.getTime())) return fallback;
  return new Date();
}

/** Giorno UTC ancorato a mezzogiorno (confronti coerenti indipendentemente dall'ora di `asOf`). */
export function normalizeToUtcNoon(
  d: Date | string | number | null | undefined,
): Date {
  const valid = toValidDate(d);
  return new Date(
    Date.UTC(valid.getUTCFullYear(), valid.getUTCMonth(), valid.getUTCDate(), 12, 0, 0, 0),
  );
}

function parseIsoDay(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function daysBetween(older: Date, newer: Date): number {
  return (newer.getTime() - older.getTime()) / (86400 * 1000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Un solo sondaggio per istituto: il più recente per fieldEnd. */
export function dedupeLatestPerInstitute(
  releases: PollRelease[],
): PollRelease[] {
  const byInst = new Map<string, PollRelease>();
  for (const r of releases) {
    const key = r.institute.trim().toLowerCase();
    const prev = byInst.get(key);
    if (!prev || r.fieldEnd >= prev.fieldEnd) byInst.set(key, r);
  }
  return [...byInst.values()];
}

export function filterReleasesInWindow(
  releases: PollRelease[],
  asOf: Date,
  windowDays: number,
): PollRelease[] {
  const ref = normalizeToUtcNoon(asOf);
  const cutoff = new Date(ref);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return releases.filter((r) => {
    const end = parseIsoDay(r.fieldEnd);
    const published = parseIsoDay(r.publishedAt ?? r.fieldEnd);
    return end >= cutoff && end <= ref && published <= ref;
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Freschezza: 1 oggi, 1/2 dopo 7 giorni, 1/4 dopo 14. */
export function recencyWeight(ageDays: number): number {
  return 2 ** (-Math.max(0, ageDays) / RECENCY_HALF_LIFE_DAYS);
}

/**
 * Stima FN giornaliera. Il risultato è il quoziente dei pesi pubblicati.
 */
export function computeFnNationalAggregate(
  releases: PollRelease[],
  options: AggregateOptions = {},
): AggregateResult | null {
  const rawAsOf = options.asOf ?? new Date();
  const ref = normalizeToUtcNoon(rawAsOf);
  const windowDays = options.windowDays ?? AGGREGATE_WINDOW_DAYS;

  const inWindow = filterReleasesInWindow(releases, ref, windowDays);
  const deduped = dedupeLatestPerInstitute(inWindow);
  if (deduped.length === 0) return null;

  const knownN = deduped
    .map((r) => r.sampleSize)
    .filter((n): n is number => n != null && n > 0);
  const imputedN = median(knownN);

  const rows = deduped.map((r) => {
    const ageDays = Math.max(0, daysBetween(parseIsoDay(r.fieldEnd), ref));
    const hasN = r.sampleSize != null && r.sampleSize > 0;
    const sampleSizeUsed = hasN ? r.sampleSize! : imputedN;
    const sampleFactor = sampleSizeUsed == null ? 1 : Math.sqrt(sampleSizeUsed);
    const raw = recencyWeight(ageDays) * sampleFactor;
    return {
      r,
      ageDays,
      sampleSizeUsed,
      sampleImputed: !hasN && sampleSizeUsed != null,
      raw,
    };
  });

  const weighted = rows.map((row) => ({
    ...row,
    weight: Math.round(row.raw * 1000) / 1000,
  }));
  const sumW = weighted.reduce((s, row) => s + row.weight, 0);
  if (sumW <= 0) return null;

  const sumWx = weighted.reduce((s, row) => s + row.weight * row.r.fnPct, 0);
  const weightedMean = sumWx / sumW;
  const fnPct = Math.round(weightedMean * 100) / 100;

  let variance = 0.25;
  if (weighted.length > 1) {
    let sumWResiduals = 0;
    for (const row of weighted) {
      sumWResiduals += row.weight * (row.r.fnPct - weightedMean) ** 2;
    }
    variance = sumWResiduals / sumW;
  }
  const halfBand = Math.max(0.15, Math.min(1.2, Math.sqrt(variance) * 0.8));

  const pollsUsed: AggregatePollRow[] = weighted
    .map((row) => ({
      institute: row.r.institute,
      fieldEnd: row.r.fieldEnd,
      fnPct: row.r.fnPct,
      weight: row.weight,
      sharePct: Math.round((row.weight / sumW) * 1000) / 10,
      ageDays: Math.round(row.ageDays),
      sampleSizeUsed: row.sampleSizeUsed,
      sampleImputed: row.sampleImputed,
      sourceUrl: row.r.sourceUrl,
    }))
    .sort((a, b) => b.weight - a.weight);

  const sheet = pollsUsed
    .map((p) => `${p.fnPct}×${p.weight}`)
    .join(" + ");
  const formula = `${fnPct}% = (${sheet}) / ${Math.round(sumW * 1000) / 1000}`;

  return {
    fnPct,
    s: fnPct / 100,
    formulaId: AGGREGATE_FORMULA_ID,
    formula,
    pollsUsed,
    confidenceBandPp: [round1(fnPct - halfBand), round1(fnPct + halfBand)],
    windowDays,
  };
}
