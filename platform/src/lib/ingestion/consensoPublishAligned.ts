import {
  buildConsensusDriversFromLive,
  explanationHashOf,
  isExplanationCachedForHash,
  warmConsensusExplanationIfNeeded,
} from "@/lib/ai/consensusExplanationAgent";
import { bumpPublishedState } from "@/lib/db/publishedStateRepository";
import type { ConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import { buildLiveConsensoPayload } from "@/lib/engine/liveConsensoService";
import { sha256Hex } from "@/lib/engine/sha256Canonical";

export type ConsensoPublishResult = {
  published: boolean;
  explanationHash: string | null;
  errorMessage: string | null;
};

/** Pubblica `published_state.consenso` solo se spiegazione AI è in cache per l'hash corrente. */
export async function publishConsensoIfAligned(
  context: ConsensoLiveContext,
): Promise<ConsensoPublishResult> {
  const live = buildLiveConsensoPayload("auto", {
    pollReleases: context.pollReleases,
    supermediaSeries: context.supermediaSeries,
    feedSyncedAt: context.feedSyncedAt,
  });
  const drivers = buildConsensusDriversFromLive(live, context.pollReleases, []);
  const explanationHash = explanationHashOf(drivers);

  try {
    await warmConsensusExplanationIfNeeded(drivers);
  } catch (e) {
    return {
      published: false,
      explanationHash,
      errorMessage: e instanceof Error ? e.message : "warm explanation failed",
    };
  }

  const cached = await isExplanationCachedForHash(explanationHash);
  if (!cached) {
    return {
      published: false,
      explanationHash,
      errorMessage: "explanation non in cache dopo warm",
    };
  }

  const digest = sha256Hex(
    JSON.stringify({
      explanationHash,
      sPct: live.sPct,
      method: live.method,
      feedSyncedAt: context.feedSyncedAt,
    }),
  );

  const bumped = await bumpPublishedState({
    domain: "consenso",
    computationId: explanationHash,
    digest,
  });

  return {
    published: Boolean(bumped),
    explanationHash,
    errorMessage: bumped ? null : "bump published_state failed",
  };
}