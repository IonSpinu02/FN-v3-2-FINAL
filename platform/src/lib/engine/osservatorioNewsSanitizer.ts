/**
 * Filtro globale anti-spazzatura RSS — Nazionale + 20 Regioni.
 * Blocca inglese, spam bancario/MAIUSCOLO, cronaca domestica privata
 * abbinata a protocolli militari, e ripulisce titoli tronchi.
 */

/** Token tipici inglesi (filtro positivo lingua: presenza → scarta). */
const ENGLISH_STOP =
  /\b(the|and|with|after|from|less|more|approves|measures|security\s+in|budget|how\s+to|your|under|new|face|rule|mandates|department|labor|market|stocks|shares|quarter|ceo|amid|report|update|how|why|what|their|this|that|which|into|over|than|also|have|has|will|were|been|being|about|across|against|among|before|between|during|without|within|through|while|where|when|would|could|should|pbms|transparency|asian|maritime|theft|armed|robbery|tougher|meloni'?s|italy'?s)\b/i;

/** Parole funzionali italiane comuni — assenza + assenza di accenti → scarta. */
const ITALIAN_FUNCTIONAL =
  /\b(il|lo|la|i|gli|le|di|a|da|in|con|su|per|tra|fra|e|ed|è|sono|sul|sulla|dei|delle|nel|nella|del|della|un|una|che|non|al|ai|alle|alla|agli|degli|nei|nelle|dal|dalla|dai|dalle)\b/i;

/** Marker IT «forti» — evita che `in`/`di`/`a` salvano titoli inglesi. */
const ITALIAN_STRONG =
  /\b(il|lo|la|gli|le|uno|una|del|della|dei|delle|degli|che|non|è|sono|agli|alla|alle|nel|nella|nei|nelle|sul|sulla|anche|come|dopo|prima|verso|fino|più|meno|già|ancora|oggi|ieri|domani|italia|italiano|italiana|regione|comun\w*|sindac\w*|governo|ministro|ospedale|carabinieri|polizia|migranti|meloni|salvini|vannacci|futuro\s*nazionale|fratelli\s*d['']italia|\blega\b|sondagg\w*|supermedia|manovra|camera|senato|palazzo\s*chigi|partit[ae]\s*iva|liste?\s*d['']attesa|pronto\s*soccorso|carovita|caro[\s-]?vita|consiglio|seggi|elezion\w*|giunta)\b/i;

const ITALIAN_MARKERS = ITALIAN_STRONG;

const FOREIGN_HOST =
  /greenwichtime|apnews\.com|bbc\.co\.uk|bbc\.com|cnn\.com|nytimes\.com|washingtonpost\.com|reuters\.com|theguardian\.com|bloomberg\.com|foxnews\.com|seatrade-maritime\.com|flamboroughreview\.com|thespec\.com|spec\.com/i;

const BANK_SPAM =
  /MUTUO\s*CHIROGRAFARIO|FOGLIO\s*INFORMATIVO|\bTAEG\b|\bTAN\b|OFFERTA\s*COMMERCIALE|CODICE\s*SCONTO|BLACK\s*FRIDAY|OROSCOPO|SUPERENALOTTO|\bLOTTO\b|PRESTITO\s*PERSONALE|CESSIONE\s*DEL\s*QUINTO|TAN\s*FISSO|TAEG\s*MASSIMO/i;

const DOMESTIC_PRIVATE =
  /\b(moglie|marito|ex\s*compagno|ex\s*fidanzat[oa]|lite\s*in\s*casa|lite\s*condominiale|parenti|griglia|suocer[ao]|fidanzat[oa]|compagna|compagno\s*uccide|omicidio\s*passionale|femminicidio\s*domestico)\b/i;

const PUBLIC_SECURITY_OK =
  /\b(stazion|treni?|ferrovi|baby\s*gang|spaccio|furti?\s*in\s*abitaz|furto\s*in\s*negoz|rapin|occupazion[ei]\s*abusiv|rivolta\s*in\s*carcere|cpr\b|aggressione\s*(a|agli|all[''])\s*(forze|agenti|polizia|carabinieri|capotreni|medic)|gang\s*stranier|degrado\s*urban|daspo|san\s*vittore|termini|centrale)\b/i;

const MILITARY_OR_MSNA_PROTOCOL =
  /\b(forze\s*armate|protocollo\s*modellare|zone?\s*rosse?|presidio\s*militar|esercito\s*nelle\s*strade|sbarchi|msna|minori\s*stranieri|ong\b|blocco\s*naval)\b/i;

