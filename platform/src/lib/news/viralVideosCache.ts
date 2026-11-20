import type { ViralVideoItem } from "./viralVideoTypes";

/** Bump: rielabora la scansione salvata (filtri, testi) senza nuove chiamate Tavily. */
export const VIRAL_CACHE_VERSION = "v6-batch-nazionale";

const processed = new Map<string, Promise<ViralVideoItem[]>>();

/**
 * Filtri, oEmbed TikTok e script girano una volta per scansione Tavily (`fetchedAt`),
 * non a ogni richiesta o cambio regione.
 */
export function memoProcessedViralItems(
  fetchedAt: string,
  build: () => Promise<ViralVideoItem[]>,
): Promise<ViralVideoItem[]> {
  const key = `${VIRAL_CACHE_VERSION}::${fetchedAt}`;
  const existing = processed.get(key);
  if (existing) return existing;
  processed.clear();
  const job = build().catch((e: unknown) => {
    processed.delete(key);
    throw e;
  });
  processed.set(key, job);
  return job;
}

export function clearProcessedViralItems(): void {
  processed.clear();
}
