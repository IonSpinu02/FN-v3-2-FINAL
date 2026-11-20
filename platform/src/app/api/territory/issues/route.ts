import { getStaleOrFresh } from "@/lib/db/domainCacheRepository";
import { getPublishedState } from "@/lib/db/publishedStateRepository";
import {
  ifNoneMatchHit,
  jsonWithEtag,
  notModifiedResponse,
  publishedEtag,
} from "@/lib/api/etagRead";
import { normalizeTerritoryQueryRegion } from "@/lib/engine/territoryIssuesEngine";
import { filterTerritoryIssuesPayload } from "@/lib/engine/territoryIssuesReadFilter";
import type { TerritoryIssuesHybridResult } from "@/lib/engine/territoryIssuesResolver";
import { logStructured } from "@/lib/observability/logger";
import type { Region } from "@/lib/engine/constants";
import { TERRITORY_ISSUES_READ_FILTER_VERSION } from "@/lib/engine/territoryIssuesReadFilter";

export const dynamic = "force-dynamic";

const CACHE_SCHEMA = `${TERRITORY_ISSUES_READ_FILTER_VERSION}-staff-lever`;

type CacheEntry = {
  cachedAt: number;
  payload: TerritoryIssuesHybridResult;
};

function cacheKey(region: Region | "NAZIONALE", category: string | null): string {
  return `${CACHE_SCHEMA}::${region}::${category ?? "ALL"}`;
}

function domainKey(region: Region | "NAZIONALE", category: string | null): string {
  return `territory:issues:${cacheKey(region, category)}`;
}

function emptyTerritoryPayload(
  region: Region | "NAZIONALE",
  category: string | null,
): TerritoryIssuesHybridResult {
  return {
    region,
    category: category as TerritoryIssuesHybridResult["category"],
    issues: [],
    liveNews: [],
    fetchedAt: new Date().toISOString(),
    liveCount: 0,
    catalogCount: 0,
  };
}

export async function GET(req: Request) {
  const started = Date.now();
  const { searchParams } = new URL(req.url);
  const regionParam = searchParams.get("region");
  const category = searchParams.get("category");

  const region = normalizeTerritoryQueryRegion(regionParam);
  const published = await getPublishedState("supervision");
  const etag = publishedEtag(published, `"territory-${cacheKey(region, category)}"`);

  if (ifNoneMatchHit(req, etag)) {
    return notModifiedResponse(etag);
  }

  try {
    const row = await getStaleOrFresh<CacheEntry>(domainKey(region, category));
    const payload = filterTerritoryIssuesPayload(
      row?.entry.payload.payload ?? emptyTerritoryPayload(region, category),
    );

    const cachedAt = row?.entry.payload.cachedAt
      ? new Date(row.entry.payload.cachedAt).toISOString()
      : undefined;

    const body =
      row != null
        ? {
            ...payload,
            cacheHit: !row.stale,
            cachedAt: cachedAt ?? new Date(row.entry.computedAt).toISOString(),
          }
        : payload;

    logStructured({
      event: "read_territory_issues",
      domain: "supervision",
      durationMs: Date.now() - started,
      usedFallback: !row || row.stale,
    });

    return jsonWithEtag(body, etag);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore radar territorio";
    return Response.json({ error: message }, { status: 500 });
  }
}