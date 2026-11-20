import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import type { FnSupermediaPollPoint } from "@/lib/fnSupermediaConsensoSeries";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";

const YOUTREND_FEED_URL = "https://www.youtrend.it/feed/";

const IT_MONTH: Record<string, string> = {
  gennaio: "01",
  febbraio: "02",
  marzo: "03",
  aprile: "04",
  maggio: "05",
  giugno: "06",
  luglio: "07",
  agosto: "08",
  settembre: "09",
  ottobre: "10",
  novembre: "11",
  dicembre: "12",
};

export type YouTrendIngestResult = {
  points: FnSupermediaPollPoint[];
  fetchedAt: string;
  itemCount: number;
};

function decodeHtmlEntities(raw: string): string {
  return raw
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ");
}

function parseFnPctFromBlob(blob: string): number | null {
  const normalized = decodeHtmlEntities(blob);
  const patterns = [
    /Futuro Nazionale al\s+([\d]+[,.][\d]+)\s*%/i,
    /Futuro Nazionale[^%]{0,120}?\s([\d]+[,.][\d]+)\s*%/i,
  ];
  for (const re of patterns) {
    const m = normalized.match(re);
    if (m?.[1]) {
      const n = Number(m[1].replace(",", "."));
      if (Number.isFinite(n) && n >= 0 && n <= 100) return Math.round(n * 10) / 10;
    }
  }
  return null;
}

function parseSupermediaReferenceDate(
  blob: string,
  fallbackYear?: number,
): string | null {
  const text = decodeHtmlEntities(blob);
  const m = text.match(
    /Supermedia[^.]{0,200}?del\s+(\d{1,2})[°º]?\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)(?:\s+(\d{4}))?/i,
  );
  if (!m) return null;
  const day = m[1]!.padStart(2, "0");
  const month = IT_MONTH[m[2]!.toLowerCase()];
  if (!month) return null;
  const year = m[3] ?? (fallbackYear != null ? String(fallbackYear) : null);
  if (!year) return null;
  return `${year}-${month}-${day}`;
}

