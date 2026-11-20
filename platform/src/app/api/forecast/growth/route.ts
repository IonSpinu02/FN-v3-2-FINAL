import { loadNationalForecastEvents } from "@/lib/engine/nationalForecastEventFeed";
import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import { FORECAST_V4_MODEL_ID } from "@/lib/engine/forecastEngineV4";
import {
  buildGrowthEvidence,
  isValidNewsHeadline,
  seriesWithCurrentPoint,
} from "@/lib/engine/growthEvidence";
import {
  explainGrowth,
  projectAllHorizons,
  REGIME_SENSITIVITY,
  type GrowthSensitivityId,
} from "@/lib/engine/growthTrajectory";
import { fetchTavilyNewsDaily } from "@/lib/engine/tavilyNewsFetch";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Chiave del gate giornaliero Tavily per le notizie della previsione di crescita. */
const GROWTH_NEWS_SCOPE_KEY = "forecast-growth-news-v4-it-only";

function parseRegime(raw: string | null): GrowthSensitivityId {
  if (raw === "organica" || raw === "massima" || raw === "territori") return raw;
  return "territori";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startPct = Number(searchParams.get("sPct") ?? "6.2");
  const safePct = Number.isFinite(startPct) ? Math.min(40, Math.max(0.5, startPct)) : 6.2;
  const regime = parseRegime(searchParams.get("regime"));

  const [newsResult,live,eventCatalog]=await Promise.all([
    fetchTavilyNewsDaily(
      GROWTH_NEWS_SCOPE_KEY,
      [
        "Italia sicurezza immigrazione criminalità sbarchi",
        "Italia fisco partite IVA bollette energia manovra",
        "Italia caro vita mutui prezzi inflazione famiglie",
        "Italia sanità liste d'attesa ospedali pronto soccorso",
      ],
      { maxResultsPerQuery: 5, timeRange: "month", includeDomainsMode: "prefer" },
    ),
    resolveConsensoLiveContext(),
    loadNationalForecastEvents(),
  ]);
  const news = newsResult.items
    .map((item) => ({
      title: item.titolo,
      url: item.link,
      publishedAt: item.pubDate,
      snippet: item.snippet,
    }))
    .filter((item) => isValidNewsHeadline(item.title, item.url));
  const evidence = buildGrowthEvidence({
    series: seriesWithCurrentPoint(live.supermediaSeries, safePct),
    news,
    polls: live.pollReleases.map((p) => ({
      id: p.id,
      institute: p.institute,
      fieldEnd: p.fieldEnd,
      publishedAt: p.publishedAt,
      fnPct: p.fnPct,
      sampleSize: p.sampleSize,
      sourceUrl: p.sourceUrl,
    })),
  });
  evidence.forecastNews = news;
  evidence.forecastNewsMeta={status:newsResult.meta.status,fetchedAt:newsResult.meta.fetchedAt,nextAllowedRefreshAt:newsResult.meta.nextAllowedRefreshAt};
  evidence.forecastEvents=eventCatalog.events;
  evidence.forecastEventSource=eventCatalog.source;
  evidence.forecastEventUsedFallback=eventCatalog.usedFallback;
  const horizons = projectAllHorizons({
    startPct: safePct,
    evidence,
    sensitivity: REGIME_SENSITIVITY[regime],
  });
  const explanation = explainGrowth({ startPct: safePct, evidence, horizons });
  const narrative = null;

  return NextResponse.json(
    {
      asOf: new Date().toISOString(),
      modelId: FORECAST_V4_MODEL_ID,
      startPct: safePct,
      regime,
      evidence,
      horizons,
      explanation,
      narrative,
    },
    {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    },
  );
}
