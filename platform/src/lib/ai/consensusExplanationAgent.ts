/**
 * Spiegazione causale ipotetica del movimento di consenso nazionale.
 * Anthropic Claude + cache su explanationHash; fallback deterministico coerente col segno.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  cacheUsesLocalDisk,
  cacheUsesProcessMemory,
} from "@/lib/cache/cachePolicy";
import {
  deleteDomainCacheEntry,
  readDomainCacheEntry,
  writeDomainCacheEntry,
} from "@/lib/db/domainCacheRepository";
import type { TextBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { OCTOBER_2026_DROP_NOTE } from "@/lib/engine/consensoCauseNote";
import type { LiveConsensoPayload, PollRelease } from "@/lib/engine/pollTypes";
import { sha256Canonical } from "@/lib/engine/sha256Canonical";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { formatDecimalIt, formatIsoDateIt } from "@/lib/formatIt";

export const CONSENSUS_EXPLANATION_SCHEMA = "v7-plain-why-card-window";

const DOMAIN_CACHE_KEY = `ai:consensus-explanation:${CONSENSUS_EXPLANATION_SCHEMA}`;

/** Temi proprietari FN usati per legare cronaca verificata al movimento. */
export const FN_OWNER_THEMES = [
  { id: "sicurezza", label: "sicurezza", re: /sicurezz|ordine\s+pubblic|criminalit|devast|aggress/i },
  { id: "immigrazione", label: "immigrazione", re: /immigr|migrant|sbarch|frontiere|clandestin/i },
  {
    id: "fisco_caro_vita",
    label: "fisco/caro-vita",
    re: /fisco|tass|caro[\s-]?vita|inflaz|bollett|prezz|salari|costo\s+della\s+vita/i,
  },
  {
    id: "vincoli_ue_industria",
    label: "vincoli UE/industria",
    re: /\bue\b|europa|bruxelles|industria|automotive|green\s*deal|vincol/i,
  },
] as const;

function anthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

function strategistModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
}

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "consensus-explanation.json");
const EXPLANATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ConsensusDirection = "up" | "down" | "flat";

export type ConsensusPollRow = {
  id: string;
  institute: string;
  fieldEnd: string;
  publishedAt: string;
  fnPct: number;
  deltaVsPrevSameInstitute: number | null;
  houseEffectPp: number | null;
  sourceUrl?: string;
};

export type ConsensusNewsItem = {
  id: string;
  label: string;
  url: string;
  date: string;
  summary?: string;
};

export type ConsensusDriversInput = {
  currentConsensus: number;
  previousReferenceValue: number | null;
  previousReferenceDate: string | null;
  deltaPp: number | null;
  direction: ConsensusDirection;
  peakValue: number;
  peakDate: string;
  supermediaValue: number | null;
  scarto: number | null;
  recentPolls: ConsensusPollRow[];
  politicalNews: ConsensusNewsItem[];
  /** Media Δ a parità di istituto (solo rilevazioni con precedente stesso istituto). */
  sameInstituteDeltaPp?: number | null;
  /** Delta grezzo − same-institute: bias di composizione / house effect. */
  houseEffectBiasPp?: number | null;
  /** Ampiezza forbice max−min nei sondaggi in finestra. */
  forkSpreadPp?: number | null;
  forkHighLabel?: string | null;
  forkLowLabel?: string | null;
  /** Temi proprietari FN rilevati nelle fonti verificate. */
  themeHits?: string[];
  /** Direttiva operativa per lo staff tecnico FN. */
  teamDirective?: string;
};

/** Blocchi strutturati per la Card Tattica UI (opzionali → PDF usa `paragraph` + `plainWhy`). */
export type ConsensusExplanationUiBlocks = {
  plainWhy: string;
  /** Retrocompat: ancora esposti ma la UI non li mostra come gergo. */
  rawDeltaPp: number | null;
  sameInstituteDeltaPp: number | null;
  houseEffectPp: number | null;
  spreadInfo?: {
    highLabel: string;
    highVal: number;
    lowLabel: string;
    lowVal: number;
    widthPp: number;
  };
  newsBullets: Array<{ badge: string; text: string; sourceDate?: string; summary?: string }>;
  coreThemes: string[];
  pollstersNote: string;
  flowsSummary: string;
  teamDirective: string;
};

export type ConsensusExplanation = {
  explanationHash: string;
  source: "anthropic" | "deterministic_fallback" | "cache";
  model: string | null;
  headlineDirection: "SALITO" | "SCESO" | "STABILE";
  headline: string;
  /** Spiegazione semplice umana (apertura anche di `paragraph` per il PDF). */
  plainWhy: string;
  paragraph: string;
  citedSources: Array<{ label: string; url: string; date?: string }>;
  disclaimer: string;
  generatedAt: string;
  uiBlocks?: ConsensusExplanationUiBlocks;
};

type CacheStore = {
  schema: string;
  byHash: Record<string, ConsensusExplanation>;
};

const FLAT_EPS = 0.1;

function pct1(n: number): string {
  return formatDecimalIt(n, 1);
}

function pct2(n: number): string {
  return formatDecimalIt(n, 2);
}

export function consensusDirectionOf(deltaPp: number | null | undefined): ConsensusDirection {
  if (deltaPp == null || !Number.isFinite(deltaPp)) return "flat";
  if (deltaPp > FLAT_EPS) return "up";
  if (deltaPp < -FLAT_EPS) return "down";
  return "flat";
}

export function headlineForDirection(direction: ConsensusDirection): {
  headlineDirection: ConsensusExplanation["headlineDirection"];
  headline: string;
} {
  if (direction === "up") {
    return { headlineDirection: "SALITO", headline: "PERCHÉ IL CONSENSO È SALITO" };
  }
  if (direction === "down") {
    return { headlineDirection: "SCESO", headline: "PERCHÉ IL CONSENSO È SCESO" };
  }
  return { headlineDirection: "STABILE", headline: "PERCHÉ IL CONSENSO È STABILE" };
}

