import type { LocalRegistryEntry } from "./localiTypes";
import type { NewsCandidate } from "./localiTypes";

/** Intervallo refresh feed RSS (UI + TTL cache server). */
export const NEWS_RSS_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export const NEWS_SCAN_CACHE_TTL_MS = NEWS_RSS_REFRESH_INTERVAL_MS;

export type NewsScanMeta = {
  feedsChecked: number;
  feedsOnline: number;
  rawItemsRead: number;
  rejectedNoiseCount: number;
  verifiedItemsCount: number;
  timestamp: string;
};

export type NewsScanCachePayload = {
  candidates: NewsCandidate[];
  scannedFeeds: number;
  fromDefaultCatalog: boolean;
  perFeedLimit: number;
  errors?: string[];
  meta?: NewsScanMeta;
};

type CacheEntry = {
  cachedAt: number;
  entriesKey: string;
  payload: NewsScanCachePayload;
};

let memoryCache: CacheEntry | null = null;

function calendarDayItaly(ms: number): string {
  return new Date(ms).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}

export function registryEntriesKey(entries: LocalRegistryEntry[]): string {
  if (!entries.length) return "empty";
  return entries
    .map((e) => e.id)
    .sort()
    .join("|");
}

export function getNewsScanCache(
  entriesKey: string,
  now = Date.now(),
): { payload: NewsScanCachePayload; cachedAt: string } | null {
  if (!memoryCache) return null;
  if (memoryCache.entriesKey !== entriesKey) return null;
  if (now - memoryCache.cachedAt > NEWS_SCAN_CACHE_TTL_MS) return null;
  if (calendarDayItaly(memoryCache.cachedAt) !== calendarDayItaly(now)) {
    return null;
  }
  return {
    payload: memoryCache.payload,
    cachedAt: new Date(memoryCache.cachedAt).toISOString(),
  };
}

export function setNewsScanCache(
  entriesKey: string,
  payload: NewsScanCachePayload,
  now = Date.now(),
): void {
  memoryCache = { cachedAt: now, entriesKey, payload };
}

/** Solo per test Vitest */
export function clearNewsScanCacheForTests(): void {
  memoryCache = null;
}