function parseRssPubDateToIso(pubDate: string): string | null {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Frasi della fonte che spiegano il movimento di Futuro Nazionale. */
export function extractFnMovement(blob: string): {
  why: string;
  deltaPp: number | null;
} {
  const text = decodeHtmlEntities(blob).replace(/\s+/g, " ").trim();
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(
      (s) =>
        /futuro nazionale|vannacci/i.test(s) &&
        !/proviene da youtrend|guarda questo post|instagram|condividi su/i.test(s),
    );
  const ranked = [...sentences].sort((a, b) => {
    const score = (s: string) =>
      (/perde|guadagna|scende|sale|calo|cresc/i.test(s) ? 2 : 0) +
      (/vannacci|lega/i.test(s) ? 1 : 0);
    return score(b) - score(a);
  });
  const why = ranked.slice(0, 3).join(" ").slice(0, 700);
  const move = why.match(
    /(?:Futuro Nazionale[^.]{0,80}?|(?:che|partito)[^.]{0,40}?)\b(perde|guadagna|sale|scende)\s+([\d]+[,.][\d]+)\s+punt/i,
  );
  const loose = why.match(/\b(perde|guadagna)\s+([\d]+[,.][\d]+)\s+punt/i);
  const hit = move ?? loose;
  if (!hit) return { why, deltaPp: null };
  const n = Number(hit[2]!.replace(",", "."));
  if (!Number.isFinite(n)) return { why, deltaPp: null };
  const down = /perde|scende/i.test(hit[1]!);
  return { why, deltaPp: Math.round((down ? -n : n) * 10) / 10 };
}

function stripCdata(raw: string): string {
  return raw.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

/** Estrae punti FN da articoli Supermedia nel feed RSS YouTrend (pubblico). */
export function parseYouTrendSupermediaRss(xml: string): FnSupermediaPollPoint[] {
  const blocks = xml.split(/<item>/i).slice(1);
  const points: FnSupermediaPollPoint[] = [];

  for (const block of blocks) {
    const chunk = block.split(/<\/item>/i)[0] ?? block;
    const title = stripCdata(
      (chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim(),
    );
    const link = (chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "").trim();
    const pubDate = (chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] ?? "").trim();
    const description =
      stripCdata(
        (chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "").trim(),
      ) +
      " " +
      stripCdata(
        (chunk.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ??
          "").trim(),
      );

    const isSupermedia =
      /supermedia/i.test(title) ||
      /supermedia/i.test(chunk) ||
      /supermedia/i.test(description);
    if (!isSupermedia) continue;

    const pct = parseFnPctFromBlob(description || title);
    if (pct == null) continue;

    const pubYear = parseRssPubDateToIso(pubDate);
    const fallbackYear = pubYear ? Number(pubYear.slice(0, 4)) : undefined;
    const refDate =
      parseSupermediaReferenceDate(description, fallbackYear) ??
      parseSupermediaReferenceDate(title, fallbackYear) ??
      pubYear;
    if (!refDate) continue;

    const explained = extractFnMovement(description || title);
    points.push({
      isoDate: refDate,
      pct,
      caption: title.slice(0, 120) || `Supermedia ${refDate}`,
      articleUrl: link || undefined,
      why: explained.why,
      deltaPp: explained.deltaPp ?? undefined,
    });
  }

  const byDate = new Map<string, FnSupermediaPollPoint>();
  for (const p of points) {
    const prev = byDate.get(p.isoDate);
    if (!prev || p.pct !== prev.pct) byDate.set(p.isoDate, p);
  }
  return [...byDate.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

const FEED_CACHE_VERSION = 3;
const DOMAIN_CACHE_KEY = `consenso:youtrend:feed:v${FEED_CACHE_VERSION}`;

type FeedCacheEntry = { at: number; version: number; result: YouTrendIngestResult };

let feedCache: FeedCacheEntry | null = null;

export const CONSENSO_FEED_CACHE_TTL_MS = 15 * 60 * 1000;

async function readFeedCache(now: number): Promise<YouTrendIngestResult | null> {
  if (cacheUsesProcessMemory() && feedCache?.version === FEED_CACHE_VERSION) {
    if (now - feedCache.at < CONSENSO_FEED_CACHE_TTL_MS) return feedCache.result;
  }
  const row = await readDomainCacheEntry<FeedCacheEntry>(DOMAIN_CACHE_KEY);
  if (!row?.payload || row.payload.version !== FEED_CACHE_VERSION) return null;
  if (now - row.payload.at >= CONSENSO_FEED_CACHE_TTL_MS) return null;
  if (cacheUsesProcessMemory()) feedCache = row.payload;
  return row.payload.result;
}

async function writeFeedCache(entry: FeedCacheEntry): Promise<void> {
  if (cacheUsesProcessMemory()) feedCache = entry;
  await writeDomainCacheEntry({
    key: DOMAIN_CACHE_KEY,
    payload: entry,
    computedAt: entry.at,
    expiresAt: entry.at + CONSENSO_FEED_CACHE_TTL_MS,
    etag: String(FEED_CACHE_VERSION),
    sourceStatus: null,
  });
}

export async function fetchYouTrendSupermediaFnPoints(options?: {
  force?: boolean;
  now?: number;
}): Promise<YouTrendIngestResult> {
  const now = options?.now ?? Date.now();
  if (!options?.force) {
    const hit = await readFeedCache(now);
    if (hit) return hit;
  }

  const res = await fetch(YOUTREND_FEED_URL, {
    headers: { "User-Agent": "FN-Platform-ConsensoSync/1.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`YouTrend RSS HTTP ${res.status}`);
  }
  const xml = await res.text();
  const points = parseYouTrendSupermediaRss(xml);
  const result: YouTrendIngestResult = {
    points,
    fetchedAt: new Date(now).toISOString(),
    itemCount: points.length,
  };
  await writeFeedCache({ at: now, version: FEED_CACHE_VERSION, result });
  return result;
}

export function clearYouTrendFeedCacheForTests(): void {
  feedCache = null;
}