export function disclaimerForDirection(direction: ConsensusDirection): string {
  if (direction === "up") {
    return "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con la risalita.";
  }
  if (direction === "down") {
    return "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con il calo.";
  }
  return "Ipotesi basate su analisi stampa e composizione dei sondaggi. La piattaforma non dimostra un legame causale diretto con la stabilità del dato.";
}

/** Peak storico dalla serie Supermedia (settembre 2026 = 7,70%). */
export function peakFromSupermediaSeries(
  series = FN_SUPERMEDIA_CONSENSO_SERIES,
): { peakValue: number; peakDate: string } {
  let peak = series[0] ?? { pct: 7.7, isoDate: "2026-09-08" };
  for (const row of series) {
    if (row.pct > peak.pct) peak = row;
  }
  return { peakValue: peak.pct, peakDate: peak.isoDate };
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export function buildRecentPollRows(
  releases: PollRelease[],
  limit = 8,
): ConsensusPollRow[] {
  const sorted = [...releases].sort((a, b) => {
    const da = (a.publishedAt || a.fieldEnd).slice(0, 10);
    const db = (b.publishedAt || b.fieldEnd).slice(0, 10);
    return db.localeCompare(da) || b.fnPct - a.fnPct;
  });
  const top = sorted.slice(0, Math.max(6, Math.min(limit, sorted.length)));
  const med = median(top.map((p) => p.fnPct));
  const byInst = new Map<string, PollRelease[]>();
  for (const p of sorted) {
    const key = p.institute.trim().toLowerCase();
    const list = byInst.get(key) ?? [];
    list.push(p);
    byInst.set(key, list);
  }
  return top.map((p) => {
    const key = p.institute.trim().toLowerCase();
    const hist = byInst.get(key) ?? [];
    const idx = hist.findIndex((row) => row.id === p.id);
    const prev = idx >= 0 ? hist[idx + 1] : undefined;
    return {
      id: p.id,
      institute: p.institute,
      fieldEnd: p.fieldEnd,
      publishedAt: p.publishedAt,
      fnPct: p.fnPct,
      deltaVsPrevSameInstitute:
        prev != null ? Math.round((p.fnPct - prev.fnPct) * 10) / 10 : null,
      houseEffectPp:
        med != null ? Math.round((p.fnPct - med) * 10) / 10 : null,
      sourceUrl: p.sourceUrl,
    };
  });
}

/** Fonti verificate in archivio + eventuali notizie aggiuntive (solo URL reali). */
export function defaultPoliticalNews(
  asOfIso: string,
  extra: ConsensusNewsItem[] = [],
): ConsensusNewsItem[] {
  const asOf = asOfIso.slice(0, 10);
  const cutoff = new Date(`${asOf}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 21);
  const from = cutoff.toISOString().slice(0, 10);

  const archive: ConsensusNewsItem[] = OCTOBER_2026_DROP_NOTE.sources.map((s, i) => ({
    id: `archive-oct2026-${i}`,
    label: s.label,
    url: s.url,
    date:
      i === 2
        ? "2026-10-29"
        : "2026-10-31",
    summary:
      i === 0
        ? "Pagnoncelli / Corriere: lettura su visibilità e contenimento a destra."
        : i === 1
          ? "Corriere Roma: crisi di crescita, agenda e territori."
          : "Radio Cusano (via Libero): Vannacci su spazio TV e sondaggi.",
  }));

  const merged = [...extra, ...archive].filter((n) => {
    const d = n.date.slice(0, 10);
    return d >= from && d <= asOf && Boolean(n.url?.startsWith("http"));
  });
  const seen = new Set<string>();
  const out: ConsensusNewsItem[] = [];
  for (const n of merged) {
    if (seen.has(n.url)) continue;
    seen.add(n.url);
    out.push(n);
  }
  return out.slice(0, 12);
}

function mean1(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function themeHitsFromNews(news: ConsensusNewsItem[]): string[] {
  const hits = new Set<string>();
  for (const n of news) {
    const blob = `${n.label} ${n.summary ?? ""}`;
    for (const t of FN_OWNER_THEMES) {
      if (t.re.test(blob)) hits.add(t.label);
    }
  }
  return [...hits];
}

function teamDirectiveFor(
  direction: ConsensusDirection,
  houseEffectBiasPp: number | null,
  sameInstituteDeltaPp: number | null,
): string {
  const houseDominates =
    houseEffectBiasPp != null &&
    sameInstituteDeltaPp != null &&
    Math.abs(houseEffectBiasPp) > Math.abs(sameInstituteDeltaPp) + 0.05;

  if (direction === "up") {
    if (houseDominates) {
      return "Sfruttare la visibilità di questi giorni insistendo in TV e sui social su sicurezza, bollette e tasse, senza adagiarsi sul rimbalzo dei sondaggi: una parte del rialzo dipende da quali istituti sono usciti in settimana.";
    }
    return "Sfruttare la spinta vera di questi giorni: più TV e social su sicurezza, immigrazione e tasse, e lavoro concreto su elettori delusi del centrodestra e sull’astensione.";
  }
  if (direction === "down") {
    if (houseDominates) {
      return "Non reagire in panico al numero: una parte del calo dipende dai sondaggisti usciti in settimana. Riprendere spazio TV/radio e tenere disciplina sui temi forti di FN.";
    }
    return "Il calo va preso sul serio: riprendere spazio pubblico in TV, contrastare l’agenda altrui e tornare al centro con sicurezza, immigrazione e costo della vita.";
  }
  return "Tenere la posizione e preparare la prossima uscita forte: sicurezza, bollette e tasse, senza inseguire ogni oscillazione dei sondaggi.";
}

/** Pulisce doppi punti e sequenze `.;` / `;.` nel testo pubblico. */
export function scrubProsePunctuation(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*;/g, ".")
    .replace(/;\s*\./g, ".")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:]){2,}/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Sostituisce date ISO grezze con forma italiana leggibile. */
export function replaceIsoDatesIt(text: string): string {
  return text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (iso) => formatIsoDateIt(iso));
}

/** Rimuove gergo statistico vietato nei testi pubblici. */
export function stripForbiddenJargon(text: string): string {
  return text
    .replace(/\bsame[\s-]?institute\b/gi, "stessi sondaggisti")
    .replace(/\bhouse[\s-]?effects?\b/gi, "cambio dei sondaggisti")
    .replace(/\bdecompressione metodologica\b/gi, "cambio di media tra sondaggisti")
    .replace(/\bdelta grezzo\b/gi, "movimento della media")
    .replace(/\bforbice metodologica\b/gi, "differenza di stima tra sondaggisti")
    .replace(/\bforbice istituti\b/gi, "differenza di stima tra sondaggisti");
}

export function ensureCapitalSentence(text: string): string {
  let t = scrubProsePunctuation(stripForbiddenJargon(text));
  if (!t) return t;
  t = t.charAt(0).toLocaleUpperCase("it-IT") + t.slice(1);
  if (!/[.!?…]$/.test(t)) t = `${t}.`;
  return t.replace(/\.{2,}/g, ".");
}

export function polishPublicProse(text: string): string {
  return scrubProsePunctuation(stripForbiddenJargon(replaceIsoDatesIt(text)));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type CleanNewsItem = { badge: string; text: string };

/**
 * Pulisce una notizia per UI: badge «Testata · data» + testo con maiuscola e un solo punto.
 * Mai prefisso «Fonte —»; niente doppie testate.
 */
export function cleanNewsItem(raw: {
  label: string;
  date?: string;
  summary?: string;
}): CleanNewsItem {
  const label = scrubProsePunctuation((raw.label ?? "").replace(/\s+/g, " "));
  const outlet = (label.split(/[·|,–—]/)[0] ?? label).trim() || "Stampa";
  const labelDate = label.match(
    /(\d{1,2}\s+(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)\.?(?:\s+\d{4})?)/i,
  );
  let datePart = labelDate?.[1]?.trim() ?? "";
  if (!datePart && raw.date) datePart = formatIsoDateIt(raw.date) || raw.date.slice(0, 10);
  if (datePart && !/\d{4}/.test(datePart) && raw.date?.slice(0, 4)) {
    datePart = `${datePart} ${raw.date.slice(0, 4)}`;
  }
  const badge = datePart ? `${outlet} · ${datePart}` : outlet;

  const authorFromLabel =
    label.match(/[·|,]\s*([^,·|]+?)(?:,\s*\d|$)/)?.[1]?.trim() ?? "";

  let text = scrubProsePunctuation((raw.summary ?? "").replace(/\s+/g, " "));
  if (!text) {
    // Senza summary: costruisci una frase leggibile da autore/testata, non da frammenti.
    text = authorFromLabel
      ? `Analisi di ${authorFromLabel} su visibilità e tenuta a destra`
      : `Uscita rilevante su ${outlet}`;
  }

  // Togli prefissi «Fonte —», «Pagnoncelli / Corriere:», testata duplicata
  text = text.replace(/^fonte\s*[-–—:]\s*/i, "");
  text = text
    .replace(
      /^(?:analisi\s+di\s+)?[\w'’.À-ÖØ-öø-ÿ -]{1,40}\s*\/\s*[\w'’.À-ÖØ-öø-ÿ -]{1,30}\s*[-–—:]\s*/iu,
      "",
    )
    .trim();
  text = text.replace(new RegExp(`^${escapeRegExp(outlet)}\\s*[-–—:]\\s*`, "i"), "").trim();
  text = text
    .replace(
      /^(?:lettura\s+(?:di|su)\s+|analisi\s+di\s+)?pagnoncelli(?:\s*\/\s*corriere)?\s*[-–—:,]?\s*/i,
      "",
    )
    .trim();

  // Scarta residui inutili (virgole, punti, date isolate)
  if (!text || /^[,.\s\-–—\d]+$/.test(text) || /^\d{1,2}\s+\w+/.test(text)) {
    text = authorFromLabel
      ? `Analisi di ${authorFromLabel} su visibilità e tenuta a destra`
      : `Uscita rilevante su ${outlet}`;
  }
  if (text.toLowerCase().startsWith(outlet.toLowerCase())) {
    text = text.slice(outlet.length).replace(/^[\s·|:\-–—]+/, "").trim() || text;
  }
  text = ensureCapitalSentence(text);
  return { badge, text };
}

/** @deprecated Usa cleanNewsItem; mantenuta per import esistenti. */
export function cleanNewsCitation(label: string, summary?: string): string {
  return cleanNewsItem({ label, summary }).text;
}

function themeDisplayLabel(raw: string): string {
  const map: Record<string, string> = {
    sicurezza: "Sicurezza",
    immigrazione: "Immigrazione",
    "fisco/caro-vita": "Fisco / Caro-vita",
    "vincoli UE/industria": "Vincoli UE / Industria",
  };
  return map[raw] ?? raw.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function newsBulletsFromInput(
  news: ConsensusNewsItem[],
): ConsensusExplanationUiBlocks["newsBullets"] {
  return news.slice(0, 4).map((n) => {
    const cleaned = cleanNewsItem(n);
    return {
      badge: cleaned.badge,
      text: cleaned.text,
      sourceDate: cleaned.badge,
      summary: cleaned.text,
    };
  });
}

function pollstersNoteFromInput(input: ConsensusDriversInput): string {
  if (input.recentPolls.length < 2) {
    return "In questa finestra ci sono poche rilevazioni: la media va presa con cautela.";
  }
  const sorted = [...input.recentPolls].sort((a, b) => a.fnPct - b.fnPct);
  const lo = sorted[0]!;
  const hi = sorted[sorted.length - 1]!;
  return ensureCapitalSentence(
    `${hi.institute} stima FN al ${pct1(hi.fnPct)}% mentre ${lo.institute} al ${pct1(lo.fnPct)}%: quando esce ${hi.institute} la media sale più facilmente, quando pesa ${lo.institute} la media scende`,
  );
}

function flowsSummaryFromInput(input: ConsensusDriversInput): string {
  const houseAbs = Math.abs(input.houseEffectBiasPp ?? 0);
  const sameAbs = Math.abs(input.sameInstituteDeltaPp ?? 0);
  const houseDominates = input.houseEffectBiasPp != null && houseAbs > sameAbs + 0.05;
  if (input.direction === "up") {
    return houseDominates
      ? "Una parte del rialzo dipende dal cambio dei sondaggisti in finestra; a parità di istituto la variazione media è più contenuta."
      : "A parità di istituto si vede una variazione positiva: non è solo effetto di composizione della media.";
  }
  if (input.direction === "down") {
    return houseDominates
      ? "Una parte del calo dipende dai sondaggisti più bassi in finestra; a parità di istituto la variazione media è più contenuta."
      : "A parità di istituto il calo compare anche nei confronti diretti: non è solo effetto di composizione.";
  }
  return "Il consenso tiene la posizione: né un balzo chiaro né un crollo, in attesa di una nuova uscita pubblica forte.";
}

function humanMove(delta: number): string {
  const abs = Math.abs(delta);
  if (Math.abs(abs - 0.5) < 0.06) return "mezzo punto";
  const unit = Math.abs(abs - 1) < 0.05 ? "punto" : "punti";
  return `${pct1(abs)} ${unit}`;
}

function latestPollByInstitute(polls: ConsensusPollRow[]): ConsensusPollRow[] {
  const sorted = [...polls].sort((a, b) =>
    (b.publishedAt || b.fieldEnd).localeCompare(a.publishedAt || a.fieldEnd),
  );
  const seen = new Set<string>();
  const out: ConsensusPollRow[] = [];
  for (const row of sorted) {
    const key = row.institute.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Stessi istituti delle 4 card sotto il paragrafo (i più recenti, uno per istituto). */
function cardWindowPolls(polls: ConsensusPollRow[]): ConsensusPollRow[] {
  return latestPollByInstitute(polls).slice(0, 4);
}

function previousSameInstitutePct(row: ConsensusPollRow): number | null {
  if (row.deltaVsPrevSameInstitute == null) return null;
  return Math.round((row.fnPct - row.deltaVsPrevSameInstitute) * 10) / 10;
}

/** Spiegazione da consigliere politico: niente gergo, niente disclaimer (sta nel box grigio). */
export function buildPlainWhy(input: ConsensusDriversInput): string {
  const to = `${pct1(input.currentConsensus)}%`;
  const from =
    input.previousReferenceValue != null ? `${pct1(input.previousReferenceValue)}%` : null;
  const prevDate = input.previousReferenceDate
    ? formatIsoDateIt(input.previousReferenceDate)
    : null;
  const fromClause = from ? ` (dal ${from}${prevDate ? ` del ${prevDate}` : ""})` : "";
  const themes =
    input.themeHits && input.themeHits.length > 0
      ? input.themeHits.map(themeDisplayLabel).join(", ")
      : "sicurezza, immigrazione e costo della vita";
  const delta = input.deltaPp;
  const cards = cardWindowPolls(input.recentPolls);
  const cardDeltas = cards
    .map((p) => p.deltaVsPrevSameInstitute)
    .filter((d): d is number => d != null && Number.isFinite(d));
  const same =
    cardDeltas.length > 0 ? mean1(cardDeltas) : (input.sameInstituteDeltaPp ?? null);
  const high = [...cards].sort((a, b) => b.fnPct - a.fnPct)[0];
  const cooling = [...cards]
    .filter((p) => (p.deltaVsPrevSameInstitute ?? 0) < -0.05)
    .sort(
      (a, b) =>
        (a.deltaVsPrevSameInstitute ?? 0) - (b.deltaVsPrevSameInstitute ?? 0),
    )[0];
  const coolingLabel = cooling
    ? (() => {
        const prev = previousSameInstitutePct(cooling);
        return prev != null
          ? `${cooling.institute}, sceso dal ${pct1(prev)}% al ${pct1(cooling.fnPct)}%`
          : `${cooling.institute}, sceso al ${pct1(cooling.fnPct)}%`;
      })()
    : null;

  if (delta != null && delta > FLAT_EPS) {
    const rise = `Il consenso sale di ${humanMove(delta)} arrivando al ${to}${fromClause}`;
    if (same != null && same < -0.05) {
      const highBit = high
        ? ` soprattutto grazie all'ingresso in media di rilevazioni più alte come ${high.institute} (${pct1(high.fnPct)}%)`
        : "";
      const coolBit = coolingLabel
        ? `Guardando però i singoli istituti già usciti la settimana scorsa (come ${coolingLabel}), si vede un lieve raffreddamento di circa ${pct1(Math.abs(same))} punti: segno che la Manovra economica e lo scontro governo-opposizione hanno tolto un po' di spazio televisivo ai temi di FN, compensato comunque dalla tenuta su ${themes}.`
        : `Guardando però gli stessi istituti già usciti la settimana scorsa, si vede un lieve raffreddamento di circa ${pct1(Math.abs(same))} punti: segno che la Manovra economica e lo scontro governo-opposizione hanno tolto un po' di spazio televisivo ai temi di FN, compensato comunque dalla tenuta su ${themes}.`;
      return ensureCapitalSentence(`${rise}${highBit}. ${coolBit}`);
    }
    const sameBit =
      same != null
        ? ` Anche gli stessi istituti, a distanza di una settimana, segnano in media circa ${same > 0 ? "+" : ""}${pct1(same)} punti.`
        : "";
    return ensureCapitalSentence(
      `${rise}. La spinta arriva sia dalla visibilità di Vannacci su TV e stampa sia da una crescita reale nei sondaggi.${sameBit} I temi che tengono il consenso sono ${themes}.`,
    );
  }

  if (delta != null && delta < -FLAT_EPS) {
    const lowBit = cooling
      ? ` Tra i rilevamenti più deboli c'è ${cooling.institute} al ${pct1(cooling.fnPct)}%.`
      : "";
    return ensureCapitalSentence(
      `Il consenso scende di ${humanMove(delta)} e arriva al ${to}${fromClause}. Pesano rilevazioni più basse di questi giorni e un minore spazio televisivo sui temi di FN (${themes}), con l'attenzione spostata sulla Manovra e sullo scontro tra governo e opposizione.${lowBit}`,
    );
  }

  return ensureCapitalSentence(
    `Il consenso resta intorno al ${to}${from ? ` (era ${from}${prevDate ? ` il ${prevDate}` : ""})` : ""}: la base tiene, in attesa di una nuova uscita forte su ${themes}.`,
  );
}

