import { getBipMessaging } from "@/lib/bipProgramCatalog";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { piazzaForRegion } from "@/lib/engine/strategicBriefingEngine";
import {
  projectMonths,
  REGIME_SENSITIVITY,
  type GrowthEvidence,
} from "@/lib/engine/growthTrajectory";
import {
  buildRegionalCampaignSummary,
  cdxSharePct,
  computeIssueConversionGain,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import {
  categoryLabel,
  type TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";
import { buildConsensusTargetPlan, type ConsensusHorizon } from "@/lib/engine/consensusTargetPlan";
import type { ForecastV4Result } from "@/lib/engine/forecastEngineV4";

const THEMES: TerritoryIssueCategory[] = [
  "SICUREZZA",
  "LAVORO",
  "SANITA",
  "TRASPORTI",
  "COSTO_VITA",
  "TERRITORIO",
];

export type DailyOrderRow = {
  regione: Region;
  stima: number;
  voti_di_scenario: number;
  iscritti: number;
};

export type DailyOrderInput = {
  currentPct: number;
  previousPct: number | null;
  deltaPp: number | null;
  sourceLabel: string;
  asOfIso: string;
  /** Regione cliccata. Il passaggio del mouse non entra qui. */
  focusRegion: Region | null;
  rows: DailyOrderRow[];
  evidence: GrowthEvidence;
  abstentionShare?: number;
  asOf?: Date;
  /** Presente solo dopo la conferma del bersaglio. Senza questo campo l'ordine resta invariato. */
  consensusTarget?: {
    forecast: ForecastV4Result;
    targetPct: number;
    horizon: ConsensusHorizon;
  } | null;
};

export type DailyOrderTargetSummary = {
  targetPct: number;
  horizon: ConsensusHorizon;
  horizonLabel: string;
  modelPct: number;
  hypothesisPct: number;
  bandNote: string | null;
  regimeLabel: string;
  firstLeverLabel: string | null;
  equalFallback: boolean;
  methodNote: string;
};

export type DailyOrder = {
  misurato: {
    label: "MISURATO";
    currentPct: number;
    previousPct: number | null;
    deltaPp: number | null;
    sourceLabel: string;
    asOfIso: string;
  };
  stimaDove: {
    label: "STIMA";
    region: Region;
    piazza: string;
    motivo: string;
    leva: string;
    potentialPp: number;
    modelCapPp: number;
    category: TerritoryIssueCategory;
    tema: string;
  };
  bozzaCosaDire: {
    label: "BOZZA";
    messaggioStampa: string;
    capitolo: string;
    veicoloNormativo: string;
    interlocutore: string;
    nota: "Bozza per lo staff · non sposta il consenso";
  };
  stimaSeSuccede: {
    label: "STIMA";
    startPct: number;
    centralPct: number;
    deltaPp: number;
    shockPosPp: number;
    shockMonthKey: string;
    ceilingNote: "ampiezza di modello";
  };
  targetSummary?: DailyOrderTargetSummary;
};

function isRegion(value: string | null): value is Region {
  return REGIONS.includes(value as Region);
}

function priorityRegion(rows: DailyOrderRow[]): Region {
  let best: { region: Region; votes: number } | null = null;
  for (const row of rows) {
    if (!isRegion(row.regione)) continue;
    const valid = validVotesFromScenarioRow(row.voti_di_scenario, row.stima);
    const summary = buildRegionalCampaignSummary(row.regione, row.stima * 100, valid);
    if (!best || summary.maxCumulativeNewVotes > best.votes) {
      best = { region: row.regione, votes: summary.maxCumulativeNewVotes };
    }
  }
  return best?.region ?? "Calabria";
}

export function buildDailyOrder(input: DailyOrderInput): DailyOrder {
  const focus = input.focusRegion && isRegion(input.focusRegion) ? input.focusRegion : null;
  const region = focus ?? priorityRegion(input.rows);
  const row = input.rows.find((item) => item.regione === region);
  const valid = validVotesFromScenarioRow(row?.voti_di_scenario ?? 0, row?.stima ?? 0.03);
  const sharePct = (row?.stima ?? input.currentPct / 100) * 100;
  const summary = buildRegionalCampaignSummary(region, sharePct, valid);
  const ranked = THEMES.map((category) =>
    computeIssueConversionGain(region, category, 82, valid),
  ).sort((a, b) => b.potentialGainPp - a.potentialGainPp);
  const top = ranked[0]!;
  const category = top.fnPromise.category;
  const messaging = getBipMessaging(category);
  const cdx = cdxSharePct(summary.history);
  const iscritti = row?.iscritti ?? 0;
  const projection = projectMonths({
    startPct: input.currentPct,
    evidence: input.evidence,
    months: 1,
    sensitivity: REGIME_SENSITIVITY.organica,
    asOf: input.asOf,
    abstentionShare: input.abstentionShare,
  });
  const month = projection.timeline[0];
  const rawShock = month?.extraordinary.potentialRangePp[1] ?? 0;
  const shockPosPp = Math.round(rawShock * REGIME_SENSITIVITY.organica * 100) / 100;

  const order: DailyOrder = {
    misurato: {
      label: "MISURATO",
      currentPct: input.currentPct,
      previousPct: input.previousPct,
      deltaPp: input.deltaPp,
      sourceLabel: input.sourceLabel,
      asOfIso: input.asOfIso,
    },
    stimaDove: {
      label: "STIMA",
      region,
      piazza: piazzaForRegion(region),
      motivo: `Bacino CDX Europee 2024 ${cdx.toFixed(1).replace(".", ",")}% · tesserati FN ${iscritti.toLocaleString("it-IT")} · ${categoryLabel(category)}`,
      leva: summary.topPromiseFocus.label,
      potentialPp: summary.topPromiseFocus.gainPp,
      modelCapPp: summary.maxCumulativeGainPp,
      category,
      tema: categoryLabel(category),
    },
    bozzaCosaDire: {
      label: "BOZZA",
      messaggioStampa: messaging.pressDeclaration,
      capitolo: `Cap. ${messaging.chapterNum}`,
      veicoloNormativo: messaging.provvedimento.attoConcreto,
      interlocutore: messaging.provvedimento.enteCompetente,
      nota: "Bozza per lo staff · non sposta il consenso",
    },
    stimaSeSuccede: {
      label: "STIMA",
      startPct: input.currentPct,
      centralPct: projection.centralPct,
      deltaPp: projection.deltaPp,
      shockPosPp,
      shockMonthKey: month?.key ?? "",
      ceilingNote: "ampiezza di modello",
    },
  };
  if (!input.consensusTarget) return order;
  const plan = buildConsensusTargetPlan(input.consensusTarget.forecast, {
    targetPct: input.consensusTarget.targetPct,
    horizon: input.consensusTarget.horizon,
  });
  return {
    ...order,
    targetSummary: {
      targetPct: plan.targetPct,
      horizon: plan.horizon,
      horizonLabel: plan.horizonLabel,
      modelPct: plan.modelPct,
      hypothesisPct: plan.gapPct,
      bandNote: plan.bandNote,
      regimeLabel: plan.regimeLabel,
      firstLeverLabel: plan.firstLeverLabel,
      equalFallback: plan.equalFallback,
      methodNote: plan.methodNote,
    },
  };
}
