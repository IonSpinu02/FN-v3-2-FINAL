import { getCache, setCache } from "@/lib/db/domainCacheRepository";
import { sha256Hex } from "@/lib/engine/sha256Canonical";

export type AlertDispatchResult =
  | { sent: true }
  | { sent: false; reason: "no_webhook" | "cooldown" | "fetch_failed" | "cache_skip" };

export type AlertPayload = {
  alertKey: string;
  title: string;
  severity: "warning" | "critical";
  details: Record<string, unknown>;
};

const COOLDOWN_CACHE_PREFIX = "system_alert_cooldown:";

function cooldownMs(): number {
  const raw = Number(process.env.ALERT_WEBHOOK_COOLDOWN_MS ?? 3_600_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 3_600_000;
}

function cacheKeyForAlert(alertKey: string): string {
  return `${COOLDOWN_CACHE_PREFIX}${sha256Hex(alertKey).slice(0, 32)}`;
}

export async function dispatchAlertIfAllowed(
  input: AlertPayload,
): Promise<AlertDispatchResult> {
  const webhook = process.env.ALERT_WEBHOOK_URL?.trim();
  if (!webhook) return { sent: false, reason: "no_webhook" };

  const now = Date.now();
  const ms = cooldownMs();
  const cacheKey = cacheKeyForAlert(input.alertKey);
  const prior = await getCache<{ lastSentAt: number; fingerprint: string }>(
    cacheKey,
  );
  const fingerprint = sha256Hex(
    JSON.stringify({ title: input.title, details: input.details }),
  );
  if (prior?.payload) {
    if (
      prior.payload.fingerprint === fingerprint &&
      now - prior.payload.lastSentAt < ms
    ) {
      return { sent: false, reason: "cooldown" };
    }
    if (now - prior.payload.lastSentAt < ms) {
      return { sent: false, reason: "cooldown" };
    }
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        severity: input.severity,
        alertKey: input.alertKey,
        at: new Date(now).toISOString(),
        ...input.details,
      }),
    });
    if (!res.ok) return { sent: false, reason: "fetch_failed" };
  } catch {
    return { sent: false, reason: "fetch_failed" };
  }

  const wrote = await setCache({
    key: cacheKey,
    payload: { lastSentAt: now, fingerprint },
    computedAt: now,
    expiresAt: now + ms * 2,
    etag: null,
    sourceStatus: { kind: "alert_cooldown", alertKey: input.alertKey },
  });
  if (!wrote) return { sent: false, reason: "cache_skip" };
  return { sent: true };
}