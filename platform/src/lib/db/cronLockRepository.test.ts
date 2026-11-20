import { afterEach, describe, expect, it, vi } from "vitest";
import { acquireCronLock, releaseCronLock } from "./cronLockRepository";

describe("cronLockRepository", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("senza DATABASE_URL non acquisisce lock", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "");
    const lock = await acquireCronLock("test:unit", 60_000);
    expect(lock).toBeNull();
  });

  it("release su handle fittizio non lancia", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(
      releaseCronLock({ lockKey: "k", ownerId: "o" }),
    ).resolves.toBeUndefined();
  });
});