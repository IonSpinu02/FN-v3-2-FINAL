import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { safeWriteDomainCache } from "./domainCacheSafeWrite";

describe("safeWriteDomainCache", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("non scrive payload non valido (SWR: usedFallback)", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const result = await safeWriteDomainCache({
      key: "test:invalid",
      payload: { n: "bad" },
      schema: z.object({ n: z.number() }),
      computedAt: Date.now(),
      expiresAt: null,
      etag: null,
    });
    expect(result.written).toBe(false);
    expect(result.usedFallback).toBe(true);
    expect(result.errorMessage).toBeTruthy();
  });
});