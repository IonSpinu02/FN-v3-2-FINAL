import { describe, expect, it } from "vitest";
import { isDomainCacheFresh } from "./domainCacheRepository";

describe("domainCacheRepository", () => {
  it("isDomainCacheFresh rispetta expires_at", () => {
    const now = 1_000_000;
    expect(
      isDomainCacheFresh({ computedAt: now - 1000, expiresAt: now + 5000 }, now),
    ).toBe(true);
    expect(
      isDomainCacheFresh({ computedAt: now - 1000, expiresAt: now - 1 }, now),
    ).toBe(false);
    expect(isDomainCacheFresh({ computedAt: now, expiresAt: null }, now)).toBe(
      true,
    );
  });
});