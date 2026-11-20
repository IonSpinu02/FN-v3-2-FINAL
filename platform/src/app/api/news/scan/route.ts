import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { filterRelevantCandidates } from "@/lib/engine/newsIngest";
import { registryEntriesKey, type NewsScanCachePayload } from "@/lib/engine/newsScanCache";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";
import { getStaleOrFresh } from "@/lib/db/domainCacheRepository";
import { getPublishedState } from "@/lib/db/publishedStateRepository";
import {
  ifNoneMatchHit,
  jsonWithEtag,
  notModifiedResponse,
  publishedEtag,
} from "@/lib/api/etagRead";
import { logStructured } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CacheEntry = {
  cachedAt: number;
  entriesKey: string;
  payload: NewsScanCachePayload;
};

function domainKey(entriesKey: string): string {
  return `news:scan:${entriesKey}`;
}

function emptyPayload(): NewsScanCachePayload {
  const timestamp = new Date().toISOString();
  return {
    candidates: [],
    scannedFeeds: 0,
    fromDefaultCatalog: true,
    perFeedLimit: 10,
    meta: {
      feedsChecked: 0,
      feedsOnline: 0,
      rawItemsRead: 0,
      rejectedNoiseCount: 0,
      verifiedItemsCount: 0,
      timestamp,
      provider: "rss",
    },
  };
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const started = Date.now();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      entries?: LocalRegistryEntry[];
      forceRefresh?: boolean;
    };
    const entries = body.entries ?? [];
    const entriesKey = registryEntriesKey(entries);
    const domain = entries.length > 0 ? "locali" : "news";
    const published = await getPublishedState(domain);
    const etag = publishedEtag(published, `"news-${entriesKey}"`);

    if (ifNoneMatchHit(req, etag)) {
      return notModifiedResponse(etag);
    }

    const row = await getStaleOrFresh<CacheEntry>(domainKey(entriesKey));
    const bundle = row?.entry.payload;
    const payload = bundle?.payload ?? emptyPayload();
    const cachedAt = bundle
      ? new Date(bundle.cachedAt).toISOString()
      : payload.meta?.timestamp ?? new Date().toISOString();

    const candidates = filterRelevantCandidates(payload.candidates);
    const stale =
      row != null &&
      row.stale &&
      row.entry.expiresAt != null &&
      Date.now() > row.entry.expiresAt;

    logStructured({
      event: "read_news_scan",
      domain,
      durationMs: Date.now() - started,
      usedFallback: stale || !bundle,
    });

    return jsonWithEtag(
      {
        ...payload,
        candidates,
        cached: Boolean(bundle),
        cachedAt,
      },
      etag,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore scan news";
    return Response.json({ error: msg }, { status: 500 });
  }
}