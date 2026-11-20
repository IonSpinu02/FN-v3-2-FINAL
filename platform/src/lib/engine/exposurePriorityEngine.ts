import { CIRC, REGIONS, type Region } from "@/lib/engine/constants";
import { REGION_REFERENCE_STRESS } from "@/lib/engine/fabbisogniCatalogFallback";
import { categoryStressForRegion } from "@/lib/engine/territoryIssueStress";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";

/** Disagio strutturale #1 su cui esporsi: scheda territoriale, non modello casuale. */
export const PRIMARY_SOCIAL_ISSUE: Record<
  Region,
  { label: string; category: TerritoryIssueCategory; keywords: string[] }
> = {
  Lombardia: {
    label: "Sicurezza Stazioni e Carceri (San Vittore >200%)",
    category: "SICUREZZA",
    keywords: ["stazione", "centrale", "san vittore", "carcer", "degrado", "milano"],
  },
  Veneto: {
    label: "Caro Energia PMI, Fisco e Furti in Abitazione",
    category: "COSTO_VITA",
    keywords: ["bollett", "energia", "pmi", "furti", "abitaz", "fisco"],
  },
  Piemonte: {
    label: "Crisi Filiera Automotive e Cassa Integrazione",
    category: "LAVORO",
    keywords: ["auto", "mirafiori", "cassa integrazione", "industria", "stellantis"],
  },
  Calabria: {
    label: "Liste d'Attesa Sanità (54 gg) e Dissesto Comuni",
    category: "SANITA",
    keywords: ["liste d'attesa", "sanit", "ospedal", "dissesto", "comuni"],
  },
  Puglia: {
    label: "Emergenza Furti, Sicurezza Agricola e Sanità",
    category: "SICUREZZA",
    keywords: ["furti", "agricol", "sanit", "campagne"],
  },
  "Friuli-Venezia Giulia": {
    label: "Pressione Rotta Balcanica e Costi MSNA sui Comuni",
    category: "SICUREZZA",
    keywords: ["balcan", "msna", "confine", "migrant", "trieste"],
  },
  "Emilia-Romagna": {
    label: "Caro-energia manifattura e PMI, fisco e dissesto idrogeologico",
    category: "LAVORO",
    keywords: ["energia", "bollett", "pmi", "fisco", "dissesto", "idrogeolog", "manifattura"],
  },
  Toscana: {
    label: "Liste d'attesa sanitarie e sovraccarico del costo abitativo",
    category: "SANITA",
    keywords: ["liste d'attesa", "sanit", "ospedal", "mutui", "affitti", "abitativ"],
  },
  Lazio: {
    label: "Emergenza Abitativa, Mutui e Degrado Nodi Ferroviari",
    category: "COSTO_VITA",
    keywords: ["mutui", "affitti", "termini", "esquilino", "abitativ"],
  },
  Liguria: {
    label: "Abitare Costa e Congestione Nodi Portuali",
    category: "COSTO_VITA",
    keywords: ["affitti", "porto", "genova", "abitaz"],
  },
  Campania: {
    label: "Liste d'Attesa Sanità e Lavoro Giovanile",
    category: "SANITA",
    keywords: ["liste d'attesa", "sanit", "disoccupaz", "neet"],
  },
  Sicilia: {
    label: "Flussi Migratori e Caro Trasporti",
    category: "SICUREZZA",
    keywords: ["migrant", "sbarchi", "trasporti", "continuità"],
  },
  Sardegna: {
    label: "Continuità Territoriale e Spopolamento",
    category: "TRASPORTI",
    keywords: ["continuità", "traghetti", "spopolamento", "trasporti"],
  },
  Abruzzo: {
    label: "Sanità Passiva e Disoccupazione Giovanile",
    category: "SANITA",
    keywords: ["sanit", "disoccupaz", "giovan"],
  },
  Molise: {
    label: "Spopolamento e Rete Ospedaliera",
    category: "SANITA",
    keywords: ["spopolamento", "ospedal", "sanit"],
  },
  Basilicata: {
    label: "Accesso alle Cure e Trasporto Interno",
    category: "SANITA",
    keywords: ["sanit", "trasporti", "tpl"],
  },
  Marche: {
    label: "Rinuncia alle Cure e Occupazione",
    category: "SANITA",
    keywords: ["rinuncia", "cure", "occupazione"],
  },
  Umbria: {
    label: "Liste d'Attesa e Aree Interne",
    category: "SANITA",
    keywords: ["liste d'attesa", "aree interne", "sanit"],
  },
  "Valle d'Aosta": {
    label: "Accesso Cure e Collegamenti Montani",
    category: "SANITA",
    keywords: ["cure", "montani", "collegamenti"],
  },
  "Trentino-Alto Adige": {
    label: "Occupazione Dual e TPL Alpino",
    category: "LAVORO",
    keywords: ["occupazione", "tpl", "alpino"],
  },
};

export const MACRO_SOCIAL_ISSUE: Record<
  keyof typeof CIRC,
  { label: string; keywords: string[] }
> = {
  NO: {
    label: "Sicurezza Stazioni & Crisi Auto",
    keywords: ["stazione", "auto", "mirafiori", "san vittore", "bollett"],
  },
  NE: {
    label: "Bollette PMI, Fisco & Confini",
    keywords: ["bollett", "pmi", "fisco", "balcan", "confine", "msna"],
  },
  C: {
    label: "Mutui Giovani & Case Popolari",
    keywords: ["mutui", "affitti", "case popolari", "abitativ", "termini"],
  },
  S: {
    label: "Liste d'Attesa Sanità & Lavoro",
    keywords: ["liste d'attesa", "sanit", "disoccupaz", "lavoro"],
  },
  I: {
    label: "Flussi Migratori & Caro Trasporti",
    keywords: ["migrant", "sbarchi", "trasporti", "continuità", "traghetti"],
  },
};

