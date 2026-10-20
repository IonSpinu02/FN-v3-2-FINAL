import { ANSA_REGION_SLUG } from "@/lib/engine/newsFeedCatalog";
import type { Region } from "@/lib/engine/constants";
import { GEO_COMUNI } from "@/lib/engine/italianGeoData";
import type { CaricaLocale } from "@/lib/engine/localiTypes";
import type { NewsCandidate } from "@/lib/engine/localiTypes";

import {
  analyzeInstitutionalArticle,
  HARD_BLACKLIST_REGEX,
  matchesNewsSearch,
} from "@/lib/engine/newsInstitutionalAnalyzer";
import { regioneForComune } from "@/lib/engine/capoluoghiToRegione";

/** Blacklist meteo, scioperi, necrologi, sport (allineato a newsIngest). */
export const NEWS_JUNK_RE = HARD_BLACKLIST_REGEX;

/** Elezioni, seggi e ciclo elettorale (diretto e indiretto). */
export const NEWS_ELECTION_RE =
  /\b(elezioni|elezione|elettorale|elettorali|seggio|seggi|scrutinio|votazioni|urne|referendum|ballottaggio|consultazioni|amministrative|suppletive|affluenza|spoglio|candidato|candidati|liste civiche|coalizione elettorale|presidenti di seggio|presidente di seggio|commissione elettorale|scheda elettorale|operazione voto|giorni di voto|voto di lista|campagna elettorale|propaganda elettorale)\b|elezioni regionali|elezioni europee|elezioni politiche|rinnovo consiglio|rinnovo giunta|commissario straordinario/i;

/** Indicatori politico-amministrativi (word boundaries). */
export const NEWS_INSTITUTIONAL_RE =
  /\b(sindaco|sindaci|sindaca|consigliere|consiglieri|assessore|deputato|deputati|parlamentare|giunta|elezioni|parlamento|riforma)\b|consiglio comunale|consiglio regionale|giunta regionale|giunta comunale|comune di|adesione|gruppo consiliare|provincia|futuro nazionale|centrodestra|bilancio regionale|passa a|dimissioni/i;

const NEWS_INSTITUTIONAL_OR_ELECTION_RE = new RegExp(
  `${NEWS_INSTITUTIONAL_RE.source}|${NEWS_ELECTION_RE.source}`,
  "i",
);

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findBoundedQueryPhrase(
  text: string,
  query: string,
): string | null {
  const q = query.trim();
  if (q.length < 2) return null;
  let hayLower = text.toLowerCase();
  const qLower = q.toLowerCase();
  if (qLower === "roma" || (qLower.includes("roma") && !qLower.includes("romagna"))) {
    hayLower = hayLower.replace(/emilia-romagna|romagna/gi, " ");
  }
  const tokens = qLower.split(/\s+/).filter(Boolean);
  const ok = tokens.every((token) => {
    const re = new RegExp(`(?:^|[^a-zà-ÿ])${escapeRegExp(token)}`, "i");
    return re.test(hayLower);
  });
  return ok ? q : null;
}

export function matchesSearchQuery(
  article: {
    titolo: string;
    sommario: string;
    suggestedComune: string;
    suggestedRegion: string;
    source: string;
  },
  query: string,
): boolean {
  return matchesNewsSearch(
    {
      titolo: article.titolo,
      sommario: article.sommario,
      suggestedComune: article.suggestedComune,
      suggestedRegion: article.suggestedRegion,
      source: article.source,
    },
    query,
  );
}

export function pickDefaultKeywordPhrase(article: {
  titolo: string;
  suggestedComune: string;
  suggestedRegion: string;
}): string {
  const geo = article.suggestedComune
    ? `Comune di ${article.suggestedComune}`
    : article.suggestedRegion;
  const titleBit = article.titolo.split(/\s+/).slice(0, 5).join(" ");
  return `${geo}, ${titleBit}`.slice(0, 72);
}

export function isNewsJunk(titolo: string, snippet = ""): boolean {
  return NEWS_JUNK_RE.test(`${titolo} ${snippet}`);
}

export function isElectionOrSeggiNews(titolo: string, snippet = ""): boolean {
  return NEWS_ELECTION_RE.test(`${titolo} ${snippet}`);
}

export function hasInstitutionalNewsSignals(titolo: string, snippet = ""): boolean {
  if (NEWS_JUNK_RE.test(`${titolo} ${snippet}`)) return false;
  return (
    analyzeInstitutionalArticle({ titolo, snippet, feedUrl: "" }) !== null ||
    NEWS_INSTITUTIONAL_OR_ELECTION_RE.test(`${titolo} ${snippet}`)
  );
}

export function passesClientNewsFilter(
  titolo: string,
  sommario: string,
  _matchedKeywords: string[] = [],
): boolean {
  if (isNewsJunk(titolo, sommario)) return false;
  return hasInstitutionalNewsSignals(titolo, sommario);
}

const SLUG_TO_REGION = Object.fromEntries(
  Object.entries(ANSA_REGION_SLUG).map(([region, slug]) => [slug, region]),
) as Record<string, Region>;

const DOMAIN_LABELS: Record<string, string> = {
  "ilsole24ore.com": "IL SOLE 24 ORE",
  "corriere.it": "CORRIERE DELLA SERA",
  "repubblica.it": "LA REPUBBLICA",
  "gazzettino.it": "IL GAZZETTINO",
  "lagazzettadelmezzogiorno.it": "GAZZETTA DEL MEZZOGIORNO",
  "rainews.it": "RAI NEWS",
  "adnkronos.com": "ADNKRONOS",
  "agi.it": "AGI",
  "quotidiano.net": "QUOTIDIANO.NET",
  "bolognatoday.it": "BOLOGNA TODAY",
  "modenatoday.it": "MODENA TODAY",
};

