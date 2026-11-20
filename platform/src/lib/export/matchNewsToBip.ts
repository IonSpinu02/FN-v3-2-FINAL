import {
  BIP_FN_PROMISES_CATALOG,
  type FnBipPromise,
} from "@/lib/bipProgramCatalog";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { DossierNewsBipCard, DossierTextOrigin } from "@/lib/export/dossierTypes";
import { formatDateIt, pdfSafeText, sanitizeDossierPublicText } from "@/lib/export/pdfSafeText";

type NewsLike = {
  title: string;
  source?: string;
  date?: string;
  url?: string;
  summary?: string;
};

/** Aree tematiche distinte per la matrice Notizie → B.I.P. (max 1 scheda per tema). */
export type DossierNewsTheme =
  | "fisco_manovra"
  | "energia_bollette"
  | "casa_mutui"
  | "sicurezza_immigrazione"
  | "sanita"
  | "trasporti"
  | "lavoro_industria"
  | "territorio_agricoltura";

const PRIORITY_THEMES: DossierNewsTheme[] = [
  "fisco_manovra",
  "energia_bollette",
  "casa_mutui",
  "sicurezza_immigrazione",
  "sanita",
];

const THEME_RULES: Array<{
  theme: DossierNewsTheme;
  fronteBase: string;
  category: TerritoryIssueCategory;
  bipId: string;
  badgeTitle: string;
  keywords: string[];
  riskFor: () => string;
  remedyFor: () => string;
  regions: string[];
  defaultOutlet: string;
}> = [
  {
    theme: "fisco_manovra",
    fronteBase: "Manovra / Partite IVA",
    category: "LAVORO",
    bipId: "BIP.02",
    badgeTitle: "LAVORO - Filiera Italia & Tutela P.IVA",
    keywords: ["manovra", "bilancio", "tasse", "fisco", "p.iva", "partita iva", "cuneo", "saldo-acconto"],
    riskFor: () =>
      "La pressione fiscale sulla Manovra colpisce Partite IVA e ceto produttivo del Nord: fascia che oggi cerca una voce chiara fuori dalla maggioranza. Se FN tace, quei voti restano in astensione o tornano ai partiti di governo per inerzia.",
    remedyFor: () =>
      "Rivendicare Filiera Italia, sgravi selettivi e tutela del lavoro autonomo. Insistere in pubblico su conti chiari e zero nuove strette sulle piccole attività.",
    regions: ["Veneto", "Lombardia", "Piemonte"],
    defaultOutlet: "Il Sole 24 Ore",
  },
  {
    theme: "energia_bollette",
    fronteBase: "Caro-bollette / Energia",
    category: "LAVORO",
    bipId: "BIP.09-EN",
    badgeTitle: "ENERGIA - Bollette sovrane & Taglio oneri",
    keywords: ["bolletta", "bollette", "energia", "gas", "caro-energia", "luce", "carburant"],
    riskFor: () =>
      "Il caro-bollette pesa su imprese e famiglie del Nord produttivo: chi paga di più la luce e il gas è anche il bacino più sensibile a una proposta energetica concreta. Senza risposta, la protesta resta disponibile ad altri o all'astensione.",
    remedyFor: () =>
      "Portare in campo bollette sovrane, HVO/e-fuels e taglio degli oneri impropri. Messaggio da ripetere in TV e nei banchetti industriali.",
    regions: ["Veneto", "Lombardia", "Emilia-Romagna"],
    defaultOutlet: "Il Sole 24 Ore",
  },
  {
    theme: "casa_mutui",
    fronteBase: "Casa / Mutui / Famiglie",
    category: "COSTO_VITA",
    bipId: "BIP.13-CV",
    badgeTitle: "CARO-VITA - Mutuo Tricolore & Case popolari",
    keywords: ["mutuo", "mutui", "casa", "affitto", "caro-vita", "inflazione", "prezzi", "abitativ"],
    riskFor: () =>
      "Mutui e affitti comprimono i giovani e le famiglie sotto i 45 anni: elettori che votano se vedono una soluzione abitativa, non solo una denuncia. Qui FN può guadagnare se collega casa, natalità e case popolari.",
    remedyFor: () =>
      "Mutuo Tricolore, priorità alle famiglie e rilancio delle case popolari. Punti da rivendicare: rata sostenibile e accesso alla prima casa",
    regions: ["Lazio", "Lombardia", "Campania"],
    defaultOutlet: "Facile.it",
  },
  {
    theme: "sicurezza_immigrazione",
    fronteBase: "Sicurezza stazioni / Confini",
    category: "SICUREZZA",
    bipId: "BIP.07",
    badgeTitle: "SICUREZZA - Presidio stazioni & Confini",
    keywords: [
      "stazione",
      "furto",
      "rapina",
      "degrado",
      "sicurezza",
      "quartiere",
      "droga",
      "migrant",
      "sbarchi",
      "ong",
      "msna",
      "balcan",
    ],
    riskFor: () =>
      "Stazioni, degrado urbano e flussi irregolari (inclusi i minori stranieri non accompagnati) mobilitano elettori urbani e di confine. È un tema ad alta salienza: senza proposta operativa FN rischia di restare spettatore della protesta.",
    remedyFor: () =>
      "Protocollo Modellare, Bonificare, Presidiare e Ricostruire. Rivendicare controlli, rimpatri e presidio delle stazioni nei nodi critici.",
    regions: ["Lombardia", "Lazio", "Friuli-Venezia Giulia"],
    defaultOutlet: "Corriere della Sera",
  },
  {
    theme: "sanita",
    fronteBase: "Liste d'attesa / Sanità",
    category: "SANITA",
    bipId: "BIP.13-SAN",
    badgeTitle: "SANITÀ - Liste d'attesa & Legge 38/2010",
    keywords: ["sanità", "sanita", "liste d'attesa", "ospedale", "pronto soccorso", "medico", "cup"],
    riskFor: () =>
      "Liste d'attesa e pronto soccorso intasati erodono fiducia soprattutto al Sud e nelle aree interne. Famiglie e anziani sono il bacino più sensibile: silenzio di FN = opportunità persa sul territorio.",
    remedyFor: () =>
      "Liste d'attesa sotto controllo e piena applicazione della Legge 38/2010. Messaggio: tempi certi, medici sul territorio, fine della sanità a due velocità.",
    regions: ["Calabria", "Abruzzo", "Campania"],
    defaultOutlet: "Ansa",
  },
  {
    theme: "trasporti",
    fronteBase: "Sicurezza stazioni / Confini",
    category: "TRASPORTI",
    bipId: "BIP.09-TR",
    badgeTitle: "TRASPORTI - Ferrovia & Mobilità",
    keywords: ["treno", "ferrovia", "trasporti", "pendolari", "autostrada", "traffico", "continuità"],
    riskFor: () =>
      "Nodi ferroviari e pendolari quotidiani colpiscono il consenso locale: elettori che vivono il degrado del viaggio casa-lavoro. FN guadagna se collega mobilità a sicurezza e ripresa dei servizi.",
    remedyFor: () =>
      "Ferrovia utile, no Fit for 55 punitivo, ripristino servizi. Da portare nei nodi pendolari e nelle stazioni critiche.",
    regions: ["Lazio", "Lombardia", "Liguria"],
    defaultOutlet: "Ansa",
  },
  {
    theme: "lavoro_industria",
    fronteBase: "Manovra / Partite IVA",
    category: "LAVORO",
    bipId: "BIP.02",
    badgeTitle: "LAVORO - Filiera Italia & Industria",
    keywords: ["automotive", "industria", "cassa integrazione", "stellantis", "filiera", "lavoro"],
    riskFor: () =>
      "Crisi industriale e cassa integrazione colpiscono il bacino manifatturiero: operai e indotto cercano una proposta di filiera, non solo protesta. Qui FN può intercettare delusione se parla di lavoro concreto.",
    remedyFor: () =>
      "Filiera Italia e tutela del lavoro produttivo. Rivendicare stabilimenti, indotto e formazione sul territorio.",
    regions: ["Piemonte", "Lombardia", "Emilia-Romagna"],
    defaultOutlet: "Il Sole 24 Ore",
  },
  {
    theme: "territorio_agricoltura",
    fronteBase: "Casa / Mutui / Famiglie",
    category: "TERRITORIO",
    bipId: "BIP.15",
    badgeTitle: "TERRITORIO - Acqua, PAC & Forestale",
    keywords: ["agricol", "pac", "coldiretti", "allevator", "siccità", "acqua"],
    riskFor: () =>
      "Agricoltura e acqua toccano reddito e radicamento nelle province: bacino di affinità potenziale se FN collega emergenza locale a misure concrete sul territorio.",
    remedyFor: () =>
      "Acqua, PAC e Corpo Forestale. Messaggio da portare nelle fiere e nei comuni agricoli.",
    regions: ["Puglia", "Sicilia", "Emilia-Romagna"],
    defaultOutlet: "Ansa",
  },
];

