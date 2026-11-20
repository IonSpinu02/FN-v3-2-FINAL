import type {
  BasinId,
  FeasibilityBand,
  RegionPlan,
  RegionRole,
  StrategicBackcastResult,
} from "@/lib/engine/strategicBackcastEngine";

export const BAND_LABEL: Record<FeasibilityBand, string> = {
  COPERTA_DA_MODELLO: "IN LINEA CON LA STIMA",
  ESPANSIONE_ORGANICA: "ESPANSIONE ORGANICA",
  MOBILITAZIONE_STRAORDINARIA: "MOBILITAZIONE STRAORDINARIA",
  SHOCK_ESOGENO_RICHIESTO: "SHOCK ESOGENO RICHIESTO",
};

export const ROLE_LABEL: Record<RegionRole, string> = {
  FRONTE_PRIORITARIO: "FRONTE PRIORITARIO",
  SUPPORTO_ESPANSIONE: "SUPPORTO",
  PRESIDIO_ORDINARIO: "PRESIDIO",
};

export const BASIN_LABEL: Record<BasinId, string> = {
  delusi_coalizione: "Delusi coalizione",
  astensione_recuperabile: "Astensione recuperabile",
  voto_tematico_ponte: "Voto tematico-ponte",
  radicamento_civico_eletti: "Radicamento civico/eletti",
};

export type GoalViewModel = {
  measuredLabel: "MISURATO";
  modelLabel: "STIMA MODELLO";
  hypothesisLabel: "IPOTESI";
  currentPct: number;
  offensivePct: number;
  surplusPp: number;
  surplusVotes: number;
  totalDeltaVotes: number;
  band: string;
  feasibilityIndex: number;
  successPct: number;
  cvar10: number;
  beyond: boolean;
  maxEndogenousPct: number;
  exogenousGapPct: number;
  activeFronts: number;
  regions: RegionPlan[];
};

export function toGoalViewModel(result: StrategicBackcastResult): GoalViewModel {
  return {
    measuredLabel: result.epistemic.currentPct,
    modelLabel: result.epistemic.modelAnchors,
    hypothesisLabel: result.epistemic.surplus,
    currentPct: result.currentPct,
    offensivePct: result.offensiveCentral,
    surplusPp: result.netSurplusPct,
    surplusVotes: result.netSurplusVotes,
    totalDeltaVotes: result.totalDeltaVotes,
    band: BAND_LABEL[result.feasibilityBand],
    feasibilityIndex: result.feasibilityIndex,
    successPct: result.successProbability * 100,
    cvar10: result.cvar10,
    beyond: result.targetPct > result.maxEndogenousPct,
    maxEndogenousPct: result.maxEndogenousPct,
    exogenousGapPct: result.exogenousGapPct,
    activeFronts: result.activeFronts,
    regions: result.regions,
  };
}

export function primaryBasin(plan: RegionPlan): BasinId {
  return (Object.entries(plan.basins) as [BasinId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "voto_tematico_ponte";
}
