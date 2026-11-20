import { describe, expect, it } from "vitest";
import {
  consecutiveFailureStreak,
  ingestionRowIsFailure,
} from "./ingestionHealth";
import type { SourceIngestionRecord } from "@/lib/db/decisionLedger";

function row(
  partial: Partial<SourceIngestionRecord> & Pick<SourceIngestionRecord, "sourceKey">,
): SourceIngestionRecord {
  return {
    id: "1",
    checkedAt: partial.checkedAt ?? "2026-01-01T00:00:00.000Z",
    lastNewItemAt: null,
    itemsFetched: 0,
    itemsAccepted: 0,
    itemsRejected: 0,
    usedFallback: partial.usedFallback ?? false,
    errorMessage: partial.errorMessage ?? null,
    triggerType: "cron",
    metadata: null,
    createdAt: partial.createdAt ?? partial.checkedAt ?? "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("ingestionHealth", () => {
  it("ingestionRowIsFailure su errore o fallback", () => {
    expect(ingestionRowIsFailure(row({ sourceKey: "a", errorMessage: "x" }))).toBe(
      true,
    );
    expect(ingestionRowIsFailure(row({ sourceKey: "a", usedFallback: true }))).toBe(
      true,
    );
    expect(ingestionRowIsFailure(row({ sourceKey: "a" }))).toBe(false);
  });

  it("consecutiveFailureStreak conta solo cicli consecutivi recenti", () => {
    const streak = consecutiveFailureStreak([
      row({ sourceKey: "s", errorMessage: "e2", checkedAt: "2026-01-03" }),
      row({ sourceKey: "s", errorMessage: "e1", checkedAt: "2026-01-02" }),
      row({ sourceKey: "s", checkedAt: "2026-01-01" }),
    ]);
    expect(streak.streak).toBe(2);
  });
});