const FALLBACK_BY_THEME: Array<{
  theme: DossierNewsTheme;
  headline: string;
  dateHint?: string;
}> = [
  {
    theme: "fisco_manovra",
    headline: "Manovra e pressione fiscale su Partite IVA — Il Sole 24 Ore",
    dateHint: "Novembre 2026",
  },
  {
    theme: "energia_bollette",
    headline: "Bollette e caro-energia sulle imprese del Nord — Il Sole 24 Ore",
    dateHint: "Novembre 2026",
  },
  {
    theme: "casa_mutui",
    headline: "Mutui e costo della casa sulle famiglie — Facile.it",
    dateHint: "Novembre 2026",
  },
  {
    theme: "sicurezza_immigrazione",
    headline: "Sicurezza nelle stazioni metropolitane — Corriere della Sera",
    dateHint: "Novembre 2026",
  },
  {
    theme: "sanita",
    headline: "Liste d'attesa sanitarie nelle regioni del Sud — Ansa",
    dateHint: "Novembre 2026",
  },
];

function findBip(preferredId: string, category: TerritoryIssueCategory): FnBipPromise {
  const hit = BIP_FN_PROMISES_CATALOG.find((b) => b.id === preferredId);
  if (hit) return hit;
  return (
    BIP_FN_PROMISES_CATALOG.find((b) => b.category === category) ??
    BIP_FN_PROMISES_CATALOG[0]!
  );
}

function domainFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

const MONTH_YEAR_RE =
  /\b((?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[.]?\s+20\d{2})\b/i;

function looksLikeDateLabel(s: string): boolean {
  return (
    MONTH_YEAR_RE.test(s) ||
    /^\d{4}-\d{2}-\d{2}/.test(s) ||
    /^\d{1,2}\s+\w+\s+20\d{2}$/i.test(s)
  );
}

function parseHeadline(raw: string): NewsLike {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const urlMatch = cleaned.match(/https?:\/\/\S+/i);
  const url = urlMatch?.[0];
  const withoutUrl = url ? cleaned.replace(url, "").trim() : cleaned;
  const embeddedDate = withoutUrl.match(MONTH_YEAR_RE)?.[1];
  const parts = withoutUrl.split(/\s[·|—–-]\s/);
  if (parts.length >= 2) {
    let source = parts[parts.length - 1]?.trim() || undefined;
    let titleParts = parts.slice(0, -1);
    let date = embeddedDate;
    // Se l'ultimo pezzo è una data (es. «Novembre 2028»), non usarla come testata.
    if (source && looksLikeDateLabel(source)) {
      date = source;
      source = parts.length >= 3 ? parts[parts.length - 2]?.trim() : domainFromUrl(url) ?? undefined;
      titleParts = parts.slice(0, Math.max(1, parts.length - 2));
    }
    return {
      title: titleParts.join(" - ").trim() || withoutUrl,
      source:
        source && !/^fonte/i.test(source) && !looksLikeDateLabel(source)
          ? source
          : domainFromUrl(url) ?? undefined,
      date,
      url,
    };
  }
  return {
    title: withoutUrl,
    source: domainFromUrl(url) ?? undefined,
    date: embeddedDate,
    url,
  };
}

function matchTheme(hay: string): (typeof THEME_RULES)[number] {
  return (
    THEME_RULES.find((row) =>
      row.keywords.some((k) => hay.includes(k.toLowerCase())),
    ) ?? THEME_RULES.find((r) => r.theme === "fisco_manovra")!
  );
}

function displayDate(raw?: string, fallbackMonth = "Novembre 2026"): string {
  const t = (raw ?? "").trim();
  if (!t || /data non indicata/i.test(t)) return fallbackMonth;
  const refY = Number(fallbackMonth.match(/20\d{2}/)?.[0] ?? "2026");
  const yearOf = (s: string): number | null => {
    const m = s.match(/(20\d{2})/);
    return m ? Number(m[1]) : null;
  };
  const normalizeYear = (label: string, y: number): string => {
    if (y > refY || y < refY - 1) {
      const month = label.match(
        /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\b/i,
      );
      if (month) {
        const m = month[1]!;
        return `${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()} ${refY}`;
      }
      return fallbackMonth;
    }
    return label;
  };

  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const y = yearOf(t);
    if (y != null && (y > refY || y < refY - 1)) return fallbackMonth;
    return formatDateIt(t, "short");
  }
  const y = yearOf(t);
  if (y != null) return normalizeYear(t, y);
  return t;
}

