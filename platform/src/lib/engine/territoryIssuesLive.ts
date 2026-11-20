import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import { findCapoluogoInText, regioneForComune } from "./capoluoghiToRegione";
import type { Region } from "./constants";
import { findRegionInText } from "./italianGeoLookup";
import { fetchFeedXml, parseRssItems } from "./newsIngest";
import type { TavilyRssLikeItem } from "./tavilyClient";
import { fetchTavilyNewsDaily } from "./tavilyNewsFetch";
import { tavilyQueriesForTerritory } from "./tavilyTerritoryQueries";
import {
  buildLiveIssuesFromFeedItems,
  territoryLiveFeedUrls,
} from "./territoryIssuesEngine";
import type { TerritoryIssue } from "./territoryIssuesTypes";

/** Chiave del gate giornaliero: una scansione Tavily per tutta Italia, le regioni filtrano per testo. */
export const TERRITORY_TAVILY_SCOPE_KEY = "osservatorio-radar-italia";

const FETCH_TIMEOUT_MS = 5000;
const PARSE_ITEMS_PER_FEED = 50;

/** I 6 assi B.I.P. su scala nazionale, una volta al giorno (6 chiamate). */
export function fetchTerritoryTavilyDaily(): Promise<{
  items: TavilyRssLikeItem[];
  meta: TavilyGateMeta;
}> {
  return fetchTavilyNewsDaily(TERRITORY_TAVILY_SCOPE_KEY, tavilyQueriesForTerritory("NAZIONALE"), {
    maxResultsPerQuery: 20,
    timeRange: "week",
  });
}

/** Regione citata nel testo (prima i capoluoghi), `null` se la notizia è nazionale. */
function regionOfItem(item: TavilyRssLikeItem): Region | null {
  const blob = `${item.titolo} ${item.snippet}`;
  const capoluogo = findCapoluogoInText(blob);
  return (capoluogo ? regioneForComune(capoluogo) : undefined) ?? findRegionInText(blob) ?? null;
}

/**
 * Notizie live del radar: Google News e ANSA (gratuiti, a ogni refresh) più la scansione
 * Tavily del giorno, condivisa da tutte le regioni.
 */
export async function fetchLiveIssues(region: Region | "NAZIONALE"): Promise<TerritoryIssue[]> {
  const [rssResults, tavily] = await Promise.all([
    Promise.allSettled(
      territoryLiveFeedUrls(region).map(async (url) => {
        const xml = await fetchFeedXml(url, FETCH_TIMEOUT_MS);
        return parseRssItems(xml, url, PARSE_ITEMS_PER_FEED);
      }),
    ),
    fetchTerritoryTavilyDaily(),
  ]);

  const rssItems = rssResults.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const tavilyItems = tavily.items.filter((item) => {
    const itemRegion = regionOfItem(item);
    return region === "NAZIONALE" ? itemRegion == null : itemRegion === region;
  });
  return buildLiveIssuesFromFeedItems(region, [...rssItems, ...tavilyItems]);
}
