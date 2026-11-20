import { getStaleOrFresh, setCache } from "@/lib/db/domainCacheRepository";
import type { DomainCacheSourceStatus } from "@/lib/db/domainCacheRepository";
import type { z } from "zod";
import { parseWithSchema } from "./validators";

export type SafeWriteResult = {
  written: boolean;
  usedFallback: boolean;
  errorMessage: string | null;
};

export async function safeWriteDomainCache<T>(input: {
  key: string;
  payload: unknown;
  schema: z.ZodType<T>;
  computedAt: number;
  expiresAt: number | null;
  etag: string | null;
}): Promise<SafeWriteResult> {
  const parsed = parseWithSchema(input.schema, input.payload);
  if (!parsed.ok) {
    return {
      written: false,
      usedFallback: true,
      errorMessage: parsed.error,
    };
  }

  const stale = await getStaleOrFresh<T>(input.key);
  const sourceStatus: DomainCacheSourceStatus = {
    usedFallback: false,
    errorMessage: null,
  };

  const ok = await setCache({
    key: input.key,
    payload: parsed.data,
    computedAt: input.computedAt,
    expiresAt: input.expiresAt,
    etag: input.etag,
    sourceStatus,
  });

  if (!ok) {
    return {
      written: false,
      usedFallback: Boolean(stale),
      errorMessage: stale ? "persist failed; kept previous snapshot" : "persist failed",
    };
  }

  return { written: true, usedFallback: false, errorMessage: null };
}