export type ExposurePriorityCard = {
  regione: Region;
  conversionScore: number;
  socialDistressScore: number;
  primarySocialIssue: string;
  primaryCategory: TerritoryIssueCategory;
  newsHeatBoost: number;
  newsHot: boolean;
  exposurePriorityScore: number;
  elettoriShare: number;
};

export type MacroExposureRow = {
  code: keyof typeof CIRC;
  label: string;
  primaryIssue: string;
  avgConversion: number;
  avgConsensusPct: number;
  leadRegion: Region;
  elettoriShare: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function newsBoostFor(
  region: Region,
  issueKeywords: string[],
  headlines: string[],
): number {
  if (headlines.length === 0) return 0;
  const regionToken = region.toLowerCase();
  let hits = 0;
  for (const title of headlines) {
    const t = title.toLowerCase();
    if (t.includes(regionToken)) hits += 1;
    else if (issueKeywords.some((k) => t.includes(k))) hits += 0.5;
  }
  if (hits <= 0) return 0;
  return clamp(Math.round(hits * 5), 5, 15);
}

export function buildExposurePriorityCards(input: {
  rows: {
    regione: Region;
    stima: number;
    voti_di_scenario: number;
    elettori_ricostruiti: number;
  }[];
  newsHeadlines?: string[];
}): ExposurePriorityCard[] {
  const headlines = input.newsHeadlines ?? [];
  const totalElettori =
    input.rows.reduce((sum, row) => sum + row.elettori_ricostruiti, 0) || 1;

  const cards = REGIONS.map((regione) => {
    const row = input.rows.find((item) => item.regione === regione);
    const history = getRegionalPartyHistory(regione);
    const conversionScore = history.permeabilitaVannacciScore;
    const issue = PRIMARY_SOCIAL_ISSUE[regione];
    const baseStress = REGION_REFERENCE_STRESS[regione];
    const themeStress = categoryStressForRegion(regione, issue.category);
    const socialDistressScore = clamp(Math.round(baseStress * 0.55 + themeStress * 0.45), 0, 100);
    const newsHeatBoost = newsBoostFor(regione, issue.keywords, headlines);
    const elettoriShare = (row?.elettori_ricostruiti ?? 0) / totalElettori;
    const microPenalty = elettoriShare < 0.01 ? 12 : elettoriShare < 0.02 ? 6 : 0;
    const raw = conversionScore * 0.55 + socialDistressScore * 0.35 + newsHeatBoost;
    const exposurePriorityScore = clamp(Math.round(raw - microPenalty), 0, 100);
    return {
      regione,
      conversionScore,
      socialDistressScore,
      primarySocialIssue: issue.label,
      primaryCategory: issue.category,
      newsHeatBoost,
      newsHot: newsHeatBoost > 0,
      exposurePriorityScore,
      elettoriShare,
    };
  });

  return cards.sort((a, b) => b.exposurePriorityScore - a.exposurePriorityScore);
}

export function buildMacroExposureRows(
  cards: ExposurePriorityCard[],
  rows: { regione: Region; elettori_ricostruiti: number; stima?: number }[],
  pollByRegion?: Record<string, { piHat: number }>,
): MacroExposureRow[] {
  const totalElettori =
    rows.reduce((sum, row) => sum + row.elettori_ricostruiti, 0) || 1;
  const byRegion = new Map(cards.map((card) => [card.regione, card]));

  return (Object.keys(CIRC) as (keyof typeof CIRC)[]).map((code) => {
    const regions = CIRC[code];
    const areaCards = regions
      .map((reg) => byRegion.get(reg))
      .filter((card): card is ExposurePriorityCard => Boolean(card));
    const lead =
      [...areaCards].sort((a, b) => b.exposurePriorityScore - a.exposurePriorityScore)[0] ??
      cards[0]!;
    const avgConversion = Math.round(
      areaCards.reduce((sum, card) => sum + card.conversionScore, 0) /
        Math.max(1, areaCards.length),
    );
    let voteWeight = 0;
    let consensusWeighted = 0;
    for (const reg of regions) {
      const row = rows.find((item) => item.regione === reg);
      const share = pollByRegion?.[reg]?.piHat ?? row?.stima ?? 0;
      const weight = Math.max(1, row?.elettori_ricostruiti ?? 1);
      voteWeight += weight;
      consensusWeighted += share * weight;
    }
    const avgConsensusPct =
      Math.round(((consensusWeighted / Math.max(1, voteWeight)) * 100) * 10) / 10;
    const elettori = regions.reduce(
      (sum, reg) => sum + (rows.find((row) => row.regione === reg)?.elettori_ricostruiti ?? 0),
      0,
    );
    const meta = MACRO_SOCIAL_ISSUE[code];
    return {
      code,
      label:
        code === "NO"
          ? "Nord-Ovest"
          : code === "NE"
            ? "Nord-Est"
            : code === "C"
              ? "Centro"
              : code === "S"
                ? "Sud"
                : "Isole",
      primaryIssue: meta.label,
      avgConversion,
      avgConsensusPct,
      leadRegion: lead.regione,
      elettoriShare: elettori / totalElettori,
    };
  });
}
