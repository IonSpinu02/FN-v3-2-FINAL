import { runTavilyDaily } from "@/lib/cache/tavilyDailyGate";
import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import { tavilyMaxResultsPerQuery } from "./tavilyConfig";
import {
  tavilyResultsToRssLike,
  tavilySearchNews,
  type TavilyRssLikeItem,
} from "./tavilyClient";

export type TavilyNewsBatchOptions = {
  maxResultsPerQuery?: number;
  timeRange?: "day" | "week" | "month";
  includeDomains?: string[];
  includeDomainsMode?: "prefer" | "restrict";
};

export type TavilyNewsDailyOptions = TavilyNewsBatchOptions & {
  force?: boolean;
  forceSecret?: string | null;
};

export type TavilyNewsDailyResult = {
  items: TavilyRssLikeItem[];
  meta: TavilyGateMeta;
};

/** Più query news in parallelo, dedup per URL. Fallisce solo se falliscono tutte. */
async function fetchTavilyNewsBatch(
  queries: string[],
  options?: TavilyNewsBatchOptions,
): Promise<TavilyRssLikeItem[]> {
  if (queries.length === 0) return [];

  const perQuery =
    options?.maxResultsPerQuery ??
    Math.max(4, Math.ceil(tavilyMaxResultsPerQuery() / Math.min(queries.length, 6)));

  const settled = await Promise.allSettled(
    queries.map((query) =>
      tavilySearchNews({
        query,
        maxResults: perQuery,
        timeRange: options?.timeRange ?? "week",
        includeDomains: options?.includeDomains,
        includeDomainsMode: options?.includeDomainsMode ?? "prefer",
      }),
    ),
  );

  const failed = settled.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed && settled.every((r) => r.status === "rejected")) {
    throw failed.reason instanceof Error ? failed.reason : new Error("Tavily non raggiungibile");
  }

  const merged = settled.flatMap((r) =>
    r.status === "fulfilled" ? tavilyResultsToRssLike(r.value.results) : [],
  );

  const seen = new Set<string>();
  const unique: TavilyRssLikeItem[] = [];
  for (const row of merged) {
    const key = row.link.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

/**
 * Query news Tavily dietro il gate giornaliero: la prima richiesta del giorno chiama Tavily,
 * tutte le altre (anche con `force`) ricevono la stessa scansione salvata.
 */
export async function fetchTavilyNewsDaily(
  scopeKey: string,
  queries: string[],
  options?: TavilyNewsDailyOptions,
): Promise<TavilyNewsDailyResult> {
  const { data, meta } = await runTavilyDaily<TavilyRssLikeItem[]>({
    scopeKey,
    force: options?.force,
    forceSecret: options?.forceSecret,
    fetcher: () => fetchTavilyNewsBatch(queries, options),
  });
  return { items: data ?? [], meta };
}
