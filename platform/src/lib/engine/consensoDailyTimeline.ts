import { normalizeToUtcNoon } from "./fnNationalAggregate";
import {
  buildLiveConsensoPayload,
  type LiveConsensoMode,
} from "./liveConsensoService";
import type { FnSupermediaPollPoint } from "@/lib/fnSupermediaConsensoSeries";
import type { PollRelease } from "./pollTypes";
import type { ConsensoMethodId } from "./pollTypes";

export type DailyConsensoPoint = {
  isoDate: string;
  sPct: number;
  s: number;
  method: ConsensoMethodId;
};

export type DailyTimelineOptions = {
  mode?: LiveConsensoMode;
  /** Ultimo giorno incluso (default oggi UTC). */
  asOf?: Date;
  /** Quanti giorni indietro (default 90). */
  days?: number;
  pollReleases: PollRelease[];
  supermediaSeries: FnSupermediaPollPoint[];
};

function addUtcDays(d: Date, delta: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + delta);
  return next;
}

function isoDay(d: Date): string {
  return normalizeToUtcNoon(d).toISOString().slice(0, 10);
}

/**
 * Serie giorno-per-giorno: stessa logica `auto|aggregate|supermedia`, con `asOf` a mezzogiorno UTC.
 * Anche senza nuovi sondaggi, l'aggregato FN cambia per il decadimento recency.
 */
export function buildConsensoDailyTimeline(
  options: DailyTimelineOptions,
): DailyConsensoPoint[] {
  const mode = options.mode ?? "auto";
  const end = normalizeToUtcNoon(options.asOf ?? new Date());
  const span = Math.max(1, Math.min(366, options.days ?? 90));
  const start = addUtcDays(end, -(span - 1));

  const out: DailyConsensoPoint[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addUtcDays(cursor, 1)) {
    const payload = buildLiveConsensoPayload(mode, {
      asOf: cursor,
      pollReleases: options.pollReleases,
      supermediaSeries: options.supermediaSeries,
    });
    out.push({
      isoDate: isoDay(cursor),
      sPct: payload.sPct,
      s: payload.s,
      method: payload.method,
    });
  }
  return out;
}
