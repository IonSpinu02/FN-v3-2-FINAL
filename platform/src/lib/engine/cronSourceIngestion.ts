/**
 * Acquisizione reale server-side per il cron system-monitor.
 * Nessun log fittizio a zero: fetch + sanitize con conteggi veri.
 */
import {
  decodeRssPlainText,
  fetchFeedXml,
  isNewsJunkText,
  parseRssItems,
  resolveNewsRssUrls,
} from "@/lib/engine/newsIngest";

export type RssIngestionResult = {
  itemsFetched: number;
  itemsAccepted: number;
  itemsRejected: number;
  lastNewItemAt: string | null;
  titles: string[];
  errorMessage: string | null;
  feedsChecked: number;
  usedFallback: boolean;
};

export async function ingestObservatoryRss(opts?: {
  maxFeeds?: number;
  maxItems?: number;
}): Promise<RssIngestionResult> {
  const maxFeeds = opts?.maxFeeds ?? 6;
  const maxItems = opts?.maxItems ?? 40;
  const { urls, fromDefaultCatalog } = resolveNewsRssUrls(process.env.NEWS_RSS_URLS);
  const selected = urls.slice(0, maxFeeds);

  let itemsFetched = 0;
  let itemsAccepted = 0;
  let itemsRejected = 0;
  const titles: string[] = [];
  const dates: string[] = [];
  const errors: string[] = [];

  await Promise.allSettled(
    selected.map(async (url) => {
      try {
        const xml = await fetchFeedXml(url, 3500);
        const perFeed = Math.ceil(maxItems / Math.max(1, selected.length));
        const items = parseRssItems(xml, url, perFeed);
        itemsFetched += items.length;
        for (const item of items) {
          const title = decodeRssPlainText(item.titolo ?? "").trim();
          if (!title || isNewsJunkText(title, item.snippet ?? "")) {
            itemsRejected += 1;
            continue;
          }
          itemsAccepted += 1;
          titles.push(title);
          if (item.pubDate) {
            const t = Date.parse(item.pubDate);
            if (Number.isFinite(t)) dates.push(new Date(t).toISOString().slice(0, 10));
          }
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }),
  ).then((results) => {
    for (const r of results) {
      if (r.status === "rejected") {
        errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
      }
    }
  });

  return {
    itemsFetched,
    itemsAccepted,
    itemsRejected,
    lastNewItemAt: dates.sort().at(-1) ?? null,
    titles: titles.slice(0, maxItems),
    errorMessage: errors.length ? errors.slice(0, 3).join(" · ") : null,
    feedsChecked: selected.length,
    usedFallback: fromDefaultCatalog && itemsAccepted === 0 && errors.length > 0,
  };
}
