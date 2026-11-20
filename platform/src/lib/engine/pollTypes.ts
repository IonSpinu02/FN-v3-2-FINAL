/** Singola rilevazione pubblicata (intenzioni di voto nazionali). */
export type PollRelease = {
  id: string;
  institute: string;
  /** Ultimo giorno fieldwork (ISO date YYYY-MM-DD). */
  fieldEnd: string;
  /** Data pubblicazione su media (ISO). */
  publishedAt: string;
  /** Percentuale Futuro Nazionale (0–100). */
  fnPct: number;
  /** Campione se noto. */
  sampleSize?: number;
  /** CATI | CAWI | mixed | unknown */
  method?: "CATI" | "CAWI" | "mixed" | "unknown";
  sourceUrl?: string;
};

export type ConsensoMethodId = "FN_DAILY_V2" | "FN_AGGREGATE_V1" | "SUPERMEDIA_SYNC" | "MANUAL";

export type LiveConsensoPayload = {
  s: number;
  sPct: number;
  method: ConsensoMethodId;
  reliabilityTier: "ALTA" | "MEDIA";
  asOf: string;
  /** Giorno calendario UTC (YYYY-MM-DD) del valore S. */
  calendarDay?: string;
  /** Ultimo fetch RSS YouTrend riuscito (ISO). */
  feedSyncedAt?: string;
  /** Δ S rispetto al giorno precedente (pp), se noto. */
  dailyDeltaPp?: number | null;
  sourceLabel: string;
  sourceUrl?: string;
  confidenceBandPp: [number, number];
  pollsUsed: Array<{
    institute: string;
    fieldEnd: string;
    fnPct: number;
    weight: number;
    sharePct?: number;
    ageDays?: number;
    sampleSizeUsed?: number | null;
    sampleImputed?: boolean;
    sourceUrl?: string;
  }>;
  supermediaReference?: {
    pct: number;
    isoDate: string;
    caption: string;
  };
  /** Spiegazione del livello attuale rispetto alla rilevazione precedente. */
  movementBrief?: {
    pct: number;
    previousPct: number | null;
    previousIsoDate: string | null;
    deltaPp: number | null;
    isoDate: string;
    headline: string;
    why: string;
    articleUrl?: string;
    formula?: string;
    benchmarkPct?: number | null;
    gapPp?: number | null;
    inputs?: Array<{
      institute: string;
      fieldEnd: string;
      fnPct: number;
      weight: number;
    }>;
    sources?: Array<{ label: string; url: string }>;
  };
  aggregateReference?: {
    pct: number;
    pollCount: number;
    windowDays: number;
  };
};
