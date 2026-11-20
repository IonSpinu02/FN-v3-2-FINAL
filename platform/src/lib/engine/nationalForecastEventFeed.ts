import catalog from "../../../data/national_forecast_events.json";
import type { NationalForecastEvent } from "./nationalForecastEvents";

const SOURCE = "https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html";

export function parseEcbForecastCalendar(
  html: string,
  knownAt: string,
): NationalForecastEvent[] {
  const text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const out: NationalForecastEvent[] = [];
  const pattern = /(\d{2})\/(\d{2})\/(\d{4})([\s\S]*?)(?=\d{2}\/\d{2}\/\d{4}|$)/g;
  for (const m of text.matchAll(pattern)) {
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    const description = m[4];
    if (
      date < knownAt ||
      !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
      !/monetary policy meeting/i.test(description ?? "") ||
      /non.monetary|day\s*1/i.test(description ?? "") ||
      !/press conference|day\s*2/i.test(description ?? "")
    ) {
      continue;
    }
    out.push({
      id: `ecb-${date}`,
      title: "BCE: decisioni di politica monetaria e conferenza stampa",
      date,
      knownAt,
      category: "monetary-policy",
      status: "scheduled",
      sourceUrl: SOURCE,
      sourceLabel: "Calendario ufficiale BCE",
    });
  }
  return [...new Map(out.map((e) => [e.id, e])).values()];
}

export type NationalForecastEventLoadResult = {
  events: NationalForecastEvent[];
  source: "official-calendar" | "local-catalog";
  /** True quando il catalogo locale sostituisce il feed ufficiale. */
  usedFallback: boolean;
  errorMessage: string | null;
  checkedAt: string;
};

export async function loadNationalForecastEvents(
  asOf = new Date(),
): Promise<NationalForecastEventLoadResult> {
  const knownAt = asOf.toISOString().slice(0, 10);
  const checkedAt = new Date().toISOString();
  const seed = catalog.events as NationalForecastEvent[];
  try {
    const response = await fetch(SOURCE, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error(`Calendar unavailable HTTP ${response.status}`);
    const live = parseEcbForecastCalendar(await response.text(), knownAt);
    if (!live.length) throw new Error("Calendar format not recognized");
    const merged = new Map(seed.map((e) => [e.id, e]));
    for (const event of live) {
      const previous = merged.get(event.id);
      merged.set(
        event.id,
        previous
          ? { ...event, knownAt: previous.knownAt, status: previous.status }
          : event,
      );
    }
    return {
      events: [...merged.values()],
      source: "official-calendar",
      usedFallback: false,
      errorMessage: null,
      checkedAt,
    };
  } catch (err) {
    return {
      events: seed,
      source: "local-catalog",
      usedFallback: true,
      errorMessage: err instanceof Error ? err.message : "Calendar fetch failed",
      checkedAt,
    };
  }
}
