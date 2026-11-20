import {
  FN_SUPERMEDIA_CONSENSO_SERIES,
  type FnSupermediaPollPoint,
} from "@/lib/fnSupermediaConsensoSeries";

/** Unisce serie curata + punti da RSS (stessa data: preferisce ingest se pct diversa o caption più recente). */
export function mergeSupermediaSeries(
  curated: FnSupermediaPollPoint[],
  ingested: FnSupermediaPollPoint[],
): FnSupermediaPollPoint[] {
  const byDate = new Map<string, FnSupermediaPollPoint>();
  for (const p of curated) byDate.set(p.isoDate, p);
  for (const p of ingested) {
    const prev = byDate.get(p.isoDate);
    if (!prev) {
      byDate.set(p.isoDate, p);
      continue;
    }
    if (Math.abs(prev.pct - p.pct) > 0.05 || p.caption.includes("Supermedia")) {
      byDate.set(p.isoDate, p);
    }
  }
  return [...byDate.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

export function defaultMergedSupermediaSeries(
  ingested: FnSupermediaPollPoint[] = [],
): FnSupermediaPollPoint[] {
  return mergeSupermediaSeries(FN_SUPERMEDIA_CONSENSO_SERIES, ingested);
}
