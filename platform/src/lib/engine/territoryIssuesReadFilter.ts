import { isCulturalHistoricalAbstention, isTerritoryIssueAbstention } from "./osservatorioNewsSanitizer";
import type { TerritoryIssuesHybridResult } from "./territoryIssuesResolver";
import type { TerritoryIssue } from "./territoryIssuesTypes";

/** Versione filtro in lettura: bump per invalidare payload cache pre-fix. */
export const TERRITORY_ISSUES_READ_FILTER_VERSION = "v10-abstain-cultural";

function isLiveLike(issue: TerritoryIssue): boolean {
  return (
    issue.live === true ||
    issue.contentSource === "live" ||
    issue.contentSource === "blended" ||
    Boolean(issue.evidence?.url)
  );
}

export function filterTerritoryIssuesList(
  issues: TerritoryIssue[],
  mode: "live" | "auto" = "auto",
): TerritoryIssue[] {
  return issues.filter((issue) => {
    const title = issue.titoloProblema ?? issue.evidence?.title ?? "";
    const snippet = issue.sintesiLamentela ?? issue.evidence?.snippet ?? "";
    const url = issue.sourceUrl ?? issue.evidence?.url ?? "";
    if (mode === "live" || isLiveLike(issue)) {
      return !isTerritoryIssueAbstention(issue);
    }
    // Schede catalogo strutturali: solo blacklist culturale (niente require socio-economico).
    return !isCulturalHistoricalAbstention(title, snippet, url);
  });
}

/**
 * Applica sempre il sanitizer/astensione in uscita dalla cache o dal resolver,
 * così nessun titolo culturale (es. Cristina di Svezia) sopravvive come caro-vita.
 */
export function filterTerritoryIssuesPayload(
  payload: TerritoryIssuesHybridResult,
): TerritoryIssuesHybridResult {
  const issues = filterTerritoryIssuesList(payload.issues ?? [], "auto");
  const liveNews = filterTerritoryIssuesList(payload.liveNews ?? [], "live");
  const allThemes = payload.allThemes
    ? filterTerritoryIssuesList(payload.allThemes, "auto")
    : payload.allThemes;
  return {
    ...payload,
    issues,
    liveNews,
    allThemes,
    liveCount: liveNews.length,
    rankingMeta: payload.rankingMeta
      ? {
          ...payload.rankingMeta,
          displayCount: issues.length,
          blendedCount: issues.filter((i) => i.contentSource === "blended").length,
        }
      : payload.rankingMeta,
  };
}
