import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { TrendsTerritoryMode } from "@/lib/googleTrendsIntelligence";
import {
  buildBipPianoRisoluzione,
  buildTargetedTrendsForTerritory,
  sortTrendsByAttention,
  withRelativeDisplayIndices,
  type TargetedTrendItem,
  type TrendsClusterId,
} from "@/lib/googleTrendsIntelligence";
import { googleTrendsGeoForTerritory } from "./googleTrendsGeo";
import {
  classifyBipAlignedIssue,
  isSportOrOffTopicBlocked,
} from "./territoryIssuesEngine";
import type { TerritoryIssueCategory } from "./territoryIssuesTypes";

export type GoogleTrendRssItem = {
  query: string;
  approxTraffic: number;
  trafficLabel: string;
  pubDate: string | null;
  newsHeadlines: string[];
};

const CATEGORY_TO_CLUSTER: Record<TerritoryIssueCategory, TrendsClusterId> = {
  SANITA: "SANITA_CUP",
  SICUREZZA: "SICUREZZA_CITTA",
  LAVORO: "LAVORO_AUTO_GREEN",
  COSTO_VITA: "FAMIGLIA_CASA",
  TRASPORTI: "TRASPORTI_PENDOLARI",
  TERRITORIO: "AGRICOLTURA_TERRITORIO",
};

const POLITICAL_TREND =
  /vannacci|futuro\s*nazionale|lega|fratelli|meloni|salvini|congresso|elezioni|referendum|sanit|ospedal|tren|pendolar|sicurezz|bollett|affitt|mutui|lavoro|crisi|agricol|gasolio|immigr|decret|governo|regione/i;

function parseTraffic(raw: string | null): { numeric: number; label: string } {
  if (!raw?.trim()) return { numeric: 100, label: "In crescita" };
  const m = raw.match(/([\d.]+)\s*([kKmM])?\+?/);
  if (!m) return { numeric: 150, label: raw.trim() };
  let n = parseFloat(m[1]!.replace(",", "."));
  const suffix = m[2]?.toLowerCase();
  if (suffix === "k") n *= 1000;
  if (suffix === "m") n *= 1_000_000;
  return { numeric: Math.round(n), label: raw.trim() };
}

function stripTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Parser RSS Daily Search Trends (geo IT / IT-XX). */
export function parseGoogleTrendsRssFeed(xml: string): GoogleTrendRssItem[] {
  const items: GoogleTrendRssItem[] = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const block of blocks) {
    const chunk = block.split(/<\/item>/i)[0] ?? block;
    const title = stripTags(chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    if (!title || title.toLowerCase() === "daily search trends") continue;
    const trafficRaw =
      chunk.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1] ?? null;
    const traffic = parseTraffic(trafficRaw ? stripTags(trafficRaw) : null);
    const pubDate =
      stripTags(chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "") || null;
    const headlines: string[] = [];
    const newsBlocks = chunk.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) ?? [];
    for (const nb of newsBlocks.slice(0, 3)) {
      const h = stripTags(
        nb.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/i)?.[1] ?? "",
      );
      if (h) headlines.push(h);
    }
    items.push({
      query: title,
      approxTraffic: traffic.numeric,
      trafficLabel: traffic.label,
      pubDate,
      newsHeadlines: headlines,
    });
  }
  return items;
}

function trendIsRelevant(item: GoogleTrendRssItem): boolean {
  const blob = `${item.query} ${item.newsHeadlines.join(" ")}`;
  if (isSportOrOffTopicBlocked(item.query, blob)) return false;
  if (classifyBipAlignedIssue(item.query, blob)) return true;
  return false;
}

function rssItemToTargetedTrend(
  item: GoogleTrendRssItem,
  territory: TrendsTerritoryMode,
  idx: number,
): TargetedTrendItem | null {
  if (!trendIsRelevant(item)) return null;
  const blob = `${item.query} ${item.newsHeadlines.join(" ")}`;
  const aligned = classifyBipAlignedIssue(item.query, blob);
  if (!aligned) return null;
  const cat = aligned.category;
  const cluster = CATEGORY_TO_CLUSTER[cat];
  const tKey = territory === "NAZIONALE" ? "Italia" : territory;
  const trafficScore = Math.min(100, Math.round(Math.log10(item.approxTraffic + 10) * 28));
  const surgeNumeric = Math.min(
    400,
    Math.round(item.approxTraffic / 15 + trafficScore * 0.6),
  );

  return {
    id: `live-rss-${tKey}-${idx}-${item.query.slice(0, 24).replace(/\W+/g, "-")}`,
    cluster,
    exactQuery: item.query,
    queryType: "Termine di ricerca testuale",
    currentIndex0100: trafficScore,
    peakIndex0100: Math.min(100, trafficScore + 8),
    surgePct: `${item.trafficLabel} · Live Google`,
    surgeNumeric,
    provenance: "google_rss",
    relatedQueries: [
      item.newsHeadlines[0]?.slice(0, 48) ?? "Cronaca collegata",
      item.newsHeadlines[1]?.slice(0, 48) ?? "Approfondimento",
      item.newsHeadlines[2]?.slice(0, 48) ?? "Contesto regionale",
    ] as [string, string, string],
    series30d: [],
    datoOggettivoModuloB:
      item.newsHeadlines[0] ??
      `Trend Google Trends ${tKey} · aggiornamento ${item.pubDate ?? "recente"}`,
    pianoRisoluzione: buildBipPianoRisoluzione(cat, {
      causaRadice: `Impennata di ricerche su «${item.query}» in ${tKey}.`,
      soluzionePratica: "",
      enteCompetente: "Regione / Comune competente",
      tempiAttuazione: "Immediato: 48–72 ore",
      azioneSulCampo48h:
        "Monitorare la query su Google Trends e presidiare il territorio con scheda B.I.P. del macro-tema.",
    }),
  };
}

