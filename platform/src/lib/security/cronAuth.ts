/**
 * Autenticazione fail-closed per endpoint cron / machine-to-machine.
 * Mai consentire esecuzione libera se CRON_SECRET manca.
 */
import { timingSafeEqual } from "node:crypto";

export const CRON_SECRET_MISSING_MESSAGE =
  "CRON_SECRET non configurato: monitoraggio autonomo disabilitato per sicurezza";

function safeEqualString(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) {
    // Confronta comunque con se stesso per tempo circa costante sulla lunghezza nota.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function extractBearerOrQuerySecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m?.[1]) return m[1].trim();
  }
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("secret");
  return q?.trim() || null;
}

export type CronAuthResult =
  | { ok: true; secretConfigured: true }
  | { ok: false; status: 401 | 503; error: string; secretConfigured: boolean };

/**
 * Fail-closed: senza secret → 503; token errato → 401.
 * `timingSafeEqual` sul confronto Bearer/query.
 */
export function authorizeCronRequest(req: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) {
    return {
      ok: false,
      status: 503,
      error: CRON_SECRET_MISSING_MESSAGE,
      secretConfigured: false,
    };
  }
  const provided = extractBearerOrQuerySecret(req);
  if (!provided || !safeEqualString(provided, secret)) {
    return {
      ok: false,
      status: 401,
      error: "Non autorizzato",
      secretConfigured: true,
    };
  }
  return { ok: true, secretConfigured: true };
}

export function isCronSecretConfigured(): boolean {
  return Boolean(process.env.CRON_SECRET?.trim());
}
