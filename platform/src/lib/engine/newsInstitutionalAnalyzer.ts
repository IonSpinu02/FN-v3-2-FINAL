import type { Region } from "./constants";
import type { CaricaLocale } from "./localiTypes";
import {
  findCapoluogoInText,
  normalizeGeoText,
  regioneForComune,
} from "./capoluoghiToRegione";
import { inferRegionFromFeedUrl } from "./italianGeoLookup";
import { REGIONS } from "./constants";

export const HARD_BLACKLIST_REGEX =
  /\b(allerta\s+(?:gialla|arancione|rossa|meteo)|temporali|nubifragio|arpal|protezione\s+civile|meteo|pioggia|grandine|neve|vento\s+forte|sciopero|scioperano|sindacat[oi]|sindacalist[ai]|sindacal[ei]|cgil|cisl|uil|usb|cobas|funeral\s+house|funeral[ei]|esequie|necrologio|lutto|addio\s+a|mort[oa]\s+a|decedut[oa]|omicidio|arrestat[oi]|ferit[oi]\s+in\s+scontri|scontri\s+di\s+piazza|incidente\s+stradale|maxi\s+tamponamento|calcio|serie\s+[abc]|champions\s+league|calciomercato|oroscopo|lotto|superenalotto|gratta\s+e\s+vinci)\b/i;

const ROLE_PATTERNS: {
  role: CaricaLocale;
  re: RegExp;
  label: string;
}[] = [
  {
    role: "dep",
    re: /\b(deputat[oi]|parlamentar[ei]|camera\s+dei\s+deputati|montecitorio)\b/i,
    label: "deputato/parlamentare",
  },
  {
    role: "creg",
    re: /\b(consiglier[ei]\s+regional[ei]|consiglio\s+regionale|giunta\s+regionale|assessore\s+regionale)\b/i,
    label: "consiglio/giunta regionale",
  },
  {
    role: "sind",
    re: /\b(sindac[oi]|vicesindaco|primo\s+cittadino)\b/i,
    label: "sindaco",
  },
  {
    role: "com",
    re: /\b(consiglier[ei]\s+comunal[ei]|consiglio\s+comunale|giunta\s+comunale|assessore\s+comunale|assemblea\s+capitolina|municipio)\b/i,
    label: "consiglio/giunta comunale",
  },
];

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeNewsText(titolo: string, snippet: string): string {
  let t = `${titolo} ${snippet}`;
  t = t.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  t = t
    .replace(/&rsquo;/gi, "'")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
  t = t.replace(/^\s*[-–—•]+\s*[A-Za-zÀ-ÿ\s]{2,24}[-–—]+\s*/g, "");
  t = t.replace(/^\(ANSA\)\s*[-–—]?\s*[A-ZÀ-ÿ\s,]+\d{1,2}\s+[A-Z]{3}\s*[-–—]\s*/i, "");
  return t.replace(/\s+/g, " ").trim();
}

function stripSindacNoise(text: string): string {
  return text.replace(/\bsindac(?:at[oi]|alist[ai]|al[ei])\b/gi, " ");
}

function detectRole(text: string): { role: CaricaLocale; keyword: string } | null {
  const cleaned = stripSindacNoise(text);
  for (const p of ROLE_PATTERNS) {
    const m = cleaned.match(p.re);
    if (m?.[0]) {
      return { role: p.role, keyword: m[0].toLowerCase() };
    }
  }
  return null;
}

function findRegionInText(text: string): Region | undefined {
  const norm = normalizeGeoText(text);
  for (const r of REGIONS) {
    const rn = normalizeGeoText(r);
    if (new RegExp(`\\b${escapeRegExp(rn)}\\b`, "i").test(norm)) return r;
  }
  return undefined;
}

export type InstitutionalAnalysis = {
  comune: string;
  regione: Region;
  role: CaricaLocale;
  confidenceScore: number;
  matchedRoleKeyword: string;
  matchedGeoKeyword: string;
};

export function analyzeInstitutionalArticle(input: {
  titolo: string;
  snippet: string;
  feedUrl: string;
  sourceLabel?: string;
  feedRegionHint?: Region;
}): InstitutionalAnalysis | null {
  const blob = sanitizeNewsText(input.titolo, input.snippet);
  if (HARD_BLACKLIST_REGEX.test(blob)) return null;

  const roleHit = detectRole(blob);
  if (!roleHit) return null;

  const comune =
    findCapoluogoInText(blob, input.sourceLabel ?? "") ??
    findCapoluogoInText(input.feedUrl, "");
  let regione: Region | undefined;
  let matchedGeoKeyword: string;

  if (comune) {
    regione = regioneForComune(comune);
    matchedGeoKeyword = `${comune} -> ${regione ?? "?"}`;
  } else {
    regione =
      input.feedRegionHint ??
      inferRegionFromFeedUrl(input.feedUrl) ??
      findRegionInText(blob);
    if (!regione) return null;
    matchedGeoKeyword = `${regione} (da feed/testo)`;
  }

  if (!regione) return null;
  if (comune && regioneForComune(comune) && regioneForComune(comune) !== regione) {
    regione = regioneForComune(comune)!;
    matchedGeoKeyword = `${comune} -> ${regione} (Certificato ISTAT)`;
  } else if (comune) {
    matchedGeoKeyword = `${comune} -> ${regione} (Certificato ISTAT)`;
  }

  let confidenceScore = 75;
  if (comune && blob.toLowerCase().includes(comune.toLowerCase())) {
    confidenceScore += 10;
  }
  if (roleHit.keyword && blob.toLowerCase().includes(roleHit.keyword)) {
    confidenceScore += 8;
  }
  if (input.titolo.toLowerCase().includes(roleHit.keyword.split(" ")[0]!)) {
    confidenceScore += 4;
  }
  confidenceScore = Math.min(99, Math.max(75, confidenceScore));

  return {
    comune: comune ?? "",
    regione,
    role: roleHit.role,
    confidenceScore,
    matchedRoleKeyword: roleHit.keyword,
    matchedGeoKeyword,
  };
}

export function matchesNewsSearch(
  article: {
    titolo: string;
    sommario?: string;
    snippet?: string;
    suggestedComune?: string;
    suggestedRegion?: string;
    source?: string;
  },
  query: string,
): boolean {
  if (!query.trim()) return true;
  let haystack = [
    article.titolo,
    article.sommario ?? article.snippet ?? "",
    article.suggestedComune ?? "",
    article.suggestedRegion ?? "",
    article.source ?? "",
  ]
    .join(" ")
    .toLowerCase();
  haystack = normalizeGeoText(haystack);
  const q = normalizeGeoText(query.trim());
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (token === "roma" || (token.includes("roma") && !token.includes("romagna"))) {
      haystack = haystack.replace(/emilia-romagna/g, " ").replace(/\bromagna\b/g, " ");
    }
    const re = new RegExp(`\\b${escapeRegExp(token)}\\b`, "i");
    if (!re.test(haystack)) return false;
  }
  return true;
}

export function normalizeTitleKey(titolo: string): string {
  return normalizeGeoText(titolo).replace(/[^\w\s]/g, "").slice(0, 120);
}
