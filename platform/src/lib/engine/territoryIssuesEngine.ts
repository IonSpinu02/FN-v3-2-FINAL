import type { Region } from "./constants";
import { REGIONS } from "./constants";
import { ANSA_REGION_SLUG } from "./newsFeedCatalog";
import { TAVILY_FEED_URL } from "./tavilyClient";
import {
  officialModuloBLine,
  politicalActionForCategory,
} from "./territoryIssueContext";
import { catalogIssuesForRegion } from "./territoryIssuesCatalog";
import type {
  ElectoralSubTheme,
  TerritoryIssue,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";
import { TERRITORY_ISSUE_CATEGORIES } from "./territoryIssuesTypes";
import { computeIssueConversionGain } from "@/lib/fnProgramAndAffinityEngine";
import {
  bipCardTitleForCategory,
  stripBipFromIssueTitle,
  bipSolutionBadgeForEmergency,
  bipSolutionsFromEmergencies,
  bipStructuralDatoForCategory,
  matchAllBipEmergencies,
  matchBipEmergency,
} from "./bipProblemRadar";
import { applySubDossierToIssueFields } from "./bipSubDossierMatch";
import {
  assessNewsImpatto,
  impattoScoreFromNews,
  isFreshTerritoryNews,
  liveCandidateScore,
} from "./territoryNewsImpact";
import {
  cleanTruncatedHeadline,
  isCulturalHistoricalAbstention,
  sanitizeOsservatorioNewsItem,
  shouldAbstainFromOsservatorio,
} from "./osservatorioNewsSanitizer";
import { staffBipLeverForCategory } from "./osservatorioStaffBipLevers";
import { isHousingEvictionContext } from "./territoryIssueDisambiguation";
import { isNewsJunkText } from "./newsIngest";

/** Max notizie live per macro-tema (poi cap totale). */
export const MAX_LIVE_PER_CATEGORY = 25;
export const MAX_LIVE_TOTAL = 120;

const OFF_TOPIC =
  /italia-qatar|formazione sulla sicurezza dei grandi eventi sportivi|spettacolo|cinema|opera\s*d['']arte|mostra\s*(d['']arte|collettiva|fotograf)|allestimento\s*(artist|museale)|inaugurazion[ei]\s*(del|della|di)\s*(mostra|museo|opera)|valore\s*aggiunto.{0,40}sport|cittadinanza\s+con\s+mare/i;

export const SPORT_RSS_BLACKLIST =
  /tuttobici|ciclismo|ciclisti|giro di lombardia|\bil lombardia\b|lombardia merita|serie a|calcio|champions|campionato|partita|\bsport\b|motogp|formula 1|tennis|olimpiadi|festival|sanremo|gossip|oroscopo|america['']?s?\s*cup|coppa\s*america|ryder\s*cup|davis\s*cup|regata|nautic|\bvela\b|sirena.{0,30}napoli/i;

/** Congressi di partito, cronaca mondana/lifestyle — non emergenze cittadini. */
export const PARTY_INNER_CRONACA_BLACKLIST =
  /congresso|candidatura al congresso|raccolta firme|segreteria provinciale|scala salta la prima|\bfaust\b|negozi del lusso|vademecum|firme per la candidatura|congresso della lega|congresso del pd/i;

export function isSportOrOffTopicBlocked(
  titolo: string,
  snippet: string,
  sourceUrl?: string,
): boolean {
  const blob = `${titolo} ${snippet} ${sourceUrl ?? ""}`;
  if (OFF_TOPIC.test(blob)) return true;
  if (SPORT_RSS_BLACKLIST.test(blob)) return true;
  if (PARTY_INNER_CRONACA_BLACKLIST.test(blob)) return true;
  if (/tuttobiciweb/i.test(sourceUrl ?? "")) return true;
  return false;
}

/** Precedenza su TRASPORTI (es. «caro gasolio agricolo» / Coldiretti). */
const AGRICULTURE_PRIORITY =
  /agricol|coldiretti|\bcia\b|confagricoltura|campi|raccolto|allevator|siccit|consorzio\s*agrario|\bvino\b|\blatte\b|\bgrano\b|trattori|pastor/i;

const CATEGORY_KEYWORDS: Record<TerritoryIssueCategory, RegExp> = {
  SANITA: /sanit|ospedal|pronto\s*soccorso|liste?\s*d['']attesa|cardarelli|118|ambulan/i,
  TRASPORTI:
    /tren|pendolar|ferrovi|autostrada|strada\s*(statale|comunale|provinciale)|strade\s*(statali|comunali)|metro|bus|traffico|lido|autotransport|pedaggi|tangenzial|passante|trenord|tpl|gasolio(?!\s*agric)/i,
  LAVORO:
    /lavor|stipend|crisi\s*azien|fabbric|licenzi|disoccupazione|tasso\s*di\s*occupazione|occupazione\s*(industriale|operaia|giovanile)|pmi|industria|mirafiori|fisco|burocr/i,
  SICUREZZA:
    /sicurezz|degrad|spaccio|delinqu|rapin|incident|legalit|camorr|mafia|immigr|rimpat|ong|sbarchi|clandestin|campo\s*abusiv|centr[oi]\s*social/i,
  COSTO_VITA:
    /affitt|mutui|bollett|caro[\s-]?vita|supermercat|inflazione|energia|elettric|gas\s|gasolio\s*domestic|sfratt|sgomber|emergenza\s*abitativ|case\s*popolar|\berp\b|inquilin/i,
  TERRITORIO:
    /agricolt|ambiente|frana|alluv|siccit|dissesto|aree?\s*intern|bonifica|idric|pastor/i,
};

const PROBLEM_SIGNAL =
  /protesta|disservizi|liste?\s*d['']attesa|pendolar|degrad|sicurezz|crisi|allarme|cittadini|lament|code|ritard|caro[\s-]?vita|autotrasport|affitt|bollett|agricolt|immigr|rimpat/i;

export function detectElectoralSubTheme(
  titolo: string,
  snippet: string,
  cat: TerritoryIssueCategory,
): ElectoralSubTheme | null {
  const blob = `${titolo} ${snippet}`.toLowerCase();
  if (cat === "SICUREZZA" && /immigr|rimpat|ong|sbarchi|clandestin|extracomunitar/i.test(blob)) {
    return "immigrazione";
  }
  if (cat === "COSTO_VITA" && /bollett|energia|elettric|gas\s|caro\s*energia/i.test(blob)) {
    return "energia";
  }
  if (cat === "LAVORO" && /fisco|tasse|burocr|iva\s|imposta/i.test(blob)) {
    return "fisco_pmi";
  }
  return null;
}

export function cleanRssText(raw: string): string {
  let t = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  t = t.replace(/\s*[-–—|]\s*[A-Za-zÀ-ÿ\s]{2,40}(News|Gazzetta|Corriere|Ansa)$/i, "");
  return t;
}

/** Titolo notizia in card / Analizza: pulizia RSS senza citazioni B.I.P. */
export function cleanIssueHeadline(raw: string): string {
  return stripBipFromIssueTitle(cleanTruncatedHeadline(cleanRssText(raw)));
}

/** Google News e altri host con X-Frame-Options: niente iframe in Analizza. */
export function canEmbedIssueArticleUrl(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw?.startsWith("http")) return false;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host === "news.google.com" || host.endsWith(".news.google.com")) return false;
    if (host.includes("google.") && /\/news/i.test(u.pathname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeTerritoryQueryRegion(
  raw: string | null | undefined,
): Region | "NAZIONALE" {
  const q = (raw ?? "NAZIONALE").trim();
  if (!q || q.toUpperCase() === "NAZIONALE") return "NAZIONALE";
  const match = REGIONS.find((r) => r.toLowerCase() === q.toLowerCase());
  return match ?? "NAZIONALE";
}

export function classifyIssueCategory(
  titolo: string,
  snippet: string,
  opts?: { relaxed?: boolean; bipOnly?: boolean },
): TerritoryIssueCategory | null {
  const blob = `${titolo} ${snippet}`;
  if (isSportOrOffTopicBlocked(titolo, snippet)) return null;
  // Mai fallback tematico: culturale/storico → NONE (anche in relaxed).
  if (isCulturalHistoricalAbstention(titolo, snippet)) return null;
  const bipEm = matchBipEmergency(blob);
  if (!opts?.relaxed) {
    // Senza evidenza socio-economica e senza B.I.P. → scarta (niente default caro-vita).
    if (shouldAbstainFromOsservatorio(titolo, snippet) && !bipEm) return null;
    if (opts?.bipOnly !== false && !bipEm) return null;
    if (!PROBLEM_SIGNAL.test(blob) && !bipEm) return null;
  }
  if (isHousingEvictionContext(blob)) return "COSTO_VITA";
  if (bipEm) return bipEm.category;
  if (AGRICULTURE_PRIORITY.test(blob)) return "TERRITORIO";
  // Keyword-only solo in relaxed; altrimenti niente categoria inventata.
  if (opts?.relaxed) {
    for (const cat of TERRITORY_ISSUE_CATEGORIES) {
      if (CATEGORY_KEYWORDS[cat].test(blob)) return cat;
    }
  }
  return null;
}

/** Classificazione rigorosa: solo emergenze con misura B.I.P. dedicata. */
export function classifyBipAlignedIssue(
  titolo: string,
  snippet: string,
): {
  category: TerritoryIssueCategory;
  emergency: NonNullable<ReturnType<typeof matchBipEmergency>>;
  emergencies: import("./bipProblemRadar").BipEmergency[];
} | null {
  if (isSportOrOffTopicBlocked(titolo, snippet)) return null;
  // Astensione culturale/storica vince su qualsiasi match B.I.P. spurio.
  if (isCulturalHistoricalAbstention(titolo, snippet)) return null;
  if (shouldAbstainFromOsservatorio(titolo, snippet)) return null;
  const emergencies = matchAllBipEmergencies(`${titolo} ${snippet}`);
  if (!emergencies.length) return null;
  const emergency = emergencies[0]!;
  return { category: emergency.category, emergency, emergencies };
}

/** Località mostrata in card (senza ripetere il nome regione). */
export function formatLiveProvinciaComune(
  region: Region | "NAZIONALE",
  locality: string | null,
): string {
  if (region === "NAZIONALE") {
    return locality?.trim() || "Ambito nazionale";
  }
  const loc = locality?.trim();
  if (loc && loc.toLowerCase() !== region.toLowerCase()) return loc;
  return "Ambito regionale";
}

export function formatIssueCardLocality(
  region: Region | "NAZIONALE",
  provinciaComune: string,
): string {
  const raw = provinciaComune.trim();
  if (!raw) return region === "NAZIONALE" ? "Ambito nazionale" : "Ambito regionale";
  if (region === "NAZIONALE") {
    return raw.replace(/^Italia\s·\s*/i, "").trim() || "Ambito nazionale";
  }
  const parts = raw.split("·").map((s) => s.trim()).filter(Boolean);
  const regionLower = region.toLowerCase();
  const withoutRegion = parts.filter(
    (p) =>
      p.toLowerCase() !== regionLower &&
      !/^segnalazione live$/i.test(p) &&
      !/^italia$/i.test(p),
  );
  if (withoutRegion.length === 1) return withoutRegion[0]!;
  if (withoutRegion.length > 1) return withoutRegion[0]!;
  if (parts.some((p) => p.toLowerCase() === regionLower)) return "Ambito regionale";
  return parts[0] ?? "Ambito regionale";
}

/** Stesso criterio della label «Priorità n/100» in card (sempre clamp 0–100). */
export function issuePriorityScore(issue: TerritoryIssue): number {
  const raw = issue.electionScore ?? issue.impattoScore ?? 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/** Ordine cockpit: priorità decrescente, poi impatto elettorale stimato. */
export function orderIssuesForCockpitDisplay(issues: TerritoryIssue[]): TerritoryIssue[] {
  return [...issues].sort((a, b) => {
    const liveA = a.contentSource === "live" || a.live ? liveCandidateScore(a) : 0;
    const liveB = b.contentSource === "live" || b.live ? liveCandidateScore(b) : 0;
    if (liveA > 0 || liveB > 0) {
      const byFresh = liveB - liveA;
      if (byFresh !== 0) return byFresh;
    }
    const byPriority = issuePriorityScore(b) - issuePriorityScore(a);
    if (byPriority !== 0) return byPriority;
    const ppA = a.conversion?.potentialGainPp ?? 0;
    const ppB = b.conversion?.potentialGainPp ?? 0;
    if (ppB !== ppA) return ppB - ppA;
    return (b.impattoScore ?? 0) - (a.impattoScore ?? 0);
  });
}

const GOOGLE_NEWS_NEG =
  '-ciclismo -"Il Lombardia" -tuttobici -calcio -serie -champions';

function googleNewsRssUrl(regionName: string, query: string): string {
  const q = `${regionName} (${query}) ${GOOGLE_NEWS_NEG}`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=it&gl=IT&ceid=IT:it`;
}

function googleNewsFeedUrls(regionName: string): string[] {
  return [
    googleNewsRssUrl(
      regionName,
      '"baby gang" OR daspo OR "occupazione abusiva" OR "degrado urbano" OR stazione OR spaccio',
    ),
    googleNewsRssUrl(
      regionName,
      'MSNA OR "decreto flusso" OR "case popolari" OR sbarchi OR "San Vittore" OR carceri OR sovraffollamento',
    ),
    googleNewsRssUrl(
      regionName,
      '"oneri di sistema" OR bollette OR "case green" OR "euro 5" OR Fit for 55 OR mutuo OR "prima casa"',
    ),
    googleNewsRssUrl(
      regionName,
      '"saldo e acconto" OR CRIF OR "partita IVA" OR cinghiali OR fotovoltaico OR Po OR agricoltori OR sottocosto',
    ),
    googleNewsRssUrl(
      regionName,
      '"liste d\'attesa" OR "CUP sanitario" OR "pronto soccorso" OR "legge 38" OR "truffe over 65" OR "pensione minima"',
    ),
    googleNewsRssUrl(
      regionName,
      'HVO OR pendolari OR ritardi OR treni OR "legittima difesa" OR rapina OR furto',
    ),
  ];
}

function ansaRegionalUrl(region: Region): string {
  const slug = ANSA_REGION_SLUG[region];
  return `https://www.ansa.it/${slug}/notizie/${slug}_rss.xml`;
}

export type TerritoryFeedItem = {
  titolo: string;
  link: string;
  pubDate: string | null;
  snippet: string;
  feedUrl?: string;
};

/** Feed RSS gratuiti del radar: 6 ricerche Google News per asse B.I.P. + ANSA regionale. */
export function territoryLiveFeedUrls(region: Region | "NAZIONALE"): string[] {
  const feeds = googleNewsFeedUrls(region === "NAZIONALE" ? "Italia" : region);
  if (region !== "NAZIONALE") feeds.push(ansaRegionalUrl(region));
  return feeds;
}

function rssItemToIssue(
  item: TerritoryFeedItem,
  region: Region | "NAZIONALE",
): TerritoryIssue | null {
  const rawTitle = cleanRssText(item.titolo);
  const snippet = cleanRssText(item.snippet);
  if (!rawTitle || isSportOrOffTopicBlocked(rawTitle, snippet, item.link)) return null;
  if (isNewsJunkText(rawTitle, snippet)) return null;

  const aligned = classifyBipAlignedIssue(rawTitle, snippet);
  if (!aligned) return null;
  if (!isFreshTerritoryNews(item.pubDate)) return null;
  const { category: cat, emergency, emergencies } = aligned;

  const sanitized = sanitizeOsservatorioNewsItem({
    title: rawTitle,
    snippet,
    sourceUrl: item.link,
    feedHint: item.feedUrl,
    categoryHint: cat,
  });
  if (!sanitized.ok) return null;

  const titolo = sanitized.title;
  const headline = bipCardTitleForCategory(region, cat, titolo);
  const subDossierFields = applySubDossierToIssueFields(headline, snippet, cat);
  const staffLever = staffBipLeverForCategory(cat, `${headline} ${snippet}`);
  const bipSolutions =
    subDossierFields.bipSolutions.length > 0
      ? subDossierFields.bipSolutions.map((s, i) =>
          i === 0
            ? {
                ...s,
                capRef: staffLever.badge,
                measures: staffLever.measure,
                badgeLabel: staffLever.badge,
                pressDeclaration: staffLever.declaration(region),
              }
            : s,
        )
      : [
          {
            emergencyId: emergency.id,
            capRef: staffLever.badge,
            measures: staffLever.measure,
            badgeLabel: staffLever.badge,
            pressDeclaration: staffLever.declaration(region),
          },
          ...bipSolutionsFromEmergencies(emergencies.slice(1)),
        ];

  const sub =
    emergency.electoralSubTheme ??
    detectElectoralSubTheme(titolo, snippet, cat);
  const fromTavily = item.feedUrl === TAVILY_FEED_URL;
  const newsImpact = assessNewsImpatto({
    titolo,
    snippet,
    pubDate: item.pubDate,
    categoria: cat,
    region,
    sourceUrl: item.link,
  });
  const impattoScore = impattoScoreFromNews(region, cat, newsImpact);
  const provinciaComune =
    region === "NAZIONALE"
      ? "Italia · Cronaca nazionale"
      : formatLiveProvinciaComune(region, newsImpact.locality);
  const placeForAction =
    region === "NAZIONALE"
      ? newsImpact.locality?.trim() || "Italia"
      : formatLiveProvinciaComune(region, newsImpact.locality);
  const actionBase = politicalActionForCategory(region, cat);
  const housingBlob = `${titolo} ${snippet}`;
  const action = {
    doveAndare: isHousingEvictionContext(housingBlob)
      ? `Presidio presso lo stabile interessato a ${placeForAction} / Assessorato Politiche Sociali e Casa — Incontrare i residenti/anziani coinvolti, comitati inquilini, curia/ente proprietario e Prefettura per tavolo sospensione/ricollocamento`
      : actionBase.doveAndare,
    cosaDire: staffLever.declaration(region),
  };

  return {
    id: `live-${hash32(item.link)}`,
    regione: region,
    provinciaComune,
    categoria: cat,
    titoloProblema: headline,
    sintesiLamentela: snippet || emergency.label,
    canaleVirale: sanitized.sourceLabel,
    visualizzazioniStimate: newsImpact.summaryLabel,
    impattoScore,
    datoUfficialeModuloB: bipStructuralDatoForCategory(region, cat),
    bipEmergencyId: subDossierFields.bipEmergencyId,
    bipSolutionBadge: staffLever.badge,
    bipSolutions,
    azionePoliticaConsigliata: action,
    sourceUrl: item.link,
    pubDate: item.pubDate,
    live: true,
    contentSource: "live",
    verification: "auto",
    evidence: fromTavily
      ? {
          title: titolo,
          snippet: snippet || emergency.label,
          url: item.link,
          pubDate: item.pubDate,
          feedHint: "tavily",
        }
      : undefined,
    electoralSubTheme: sub,
  };
}

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Notizie dei feed (RSS e Tavily) → problemi live, deduplicati e con tetto per tema. */
export function buildLiveIssuesFromFeedItems(
  region: Region | "NAZIONALE",
  items: TerritoryFeedItem[],
): TerritoryIssue[] {
  const live: TerritoryIssue[] = [];
  for (const item of items) {
    const issue = rssItemToIssue(item, region);
    if (issue) live.push(issue);
  }

  const deduped = dedupeIssues(live).sort(
    (a, b) => liveCandidateScore(b) - liveCandidateScore(a),
  );

  const byCat = new Map<TerritoryIssueCategory, TerritoryIssue[]>();
  for (const item of deduped) {
    const list = byCat.get(item.categoria) ?? [];
    if (list.length < MAX_LIVE_PER_CATEGORY) {
      list.push(item);
      byCat.set(item.categoria, list);
    }
  }
  const pooled = [...byCat.values()].flat().sort(
    (a, b) => liveCandidateScore(b) - liveCandidateScore(a),
  );
  return pooled.slice(0, MAX_LIVE_TOTAL);
}

/** Titolo normalizzato per unire stessa cronaca da feed/URL diversi. */
export function normalizeStoryTitleForDedupe(raw: string): string {
  return cleanRssText(raw)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s*\[\s*b\.?\s*i\.?\s*p\.[^\]]*\]\s*/gi, " ")
    .replace(/[^a-z0-9àèéìòù\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storyTitleDedupeKey(issue: TerritoryIssue): string | null {
  const fromTitle = normalizeStoryTitleForDedupe(issue.titoloProblema);
  if (fromTitle.length >= 16) return `title:${fromTitle}`;
  const ev = issue.evidence?.title?.trim();
  if (ev) {
    const fromEv = normalizeStoryTitleForDedupe(ev);
    if (fromEv.length >= 16) return `title:${fromEv}`;
  }
  return fromTitle.length >= 8 ? `title:${fromTitle}` : null;
}

/** Chiave univoca storia (evita stessa notizia due volte in elenco). */
export function storyDedupeKey(issue: TerritoryIssue): string {
  const titleKey = storyTitleDedupeKey(issue);
  if (titleKey) return titleKey;

  const url = issue.sourceUrl?.trim();
  if (url?.startsWith("http")) {
    try {
      const u = new URL(url);
      const gArticle = u.pathname.match(/\/articles\/([^/?]+)/i)?.[1];
      if (gArticle) return `gnews:${gArticle}`;
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      return `url:${host}:${u.pathname.replace(/\/+$/, "").slice(0, 80)}`;
    } catch {
      /* fall through */
    }
  }

  const t = normalizeStoryTitleForDedupe(issue.titoloProblema).slice(0, 80);
  return `title:${t || issue.id}`;
}

function canonicalUrlDedupeKey(url: string | null | undefined): string | null {
  if (!url?.trim().startsWith("http")) return null;
  try {
    const u = new URL(url.trim());
    const gArticle = u.pathname.match(/\/articles\/([^/?]+)/i)?.[1];
    if (gArticle) return `gnews:${gArticle}`;
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    if (!path || path === "/") return null;
    if (path === "/search" || path.endsWith("/search")) {
      const q = u.searchParams.get("q")?.trim().toLowerCase();
      if (!q) return null;
      return `url:${host}:${path}?q=${q.slice(0, 160)}`;
    }
    return `url:${host}:${path}`;
  } catch {
    return null;
  }
}

export function dedupeIssues(issues: TerritoryIssue[]): TerritoryIssue[] {
  const map = new Map<string, TerritoryIssue>();
  const urlToStoryKey = new Map<string, string>();

  for (const it of issues) {
    let key = storyDedupeKey(it);
    const urlKey = canonicalUrlDedupeKey(it.sourceUrl);
    if (urlKey) {
      const linked = urlToStoryKey.get(urlKey);
      if (linked) key = linked;
    }

    const prev = map.get(key);
    if (!prev || liveCandidateScore(it) > liveCandidateScore(prev)) {
      map.set(key, it);
    }
    if (urlKey) urlToStoryKey.set(urlKey, key);
  }
  return [...map.values()];
}

function issueDedupeKey(issue: TerritoryIssue): string {
  return storyDedupeKey(issue);
}

function issueSourceRank(issue: TerritoryIssue): number {
  if (issue.contentSource === "live") return 3;
  if (issue.contentSource === "blended") return 2;
  if (issue.live) return 2;
  return 1;
}

/** Unisce card principali + notizie extra (cache legacy) senza duplicati. */
export function unionTerritoryIssueFeeds(
  ...groups: TerritoryIssue[][]
): TerritoryIssue[] {
  const map = new Map<string, TerritoryIssue>();
  for (const group of groups) {
    for (const item of group) {
      const key = issueDedupeKey(item);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, item);
        continue;
      }
      const rankA = issueSourceRank(item);
      const rankB = issueSourceRank(prev);
      if (
        rankA > rankB ||
        (rankA === rankB && item.impattoScore > prev.impattoScore)
      ) {
        map.set(key, item);
      }
    }
  }
  return dedupeIssues([...map.values()]).sort(
    (a, b) =>
      (b.electionScore ?? b.impattoScore) - (a.electionScore ?? a.impattoScore),
  );
}

export type TerritoryIssuesResult = {
  region: Region | "NAZIONALE";
  category: TerritoryIssueCategory | null;
  issues: TerritoryIssue[];
  liveNews: TerritoryIssue[];
  fetchedAt: string;
  liveCount: number;
  catalogCount: number;
  allThemes?: TerritoryIssue[];
  rankingMeta?: import("./territoryIssuesResolver").TerritoryIssuesRankingMeta;
};

export function enrichIssuesWithConversion(
  issues: TerritoryIssue[],
  region: Region | "NAZIONALE",
  validVotesRegion: number,
  flussiAstWeight = 0.36,
  validVotesByRegion?: ReadonlyMap<Region, number> | Partial<Record<Region, number>>,
): TerritoryIssue[] {
  const fallbackRegion = region === "NAZIONALE" ? ("Lazio" as Region) : region;
  return issues.map((issue) => {
    const convRegion =
      issue.regione !== "NAZIONALE" && REGIONS.includes(issue.regione as Region)
        ? (issue.regione as Region)
        : fallbackRegion;
    let vv = validVotesRegion;
    if (validVotesByRegion) {
      const fromStore =
        validVotesByRegion instanceof Map
          ? validVotesByRegion.get(convRegion)
          : (validVotesByRegion as Partial<Record<Region, number>>)[convRegion];
      if (fromStore != null && fromStore > 0) vv = fromStore;
    }
    return {
      ...issue,
      conversion: computeIssueConversionGain(
        convRegion,
        issue.categoria,
        issue.impattoScore,
        vv,
        flussiAstWeight,
        issue.electoralSubTheme,
        {
          title: issue.titoloProblema,
          summary: issue.sintesiLamentela,
        },
      ),
    };
  });
}
