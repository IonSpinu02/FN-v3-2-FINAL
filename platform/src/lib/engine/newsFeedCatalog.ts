import { REGIONS, type Region } from "./constants";

/** Feed nazionali (politica + cronaca), verificati HTTP 200. */
export const NEWS_RSS_NATIONAL: readonly string[] = [
  "https://www.ansa.it/sito/notizie/politica/politica_rss.xml",
  "https://www.ansa.it/sito/notizie/cronaca/cronaca_rss.xml",
  "https://www.agi.it/politica/rss",
  "https://www.rainews.it/rss/politica",
  "https://www.repubblica.it/rss/politica/rss2.0.xml",
  "https://www.adnkronos.com/RSS_Cronaca.xml",
  "https://www.ilsole24ore.com/rss/italia.xml",
  "https://www.quotidiano.net/rss",
];

/** Slug ANSA per feed regionali (`…/notizie/{slug}_rss.xml`). */
export const ANSA_REGION_SLUG: Record<Region, string> = {
  Piemonte: "piemonte",
  "Valle d'Aosta": "valledaosta",
  Liguria: "liguria",
  Lombardia: "lombardia",
  "Trentino-Alto Adige": "trentino",
  Veneto: "veneto",
  "Friuli-Venezia Giulia": "friuliveneziagiulia",
  "Emilia-Romagna": "emiliaromagna",
  Toscana: "toscana",
  Umbria: "umbria",
  Marche: "marche",
  Lazio: "lazio",
  Abruzzo: "abruzzo",
  Molise: "molise",
  Campania: "campania",
  Puglia: "puglia",
  Basilicata: "basilicata",
  Calabria: "calabria",
  Sicilia: "sicilia",
  Sardegna: "sardegna",
};

export function ansaRegionalFeedUrls(): string[] {
  return REGIONS.map(
    (r) =>
      `https://www.ansa.it/${ANSA_REGION_SLUG[r]}/notizie/${ANSA_REGION_SLUG[r]}_rss.xml`,
  );
}

/** Esempi CityToday / edizioni locali (espandibili via env). */
export const NEWS_RSS_LOCAL_SAMPLES: readonly string[] = [
  "https://www.bolognatoday.it/rss",
  "https://www.modenatoday.it/rss",
  "https://bologna.repubblica.it/rss/rss2.0.xml",
];

export const DEFAULT_NEWS_RSS_URLS: readonly string[] = [
  ...NEWS_RSS_NATIONAL,
  ...ansaRegionalFeedUrls(),
  ...NEWS_RSS_LOCAL_SAMPLES,
];