function regionFromAnsaPath(lower: string): Region | undefined {
  for (const [slug, region] of Object.entries(SLUG_TO_REGION)) {
    if (lower.includes(`ansa.it/${slug}/`)) return region;
  }
  return undefined;
}

function cleanFeedLabelFromUrl(rawUrl: string): string {
  const lower = rawUrl.toLowerCase();
  if (lower.includes("ansa.it/lombardia")) return "ANSA · REDAZIONE LOMBARDIA";
  if (lower.includes("ansa.it/veneto")) return "ANSA · REDAZIONE VENETO";
  if (lower.includes("ansa.it/sito/notizie/politica")) {
    return "ANSA · POLITICA NAZIONALE";
  }
  if (lower.includes("ansa.it/sito/notizie/cronaca")) {
    return "ANSA · CRONACA NAZIONALE";
  }
  const regional = regionFromAnsaPath(lower);
  if (regional) {
    return `ANSA · REDAZIONE ${regional.toUpperCase()}`;
  }
  if (lower.includes("ansa.it")) return "AGENZIA ANSA · DISPACCIO ITALIA";

  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./i, "");
    const mapped = DOMAIN_LABELS[host];
    if (mapped) return mapped;
    return host.replace(/\./g, " ").toUpperCase();
  } catch {
    return "FONTE RSS";
  }
}

/** Converte URL RSS o etichetta grezza in testata editoriale (mai URL completi). */
export function cleanFeedLabel(urlOrSource: string): string {
  const raw = (urlOrSource ?? "").trim();
  if (!raw) return "DISPACCIO TERRITORIALE";

  if (/^https?:\/\//i.test(raw)) {
    return cleanFeedLabelFromUrl(raw);
  }

  const embedded = raw.match(/https?:\/\/[^\s]+/i);
  if (embedded) {
    return cleanFeedLabelFromUrl(embedded[0]);
  }

  if (/ansa\.it\/|_rss\.xml|\/rss/i.test(raw)) {
    return cleanFeedLabelFromUrl(
      `https://${raw.replace(/^\/\//, "").replace(/^https?:\/\//i, "")}`,
    );
  }

  if (/^www\.|\.(it|com|net)\//i.test(raw)) {
    return cleanFeedLabelFromUrl(
      `https://${raw.replace(/^https?:\/\//i, "")}`,
    );
  }

  return raw;
}

const ANSA_PREFIX_RE =
  /^[\s\-–—•]+([A-Za-zÀ-ÿ\s]{2,20}[\-–—]+)?\s*/;

export function cleanArticleSummary(text: string): string {
  let t = (text ?? "").trim();
  for (let i = 0; i < 4; i++) {
    const next = t.replace(ANSA_PREFIX_RE, "").trim();
    if (next === t) break;
    t = next;
  }
  t = t.replace(/^\(ANSA\)\s*[-–—]?\s*[A-ZÀ-ÿ\s,]+\d{1,2}\s+[A-Z]{3}\s*[-–—]\s*/i, "");
  t = t.replace(/^\(ANSA\)\s*/i, "");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

export function articleDisplaySource(article: {
  source: string;
  feedSource?: string;
}): string {
  return cleanFeedLabel(article.feedSource ?? article.source);
}

/** Data compatta per filo agenzie (es. 20 OTT 2026). */
export function formatDispaccioWireDate(isoOrDate: string): string {
  const d = new Date(
    isoOrDate.includes("T") ? isoOrDate : `${isoOrDate}T12:00:00Z`,
  );
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getUTCDate();
  const mon = d
    .toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" })
    .replace(".", "")
    .toUpperCase();
  return `${day} ${mon} ${d.getUTCFullYear()}`;
}

export function regionFromComuneName(comune: string): Region | undefined {
  const norm = comune.trim();
  if (!norm) return undefined;
  return (
    regioneForComune(norm) ??
    GEO_COMUNI.find(([n]) => n.toLowerCase() === norm.toLowerCase())?.[1]
  );
}

const LOCAL_FEED_HINT: Record<string, Region> = {
  "bolognatoday.it": "Emilia-Romagna",
  "modenatoday.it": "Emilia-Romagna",
  "bologna.repubblica.it": "Emilia-Romagna",
};

export function resolveBroadsheetGeo(c: NewsCandidate): {
  regione: Region;
  comune: string;
  carica: CaricaLocale;
} {
  const comune = (c.suggestedComune ?? c.comuneGuess ?? "").trim();
  const fromComune = comune ? regionFromComuneName(comune) : undefined;
  let fromFeed: Region | undefined;
  try {
    const host = new URL(c.feedUrl).hostname.replace(/^www\./i, "");
    fromFeed = LOCAL_FEED_HINT[host];
  } catch {
    fromFeed = undefined;
  }
  const regione =
    fromComune ??
    c.suggestedRegion ??
    c.regioneGuess ??
    fromFeed ??
    "Lombardia";
  return {
    regione,
    comune,
    carica: c.suggestedRole ?? "com",
  };
}

export function formatNewsprintDate(isoOrDate: string): string {
  const d = new Date(
    isoOrDate.includes("T") ? isoOrDate : `${isoOrDate}T12:00:00`,
  );
  if (Number.isNaN(d.getTime())) return "OTTOBRE 2026";
  return d
    .toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .toUpperCase();
}
