import { matchAllBipEmergencies } from "./bipProblemRadar";
import { looksForeignEnglish } from "./osservatorioNewsSanitizer";
import {
  ewmaRecentSlope,
  type ConsensusPoint,
  type GrowthEvidence,
} from "./growthTrajectory";

const NEGATIVE =
  /calo|croll|polemic|farlocc|querel|indag|crisi|scende|perd|lite|oscur|rinunc/i;
const POSITIVE =
  /cresc|iscritt|sorpass|avanti|consensi in aumento|supera|record di iscritti/i;

const JUNK_HEADLINE =
  /^(instagram|facebook|x|twitter|youtube|tiktok|linkedin|home|pagina principale|sondaggi|ultime notizie)\b/i;

/** Homepage, hub istituzionali, social e calendari di mercato senza notizia. */
const JUNK_PAGE_OR_HUB =
  /your gateway to the eu|european union\s*\||eventi e scadenze|borsa italiana|pagina principale|home page|official website|portale (ufficiale|europa)|follow us on|subscribe to|: tutte le notizie|tutte le notizie|ultime notizie|archivio notizie|\barchivio\b/i;

/** Clickbait e cronaca estera fuori tema per il simulatore eventi. */
const JUNK_CLICKBAIT_OR_OFFTOPIC =
  /verit[aà]\s+brutali|verità BRUTALI|\bcreta\b|scarafaggi indiani|scarafagg/i;

const SOCIAL_OR_EMOJI =
  /instagram\.com|facebook\.com|tiktok\.com|[\u{1F300}-\u{1FAFF}]/u;

/** Politica monetaria BCE senza legame a mutui/famiglie italiane. */
const BCE_MONETARY_ONLY =
  /\b(bce|lagarde|banca centrale europea|tassi (d.interesse|bce)|politica monetaria)\b/i;
const HOUSEHOLD_RATES =
  /\b(mutu\w*|famigl\w*|affitt\w*|ipotec\w*|rate?|casa|prestiti alle famiglie|costo del credito)\b/i;

/** Titoli di sola demoscopia: utili al tono, non alla salienza temi. */
const POLL_ONLY =
  /\b(sondagg\w*|supermedia|intenzioni di voto|polling|demoscop\w*)\b/i;

/** Quattro pilastri tematici allineati al fattore «Temi del momento» V4. */
const AGENDA_THEME_PATTERNS: { id: string; label: string; pattern: RegExp }[] = [
  {
    id: "sicurezza",
    label: "Sicurezza",
    pattern:
      /sicurezz|immigra|migrant|sbarc|confin|rotta balcanica|clandestin|criminal|rapin|furt|accoltell|baby gang|degrado|cpr|rimpatri|remigra|espuls|ius scholae|cittadinanza|\bong\b/i,
  },
  {
    id: "fisco",
    label: "Fisco / P.IVA",
    pattern:
      /fisc|tasse|irpef|\biva\b|partit[ae] iva|flat tax|cuneo|manovra|pension|bollett|energia|\bgas\b|nucleare|automotive|stellantis|industria|cassa integrazione|licenziament|\bpmi\b|impres/i,
  },
  {
    id: "potere",
    label: "Prezzi / Mutui",
    pattern:
      /prezz|inflaz|caro ?vita|carovita|stipend|salar|mutu|affitt|\bcasa\b|case popolari|ceto medio|potere d.acquisto|carrello|spesa/i,
  },
  {
    id: "sanita",
    label: "Sanità",
    pattern: /sanit|ospedal|liste d.attesa|pronto soccorso|medic|\basl\b|welfare|natalit|famigli/i,
  },
];

/** Domini e titoli anglofoni / extra-Italia da escludere dal report. */
const ANGLO_HOST =
  /(^|\.)(bbc\.com|bbc\.co\.uk|moneysavingexpert\.com|reuters\.com|ft\.com|bloomberglaw\.com|bloomberg\.com|theguardian\.com|cnn\.com|nytimes\.com|washingtonpost\.com|forbes\.com|cnbc\.com|politico\.eu|apnews\.com|seatrade-maritime\.com|flamboroughreview\.com|thespec\.com)(\/|$)/i;

