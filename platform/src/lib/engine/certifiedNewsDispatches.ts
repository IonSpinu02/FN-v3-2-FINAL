import type { NewsCandidate } from "./localiTypes";
import {
  analyzeInstitutionalArticle,
  normalizeTitleKey,
} from "./newsInstitutionalAnalyzer";
import { getBroadsheetBaseEdition } from "@/components/newsBroadsheetData";

/** 12 dispacci istituzionali certificati (stesso analyzer del live RSS). */
export function buildCertifiedNewsCandidates(): NewsCandidate[] {
  const out: NewsCandidate[] = [];
  for (const b of getBroadsheetBaseEdition().slice(0, 12)) {
    const analyzed = analyzeInstitutionalArticle({
      titolo: b.titolo,
      snippet: b.sommario,
      feedUrl: b.link,
      sourceLabel: b.source,
      feedRegionHint: b.suggestedRegion,
    });
    if (!analyzed) continue;
    out.push({
      id: b.id,
      titolo: b.titolo,
      link: b.link,
      pubDate: b.pubDate,
      snippet: b.sommario,
      feedUrl: b.feedSource ?? b.link,
      matchedKeywords: [],
      comuneGuess: analyzed.comune,
      regioneGuess: analyzed.regione,
      suggestedRegion: analyzed.regione,
      suggestedComune: analyzed.comune,
      suggestedRole: analyzed.role,
      confidenceScore: analyzed.confidenceScore,
      matchedRoleKeyword: analyzed.matchedRoleKeyword,
      matchedGeoKeyword: analyzed.matchedGeoKeyword,
      sourceLabel: b.source,
      suggestedAction: "ingresso_fn",
    });
  }
  return out;
}

/** Solo articoli da RSS live (niente seed editoriali). */
export function mergeLiveWithCertifiedDispatches(
  live: NewsCandidate[],
  maxItems: number,
): NewsCandidate[] {
  const byKey = new Map<string, NewsCandidate>();
  for (const c of live) {
    if (c.id.startsWith("seed-")) continue;
    byKey.set(normalizeTitleKey(c.titolo) || c.id, c);
  }
  return Array.from(byKey.values()).slice(0, maxItems);
}

/** Fallback didattico: seed solo se il live è completamente vuoto. */
export function mergeLiveWithCertifiedFallback(
  live: NewsCandidate[],
  maxItems: number,
): NewsCandidate[] {
  const rssOnly = mergeLiveWithCertifiedDispatches(live, maxItems);
  if (rssOnly.length > 0) return rssOnly;
  const byKey = new Map<string, NewsCandidate>();
  for (const seed of buildCertifiedNewsCandidates()) {
    byKey.set(normalizeTitleKey(seed.titolo) || seed.id, seed);
  }
  return Array.from(byKey.values()).slice(0, maxItems);
}
