import type { Region } from "./constants";
import { REGION_REFERENCE_STRESS } from "./fabbisogniCatalogFallback";
import type { TerritoryIssue, TerritoryIssueCategory } from "./territoryIssuesTypes";
import { REGIONAL_ELECTORAL_CATS } from "./territoryIssuesTypes";

/** Proxy stress per macro-tema quando fabbisogni JSON non ha voce dedicata. */
const CATEGORY_STRESS_OFFSET: Record<TerritoryIssueCategory, number> = {
  SANITA: 8,
  TRASPORTI: 2,
  LAVORO: 0,
  SICUREZZA: 6,
  COSTO_VITA: 4,
  TERRITORIO: 5,
};

export function categoryStressForRegion(
  region: Region,
  cat: TerritoryIssueCategory,
): number {
  const base = REGION_REFERENCE_STRESS[region];
  const off = CATEGORY_STRESS_OFFSET[cat];
  const wave = (base + off + cat.charCodeAt(0)) % 11;
  return Math.min(100, Math.max(28, base + off - 5 + wave));
}

export function rankedCategoriesByStress(region: Region): TerritoryIssueCategory[] {
  return [...REGIONAL_ELECTORAL_CATS].sort(
    (a, b) => categoryStressForRegion(region, b) - categoryStressForRegion(region, a),
  );
}

export function applyCategoryStressToIssues(
  region: Region,
  issues: TerritoryIssue[],
): void {
  for (const issue of issues) {
    const stress = categoryStressForRegion(region, issue.categoria);
    issue.categoryStress = stress;
    issue.impattoScore = Math.min(
      98,
      Math.round(issue.impattoScore * 0.55 + stress * 0.45),
    );
  }
}
