import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchAlertIfAllowed } from "./alertDispatcher";

vi.mock("@/lib/db/domainCacheRepository", () => ({
  getCache: vi.fn(),
  setCache: vi.fn(),
}));

import { getCache, setCache } from "@/lib/db/domainCacheRepository";

describe("dispatchAlertIfAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.mocked(getCache).mockReset();
    vi.mocked(setCache).mockReset();
  });

  it("senza ALERT_WEBHOOK_URL non invia", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    const r = await dispatchAlertIfAllowed({
      alertKey: "test",
      title: "T",
      severity: "warning",
      details: {},
    });
    expect(r).toEqual({ sent: false, reason: "no_webhook" });
  });

  it("rispetta cooldown persistito su domain_cache", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example/alert");
    vi.stubEnv("ALERT_WEBHOOK_COOLDOWN_MS", "60000");
    const now = Date.now();
    vi.mocked(getCache).mockResolvedValue({
      key: "x",
      payload: { lastSentAt: now - 1_000, fingerprint: "fp" },
      computedAt: now,
      expiresAt: now + 60_000,
      etag: null,
      sourceStatus: null,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const r = await dispatchAlertIfAllowed({
      alertKey: "ingestion_streak:sondaggi:2",
      title: "T",
      severity: "warning",
      details: { sourceKey: "sondaggi" },
    });

    expect(r).toEqual({ sent: false, reason: "cooldown" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});