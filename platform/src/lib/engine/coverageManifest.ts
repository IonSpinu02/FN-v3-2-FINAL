/**
 * Dichiarazione esplicita del perimetro informativo considerato in un'elaborazione.
 */
export type SourceCoverageRow = {
  sourceKey: string;
  label: string;
  lastCheckedAt: string | null;
  lastNewItemAt: string | null;
  lastRecalcAt: string | null;
  methodVersion: string | null;
  usedFallback: boolean;
  fallbackLabel?: string | null;
  itemsFetched: number;
  itemsAccepted: number;
  itemsRejected: number;
  status: "live" | "fallback" | "stale" | "missing" | "ok";
};

export type CoverageManifest = {
  generatedAt: string;
  news: {
    considered: number;
    detected: number;
    excluded: number;
    windowStart: string | null;
    windowEnd: string | null;
    note: string;
  };
  calendar: {
    source: "official-calendar" | "local-catalog";
    usedFallback: boolean;
    note: string;
  };
  sources: SourceCoverageRow[];
  storage: "postgres" | "file";
};

export function buildNewsCoverageNote(opts: {
  considered: number;
  detected: number;
  excluded: number;
  windowStart?: string | null;
  windowEnd?: string | null;
}): string {
  const win =
    opts.windowStart && opts.windowEnd
      ? ` nella finestra [${opts.windowStart} – ${opts.windowEnd}]`
      : "";
  return `Considerati ${opts.considered} titoli su ${opts.detected} rilevati${win}; ${opts.excluded} esclusi per fuori-tema, duplicazione o supervisione umana.`;
}

export function buildCalendarCoverageNote(
  source: "official-calendar" | "local-catalog",
): string {
  if (source === "official-calendar") {
    return "Calendario BCE acquisito dal feed ufficiale live.";
  }
  return "Calendario BCE non disponibile o formato non riconosciuto: in uso il catalogo locale di ripiego (non acquisizione live).";
}

export function buildCoverageManifest(input: {
  newsConsidered: number;
  newsDetected: number;
  newsExcluded: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  calendarSource: "official-calendar" | "local-catalog";
  sources: SourceCoverageRow[];
  storage: "postgres" | "file";
}): CoverageManifest {
  return {
    generatedAt: new Date().toISOString(),
    news: {
      considered: input.newsConsidered,
      detected: input.newsDetected,
      excluded: input.newsExcluded,
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null,
      note: buildNewsCoverageNote({
        considered: input.newsConsidered,
        detected: input.newsDetected,
        excluded: input.newsExcluded,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      }),
    },
    calendar: {
      source: input.calendarSource,
      usedFallback: input.calendarSource === "local-catalog",
      note: buildCalendarCoverageNote(input.calendarSource),
    },
    sources: input.sources,
    storage: input.storage,
  };
}
