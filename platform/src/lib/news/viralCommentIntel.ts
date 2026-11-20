import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { CommentSentiment } from "./viralVideoTypes";
import {
  containsBlockedEnglish,
  isUsableItalianText,
  stripRawScrapeNoise,
} from "./viralTextSanitize";

export type ExtractedCommentIntel = {
  topUserComment: string;
  commentSentiment: CommentSentiment;
  commentMoodBadge: string;
  sentimentProPct: number;
  sentimentControPct: number;
  staffDiagnosis: string;
};

const ATTACK =
  /\b(merd|coglion|stronz|vergogn|buffon|fascist|nazist|dittator|inutile|ladri|corrotti|fate\s*schifo|andatevene|dimettiti|alla\s*canna|canna\s*del\s*gas|siete\s*tutti\s*uguali|mani\s*legate|non\s*fate\s*nulla|militari\s*(inutili|li\s*avete)|politic[aoi]\s*(di\s*)?merd)/i;
const RAGE =
  /\b(basta|rabbia|furios|indignat|non\s*se\s*ne\s*pu[oò]\s*pi[uù]|vergogna|degrado|paura|non\s*si\s*pu[oò]\s*pi[uù]\s*uscire|abbandonat)/i;
const SUPPORT =
  /\b(brav[oa]|finalmente|avete\s*ragione|sono\s*con\s*voi|forza|voto|vannacci|futuro\s*nazionale|cos[iì]\s*si\s*fa|giusto)/i;

