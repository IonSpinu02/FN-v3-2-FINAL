import { tavilyForceSecretFromRequest } from "@/lib/cache/tavilyDailyGate";
import { resolveViralReels } from "@/lib/news/tavilyViralVideosEngine";
import { VIRAL_CACHE_VERSION } from "@/lib/news/viralVideosCache";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * `mode=cache`: solo dati salvati (mai Tavily). Altrimenti scansione giornaliera:
 * la prima richiesta del giorno chiama Tavily, le altre ricevono la stessa.
 * `force=1` (o i vecchi `refresh=1` / `purge=1`) non scavalca il limite giornaliero,
 * salvo bypass amministrativo.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const force =
    ["1", "true"].includes(searchParams.get("force") ?? "") ||
    searchParams.get("refresh") === "1" ||
    searchParams.get("purge") === "1";

  try {
    const payload = await resolveViralReels(searchParams.get("region"), {
      mode: searchParams.get("mode") === "cache" ? "cache-only" : "daily",
      force,
      forceSecret: tavilyForceSecretFromRequest(req),
    });

    return NextResponse.json(
      {
        ...payload,
        cacheHit: payload.tavily.fromCache,
        cacheVersion: VIRAL_CACHE_VERSION,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore viral reels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
