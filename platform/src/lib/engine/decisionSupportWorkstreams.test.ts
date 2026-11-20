import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  buildComputationId,
  isBriefingAligned,
  freshnessLabel,
} from "@/lib/engine/computationFingerprint";
import {
  buildCoverageManifest,
  buildCalendarCoverageNote,
} from "@/lib/engine/coverageManifest";
import {
  evaluateWalkForward,
  resolveCalibrationApplication,
} from "@/lib/engine/calibrationReport";
import { getCalibrationMetrics } from "@/lib/engine/forecastCalibrationEngine";
import {
  __setLedgerDirForTests,
  appendDecisionSnapshot,
  appendSupervisionDecision,
  getDecisionSnapshotById,
  listActiveExclusions,
  listSupervisionDecisions,
} from "@/lib/db/decisionLedger";
import {
  computeForecastV4,
  staticForecastRegions,
} from "@/lib/engine/forecastEngineV4";
import { classifyHeadlineEpistemic } from "@/lib/engine/epistemicStatus";
import { randomUUID } from "node:crypto";

const LEDGER_DIR = path.join(process.cwd(), `.ledger-ws-${randomUUID()}`);

beforeEach(() => {
  __setLedgerDirForTests(LEDGER_DIR);
});
afterEach(async () => {
  __setLedgerDirForTests(null);
  await fs.rm(LEDGER_DIR, { recursive: true, force: true });
});

describe("WS1 — computationId invariante e anti-stale", () => {
  const v4Input = { regions: staticForecastRegions(6.59) };
  const v4 = computeForecastV4(v4Input);

  it("cambia computationId se cambia scenario, notizie o what-if", () => {
    const base = buildComputationId({
      v4,
      v4Input,
      scenarioMode: "base",
      horizonKey: "d180",
      newsHeadlines: ["Titolo A", "Titolo B"],
    });
    const scenario = buildComputationId({
      v4,
      v4Input,
      scenarioMode: "offensiva",
      horizonKey: "d180",
      newsHeadlines: ["Titolo A", "Titolo B"],
    });
    const news = buildComputationId({
      v4,
      v4Input,
      scenarioMode: "base",
      horizonKey: "d180",
      newsHeadlines: ["Titolo A", "Titolo C"],
    });
    const whatIf = buildComputationId({
      v4,
      v4Input,
      scenarioMode: "base",
      horizonKey: "d180",
      newsHeadlines: ["Titolo A", "Titolo B"],
      networkDelta: { comitati: 50, tesserati: 0 },
    });
    expect(base.computationId).not.toBe(scenario.computationId);
    expect(base.computationId).not.toBe(news.computationId);
    expect(base.computationId).not.toBe(whatIf.computationId);
    expect(base.computationId).toMatch(/^cmp_/);
  });

  it("marca briefing con computationId diverso come non allineato", () => {
    const active = buildComputationId({
      v4,
      v4Input,
      scenarioMode: "base",
      newsHeadlines: ["X"],
    }).computationId;
    expect(isBriefingAligned("cmp_altro", active)).toBe(false);
    expect(isBriefingAligned(active, active)).toBe(true);
    expect(freshnessLabel("NON_ALLINEATO")).toMatch(/non allineata/i);
  });

  it("esclusioni supervisione entrano nel fingerprint", () => {
    const a = buildComputationId({
      v4,
      v4Input,
      newsHeadlines: ["N1"],
      excludedEntityIds: [],
    });
    const b = buildComputationId({
      v4,
      v4Input,
      newsHeadlines: ["N1"],
      excludedEntityIds: ["news:abc"],
    });
    expect(a.computationId).not.toBe(b.computationId);
  });
});

describe("WS2 — riproducibilità point-in-time ledger", () => {
  it("rilegge uno snapshot identico anche se arrivano nuovi dati", async () => {
    const original = {
      computationId: "cmp_pit_test_001",
      emittedAt: "2026-01-15T10:00:00.000Z",
      engineVersion: "forecast-v4-test",
      calibrationStateJson: { bias: 0.1 },
      inputsManifestJson: {
        polls: [{ id: "p1", fnPct: 6.5, fieldEnd: "2026-01-10" }],
      },
      assumptionsJson: { note: "pit" },
      outputsJson: { d30: 6.6, d90: 6.7, d180: 6.8 },
    };
    const saved = await appendDecisionSnapshot(original);
    // Simula arrivo di nuovi sondaggi / nuova versione metodo (non tocca lo snapshot).
    const later = await appendDecisionSnapshot({
      ...original,
      computationId: "cmp_pit_test_002",
      emittedAt: "2026-03-01T10:00:00.000Z",
      engineVersion: "forecast-v4-new",
      inputsManifestJson: {
        polls: [
          { id: "p1", fnPct: 6.5, fieldEnd: "2026-01-10" },
          { id: "p2", fnPct: 7.1, fieldEnd: "2026-02-28" },
        ],
      },
      outputsJson: { d30: 7.0 },
    });
    expect(later.id).not.toBe(saved.id);

    const reread = await getDecisionSnapshotById(saved.id);
    expect(reread).not.toBeNull();
    expect(reread!.computationId).toBe(original.computationId);
    expect(reread!.engineVersion).toBe(original.engineVersion);
    expect(reread!.outputsJson).toEqual(original.outputsJson);
    expect(reread!.inputsManifestJson).toEqual(original.inputsManifestJson);
    expect(reread!.subsequentOutcomeJson).toBeNull();
  });
});

