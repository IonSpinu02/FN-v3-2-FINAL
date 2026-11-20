import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  authorizeCronRequest,
  CRON_SECRET_MISSING_MESSAGE,
} from "@/lib/security/cronAuth";
import {
  buildComputationId,
  isBriefingAligned,
} from "@/lib/engine/computationFingerprint";
import {
  __setLedgerDirForTests,
  appendDecisionSnapshot,
  verifyLedgerIntegrity,
} from "@/lib/db/decisionLedger";
import {
  computeForecastV4,
  staticForecastPolls,
  staticForecastRegions,
  walkForwardBacktestV4,
} from "@/lib/engine/forecastEngineV4";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { randomUUID } from "node:crypto";

const LEDGER_DIR = path.join(process.cwd(), `.ledger-hardening-${randomUUID()}`);

beforeEach(() => {
  __setLedgerDirForTests(LEDGER_DIR);
});
afterEach(async () => {
  __setLedgerDirForTests(null);
  await fs.rm(LEDGER_DIR, { recursive: true, force: true });
});

function req(url: string, headers?: Record<string, string>): Request {
  return new Request(url, { headers });
}

describe("HARDENING 1 — cron fail-closed", () => {
  const prev = process.env.CRON_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  });

  it("senza CRON_SECRET risponde 503 (mai 200)", () => {
    delete process.env.CRON_SECRET;
    const r = authorizeCronRequest(req("http://localhost/api/cron/system-monitor"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(503);
      expect(r.error).toBe(CRON_SECRET_MISSING_MESSAGE);
    }
  });

  it("con secret errato risponde 401", () => {
    process.env.CRON_SECRET = "segreto-corretto-di-test";
    const r = authorizeCronRequest(
      req("http://localhost/api/cron/system-monitor", {
        authorization: "Bearer sbagliato",
      }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });

  it("con Bearer corretto autorizza", () => {
    process.env.CRON_SECRET = "segreto-corretto-di-test";
    const r = authorizeCronRequest(
      req("http://localhost/api/cron/system-monitor", {
        authorization: "Bearer segreto-corretto-di-test",
      }),
    );
    expect(r.ok).toBe(true);
  });
});

describe("HARDENING 2 — computationId digest completo", () => {
  const v4Input = {
    regions: staticForecastRegions(6.59),
    polls: staticForecastPolls(),
  };
  const v4 = computeForecastV4(v4Input);

  it("cambia computationId se cambia campione o valore di un sondaggio intermedio", () => {
    const polls = staticForecastPolls();
    expect(polls.length).toBeGreaterThan(2);
    const mid = Math.floor(polls.length / 2);
    const base = buildComputationId({
      v4,
      v4Input: { ...v4Input, polls },
      newsHeadlines: ["A"],
    });
    const pollsSample = polls.map((p, i) =>
      i === mid ? { ...p, sampleSize: (p.sampleSize ?? 1000) + 111 } : p,
    );
    const pollsValue = polls.map((p, i) =>
      i === mid ? { ...p, fnPct: p.fnPct + 0.07 } : p,
    );
    const idSample = buildComputationId({
      v4,
      v4Input: { ...v4Input, polls: pollsSample },
      newsHeadlines: ["A"],
    });
    const idValue = buildComputationId({
      v4,
      v4Input: { ...v4Input, polls: pollsValue },
      newsHeadlines: ["A"],
    });
    expect(idSample.computationId).not.toBe(base.computationId);
    expect(idValue.computationId).not.toBe(base.computationId);
    expect(isBriefingAligned(base.computationId, idValue.computationId)).toBe(false);
  });
});

describe("HARDENING 3 — ledger jsonl + hash-chain concorrente", () => {
  it("Promise.all di scritture non perde record né rompe la catena", async () => {
    const n = 12;
    const results = await Promise.all(
      Array.from({ length: n }, (_, i) =>
        appendDecisionSnapshot({
          computationId: `cmp_conc_${i}`,
          emittedAt: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
          engineVersion: "test",
          calibrationStateJson: {},
          inputsManifestJson: { i },
          assumptionsJson: {},
          outputsJson: { i },
        }),
      ),
    );
    expect(results).toHaveLength(n);
    expect(new Set(results.map((r) => r.id)).size).toBe(n);

    const integrity = await verifyLedgerIntegrity();
    expect(integrity.ok).toBe(true);
    expect(integrity.snapshotsChecked).toBe(n);

    const raw = await fs.readFile(
      path.join(LEDGER_DIR, "decision_ledger_snapshots.jsonl"),
      "utf8",
    );
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    expect(lines).toHaveLength(n);
  });
});

describe("HARDENING 4 — zero look-ahead walkForwardBacktestV4", () => {
  it("aggiungere sondaggi con data > t_k non cambia la previsione a t_k", () => {
    const series = FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
      isoDate: p.isoDate,
      pct: p.pct,
    }));
    const polls = staticForecastPolls();
    const base = walkForwardBacktestV4({ series, polls, fromIso: "2026-07-01" });
    expect(base.n).toBeGreaterThan(0);
    const probe = base.rows[Math.floor(base.rows.length / 2)]!;

    const futurePolls = [
      ...polls,
      {
        id: "future-leak-test",
        institute: "FAKE-FUTURE",
        fieldEnd: "2027-12-01",
        publishedAt: "2027-12-02",
        fnPct: 99.9,
        sampleSize: 50000,
        sourceUrl: undefined,
      },
    ];
    const withFuture = walkForwardBacktestV4({
      series,
      polls: futurePolls,
      fromIso: "2026-07-01",
    });
    const again = withFuture.rows.find(
      (r) => r.origin === probe.origin && r.target === probe.target,
    );
    expect(again).toBeTruthy();
    expect(again!.v4Pct).toBe(probe.v4Pct);
    expect(again!.lo10Pct).toBe(probe.lo10Pct);
    expect(again!.hi90Pct).toBe(probe.hi90Pct);
  });
});
