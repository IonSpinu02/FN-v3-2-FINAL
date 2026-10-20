import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { calculate } from "./calculate";
import type { Region } from "./constants";
import {
  computeScenarioSha256,
  computeSnapshotDiff,
} from "./snapshotDiff";
import type { EuRegion, FnConfig, ScenarioResult } from "./types";

const dataDir = path.join(process.cwd(), "data");

function load<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, name), "utf8")) as T;
}

describe("snapshotDiff", () => {
  const cfg = load<FnConfig>("config_v3_2.json");
  const eu = load<{ D: Record<Region, EuRegion> }>("eu2024.json").D;
  const frozen = load<ScenarioResult>("scenario_congelato_18-10-2026.json");

  it("computeScenarioSha256 è deterministico", () => {
    const a = computeScenarioSha256(frozen);
    const b = computeScenarioSha256(frozen);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("computeSnapshotDiff nullo su stesso scenario", () => {
    const diff = computeSnapshotDiff(frozen, frozen);
    expect(diff.deltaS).toBe(0);
    expect(diff.deltaVotiTotali).toBe(0);
    expect(diff.deltaHScenario).toBe(0);
    expect(diff.deltaHIscritti).toBe(0);
    expect(diff.deltaJS).toBe(0);
    for (const r of diff.regions) {
      expect(r.deltaStimaPp).toBe(0);
      expect(r.deltaVoti).toBe(0);
      expect(r.deltaIndiceIstituzionale).toBe(0);
      expect(r.deltaIndiceFlussi).toBe(0);
    }
  });

  it("computeSnapshotDiff rileva variazione S", () => {
    const alt = calculate(cfg, eu, 500, { S: frozen.parametri.S + 0.01 });
    const diff = computeSnapshotDiff(frozen, alt);
    expect(diff.deltaS).toBeCloseTo(1, 5);
    expect(diff.regions.some((r) => Math.abs(r.deltaStimaPp) > 0.001)).toBe(
      true,
    );
  });

  it("computeSnapshotDiff rileva istituzioniDelta", () => {
    const region = frozen.righe[0]!.regione as Region;
    const alt = calculate(cfg, eu, 500, {
      istituzioniDelta: {
        [region]: { com: 3 },
      },
    });
    const diff = computeSnapshotDiff(frozen, alt);
    const row = diff.regions.find((r) => r.regione === region)!;
    expect(row.deltaIndiceIstituzionale).not.toBe(0);
  });
});
