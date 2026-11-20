/**
 * Budget giornaliero Tavily: tipi, calendario Europe/Rome ed etichette.
 * Nessuna dipendenza Node: lo usano sia il gate (server) sia i badge (client).
 */

export const TAVILY_DAILY_TTL_MS = 24 * 60 * 60 * 1000;

const TIME_ZONE = "Europe/Rome";

export type TavilyGateStatus =
  /** Chiamata a Tavily eseguita in questa richiesta. */
  | "live"
  /** Scansione del giorno già fatta: dati salvati, nessuna chiamata. */
  | "cache"
  /** Dati di una scansione precedente (Tavily non ha risposto, o lettura solo-cache). */
  | "stale"
  /** Lettura solo-cache e nessuna scansione salvata. */
  | "empty"
  /** Tavily non ha risposto e non c'è nulla di salvato. */
  | "error"
  /** Chiave assente o `TAVILY_ENABLED=false`. */
  | "disabled";

export type TavilyGateLayer = "memory" | "file" | "db" | "live";

export type TavilyGateMeta = {
  scopeKey: string;
  status: TavilyGateStatus;
  fromCache: boolean;
  layer: TavilyGateLayer | null;
  fetchedAt: string | null;
  /** Giorno (Europe/Rome, YYYY-MM-DD) della scansione servita. */
  dayKey: string | null;
  nextAllowedRefreshAt: string | null;
  dailyScanDone: boolean;
  forceRequested: boolean;
  forceBlocked: boolean;
  forceBypassed: boolean;
  /** `ALLOW_TAVILY_FORCE_REFRESH=true`: il pulsante può forzare una nuova scansione. */
  forceBypassAvailable: boolean;
  message: string | null;
  error: string | null;
};

type RomeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const ROME_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function romeParts(ms: number): RomeParts {
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of ROME_PARTS.formatToParts(new Date(ms))) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year ?? 1970,
    month: out.month ?? 1,
    day: out.day ?? 1,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function romeDayKey(ms: number): string {
  const p = romeParts(ms);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + deltaDays));
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/** Differenza tra l'ora di Roma e UTC in quell'istante (+1h d'inverno, +2h d'estate). */
function romeOffsetMs(ms: number): number {
  const p = romeParts(ms);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(ms / 1000) * 1000;
}

export function startOfNextRomeDay(ms: number): number {
  const p = romeParts(ms);
  const wallMidnight = Date.UTC(p.year, p.month - 1, p.day + 1);
  const guess = wallMidnight - romeOffsetMs(ms);
  return wallMidnight - romeOffsetMs(guess);
}

/**
 * Una scansione resta valida finché è dello stesso giorno a Roma **oppure** ha meno di 24 ore:
 * la successiva parte solo quando sono false entrambe.
 */
export function isDailyEntryFresh(
  entry: { dayKey: string; fetchedAt: number },
  nowMs: number,
): boolean {
  return entry.dayKey === romeDayKey(nowMs) || nowMs - entry.fetchedAt < TAVILY_DAILY_TTL_MS;
}

export function nextAllowedRefreshMs(fetchedAtMs: number): number {
  return Math.max(startOfNextRomeDay(fetchedAtMs), fetchedAtMs + TAVILY_DAILY_TTL_MS);
}

export function formatRomeClock(ms: number): string {
  const p = romeParts(ms);
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** «oggi», «ieri», «domani» rispetto a `nowMs`; altrimenti «il gg/mm». */
function romeDayWord(ms: number, nowMs: number): string {
  const day = romeDayKey(ms);
  const today = romeDayKey(nowMs);
  if (day === today) return "oggi";
  if (day === shiftDayKey(today, -1)) return "ieri";
  if (day === shiftDayKey(today, 1)) return "domani";
  const p = romeParts(ms);
  return `il ${pad2(p.day)}/${pad2(p.month)}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** «domani» se la prossima scansione cade domani, altrimenti giorno e ora esatti. */
function nextRefreshLabel(fetchedAtMs: number, nowMs: number, clockWord: string): string {
  const next = nextAllowedRefreshMs(fetchedAtMs);
  const word = romeDayWord(next, nowMs);
  return word === "domani" ? "domani" : `${word} ${clockWord} ${formatRomeClock(next)}`;
}

export function tavilyDailyDoneMessage(fetchedAtMs: number, nowMs: number): string {
  return (
    `Aggiornamento giornaliero già eseguito ${romeDayWord(fetchedAtMs, nowMs)} alle ${formatRomeClock(fetchedAtMs)} ` +
    `(prossima scansione disponibile ${nextRefreshLabel(fetchedAtMs, nowMs, "alle")} — risparmio crediti Tavily attivo)`
  );
}

export function tavilyStaleMessage(fetchedAtMs: number, nowMs: number, retryAtMs: number | null): string {
  const when = `${romeDayWord(fetchedAtMs, nowMs)} alle ${formatRomeClock(fetchedAtMs)}`;
  if (retryAtMs == null) {
    return `Mostro la scansione Tavily di ${when}: quella di oggi non è ancora partita.`;
  }
  return `Tavily non ha risposto: mostro la scansione di ${when}. Nuovo tentativo dopo le ${formatRomeClock(retryAtMs)}.`;
}

export function tavilyErrorMessage(retryAtMs: number): string {
  return `Scansione Tavily non riuscita: nuovo tentativo dopo le ${formatRomeClock(retryAtMs)}.`;
}

/** La scansione servita è quella valida per oggi (ricalcolato con l'ora di chi guarda). */
export function isTavilyDailyScanDone(
  meta: Pick<TavilyGateMeta, "fetchedAt" | "dayKey">,
  nowMs: number,
): boolean {
  if (!meta.fetchedAt || !meta.dayKey) return false;
  const at = Date.parse(meta.fetchedAt);
  return Number.isFinite(at) && isDailyEntryFresh({ dayKey: meta.dayKey, fetchedAt: at }, nowMs);
}

/** «✓ Scansione giornaliera completata (Oggi ore 09:12 · Prossima: domani)». */
export function tavilyDailyBadgeLabel(
  meta: Pick<TavilyGateMeta, "fetchedAt" | "dayKey">,
  nowMs: number,
): string | null {
  if (!isTavilyDailyScanDone(meta, nowMs) || !meta.fetchedAt) return null;
  const at = Date.parse(meta.fetchedAt);
  return (
    `✓ Scansione giornaliera completata (${capitalize(romeDayWord(at, nowMs))} ore ${formatRomeClock(at)} · ` +
    `Prossima: ${nextRefreshLabel(at, nowMs, "ore")})`
  );
}
