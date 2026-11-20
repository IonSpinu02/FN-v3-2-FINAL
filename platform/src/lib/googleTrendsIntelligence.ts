import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import {
  getRegionalPartyHistory,
  validVotesFromScenarioRow,
} from "@/lib/fnProgramAndAffinityEngine";
import {
  bipAzioneCampoForCategory,
  bipSoluzionePraticaForCategory,
  getBipMessaging,
  resolveBipChapterForIssue,
} from "@/lib/bipProgramCatalog";
import { formatBipSolutionBadge } from "@/lib/engine/bipProblemRadar";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { GoogleTrendsSeries } from "@/lib/engine/osservatorioTypes";
import { BIP_FLAGSHIP_TREND_TEMPLATES } from "./googleTrendsBipCatalog";
import {
  breakoutQueriesForSeed,
  regionalTrendSeedsFor,
  type RegionalGoogleTrendSeed,
} from "./googleTrendsRegionalCatalog";

export type TrendsClusterId =
  | "PARTITO_LEADER"
  | "SANITA_CUP"
  | "SICUREZZA_CITTA"
  | "LAVORO_AUTO_GREEN"
  | "FAMIGLIA_CASA"
  | "TRASPORTI_PENDOLARI"
  | "AGRICOLTURA_TERRITORIO";

export type TrendsClusterFilter = TrendsClusterId | "SURGE_ALL";

export type TrendsWindowDays = 7 | 14 | 30;

export type TrendsQueryTypeLabel =
  | "Termine di ricerca testuale"
  | "Argomento riconosciuto da Google";

export type PianoRisoluzioneTrend = {
  causaRadice: string;
  soluzionePratica: string;
  enteCompetente: string;
  tempiAttuazione: string;
  azioneSulCampo48h: string;
  bipChapter: number;
  bipChapterTitle: string;
  bipBadgeLabel: string;
  messaggioStampa: string;
};

export type TargetedTrendItem = {
  id: string;
  cluster: TrendsClusterId;
  exactQuery: string;
  queryType: TrendsQueryTypeLabel;
  currentIndex0100: number;
  peakIndex0100: number;
  surgePct: string;
  surgeNumeric: number;
  /** google_rss: etichetta di traffico arrivata dal feed. scheda: cifra di catalogo o pseudocasuale. */
  provenance: "google_rss" | "bozza_catalogo";
  relatedQueries: [string, string, string];
  series30d: { date: string; value: number }[];
  datoOggettivoModuloB: string;
  pianoRisoluzione: PianoRisoluzioneTrend;
};

export type TrendsTerritoryMode = "NAZIONALE" | Region;

export const TRENDS_CLUSTER_LABELS: Record<TrendsClusterId, string> = {
  PARTITO_LEADER: "Partito & Vannacci",
  SANITA_CUP: "Sanità & Liste d'Attesa",
  SICUREZZA_CITTA: "Sicurezza & Degrado",
  LAVORO_AUTO_GREEN: "Lavoro, Auto & Norme Green",
  FAMIGLIA_CASA: "Casa, Mutui & Caro-Vita",
  TRASPORTI_PENDOLARI: "Treni, Strade & Pendolari",
  AGRICOLTURA_TERRITORIO: "Agricoltura & Territorio",
};

type PianoRisoluzioneTemplate = Omit<
  PianoRisoluzioneTrend,
  "bipChapter" | "bipChapterTitle" | "bipBadgeLabel" | "messaggioStampa"
>;

type TrendTemplate = {
  slug: string;
  cluster: TrendsClusterId;
  exactQuery: string;
  queryType: TrendsQueryTypeLabel;
  category: TerritoryIssueCategory;
  datoBase: string;
  piano: PianoRisoluzioneTemplate;
};

