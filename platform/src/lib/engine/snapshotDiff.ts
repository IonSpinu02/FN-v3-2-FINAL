import { createHash } from "crypto";
import type { ScenarioResult, ScenarioRow } from "./types";

export type SnapshotParams = {
  S: number;
  pesi: ScenarioResult["parametri"]["pesi"];
  flussi_ipsos?: { FdI: number; Lega: number; ast: number };
  istituzioniDelta?: Record<string, unknown>;
  pollConfig?: unknown;
};

function canonicalScenarioPayload(scenario: ScenarioResult) {
  const righe = [...scenario.righe]
    .sort((a, b) => a.regione.localeCompare(b.regione))
    .map((r) => ({
      regione: r.regione,
      stima: r.stima,
      benchmark: r.benchmark,
      voti_di_scenario: r.voti_di_scenario,
      lo10: r.lo10,
      hi90: r.hi90,
      f: r.f,
      m: r.m,
    }));
  return {
    S: scenario.parametri.S,
    pesi: scenario.parametri.pesi,
    simulazioni: scenario.metadati.simulazioni,
    seme: scenario.metadati.seme,
    H_scenario: scenario.metriche.H.scenario,
    H_iscritti: scenario.metriche.H.iscritti,
    JS_scenario_benchmark: scenario.metriche.JS.scenario_benchmark,
    voti_totali: scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0),
    righe,
  };
}

export function computeScenarioSha256(scenario: ScenarioResult): string {
  const json = JSON.stringify(canonicalScenarioPayload(scenario));
  return createHash("sha256").update(json, "utf8").digest("hex");
}

export interface RegionSnapshotDiff {
  regione: string;
  baseStima: number;
  targetStima: number;
  deltaStimaPp: number;
  baseVoti: number;
  targetVoti: number;
  deltaVoti: number;
  baseLo10: number;
  baseHi90: number;
  targetLo10: number;
  targetHi90: number;
  deltaIndiceIstituzionale: number;
  deltaIndiceFlussi: number;
}

export interface SnapshotDiffResult {
  deltaS: number;
  deltaVotiTotali: number;
  deltaHScenario: number;
  deltaHIscritti: number;
  deltaJS: number;
  regions: RegionSnapshotDiff[];
}

function rowMap(rows: ScenarioRow[]): Map<string, ScenarioRow> {
  return new Map(rows.map((r) => [r.regione, r]));
}

export function computeSnapshotDiff(
  base: ScenarioResult,
  target: ScenarioResult,
): SnapshotDiffResult {
  const baseMap = rowMap(base.righe);
  const targetMap = rowMap(target.righe);
  const baseVoti = base.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const targetVoti = target.righe.reduce((s, r) => s + r.voti_di_scenario, 0);

  const regions: RegionSnapshotDiff[] = base.righe.map((br) => {
    const tr = targetMap.get(br.regione)!;
    return {
      regione: br.regione,
      baseStima: br.stima,
      targetStima: tr.stima,
      deltaStimaPp: (tr.stima - br.stima) * 100,
      baseVoti: br.voti_di_scenario,
      targetVoti: tr.voti_di_scenario,
      deltaVoti: tr.voti_di_scenario - br.voti_di_scenario,
      baseLo10: br.lo10,
      baseHi90: br.hi90,
      targetLo10: tr.lo10,
      targetHi90: tr.hi90,
      deltaIndiceIstituzionale: tr.m - br.m,
      deltaIndiceFlussi: tr.f - br.f,
    };
  });

  return {
    deltaS: (target.parametri.S - base.parametri.S) * 100,
    deltaVotiTotali: targetVoti - baseVoti,
    deltaHScenario: target.metriche.H.scenario - base.metriche.H.scenario,
    deltaHIscritti: target.metriche.H.iscritti - base.metriche.H.iscritti,
    deltaJS:
      target.metriche.JS.scenario_benchmark -
      base.metriche.JS.scenario_benchmark,
    regions,
  };
}