describe("WS3 — coverage & fallback disclosure BCE", () => {
  it("dichiara usedFallback quando il calendario è catalogo locale", () => {
    const manifest = buildCoverageManifest({
      newsConsidered: 24,
      newsDetected: 40,
      newsExcluded: 16,
      windowStart: "2026-01-01",
      windowEnd: "2026-01-31",
      calendarSource: "local-catalog",
      storage: "file",
      sources: [
        {
          sourceKey: "calendario_bce",
          label: "Calendario BCE",
          lastCheckedAt: "2026-01-31T12:00:00.000Z",
          lastNewItemAt: null,
          lastRecalcAt: "2026-01-31T12:00:00.000Z",
          methodVersion: "forecast-v4",
          usedFallback: true,
          fallbackLabel: "Catalogo locale di ripiego",
          itemsFetched: 3,
          itemsAccepted: 0,
          itemsRejected: 0,
          status: "fallback",
        },
      ],
    });
    expect(manifest.calendar.usedFallback).toBe(true);
    expect(manifest.calendar.source).toBe("local-catalog");
    expect(manifest.calendar.note).toMatch(/catalogo locale di ripiego/i);
    expect(manifest.news.note).toMatch(/Considerati 24 titoli su 40/);
    expect(buildCalendarCoverageNote("official-calendar")).toMatch(/live/i);
  });
});

describe("WS4 — calibrationReport walk-forward senza leakage 90/180", () => {
  it("espone confronto metodi e non estende metriche a 90/180", () => {
    const metrics = getCalibrationMetrics([
      { isoDate: "2025-01-01", pct: 6.0 },
      { isoDate: "2025-02-01", pct: 6.2 },
      { isoDate: "2025-03-01", pct: 6.1 },
      { isoDate: "2025-04-01", pct: 6.4 },
      { isoDate: "2025-05-01", pct: 6.3 },
      { isoDate: "2025-06-01", pct: 6.5 },
      { isoDate: "2025-07-01", pct: 6.6 },
    ]);
    expect(metrics.calibrationReport.walkForward90d).toBeNull();
    expect(metrics.calibrationReport.walkForward180d).toBeNull();
    expect(metrics.calibrationReport.walkForward30d.methods).toHaveLength(3);
    expect(metrics.calibrationReport.walkForward30d.methods.map((m) => m.method)).toEqual(
      ["uncalibrated", "calibrated", "consensus_invariant"],
    );
    expect(typeof metrics.appliedToPrimary).toBe("boolean");
    expect(typeof metrics.experimentalOnly).toBe("boolean");
  });

  it("disattiva sul primario se la calibrazione non batte il consenso", () => {
    const methods = evaluateWalkForward([
      {
        id: "a",
        actualDelta: 0.1,
        predictedUncalibrated: 0.1,
        predictedCalibrated: 0.5,
        predictedConsensusInvariant: 0.1,
      },
      {
        id: "b",
        actualDelta: -0.1,
        predictedUncalibrated: -0.1,
        predictedCalibrated: 0.4,
        predictedConsensusInvariant: -0.1,
      },
    ]);
    const report = resolveCalibrationApplication({
      biasCorrection: 0.3,
      damping: 0.5,
      walkForward: methods,
      observationIds: ["a", "b"],
      engineVersion: "t",
      calibrationVersion: "c",
    });
    expect(report.activeParams.appliedToPrimary).toBe(false);
    expect(report.activeParams.experimentalOnly).toBe(true);
    expect(report.walkForward30d.winner).toBe("consensus_invariant");
  });
});

describe("WS5 — supervisione umana e propagazione esclusioni", () => {
  it("esclude un articolo dai conteggi attivi ma resta nell'audit log", async () => {
    const headlines = [
      { id: "news:1", title: "Titolo 1" },
      { id: "news:2", title: "Titolo 2" },
      { id: "news:3", title: "Titolo 3" },
    ];
    await appendSupervisionDecision({
      entityType: "news_item",
      entityId: "news:2",
      previousStatus: classifyHeadlineEpistemic({ confidence: "medium" }),
      newStatus: "excluded",
      note: "Fuori tema",
    });

    const exclusions = await listActiveExclusions();
    expect(exclusions).toContain("news:2");

    const active = headlines.filter((h) => !exclusions.includes(h.id));
    expect(active.map((h) => h.id)).toEqual(["news:1", "news:3"]);
    expect(active).toHaveLength(2);

    const audit = await listSupervisionDecisions(10);
    expect(audit.some((r) => r.entityId === "news:2" && r.newStatus === "excluded")).toBe(
      true,
    );
  });

  it("classifica stati epistemologici tipizzati", () => {
    expect(
      classifyHeadlineEpistemic({ hasPrimarySource: true, confidence: "high" }),
    ).toBe("FATTO_DOCUMENTATO");
    expect(classifyHeadlineEpistemic({ confidence: "medium" })).toBe(
      "ESTRAZIONE_DA_VERIFICARE",
    );
    expect(classifyHeadlineEpistemic({ isScenarioClaim: true })).toBe(
      "INTERPRETAZIONE_IPOTESI",
    );
    expect(classifyHeadlineEpistemic({ contradicted: true })).toBe(
      "DATI_INSUFFICIENTI_CONTRADDIZIONE",
    );
  });
});