export function buildBipPianoRisoluzione(
  category: TerritoryIssueCategory,
  base: PianoRisoluzioneTemplate,
): PianoRisoluzioneTrend {
  const msg = getBipMessaging(category);
  return {
    ...base,
    bipChapter: resolveBipChapterForIssue(category),
    bipChapterTitle: msg.chapterTitle,
    bipBadgeLabel: formatBipSolutionBadge(
      msg.chapterNum,
      msg.chapterTitle,
      msg.pages.replace(/^pp\.\s*/, ""),
    ),
    messaggioStampa: msg.pressDeclaration,
    soluzionePratica: base.soluzionePratica?.trim()
      ? base.soluzionePratica
      : bipSoluzionePraticaForCategory(category),
    enteCompetente: msg.provvedimento.enteCompetente,
    tempiAttuazione: msg.provvedimento.tempiAttuazione,
    azioneSulCampo48h: base.azioneSulCampo48h?.trim() || bipAzioneCampoForCategory(category),
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rand01(seed: number, salt: number): number {
  const x = Math.sin((seed + salt) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function territoryKey(mode: TrendsTerritoryMode): string {
  return mode === "NAZIONALE" ? "Italia" : mode;
}

function formatSurge(pct: number): { label: string; numeric: number } {
  const rounded = Math.round(pct);
  if (rounded >= 200) {
    return { label: `+${rounded}% (Impennata)`, numeric: rounded };
  }
  return { label: `+${rounded}%`, numeric: rounded };
}

function buildSeries30d(seed: string, peakBias: number): { date: string; value: number }[] {
  const base = hashSeed(seed);
  const points: { date: string; value: number }[] = [];
  const start = new Date("2026-09-22T00:00:00Z");
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const wave =
      18 +
      peakBias * 0.55 +
      rand01(base, i * 3) * 22 +
      (i >= 22 ? (i - 21) * (4 + peakBias * 0.08) : 0);
    const value = Math.min(100, Math.max(0, Math.round(wave)));
    if (value > peak) peak = value;
    points.push({ date: d.toISOString().slice(0, 10), value });
  }
  const maxV = Math.max(...points.map((p) => p.value), 1);
  return points.map((p) => ({
    date: p.date,
    value: Math.round((p.value / maxV) * 100),
  }));
}

function sliceWindow(
  series: { date: string; value: number }[],
  days: TrendsWindowDays,
): { date: string; value: number }[] {
  return series.slice(-days);
}

function relatedForRegion(
  region: TrendsTerritoryMode,
  cluster: TrendsClusterId,
  slug: string,
): [string, string, string] {
  const key = region === "NAZIONALE" ? "Italia" : region;
  const bank: Partial<Record<TrendsClusterId, Record<string, [string, string, string]>>> = {
    SANITA_CUP: {
      Lazio: ["Recup Lazio tempi", "pronto soccorso Roma code", "rimborso visite private"],
      Lombardia: ["PagoPA CUP Lombardia", "visite intramoenia Milano", "ticket esenzione"],
      Campania: ["liste attesa Napoli", "118 tempi risposta", "farmaci caro ticket"],
    },
    LAVORO_AUTO_GREEN: {
      Lombardia: ["Area B Milano divieti", "deroga Euro 5 Regione", "incentivi rottamazione"],
      Piemonte: ["ZTL Torino Euro 5", "bonus caldaie", "mobilità alternativa"],
      "Emilia-Romagna": ["blocco diesel Bologna", "fondi PMI green", "deroga qualità aria"],
    },
    TRASPORTI_PENDOLARI: {
      Lazio: ["treni regionali Lazio ritardo", "rimborso abbonamento", "sciopero Trenitalia"],
      Lombardia: ["Trenord ritardi oggi", "abbonamento mensile caro", "Malpensa Express"],
    },
    SICUREZZA_CITTA: {
      Lazio: ["Termini sicurezza", "furti metro Roma", "baby gang periferia"],
      Lombardia: ["Centrale Milano furti", "occupazione abusiva", "presidio stazione"],
    },
  };
  const clusterMap = bank[cluster];
  if (clusterMap?.[key as Region]) return clusterMap[key as Region]!;
  const seed = hashSeed(`${key}-${cluster}-${slug}`);
  const generic = [
    `${key.split(" ")[0]} urgenza ${slug.replace(/-/g, " ")}`,
    `come funziona ${slug.replace(/-/g, " ")}`,
    `reclamo ${cluster.toLowerCase()}`,
  ] as [string, string, string];
  generic[0] = generic[0].slice(0, 42);
  void seed;
  return generic;
}

/** Solo ricerche cittadine con soluzione B.I.P. (catalogo flagship). */
export const TRENDS_TOPIC_CLUSTERS: TrendTemplate[] = BIP_FLAGSHIP_TREND_TEMPLATES.map(
  (f) => ({
    slug: f.slug,
    cluster: f.cluster,
    exactQuery: f.exactQuery,
    queryType: f.queryType,
    category: f.category,
    datoBase: f.datoBase,
    piano: {
      causaRadice: f.causaRadice,
      soluzionePratica: f.soluzioneBip,
      enteCompetente: f.enteCompetente,
      tempiAttuazione: f.tempiAttuazione,
      azioneSulCampo48h: f.azioneSulCampo48h,
    },
  }),
);


function regionalSeedToTargetedItem(
  seed: RegionalGoogleTrendSeed,
  region: Region,
): TargetedTrendItem {
  const seedStr = `${region}|${seed.slug}`;
  const series30d = buildSeries30d(seedStr, seed.fixedIndex);
  const surge = formatSurge(seed.fixedSurgePct);
  return {
    id: seedStr,
    cluster: seed.cluster,
    exactQuery: seed.exactQuery,
    queryType: seed.queryType,
    currentIndex0100: seed.fixedIndex,
    peakIndex0100: Math.min(100, seed.fixedIndex + 6),
    surgePct: surge.label,
    surgeNumeric: surge.numeric,
    provenance: "bozza_catalogo",
    relatedQueries: [
      seed.relatedQueries[0],
      seed.relatedQueries[1],
      seed.relatedQueries[2],
    ] as [string, string, string],
    series30d,
    datoOggettivoModuloB: seed.datoOggettivoModuloB,
    pianoRisoluzione: buildBipPianoRisoluzione(seed.category, {
      causaRadice: seed.causaRadice,
      soluzionePratica: seed.soluzioneBip,
      enteCompetente: seed.enteCompetente,
      tempiAttuazione: seed.tempiAttuazione,
      azioneSulCampo48h: seed.azioneSulCampo48h,
    }),
  };
}

function buildNationalMixTrends(): TargetedTrendItem[] {
  const pickRegions: Region[] = [
    "Lombardia",
    "Lazio",
    "Sicilia",
    "Campania",
    "Puglia",
    "Piemonte",
    "Veneto",
    "Toscana",
    "Emilia-Romagna",
  ];
  const items: TargetedTrendItem[] = [];
  for (const r of pickRegions) {
    const top = regionalTrendSeedsFor(r)[0];
    if (top) items.push(regionalSeedToTargetedItem(top, r));
  }
  return items.sort((a, b) => b.surgeNumeric - a.surgeNumeric);
}

function enrichTemplate(
  tpl: TrendTemplate,
  territory: TrendsTerritoryMode,
): TargetedTrendItem {
  const tKey = territoryKey(territory);
  const seedStr = `${tKey}-${tpl.slug}`;
  const seed = hashSeed(seedStr);
  const flagship = BIP_FLAGSHIP_TREND_TEMPLATES.find((f) => f.slug === tpl.slug);
  const peakBias = flagship?.fixedIndex ?? 40 + rand01(seed, 1) * 55;
  const series30d = buildSeries30d(seedStr, peakBias);
  const peakIndex0100 = flagship?.fixedIndex ?? Math.max(...series30d.map((p) => p.value));
  const currentIndex0100 =
    flagship?.fixedIndex ?? series30d[series30d.length - 1]?.value ?? 0;
  const weekAgo = series30d[series30d.length - 8]?.value ?? 1;
  const surgeRaw = weekAgo > 0 ? ((currentIndex0100 - weekAgo) / weekAgo) * 100 : 120;
  const surge = flagship
    ? formatSurge(flagship.fixedSurgePct)
    : formatSurge(Math.max(35, surgeRaw + rand01(seed, 9) * 80));

  const regionLabel = territory === "NAZIONALE" ? "Italia" : territory;
  const datoOggettivoModuloB = tpl.datoBase.replace(
    /Lazio e Campania|nazionale|12 regioni|18 province|6 regioni|15 regioni|11 capoluoghi|4 regioni|9 regioni/gi,
    (m) => {
      if (territory === "NAZIONALE") return m;
      return `${regionLabel} (focus territoriale)`;
    },
  );

  return {
    id: `${tKey}-${tpl.slug}`,
    cluster: tpl.cluster,
    exactQuery: tpl.exactQuery,
    queryType: tpl.queryType,
    currentIndex0100,
    peakIndex0100,
    surgePct: surge.label,
    surgeNumeric: surge.numeric,
    provenance: "bozza_catalogo",
    relatedQueries: flagship
      ? ([
          flagship.relatedQueries[0],
          flagship.relatedQueries[1],
          flagship.relatedQueries[2],
        ] as [string, string, string])
      : relatedForRegion(territory, tpl.cluster, tpl.slug),
    series30d,
    datoOggettivoModuloB,
    pianoRisoluzione: buildBipPianoRisoluzione(tpl.category, {
      ...tpl.piano,
      causaRadice: tpl.piano.causaRadice.replace(/\.$/, "") + ` (${regionLabel}).`,
      azioneSulCampo48h: tpl.piano.azioneSulCampo48h.replace(
        "capoluogo",
        territory === "NAZIONALE" ? "capoluoghi prioritari" : `capoluogo di ${regionLabel}`,
      ),
    }),
  };
}

export function buildTargetedTrendsForTerritory(
  territory: TrendsTerritoryMode,
): TargetedTrendItem[] {
  if (territory === "NAZIONALE") {
    return buildNationalMixTrends();
  }
  return regionalTrendSeedsFor(territory).map((seed) =>
    regionalSeedToTargetedItem(seed, territory),
  );
}

export function filterTrendsByCluster(
  items: TargetedTrendItem[],
  filter: TrendsClusterFilter,
): TargetedTrendItem[] {
  if (filter === "SURGE_ALL") {
    return items.filter((i) => i.surgeNumeric >= 90 || i.currentIndex0100 >= 72);
  }
  return items.filter((i) => i.cluster === filter);
}

/** Prime 6 righe: una per pilastro (Sanità → Trasporti → Lavoro → Sicurezza → Famiglia → Agricoltura). */
const SIX_PILLAR_ROTATION: TrendsClusterId[] = [
  "FAMIGLIA_CASA",
  "LAVORO_AUTO_GREEN",
  "SICUREZZA_CITTA",
  "TRASPORTI_PENDOLARI",
  "AGRICOLTURA_TERRITORIO",
  "SICUREZZA_CITTA",
];

export function orderTrendsForSixPillarDisplay(
  items: TargetedTrendItem[],
): TargetedTrendItem[] {
  const byAttention = sortTrendsByAttention(items);
  const used = new Set<string>();
  const head: TargetedTrendItem[] = [];
  for (const cluster of SIX_PILLAR_ROTATION) {
    const pick = byAttention.find((t) => t.cluster === cluster && !used.has(t.id));
    if (pick) {
      used.add(pick.id);
      head.push(pick);
    }
  }
  const tail = byAttention.filter((t) => !used.has(t.id));
  return [...head, ...tail];
}

export function sortTrendsByAttention(items: TargetedTrendItem[]): TargetedTrendItem[] {
  return [...items].sort((a, b) => {
    const aMeasured = a.provenance === "google_rss" ? 1 : 0;
    const bMeasured = b.provenance === "google_rss" ? 1 : 0;
    if (aMeasured !== bMeasured) return bMeasured - aMeasured;
    if (!aMeasured) return a.exactQuery.localeCompare(b.exactQuery, "it");
    return b.surgeNumeric - a.surgeNumeric || b.currentIndex0100 - a.currentIndex0100;
  });
}

/** Indici relativi decrescenti in lista (evita 100/100 su tutte le righe). */
const RELATIVE_INDEX_LADDER = [100, 92, 85, 79, 73, 68, 62, 56, 51] as const;

function regionalSeedFromTrendId(id: string): RegionalGoogleTrendSeed | undefined {
  const pipe = id.indexOf("|");
  if (pipe > 0) {
    const region = id.slice(0, pipe) as Region;
    const slug = id.slice(pipe + 1);
    return regionalTrendSeedsFor(region).find((s) => s.slug === slug);
  }
  const dash = id.indexOf("-");
  if (dash <= 0) return undefined;
  const region = id.slice(0, dash) as Region;
  const slug = id.slice(dash + 1);
  return regionalTrendSeedsFor(region).find((s) => s.slug === slug);
}

export function withRelativeDisplayIndices(items: TargetedTrendItem[]): TargetedTrendItem[] {
  const sorted = orderTrendsForSixPillarDisplay(items);
  return sorted.map((item, rank) => {
    if (item.provenance === "google_rss") return item;
    const regional = regionalSeedFromTrendId(item.id);
    if (regional) {
      return {
        ...item,
        currentIndex0100: regional.fixedIndex,
        peakIndex0100: Math.min(100, regional.fixedIndex + 6),
        surgePct: `+${regional.fixedSurgePct}%`,
        surgeNumeric: regional.fixedSurgePct,
        provenance: "bozza_catalogo",
      };
    }
    const flagship = BIP_FLAGSHIP_TREND_TEMPLATES.find((f) => item.id.endsWith(f.slug));
    if (flagship) {
      return {
        ...item,
        currentIndex0100: flagship.fixedIndex,
        peakIndex0100: Math.min(100, flagship.fixedIndex + 6),
        surgePct: `+${flagship.fixedSurgePct}%`,
        surgeNumeric: flagship.fixedSurgePct,
        provenance: "bozza_catalogo",
      };
    }
    const relativeIndex =
      rank < RELATIVE_INDEX_LADDER.length
        ? RELATIVE_INDEX_LADDER[rank]!
        : Math.max(24, 51 - (rank - RELATIVE_INDEX_LADDER.length + 1) * 4);
    const peak = Math.min(100, relativeIndex + 6 + (rank % 3));
    return {
      ...item,
      currentIndex0100: relativeIndex,
      peakIndex0100: Math.max(item.peakIndex0100, peak),
    };
  });
}

const LIST_SURGE_FALLBACK = [142, 128, 115, 104, 98, 91, 86, 81, 76, 72, 68, 64] as const;

/** Percentuale crescita mostrata in lista (non il testo RSS grezzo). */
export function trendDisplaySurgePercent(item: TargetedTrendItem, rank: number): number {
  if (item.surgeNumeric >= 40 && item.surgeNumeric <= 320) return item.surgeNumeric;
  return LIST_SURGE_FALLBACK[rank] ?? Math.max(42, 64 - (rank - 11) * 3);
}

export function clusterCategoryPill(cluster: TrendsClusterId): string {
  const map: Record<TrendsClusterId, string> = {
    PARTITO_LEADER: "PARTITO",
    SANITA_CUP: "SANITÀ",
    SICUREZZA_CITTA: "SICUREZZA",
    LAVORO_AUTO_GREEN: "LAVORO & ENERGIA",
    FAMIGLIA_CASA: "FAMIGLIA",
    TRASPORTI_PENDOLARI: "TRASPORTI",
    AGRICOLTURA_TERRITORIO: "AGRICOLTURA",
  };
  return map[cluster];
}

export function bipPillarLabelForTrend(item: TargetedTrendItem): string {
  const regional = regionalSeedFromTrendId(item.id);
  if (regional) return regional.pillarLabel;
  const flagship = BIP_FLAGSHIP_TREND_TEMPLATES.find((f) => item.id.endsWith(f.slug));
  return flagship?.pillarLabel ?? clusterCategoryPill(item.cluster);
}

export type BreakoutRelatedQuery = { query: string; growthPct: number };

const BREAKOUT_BY_SLUG: Record<string, BreakoutRelatedQuery[]> = {
  "carenza-medici": [
    { query: "medico di base scoperto ASL", growthPct: 190 },
    { query: "fascicolo sanitario cambio medico", growthPct: 145 },
    { query: "guardia medica orari", growthPct: 110 },
    { query: "ricetta medica senza medico", growthPct: 95 },
  ],
  "treni-ritardi-rimborso": [
    { query: "rimborso abbonamento ritardi", growthPct: 175 },
    { query: "treni soppressi oggi linea", growthPct: 160 },
    { query: "bonus trasporti regione", growthPct: 120 },
    { query: "sciopero treni garantiti", growthPct: 105 },
  ],
  "cup-tempi-specialistica": [
    { query: "prenotazione CUP tempi massimi", growthPct: 168 },
    { query: "visite private rimborso SSN", growthPct: 132 },
    { query: "lista attesa risonanza", growthPct: 118 },
    { query: "cup online non funziona", growthPct: 92 },
  ],
  "pronto-soccorso-code": [
    { query: "tempo attesa pronto soccorso oggi", growthPct: 155 },
    { query: "codice bianco dove andare", growthPct: 128 },
    { query: "guardia medica h24", growthPct: 112 },
    { query: "118 quando chiamare", growthPct: 88 },
  ],
  "stazione-sicurezza": [
    { query: "denuncia furto stazione", growthPct: 148 },
    { query: "videosorveglianza stazione", growthPct: 121 },
    { query: "presidio polizia binari", growthPct: 102 },
    { query: "furti metro denuncia", growthPct: 89 },
  ],
  "gasolio-agricolo": [
    { query: "detrazione gasolio agricolo", growthPct: 162 },
    { query: "accise gasolio trattori", growthPct: 138 },
    { query: "coldiretti protesta gasolio", growthPct: 115 },
    { query: "credito imposta agricoltura", growthPct: 94 },
  ],
};

function slugFromTrendItem(item: TargetedTrendItem): string | null {
  const tpl = TRENDS_TOPIC_CLUSTERS.find((t) => t.exactQuery === item.exactQuery);
  return tpl?.slug ?? null;
}

export function breakoutRelatedQueries(item: TargetedTrendItem): BreakoutRelatedQuery[] {
  const regional = regionalSeedFromTrendId(item.id);
  if (regional) return breakoutQueriesForSeed(regional);
  const slug = slugFromTrendItem(item);
  if (slug && BREAKOUT_BY_SLUG[slug]) return BREAKOUT_BY_SLUG[slug]!;
  const seed = hashSeed(item.id);
  const growths = [190, 145, 110, 95];
  return item.relatedQueries.slice(0, 4).map((q, i) => ({
    query: q.replace(/^…/, item.exactQuery.split(" ").slice(0, 3).join(" ")),
    growthPct: growths[i]! - Math.round(rand01(seed, i + 2) * 18),
  }));
}

export function ensureTrendSeries30d(item: TargetedTrendItem): TargetedTrendItem {
  if (item.series30d.length >= 14) return item;
  const seedStr = item.id;
  const peakBias = item.currentIndex0100;
  return { ...item, series30d: buildSeries30d(seedStr, peakBias) };
}

export function targetedTrendToGoogleTrendsSeries(
  item: TargetedTrendItem,
  territory: TrendsTerritoryMode,
  windowDays: TrendsWindowDays,
): GoogleTrendsSeries {
  const points = sliceWindow(item.series30d, windowDays);
  return {
    id: item.id,
    query: item.exactQuery,
    queryType:
      item.queryType === "Argomento riconosciuto da Google" ? "topic" : "term",
    territory: territoryKey(territory),
    windowStart: points[0]?.date ?? item.series30d[0]!.date,
    windowEnd: points[points.length - 1]?.date ?? item.series30d.at(-1)!.date,
    extractedAt: new Date().toISOString(),
    isDemo: true,
    points,
  };
}

export type TrendElectoralImpact = {
  kind: "high" | "limited";
  label: string;
  gainPp?: number;
  gainVotes?: number;
  historyNote: string;
};

/**
 * Non collega mai ricerche online a stime di consenso/voti.
 * L’attenzione digitale ≠ consenso elettorale (C10, C11).
 */
export function computeTrendElectoralImpact(
  region: Region,
  item: TargetedTrendItem,
  _validVotesRegion: number,
): TrendElectoralImpact {
  const history = getRegionalPartyHistory(region);
  const measured = item.provenance === "google_rss";
  return {
    kind: "limited",
    label: measured
      ? "Attenzione online osservata · nessun trasferimento voti stimato"
      : "Bozza di catalogo · esclusa dal peso della mossa",
    historyNote: `Contesto territoriale: ${history.bloccoPrevalente} · permeabilità ${history.permeabilitaVannacciScore}/100. L'attenzione online non implica guadagno di punti percentuali o voti.`,
  };
}

export function allTrendsTerritories(): TrendsTerritoryMode[] {
  return ["NAZIONALE", ...REGIONS];
}

export function defaultSelectedTrendId(
  items: TargetedTrendItem[],
): string | null {
  const sorted = sortTrendsByAttention(items);
  return sorted[0]?.id ?? null;
}

export function resolveTrendRegionForElectoral(
  territory: TrendsTerritoryMode,
  fallback: Region,
): Region {
  return territory === "NAZIONALE" ? fallback : territory;
}

export { validVotesFromScenarioRow };
