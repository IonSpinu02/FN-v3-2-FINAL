import { desc } from "drizzle-orm";
import { getDb } from "./client";
import { auditLogs } from "./schema";

export async function writeAuditLog(
  action: string,
  actorEmail: string,
  summary: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values({
      action,
      actorEmail: actorEmail.trim().toLowerCase(),
      summary,
      metadata: metadata ?? null,
    });
  } catch {
    /* graceful: audit non blocca operazioni */
  }
}

export async function listRecentAuditLogs(limit = 50) {
  const db = getDb();
  if (!db) return [];
  try {
    return await db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  } catch {
    return [];
  }
}
