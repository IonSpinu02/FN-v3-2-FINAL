import {
  isTavilyEnabled,
  parseTavilyDomainList,
  tavilyApiKey,
  tavilyMaxResultsPerQuery,
} from "./tavilyConfig";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string | null;
};

export type TavilySearchResponse = {
  query: string;
  results: TavilySearchResult[];
  response_time?: number;
};

export type TavilyNewsSearchOptions = {
  query: string;
  maxResults?: number;
  timeRange?: "day" | "week" | "month";
  includeDomains?: string[];
  /** `prefer` = boost domini trust; `restrict` = solo quei domini */
  includeDomainsMode?: "prefer" | "restrict";
  fetchImpl?: typeof fetch;
};

export type TavilyRawResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string | null;
};

function pubDateFromTavily(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Unico punto che chiama api.tavily.com. Va usato solo dentro il `fetcher` di
 * `runTavilyDaily` (`@/lib/cache/tavilyDailyGate`): lo verifica tavilyDailyGate.test.ts.
 */
export async function tavilySearchRaw(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<{ results: TavilyRawResult[]; response_time?: number }> {
  const apiKey = tavilyApiKey();
  if (!apiKey || !isTavilyEnabled()) return { results: [] };

  const res = await fetchImpl(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily HTTP ${res.status}${text ? `: ${text.slice(0, 120)}` : ""}`);
  }

  const json = (await res.json()) as { results?: TavilyRawResult[]; response_time?: number };
  return { results: json.results ?? [], response_time: json.response_time };
}

export async function tavilySearchNews(
  options: TavilyNewsSearchOptions,
): Promise<TavilySearchResponse> {
  const maxResults = Math.min(
    20,
    options.maxResults ?? tavilyMaxResultsPerQuery(),
  );
  const includeDomains =
    options.includeDomains ?? parseTavilyDomainList(process.env.TAVILY_INCLUDE_DOMAINS);

  const body = {
    query: options.query,
    topic: "news" as const,
    search_depth: "basic" as const,
    max_results: maxResults,
    time_range: options.timeRange ?? "week",
    include_published_date: true,
    filter_by_published_date: false,
    include_domains: includeDomains,
    include_domains_mode: options.includeDomainsMode ?? "prefer",
    language: "it",
  };

  const json = await tavilySearchRaw(body, options.fetchImpl ?? fetch);

  const results: TavilySearchResult[] = json.results
    .filter((r) => r.title && r.url)
    .map((r) => ({
      title: r.title!.trim(),
      url: r.url!.trim(),
      content: (r.content ?? "").trim(),
      score: r.score,
      published_date: pubDateFromTavily(r.published_date),
    }));

  return {
    query: options.query,
    results,
    response_time: json.response_time,
  };
}

/** Formato compatibile con `parseRssItems` / radar territorio. */
export type TavilyRssLikeItem = {
  titolo: string;
  link: string;
  pubDate: string | null;
  snippet: string;
  feedUrl: string;
};

export const TAVILY_FEED_URL = "tavily://news/search";

export function tavilyResultsToRssLike(
  results: TavilySearchResult[],
): TavilyRssLikeItem[] {
  return results.map((r) => ({
    titolo: r.title,
    link: r.url,
    pubDate: r.published_date ?? null,
    snippet: r.content.slice(0, 480),
    feedUrl: TAVILY_FEED_URL,
  }));
}
