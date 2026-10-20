import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  enrichNewsCandidates,
  fetchFeedXml,
  filterRelevantCandidates,
  parseNewsKeywordsEnv,
  parseRssItems,
  perFeedItemLimit,
  resolveNewsRssUrls,
} from "@/lib/engine/newsIngest";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";

/** Molti feed in parallelo: timeout generoso su Vercel. */
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await req.json().catch(() => ({}))) as {
      entries?: LocalRegistryEntry[];
    };
    const { urls, fromDefaultCatalog } = resolveNewsRssUrls(
      process.env.NEWS_RSS_URLS,
    );
    const maxItems = Math.min(
      50,
      Math.max(5, parseInt(process.env.NEWS_SCAN_MAX_ITEMS ?? "30", 10) || 30),
    );
    const perFeed = perFeedItemLimit(urls.length, maxItems);
    const keywords = parseNewsKeywordsEnv(process.env.NEWS_KEYWORDS);
    const comuni = (body.entries ?? []).map((e) => e.comune);

    const allRaw: Parameters<typeof enrichNewsCandidates>[0] = [];
    const errors: string[] = [];

    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const xml = await fetchFeedXml(url, 12_000);
          return {
            url,
            items: parseRssItems(xml, url, perFeed),
            error: null as string | null,
          };
        } catch (e) {
          return {
            url,
            items: [] as ReturnType<typeof parseRssItems>,
            error: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    for (const r of results) {
      if (r.error) errors.push(`${r.url}: ${r.error}`);
      else allRaw.push(...r.items);
    }

    const enriched = enrichNewsCandidates(allRaw, keywords, comuni);
    const candidates = filterRelevantCandidates(enriched).slice(0, maxItems);

    return Response.json({
      candidates,
      scannedFeeds: urls.length,
      fromDefaultCatalog,
      perFeedLimit: perFeed,
      errors: errors.length ? errors : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore scan news";
    return Response.json({ error: msg }, { status: 500 });
  }
}
