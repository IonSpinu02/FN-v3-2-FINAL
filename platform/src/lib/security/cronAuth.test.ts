import { afterEach, describe, expect, it, vi } from "vitest";
import {
  authorizeCronRequest,
  CRON_SECRET_MISSING_MESSAGE,
  extractBearerOrQuerySecret,
} from "./cronAuth";

describe("authorizeCronRequest", () => {
  const secret = "test-cron-secret-value-32chars!!";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fail-closed 503 se CRON_SECRET manca", () => {
    vi.stubEnv("CRON_SECRET", "");
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `Bearer anything` },
    });
    const r = authorizeCronRequest(req);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(503);
    expect(r.error).toBe(CRON_SECRET_MISSING_MESSAGE);
  });

  it("401 con Bearer errato (confronto constant-time)", () => {
    vi.stubEnv("CRON_SECRET", secret);
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const r = authorizeCronRequest(req);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
  });

  it("ok con Bearer corretto", () => {
    vi.stubEnv("CRON_SECRET", secret);
    const req = new Request("http://localhost/api/cron/x", {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(authorizeCronRequest(req)).toEqual({
      ok: true,
      secretConfigured: true,
    });
  });

  it("accetta secret da query come fallback", () => {
    vi.stubEnv("CRON_SECRET", secret);
    const req = new Request(
      `http://localhost/api/cron/x?secret=${encodeURIComponent(secret)}`,
    );
    expect(authorizeCronRequest(req).ok).toBe(true);
  });
});

describe("extractBearerOrQuerySecret", () => {
  it("estrae Bearer", () => {
    const req = new Request("http://x", {
      headers: { authorization: "Bearer abc" },
    });
    expect(extractBearerOrQuerySecret(req)).toBe("abc");
  });
});