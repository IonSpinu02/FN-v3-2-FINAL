import type { TavilyGateMeta } from "@/lib/cache/tavilyDailyMeta";
import type { Region } from "@/lib/engine/constants";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { DistressPillarId } from "./viralDistressPillars";

export type ViralPlatform = "tiktok" | "instagram" | "youtube_shorts";

export type ViralVideoScope = Region | "NAZIONALE";

export type CommentSentiment =
  | "RABBIA SOCIALE"
  | "ATTACCO / PROVOCAZIONE"
  | "SOSTEGNO"
  | "POLARIZZATO";

export type ViralVideoItem = {
  id: string;
  platform: ViralPlatform;
  url: string;
  title: string;
  description: string;
  authorHandle: string;
  authorName: string | null;
  thumbnailUrl: string | null;
  locality: string;
  regione: ViralVideoScope;
  viewsCount: number;
  viewsFormatted: string;
  viewsEstimated: boolean;
  likesCount: number;
  likesFormatted: string;
  commentsCount: number;
  commentsFormatted: string;
  viralScore: number;
  bipLever: string;
  bipCapRef: string;
  scriptRispostaVideo: string;
  category: TerritoryIssueCategory;
  /** Filoni disagio: DISABILITÀ, TASSE, SANITÀ, … */
  distressPillarId: DistressPillarId;
  distressLabel: string;
  source: "tavily" | "fallback" | "oembed";
  topUserComment: string;
  commentSentiment: CommentSentiment;
  commentMoodBadge: string;
  sentimentProPct: number;
  sentimentControPct: number;
  /** Opportunità elettorale per Vannacci (1 riga). */
  staffDiagnosis: string;
};

export type ViralReelsPayload = {
  region: ViralVideoScope;
  items: ViralVideoItem[];
  fetchedAt: string;
  cacheHit: boolean;
  source: "tavily" | "fallback" | "mixed";
  /** Chiamate Tavily fatte da questa richiesta (0 quando i dati sono quelli salvati). */
  queryCount: number;
  error?: string;
  tavily: TavilyGateMeta;
};