/** Commemorazioni / cerimonie — falsi positivi su LAVORO/SICUREZZA. */
export const COMMEMORATIVE_BLACKLIST =
  /\b(il\s+ricordo|commemorazion[ei]|anniversario\s+della\s+scomparsa|cerimonia\s+in\s+memoria|in\s+memoria\s+di|onorificenz[ae]|celebrazion[ei]\s+(?:del|della|dei|delle)\s+(?:ricordo|lutto|vittim)|omaggio\s+(?:ai|alle|ai\s+caduti)|giornata\s+della\s+memoria)\b/i;

/** Promo culturali / sport nautico — non emergenze cittadine. */
export const SOFT_PROMO_BLACKLIST =
  /america['']?s?\s*cup|coppa\s*america|opera\s*d['']arte|mostra\s*(d['']arte|collettiva)|allestimento\s*artist|inaugurazion[ei].{0,24}(mostra|museo)|valore\s*aggiunto.{0,40}(sport|mare)|cittadinanza\s+con\s+mare|passione\s+sportiva|\b\d+\s*misure\s*chiave\b|card\s*anziani.{0,40}liste?\s*d['']attesa/i;

/**
 * Astensione obbligatoria: articoli storici, culturali, artistici, sportivi,
 * gossip, recensioni — non devono entrare nell'Osservatorio né ricevere una
 * categoria di fallback (es. caro-vita / emergenza abitativa).
 */
export const CULTURAL_HISTORICAL_ABSTENTION =
  /\b(cristina\s+di\s+svezia|regina|re\s+di|imperatore|\bpapa\b|principessa|principe\s+di|secolo|seicento|settecento|ottocento|novecento|storia\s+di|\bstoria\b|mostra|museo|\barte\b|\bcultura\b|capitale\s+della\s+cultura|anniversario|\blibro\b|romanzo|\bfilm\b|cinema|teatro|concerto|serie\s+tv|serie\s+a|champions|oroscopo|partita|campionato|gossip|recension[ei]|biograf|ritratto\s+storic|personaggio\s+storic|arte\s+contemporanea|festival\s+del|premio\s+nobel|castello|palazzo\s+reale|dinastia|monarch)/i;

/** Path editoriali non pertinenti al radar disagi. */
export const CULTURAL_URL_PATH =
  /\/(cultura|spettacoli|sport|lifestyle|viaggi|moda|gossip|cinema|teatro|libri|arte)(\/|$)/i;

/** Evidenza testuale di un problema socio-economico/sanitario/infrastrutturale/sicurezza attuale. */
export const SOCIOECONOMIC_PROBLEM_EVIDENCE =
  /\b(liste?\s*d['']attesa|pronto\s*soccorso|ospedal\w*|ambulanz\w*|carovita|caro[\s-]?vita|bollett\w*|affitt\w*|sfratt\w*|sgomber\w*|emergenza\s*abitativ\w*|mutui|inflazione|disoccupazione|licenziament\w*|crisi\s*azien\w*|pendolar\w*|ritard[oi]\s*(dei\s*)?tren\w*|degrad[oi]\w*|spaccio|rapin\w*|furti|baby\s*gang|alluvion\w*|frana|dissesto|immigraz\w*|sbarchi|cpr\b|code\s+al|protesta|disservizi|sicurezz[ao]\s+(urbana|cittadina|nelle\s+stazion)|carcere|detenut\w*)\b/i;

export function isCommemorativeOrCeremonial(title: string, snippet = ""): boolean {
  return COMMEMORATIVE_BLACKLIST.test(`${title} ${snippet}`);
}

export function isSoftPromoOrCultureNoise(title: string, snippet = ""): boolean {
  return SOFT_PROMO_BLACKLIST.test(`${title} ${snippet}`);
}

export function isCulturalUrlPath(url = ""): boolean {
  if (!url) return false;
  try {
    return CULTURAL_URL_PATH.test(new URL(url).pathname);
  } catch {
    return CULTURAL_URL_PATH.test(url);
  }
}

export function isCulturalHistoricalAbstention(
  title: string,
  snippet = "",
  url = "",
): boolean {
  if (CULTURAL_HISTORICAL_ABSTENTION.test(`${title} ${snippet}`)) return true;
  if (isCulturalUrlPath(url)) return true;
  return false;
}

/** True se il testo ha evidenza esplicita di un problema attuale pertinente all'Osservatorio. */
export function hasSocioEconomicProblemEvidence(title: string, snippet = ""): boolean {
  return SOCIOECONOMIC_PROBLEM_EVIDENCE.test(`${title} ${snippet}`);
}

/**
 * Astensione: articolo culturale/storico/sportivo/incerto senza evidenza
 * socio-economica attuale → scartare, non forzare su una categoria.
 */
export function shouldAbstainFromOsservatorio(
  title: string,
  snippet = "",
  url = "",
): boolean {
  if (isCulturalHistoricalAbstention(title, snippet, url)) return true;
  if (isSoftPromoOrCultureNoise(title, snippet)) return true;
  if (isCommemorativeOrCeremonial(title, snippet)) return true;
  if (!hasSocioEconomicProblemEvidence(title, snippet)) return true;
  return false;
}