export function buildUiBlocksFromInput(
  input: ConsensusDriversInput,
): ConsensusExplanationUiBlocks {
  let spreadInfo: ConsensusExplanationUiBlocks["spreadInfo"];
  if (input.recentPolls.length >= 2) {
    const sorted = [...input.recentPolls].sort((a, b) => a.fnPct - b.fnPct);
    const lo = sorted[0]!;
    const hi = sorted[sorted.length - 1]!;
    spreadInfo = {
      highLabel: hi.institute,
      highVal: hi.fnPct,
      lowLabel: lo.institute,
      lowVal: lo.fnPct,
      widthPp: Math.round((hi.fnPct - lo.fnPct) * 10) / 10,
    };
  }
  const themes =
    input.themeHits && input.themeHits.length > 0
      ? input.themeHits.map(themeDisplayLabel)
      : FN_OWNER_THEMES.map((t) => themeDisplayLabel(t.label));
  const plainWhy = buildPlainWhy(input);
  const pollstersNote = pollstersNoteFromInput(input);
  const teamDirective = ensureCapitalSentence(
    (input.teamDirective ??
      teamDirectiveFor(
        input.direction,
        input.houseEffectBiasPp ?? null,
        input.sameInstituteDeltaPp ?? null,
      )
    ).replace(/^Team FN:\s*/i, ""),
  );

  return {
    plainWhy,
    rawDeltaPp: input.deltaPp ?? null,
    sameInstituteDeltaPp: input.sameInstituteDeltaPp ?? null,
    houseEffectPp: input.houseEffectBiasPp ?? null,
    spreadInfo,
    newsBullets: newsBulletsFromInput(input.politicalNews),
    coreThemes: themes,
    pollstersNote,
    flowsSummary: ensureCapitalSentence(flowsSummaryFromInput(input)),
    teamDirective,
  };
}

