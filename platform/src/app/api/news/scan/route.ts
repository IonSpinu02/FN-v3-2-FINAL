import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
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
import {
  getNewsScanCache,
  registryEntriesKey,
  setNewsScanCache,
  type NewsScanCachePayload,
} from "@/lib/engine/newsScanCache";
import { mergeLiveWithCertifiedDispatches } from "@/lib/engine/certifiedNewsDispatches";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";

export const maxDuration = 60;

const FEED_TIMEOUT_MS = 3500;

async function runLiveNewsScan(
  entries: LocalRegistryEntry[],
): Promise<NewsScanCachePayload> {
  const { urls, fromDefaultCatalog } = resolveNewsRssUrls(
    process.env.NEWS_RSS_URLS,
  );
  const maxItems = Math.min(
    50,
    Math.max(5, parseInt(process.env.NEWS_SCAN_MAX_ITEMS ?? "30", 10) || 30),
  );
  const perFeed = perFeedItemLimit(urls.length, maxItems);
  const keywords = parseNewsKeywordsEnv(process.env.NEWS_KEYWORDS);
  const comuni = entries.map((e) => e.comune);

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const xml = await fetchFeedXml(url, FEED_TIMEOUT_MS);
      return {
        url,
        items: parseRssItems(xml, url, perFeed),
      };
    }),
  );

  const allRaw: Parameters<typeof enrichNewsCandidates>[0] = [];
  const errors: string[] = [];
  let feedsOnline = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      feedsOnline += 1;
      allRaw.push(...r.value.items);
    } else {
      errors.push(
        r.reason instanceof Error ? r.reason.message : String(r.reason),
      );
    }
  }

  const rawItemsRead = allRaw.length;
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
  const meta = {
    feedsChecked: urls.length,
    feedsOnline,
    rawItemsRead,
    rejectedNoiseCount,
    verifiedItemsCount: candidates.length,
    timestamp,
  };

  return {
    candidates,
    scannedFeeds: urls.length,
    fromDefaultCatalog,
    perFeedLimit: perFeed,
    errors: errors.length ? errors : undefined,
    meta,
  };
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      entries?: LocalRegistryEntry[];
      forceRefresh?: boolean;
    };
    const entries = body.entries ?? [];
    const entriesKey = registryEntriesKey(entries);
    const forceRefresh = body.forceRefresh === true;

    if (!forceRefresh) {
      const hit = getNewsScanCache(entriesKey);
      if (hit) {
        const candidates = filterRelevantCandidates(hit.payload.candidates);
        return Response.json({
          ...hit.payload,
          candidates,
          cached: true,
          cachedAt: hit.cachedAt,
        });
      }
    }

    const payload = await runLiveNewsScan(entries);
    setNewsScanCache(entriesKey, payload);

    return Response.json({
      ...payload,
      cached: false,
      cachedAt: payload.meta?.timestamp ?? new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore scan news";
    return Response.json({ error: msg }, { status: 500 });
  }
}