async function fetchTrendsRssGeo(geo: string): Promise<GoogleTrendRssItem[]> {
  const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "FN-Osservatorio/1.0 (+https://futuronazionale.it)" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseGoogleTrendsRssFeed(xml);
}

const CACHE_MS = 45 * 60 * 1000;

type TrendsCacheEntry = { at: number; items: TargetedTrendItem[] };

const memoryCache = new Map<string, TrendsCacheEntry>();

function domainKey(territory: TrendsTerritoryMode): string {
  return `google-trends:live:${territory}`;
}

async function readTrendsCache(
  territory: TrendsTerritoryMode,
  now: number,
): Promise<TrendsCacheEntry | null> {
  if (cacheUsesProcessMemory()) {
    const mem = memoryCache.get(territory);
    if (mem && now - mem.at < CACHE_MS) return mem;
  }
  const row = await readDomainCacheEntry<TrendsCacheEntry>(domainKey(territory));
  if (!row?.payload || now - row.payload.at >= CACHE_MS) return null;
  if (cacheUsesProcessMemory()) memoryCache.set(territory, row.payload);
  return row.payload;
}

export async function fetchLiveGoogleTrendsForTerritory(
  territory: TrendsTerritoryMode,
): Promise<{ items: TargetedTrendItem[]; fetchedAt: string; source: "google_rss" }> {
  const now = Date.now();
  const hit = await readTrendsCache(territory, now);
  if (hit) {
    return {
      items: hit.items,
      fetchedAt: new Date(hit.at).toISOString(),
      source: "google_rss",
    };
  }

  const geo = googleTrendsGeoForTerritory(territory);
  const [regional, national] = await Promise.all([
    fetchTrendsRssGeo(geo),
    geo === "IT" ? Promise.resolve([]) : fetchTrendsRssGeo("IT"),
  ]);

  const mergedRss = [...regional];
  const seen = new Set(regional.map((r) => r.query.toLowerCase()));
  for (const n of national) {
    if (!seen.has(n.query.toLowerCase())) mergedRss.push(n);
  }

  const fromRss: TargetedTrendItem[] = [];
  mergedRss.forEach((row, i) => {
    const mapped = rssItemToTargetedTrend(row, territory, i);
    if (mapped) fromRss.push(mapped);
  });
  fromRss.sort((a, b) => b.surgeNumeric - a.surgeNumeric);

  const templates = buildTargetedTrendsForTerritory(territory);
  const templateByQuery = new Map(
    templates.map((t) => [t.exactQuery.toLowerCase(), t]),
  );

  for (const rss of fromRss) {
    const q = rss.exactQuery.toLowerCase();
    const tpl =
      templateByQuery.get(q) ??
      templates.find(
        (t) =>
          q.includes(t.exactQuery.slice(0, 18).toLowerCase()) ||
          t.exactQuery.toLowerCase().includes(q.slice(0, 18)),
      );
    if (tpl) {
      rss.pianoRisoluzione = tpl.pianoRisoluzione;
      rss.cluster = tpl.cluster;
    }
  }

  const usedIds = new Set(fromRss.map((i) => i.exactQuery.toLowerCase()));
  const templateFill = sortTrendsByAttention(templates).filter(
    (t) => !usedIds.has(t.exactQuery.toLowerCase()),
  );

  const combined = [...fromRss, ...templateFill];
  const items = withRelativeDisplayIndices(sortTrendsByAttention(combined));

  const entry: TrendsCacheEntry = { at: now, items };
  if (cacheUsesProcessMemory()) memoryCache.set(territory, entry);
  await writeDomainCacheEntry({
    key: domainKey(territory),
    payload: entry,
    computedAt: now,
    expiresAt: now + CACHE_MS,
    etag: territory,
    sourceStatus: null,
  });
  return { items, fetchedAt: new Date().toISOString(), source: "google_rss" };
}
