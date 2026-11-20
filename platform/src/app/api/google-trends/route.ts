import { fetchLiveGoogleTrendsForTerritory } from "@/lib/engine/googleTrendsLiveRss";
import { normalizeTerritoryQueryRegion } from "@/lib/engine/territoryIssuesEngine";
import type { TrendsTerritoryMode } from "@/lib/googleTrendsIntelligence";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regionParam = searchParams.get("region");
  const territory = normalizeTerritoryQueryRegion(
    regionParam,
  ) as TrendsTerritoryMode;

  try {
    const { items, fetchedAt, source } = await fetchLiveGoogleTrendsForTerritory(
      territory,
    );
    return Response.json({
      territory,
      fetchedAt,
      source,
      count: items.length,
      trends: items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore Google Trends";
    return Response.json({ error: message, trends: [] }, { status: 502 });
  }
}