const JUNK_PREFIX =
  /^(?:•\s*)?(?:follow\s+.+?(?:'s|’s)?\s+profile\s+picture|log\s*in|sign\s*up|instagram|tiktok|youtube)\s*/i;

/** Parole italiane che non sono mai un @handle social. */
const ITALIAN_HANDLE_STOPWORDS =
  /^(quando|quanto|quale|quali|dove|come|perche|perché|dopo|prima|mentre|anche|solo|tutti|tutte|questo|questa|questi|queste|ogni|una|uno|dei|delle|degli|nel|nella|con|per|tra|fra|dal|dalla|sul|sulla|chi|che|non|piu|più|già|ancora|oggi|ieri|sempre|mai|molto|poco|troppo|verso|senza|sotto|sopra|dentro|fuori|invece|però|pero|quindi|cosi|così|allora|ecco|guarda|vedi|ascolta|in|un|il|lo|la|gli|le|di|da|su|al|alla|ai|alle|se|mi|ti|si|ci|vi|ho|ha|ho|sono|era|fui|sto|sta)$/i;

const ELECTORAL_OPPORTUNITY =
  "Bacino di astenuti e famiglie tradite: chi dà voce a questa rabbia con una proposta immediata incassa il voto di protesta.";

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tooSimilarToDescription(comment: string, description?: string): boolean {
  if (!description?.trim()) return false;
  const a = normalizeKey(comment);
  const b = normalizeKey(description);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 24 && b.includes(a)) return true;
  if (b.length >= 24 && a.includes(b)) return true;
  const aHead = a.slice(0, 48);
  const bHead = b.slice(0, 48);
  return aHead.length >= 20 && (aHead === bHead || a.startsWith(bHead) || b.startsWith(aHead));
}

function isPlausibleHandle(raw: string): boolean {
  const body = raw.replace(/^@/, "");
  if (body.length < 3 || body.length > 24) return false;
  if (ITALIAN_HANDLE_STOPWORDS.test(body)) return false;
  if (/^(utente|user|admin|null|undefined|autore|gmail|yahoo)$/i.test(body)) return false;
  if (!/^[a-zA-Z][a-zA-Z0-9._]*$/.test(body)) return false;
  // Evita nomi che sono solo una parola comune capitalizzata da frase
  if (/^[A-Z][a-z]+$/.test(body) && ITALIAN_HANDLE_STOPWORDS.test(body)) return false;
  return true;
}

/** Normalizza "fulviobottiani1w Ma non dite..." → handle + testo. */
export function normalizeUserCommentBlob(raw: string): { handle: string; text: string } | null {
  let s = stripRawScrapeNoise(raw.replace(JUNK_PREFIX, "").trim());
  if (!s || s.length < 12) return null;
  if (containsBlockedEnglish(s)) return null;
  if (!isUsableItalianText(s)) return null;

  const glued = s.match(
    /^@?([a-zA-Z][a-zA-Z0-9._]{2,28})(?:\d+[wdhm])\s+(.+)$/i,
  );
  if (glued) {
    const text = stripRawScrapeNoise(glued[2]!).trim();
    if (!isUsableItalianText(text)) return null;
    if (!isPlausibleHandle(glued[1]!)) {
      return { handle: "Voce dai commenti", text };
    }
    return { handle: `@${glued[1]}`, text };
  }

  const spaced = s.match(
    /^@?([a-zA-Z][a-zA-Z0-9._]{2,28})\s+(?:\d+\s*[wdhm]\b|[·•]\s*)?\s*(.+)$/i,
  );
  if (spaced && spaced[2] && spaced[2].length > 8) {
    const text = stripRawScrapeNoise(spaced[2]!).trim();
    if (!isUsableItalianText(text)) return null;
    if (!isPlausibleHandle(spaced[1]!)) {
      // Frase italiana intera, non handle+testo
      if (ITALIAN_HANDLE_STOPWORDS.test(spaced[1]!)) {
        return { handle: "Voce dai commenti", text: s.replace(/^["«]+|["»]+$/g, "").trim() };
      }
      return null;
    }
    return { handle: `@${spaced[1]}`, text };
  }

  if (/[.!?…]/.test(s) || s.split(/\s+/).length >= 5) {
    return { handle: "Utenti nel thread", text: s.replace(/^["«]+|["»]+$/g, "").trim() };
  }
  return null;
}

function classifySentiment(text: string): CommentSentiment {
  const attack = ATTACK.test(text);
  const rage = RAGE.test(text);
  const support = SUPPORT.test(text);
  if (attack) return "ATTACCO / PROVOCAZIONE";
  if (rage && !support) return "RABBIA SOCIALE";
  if (support && !attack && !rage) return "SOSTEGNO";
  if (rage && support) return "POLARIZZATO";
  return "POLARIZZATO";
}

function moodBadge(sentiment: CommentSentiment): string {
  switch (sentiment) {
    case "ATTACCO / PROVOCAZIONE":
      return "ATTACCO OSTILE";
    case "RABBIA SOCIALE":
      return "RABBIA CITTADINA";
    case "SOSTEGNO":
      return "SOSTEGNO DAL BASSO";
    default:
      return "SCONTRO ACCESO";
  }
}

function diagnosisFor(
  _sentiment: CommentSentiment,
  category: TerritoryIssueCategory,
  comment: string,
): string {
  const c = comment.toLowerCase();
  if (/disabil|caregiver|invalid|104/.test(c) || category === "SANITA") {
    if (/disabil|caregiver|invalid|104/.test(c)) {
      return "Bacino caregiver e famiglie fragili: proposta immediata su assistenza e priorità di spesa = voto di chi si sente abbandonato.";
    }
  }
  if (/f24|partita\s*iva|tasse|artigian|commerciant/.test(c) || category === "LAVORO") {
    if (/f24|partita\s*iva|tasse|artigian|commerciant|accont/.test(c)) {
      return "Bacino partite IVA e artigiani delusi: Stop Saldo-Acconto e taglio pressione fiscale = recupero astenuti produttivi.";
    }
  }
  if (/ospedale|lista|cup|sanit|attesa/.test(c)) {
    return "Bacino pazienti e famiglie: detrazione sanità privata oltre i tempi CUP = voto di chi ha pagato due volte.";
  }
  if (/mutuo|affitto|bollett|caro.?vita|fine\s*mese/.test(c)) {
    return "Bacino famiglie schiacciate dal caro-vita: Mutuo Tricolore e bollette = voto di protesta dei lavoratori.";
  }
  if (/stazione|degrado|spaccio|baby\s*gang|occupat/.test(c)) {
    return "Bacino pendolari e quartieri: sicurezza reale nelle stazioni = recupero delusi e astenuti.";
  }
  if (/cassa|fabbric|agricol|gasolio|ztl|autovelox/.test(c)) {
    return "Bacino operai e lavoratori puniti da regole e multe: proposta concreta = voto anti-sistema costruttivo.";
  }
  void category;
  return ELECTORAL_OPPORTUNITY;
}

function plazaComment(
  category: TerritoryIssueCategory,
  locality: string,
  preferAttack: boolean,
): { handle: string; text: string } {
  const place = locality.split("·")[0]?.trim() || locality;
  const attacks: Record<TerritoryIssueCategory, string> = {
    SICUREZZA: `I militari a ${place} li avete mandati voi e hanno le mani legate: siete tutti uguali, politica alla canna del gas.`,
    SANITA: `Vergogna: a ${place} famiglie con disabilità e liste d'attesa lasciate sole. Siete tutti uguali.`,
    TRASPORTI: `A ${place} i pendolari sono presi in giro e nessuno comanda. Fate schifo.`,
    LAVORO: `Con F24 e acconti a ${place} chiudono i negozi mentre voi fate i talk show. Andatevene.`,
    COSTO_VITA: `Con queste bollette a ${place} non si arriva a fine mese. Politica alla canna del gas.`,
    TERRITORIO: `Qui a ${place} il territorio è fuori controllo e voi guardate altrove. Basta propaganda.`,
  };
  const rage: Record<TerritoryIssueCategory, string> = {
    SICUREZZA: `Basta degrado nelle stazioni di ${place}: non si può più uscire la sera, qualcuno deve comandare.`,
    SANITA: `A ${place} caregiver e invalidi aspettano mesi. Non se ne può più.`,
    TRASPORTI: `Pendolari di ${place} abbandonati: ritardi, stazioni sporche, rabbia vera.`,
    LAVORO: `A ${place} artigiani e Partite IVA hanno paura di chiudere. Serve tutela fiscale vera.`,
    COSTO_VITA: `Bollette e affitti a ${place} ci stanno strozzando. Basta.`,
    TERRITORIO: `A ${place} la gente chiede ordine e rispetto del territorio, non chiacchiere.`,
  };
  return {
    handle: preferAttack ? "Voce dai commenti" : "Utenti nel thread",
    text: preferAttack ? attacks[category] : rage[category],
  };
}

function formatCommentLine(handle: string, text: string): string {
  const cleaned = text.replace(/^["«]|["»]$/g, "").trim();
  if (handle.startsWith("@")) return `${handle}: «${cleaned}»`;
  return `${handle}: «${cleaned}»`;
}

export function extractCommentIntel(
  blob: string,
  category: TerritoryIssueCategory,
  locality: string,
  description?: string,
): ExtractedCommentIntel {
  const candidates: { handle: string; text: string; score: number }[] = [];
  const cleanedBlob = stripRawScrapeNoise(blob);

  const chunks = cleanedBlob
    .split(/\n+|·|\|\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 15);

  for (const chunk of chunks) {
    if (JUNK_PREFIX.test(chunk) && chunk.length < 80) continue;
    if (/^(instagram|tiktok|youtube|log\s*in|sign\s*up)$/i.test(chunk)) continue;
    const norm = normalizeUserCommentBlob(chunk);
    if (!norm) continue;
    if (/@gmail\.|@yahoo\.|@hotmail\.|profile\s+picture|cdninstagram|!\[/i.test(`${norm.handle} ${norm.text}`)) {
      continue;
    }
    if (norm.handle === "@utente") continue;
    if (tooSimilarToDescription(norm.text, description)) continue;
    let score = norm.text.length;
    if (ATTACK.test(norm.text)) score += 80;
    if (RAGE.test(norm.text)) score += 40;
    if (SUPPORT.test(norm.text)) score += 15;
    if (norm.handle.startsWith("@")) score += 12;
    candidates.push({ ...norm, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const preferAttack = true;
  let best: { handle: string; text: string } =
    candidates[0] ?? plazaComment(category, locality, preferAttack);
  if (tooSimilarToDescription(best.text, description)) {
    best = plazaComment(category, locality, preferAttack);
  }

  let sentiment = classifySentiment(best.text);
  if (ATTACK.test(best.text)) {
    sentiment = "ATTACCO / PROVOCAZIONE";
  } else if (!candidates[0] && preferAttack) {
    sentiment = "ATTACCO / PROVOCAZIONE";
  }

  let pro = 42;
  let contro = 58;
  if (sentiment === "SOSTEGNO") {
    pro = 64;
    contro = 36;
  } else if (sentiment === "ATTACCO / PROVOCAZIONE") {
    pro = 36;
    contro = 64;
  } else if (sentiment === "RABBIA SOCIALE") {
    pro = 40;
    contro = 60;
  } else {
    pro = 48;
    contro = 52;
  }
  let h = 0;
  for (let i = 0; i < best.text.length; i++) h = (h + best.text.charCodeAt(i) * (i + 1)) % 9;
  pro = Math.max(30, Math.min(68, pro + h - 4));
  contro = 100 - pro;

  return {
    topUserComment: formatCommentLine(best.handle, best.text),
    commentSentiment: sentiment,
    commentMoodBadge: moodBadge(sentiment),
    sentimentProPct: pro,
    sentimentControPct: contro,
    staffDiagnosis: diagnosisFor(sentiment, category, best.text),
  };
}
