"use client";

import {
  buildTargetedTrendsForTerritory,
  sortTrendsByAttention,
  withRelativeDisplayIndices,
  type TargetedTrendItem,
  type TrendsTerritoryMode,
} from "@/lib/googleTrendsIntelligence";
import { useEffect, useMemo, useState } from "react";

export function useLiveGoogleTrends(territory: TrendsTerritoryMode) {
  const catalogTrends = useMemo(
    () =>
      withRelativeDisplayIndices(
        sortTrendsByAttention(buildTargetedTrendsForTerritory(territory)),
      ),
    [territory],
  );

  const [trends, setTrends] = useState<TargetedTrendItem[]>(catalogTrends);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [source, setSource] = useState<"google_rss" | "fallback">("fallback");

  useEffect(() => {
    setTrends(catalogTrends);
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/google-trends?region=${encodeURIComponent(territory)}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          trends?: TargetedTrendItem[];
          fetchedAt?: string;
          source?: "google_rss";
        };
        if (cancelled) return;
        if (res.ok && data.trends?.length) {
          setTrends(withRelativeDisplayIndices(data.trends));
          setFetchedAt(data.fetchedAt ?? null);
          setSource(data.source ?? "google_rss");
        } else {
          setTrends(catalogTrends);
          setSource("fallback");
        }
      } catch {
        if (!cancelled) {
          setTrends(catalogTrends);
          setSource("fallback");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [territory, catalogTrends]);

  return { trends, loading, fetchedAt, source };
}