/** Filtro read-time su issue già materializzate (anche da cache sporca). */
export function isTerritoryIssueAbstention(issue: {
  titoloProblema?: string;
  sintesiLamentela?: string;
  sourceUrl?: string | null;
  evidence?: { title?: string; snippet?: string; url?: string | null } | null;
}): boolean {
  const title = issue.titoloProblema ?? issue.evidence?.title ?? "";
  const snippet = issue.sintesiLamentela ?? issue.evidence?.snippet ?? "";
  const url = issue.sourceUrl ?? issue.evidence?.url ?? "";
  return shouldAbstainFromOsservatorio(title, snippet, url);
}

const SOURCE_HOST_MAP: Array<{ test: RegExp; label: string }> = [
  { test: /ansa\.it/i, label: "ANSA" },
  { test: /skytg24|sky\.it/i, label: "Sky TG24" },
  { test: /adnkronos/i, label: "Adnkronos" },
  { test: /ilgiorno\.it/i, label: "Il Giorno" },
  { test: /gazzettino/i, label: "Il Gazzettino" },
  { test: /lastampa\.it/i, label: "La Stampa" },
  { test: /repubblica\.it/i, label: "la Repubblica" },
  { test: /corriere\.it/i, label: "Corriere della Sera" },
  { test: /ilsole24ore|sole24ore/i, label: "Il Sole 24 Ore" },
  { test: /ilmessaggero/i, label: "Il Messaggero" },
  { test: /ilmattino/i, label: "Il Mattino" },
  { test: /gazzetta\.it/i, label: "La Gazzetta dello Sport" },
  { test: /tgcom24|mediaset/i, label: "Tgcom24" },
  { test: /rainews|rai\.it/i, label: "Rai News" },
  { test: /huffingtonpost|huffpost/i, label: "HuffPost" },
  { test: /open\.online/i, label: "Open" },
  { test: /fanpage/i, label: "Fanpage" },
  { test: /today\.it/i, label: "Today" },
  { test: /ilfattoquotidiano/i, label: "Il Fatto Quotidiano" },
  { test: /agi\.it/i, label: "AGI" },
  { test: /youtrend/i, label: "YouTrend" },
  { test: /tavily/i, label: "Aggregatore web" },
  { test: /news\.google/i, label: "Google News" },
];

export function uppercaseRatio(title: string): number {
  const letters = title.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (letters.length < 8) return 0;
  const upper = letters.replace(/[^A-ZÀ-Ÿ]/g, "").length;
  return upper / letters.length;
}

/**
 * Filtro positivo lingua italiana: scarta titoli con token inglesi tipici
 * oppure privi di parole funzionali italiane / accenti.
 */
