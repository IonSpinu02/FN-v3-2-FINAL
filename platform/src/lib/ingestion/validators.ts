import { z } from "zod";

export const pollReleaseSchema = z.object({
  id: z.string().min(1),
  institute: z.string().min(1),
  fieldEnd: z.string().min(8),
  publishedAt: z.string().min(8),
  fnPct: z.number().min(0).max(100),
  sampleSize: z.number().optional(),
  method: z.enum(["CATI", "CAWI", "mixed", "unknown"]).optional(),
  sourceUrl: z.string().optional(),
});

export const supermediaPointSchema = z.object({
  isoDate: z.string().min(8),
  pct: z.number().min(0).max(100),
  caption: z.string(),
  articleUrl: z.string().optional(),
  why: z.string().optional(),
  deltaPp: z.number().optional(),
});

export const consensoLiveContextSchema = z
  .object({
    pollReleases: z.array(pollReleaseSchema),
    supermediaSeries: z.array(supermediaPointSchema),
    feedSyncedAt: z.string().optional(),
  })
  .refine(
    (v) => v.pollReleases.length > 0 || v.supermediaSeries.length > 0,
    { message: "consenso snapshot vuoto" },
  );

export const newsCandidateSchema = z.object({
  id: z.string().min(1),
  titolo: z.string().min(1),
  link: z.string().min(1),
  pubDate: z.string().nullable(),
  snippet: z.string(),
  matchedKeywords: z.array(z.string()),
  feedUrl: z.string().min(1),
});

export const newsScanPayloadSchema = z.object({
  candidates: z.array(newsCandidateSchema),
  scannedFeeds: z.number().int().nonnegative(),
  fromDefaultCatalog: z.boolean(),
  perFeedLimit: z.number().int().positive(),
  errors: z.array(z.string()).optional(),
});

export const territoryIssuesResultSchema = z.object({
  region: z.string().min(1),
  issues: z.array(z.record(z.string(), z.unknown())),
  liveNews: z.array(z.record(z.string(), z.unknown())),
  fetchedAt: z.string().min(8),
  liveCount: z.number().int().nonnegative(),
  catalogCount: z.number().int().nonnegative(),
});

export function parseWithSchema<T>(
  schema: z.ZodType<T>,
  value: unknown,
): { ok: true; data: T } | { ok: false; error: string } {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "validation failed" };
  }
  return { ok: true, data: parsed.data };
}