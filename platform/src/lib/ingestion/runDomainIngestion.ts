import { z } from "zod";
import { appendSourceIngestion } from "@/lib/db/decisionLedger";
import { bumpPublishedState } from "@/lib/db/publishedStateRepository";
import { sha256Hex } from "@/lib/engine/sha256Canonical";
import {
  CONSENSO_LIVE_SNAPSHOT_KEY,
  CONSENSO_LIVE_SNAPSHOT_TTL_MS,
  resolveConsensoLiveContext,
  type ConsensoLiveContext,
} from "@/lib/engine/consensoLiveContext";
import {
  NEWS_SCAN_CACHE_TTL_MS,
  registryEntriesKey,
  type NewsScanCachePayload,
} from "@/lib/engine/newsScanCache";
import { setTerritoryIssuesCache } from "@/lib/engine/territoryIssuesCache";
import { REGIONS } from "@/lib/engine/constants";
import { resolveTerritoryIssuesHybrid } from "@/lib/engine/territoryIssuesResolver";
import { fetchLiveGoogleTrendsForTerritory } from "@/lib/engine/googleTrendsLiveRss";
import { logStructured } from "@/lib/observability/logger";
import { publishConsensoIfAligned } from "./consensoPublishAligned";
import { safeWriteDomainCache } from "./domainCacheSafeWrite";
import { ingestNewsScanForEntries } from "./newsScanIngestion";
import {
  consensoLiveContextSchema,
  newsScanPayloadSchema,
  territoryIssuesResultSchema,
} from "./validators";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";

const zNewsBundleSchema = z.object({
  cachedAt: z.number(),
  entriesKey: z.string(),
  payload: newsScanPayloadSchema,
});

type IngestOpts = {
  runId: string;
  triggerType: "cron" | "manual";
};

async function logIngest(
  sourceKey: string,
  triggerType: "cron" | "manual",
  runId: string,
  result: {
    usedFallback: boolean;
    errorMessage: string | null;
    itemsFetched: number;
    itemsAccepted: number;
  },
  metadata?: Record<string, unknown>,
) {
  await appendSourceIngestion({
    sourceKey,
    checkedAt: new Date().toISOString(),
    lastNewItemAt: null,
    itemsFetched: result.itemsFetched,
    itemsAccepted: result.itemsAccepted,
    itemsRejected: Math.max(0, result.itemsFetched - result.itemsAccepted),
    usedFallback: result.usedFallback,
    errorMessage: result.errorMessage,
    triggerType,
    metadata: { runId, ...metadata },
  });
}

export async function ingestConsensoDomain(opts: IngestOpts): Promise<void> {
  const started = Date.now();
  let context: ConsensoLiveContext | null = null;
  let errorMessage: string | null = null;

  try {
    context = await resolveConsensoLiveContext({ forceFeed: true });
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "consenso fetch failed";
  }

  if (!context) {
    await logIngest("consenso_live", opts.triggerType, opts.runId, {
      usedFallback: true,
      errorMessage,
      itemsFetched: 0,
      itemsAccepted: 0,
    });
    logStructured({
      event: "ingest_consenso_failed",
      runId: opts.runId,
      domain: "consenso",
      durationMs: Date.now() - started,
      usedFallback: true,
      error: errorMessage,
      level: "warn",
    });
    return;
  }

  const now = Date.now();
  const write = await safeWriteDomainCache({
    key: CONSENSO_LIVE_SNAPSHOT_KEY,
    payload: context,
    schema: consensoLiveContextSchema,
    computedAt: now,
    expiresAt: now + CONSENSO_LIVE_SNAPSHOT_TTL_MS,
    etag: context.feedSyncedAt ?? null,
  });

  let publishError: string | null = null;
  let consensoPublished = false;
  if (write.written) {
    const pub = await publishConsensoIfAligned(context);
    consensoPublished = pub.published;
    publishError = pub.errorMessage;
  }

  await logIngest("consenso_live", opts.triggerType, opts.runId, {
    usedFallback: !write.written || write.usedFallback || !consensoPublished,
    errorMessage: write.errorMessage ?? publishError,
    itemsFetched: context.pollReleases.length,
    itemsAccepted: write.written ? context.pollReleases.length : 0,
  });

  logStructured({
    event: "ingest_consenso",
    runId: opts.runId,
    domain: "consenso",
    durationMs: Date.now() - started,
    usedFallback: !write.written,
    error: write.errorMessage,
  });
}