export function passesItalianLanguageGate(title: string, snippet = ""): boolean {
  const t = title.trim();
  if (!t) return false;
  if (ENGLISH_STOP.test(t)) return false;
  if (/\b(americans?|canadian|among|dead|collision|spain'?s|q[1-4]\b)\b/i.test(t)) {
    return false;
  }
  if (ITALIAN_FUNCTIONAL.test(t) || /[àèéìòù]/i.test(t) || ITALIAN_STRONG.test(t)) {
    return true;
  }
  // Snippet può salvare solo se il titolo non è già anglofono e lo snippet è IT.
  const sn = snippet.trim();
  if (sn && !ENGLISH_STOP.test(sn) && (ITALIAN_FUNCTIONAL.test(sn) || /[àèéìòù]/i.test(sn))) {
    return false; // titolo senza marker IT resta fuori comunque
  }
  return false;
}

export function looksForeignEnglish(title: string, snippet = ""): boolean {
  return !passesItalianLanguageGate(title, snippet);
}

export function isBankingOrCommercialSpam(title: string): boolean {
  if (BANK_SPAM.test(title)) return true;
  if (uppercaseRatio(title) > 0.7) return true;
  return false;
}

/** Cronaca domestica privata non deve andare su Forze Armate / MSNA. */
export function isDomesticPrivateMispaired(
  title: string,
  snippet = "",
  categoryHint?: string,
): boolean {
  const blob = `${title} ${snippet}`;
  if (!DOMESTIC_PRIVATE.test(blob)) return false;
  if (PUBLIC_SECURITY_OK.test(blob)) return false;
  if (MILITARY_OR_MSNA_PROTOCOL.test(blob)) return true;
  if (categoryHint === "SICUREZZA" && !PUBLIC_SECURITY_OK.test(blob)) {
    return DOMESTIC_PRIVATE.test(blob);
  }
  return false;
}

/** SICUREZZA accettabile solo se pubblica (stazioni, gang, spaccio, …). */
export function isPublicSecurityRelevant(title: string, snippet = ""): boolean {
  const blob = `${title} ${snippet}`;
  if (DOMESTIC_PRIVATE.test(blob) && !PUBLIC_SECURITY_OK.test(blob)) return false;
  return true;
}

export function cleanTruncatedHeadline(raw: string): string {
  let t = raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  // Suffissi testata: "Titolo - ANSA" / "Titolo | Sky TG24"
  t = t.replace(
    /\s*[-–—|]\s*(ANSA|Sky\s*TG24|Adnkronos|Reuters|AGI|la\s*Repubblica|Corriere(?:\s*della\s*Sera)?|Il\s*Sole\s*24\s*Ore|Il\s*Giorno|Il\s*Gazzettino|La\s*Stampa|Tgcom24|Rai\s*News|HuffPost|Open|Fanpage|Today)\s*$/i,
    "",
  );
  // Rimuovi ellissi a metà parola spezzata tipo "presu..." / "tr..."
  t = t.replace(/\b([A-Za-zÀ-ÿ]{1,3})\.\.\.$/u, "");
  t = t.replace(/\s*\.\.\.\s*$/u, "").trim();
  // Evita taglio a metà se finisce con trattino spezzato
  t = t.replace(/\s*[-–—]\s*$/u, "").trim();
  return t;
}

export function extractNewsSourceLabel(
  sourceUrl?: string | null,
  feedHint?: string | null,
  title?: string | null,
): string {
  if (feedHint?.trim()) {
    const hint = feedHint.trim();
    if (/tavily/i.test(hint)) return "Aggregatore web";
    if (/ansa/i.test(hint)) return "ANSA";
  }
  if (sourceUrl?.startsWith("http")) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
      for (const row of SOURCE_HOST_MAP) {
        if (row.test.test(host) || row.test.test(sourceUrl)) return row.label;
      }
      return host.split(".")[0]?.toUpperCase() ?? "Fonte web";
    } catch {
      /* fall through */
    }
  }
  if (title) {
    const m = title.match(
      /\s*[-–—|]\s*(ANSA|Sky\s*TG24|Adnkronos|AGI|la\s*Repubblica|Corriere(?:\s*della\s*Sera)?|Il\s*Giorno|La\s*Stampa)\s*$/i,
    );
    if (m?.[1]) return m[1].replace(/\s+/g, " ");
  }
  return "Fonte certificata";
}

export type OsservatorioSanitizeResult = {
  ok: boolean;
  reason?: string;
  title: string;
  sourceLabel: string;
};

export function sanitizeOsservatorioNewsItem(input: {
  title: string;
  snippet?: string;
  sourceUrl?: string | null;
  feedHint?: string | null;
  categoryHint?: string;
}): OsservatorioSanitizeResult {
  const title = cleanTruncatedHeadline(input.title);
  const snippet = input.snippet ?? "";
  const sourceLabel = extractNewsSourceLabel(
    input.sourceUrl,
    input.feedHint,
    input.title,
  );

  if (!title || title.length < 18) {
    return { ok: false, reason: "title_too_short", title, sourceLabel };
  }
  if (looksForeignEnglish(title, snippet)) {
    return { ok: false, reason: "foreign_english", title, sourceLabel };
  }
  if (FOREIGN_HOST.test(input.sourceUrl ?? "") || FOREIGN_HOST.test(sourceLabel)) {
    return { ok: false, reason: "foreign_host", title, sourceLabel };
  }
  if (isBankingOrCommercialSpam(title)) {
    return { ok: false, reason: "bank_spam_or_caps", title, sourceLabel };
  }
  if (isDomesticPrivateMispaired(title, snippet, input.categoryHint)) {
    return { ok: false, reason: "domestic_private", title, sourceLabel };
  }
  if (isCommemorativeOrCeremonial(title, snippet)) {
    return { ok: false, reason: "commemorative", title, sourceLabel };
  }
  if (isSoftPromoOrCultureNoise(title, snippet)) {
    return { ok: false, reason: "soft_promo_culture", title, sourceLabel };
  }
  if (isCulturalHistoricalAbstention(title, snippet, input.sourceUrl ?? "")) {
    return { ok: false, reason: "cultural_historical_abstention", title, sourceLabel };
  }
  if (!hasSocioEconomicProblemEvidence(title, snippet)) {
    return { ok: false, reason: "no_socioeconomic_evidence", title, sourceLabel };
  }
  if (
    input.categoryHint === "SICUREZZA" &&
    !isPublicSecurityRelevant(title, snippet)
  ) {
    return { ok: false, reason: "private_not_public_security", title, sourceLabel };
  }
  return { ok: true, title, sourceLabel };
}
