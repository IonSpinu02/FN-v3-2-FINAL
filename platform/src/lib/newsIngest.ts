/** Filtri editoriali rassegna stampa (re-export dal motore ingest). */
export {
  filterRelevantCandidates,
  isNewsJunkText,
  hasInstitutionalNewsSignals,
  passesEditorialNewsFilter,
} from "@/lib/engine/newsIngest";

export {
  cleanFeedLabel,
  cleanArticleSummary,
  passesClientNewsFilter,
  isNewsJunk,
  hasInstitutionalNewsSignals as hasInstitutionalNewsSignalsClient,
  articleDisplaySource,
} from "@/lib/newsArticleFormat";
