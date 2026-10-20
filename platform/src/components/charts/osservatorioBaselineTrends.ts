import type { Region } from "@/lib/engine/constants";
import type { GoogleTrendsSeries, OsservatorioEvento } from "@/lib/engine/osservatorioTypes";
import { parseEventDate } from "@/lib/engine/eventStudyProtocol";

function hashRegion(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function dayIndexFromStart(start: Date, d: Date): number {
  const dayMs = 86400000;
  return Math.round((d.getTime() - start.getTime()) / dayMs);
}

/** Impulso attenzione: picco al giorno evento, decadimento esponenziale su `decayDays`. */
function eventImpulse(
  dayIdx: number,
  eventDayIdx: number,
  peakBoost: number,
  decayDays = 4,
): number {
  const after = dayIdx - eventDayIdx;
  if (after < 0) return 0;
  if (after === 0) return peakBoost;
  if (after > decayDays) return 0;
  return peakBoost * Math.exp(-after / (decayDays / 2.2));
}

const DEFAULT_EVENT_SPECS = [
  { date: "2026-09-26", peak: 78 },
  { date: "2026-10-09", peak: 87 },
] as const;

/** Baseline 30gg (2026-09-18 → 2026-10-18) con livello organico e picchi evento. */
export function buildRegionalBaselineTrends(
  region: Region,
  events: OsservatorioEvento[],
): GoogleTrendsSeries {
  const seed = hashRegion(region);
  const start = new Date("2026-09-18T12:00:00Z");
  const points: { date: string; value: number }[] = [];

  const regionEvents = events.filter((e) => !e.regione || e.regione === region);
  const eventSpecs = regionEvents.slice(0, 2).map((ev, idx) => {
    const d = parseEventDate(ev.data);
    const fallback = DEFAULT_EVENT_SPECS[idx];
    return {
      dayIdx: d
        ? dayIndexFromStart(start, d)
        : dayIndexFromStart(start, parseEventDate(fallback.date)!),
      peak: fallback?.peak ?? 75 + idx * 8,
    };
  });
  if (!eventSpecs.length) {
    for (const fb of DEFAULT_EVENT_SPECS) {
      eventSpecs.push({
        dayIdx: dayIndexFromStart(start, parseEventDate(fb.date)!),
        peak: fb.peak,
      });
    }
  }

  const baseLevel = 42 + (seed % 13);

  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    let organic =
      baseLevel +
      Math.sin(i * 0.38 + seed * 0.01) * 4.5 +
      Math.cos(i * 0.21) * 3.2 +
      ((seed + i * 7) % 5) * 0.4;

    let impulse = 0;
    for (const spec of eventSpecs) {
      const targetPeak = spec.peak;
      const boost = Math.max(0, targetPeak - organic);
      impulse += eventImpulse(i, spec.dayIdx, boost, 4);
    }

    let value = organic + impulse;
    value = Math.max(0, Math.min(100, Math.round(value * 10) / 10));
    points.push({ date: dateStr, value });
  }

  return {
    id: `baseline-trends-${region}`,
    query: `Futuro Nazionale · ${region}`,
    queryType: "term",
    territory: region,
    windowStart: "2026-09-18",
    windowEnd: "2026-10-18",
    extractedAt: new Date().toISOString(),
    isDemo: true,
    points,
  };
}
