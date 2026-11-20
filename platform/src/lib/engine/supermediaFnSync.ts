import {
  FN_SUPERMEDIA_CONSENSO_SERIES,
  type FnSupermediaPollPoint,
} from "@/lib/fnSupermediaConsensoSeries";
import { OFFICIAL_S_SOURCE_LABEL, OFFICIAL_S_SOURCE_URL } from "./defaults";

export type SupermediaFnSnapshot = {
  pct: number;
  s: number;
  isoDate: string;
  caption: string;
  sourceLabel: string;
  sourceUrl: string;
  articleUrl?: string;
  why?: string;
  deltaPp?: number;
  previousPct?: number;
  previousIsoDate?: string;
};

export function latestSupermediaFnPointFromSeries(
  series: FnSupermediaPollPoint[],
  asOf?: Date,
): SupermediaFnSnapshot | null {
  if (!series.length) return null;
  const refDay = asOf
    ? asOf.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  let last: FnSupermediaPollPoint | undefined;
  let previous: FnSupermediaPollPoint | undefined;
  for (const p of series) {
    if (p.isoDate <= refDay) {
      previous = last;
      last = p;
    } else break;
  }
  if (!last) return null;
  return {
    pct: last.pct,
    s: last.pct / 100,
    isoDate: last.isoDate,
    caption: last.caption,
    sourceLabel: OFFICIAL_S_SOURCE_LABEL,
    sourceUrl: last.articleUrl ?? OFFICIAL_S_SOURCE_URL,
    articleUrl: last.articleUrl,
    why: last.why,
    deltaPp: last.deltaPp,
    previousPct: previous?.pct,
    previousIsoDate: previous?.isoDate,
  };
}

/** Ultimo punto FN nella serie Supermedia curata (statica). */
export function latestSupermediaFnPoint(): SupermediaFnSnapshot | null {
  return latestSupermediaFnPointFromSeries(FN_SUPERMEDIA_CONSENSO_SERIES);
}

/** Serie completa per grafici e audit. */
export function supermediaFnHistory(): FnSupermediaPollPoint[] {
  return [...FN_SUPERMEDIA_CONSENSO_SERIES];
}
