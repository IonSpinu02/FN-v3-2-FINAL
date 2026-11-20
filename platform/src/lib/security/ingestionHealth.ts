import {
  listSourceIngestion,
  type SourceIngestionRecord,
} from "@/lib/db/decisionLedger";

export type IngestionFailureAlert = {
  sourceKey: string;
  consecutiveFailures: number;
  reasons: string[];
};

export function ingestionRowIsFailure(row: SourceIngestionRecord): boolean {
  return Boolean(row.errorMessage?.trim()) || row.usedFallback;
}

/**
 * Ultimi cicli per `sourceKey` (ordinati dal più recente): streak di fallimenti consecutivi.
 */
export function consecutiveFailureStreak(
  rowsNewestFirst: SourceIngestionRecord[],
): { streak: number; reasons: string[] } {
  let streak = 0;
  const reasons: string[] = [];
  for (const row of rowsNewestFirst) {
    if (!ingestionRowIsFailure(row)) break;
    streak += 1;
    if (row.errorMessage?.trim()) reasons.push(row.errorMessage.trim());
    else if (row.usedFallback) reasons.push("usedFallback");
  }
  return { streak, reasons: [...new Set(reasons)].slice(0, 5) };
}

export async function detectConsecutiveIngestionFailures(
  minStreak = 2,
  listLimit = 250,
): Promise<IngestionFailureAlert[]> {
  const rows = await listSourceIngestion(undefined, listLimit);
  const bySource = new Map<string, SourceIngestionRecord[]>();
  for (const row of rows) {
    const list = bySource.get(row.sourceKey) ?? [];
    list.push(row);
    bySource.set(row.sourceKey, list);
  }

  const alerts: IngestionFailureAlert[] = [];
  for (const [sourceKey, list] of bySource) {
    const sorted = [...list].sort((a, b) =>
      b.checkedAt.localeCompare(a.checkedAt),
    );
    const { streak, reasons } = consecutiveFailureStreak(sorted);
    if (streak >= minStreak) {
      alerts.push({ sourceKey, consecutiveFailures: streak, reasons });
    }
  }
  return alerts.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
}