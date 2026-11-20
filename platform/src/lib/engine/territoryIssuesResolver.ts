import type { Region } from "./constants";
import { REGIONS } from "./constants";
import {
  computeIssueConversionGain,
  TOPIC_ELASTICITY,
} from "@/lib/fnProgramAndAffinityEngine";
import type { EuRegion } from "./types";
import eu2024File from "../../../data/eu2024.json";
import { buildTargetedTrendsForTerritory } from "@/lib/googleTrendsIntelligence";
import {
  catalogIssuesForRegion,
  electoralThemesForRegion,
} from "./territoryIssuesCatalog";
import {
  applyCategoryStressToIssues,
  categoryStressForRegion,
  rankedCategoriesByStress,
} from "./territoryIssueStress";
import {
  dedupeIssues,
  detectElectoralSubTheme,
  orderIssuesForCockpitDisplay,
  storyDedupeKey,
  type TerritoryIssuesResult,
} from "./territoryIssuesEngine";
import { fetchLiveIssues } from "./territoryIssuesLive";
import {
  assessNewsImpatto,
  impattoScoreFromNews,
  isFreshTerritoryNews,
  liveCandidateScore,
} from "./territoryNewsImpact";
import type {
  ElectoralSubTheme,
  TerritoryIssue,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";
import {
  REGIONAL_ELECTORAL_CATS,
  TERRITORY_ISSUE_CATEGORIES,
} from "./territoryIssuesTypes";
import { normalizeTerritoryQueryRegion } from "./territoryIssuesEngine";
import { stripBipFromIssueTitle } from "./bipProblemRadar";
import { applySubDossierToIssueFields } from "./bipSubDossierMatch";
import { ensureMinimumDossiers } from "./regionBenchmarkMatrix";
import { shouldAbstainFromOsservatorio } from "./osservatorioNewsSanitizer";
import { filterTerritoryIssuesPayload } from "./territoryIssuesReadFilter";

const LIVE_BLEND_MIN_SCORE = 70;

/** Max notizie live nel quadro «Tutta l'Italia» (paginazione lato client). */
const NATIONAL_LIVE_OVERVIEW_CAP = 240;

export function eu2024ValidVotesByRegion(): Record<Region, number> {
  const eu = (eu2024File as { D: Record<Region, EuRegion> }).D;
  const out = {} as Record<Region, number>;
  for (const r of REGIONS) {
    out[r] = eu[r]?.valid ?? 400_000;
  }
  return out;
}

/** Unisce RSS di tutte le regioni, deduplica storie, ordina per priorità elettorale. */
export function rankNationalLiveIssues(
  pool: TerritoryIssue[],
  validVotesByRegion: Record<Region, number>,
): TerritoryIssue[] {
  const livePool = pool.filter(
    (i) =>
      i.contentSource === "live" ||
      i.contentSource === "blended" ||
      i.live === true,
  );
  const source = livePool.length > 0 ? livePool : pool;

  const scored = source.map((item) => {
    const reg =
      item.regione !== "NAZIONALE" && REGIONS.includes(item.regione as Region)
        ? (item.regione as Region)
        : ("Lazio" as Region);
    return {
      ...item,
      regione: reg,
      categoryStress:
        item.categoryStress ?? categoryStressForRegion(reg, item.categoria),
      electionScore: computeElectionScore(
        item,
        reg,
        validVotesByRegion[reg] ?? 400_000,
      ),
    };
  });

  scored.sort(
    (a, b) =>
      (b.electionScore ?? 0) - (a.electionScore ?? 0) ||
      (b.impattoScore ?? 0) - (a.impattoScore ?? 0),
  );

  const seen = new Set<string>();
  const deduped: TerritoryIssue[] = [];
  for (const item of scored) {
    const key = storyDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  const ranked = orderIssuesForCockpitDisplay(deduped).slice(
    0,
    NATIONAL_LIVE_OVERVIEW_CAP,
  );
  return ensureMinimumDossiers(ranked, "NAZIONALE", 6);
}

export async function fetchNationalRegionalLiveOverview(): Promise<TerritoryIssue[]> {
  const validVotesByRegion = eu2024ValidVotesByRegion();
  const settled = await Promise.allSettled(
    REGIONS.map((region) => fetchLiveIssues(region)),
  );

  const pool: TerritoryIssue[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i]!;
    const region = REGIONS[i]!;
    if (result.status !== "fulfilled") continue;
    for (const item of result.value) {
      pool.push({ ...item, regione: region });
    }
  }

  try {
    const naz = await fetchLiveIssues("NAZIONALE");
    pool.push(...naz);
  } catch {
    /* optional national RSS */
  }

  return rankNationalLiveIssues(pool, validVotesByRegion);
}

export type TerritoryIssuesRankingMeta = {
  topStressCategory: TerritoryIssueCategory;
  displayCount: number;
  blendedCount: number;
};

export type TerritoryIssuesHybridResult = TerritoryIssuesResult & {
  allThemes?: TerritoryIssue[];
  rankingMeta?: TerritoryIssuesRankingMeta;
};

function trendBoostForCategory(
  region: Region,
  cat: TerritoryIssueCategory,
): number {
  const trends = buildTargetedTrendsForTerritory(region);
  const catNeedle =
    cat === "SANITA"
      ? /sanit|ospedal|liste/
      : cat === "TRASPORTI"
        ? /tren|pendolar|bus/
        : cat === "LAVORO"
          ? /lavor|stipend|pmi/
          : cat === "SICUREZZA"
            ? /sicurezz|degrad|immigr/
            : cat === "COSTO_VITA"
              ? /affitt|bollett|caro/
              : /agricolt|siccit|ambiente/;
  let boost = 0;
  for (const t of trends.slice(0, 8)) {
    if (!catNeedle.test(t.exactQuery.toLowerCase())) continue;
    const n = parseInt(t.surgePct.replace(/[^\d]/g, ""), 10);
    if (!Number.isNaN(n)) boost = Math.max(boost, Math.min(12, n / 10));
  }
  return boost;
}

export function mergeThemeWithLiveEvidence(
  base: TerritoryIssue,
  candidate: TerritoryIssue | undefined,
): TerritoryIssue {
  if (
    !candidate ||
    !isFreshTerritoryNews(candidate.pubDate) ||
    liveCandidateScore(candidate) < LIVE_BLEND_MIN_SCORE ||
    shouldAbstainFromOsservatorio(
      candidate.titoloProblema,
      candidate.sintesiLamentela,
      candidate.sourceUrl ?? "",
    )
  ) {
    return {
      ...base,
      categoryStress: categoryStressForRegion(base.regione as Region, base.categoria),
    };
  }
  const sub: ElectoralSubTheme | null =
    candidate.electoralSubTheme ??
    detectElectoralSubTheme(candidate.titoloProblema, candidate.sintesiLamentela, base.categoria);

  const reg = base.regione as Region;
  const newsImpact = assessNewsImpatto({
    titolo: candidate.titoloProblema,
    snippet: candidate.sintesiLamentela,
    pubDate: candidate.pubDate,
    categoria: base.categoria,
    region: reg,
    sourceUrl: candidate.sourceUrl,
  });
  const fromNews = impattoScoreFromNews(reg, base.categoria, newsImpact, base.impattoScore);

  const mergedTitle = stripBipFromIssueTitle(candidate.titoloProblema);
  const mergedSnippet =
    candidate.sintesiLamentela.length > 40
      ? candidate.sintesiLamentela
      : base.sintesiLamentela;
  const subFields = applySubDossierToIssueFields(
    mergedTitle,
    mergedSnippet,
    base.categoria,
  );

  return {
    ...base,
    titoloProblema: mergedTitle,
    sintesiLamentela: mergedSnippet,
    provinciaComune: candidate.provinciaComune || base.provinciaComune,
    sourceUrl: candidate.sourceUrl,
    pubDate: candidate.pubDate,
    live: true,
    contentSource: "blended",
    verification: "auto",
    electoralSubTheme: sub,
    visualizzazioniStimate: newsImpact.summaryLabel,
    impattoScore: Math.min(
      98,
      Math.round(base.impattoScore * 0.18 + fromNews * 0.82),
    ),
    evidence: {
      title: candidate.titoloProblema,
      snippet: candidate.sintesiLamentela,
      url: candidate.sourceUrl,
      pubDate: candidate.pubDate,
    },
    categoryStress: categoryStressForRegion(base.regione as Region, base.categoria),
    bipSolutions: subFields.bipSolutions,
    bipEmergencyId: subFields.bipEmergencyId,
    bipSolutionBadge: subFields.bipSolutionBadge,
    azionePoliticaConsigliata: {
      ...base.azionePoliticaConsigliata,
      cosaDire: subFields.cosaDire,
    },
  };
}

export function computeElectionScore(
  issue: TerritoryIssue,
  region: Region,
  validVotesRegion: number,
): number {
  const gain = computeIssueConversionGain(
    region,
    issue.categoria,
    issue.impattoScore,
    validVotesRegion,
    0.36,
    issue.electoralSubTheme,
    {
      title: issue.titoloProblema,
      summary: issue.sintesiLamentela,
    },
  );
  const stress = issue.categoryStress ?? categoryStressForRegion(region, issue.categoria);
  const trend = trendBoostForCategory(region, issue.categoria);
  const liveBoost =
    issue.contentSource === "blended" || issue.contentSource === "live" ? 6 : 0;
  const elastic = TOPIC_ELASTICITY[issue.categoria] ?? 1;
  return (
    gain.potentialGainPp * 100 * elastic +
    stress * 0.35 +
    trend +
    liveBoost +
    issue.impattoScore * 0.08
  );
}

/**
 * Card cockpit: tutte le notizie live (problemi reali) + schede catalogo solo
 * per macro-temi senza cronaca in RSS.
 */
export function assembleRegionalIssueCards(
  live: TerritoryIssue[],
  baseThemes: TerritoryIssue[],
  region: Region,
  validVotesRegion: number,
): { display: TerritoryIssue[]; meta: TerritoryIssuesRankingMeta } {
  const stressTop = rankedCategoriesByStress(region)[0]!;
  const display: TerritoryIssue[] = [];
  const catsWithLive = new Set<TerritoryIssueCategory>();

  const liveUnique = dedupeIssues(live);
  const liveSorted = [...liveUnique].sort(
    (a, b) => liveCandidateScore(b) - liveCandidateScore(a),
  );

  for (const item of liveSorted) {
    display.push({
      ...item,
      electionScore: computeElectionScore(item, region, validVotesRegion),
    });
    catsWithLive.add(item.categoria);
  }

  for (const base of baseThemes) {
    if (catsWithLive.has(base.categoria)) continue;
    display.push({
      ...base,
      contentSource: base.contentSource ?? "catalog",
      verification: base.verification ?? "fallback",
      electionScore: computeElectionScore(base, region, validVotesRegion),
    });
  }

  const ordered = ensureMinimumDossiers(
    orderIssuesForCockpitDisplay(dedupeIssues(display)),
    region,
    6,
  );

  return {
    display: ordered,
    meta: {
      topStressCategory: stressTop,
      displayCount: ordered.length,
      blendedCount: display.filter((i) => i.contentSource === "blended").length,
    },
  };
}

/** @deprecated Usare assembleRegionalIssueCards; mantiene compat test con solo temi merged. */
export function selectRegionalDisplayIssues(
  merged: TerritoryIssue[],
  region: Region,
  validVotesRegion: number,
): { display: TerritoryIssue[]; meta: TerritoryIssuesRankingMeta } {
  return assembleRegionalIssueCards([], merged, region, validVotesRegion);
}

export async function resolveTerritoryIssuesHybrid(
  regionParam: string | null | undefined,
  categoryParam: string | null | undefined,
  validVotesRegion = 0,
): Promise<TerritoryIssuesHybridResult> {
  const region = normalizeTerritoryQueryRegion(regionParam);
  const category = categoryParam?.trim().toUpperCase() as
    | TerritoryIssueCategory
    | undefined;
  const categoryFilter =
    category && TERRITORY_ISSUE_CATEGORIES.includes(category)
      ? category
      : null;

  const catalog = dedupeIssues(catalogIssuesForRegion(region));
  let live: TerritoryIssue[] = [];
  if (region !== "NAZIONALE") {
    try {
      live = await fetchLiveIssues(region);
    } catch {
      live = [];
    }
  }

  if (region === "NAZIONALE") {
    let display = await fetchNationalRegionalLiveOverview();
    if (categoryFilter) {
      display = display.filter((i) => i.categoria === categoryFilter);
      display = ensureMinimumDossiers(display, "NAZIONALE", 6).filter(
        (i) => !categoryFilter || i.categoria === categoryFilter,
      );
      if (display.length < 6) {
        display = ensureMinimumDossiers(display, "NAZIONALE", 6);
      }
    }
    const stressTop = rankedCategoriesByStress("Lazio")[0]!;
    return filterTerritoryIssuesPayload({
      region,
      category: categoryFilter,
      issues: display,
      allThemes: catalog,
      liveNews: display,
      rankingMeta: {
        topStressCategory: stressTop,
        displayCount: display.length,
        blendedCount: display.filter((i) => i.contentSource === "blended").length,
      },
      fetchedAt: new Date().toISOString(),
      liveCount: display.length,
      catalogCount: catalog.length,
    });
  }

  const reg = region as Region;
  let baseThemes = electoralThemesForRegion(reg);
  applyCategoryStressToIssues(reg, baseThemes);

  const liveByCat = new Map<TerritoryIssueCategory, TerritoryIssue>();
  for (const item of live) {
    const prev = liveByCat.get(item.categoria);
    if (!prev || liveCandidateScore(item) > liveCandidateScore(prev)) {
      liveByCat.set(item.categoria, item);
    }
  }

  let merged = baseThemes.map((base) =>
    mergeThemeWithLiveEvidence(base, liveByCat.get(base.categoria)),
  );

  if (categoryFilter) {
    merged = merged.filter((i) => i.categoria === categoryFilter);
    live = live.filter((i) => i.categoria === categoryFilter);
  }

  const liveDeduped = dedupeIssues(live);
  const { display, meta } = assembleRegionalIssueCards(
    liveDeduped,
    baseThemes,
    reg,
    validVotesRegion || 1,
  );

  return filterTerritoryIssuesPayload({
    region,
    category: categoryFilter,
    issues: display,
    allThemes: merged,
    /** Pool RSS completo: il client unisce a `issues` (card piene, compat cache legacy 6+lista). */
    liveNews: liveDeduped,
    rankingMeta: meta,
    fetchedAt: new Date().toISOString(),
    liveCount: live.length,
    catalogCount: catalog.length,
  });
}

void REGIONAL_ELECTORAL_CATS;
