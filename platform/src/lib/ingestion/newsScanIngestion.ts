import {
  analyzeInstitutionalArticle,
  dedupeNewsRaw,
  enrichNewsCandidates,
  fetchFeedXml,
  filterRelevantCandidates,
  isNewsJunkText,
  parseNewsKeywordsEnv,
  parseRssItems,
  perFeedItemLimit,
  resolveNewsRssUrls,
} from "@/lib/engine/newsIngest";
import { mergeLiveWithCertifiedDispatches } from "@/lib/engine/certifiedNewsDispatches";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";
import type { NewsScanCachePayload } from "@/lib/engine/newsScanCache";
import { tavilyQueriesForInstitutionalNews } from "@/lib/engine/tavilyInstitutionalQueries";
import { fetchTavilyNewsDaily } from "@/lib/engine/tavilyNewsFetch";

export const NEWS_SCAN_TAVILY_SCOPE_KEY = "news-scan-locali";
const FEED_TIMEOUT_MS = 3500;

/** Ingestion RSS + Tavily (solo worker/cron). */
export async function ingestNewsScanForEntries(
  entries: LocalRegistryEntry[],
): Promise<NewsScanCachePayload> {
  const { urls, fromDefaultCatalog } = resolveNewsRssUrls(process.env.NEWS_RSS_URLS);
  const maxItems = Math.min(
    50,
    Math.max(5, parseInt(process.env.NEWS_SCAN_MAX_ITEMS ?? "30", 10) || 30),
  );
  const perFeed = perFeedItemLimit(urls.length, maxItems);
  const keywords = parseNewsKeywordsEnv(process.env.NEWS_KEYWORDS);
  const comuni = entries.map((e) => e.comune);

  const allRaw: Parameters<typeof enrichNewsCandidates>[0] = [];
  const errors: string[] = [];
  let feedsOnline = 0;

  const [results, tavily] = await Promise.all([
    Promise.allSettled(
      urls.map(async (url) => {
        const xml = await fetchFeedXml(url, FEED_TIMEOUT_MS);
        return { url, items: parseRssItems(xml, url, perFeed) };
      }),
    ),
    fetchTavilyNewsDaily(
      NEWS_SCAN_TAVILY_SCOPE_KEY,
      tavilyQueriesForInstitutionalNews(comuni, keywords),
      { timeRange: "week", maxResultsPerQuery: 10 },
    ),
  ]);

  for (const r of results) {
    if (r.status === "fulfilled") {
      feedsOnline += 1;
      allRaw.push(...r.value.items);
    } else {
      errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
    }
  }

  allRaw.push(
    ...tavily.items.map((item) => ({
      titolo: item.titolo,
      link: item.link,
      pubDate: item.pubDate,
      snippet: item.snippet,
      feedUrl: item.feedUrl,
    })),
  );
  if (tavily.meta.error) errors.push(`Tavily: ${tavily.meta.error}`);

  const deduped = dedupeNewsRaw(allRaw);
  let rejectedNoiseCount = 0;
  for (const item of deduped) {
    const ok =
      !isNewsJunkText(item.titolo, item.snippet) &&
      analyzeInstitutionalArticle({
        titolo: item.titolo,
        snippet: item.snippet,
        feedUrl: item.feedUrl,
      }) !== null;
    if (!ok) rejectedNoiseCount += 1;
  }

  const enriched = enrichNewsCandidates(deduped, keywords, comuni);
  const liveVerified = filterRelevantCandidates(enriched);
  const candidates = mergeLiveWithCertifiedDispatches(liveVerified, maxItems);

  const timestamp = new Date().toISOString();
  return {
    candidates,
    scannedFeeds: urls.length,
    fromDefaultCatalog,
    perFeedLimit: perFeed,
    errors: errors.length ? errors : undefined,
    meta: {
      feedsChecked: urls.length,
      feedsOnline,
      rawItemsRead: allRaw.length,
      rejectedNoiseCount,
      verifiedItemsCount: candidates.length,
      timestamp,
      provider:
        tavily.meta.status === "disabled" ? ("rss" as const) : ("rss+tavily" as const),
      tavily: tavily.meta,
    },
  };
}