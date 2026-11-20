import { afterEach, describe, expect, it, vi } from "vitest";
import { ledgerFileFallbackAllowed } from "./cachePolicy";

describe("cachePolicy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ledger file fallback disabilitato in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(ledgerFileFallbackAllowed()).toBe(false);
  });

  it("ledger file fallback consentito in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(ledgerFileFallbackAllowed()).toBe(true);
  });
});