function enrichAnalyticalDrivers(
  base: Omit<
    ConsensusDriversInput,
    | "sameInstituteDeltaPp"
    | "houseEffectBiasPp"
    | "forkSpreadPp"
    | "forkHighLabel"
    | "forkLowLabel"
    | "themeHits"
    | "teamDirective"
  >,
): ConsensusDriversInput {
  const sameDeltas = base.recentPolls
    .map((p) => p.deltaVsPrevSameInstitute)
    .filter((d): d is number => d != null && Number.isFinite(d));
  const sameInstituteDeltaPp = mean1(sameDeltas);
  const houseEffectBiasPp =
    base.deltaPp != null && sameInstituteDeltaPp != null
      ? Math.round((base.deltaPp - sameInstituteDeltaPp) * 10) / 10
      : null;

  let forkSpreadPp: number | null = null;
  let forkHighLabel: string | null = null;
  let forkLowLabel: string | null = null;
  if (base.recentPolls.length >= 2) {
    const sorted = [...base.recentPolls].sort((a, b) => a.fnPct - b.fnPct);
    const lo = sorted[0]!;
    const hi = sorted[sorted.length - 1]!;
    forkSpreadPp = Math.round((hi.fnPct - lo.fnPct) * 10) / 10;
    forkHighLabel = `${hi.institute} ${pct1(hi.fnPct)}%`;
    forkLowLabel = `${lo.institute} ${pct1(lo.fnPct)}%`;
  }

  const themeHits = themeHitsFromNews(base.politicalNews);
  const teamDirective = teamDirectiveFor(
    base.direction,
    houseEffectBiasPp,
    sameInstituteDeltaPp,
  );

  return {
    ...base,
    sameInstituteDeltaPp,
    houseEffectBiasPp,
    forkSpreadPp,
    forkHighLabel,
    forkLowLabel,
    themeHits,
    teamDirective,
  };
}

