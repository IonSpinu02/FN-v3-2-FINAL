import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
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
  /** `rss+tavily`: feed RSS a ogni scansione più la ricerca Tavily del giorno. */
  provider?: "rss" | "rss+tavily";
  tavily?: TavilyGateMeta;
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

function domainKey(entriesKey: string): string {
  return `news:scan:${entriesKey}`;
}

export async function getNewsScanCache(
  entriesKey: string,
  now = Date.now(),
): Promise<{ payload: NewsScanCachePayload; cachedAt: string } | null> {
  if (cacheUsesProcessMemory() && memoryCache?.entriesKey === entriesKey) {
    if (now - memoryCache.cachedAt <= NEWS_SCAN_CACHE_TTL_MS) {
      if (calendarDayItaly(memoryCache.cachedAt) === calendarDayItaly(now)) {
        return {
          payload: memoryCache.payload,
          cachedAt: new Date(memoryCache.cachedAt).toISOString(),
        };
      }
    }
  }

  const row = await readDomainCacheEntry<CacheEntry>(domainKey(entriesKey));
  if (!row?.payload) return null;
  const entry = row.payload;
  if (entry.entriesKey !== entriesKey) return null;
  if (now - entry.cachedAt > NEWS_SCAN_CACHE_TTL_MS) return null;
  if (calendarDayItaly(entry.cachedAt) !== calendarDayItaly(now)) return null;

  if (cacheUsesProcessMemory()) {
    memoryCache = entry;
  }
  return {
    payload: entry.payload,
    cachedAt: new Date(entry.cachedAt).toISOString(),
  };
}

export async function setNewsScanCache(
  entriesKey: string,
  payload: NewsScanCachePayload,
  now = Date.now(),
): Promise<void> {
  const entry: CacheEntry = { cachedAt: now, entriesKey, payload };
  if (cacheUsesProcessMemory()) {
    memoryCache = entry;
  }
  await writeDomainCacheEntry({
    key: domainKey(entriesKey),
    payload: entry,
    computedAt: now,
    expiresAt: now + NEWS_SCAN_CACHE_TTL_MS,
    etag: entriesKey,
    sourceStatus: null,
  });
}

/** Solo per test Vitest */
export function clearNewsScanCacheForTests(): void {
  memoryCache = null;
}