const ANGLO_TITLE =
  /\btrump\b|£|\$\d|martin lewis|uk budget|\bisa\b|money saving expert|instant reaction|how the budget|eu top-court|bloc'?s power|among americans|white house|asian maritime|armed robbery|approves tougher/i;

const ITALIAN_SIGNAL =
  /[àèéìòù]|\b(il|lo|la|i|gli|le|di|del|della|dei|delle|nel|nella|sul|sulla|con|per|tra|fra|è|sono|italia|italiani|meloni|salvini|vannacci|governo|manovra|sanità|ospedal|immigra|sbarc|partit[ae] iva|bollett|mutu|liste d.attesa|roma|milano|napoli|calabria|veneto)\b/i;

function hostOf(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isForeignAngloNews(title: string, url?: string): boolean {
  const host = hostOf(url);
  if (host && (ANGLO_HOST.test(host) || /\.co\.uk$/i.test(host) || /\.uk$/i.test(host) || /\.ca$/i.test(host))) {
    return true;
  }
  if (ANGLO_TITLE.test(title)) return true;
  // Filtro positivo lingua italiana (gate unico).
  if (looksForeignEnglish(title)) return true;
  if (/^[A-Za-z0-9 ,:'’"()\-—–|&/.]+$/.test(title) && !ITALIAN_SIGNAL.test(title)) {
    return true;
  }
  return false;
}

export function isJunkNewsHeadline(title: string, url?: string): boolean {
  const text = title.trim();
  if (!text) return true;
  if (JUNK_HEADLINE.test(text)) return true;
  if (JUNK_PAGE_OR_HUB.test(text)) return true;
  if (JUNK_CLICKBAIT_OR_OFFTOPIC.test(text)) return true;
  if (SOCIAL_OR_EMOJI.test(text)) return true;
  if (url && /instagram\.com|facebook\.com\/reel|tiktok\.com/i.test(url)) return true;
  if (isForeignAngloNews(text, url)) return true;
  if (BCE_MONETARY_ONLY.test(text) && !HOUSEHOLD_RATES.test(text)) return true;
  return false;
}

export function isValidNewsHeadline(title: string, url?: string): boolean {
  const text = title.trim();
  if (text.length < 22) return false;
  if (text.split(/\s+/).filter(Boolean).length < 4) return false;
  if (isJunkNewsHeadline(text, url)) return false;
  return true;
}

export function matchesAgendaTheme(title: string): boolean {
  return AGENDA_THEME_PATTERNS.some((theme) => theme.pattern.test(title));
}

/** Titoli ad alta priorità per i 4 pilastri (sicurezza, fisco, prezzi/mutui, sanità). */
export function selectAgendaThemeHeadlines(
  items: { title: string; url?: string }[],
  limit = 8,
): string[] {
  const picked: string[] = [];
  const seen = new Set<string>();
  const usable = items.filter(
    (item) =>
      isValidNewsHeadline(item.title, item.url) &&
      !isForeignAngloNews(item.title, item.url) &&
      matchesAgendaTheme(item.title) &&
      !POLL_ONLY.test(item.title),
  );
  // Una passata per tema, poi riempimento.
  for (const theme of AGENDA_THEME_PATTERNS) {
    const hit = usable.find(
      (item) => theme.pattern.test(item.title) && !seen.has(item.title.toLowerCase()),
    );
    if (!hit) continue;
    seen.add(hit.title.toLowerCase());
    picked.push(hit.title);
    if (picked.length >= limit) return picked;
  }
  for (const item of usable) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(item.title);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function scoreHeadline(title: string): number {
  const neg = NEGATIVE.test(title) ? 1 : 0;
  const pos = POSITIVE.test(title) ? 1 : 0;
  if (neg && !pos) return -1;
  if (pos && !neg) return 1;
  return 0;
}

export function newsScoreFromHeadlines(headlines: string[]): number {
  if (headlines.length === 0) return 0;
  const sum = headlines.reduce((acc, title) => acc + scoreHeadline(title), 0);
  return Math.max(-1, Math.min(1, sum / headlines.length));
}

export type GrowthNewsItem = { title: string; url?: string };

const SUPERMEDIA_URL = "https://www.youtrend.it/la-supermedia/";
const POLL_ARCHIVE_URL = "https://supermedia.youtrend.it/sondaggi/";

/** Aggancia il consenso di oggi in coda, se l'ultimo punto della serie è diverso. */
export function seriesWithCurrentPoint(
  series: ConsensusPoint[],
  startPct: number,
  asOf = new Date(),
): ConsensusPoint[] {
  const iso = asOf.toISOString().slice(0, 10);
  const pct = Math.round(startPct * 100) / 100;
  const sorted = [...series].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const last = sorted[sorted.length - 1];
  if (last && last.isoDate === iso && Math.abs(last.pct - pct) < 0.05) return sorted;
  const prior = sorted.filter((point) => point.isoDate < iso);
  return [...prior, { isoDate: iso, pct }];
}

export function buildGrowthEvidence(input: {
  series: ConsensusPoint[];
  headlines?: string[];
  news?: GrowthNewsItem[];
  polls?: GrowthEvidence["polls"];
}): GrowthEvidence {
  const slope = ewmaRecentSlope(input.series);
  const fromItems: GrowthNewsItem[] = (input.news ?? []).filter((item) =>
    isValidNewsHeadline(item.title, item.url),
  );
  const fromTitles: GrowthNewsItem[] = (input.headlines ?? [])
    .filter((title) => isValidNewsHeadline(title))
    .map((title) => ({ title }));
  const pooled = fromItems.length > 0 ? fromItems : fromTitles;
  const themeFirst = selectAgendaThemeHeadlines(pooled, 8);
  const themeSet = new Set(themeFirst.map((t) => t.toLowerCase()));
  const filler = pooled
    .map((item) => item.title)
    .filter((title) => !themeSet.has(title.toLowerCase()) && !POLL_ONLY.test(title));
  const headlines = [...themeFirst, ...filler].slice(0, 8);
  const byTitle = new Map(pooled.map((item) => [item.title.toLowerCase(), item] as const));
  const newsItems = headlines
    .map((title) => byTitle.get(title.toLowerCase()) ?? { title })
    .slice(0, 8);
  const blob = headlines.join(" ");
  const matches = headlines.length > 0 ? matchAllBipEmergencies(blob) : [];
  return {
    slopePpPerMonth: slope.slopePpPerMonth,
    slope21PpPerMonth: slope.slope21PpPerMonth,
    slope60PpPerMonth: slope.slope60PpPerMonth,
    newsScore: newsScoreFromHeadlines(headlines),
    bipMatches: matches.length,
    newsHeadlines: headlines,
    newsItems,
    bipLabels: matches.slice(0, 2).map((m) => m.label),
    slopeFrom: slope.from60 ?? slope.from21,
    slopeTo: slope.to,
    history: input.series,
    polls: input.polls,
    sources: [
      {
        kind: "consenso",
        label: slope.to
          ? `Velocità recente ${slope.from21 ?? "?"} (65%) e ${slope.from60 ?? "?"} (35%) → ${slope.to}`
          : "Serie Supermedia YouTrend/AGI",
        url: SUPERMEDIA_URL,
      },
      {
        kind: "consenso",
        label: "Archivio sondaggi usati nella stima",
        url: POLL_ARCHIVE_URL,
      },
      ...newsItems
        .filter((item) => item.url)
        .map((item) => ({
          kind: "notizia" as const,
          label: item.title,
          url: item.url,
        })),
    ],
  };
}