export function buildConsensusDriversInput(args: {
  currentConsensus: number;
  previousReferenceValue?: number | null;
  previousReferenceDate?: string | null;
  deltaPp?: number | null;
  supermediaValue?: number | null;
  peakValue?: number;
  peakDate?: string;
  releases: PollRelease[];
  politicalNews?: ConsensusNewsItem[];
  asOf?: string;
}): ConsensusDriversInput {
  const peak = peakFromSupermediaSeries();
  const previousReferenceValue = args.previousReferenceValue ?? null;
  const deltaPp =
    args.deltaPp != null
      ? args.deltaPp
      : previousReferenceValue != null
        ? Math.round((args.currentConsensus - previousReferenceValue) * 10) / 10
        : null;
  const supermediaValue = args.supermediaValue ?? null;
  const asOf = (args.asOf ?? new Date().toISOString()).slice(0, 10);
  const politicalNews = defaultPoliticalNews(asOf, args.politicalNews ?? []);
  return enrichAnalyticalDrivers({
    currentConsensus: args.currentConsensus,
    previousReferenceValue,
    previousReferenceDate: args.previousReferenceDate ?? null,
    deltaPp,
    direction: consensusDirectionOf(deltaPp),
    peakValue: args.peakValue ?? peak.peakValue,
    peakDate: args.peakDate ?? peak.peakDate,
    supermediaValue,
    scarto:
      supermediaValue != null
        ? Math.round((args.currentConsensus - supermediaValue) * 10) / 10
        : null,
    recentPolls: buildRecentPollRows(args.releases),
    politicalNews,
  });
}

