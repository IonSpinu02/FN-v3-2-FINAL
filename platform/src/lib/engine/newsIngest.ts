import { REGIONS, type Region } from "./constants";
import { inferRegionFromFeedUrl } from "./italianGeoLookup";
import { DEFAULT_NEWS_RSS_URLS } from "./newsFeedCatalog";
import type { LocalEventType, NewsCandidate } from "./localiTypes";
import {
  analyzeInstitutionalArticle,
  HARD_BLACKLIST_REGEX,
  matchesNewsSearch,
  normalizeTitleKey,
  sanitizeNewsText,
} from "./newsInstitutionalAnalyzer";

export { HARD_BLACKLIST_REGEX, matchesNewsSearch, analyzeInstitutionalArticle };

export const DEFAULT_NEWS_KEYWORDS = [
  "sindaco",
  "sindaca",
  "giunta",
  "consiglio",
  "dimissioni",
  "passa a",
  "passaggio",
  "futuro nazionale",
  "consiglio comunale",
  "consiglio regionale",
  "elezioni",
  "comune",
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`,
    "i",
  );
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

export function parseRssItems(
  xml: string,
  feedUrl: string,
  maxItems: number,
): Omit<
  NewsCandidate,
  | "id"
  | "matchedKeywords"
  | "comuneGuess"
  | "regioneGuess"
  | "suggestedAction"
  | "confidenceScore"
  | "matchedRoleKeyword"
  | "matchedGeoKeyword"
  | "sourceLabel"
>[] {
  const items: Omit<
    NewsCandidate,
    | "id"
    | "matchedKeywords"
    | "comuneGuess"
    | "regioneGuess"
    | "suggestedAction"
    | "confidenceScore"
    | "matchedRoleKeyword"
    | "matchedGeoKeyword"
    | "sourceLabel"
  >[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < maxItems) {
    const block = m[1];
    const titolo = extractTag(block, "title");
    const link = extractTag(block, "link") || extractTag(block, "guid");
    const pubDate =
      extractTag(block, "pubDate") || extractTag(block, "dc:date") || null;
    const desc =
      extractTag(block, "description") ||
      extractTag(block, "content:encoded");
    if (titolo || link) {
      items.push({
        titolo: titolo || "(senza titolo)",
        link: link || feedUrl,
        pubDate: pubDate || null,
        snippet: desc.slice(0, 480),
        feedUrl,
      });
    }
  }
  return items;
}

function suggestAction(text: string, keywords: string[]): LocalEventType | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("futuro nazionale") || lower.includes("passa a fn")) {
    return "ingresso_fn";
  }
  if (keywords.includes("dimissioni") && lower.includes("futuro nazionale")) {
    return "uscita_fn";
  }
  if (keywords.includes("giunta") || keywords.includes("consiglio")) {
    return "cambio_giunta";
  }
  return undefined;
}

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function isNewsJunkText(titolo: string, snippet = ""): boolean {
  return HARD_BLACKLIST_REGEX.test(sanitizeNewsText(titolo, snippet));
}

export function hasInstitutionalNewsSignals(
  titolo: string,
  snippet = "",
): boolean {
  return (
    analyzeInstitutionalArticle({
      titolo,
      snippet,
      feedUrl: "",
    }) !== null
  );
}

export function enrichNewsCandidates(
  raw: Omit<
    NewsCandidate,
    | "id"
    | "matchedKeywords"
    | "comuneGuess"
    | "regioneGuess"
    | "suggestedAction"
    | "confidenceScore"
    | "matchedRoleKeyword"
    | "matchedGeoKeyword"
    | "sourceLabel"
  >[],
  keywords: string[],
  _comuniNames: string[],
): NewsCandidate[] {
  const out: NewsCandidate[] = [];
  for (const [idx, item] of raw.entries()) {
    const titolo = item.titolo;
    const snippet = item.snippet;
    const feedRegionHint = inferRegionFromFeedUrl(item.feedUrl);
    const analyzed = analyzeInstitutionalArticle({
      titolo,
      snippet,
      feedUrl: item.feedUrl,
      feedRegionHint,
    });
    if (!analyzed) continue;

    const blob = `${titolo} ${snippet}`.toLowerCase();
    const matchedKeywords = keywords.filter((k) =>
      blob.includes(k.toLowerCase()),
    );

    out.push({
      ...item,
      titolo,
      snippet,
      id: `news-${idx}-${hashStr(item.link)}`,
      matchedKeywords,
      comuneGuess: analyzed.comune,
      regioneGuess: analyzed.regione,
      suggestedRegion: analyzed.regione,
      suggestedComune: analyzed.comune,
      suggestedRole: analyzed.role,
      confidenceScore: analyzed.confidenceScore,
      matchedRoleKeyword: analyzed.matchedRoleKeyword,
      matchedGeoKeyword: analyzed.matchedGeoKeyword,
      suggestedAction: suggestAction(blob, matchedKeywords),
    });
  }
  return out;
}

export function passesEditorialNewsFilter(c: NewsCandidate): boolean {
  if (isNewsJunkText(c.titolo, c.snippet)) return false;
  if (!c.suggestedRole) return false;
  return (
    analyzeInstitutionalArticle({
      titolo: c.titolo,
      snippet: c.snippet,
      feedUrl: c.feedUrl,
      feedRegionHint: c.suggestedRegion,
    }) !== null
  );
}

export function filterRelevantCandidates(
  candidates: NewsCandidate[],
): NewsCandidate[] {
  return candidates.filter(passesEditorialNewsFilter);
}

export function dedupeNewsRaw<
  T extends { titolo: string; link: string },
>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = normalizeTitleKey(it.titolo) || it.link;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

export async function fetchFeedXml(
  url: string,
  timeoutMs = 3500,
): Promise<string> {
  const signal =
    typeof AbortSignal !== "undefined" &&
    "timeout" in AbortSignal &&
    typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(timeoutMs)
      : undefined;

  if (signal) {
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}: ${url}`);
    return await res.text();
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Feed HTTP ${res.status}: ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export function parseNewsKeywordsEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return DEFAULT_NEWS_KEYWORDS;
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseRssUrlsEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function resolveNewsRssUrls(raw: string | undefined): {
  urls: string[];
  fromDefaultCatalog: boolean;
} {
  const fromEnv = parseRssUrlsEnv(raw);
  if (fromEnv.length > 0) {
    return { urls: fromEnv, fromDefaultCatalog: false };
  }
  return { urls: [...DEFAULT_NEWS_RSS_URLS], fromDefaultCatalog: true };
}

export function perFeedItemLimit(totalFeeds: number, maxItems: number): number {
  if (totalFeeds <= 0) return maxItems;
  if (totalFeeds === 1) return maxItems;
  return Math.max(
    2,
    Math.min(maxItems, 12, Math.ceil((maxItems * 2.5) / totalFeeds)),
  );
}
