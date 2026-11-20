import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import {
  BIP_FN_PROMISES_CATALOG,
  type FnBipPromise,
} from "@/lib/bipProgramCatalog";
import { BIP_EMERGENCIES } from "@/lib/engine/bipProblemRadar";
import {
  fnPromiseIdForSubDossier,
  matchExactBipSubDossier,
} from "@/lib/engine/bipSubDossierMatch";

/** Radar territoriale: solo emergenze con misura dedicata nel B.I.P. */
export const BIP_RADAR_EMERGENCY_COUNT = BIP_EMERGENCIES.length;
import type {
  ElectoralSubTheme,
  TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";

export type BloccoPrevalente =
  | "ROCCAFORTE CENTRODESTRA (LEGA + FDI)"
  | "CONTENDIBILE / ALTO BACINO ASTENSIONE"
  | "BLOCCO STORICO PD / CENTROSINISTRA";

export type CampaignVerdictId =
  | "PRIORITA_ASSOLUTA"
  | "PRESIDIO_MIRATO"
  | "SCONSIGLIATO_MURO_PD";

export type RegionalPartyHistory = {
  regione: Region;
  fdiPct: number;
  legaPct: number;
  fiPct: number;
  pdPct: number;
  m5sPct: number;
  altriLeftPct: number;
  astensionePct: number;
  bloccoPrevalente: BloccoPrevalente;
  permeabilitaVannacciScore: number;
  permeabilitaLabel: string;
};

export type FnPromise = FnBipPromise;

/** Catalogo ufficiale misure B.I.P. collegate ai pilastri territoriali. */
export const FN_PROMISES_CATALOG: FnPromise[] = BIP_FN_PROMISES_CATALOG;

const PARTY_ROWS: Omit<
  RegionalPartyHistory,
  "bloccoPrevalente" | "permeabilitaVannacciScore" | "permeabilitaLabel"
>[] = [
  {
    regione: "Piemonte",
    fdiPct: 30.4,
    legaPct: 10.3,
    fiPct: 9.8,
    pdPct: 23.0,
    m5sPct: 7.5,
    altriLeftPct: 5.2,
    astensionePct: 13.8,
  },
  {
    regione: "Valle d'Aosta",
    fdiPct: 24.5,
    legaPct: 4.2,
    fiPct: 11.8,
    pdPct: 28.6,
    m5sPct: 6.1,
    altriLeftPct: 8.4,
    astensionePct: 16.4,
  },
  {
    regione: "Liguria",
    fdiPct: 26.8,
    legaPct: 8.9,
    fiPct: 8.1,
    pdPct: 26.2,
    m5sPct: 10.1,
    altriLeftPct: 5.9,
    astensionePct: 14.0,
  },
  {
    regione: "Lombardia",
    fdiPct: 31.8,
    legaPct: 13.1,
    fiPct: 9.3,
    pdPct: 22.6,
    m5sPct: 5.7,
    altriLeftPct: 4.8,
    astensionePct: 12.7,
  },
  {
    regione: "Trentino-Alto Adige",
    fdiPct: 27.2,
    legaPct: 7.8,
    fiPct: 10.4,
    pdPct: 21.5,
    m5sPct: 5.9,
    altriLeftPct: 6.2,
    astensionePct: 21.0,
  },
  {
    regione: "Veneto",
    fdiPct: 37.6,
    legaPct: 13.2,
    fiPct: 8.6,
    pdPct: 18.9,
    m5sPct: 4.8,
    altriLeftPct: 4.1,
    astensionePct: 12.8,
  },
  {
    regione: "Friuli-Venezia Giulia",
    fdiPct: 36.2,
    legaPct: 12.5,
    fiPct: 7.1,
    pdPct: 20.2,
    m5sPct: 5.3,
    altriLeftPct: 4.7,
    astensionePct: 14.0,
  },
  {
    regione: "Emilia-Romagna",
    fdiPct: 28.0,
    legaPct: 6.5,
    fiPct: 5.7,
    pdPct: 36.1,
    m5sPct: 7.3,
    altriLeftPct: 6.4,
    astensionePct: 10.0,
  },
  {
    regione: "Toscana",
    fdiPct: 27.8,
    legaPct: 6.2,
    fiPct: 6.3,
    pdPct: 31.9,
    m5sPct: 8.2,
    altriLeftPct: 5.6,
    astensionePct: 14.0,
  },
  {
    regione: "Umbria",
    fdiPct: 32.1,
    legaPct: 6.8,
    fiPct: 7.1,
    pdPct: 29.2,
    m5sPct: 8.8,
    altriLeftPct: 5.0,
    astensionePct: 11.0,
  },
  {
    regione: "Marche",
    fdiPct: 32.9,
    legaPct: 8.1,
    fiPct: 7.0,
    pdPct: 25.5,
    m5sPct: 9.2,
    altriLeftPct: 5.3,
    astensionePct: 12.0,
  },
  {
    regione: "Lazio",
    fdiPct: 34.3,
    legaPct: 6.2,
    fiPct: 6.9,
    pdPct: 23.7,
    m5sPct: 10.4,
    altriLeftPct: 5.5,
    astensionePct: 13.0,
  },
  {
    regione: "Abruzzo",
    fdiPct: 32.3,
    legaPct: 8.2,
    fiPct: 10.8,
    pdPct: 20.1,
    m5sPct: 12.8,
    altriLeftPct: 4.8,
    astensionePct: 11.0,
  },
  {
    regione: "Molise",
    fdiPct: 29.8,
    legaPct: 7.4,
    fiPct: 9.6,
    pdPct: 24.2,
    m5sPct: 11.5,
    altriLeftPct: 5.5,
    astensionePct: 12.0,
  },
  {
    regione: "Campania",
    fdiPct: 19.4,
    legaPct: 5.8,
    fiPct: 10.8,
    pdPct: 22.2,
    m5sPct: 20.8,
    altriLeftPct: 6.2,
    astensionePct: 14.8,
  },
  {
    regione: "Puglia",
    fdiPct: 26.9,
    legaPct: 6.1,
    fiPct: 7.9,
    pdPct: 23.6,
    m5sPct: 14.3,
    altriLeftPct: 5.2,
    astensionePct: 16.0,
  },
  {
    regione: "Basilicata",
    fdiPct: 24.6,
    legaPct: 5.2,
    fiPct: 11.4,
    pdPct: 26.8,
    m5sPct: 15.2,
    altriLeftPct: 5.8,
    astensionePct: 11.0,
  },
  {
    regione: "Calabria",
    fdiPct: 26.2,
    legaPct: 9.2,
    fiPct: 18.0,
    pdPct: 15.9,
    m5sPct: 16.2,
    altriLeftPct: 4.5,
    astensionePct: 10.0,
  },
  {
    regione: "Sicilia",
    fdiPct: 23.7,
    legaPct: 7.5,
    fiPct: 20.2,
    pdPct: 14.3,
    m5sPct: 16.0,
    altriLeftPct: 5.3,
    astensionePct: 13.0,
  },
  {
    regione: "Sardegna",
    fdiPct: 22.4,
    legaPct: 6.8,
    fiPct: 12.6,
    pdPct: 27.5,
    m5sPct: 13.2,
    altriLeftPct: 5.5,
    astensionePct: 12.0,
  },
];

export function cdxSharePct(h: Pick<RegionalPartyHistory, "fdiPct" | "legaPct" | "fiPct">): number {
  return h.fdiPct + h.legaPct + h.fiPct;
}

export function leftBlockPct(
  h: Pick<RegionalPartyHistory, "pdPct" | "altriLeftPct">,
): number {
  return h.pdPct + h.altriLeftPct;
}

export function computePermeabilitaVannacciScore(
  row: Omit<
    RegionalPartyHistory,
    "bloccoPrevalente" | "permeabilitaVannacciScore" | "permeabilitaLabel"
  >,
): number {
  const cdxSignal =
    row.legaPct * 1.6 + row.fdiPct * 1.15 + row.fiPct * 0.7;
  const left = row.pdPct + row.altriLeftPct;
  let score = cdxSignal * (100 / 74);
  if (left > 38) score -= (left - 38) * 7.2 + 10;
  else if (left > 32) score -= (left - 32) * 3.8;
  if (row.pdPct > 30) score -= (row.pdPct - 30) * 1.15;
  if (row.astensionePct > 42) score += Math.min(6, (row.astensionePct - 42) * 0.35);
  if (row.pdPct >= 31 && left >= 37) score *= 0.72;
  return Math.round(Math.min(100, Math.max(0, score)));
}

function bloccoFromRow(
  row: Omit<
    RegionalPartyHistory,
    "bloccoPrevalente" | "permeabilitaVannacciScore" | "permeabilitaLabel"
  >,
): BloccoPrevalente {
  const cdx = cdxSharePct(row);
  const left = leftBlockPct(row);
  if (left >= 36 && left > cdx * 0.72) return "BLOCCO STORICO PD / CENTROSINISTRA";
  if (cdx >= 48) return "ROCCAFORTE CENTRODESTRA (LEGA + FDI)";
  return "CONTENDIBILE / ALTO BACINO ASTENSIONE";
}

function permeabilitaLabelFromScore(score: number): string {
  if (score >= 90) return "TERRENO IDEALE — EX LEGA & FDI";
  if (score >= 82) return "MASSIMO POTENZIALE VOTI";
  if (score >= 75) return "ALTA CONVERSIONE";
  if (score >= 65) return "BUONA CONVERSIONE";
  if (score >= 45) return "CONVERSIONE LIMITATA";
  if (score >= 35) return "SOLO PRESIDI MIRATI";
  return "MURO IDEOLOGICO PD — BASSA CONVERSIONE";
}

function buildRegionalHistory(
  row: Omit<
    RegionalPartyHistory,
    "bloccoPrevalente" | "permeabilitaVannacciScore" | "permeabilitaLabel"
  >,
): RegionalPartyHistory {
  const permeabilitaVannacciScore = computePermeabilitaVannacciScore(row);
  return {
    ...row,
    bloccoPrevalente: bloccoFromRow(row),
    permeabilitaVannacciScore,
    permeabilitaLabel: permeabilitaLabelFromScore(permeabilitaVannacciScore),
  };
}

export const REGIONAL_PARTY_HISTORY: Record<Region, RegionalPartyHistory> =
  Object.fromEntries(
    PARTY_ROWS.map((r) => [r.regione, buildRegionalHistory(r)]),
  ) as Record<Region, RegionalPartyHistory>;

export function getRegionalPartyHistory(region: Region): RegionalPartyHistory {
  return REGIONAL_PARTY_HISTORY[region];
}

export const TOPIC_ELASTICITY: Record<TerritoryIssueCategory, number> = {
  SICUREZZA: 1.08,
  LAVORO: 1.05,
  SANITA: 1.0,
  TRASPORTI: 0.98,
  COSTO_VITA: 1.02,
  TERRITORIO: 0.95,
};

export type IssueConversionGain = {
  potentialGainPp: number;
  potentialNewVotes: number;
  campaignVerdict: CampaignVerdictId;
  campaignVerdictText: string;
  fnPromise: FnPromise;
  voteSourceMix: string;
  conversionBadge: "ALTA" | "MIRATA" | "MURO_PD";
};

export function campaignVerdictFromPermeabilita(
  permeabilita: number,
): Pick<IssueConversionGain, "campaignVerdict" | "campaignVerdictText" | "conversionBadge"> {
  if (permeabilita >= 75) {
    return {
      campaignVerdict: "PRIORITA_ASSOLUTA",
      campaignVerdictText:
        "VAI QUI: Forte bacino Lega/FdI ricettivo alle idee di Vannacci. Alto tasso di conversione!",
      conversionBadge: "ALTA",
    };
  }
  if (permeabilita >= 45) {
    return {
      campaignVerdict: "PRESIDIO_MIRATO",
      campaignVerdictText:
        "INTERVENTO MIRATO: Regione contendibile, punta su delusi e astenuti.",
      conversionBadge: "MIRATA",
    };
  }
  return {
    campaignVerdict: "SCONSIGLIATO_MURO_PD",
    campaignVerdictText:
      "BASSA CONVERSIONE (ROCCAFORTE PD/CSX): Storico voto a sinistra ostile a FN. Non disperdere risorse qui.",
    conversionBadge: "MURO_PD",
  };
}

const PRIMARY_BY_CATEGORY: Record<TerritoryIssueCategory, string> = {
  SICUREZZA: "BIP.07",
  LAVORO: "BIP.02",
  SANITA: "BIP.13-SAN",
  TRASPORTI: "BIP.09-TR",
  COSTO_VITA: "BIP.13-CV",
  TERRITORIO: "BIP.15",
};

export function fnPromiseForCategory(
  category: TerritoryIssueCategory,
): FnPromise {
  const id = PRIMARY_BY_CATEGORY[category];
  return (
    FN_PROMISES_CATALOG.find((p) => p.id === id) ??
    FN_PROMISES_CATALOG.find((p) => p.category === category) ??
    FN_PROMISES_CATALOG[0]!
  );
}

export function fnPromiseForIssue(
  category: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
  issueText?: { title?: string; summary?: string },
): FnPromise {
  if (issueText?.title || issueText?.summary) {
    const dossier = matchExactBipSubDossier(
      issueText.title ?? "",
      issueText.summary ?? "",
      category,
    );
    const subId = fnPromiseIdForSubDossier(dossier.id);
    if (subId) {
      const fromSub = FN_PROMISES_CATALOG.find((p) => p.id === subId);
      if (fromSub) return fromSub;
    }
  }
  if (electoralSubTheme === "immigrazione") {
    return FN_PROMISES_CATALOG.find((p) => p.id === "BIP.05") ?? fnPromiseForCategory(category);
  }
  if (electoralSubTheme === "energia") {
    return (
      FN_PROMISES_CATALOG.find((p) => p.id === "BIP.09-EN") ??
      FN_PROMISES_CATALOG.find((p) => p.id === "BIP.09") ??
      fnPromiseForCategory(category)
    );
  }
  if (electoralSubTheme === "fisco_pmi") {
    return FN_PROMISES_CATALOG.find((p) => p.id === "BIP.02") ?? fnPromiseForCategory(category);
  }
  return fnPromiseForCategory(category);
}

function voteSourceMixForRegion(
  history: RegionalPartyHistory,
  flussiAstWeight: number,
): string {
  const ast = Math.round(Math.min(52, Math.max(28, flussiAstWeight * 100)));
  const lega = Math.round(Math.min(42, history.legaPct * 1.05));
  const fdi = Math.round(Math.max(12, 100 - ast - lega));
  return `Recuperati da: Ex-Astenuti (${ast}%) · Elettori Lega delusi (${lega}%) · Elettori FdI (${fdi}%)`;
}

export function computeIssueConversionGain(
  region: Region,
  category: TerritoryIssueCategory,
  impattoScore: number,
  validVotesRegion: number,
  flussiAstWeight = 0.36,
  electoralSubTheme?: ElectoralSubTheme | null,
  issueText?: { title?: string; summary?: string },
): IssueConversionGain {
  const history = getRegionalPartyHistory(region);
  const perm = history.permeabilitaVannacciScore;
  const elasticity = TOPIC_ELASTICITY[category];
  const damp =
    perm < 45 ? 0.42 : perm < 75 ? 0.78 : 1;
  const potentialGainPp =
    Math.round(
      (impattoScore / 100) *
        (perm / 100) ** 1.15 *
        elasticity *
        0.72 *
        damp *
        100,
    ) / 100;
  const clampedPp = Math.min(0.85, Math.max(0.04, potentialGainPp));
  const potentialNewVotes = Math.round(validVotesRegion * (clampedPp / 100));
  const verdict = campaignVerdictFromPermeabilita(perm);
  return {
    potentialGainPp: clampedPp,
    potentialNewVotes,
    ...verdict,
    fnPromise: fnPromiseForIssue(category, electoralSubTheme, issueText),
    voteSourceMix: voteSourceMixForRegion(history, flussiAstWeight),
  };
}

export type RegionalCampaignSummary = {
  regione: Region;
  history: RegionalPartyHistory;
  currentFnSharePct: number;
  validVotesRegion: number;
  maxCumulativeGainPp: number;
  maxCumulativeNewVotes: number;
  reachableSharePct: number;
  strategicExplanation: string;
  topPromiseFocus: { label: string; gainPp: number; gainVotes: number };
  mapVerdictShort: string;
};

export function validVotesFromScenarioRow(
  votiDiScenario: number,
  stimaShare: number,
): number {
  if (stimaShare <= 0.001) return votiDiScenario * 15;
  return Math.round(votiDiScenario / stimaShare);
}

export function buildRegionalCampaignSummary(
  region: Region,
  currentFnSharePct: number,
  validVotesRegion: number,
): RegionalCampaignSummary {
  const history = getRegionalPartyHistory(region);
  const categories: TerritoryIssueCategory[] = [
    "SICUREZZA",
    "LAVORO",
    "SANITA",
    "TRASPORTI",
    "COSTO_VITA",
    "TERRITORIO",
  ];
  const gains = categories
    .map((c) =>
      computeIssueConversionGain(region, c, 82, validVotesRegion),
    )
    .sort((a, b) => b.potentialGainPp - a.potentialGainPp);
  const top3 = gains.slice(0, 3);
  let cumPp = 0;
  for (const g of top3) {
    cumPp += g.potentialGainPp * 0.88;
  }
  cumPp = Math.min(
    history.permeabilitaVannacciScore >= 75 ? 1.85 : history.permeabilitaVannacciScore >= 45 ? 1.05 : 0.55,
    Math.max(0.12, cumPp),
  );
  const maxCumulativeNewVotes = Math.round(validVotesRegion * (cumPp / 100));
  const top = gains[0]!;
  const cdx = cdxSharePct(history);
  const left = leftBlockPct(history);
  const strategicExplanation =
    history.permeabilitaVannacciScore >= 75
      ? `Alta resa: oltre il ${cdx.toFixed(1).replace(".", ",")}% vota già Lega/FdI/FI ed è pronto a premiare FN se risolve i problemi concreti del territorio.`
      : history.permeabilitaVannacciScore < 45
        ? `Bassa resa: il ${history.pdPct.toFixed(1).replace(".", ",")}% vota PD (+ ${history.altriLeftPct.toFixed(1).replace(".", ",")}% CSX): la conversione resta limitata anche a fronte di proposte concrete (< +0,20 pp per tema).`
        : `Resa intermedia: bacino CDX ${cdx.toFixed(1).replace(".", ",")}% vs muro PD ${left.toFixed(1).replace(".", ",")}% — puntare su astenuti e delusi M5S.`;

  const mapVerdictShort =
    history.permeabilitaVannacciScore >= 75
      ? "PRIORITÀ ALTA (Forte bacino Lega/FdI)"
      : history.permeabilitaVannacciScore < 45
        ? "BASSA CONVERSIONE (Roccaforte PD)"
        : "INTERVENTO MIRATO";

  return {
    regione: region,
    history,
    currentFnSharePct,
    validVotesRegion,
    maxCumulativeGainPp: cumPp,
    maxCumulativeNewVotes: maxCumulativeNewVotes,
    reachableSharePct: currentFnSharePct + cumPp,
    strategicExplanation,
    topPromiseFocus: {
      label: top.fnPromise.shortTitle,
      gainPp: top.potentialGainPp,
      gainVotes: top.potentialNewVotes,
    },
    mapVerdictShort,
  };
}

export type CampaignPriorityRow = {
  regione: Region;
  history: RegionalPartyHistory;
  cdxPct: number;
  maxNewVotes: number;
  maxGainPp: number;
};

export function buildCampaignPriorityLists(
  scenarioRows: { regione: Region; stima: number; voti_di_scenario: number }[],
): {
  altaConversione: CampaignPriorityRow[];
  bassaConversione: CampaignPriorityRow[];
} {
  const alta: CampaignPriorityRow[] = [];
  const bassa: CampaignPriorityRow[] = [];
  for (const row of scenarioRows) {
    if (!REGIONS.includes(row.regione)) continue;
    const history = getRegionalPartyHistory(row.regione);
    const valid = validVotesFromScenarioRow(row.voti_di_scenario, row.stima);
    const summary = buildRegionalCampaignSummary(
      row.regione,
      row.stima * 100,
      valid,
    );
    const item: CampaignPriorityRow = {
      regione: row.regione,
      history,
      cdxPct: cdxSharePct(history),
      maxNewVotes: summary.maxCumulativeNewVotes,
      maxGainPp: summary.maxCumulativeGainPp,
    };
    if (history.permeabilitaVannacciScore >= 75) alta.push(item);
    else if (history.permeabilitaVannacciScore < 45) bassa.push(item);
  }
  alta.sort((a, b) => b.maxNewVotes - a.maxNewVotes);
  bassa.sort((a, b) => a.history.permeabilitaVannacciScore - b.history.permeabilitaVannacciScore);
  return { altaConversione: alta, bassaConversione: bassa };
}

export function simulateSelectedIssuesGain(
  region: Region,
  issueIds: string[],
  issues: {
    id: string;
    categoria: TerritoryIssueCategory;
    impattoScore: number;
    conversion?: { potentialGainPp: number; potentialNewVotes: number };
  }[],
  validVotesRegion: number,
): { totalPp: number; totalVotes: number } {
  const selected = issues.filter((i) => issueIds.includes(i.id)).slice(0, 3);
  let totalPp = 0;
  let totalVotes = 0;
  for (const issue of selected) {
    const g =
      issue.conversion ??
      computeIssueConversionGain(
        region,
        issue.categoria,
        issue.impattoScore,
        validVotesRegion,
      );
    totalPp += g.potentialGainPp;
    totalVotes += g.potentialNewVotes;
  }
  return { totalPp, totalVotes };
}