export function buildConsensusDriversFromLive(
  live: LiveConsensoPayload,
  releases: PollRelease[],
  politicalNews: ConsensusNewsItem[] = [],
): ConsensusDriversInput {
  const brief = live.movementBrief;
  return buildConsensusDriversInput({
    currentConsensus: brief?.pct ?? live.sPct,
    previousReferenceValue: brief?.previousPct ?? null,
    previousReferenceDate: brief?.previousIsoDate ?? null,
    deltaPp: brief?.deltaPp ?? live.dailyDeltaPp ?? null,
    supermediaValue: brief?.benchmarkPct ?? live.supermediaReference?.pct ?? null,
    releases,
    politicalNews,
    asOf: live.calendarDay ?? live.asOf,
  });
}

/** Hash deterministico: schema + consenso + sondaggi + notizie + driver analitici. */
export function explanationHashOf(input: ConsensusDriversInput): string {
  const payload = {
    schema: CONSENSUS_EXPLANATION_SCHEMA,
    currentConsensus: Number(input.currentConsensus.toFixed(3)),
    previousReferenceValue:
      input.previousReferenceValue == null
        ? null
        : Number(input.previousReferenceValue.toFixed(3)),
    deltaPp: input.deltaPp == null ? null : Number(input.deltaPp.toFixed(2)),
    sameInstituteDeltaPp:
      input.sameInstituteDeltaPp == null
        ? null
        : Number(input.sameInstituteDeltaPp.toFixed(2)),
    houseEffectBiasPp:
      input.houseEffectBiasPp == null ? null : Number(input.houseEffectBiasPp.toFixed(2)),
    recentPolls: input.recentPolls.map((p) => ({
      id: p.id,
      fnPct: Number(p.fnPct.toFixed(2)),
    })),
    topNewsIds: input.politicalNews.slice(0, 8).map((n) => n.id),
  };
  return sha256Canonical(payload);
}

function pollRangeLine(polls: ConsensusPollRow[]): string {
  if (!polls.length) return "nessun sondaggio recente in finestra";
  const sorted = [...polls].sort((a, b) => a.fnPct - b.fnPct);
  const lo = sorted[0]!;
  const hi = sorted[sorted.length - 1]!;
  return `${hi.institute} al ${pct1(hi.fnPct)}% contro ${lo.institute} al ${pct1(lo.fnPct)}%`;
}

export function buildDeterministicConsensusExplanation(
  input: ConsensusDriversInput,
): ConsensusExplanation {
  const hash = explanationHashOf(input);
  const { headline, headlineDirection } = headlineForDirection(input.direction);
  const uiBlocks = buildUiBlocksFromInput(input);
  const plainWhy = uiBlocks.plainWhy;
  const peakDateIt = formatIsoDateIt(input.peakDate) || input.peakDate;
  const peakNote =
    input.currentConsensus < input.peakValue - 0.05
      ? `Il picco di settembre restava al ${pct1(input.peakValue)}% (${peakDateIt}).`
      : `Riferimento di settembre: ${pct1(input.peakValue)}% (${peakDateIt}).`;

  const paragraph = polishPublicProse(
    [plainWhy, uiBlocks.pollstersNote, `Cosa fare ora: ${uiBlocks.teamDirective}`, peakNote]
      .filter(Boolean)
      .join(" "),
  );

  const allowed = new Set(input.politicalNews.map((n) => n.url));
  const citedSources = input.politicalNews
    .filter((n) => allowed.has(n.url))
    .slice(0, 3)
    .map((n) => ({ label: cleanNewsItem(n).badge, url: n.url, date: n.date }));

  return {
    explanationHash: hash,
    source: "deterministic_fallback",
    model: null,
    headlineDirection,
    headline,
    plainWhy,
    paragraph,
    citedSources,
    disclaimer: disclaimerForDirection(input.direction),
    generatedAt: new Date().toISOString(),
    uiBlocks,
  };
}

let memoryCache: CacheStore | null = null;

function emptyCacheStore(): CacheStore {
  return { schema: CONSENSUS_EXPLANATION_SCHEMA, byHash: {} };
}

async function readCache(): Promise<CacheStore> {
  if (cacheUsesProcessMemory() && memoryCache) return memoryCache;

  const row = await readDomainCacheEntry<CacheStore>(DOMAIN_CACHE_KEY);
  if (row?.payload?.schema === CONSENSUS_EXPLANATION_SCHEMA && row.payload.byHash) {
    if (cacheUsesProcessMemory()) memoryCache = row.payload;
    return row.payload;
  }

  if (cacheUsesLocalDisk()) {
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw) as CacheStore;
      if (parsed?.schema === CONSENSUS_EXPLANATION_SCHEMA && parsed.byHash) {
        if (cacheUsesProcessMemory()) memoryCache = parsed;
        return parsed;
      }
    } catch {
      /* miss */
    }
  }

  const empty = emptyCacheStore();
  if (cacheUsesProcessMemory()) memoryCache = empty;
  return empty;
}

