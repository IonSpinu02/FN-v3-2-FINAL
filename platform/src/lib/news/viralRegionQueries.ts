import { DISTRESS_PILLARS, type DistressPillar } from "./viralDistressPillars";

/** Limite storico di Tavily sulla lunghezza della query. */
export const TAVILY_MAX_QUERY_CHARS = 400;

const EXCLUDE_PARTY = '-"Futuro Nazionale" -Vannacci';

/** I primi termini di ogni filone sono i più distintivi (vedi `DISTRESS_PILLARS`). */
function coreTerms(pillars: DistressPillar[], perPillar: number): string {
  return pillars
    .flatMap((p) => p.queryTerms.split(" OR ").slice(0, perPillar))
    .join(" OR ");
}

export type ViralNationalQueries = {
  socialA: string;
  socialB: string;
  press: string;
};

/**
 * Le 3 chiamate della scansione giornaliera nazionale (2 social + 1 stampa).
 * Le regioni non hanno query proprie: i video vengono assegnati leggendo luoghi e capoluoghi nel testo.
 */
export function viralNationalBatchQueries(): ViralNationalQueries {
  const batchA = coreTerms(DISTRESS_PILLARS.slice(0, 4), 3);
  const batchB = coreTerms(DISTRESS_PILLARS.slice(4), 3);
  return {
    socialA: `Italia (${batchA}) (denuncia OR sfogo OR "non ce la faccio" OR vergogna OR basta) ${EXCLUDE_PARTY}`,
    socialB: `Italia (${batchB}) (denuncia OR sfogo OR video OR reel OR shorts) ${EXCLUDE_PARTY}`,
    press:
      `("video virale" OR "su TikTok" OR "reel virale" OR "shorts virale") Italia ` +
      `(caregiver OR F24 OR "liste d'attesa" OR mutuo OR stazione OR "cassa integrazione" OR ZTL OR artigiano) ` +
      EXCLUDE_PARTY,
  };
}
