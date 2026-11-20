import { peekTavilyDaily } from "@/lib/cache/tavilyDailyGate";
import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import { decodeRssPlainText, fetchFeedXml, parseRssItems } from "@/lib/engine/newsIngest";
import type { TavilyRssLikeItem } from "@/lib/engine/tavilyClient";
import {
  TAVILY_DEFECTION_INCLUDE_DOMAINS,
  TAVILY_DEFECTION_NEWS_QUERY,
} from "@/lib/engine/tavilyInstitutionalQueries";
import { fetchTavilyNewsDaily } from "@/lib/engine/tavilyNewsFetch";
import {
  beneficioFnFromPolitician,
  canMarkRumorFnFromNews,
  isDefectionNewsRelevant,
  matchPoliticianFromText,
  newsStatoFromPolitician,
  type DefectionNewsItem,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";
import {
  catalogSeedsForNewsFeed,
  INITIAL_TRACKED_POLITICIANS,
} from "@/lib/politicalDefectionsCatalog";

/** Chiave del gate giornaliero Tavily per il radar dei cambi di partito. */
/** Bump versione: invalida cache Tavily/Postgres/file pre-fix destinazione FN. */
export const DEFECTIONS_TAVILY_SCOPE_KEY = "party-switches-radar-v2";

const FETCH_TIMEOUT_MS = 12_000;
/** Google News RSS è gratuito: resta live con un refresh ogni 15 minuti. */
const RSS_CACHE_MS = 15 * 60 * 1000;
const RSS_CACHE_VERSION = "v2-fn-explicit-only";

let rssCache: { at: number; rows: RawNewsRow[]; version: string } | null = null;

const DEFECTION_QUERY = [
  '("lascia la Lega" OR "lascia Fratelli d\'Italia" OR "lascia Forza Italia"',
  'OR "passa al Gruppo Misto" OR "passa con Vannacci" OR "aderisce a Futuro Nazionale")',
  "when:30d",
].join(" ");

function googleNewsSearchUrl(query: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=it&gl=IT&ceid=IT:it`;
}

export function extractFonte(link: string, fallback: string): string {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    if (host === "news.google.com") return fallback;
    const map: Record<string, string> = {
      "corriere.it": "Corriere",
      "repubblica.it": "La Repubblica",
      "ansa.it": "ANSA",
      "ilgazzettino.it": "Il Gazzettino",
      "lastampa.it": "La Stampa",
      "milanotoday.it": "MilanoToday",
      "romatoday.it": "RomaToday",
      "iltempo.it": "Il Tempo",
      "laverita.info": "La Verità",
    };
    for (const [k, v] of Object.entries(map)) {
      if (host.includes(k)) return v;
    }
    return host.split(".")[0]?.toUpperCase() ?? fallback;
  } catch {
    return fallback;
  }
}

export type RawNewsRow = {
  titolo: string;
  link: string;
  pubDate: string | null;
  snippet: string;
  feedUrl: string;
  fonteFallback: string;
};

async function fetchGoogleNewsRows(query: string, maxItems: number): Promise<RawNewsRow[]> {
  const url = googleNewsSearchUrl(query);
  const xml = await fetchFeedXml(url, FETCH_TIMEOUT_MS);
  return parseRssItems(xml, url, maxItems).map((item) => ({
    titolo: item.titolo,
    link: item.link,
    pubDate: item.pubDate,
    snippet: item.snippet,
    feedUrl: item.feedUrl,
    fonteFallback: "Google News",
  }));
}

async function fetchRadarRssRows(): Promise<{ rows: RawNewsRow[]; fromCache: boolean }> {
  const now = Date.now();
  if (
    rssCache &&
    rssCache.version === RSS_CACHE_VERSION &&
    now - rssCache.at < RSS_CACHE_MS
  ) {
    return { rows: rssCache.rows, fromCache: true };
  }
  try {
    const rows = await fetchGoogleNewsRows(DEFECTION_QUERY, 40);
    rssCache = { at: now, rows, version: RSS_CACHE_VERSION };
    return { rows, fromCache: false };
  } catch {
    if (rssCache?.version === RSS_CACHE_VERSION) {
      return { rows: rssCache.rows, fromCache: true };
    }
    return { rows: [], fromCache: false };
  }
}

function tavilyRows(items: TavilyRssLikeItem[]): RawNewsRow[] {
  return items.map((item) => ({ ...item, fonteFallback: "Tavily" }));
}

export type DefectionTavilyOptions = {
  force?: boolean;
  forceSecret?: string | null;
};

/** Arricchimento Tavily del radar: una sola scansione al giorno, condivisa da tutte le richieste. */
function fetchRadarTavily(options?: DefectionTavilyOptions) {
  return fetchTavilyNewsDaily(DEFECTIONS_TAVILY_SCOPE_KEY, [TAVILY_DEFECTION_NEWS_QUERY], {
    maxResultsPerQuery: 20,
    timeRange: "month",
    includeDomains: [...TAVILY_DEFECTION_INCLUDE_DOMAINS],
    includeDomainsMode: "prefer",
    force: options?.force,
    forceSecret: options?.forceSecret,
  });
}

function rawRowsToDefectionItems(
  raw: RawNewsRow[],
  politicians: TrackedPolitician[],
): DefectionNewsItem[] {
  const live: DefectionNewsItem[] = [];
  for (const item of raw) {
    const titolo = decodeRssPlainText(item.titolo.trim());
    const sintesi = decodeRssPlainText(item.snippet?.trim() ?? titolo);
    if (!isDefectionNewsRelevant(titolo, sintesi, item.link)) continue;
    const matched = matchPoliticianFromText(titolo, sintesi, politicians);
    const statoNotizia = newsStatoFromPolitician(matched, titolo, sintesi);
    const beneficio =
      matched && statoNotizia !== "MOVIMENTO ALTRI PARTITI (Esterno a FN)"
        ? beneficioFnFromPolitician(matched, titolo, sintesi)
        : undefined;
    live.push({
      id: `live-${item.link.slice(-24)}`,
      titolo,
      fonte: extractFonte(item.link, item.fonteFallback),
      dataOra: item.pubDate ?? new Date().toISOString(),
      url: item.link,
      sintesi,
      politicianId: matched?.id ?? null,
      statoNotizia,
      partitoProvenienza: matched?.partitoProvenienza,
      beneficioPotenzialeFn: beneficio,
      verificaEtichetta:
        matched?.cambioGruppoFonte?.includes("Camera")
          ? "Cambio gruppo Camera verificato (Atto XIX Leg.)"
          : undefined,
      ipotesiSimulataEtichetta: beneficio
        ? "Ipotesi simulata di trasferimento voti (non verificata)"
        : undefined,
    });
  }
  return live;
}

export function mergeCatalogNews(politicians: TrackedPolitician[]): DefectionNewsItem[] {
  const feedIds = new Set(catalogSeedsForNewsFeed().map((s) => s.id));
  const fromCatalog: DefectionNewsItem[] = politicians
    .filter((p) => feedIds.has(p.id))
    .map((p) => {
      const statoNotizia = newsStatoFromPolitician(
        p,
        p.ultimaNotizia.titolo,
        p.ultimaNotizia.sintesi,
      );
      const beneficio =
        statoNotizia !== "MOVIMENTO ALTRI PARTITI (Esterno a FN)"
          ? beneficioFnFromPolitician(p, p.ultimaNotizia.titolo, p.ultimaNotizia.sintesi)
          : undefined;
      return {
        id: `cat-${p.id}`,
        titolo: p.ultimaNotizia.titolo,
        fonte: p.ultimaNotizia.fonte,
        dataOra: p.ultimaNotizia.dataOra,
        url: p.ultimaNotizia.url,
        sintesi: p.ultimaNotizia.sintesi,
        politicianId: p.id,
        statoNotizia,
        partitoProvenienza: p.partitoProvenienza,
        beneficioPotenzialeFn: beneficio,
        verificaEtichetta: p.cambioGruppoFonte?.includes("Camera")
          ? "Cambio gruppo Camera verificato (Atto XIX Leg.)"
          : undefined,
        ipotesiSimulataEtichetta: beneficio
          ? "Ipotesi simulata di trasferimento voti (non verificata)"
          : undefined,
      };
    });
  return fromCatalog.sort(
    (a, b) => new Date(b.dataOra).getTime() - new Date(a.dataOra).getTime(),
  );
}

export type LiveDefectionNews = {
  news: DefectionNewsItem[];
  fetchedAt: string;
  /** `live` / `cache`: Google News RSS (gratuito) appena letto o dei 15 minuti; `catalog`: nessuna notizia live. */
  source: "live" | "cache" | "catalog";
  rssCount: number;
  tavilyCount: number;
  tavily: TavilyGateMeta;
};

export async function fetchLiveDefectionNews(
  politicians: TrackedPolitician[] = INITIAL_TRACKED_POLITICIANS,
  options?: DefectionTavilyOptions,
): Promise<LiveDefectionNews> {
  const [rss, tavily] = await Promise.all([fetchRadarRssRows(), fetchRadarTavily(options)]);
  const fromRss = rawRowsToDefectionItems(rss.rows, politicians);
  const fromTavily = rawRowsToDefectionItems(tavilyRows(tavily.items), politicians);

  const seen = new Set<string>();
  const merged: DefectionNewsItem[] = [];
  for (const n of [...fromRss, ...fromTavily, ...mergeCatalogNews(politicians)]) {
    const key = n.titolo.slice(0, 80).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(n);
  }
  merged.sort((a, b) => new Date(b.dataOra).getTime() - new Date(a.dataOra).getTime());

  const liveCount = fromRss.length + fromTavily.length;
  return {
    news: merged.slice(0, 48),
    fetchedAt: new Date().toISOString(),
    source: liveCount === 0 ? "catalog" : rss.fromCache ? "cache" : "live",
    rssCount: fromRss.length,
    tavilyCount: fromTavily.length,
    tavily: tavily.meta,
  };
}

/**
 * Fonti per la verifica di un nome: ricerca Google News RSS (gratuita) più gli articoli
 * della scansione Tavily del giorno già salvata. Non consuma crediti Tavily.
 */
export async function searchDefectionSources(
  name: string,
): Promise<{ rows: RawNewsRow[]; tavily: TavilyGateMeta }> {
  const query = `"${name}" (lascia OR esce OR passa OR aderisce OR transfugo OR "cambio di casacca") when:60d`;
  const [rss, saved] = await Promise.all([
    fetchGoogleNewsRows(query, 30).catch((): RawNewsRow[] => []),
    peekTavilyDaily<TavilyRssLikeItem[]>(DEFECTIONS_TAVILY_SCOPE_KEY),
  ]);
  const needle = name.toLowerCase();
  const fromTavily = tavilyRows(saved.data ?? []).filter((row) =>
    `${row.titolo} ${row.snippet}`.toLowerCase().includes(needle),
  );
  return { rows: [...rss, ...fromTavily], tavily: saved.meta };
}

export { canMarkRumorFnFromNews };