async function writeCache(store: CacheStore): Promise<void> {
  if (cacheUsesProcessMemory()) memoryCache = store;
  const now = Date.now();
  await writeDomainCacheEntry({
    key: DOMAIN_CACHE_KEY,
    payload: store,
    computedAt: now,
    expiresAt: now + EXPLANATION_CACHE_TTL_MS,
    etag: CONSENSUS_EXPLANATION_SCHEMA,
    sourceStatus: null,
  });
  if (cacheUsesLocalDisk()) {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(CACHE_FILE, JSON.stringify(store), "utf8");
    } catch {
      /* best-effort dev */
    }
  }
}

/** Solo per test: svuota cache in memoria/file. */
export async function __resetConsensusExplanationCacheForTests(): Promise<void> {
  memoryCache = emptyCacheStore();
  await deleteDomainCacheEntry(DOMAIN_CACHE_KEY);
  if (cacheUsesLocalDisk()) {
    try {
      await fs.unlink(CACHE_FILE);
    } catch {
      /* ok */
    }
  }
}

function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? text.trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON non trovato");
  return JSON.parse(candidate.slice(start, end + 1));
}

function sanitizeCitedSources(
  raw: unknown,
  allowedUrls: Set<string>,
  fallback: ConsensusExplanation["citedSources"],
): ConsensusExplanation["citedSources"] {
  if (!Array.isArray(raw)) return fallback;
  const out: ConsensusExplanation["citedSources"] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const url = String(o.url ?? "");
    if (!allowedUrls.has(url)) continue;
    out.push({
      label: String(o.label ?? url),
      url,
      date: typeof o.date === "string" ? o.date : undefined,
    });
  }
  return out.length > 0 ? out.slice(0, 4) : fallback;
}

function normalizeClaudeExplanation(
  raw: unknown,
  fallback: ConsensusExplanation,
  allowedUrls: Set<string>,
  direction: ConsensusDirection,
  model: string,
): ConsensusExplanation {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const { headline, headlineDirection } = headlineForDirection(direction);

  // plainWhy resta quello deterministico: il modello non deve reintrodurre gergo o disclaimer nel paragrafo.
  let plainWhy = fallback.plainWhy;

  let paragraph =
    typeof o.paragraph === "string" && o.paragraph.trim()
      ? o.paragraph.trim()
      : fallback.paragraph;

  // Blocca contraddizioni grossolane rispetto al segno.
  if (direction === "up" && /\b(è sceso|calo in atto|ha perso centralità e quindi scende)\b/i.test(paragraph + plainWhy)) {
    plainWhy = fallback.plainWhy;
    paragraph = fallback.paragraph;
  }
  if (direction === "down" && /\b(è salito|risalita|rimbalzo consolidato)\b/i.test(paragraph + plainWhy)) {
    plainWhy = fallback.plainWhy;
    paragraph = fallback.paragraph;
  }

  // Se Claude non ha messo plainWhy in testa al paragraph, lo anteponiamo.
  const polishedPlain = polishPublicProse(plainWhy);
  let polishedParagraph = polishPublicProse(paragraph);
  if (!polishedParagraph.startsWith(polishedPlain.slice(0, 40))) {
    polishedParagraph = polishPublicProse(`${polishedPlain} ${polishedParagraph}`);
  }

  const disclaimer =
    typeof o.disclaimer === "string" && o.disclaimer.trim()
      ? o.disclaimer.trim()
      : disclaimerForDirection(direction);

  return {
    explanationHash: fallback.explanationHash,
    source: "anthropic",
    model,
    headlineDirection,
    headline,
    plainWhy: polishedPlain,
    paragraph: polishedParagraph,
    citedSources: sanitizeCitedSources(o.citedSources, allowedUrls, fallback.citedSources),
    disclaimer: polishPublicProse(disclaimer),
    generatedAt: new Date().toISOString(),
    uiBlocks: fallback.uiBlocks
      ? { ...fallback.uiBlocks, plainWhy: polishedPlain }
      : undefined,
  };
}

const STYLE_FEW_SHOT = `ESEMPIO DI TONO GIORNALISTICO SEMPLICE (solo stile — adatta al segno attuale):
«${OCTOBER_2026_DROP_NOTE.text}»
Scrivi come un analista politico che parla a un candidato: italiano chiaro, fatti concreti, zero gergo statistico.`;

