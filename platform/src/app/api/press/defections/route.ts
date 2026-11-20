import { tavilyForceSecretFromRequest } from "@/lib/cache/tavilyDailyGate";
import { fetchCameraLeg19GroupChanges } from "@/lib/politicalDefectionsCameraSparql";
import {
  CATALOG_POLITICIANS_FOR_NEWS,
  RASSEGNA_DEFECTION_POLITICIANS,
} from "@/lib/politicalDefectionsCatalog";
import {
  computeAggregates,
  computeSimulatorAggregates,
  type TrackedPolitician,
} from "@/lib/politicalDefectionsEngine";
import { fetchLiveDefectionNews } from "@/lib/politicalDefectionsLiveRss";
import { mergePoliticiansWithCameraLive } from "@/lib/politicalDefectionsMerge";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** `force=1` chiede una nuova scansione Tavily: bloccata se quella di oggi è già fatta (salvo bypass). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force = ["1", "true"].includes(searchParams.get("force") ?? "");

  const [{ changes, fetchedAt: cameraAt, source: cameraSource }, newsBundle] =
    await Promise.all([
      fetchCameraLeg19GroupChanges(),
      fetchLiveDefectionNews(CATALOG_POLITICIANS_FOR_NEWS, {
        force,
        forceSecret: tavilyForceSecretFromRequest(req),
      }),
    ]);

  const politicians: TrackedPolitician[] = mergePoliticiansWithCameraLive(
    RASSEGNA_DEFECTION_POLITICIANS,
    changes,
  );

  const aggregates = computeAggregates(politicians);
  const simulator = computeSimulatorAggregates(politicians, new Set());

  return NextResponse.json(
    {
      politicians,
      news: newsBundle.news,
      aggregates,
      simulator,
      meta: {
        camera: { fetchedAt: cameraAt, source: cameraSource, changeCount: changes.length },
        news: {
          fetchedAt: newsBundle.fetchedAt,
          source: newsBundle.source,
          rssCount: newsBundle.rssCount,
          tavilyCount: newsBundle.tavilyCount,
          tavily: newsBundle.tavily,
        },
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
