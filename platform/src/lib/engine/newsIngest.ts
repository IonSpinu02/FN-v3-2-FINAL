import { REGIONS, type Region } from "./constants";
import { DEFAULT_NEWS_RSS_URLS } from "./newsFeedCatalog";
import type { LocalEventType, NewsCandidate } from "./localiTypes";

export const DEFAULT_NEWS_KEYWORDS = [
  "sindaco",
  "sindaca",
  "giunta",
  "consiglio",
  "dimissioni",
  "passa a",
  "passaggio",
  "futuro nazionale",
  "fdi",
  "lega",
  "elezioni",
  "comune",
];

const REGION_ALIASES: Record<string, Region> = {
  lombardia: "Lombardia",
  piemonte: "Piemonte",
  lazio: "Lazio",
  sicilia: "Sicilia",
  veneto: "Veneto",
};

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

export function parseRssItems(xml: string, feedUrl: string, maxItems: number): Omit<NewsCandidate, "id" | "matchedKeywords" | "comuneGuess" | "regioneGuess" | "suggestedAction">[] {
  const items: Omit<NewsCandidate, "id" | "matchedKeywords" | "comuneGuess" | "regioneGuess" | "suggestedAction">[] = [];
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && items.length < maxItems) {
    const block = m[1];
    const titolo = extractTag(block, "title") || extractTag(block, "title");
    const link = extractTag(block, "link") || extractTag(block, "guid");
    const pubDate = extractTag(block, "pubDate") || extractTag(block, "dc:date") || null;
    const desc = extractTag(block, "description") || extractTag(block, "content:encoded");
    if (titolo || link) {
      items.push({
        titolo: titolo || "(senza titolo)",
        link: link || feedUrl,
        pubDate: pubDate || null,
        snippet: desc.slice(0, 280),
        feedUrl,
      });
    }
  }
  return items;
}

function guessComune(text: string, comuni: string[]): string | undefined {
  const lower = text.toLowerCase();
  for (const c of comuni) {
    if (c.length >= 4 && lower.includes(c.toLowerCase())) return c;
  }
  return undefined;
}

function guessRegion(text: string): Region | undefined {
  const lower = text.toLowerCase();
  for (const [alias, region] of Object.entries(REGION_ALIASES)) {
    if (lower.includes(alias)) return region;
  }
  for (const r of REGIONS) {
    if (lower.includes(r.toLowerCase())) return r;
  }
  return undefined;
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

export function enrichNewsCandidates(
  raw: Omit<NewsCandidate, "id" | "matchedKeywords" | "comuneGuess" | "regioneGuess" | "suggestedAction">[],
  keywords: string[],
  comuniNames: string[],
): NewsCandidate[] {
  return raw.map((item, idx) => {
    const blob = `${item.titolo} ${item.snippet}`.toLowerCase();
    const matchedKeywords = keywords.filter((k) =>
      blob.includes(k.toLowerCase()),
    );
    const comuneGuess = guessComune(`${item.titolo} ${item.snippet}`, comuniNames);
    const regioneGuess = guessRegion(`${item.titolo} ${item.snippet}`);
    return {
      ...item,
      id: `news-${idx}-${hashStr(item.link)}`,
      matchedKeywords,
      comuneGuess,
      regioneGuess,
      suggestedAction: suggestAction(blob, matchedKeywords),
    };
  });
}

function hashStr(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function filterRelevantCandidates(
  candidates: NewsCandidate[],
): NewsCandidate[] {
  return candidates.filter((c) => c.matchedKeywords.length > 0);
}

export async function fetchFeedXml(
  url: string,
  timeoutMs = 8000,
): Promise<string> {
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

/** Env `NEWS_RSS_URLS` se impostato, altrimenti catalogo predefinito (nazionale + ANSA 20 regioni + locali campione). */
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

/** Limite articoli per singolo feed quando si scansionano molte sorgenti. */
export function perFeedItemLimit(totalFeeds: number, maxItems: number): number {
  if (totalFeeds <= 0) return maxItems;
  if (totalFeeds === 1) return maxItems;
  return Math.max(
    2,
    Math.min(maxItems, 12, Math.ceil((maxItems * 2.5) / totalFeeds)),
  );
}
