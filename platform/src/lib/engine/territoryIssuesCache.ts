import { cacheUsesProcessMemory } from "@/lib/cache/cachePolicy";
import {
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { Region } from "./constants";
import { REGIONS } from "./constants";
import type { TerritoryIssuesHybridResult } from "./territoryIssuesResolver";
import {
  filterTerritoryIssuesPayload,
  TERRITORY_ISSUES_READ_FILTER_VERSION,
} from "./territoryIssuesReadFilter";

export const TERRITORY_ISSUES_CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
  cachedAt: number;
  payload: TerritoryIssuesHybridResult;
};

const memoryByRegion = new Map<string, CacheEntry>();

/** Bump quando cambia forma payload o regole di astensione (invalida RAM sporca). */
const CACHE_SCHEMA = `${TERRITORY_ISSUES_READ_FILTER_VERSION}-staff-lever`;

function cacheKey(region: Region | "NAZIONALE", category: string | null): string {
  return `${CACHE_SCHEMA}::${region}::${category ?? "ALL"}`;
}

function domainKey(region: Region | "NAZIONALE", category: string | null): string {
  return `territory:issues:${cacheKey(region, category)}`;
}

export async function getTerritoryIssuesCache(
  region: Region | "NAZIONALE",
  category: string | null,
  now = Date.now(),
): Promise<{ payload: TerritoryIssuesHybridResult; cachedAt: string } | null> {
  const key = cacheKey(region, category);

  if (cacheUsesProcessMemory()) {
    const mem = memoryByRegion.get(key);
    if (mem && now - mem.cachedAt <= TERRITORY_ISSUES_CACHE_TTL_MS) {
      const cleaned = filterTerritoryIssuesPayload(mem.payload);
      memoryByRegion.set(key, { cachedAt: mem.cachedAt, payload: cleaned });
      return {
        payload: cleaned,
        cachedAt: new Date(mem.cachedAt).toISOString(),
      };
    }
  }

  const row = await readDomainCacheEntry<CacheEntry>(domainKey(region, category));
  if (!row?.payload) return null;
  if (now - row.payload.cachedAt > TERRITORY_ISSUES_CACHE_TTL_MS) return null;

  const cleaned = filterTerritoryIssuesPayload(row.payload.payload);
  const entry = { cachedAt: row.payload.cachedAt, payload: cleaned };
  if (cacheUsesProcessMemory()) {
    memoryByRegion.set(key, entry);
  }
  return {
    payload: cleaned,
    cachedAt: new Date(entry.cachedAt).toISOString(),
  };
}

export async function setTerritoryIssuesCache(
  region: Region | "NAZIONALE",
  category: string | null,
  payload: TerritoryIssuesHybridResult,
  now = Date.now(),
): Promise<void> {
  const key = cacheKey(region, category);
  const filtered = filterTerritoryIssuesPayload(payload);
  const entry: CacheEntry = { cachedAt: now, payload: filtered };

  if (cacheUsesProcessMemory()) {
    memoryByRegion.set(key, entry);
  }

  await writeDomainCacheEntry({
    key: domainKey(region, category),
    payload: entry,
    computedAt: now,
    expiresAt: now + TERRITORY_ISSUES_CACHE_TTL_MS,
    etag: key,
    sourceStatus: null,
  });
}

export async function warmAllRegionsTerritoryIssues(
  resolver: (
    region: string,
    category: null,
    validVotes: number,
  ) => Promise<TerritoryIssuesHybridResult>,
): Promise<{ warmed: number; errors: string[] }> {
  const errors: string[] = [];
  let warmed = 0;
  for (const region of REGIONS) {
    try {
      const payload = await resolver(region, null, 400_000);
      await setTerritoryIssuesCache(region, null, payload);
      warmed += 1;
    } catch (e) {
      errors.push(
        `${region}: ${e instanceof Error ? e.message : "errore warm"}`,
      );
    }
  }
  try {
    const nazPayload = await resolver("NAZIONALE", null, 0);
    await setTerritoryIssuesCache("NAZIONALE", null, nazPayload);
    warmed += 1;
  } catch (e) {
    errors.push(
      `NAZIONALE: ${e instanceof Error ? e.message : "errore warm"}`,
    );
  }
  return { warmed, errors };
}

export function clearTerritoryIssuesCacheForTests(): void {
  memoryByRegion.clear();
}