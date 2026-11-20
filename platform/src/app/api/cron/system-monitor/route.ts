import { NextResponse } from "next/server";
import {
  appendDecisionSnapshot,
  appendSourceIngestion,
  ledgerStorageKind,
} from "@/lib/db/decisionLedger";
import { loadNationalForecastEvents } from "@/lib/engine/nationalForecastEventFeed";
import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import { FORECAST_V4_MODEL_ID } from "@/lib/engine/forecastEngineV4";
import { CALIBRATION_VERSION } from "@/lib/engine/computationFingerprint";
import { buildCoverageManifest } from "@/lib/engine/coverageManifest";
import { ingestObservatoryRss } from "@/lib/engine/cronSourceIngestion";
import {
  authorizeCronRequest,
  isCronSecretConfigured,
} from "@/lib/security/cronAuth";
import {
  buildConsensusDriversFromLive,
  warmConsensusExplanationIfNeeded,
} from "@/lib/ai/consensusExplanationAgent";
import { buildLiveConsensoPayload } from "@/lib/engine/liveConsensoService";
import type { PollRelease } from "@/lib/engine/pollTypes";
import { pruneExpiredRateLimitRows } from "@/lib/api/rateLimit";
import { verifyLedgerIntegrity } from "@/lib/db/decisionLedger";
import { dispatchAlertIfAllowed } from "@/lib/security/alertDispatcher";
import { detectConsecutiveIngestionFailures } from "@/lib/security/ingestionHealth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = authorizeCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.error,
        secretConfigured: auth.secretConfigured,
        cronConfigured: isCronSecretConfigured(),
      },
      { status: auth.status },
    );
  }

  const triggerType =
    req.headers.get("x-vercel-cron") != null ? "cron" : "manual";
  const checkedAt = new Date().toISOString();
  const storage = ledgerStorageKind();

  const [eventsResult, consenso, rssResult] = await Promise.all([
    loadNationalForecastEvents(),
    resolveConsensoLiveContext().catch((err) => ({
      error: err instanceof Error ? err.message : "consenso failed",
      pollReleases: [] as Array<{ id?: string; publishedAt?: string; fieldEnd?: string }>,
      supermediaSeries: [] as Array<{ isoDate: string; pct: number }>,
      feedSyncedAt: null as string | null,
    })),
    ingestObservatoryRss(),
  ]);

  const polls = "pollReleases" in consenso ? consenso.pollReleases : [];
  const lastPollAt =
    polls
      .map((p) => (p.publishedAt ?? p.fieldEnd)?.slice(0, 10))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const pollsIngestion = await appendSourceIngestion({
    sourceKey: "sondaggi",
    checkedAt,
    lastNewItemAt: lastPollAt,
    itemsFetched: polls.length,
    itemsAccepted: polls.length,
    itemsRejected: 0,
    usedFallback: false,
    errorMessage: "error" in consenso ? String(consenso.error) : null,
    triggerType: triggerType as "cron" | "manual",
    metadata: {
      feedSyncedAt: "feedSyncedAt" in consenso ? consenso.feedSyncedAt : null,
    },
  });

  const calendarIngestion = await appendSourceIngestion({
    sourceKey: "calendario_bce",
    checkedAt: eventsResult.checkedAt,
    lastNewItemAt: eventsResult.events.map((e) => e.date).sort().at(-1) ?? null,
    itemsFetched: eventsResult.events.length,
    itemsAccepted: eventsResult.usedFallback ? 0 : eventsResult.events.length,
    itemsRejected: 0,
    usedFallback: eventsResult.usedFallback,
    errorMessage: eventsResult.errorMessage,
    triggerType: triggerType as "cron" | "manual",
    metadata: { source: eventsResult.source },
  });

  const rssIngestion = await appendSourceIngestion({
    sourceKey: "rss_osservatorio",
    checkedAt,
    lastNewItemAt: rssResult.lastNewItemAt,
    itemsFetched: rssResult.itemsFetched,
    itemsAccepted: rssResult.itemsAccepted,
    itemsRejected: rssResult.itemsRejected,
    usedFallback: rssResult.usedFallback,
    errorMessage: rssResult.errorMessage,
    triggerType: triggerType as "cron" | "manual",
    metadata: {
      feedsChecked: rssResult.feedsChecked,
      sampleTitles: rssResult.titles.slice(0, 5),
    },
  });

  const coverage = buildCoverageManifest({
    newsConsidered: Math.min(24, rssResult.itemsAccepted),
    newsDetected: rssResult.itemsFetched,
    newsExcluded: rssResult.itemsRejected,
    calendarSource: eventsResult.source,
    storage,
    sources: [
      {
        sourceKey: "sondaggi",
        label: "Sondaggi / consenso",
        lastCheckedAt: pollsIngestion.checkedAt,
        lastNewItemAt: pollsIngestion.lastNewItemAt,
        lastRecalcAt: checkedAt,
        methodVersion: FORECAST_V4_MODEL_ID,
        usedFallback: pollsIngestion.usedFallback,
        itemsFetched: pollsIngestion.itemsFetched,
        itemsAccepted: pollsIngestion.itemsAccepted,
        itemsRejected: pollsIngestion.itemsRejected,
        status: pollsIngestion.errorMessage ? "stale" : "ok",
      },
      {
        sourceKey: "calendario_bce",
        label: "Calendario BCE",
        lastCheckedAt: calendarIngestion.checkedAt,
        lastNewItemAt: calendarIngestion.lastNewItemAt,
        lastRecalcAt: checkedAt,
        methodVersion: FORECAST_V4_MODEL_ID,
        usedFallback: calendarIngestion.usedFallback,
        fallbackLabel: calendarIngestion.usedFallback
          ? "Catalogo locale di ripiego"
          : null,
        itemsFetched: calendarIngestion.itemsFetched,
        itemsAccepted: calendarIngestion.itemsAccepted,
        itemsRejected: calendarIngestion.itemsRejected,
        status: calendarIngestion.usedFallback ? "fallback" : "live",
      },
      {
        sourceKey: "rss_osservatorio",
        label: "RSS / Osservatorio",
        lastCheckedAt: rssIngestion.checkedAt,
        lastNewItemAt: rssIngestion.lastNewItemAt,
        lastRecalcAt: checkedAt,
        methodVersion: FORECAST_V4_MODEL_ID,
        usedFallback: rssIngestion.usedFallback,
        itemsFetched: rssIngestion.itemsFetched,
        itemsAccepted: rssIngestion.itemsAccepted,
        itemsRejected: rssIngestion.itemsRejected,
        status: rssIngestion.errorMessage ? "stale" : "ok",
      },
    ],
  });

  const dayKey = checkedAt.slice(0, 10);
  const hasNew =
    polls.length > 0 ||
    rssResult.itemsAccepted > 0 ||
    eventsResult.usedFallback ||
    eventsResult.source === "official-calendar";

  let snapshot = null;
  if (hasNew) {
    snapshot = await appendDecisionSnapshot({
      computationId: `cmp_cron_${dayKey}_${eventsResult.source}`,
      emittedAt: checkedAt,
      engineVersion: FORECAST_V4_MODEL_ID,
      calibrationStateJson: { calibrationVersion: CALIBRATION_VERSION },
      inputsManifestJson: {
        pollsCount: polls.length,
        lastPollAt,
        calendarSource: eventsResult.source,
        usedFallback: eventsResult.usedFallback,
        rssAccepted: rssResult.itemsAccepted,
        coverage,
      },
      assumptionsJson: {
        triggerType,
        note: "Snapshot autonomo system-monitor (indipendente dal browser).",
      },
      outputsJson: {
        eventsCount: eventsResult.events.length,
        supermediaPoints:
          "supermediaSeries" in consenso ? consenso.supermediaSeries.length : 0,
        rssTitlesSample: rssResult.titles.slice(0, 8),
      },
    });
  }

  let consensusExplanationWarm: {
    warmed: boolean;
    explanationHash: string;
  } | null = null;
  try {
    if ("pollReleases" in consenso && !("error" in consenso)) {
      const releases = consenso.pollReleases as PollRelease[];
      const live = buildLiveConsensoPayload("auto", {
        pollReleases: releases,
        supermediaSeries: consenso.supermediaSeries,
        feedSyncedAt: consenso.feedSyncedAt ?? undefined,
      });
      const drivers = buildConsensusDriversFromLive(live, releases);
      consensusExplanationWarm = await warmConsensusExplanationIfNeeded(drivers);
    }
  } catch (err) {
    console.warn("[system-monitor] consensus explanation warm failed:", err);
  }

  const [ledgerIntegrity, ingestionAlerts, rateLimitPruned] = await Promise.all([
    verifyLedgerIntegrity(),
    detectConsecutiveIngestionFailures(2),
    pruneExpiredRateLimitRows(),
  ]);

  const alertDispatches: Array<{
    alertKey: string;
    result: Awaited<ReturnType<typeof dispatchAlertIfAllowed>>;
  }> = [];

  if (!ledgerIntegrity.ok) {
    const broken = ledgerIntegrity.brokenAt;
    alertDispatches.push({
      alertKey: `ledger_integrity:${broken?.id ?? "unknown"}`,
      result: await dispatchAlertIfAllowed({
        alertKey: `ledger_integrity:${broken?.table ?? "ledger"}:${broken?.id ?? "unknown"}`,
        title: "Futuro Nazionale — integrità ledger compromessa",
        severity: "critical",
        details: { ledgerIntegrity },
      }),
    });
  }

  for (const alert of ingestionAlerts) {
    alertDispatches.push({
      alertKey: `ingestion:${alert.sourceKey}`,
      result: await dispatchAlertIfAllowed({
        alertKey: `ingestion_streak:${alert.sourceKey}:${alert.consecutiveFailures}`,
        title: `Futuro Nazionale — ingestione ${alert.sourceKey} in errore`,
        severity: "warning",
        details: { ...alert },
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    storage,
    checkedAt,
    triggerType,
    cronConfigured: true,
    lastAutonomousRunAt: checkedAt,
    coverage,
    ingestion: {
      polls: pollsIngestion,
      calendar: calendarIngestion,
      rss: rssIngestion,
    },
    snapshotId: snapshot?.id ?? null,
    consensusExplanationWarm,
    health: {
      ledgerIntegrity,
      ingestionAlerts,
      rateLimitPruned,
      alerts: alertDispatches,
    },
  });
}