export function matchNewsHeadlineToBip(
  headline: string,
  opts?: {
    date?: string;
    origin?: DossierTextOrigin;
    theme?: DossierNewsTheme;
    dateHint?: string;
    rank?: number;
  },
): DossierNewsBipCard {
  const parsed = parseHeadline(headline);
  const hay = `${parsed.title} ${parsed.summary ?? ""}`.toLowerCase();
  const rule =
    (opts?.theme
      ? THEME_RULES.find((r) => r.theme === opts.theme)
      : undefined) ?? matchTheme(hay);
  const bip = findBip(rule.bipId, rule.category);
  const rawSource = parsed.source?.trim();
  const testata =
    (rawSource && !looksLikeDateLabel(rawSource) ? rawSource : undefined) ||
    domainFromUrl(parsed.url) ||
    rule.defaultOutlet;
  const data = displayDate(
    opts?.date ?? parsed.date,
    opts?.dateHint ?? "Novembre 2026",
  );
  const rank = opts?.rank ?? 1;
  return {
    fronteLabel: `${rank}. ${rule.fronteBase}`,
    notiziaTitolo: pdfSafeText(parsed.title.slice(0, 180)),
    testata: pdfSafeText(testata),
    dataPubblicazione: pdfSafeText(data),
    rischioOpportunitaConsenso: sanitizeDossierPublicText(rule.riskFor()),
    codiceBip: bip.id,
    titoloBip: pdfSafeText(rule.badgeTitle),
    azioneRimedioBip: sanitizeDossierPublicText(rule.remedyFor()),
    regioniTarget: rule.regions,
    origin: opts?.origin ?? "Regole deterministiche di modello",
  };
}

/**
 * Seleziona fino a `limit` notizie su temi DISTINTI, ordinate 1..5.
 */
export function selectNewsForDossier(
  headlines: string[],
  limit = 5,
): DossierNewsBipCard[] {
  const byTheme = new Map<DossierNewsTheme, DossierNewsBipCard>();

  for (const theme of PRIORITY_THEMES) {
    const hit = headlines.find((h) => {
      const t = h.trim().toLowerCase();
      if (!t || t.length < 12) return false;
      return matchTheme(t).theme === theme;
    });
    if (!hit) continue;
    byTheme.set(theme, matchNewsHeadlineToBip(hit, { theme }));
  }

  for (const h of headlines) {
    if (byTheme.size >= limit) break;
    const t = h.trim();
    if (!t || t.length < 12) continue;
    if (/^(home|indice|leggi anche|video|gallery)\b/i.test(t)) continue;
    const rule = matchTheme(t.toLowerCase());
    if (byTheme.has(rule.theme)) continue;
    byTheme.set(rule.theme, matchNewsHeadlineToBip(t, { theme: rule.theme }));
  }

  for (const fb of FALLBACK_BY_THEME) {
    if (byTheme.size >= limit) break;
    if (byTheme.has(fb.theme)) continue;
    byTheme.set(
      fb.theme,
      matchNewsHeadlineToBip(fb.headline, {
        theme: fb.theme,
        dateHint: fb.dateHint,
      }),
    );
  }

  const ordered = PRIORITY_THEMES.map((theme) => byTheme.get(theme)).filter(
    (c): c is DossierNewsBipCard => Boolean(c),
  );

  // Rinumera sempre 1..N dopo l'ordinamento finale.
  return ordered.slice(0, limit).map((card, index) => ({
    ...card,
    fronteLabel: `${index + 1}. ${card.fronteLabel.replace(/^\d+\.\s*/, "")}`,
  }));
}

export function assertBipIdsValid(cards: DossierNewsBipCard[]): boolean {
  const catalogIds = new Set(BIP_FN_PROMISES_CATALOG.map((b) => b.id));
  return cards.every((c) => catalogIds.has(c.codiceBip));
}
