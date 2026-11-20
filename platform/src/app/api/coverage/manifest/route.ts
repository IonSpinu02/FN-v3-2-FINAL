import { NextResponse } from "next/server";
import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import {
  ledgerStorageKind,
  listSourceIngestion,
} from "@/lib/db/decisionLedger";
import { buildCoverageManifest } from "@/lib/engine/coverageManifest";
import { FORECAST_V4_MODEL_ID } from "@/lib/engine/forecastEngineV4";
import { loadNationalForecastEvents } from "@/lib/engine/nationalForecastEventFeed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const newsConsidered = Math.max(0, Number(searchParams.get("newsConsidered") ?? "0") || 0);
  const newsDetected = Math.max(
    newsConsidered,
    Number(searchParams.get("newsDetected") ?? String(newsConsidered)) || newsConsidered,
  );
  const newsExcluded = Math.max(0, newsDetected - newsConsidered);
  const windowStart = searchParams.get("windowStart");
  const windowEnd = searchParams.get("windowEnd");

  const [events, ingestion] = await Promise.all([
    loadNationalForecastEvents(),
    listSourceIngestion(undefined, 60),
  ]);

  const latestByKey = new Map<string, (typeof ingestion)[number]>();
  for (const row of ingestion) {
    if (!latestByKey.has(row.sourceKey)) latestByKey.set(row.sourceKey, row);
  }

  const storage = ledgerStorageKind();
  const sources = ["sondaggi", "rss_osservatorio", "tavily", "calendario_bce"].map(
    (sourceKey) => {
      const row = latestByKey.get(sourceKey);
      const isCalendar = sourceKey === "calendario_bce";
      const usedFallback = isCalendar
        ? events.usedFallback
        : Boolean(row?.usedFallback);
      return {
        sourceKey,
        label:
          sourceKey === "sondaggi"
            ? "Sondaggi / consenso"
            : sourceKey === "rss_osservatorio"
              ? "RSS Osservatorio"
              : sourceKey === "tavily"
                ? "Tavily web"
                : "Calendario BCE",
        lastCheckedAt: row?.checkedAt ?? (isCalendar ? events.checkedAt : null),
        lastNewItemAt: row?.lastNewItemAt ?? null,
        lastRecalcAt: new Date().toISOString(),
        methodVersion: FORECAST_V4_MODEL_ID,
        usedFallback,
        fallbackLabel: usedFallback && isCalendar ? "Catalogo locale di ripiego" : null,
        itemsFetched: row?.itemsFetched ?? (isCalendar ? events.events.length : 0),
        itemsAccepted: row?.itemsAccepted ?? (isCalendar && !events.usedFallback ? events.events.length : 0),
        itemsRejected: row?.itemsRejected ?? 0,
        status: usedFallback
          ? ("fallback" as const)
          : row?.errorMessage
            ? ("stale" as const)
            : row
              ? ("ok" as const)
              : ("missing" as const),
      };
    },
  );

  const manifest = buildCoverageManifest({
    newsConsidered,
    newsDetected,
    newsExcluded,
    windowStart,
    windowEnd,
    calendarSource: events.source,
    sources,
    storage,
  });

  const lastCron = ingestion.find((r) => r.triggerType === "cron")?.checkedAt ?? null;

  return NextResponse.json({
    ok: true,
    manifest,
    cronConfigured: Boolean(process.env.CRON_SECRET?.trim()),
    lastAutonomousRunAt: lastCron,
  });
}