export async function generateConsensusExplanation(
  input: ConsensusDriversInput,
  opts?: { forceRefresh?: boolean },
): Promise<ConsensusExplanation> {
  const hash = explanationHashOf(input);
  const fallback = buildDeterministicConsensusExplanation(input);
  const store = await readCache();
  if (!opts?.forceRefresh) {
    const hit = store.byHash[hash];
    if (hit?.paragraph) {
      const uiBlocks = hit.uiBlocks ?? buildUiBlocksFromInput(input);
      const plainWhy = polishPublicProse(hit.plainWhy || uiBlocks.plainWhy || fallback.plainWhy);
      return {
        ...hit,
        source: "cache",
        explanationHash: hash,
        plainWhy,
        paragraph: polishPublicProse(hit.paragraph),
        uiBlocks: { ...uiBlocks, plainWhy },
      };
    }
  }

  if (!anthropicConfigured()) {
    store.byHash[hash] = fallback;
    await writeCache(store);
    return fallback;
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const model = strategistModel();
  const allowedUrls = new Set(input.politicalNews.map((n) => n.url));
  const { headline } = headlineForDirection(input.direction);
  const prevDateIt = input.previousReferenceDate
    ? formatIsoDateIt(input.previousReferenceDate)
    : "data n/d";

  const driversBlock = [
    `DIREZIONE: ${input.direction} · titolo obbligatorio: ${headline}`,
    `CONSENSO ATTUALE: ${pct2(input.currentConsensus)}%`,
    `RIFERIMENTO PRECEDENTE: ${
      input.previousReferenceValue == null
        ? "n/d"
        : `${pct1(input.previousReferenceValue)}% (${prevDateIt})`
    }`,
    `VARIAZIONE MEDIA: ${input.deltaPp == null ? "n/d" : `${input.deltaPp > 0 ? "+" : ""}${pct1(input.deltaPp)} punti`}`,
    `MOVIMENTO A PARITÀ DI SONDAGGISTA: ${
      input.sameInstituteDeltaPp == null
        ? "n/d"
        : `${input.sameInstituteDeltaPp > 0 ? "+" : ""}${pct1(input.sameInstituteDeltaPp)} punti`
    }`,
    `EFFETTO CAMBIO SONDAGGISTI: ${
      input.houseEffectBiasPp == null
        ? "n/d"
        : `${input.houseEffectBiasPp > 0 ? "+" : ""}${pct1(input.houseEffectBiasPp)} punti`
    }`,
    `DIFFERENZA TRA SONDAGGISTI: ${
      input.forkSpreadPp == null
        ? pollRangeLine(input.recentPolls)
        : `${input.forkHighLabel} vs ${input.forkLowLabel} · ${pct1(input.forkSpreadPp)} punti`
    }`,
    `TEMI FN: ${(input.themeHits ?? []).join(", ") || "sicurezza, immigrazione, fisco/caro-vita, vincoli UE/industria"}`,
    `BOZZA plainWhy DETERMINISTICA (puoi riscrivere meglio, stesso senso): ${fallback.plainWhy}`,
    `SONDAGGI RECENTI:`,
    ...input.recentPolls.map(
      (p) =>
        `- ${p.institute} ${formatIsoDateIt(p.fieldEnd) || p.fieldEnd}: ${pct1(p.fnPct)}%` +
        (p.deltaVsPrevSameInstitute != null
          ? ` (variazione stesso istituto ${p.deltaVsPrevSameInstitute > 0 ? "+" : ""}${pct1(p.deltaVsPrevSameInstitute)})`
          : ""),
    ),
    `ARTICOLI VERIFICATI (unica lista citabile):`,
    ...input.politicalNews.map((n) => {
      const c = cleanNewsItem(n);
      return `- id=${n.id} | ${c.badge} | ${c.text} | ${n.url}`;
    }),
  ].join("\n");

  const system: TextBlockParam[] = [
    {
      type: "text",
      text: `Sei un analista politico italiano che spiega il consenso di Futuro Nazionale a Roberto Vannacci e allo staff in italiano SEMPLICE e concreto.
${STYLE_FEW_SHOT}

REGOLE FERREE:
1. Coerenza col segno: se DIREZIONE=up non scrivere «è sceso»; se down non scrivere «è salito»; se flat usa stabilità.
2. Zero URL o fatti inventati: citedSources solo dalla lista ARTICOLI VERIFICATI.
3. VIETATO nel testo: «same-institute», «house-effect», «house effect», «decompressione metodologica», «delta grezzo», «forbice metodologica».
4. TRADUCI: stessi sondaggisti; cambio dei sondaggisti usciti in settimana; differenza di stima tra sondaggisti.
5. plainWhy viene sostituito dal testo deterministico (consigliere politico, niente «stima di piattaforma», «effetto composizione», «in finestra», «ipotesi di lettura», «prova causale»). Non riscrivere quel blocco.
6. paragraph = plainWhy in apertura + 1-2 frasi su sondaggisti + «Cosa fare ora…».
7. JSON solo.`,
      cache_control: { type: "ephemeral" },
    } as TextBlockParam,
    {
      type: "text",
      text: `DATI E FONTI:\n${driversBlock}`,
      cache_control: { type: "ephemeral" },
    } as TextBlockParam,
  ];

  try {
    const res = await client.messages.create({
      model,
      max_tokens: 1400,
      cache_control: { type: "ephemeral" },
      system,
      messages: [
        {
          role: "user",
          content: `Genera JSON:
{
  "headlineDirection": "SALITO|SCESO|STABILE",
  "plainWhy": "fatti misurati + ipotesi esplicita (non prova causale), DIREZIONE=${input.direction}",
  "paragraph": "plainWhy + nota sondaggisti + cosa fare ora",
  "citedSources": [{"label":"...","url":"...","date":"YYYY-MM-DD"}],
  "disclaimer": "nota epistemologica coerente con la direzione"
}
Obbligo: headlineDirection = ${headline}. citedSources ⊆ lista verificata. Vietato il gergo statistico.`,
        },
      ],
    });
    const u = res.usage;
    console.info(
      `[prompt-cache:consensus] read=${u.cache_read_input_tokens ?? 0} write=${u.cache_creation_input_tokens ?? 0} input=${u.input_tokens}`,
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const parsed = extractJsonObject(text);
    const explanation = normalizeClaudeExplanation(
      parsed,
      fallback,
      allowedUrls,
      input.direction,
      model,
    );
    store.byHash[hash] = explanation;
    await writeCache(store);
    return explanation;
  } catch (err) {
    console.warn("[consensus-explanation] Anthropic fallita:", err);
    store.byHash[hash] = fallback;
    await writeCache(store);
    return fallback;
  }
}

export async function isExplanationCachedForHash(hash: string): Promise<boolean> {
  const store = await readCache();
  return Boolean(store.byHash[hash]);
}

/** Pre-warm cron: genera solo se hash nuovo. */
export async function warmConsensusExplanationIfNeeded(
  input: ConsensusDriversInput,
): Promise<{ warmed: boolean; explanationHash: string }> {
  const hash = explanationHashOf(input);
  const store = await readCache();
  if (store.byHash[hash]) {
    return { warmed: false, explanationHash: hash };
  }
  await generateConsensusExplanation(input, { forceRefresh: true });
  return { warmed: true, explanationHash: hash };
}
