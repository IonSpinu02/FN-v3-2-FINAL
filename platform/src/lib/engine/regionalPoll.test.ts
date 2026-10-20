import { describe, expect, it } from "vitest";
import {
  adjustPiHatForTurnout,
  classifyThresholdProbability,
  classifyStatoTesseramento,
  computeRegionalPoll,
  DEFAULT_POLL_CONFIG,
  resolveSampleSize,
  seModelFromMc,
  seSample,
  simulateThresholdProbability,
} from "./regionalPoll";
import type { ScenarioRow } from "./types";
import { readFileSync } from "fs";
import path from "path";
import type { ScenarioResult } from "./types";

const scenario = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "data", "risultati_v3_2.json"),
    "utf8",
  ),
) as ScenarioResult;

describe("regionalPoll", () => {
  it("seModelFromMc fast-path (nSim=0) non zero", () => {
    const row = scenario.righe[0];
    const flatMc: ScenarioRow = { ...row, lo10: row.stima, hi90: row.stima };
    const se = seModelFromMc(flatMc);
    expect(se).toBeGreaterThan(0);
    const seMc = seModelFromMc(row);
    if (row.hi90 > row.lo10 + 1e-9) {
      expect(seMc).toBeCloseTo((row.hi90 - row.lo10) / 2.563, 10);
    }
  });

  it("SE_sample formula", () => {
    const se = seSample(0.07, 1000, 1.15);
    expect(se).toBeCloseTo(Math.sqrt((1.15 * 0.07 * 0.93) / 1000), 10);
  });

  it("classificazione soglia probabilità", () => {
    expect(classifyThresholdProbability(0.95)).toBe("sicura");
    expect(classifyThresholdProbability(0.5)).toBe("contesa");
    expect(classifyThresholdProbability(0.1)).toBe("critica");
  });

  it("resolveSampleSize modes", () => {
    const row = scenario.righe[0];
    expect(resolveSampleSize(row, scenario.parametri.validi2024, "fixed1000")).toBe(
      1000,
    );
    expect(resolveSampleSize(row, scenario.parametri.validi2024, "fixed600")).toBe(
      600,
    );
  });

  it("turnout adjustment increases piHat when turnout rises", () => {
    const base = 0.07;
    const up = adjustPiHatForTurnout(base, 56, 5);
    const down = adjustPiHatForTurnout(base, 56, -5);
    expect(up).toBeGreaterThan(base);
    expect(down).toBeLessThan(base);
  });

  it("simulateThresholdProbability deterministic seed", () => {
    const p1 = simulateThresholdProbability(0.07, 0.01, 0.03, 5000, 42);
    const p2 = simulateThresholdProbability(0.07, 0.01, 0.03, 5000, 42);
    expect(p1).toBe(p2);
    expect(p1).toBeGreaterThan(0.9);
  });

  it("computeRegionalPoll produce 20 regioni con MoE positivo", () => {
    const poll = computeRegionalPoll(scenario, DEFAULT_POLL_CONFIG);
    expect(poll).toHaveLength(20);
    for (const p of poll) {
      expect(p.moe).toBeGreaterThan(0);
      expect(p.icLow).toBeLessThanOrEqual(p.piHat);
      expect(p.icHigh).toBeGreaterThanOrEqual(p.piHat);
      expect(p.contribFlussi + p.contribPreferenze + p.contribIscritti + p.contribIstituzioni).toBeCloseTo(1, 5);
      expect(p.margineVotiSoglia).toBe(
        p.votiStimatiSondaggio - p.votiSoglia,
      );
      expect(p.votiPerIscritto).toBeGreaterThan(0);
    }
  });

  it("classifyStatoTesseramento soglie", () => {
    expect(classifyStatoTesseramento(1.5)).toBe("anomalia_tessere");
    expect(classifyStatoTesseramento(0.5)).toBe("da_strutturare");
    expect(classifyStatoTesseramento(1.0)).toBe("equilibrato");
  });

  it("margineVotiSoglia e validiAttesi con turnout", () => {
    const cfg = { ...DEFAULT_POLL_CONFIG, turnoutDeltaPct: 2 };
    const poll = computeRegionalPoll(scenario, cfg);
    const row = scenario.righe[0];
    const p = poll[0];
    const expectedValidi = Math.round(row.validi2024 * 1.02);
    expect(p.validiAttesi).toBe(expectedValidi);
    expect(p.votiStimatiSondaggio).toBe(Math.round(p.piHat * expectedValidi));
  });
});
