import type { Region } from "./constants";
import { REGIONS } from "./constants";
import {
  computeResolvedTerritorialStress,
  REGION_REFERENCE_STRESS,
} from "./fabbisogniCatalogFallback";
import {
  DOMAIN_NATIONAL_STRESS_BENCHMARK,
  executiveDomainLabel,
  nationalStressBenchmarkForIndicator,
} from "./osservatorioRadicamentoBaseline";
import type { FabbisogniCatalogFile } from "./osservatorioTypes";
import type { ScenarioResult, ScenarioRow } from "./types";
import { VENETO_DOCUMENT_EXAMPLE } from "./osservatorioIndicatorReference";

export type TerritoryScope = "NAZIONALE" | Region;

export const TERRITORY_NAZIONALE = "NAZIONALE" as const;

export function isRegionScope(scope: TerritoryScope): scope is Region {
  return scope !== TERRITORY_NAZIONALE;
}

export function scopeLabel(scope: TerritoryScope): string {
  if (scope === TERRITORY_NAZIONALE) return "Italia · Quadro Nazionale";
  return scope;
}

export function nextRegion(region: Region, delta: 1 | -1): Region {
  const i = REGIONS.indexOf(region);
  const n = (i + delta + REGIONS.length) % REGIONS.length;
  return REGIONS[n]!;
}

export type ModuloAProfile = {
  f: number;
  v: number;
  s: number;
  m: number;
  p: number;
  q: number;
  w: number;
  sReg: number;
  voti: number;
};

export function moduloAFromRow(row: ScenarioRow): ModuloAProfile {
  return {
    f: row.f * 100,
    v: row.v * 100,
    s: row.s * 100,
    m: row.m * 100,
    p: row.p * 100,
    q: row.q * 100,
    w: row.w,
    sReg: row.stima * 100,
    voti: row.voti_di_scenario,
  };
}

export function moduloAItalia(
  scenario: ScenarioResult,
  liveS: number,
): ModuloAProfile {
  const righe = scenario.righe;
  const totalVoti = righe.reduce((a, r) => a + r.voti_di_scenario, 0);
  return {
    f: 100,
    v: 100,
    s: 100,
    m: 100,
    p: 100,
    q: 100,
    w: 1,
    sReg: liveS * 100,
    voti: totalVoti,
  };
}

export function moduloAVenetoDocumento(scenario?: ScenarioResult): ModuloAProfile {
  const v = VENETO_DOCUMENT_EXAMPLE;
  const row = scenario?.righe.find((r) => r.regione === "Veneto");
  return {
    f: v.f,
    v: v.v,
    s: v.s,
    m: v.m,
    p: v.p,
    q: v.q,
    w: v.factor,
    sReg: v.sRegional,
    voti: row?.voti_di_scenario ?? 189_902,
  };
}

export function moduloAForScope(
  scope: TerritoryScope,
  scenario: ScenarioResult,
  liveS: number,
  useVenetoDocPreset?: boolean,
): ModuloAProfile {
  if (scope === TERRITORY_NAZIONALE) {
    return moduloAItalia(scenario, liveS);
  }
  if (useVenetoDocPreset && scope === "Veneto") {
    return moduloAVenetoDocumento(scenario);
  }
  const row = scenario.righe.find((r) => r.regione === scope);
  if (!row) return moduloAItalia(scenario, liveS);
  return moduloAFromRow(row);
}

export type NationalScenarioSummary = {
  sNazionale: number;
  totalVoti: number;
  totalIscritti: number;
  regionsAbove3Pct: number;
  nationalAvgStress: number;
  hEquilibrioPct: number;
};

export function computeNationalScenarioSummary(
  scenario: ScenarioResult,
  liveS: number,
): NationalScenarioSummary {
  const righe = scenario.righe;
  const stresses = REGIONS.map((r) => REGION_REFERENCE_STRESS[r]);
  const nationalAvgStress = Math.round(
    stresses.reduce((a, b) => a + b, 0) / stresses.length,
  );
  return {
    sNazionale: liveS,
    totalVoti: righe.reduce((a, r) => a + r.voti_di_scenario, 0),
    totalIscritti: righe.reduce((a, r) => a + r.iscritti, 0),
    regionsAbove3Pct: righe.filter((r) => r.stima >= 0.03).length,
    nationalAvgStress,
    hEquilibrioPct: scenario.metriche.H.iscritti * 100,
  };
}

export type DomainStressRow = {
  domain: string;
  regionStress: number;
  nationalAvg: number;
};

export function buildDomainStressRows(
  fabbisogni: FabbisogniCatalogFile | null,
  region: Region,
): DomainStressRow[] {
  const inds = fabbisogni?.regions[region]?.indicatori ?? [];
  if (!inds.length) return [];
  const resolved = computeResolvedTerritorialStress(inds, region);
  return resolved.scores.map((s) => {
    const ind = inds.find((i) => i.id === s.id);
    return {
      domain: executiveDomainLabel(s.tema),
      regionStress: s.stress,
      nationalAvg: nationalStressBenchmarkForIndicator(
        s.id,
        ind?.tema ?? s.tema,
      ),
    };
  });
}

export function nationalDomainStressReferenceRows(): DomainStressRow[] {
  return [
    {
      domain: "Sanità",
      regionStress: DOMAIN_NATIONAL_STRESS_BENCHMARK.sanita,
      nationalAvg: DOMAIN_NATIONAL_STRESS_BENCHMARK.sanita,
    },
    {
      domain: "Lavoro e Reddito",
      regionStress: DOMAIN_NATIONAL_STRESS_BENCHMARK.lavoro,
      nationalAvg: DOMAIN_NATIONAL_STRESS_BENCHMARK.lavoro,
    },
    {
      domain: "Costo dell'abitare e Prezzi",
      regionStress: DOMAIN_NATIONAL_STRESS_BENCHMARK.abitare,
      nationalAvg: DOMAIN_NATIONAL_STRESS_BENCHMARK.abitare,
    },
    {
      domain: "Trasporti e Servizi Locali",
      regionStress: DOMAIN_NATIONAL_STRESS_BENCHMARK.trasporti,
      nationalAvg: DOMAIN_NATIONAL_STRESS_BENCHMARK.trasporti,
    },
  ];
}

export function regionStressRanking(): {
  highest: { region: Region; stress: number }[];
  stable: { region: Region; stress: number }[];
} {
  const ranked = REGIONS.map((region) => ({
    region,
    stress: REGION_REFERENCE_STRESS[region],
  })).sort((a, b) => b.stress - a.stress);
  return {
    highest: ranked.slice(0, 5),
    stable: [...ranked].reverse().slice(0, 3),
  };
}

export const NATIONAL_FABBISOGNI_BENCHMARKS = {
  sanita: { gg: 36, rinuncia: 4.2, stress: 58 },
  lavoro: { occ: 62.1, stress: 55 },
  famiglie: { sov: 10.4, stress: 54 },
} as const;
