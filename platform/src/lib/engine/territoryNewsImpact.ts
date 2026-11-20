import type { Region } from "./constants";
import { provincesForRegion } from "./italianProvinces";
import { categoryStressForRegion } from "./territoryIssueStress";
import type {
  ElectoralSubTheme,
  TerritoryIssueCategory,
} from "./territoryIssuesTypes";

function electoralSubThemeFromText(
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

export type NewsImpattoAssessment = {
  /** 32–98: intensità problema dedotta dal testo e dalla data. */
  score: number;
  /** Etichetta breve per UI (perché questo score). */
  summaryLabel: string;
  /** Comune/provincia citati nel titolo, se riconosciuti. */
  locality: string | null;
};

const SEVERITY_CRITICAL =
  /mort[oi]|uccis[oa]|ferit[oi]\s*gravi|evacuat|maxi[\s-]?emergenza|stato\s*di\s*crisi|disastro|alluvion|frana\s*su|collass|esplosion|incendio\s*devast/i;
const SEVERITY_HIGH =
  /protesta|sciopero|bloccat|sit[\s-]?in|manifest|disserviz|allarme|emergenza|crisi|indignat|reclami|petizione|denunc|inchiesta/i;
const SEVERITY_MEDIUM =
  /code|ritard|lament|disserv|carenze|a\s*rischio|in\s*agitazione|cittadini|residenti|commerciant|pazienti|pendolar/i;
const SCALE_PEOPLE =
  /(\d[\d.\s]*)\s*(mila|milioni|centinaia|migliaia|famiglie|persone|pazienti|pendolari|lavoratori|studenti)/i;
const SCALE_HOURS =
  /(\d+)\s*(ore|giorni)\s*(di\s*)?(attesa|ritardo|code)/i;

function clampScore(n: number): number {
  return Math.min(98, Math.max(32, Math.round(n)));
}

/** Finestra massima per cronaca live in card (preferenza freschezza). */
export const MAX_LIVE_NEWS_AGE_DAYS = 31;

export function newsAgeHours(pubDate: string | null): number | null {
  if (!pubDate) return null;
  const t = Date.parse(pubDate);
  if (!Number.isFinite(t)) return null;
  const ageH = (Date.now() - t) / (3600 * 1000);
  if (ageH < 0) return 0;
  return ageH;
}

export function isFreshTerritoryNews(
  pubDate: string | null,
  maxDays = MAX_LIVE_NEWS_AGE_DAYS,
): boolean {
  const ageH = newsAgeHours(pubDate);
  if (ageH === null) return true;
  return ageH <= maxDays * 24;
}

function recencyBoost(pubDate: string | null): { pts: number; tag: string | null } {
  const ageH = newsAgeHours(pubDate);
  if (ageH === null) return { pts: -6, tag: "data non indicata" };
  if (ageH <= 24) return { pts: 22, tag: "ultime 24h" };
  if (ageH <= 48) return { pts: 18, tag: "<48h" };
  if (ageH <= 72) return { pts: 14, tag: "<72h" };
  if (ageH <= 168) return { pts: 10, tag: "ultima settimana" };
  if (ageH <= 336) return { pts: 5, tag: "ultime 2 settimane" };
  if (ageH <= MAX_LIVE_NEWS_AGE_DAYS * 24) return { pts: 1, tag: "ultimo mese" };
  return { pts: -40, tag: "oltre 30 giorni" };
}

function scaleBoost(blob: string): number {
  let pts = 0;
  const people = SCALE_PEOPLE.exec(blob);
  if (people) {
    const raw = people[1]!.replace(/[\s.]/g, "");
    const n = parseInt(raw, 10);
    const unit = people[2]!.toLowerCase();
    if (unit.includes("milion") || (Number.isFinite(n) && n >= 500)) pts += 14;
    else if (unit.includes("mila") || unit.includes("migliaia") || unit.includes("centinaia")) {
      pts += n >= 50 || unit.includes("centinaia") ? 12 : 8;
    } else if (Number.isFinite(n) && n >= 100) pts += 10;
    else if (Number.isFinite(n) && n >= 20) pts += 6;
  }
  if (SCALE_HOURS.test(blob)) pts += 8;
  return pts;
}

function severityBoost(blob: string): { pts: number; tag: string | null } {
  if (SEVERITY_CRITICAL.test(blob)) {
    return { pts: 22, tag: "emergenza/cronaca forte" };
  }
  if (SEVERITY_HIGH.test(blob)) {
    return { pts: 14, tag: "mobilitazione o crisi" };
  }
  if (SEVERITY_MEDIUM.test(blob)) {
    return { pts: 8, tag: "disservizio segnalato" };
  }
  return { pts: 0, tag: null };
}

function keywordDensityBoost(blob: string, cat: TerritoryIssueCategory): number {
  const needles: Record<TerritoryIssueCategory, RegExp[]> = {
    SANITA: [/ospedal/gi, /pronto\s*soccorso/gi, /liste?\s*d['']attesa/gi, /118/gi],
    TRASPORTI: [/tren/gi, /pendolar/gi, /ritard/gi, /sciopero/gi],
    LAVORO: [/licenzi/gi, /fabbric/gi, /cassa\s*integr/gi, /occupaz/gi],
    SICUREZZA: [/spaccio/gi, /degrad/gi, /rapin/gi, /immigr/gi],
    COSTO_VITA: [/affitt/gi, /bollett/gi, /caro[\s-]?vita/gi, /inflaz/gi],
    TERRITORIO: [/agricolt/gi, /siccit/gi, /frana/gi, /alluv/gi],
  };
  let hits = 0;
  for (const re of needles[cat]) {
    const m = blob.match(re);
    if (m) hits += m.length;
  }
  return Math.min(12, hits * 2);
}

function sourceBoost(sourceUrl?: string): number {
  if (!sourceUrl) return 0;
  const u = sourceUrl.toLowerCase();
  if (u.includes("ansa.it")) return 6;
  if (/repubblica|corriere|ilsole24ore|ilgiornale|fanpage|ilfattoquotidiano/.test(u)) {
    return 3;
  }
  return 0;
}

export function detectNewsLocality(
  titolo: string,
  snippet: string,
  region: Region | "NAZIONALE",
): string | null {
  if (region === "NAZIONALE") return null;
  const blob = `${titolo} ${snippet}`.toLowerCase();
  const provinces = [...provincesForRegion(region)]
    .filter((p) => !p.startsWith("Tutte le province"))
    .sort((a, b) => b.length - a.length);
  for (const p of provinces) {
    const needle = p.toLowerCase();
    if (blob.includes(needle)) return p;
    const short = needle.split(/[\s-]/)[0];
    if (short && short.length >= 4 && blob.includes(short)) {
      if (p === "Monza e Brianza" && /monza|brianza/.test(blob)) return p;
      if (short.length >= 5) return p;
    }
  }
  return null;
}

export function assessNewsImpatto(input: {
  titolo: string;
  snippet: string;
  pubDate: string | null;
  categoria: TerritoryIssueCategory;
  region: Region | "NAZIONALE";
  sourceUrl?: string;
}): NewsImpattoAssessment {
  const titolo = input.titolo.trim();
  const snippet = input.snippet.trim();
  const blob = `${titolo} ${snippet}`;

  let score = 38;
  const tags: string[] = [];

  const sev = severityBoost(blob);
  score += sev.pts;
  if (sev.tag) tags.push(sev.tag);

  score += scaleBoost(blob);

  const rec = recencyBoost(input.pubDate);
  score += rec.pts;
  if (rec.tag) tags.push(rec.tag);

  score += keywordDensityBoost(blob, input.categoria);

  const locality = detectNewsLocality(titolo, snippet, input.region);
  if (locality) {
    score += 12;
    tags.push(locality);
  } else if (input.region !== "NAZIONALE" && blob.toLowerCase().includes(input.region.toLowerCase())) {
    score += 5;
  }

  if (titolo.length >= 45 && snippet.length >= 60) score += 4;

  score += sourceBoost(input.sourceUrl);

  if (electoralSubThemeFromText(titolo, snippet, input.categoria)) {
    score += 5;
    tags.push("tema FN sensibile");
  }

  if (/^(aggiornamento|focus|notizie)\b/i.test(titolo) && titolo.length < 35) {
    score -= 6;
  }

  const finalScore = clampScore(score);
  const summaryLabel =
    tags.length > 0
      ? `Rilevanza notizia: ${tags.slice(0, 3).join(" · ")}`
      : `Rilevanza notizia: segnalazione ${finalScore}/100`;

  return { score: finalScore, summaryLabel, locality };
}

/** Ancora territoriale BesT + contenuto articolo (per card live e blend). */
export function impattoScoreFromNews(
  region: Region | "NAZIONALE",
  categoria: TerritoryIssueCategory,
  assessment: NewsImpattoAssessment,
  catalogAnchor?: number,
): number {
  if (region === "NAZIONALE") {
    return assessment.score;
  }
  const stress = categoryStressForRegion(region, categoria);
  const anchor = catalogAnchor ?? stress;
  return clampScore(anchor * 0.22 + assessment.score * 0.78);
}

/** Tie-break ordinamento (impattoScore include già recencyBoost da assessNewsImpatto). */
export function liveCandidateScore(issue: {
  impattoScore: number;
  pubDate: string | null;
}): number {
  const ageH = newsAgeHours(issue.pubDate);
  if (ageH !== null && ageH > MAX_LIVE_NEWS_AGE_DAYS * 24) {
    return issue.impattoScore - 999;
  }
  let tieBreak = 0;
  if (ageH === null) tieBreak = -8;
  else if (ageH <= 24) tieBreak = 22;
  else if (ageH <= 72) tieBreak = 14;
  else if (ageH <= 168) tieBreak = 9;
  else if (ageH <= MAX_LIVE_NEWS_AGE_DAYS * 24) tieBreak = 3;
  return issue.impattoScore + tieBreak;
}

export function liveRankingScore(impattoScore: number, pubDate?: string | null): number {
  return liveCandidateScore({ impattoScore, pubDate: pubDate ?? null });
}
