/** Sanitizzazione ferrea: zero markdown CDN, zero inglese grezzo. */

const ENGLISH_BLOCK =
  /\b(Who is|why the|started to|has built|can count|hundreds of|between him|until the|May be a|screenshot of|Photo by|Video by|genuine structure|Italian right|afraid of him|Follow|Log in|Sign up|profile picture)\b/i;

export function containsBlockedEnglish(text: string): boolean {
  return ENGLISH_BLOCK.test(text);
}

/** Alias obbligatorio: pulizia su title / summary / topUserComment. */
export function cleanSocialText(raw: string): string {
  return stripRawScrapeNoise(raw);
}

export function stripRawScrapeNoise(text: string): string {
  let s = text ?? "";
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/\[[^\]]*\]\([^)]*\)/g, " ");
  s = s.replace(/https?:\/\/\S+/gi, " ");
  s = s.replace(/scontent[^\s)"'\]]*/gi, " ");
  s = s.replace(/cdninstagram[^\s)"'\]]*/gi, " ");
  s = s.replace(/fbcdn[^\s)"'\]]*/gi, " ");
  s = s.replace(/\bFuturo Nazionale on Instagram:\s*/gi, "");
  s = s.replace(/\b[\w.\s]{2,40} on Instagram:\s*/gi, "");
  s = s.replace(/\bVideo by\s+[^.|\n]{2,60}/gi, "");
  s = s.replace(/\bPhoto by\s+[^.|\n]{2,60}/gi, "");
  s = s.replace(/\bMay be a Twitter screenshot[^.|\n]*/gi, "");
  s = s.replace(/\[\d{1,2}:\d{2}(?::\d{2})?\]/g, " ");
  s = s.replace(/Follow\s+.+?(?:'s|’s)?\s+profile\s+picture\.?/gi, " ");
  s = s.replace(/[•·]{2,}/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}

/** Prima frase significativa, max `maxLen` caratteri, taglio a fine parola. */
export function shortItalianHeadline(text: string, maxLen = 110): string {
  const clean = stripRawScrapeNoise(text);
  if (!clean) return "Video virale sul territorio";
  const firstSentence = clean.split(/(?<=[.!?…])\s+/)[0] ?? clean;
  if (firstSentence.length <= maxLen) return firstSentence.trim();
  const cut = firstSentence.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function shortItalianContext(text: string, maxLen = 120): string {
  const clean = stripRawScrapeNoise(text);
  if (!clean) return "";
  if (clean.length <= maxLen) return clean;
  const cut = clean.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function isUsableItalianText(text: string): boolean {
  const clean = stripRawScrapeNoise(text);
  if (clean.length < 18) return false;
  if (containsBlockedEnglish(clean)) return false;
  if (/cdninstagram|scontent-|!\[[^\]]*\]|\[[^\]]+\]\(https?:/i.test(clean)) return false;
  // Almeno qualche segnale italiano / latino parlato
  if (!/[àèéìòù]|(\b(che|non|per|una|con|del|della|sono|questo|questa|basta|vergogna)\b)/i.test(clean)) {
    // Accetta anche titoli brevi con maiuscole italiane tipiche
    if (!/\b(degrado|stazione|sanit|bollett|sicurezza|liste|ospedale|militari|vannacci|italia|roma|milano|napoli)\b/i.test(clean)) {
      return false;
    }
  }
  return true;
}
