import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRateLimitHeaders,
  checkRateLimit,
  clearRateLimitMemoryForTests,
  consumeRateLimit,
  rateLimitUnavailableResponse,
  retryAfterSeconds,
} from "./rateLimit";

describe("rateLimit", () => {
  afterEach(() => {
    clearRateLimitMemoryForTests();
    vi.unstubAllEnvs();
  });

  it("applyRateLimitHeaders imposta Remaining e Retry-After su 429", () => {
    const resetAt = Date.now() + 45_000;
    const headers = applyRateLimitHeaders(
      undefined,
      { allowed: false, remaining: 0, resetAt },
      { limited: true },
    );
    expect(headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(Number(headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(retryAfterSeconds(resetAt)).toBeGreaterThanOrEqual(1);
  });

  it("in dev senza DB usa RAM e decrementa remaining", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "");
    const a = await consumeRateLimit("test:127.0.0.1", 3, 60_000);
    expect(a.kind).toBe("ok");
    if (a.kind !== "ok") return;
    expect(a.result.allowed).toBe(true);
    expect(a.result.remaining).toBe(2);
  });

  it("in production senza backend restituisce unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const outcome = await consumeRateLimit("prod:1", 10, 60_000);
    expect(outcome.kind).toBe("unavailable");
  });

  it("checkRateLimit unavailable risponde 503", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    const req = new Request("http://localhost/api/test");
    const gate = await checkRateLimit(req, "test", 5);
    expect(gate.proceed).toBe(false);
    if (gate.proceed) return;
    expect(gate.response.status).toBe(503);
    const body = (await gate.response.json()) as { error?: string };
    expect(body.error).toBe("Rate limiter unavailable");
  });

  it("rateLimitUnavailableResponse ha payload fisso", async () => {
    const res = rateLimitUnavailableResponse();
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Rate limiter unavailable");
  });
});