export async function ingestNewsDomain(
  entries: LocalRegistryEntry[],
  opts: IngestOpts,
): Promise<void> {
  const started = Date.now();
  const entriesKey = registryEntriesKey(entries);
  let payload: NewsScanCachePayload | null = null;
  let errorMessage: string | null = null;

  try {
    payload = await ingestNewsScanForEntries(entries);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : "news scan failed";
  }

  if (!payload) {
    await logIngest("news_scan", opts.triggerType, opts.runId, {
      usedFallback: true,
      errorMessage,
      itemsFetched: 0,
      itemsAccepted: 0,
    }, { entriesKey });
    return;
  }

  const now = Date.now();
  const write = await safeWriteDomainCache({
    key: `news:scan:${entriesKey}`,
    payload: { cachedAt: now, entriesKey, payload },
    schema: zNewsBundleSchema,
    computedAt: now,
    expiresAt: now + NEWS_SCAN_CACHE_TTL_MS,
    etag: entriesKey,
  });

  const digest = sha256Hex(`${entriesKey}:${payload.meta?.timestamp ?? now}`);

  if (write.written) {
    await bumpPublishedState({
      domain: entries.length ? "locali" : "news",
      computationId: entriesKey,
      digest,
    });
  }

  await logIngest("news_scan", opts.triggerType, opts.runId, {
    usedFallback: !write.written || write.usedFallback,
    errorMessage: write.errorMessage ?? errorMessage,
    itemsFetched: payload.candidates.length,
    itemsAccepted: write.written ? payload.candidates.length : 0,
  }, { entriesKey });

  logStructured({
    event: "ingest_news",
    runId: opts.runId,
    domain: entries.length ? "locali" : "news",
    durationMs: Date.now() - started,
    usedFallback: !write.written,
    error: write.errorMessage,
  });
}

export async function ingestTerritoryDomain(opts: IngestOpts): Promise<void> {
  const started = Date.now();
  let warmed = 0;
  const errors: string[] = [];

  for (const region of REGIONS) {
    try {
      const hybrid = await resolveTerritoryIssuesHybrid(region, null, 400_000);
      const check = territoryIssuesResultSchema.safeParse(hybrid);
      if (!check.success) {
        errors.push(`${region}: validation`);
        continue;
      }
      await setTerritoryIssuesCache(region, null, hybrid);
      warmed += 1;
    } catch (e) {
      errors.push(`${region}: ${e instanceof Error ? e.message : "err"}`);
    }
  }

  try {
    const naz = await resolveTerritoryIssuesHybrid("NAZIONALE", null, 0);
    await setTerritoryIssuesCache("NAZIONALE", null, naz);
    warmed += 1;
  } catch (e) {
    errors.push(`NAZIONALE: ${e instanceof Error ? e.message : "err"}`);
  }

  const digest = sha256Hex(`territory:${warmed}:${errors.length}`);
  await bumpPublishedState({
    domain: "supervision",
    computationId: `warm-${warmed}`,
    digest,
  });

  await logIngest("territory_issues", opts.triggerType, opts.runId, {
    usedFallback: errors.length > 0 && warmed === 0,
    errorMessage: errors.length ? errors.slice(0, 3).join(" · ") : null,
    itemsFetched: REGIONS.length + 1,
    itemsAccepted: warmed,
  });

  logStructured({
    event: "ingest_territory",
    runId: opts.runId,
    domain: "supervision",
    durationMs: Date.now() - started,
    usedFallback: warmed === 0,
    error: errors[0] ?? null,
  });
}

export async function ingestGoogleTrendsSample(opts: IngestOpts): Promise<void> {
  const started = Date.now();
  try {
    await fetchLiveGoogleTrendsForTerritory("NAZIONALE");
    await appendSourceIngestion({
      sourceKey: "google_trends_rss",
      checkedAt: new Date().toISOString(),
      lastNewItemAt: new Date().toISOString(),
      itemsFetched: 1,
      itemsAccepted: 1,
      itemsRejected: 0,
      usedFallback: false,
      errorMessage: null,
      triggerType: opts.triggerType,
      metadata: { runId: opts.runId, territory: "NAZIONALE" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "google trends failed";
    await appendSourceIngestion({
      sourceKey: "google_trends_rss",
      checkedAt: new Date().toISOString(),
      lastNewItemAt: null,
      itemsFetched: 0,
      itemsAccepted: 0,
      itemsRejected: 0,
      usedFallback: true,
      errorMessage: msg,
      triggerType: opts.triggerType,
      metadata: { runId: opts.runId },
    });
    logStructured({
      event: "ingest_google_trends_failed",
      runId: opts.runId,
      domain: "supervision",
      durationMs: Date.now() - started,
      usedFallback: true,
      error: msg,
      level: "warn",
    });
  }
}