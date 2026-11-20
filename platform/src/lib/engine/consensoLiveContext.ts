import { defaultMergedSupermediaSeries } from "./consensoSupermediaCatalog";
import { fetchYouTrendSupermediaFnPoints } from "./consensoYouTrendIngest";
import { fetchPollyticoPollArchive } from "./pollyticoPollArchive";
import { fetchYouTrendPollArchive } from "./youTrendPollArchive";
import { loadJson } from "./loadData";
import type { PollRelease } from "./pollTypes";
import type { FnSupermediaPollPoint } from "@/lib/fnSupermediaConsensoSeries";

type PollReleasesFile = { releases: PollRelease[] };

export type ConsensoLiveContext = {
  pollReleases: PollRelease[];
  supermediaSeries: FnSupermediaPollPoint[];
  feedSyncedAt?: string;
};

function loadPollReleases(): PollRelease[] {
  try {
    const file = loadJson<PollReleasesFile>("poll_releases.json");
    return file.releases ?? [];
  } catch {
    return [];
  }
}

/** Unisce per `id`; `secondary` sovrascrive (fonte più fresca / completa). */
export function mergePollReleases(
  primary: PollRelease[],
  secondary: PollRelease[],
): PollRelease[] {
  const byId = new Map<string, PollRelease>();
  for (const row of primary) byId.set(row.id, row);
  for (const row of secondary) byId.set(row.id, row);
  return [...byId.values()];
}

/**
 * Sondaggi grezzi: archivio YouTrend (se auth/ok) + Pollytico pubblico + seed locale.
 * Il seed locale entra sempre; le fonti live sovrascrivono gli stessi `id`.
 */
export async function resolveConsensoLiveContext(options?: {
  forceFeed?: boolean;
}): Promise<ConsensoLiveContext> {
  let feedSyncedAt: string | undefined;
  let ingested: FnSupermediaPollPoint[] = [];
  let youTrendArchive: PollRelease[] = [];
  let pollyticoArchive: PollRelease[] = [];
  try {
    const feed = await fetchYouTrendSupermediaFnPoints({
      force: options?.forceFeed,
    });
    ingested = feed.points;
    feedSyncedAt = feed.fetchedAt;
  } catch {
    ingested = [];
  }
  try {
    youTrendArchive = await fetchYouTrendPollArchive({
      force: options?.forceFeed,
    });
  } catch {
    youTrendArchive = [];
  }
  try {
    pollyticoArchive = await fetchPollyticoPollArchive({
      force: options?.forceFeed,
    });
  } catch {
    pollyticoArchive = [];
  }

  const curated = loadPollReleases();
  const live = mergePollReleases(youTrendArchive, pollyticoArchive);
  const pollReleases = mergePollReleases(curated, live);

  return {
    pollReleases,
    supermediaSeries: defaultMergedSupermediaSeries(ingested),
    feedSyncedAt,
  };
}

/** Solo seed locale — nessun fetch esterno (read API / fallback). */
export function loadConsensoLiveContextFromSeed(): ConsensoLiveContext {
  return {
    pollReleases: loadPollReleases(),
    supermediaSeries: defaultMergedSupermediaSeries([]),
  };
}

export const CONSENSO_LIVE_SNAPSHOT_KEY = "consenso:live:snapshot";
export const CONSENSO_LIVE_SNAPSHOT_TTL_MS = 30 * 60 * 1000;
