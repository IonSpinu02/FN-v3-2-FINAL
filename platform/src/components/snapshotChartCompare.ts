import type { RegionSnapshotDiff, SnapshotDiffResult } from "@/lib/engine/snapshotDiff";
import type { ScenarioResult } from "@/lib/engine/types";

export type ChartCompareMode = "benchmark2024" | "stress" | "snapshot";

export function isSnapshotDiffFlat(diff: SnapshotDiffResult | null): boolean {
  if (!diff) return true;
  return diff.regions.every(
    (r) => Math.abs(r.deltaStimaPp) < 0.005 && Math.abs(r.deltaVoti) < 1,
  );
}

export function buildBenchmark2024ChartRegions(
  base: ScenarioResult,
): RegionSnapshotDiff[] {
  return base.righe.map((br) => ({
    regione: br.regione,
    baseStima: br.benchmark,
    targetStima: br.stima,
    deltaStimaPp: (br.stima - br.benchmark) * 100,
    baseVoti: br.voti_di_scenario,
    targetVoti: br.voti_di_scenario,
    deltaVoti: Math.round(
      ((br.stima - br.benchmark) / Math.max(br.stima, 0.001)) *
        br.voti_di_scenario,
    ),
    baseLo10: br.lo10,
    baseHi90: br.hi90,
    targetLo10: br.lo10,
    targetHi90: br.hi90,
    deltaIndiceIstituzionale: 0,
    deltaIndiceFlussi: 0,
  }));
}

export function buildStressTestChartRegions(
  base: ScenarioResult,
): RegionSnapshotDiff[] {
  const ratio = 0.082 / 0.072;
  return base.righe.map((br) => {
    const targetStima = br.stima * ratio;
    const targetVoti = Math.round(br.voti_di_scenario * ratio);
    return {
      regione: br.regione,
      baseStima: br.stima,
      targetStima,
      deltaStimaPp: (targetStima - br.stima) * 100,
      baseVoti: br.voti_di_scenario,
      targetVoti,
      deltaVoti: targetVoti - br.voti_di_scenario,
      baseLo10: br.lo10,
      baseHi90: br.hi90,
      targetLo10: br.lo10 * ratio,
      targetHi90: br.hi90 * ratio,
      deltaIndiceIstituzionale: 0,
      deltaIndiceFlussi: 0,
    };
  });
}
