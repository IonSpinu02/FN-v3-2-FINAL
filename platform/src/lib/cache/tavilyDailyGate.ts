import { timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  readTavilyDailyFromDb,
  writeTavilyDailyToDb,
} from "@/lib/db/tavilyDailyCacheRepository";
import { isTavilyEnabled } from "@/lib/engine/tavilyConfig";
import {
  isDailyEntryFresh,
  nextAllowedRefreshMs,
  romeDayKey,
  tavilyDailyDoneMessage,
  tavilyErrorMessage,
  tavilyStaleMessage,
  type TavilyGateLayer,
  type TavilyGateMeta,
  type TavilyGateStatus,
} from "./tavilyDailyMeta";

/**
 * Gate unico per Tavily: al massimo una scansione al giorno per `scopeKey`.
 *
 * Ordine di lettura: RAM (`globalThis`) → file JSON (`.cache/` o `/tmp`) e Postgres → Tavily.
 * Le richieste concorrenti sulla stessa chiave condividono una sola Promise.
 * `force` è ignorato finché la scansione del giorno è valida, salvo bypass amministrativo
 * (`ALLOW_TAVILY_FORCE_REFRESH=true` o header `x-tavily-force-secret` = `TAVILY_FORCE_REFRESH_SECRET`).
 */

export const TAVILY_FORCE_SECRET_HEADER = "x-tavily-force-secret";

/** Dopo un errore Tavily non si riprova prima di un'ora: i dati salvati restano in uso. */
const FAILURE_COOLDOWN_MS = 60 * 60 * 1000;
const FILE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DB_TIMEOUT_MS = 2_500;
/** Bump filename per invalidare `.cache/` e /tmp con payload pre-fix (Cristina/Rizzo). */
const FILE_NAME = "tavily-daily-cache-v2.json";

export type TavilyDailyEntry<T = unknown> = {
  scopeKey: string;
  dayKey: string;
  fetchedAt: number;
  payload: T;
};

export type TavilyDailyResult<T> = {
  data: T | null;
  meta: TavilyGateMeta;
};

export type TavilyDailyRequest<T> = {
  scopeKey: string;
  fetcher: () => Promise<T>;
  force?: boolean;
  forceSecret?: string | null;
};

type GateConfig = {
  filePath: string | null;
  fallbackFilePath: string | null;
  useDb: boolean;
  now: () => number;
};

type GateOutcome = {
  entry: TavilyDailyEntry | null;
  layer: TavilyGateLayer | null;
  status: TavilyGateStatus;
  error: string | null;
  retryAt: number | null;
};

type GateState = {
  memory: Map<string, TavilyDailyEntry>;
  inflight: Map<string, Promise<GateOutcome>>;
  failures: Map<string, { at: number; message: string }>;
  fileQueue: Promise<void>;
  config: GateConfig | null;
};

type FileStore = {
  schema: 1;
  entries: Record<string, TavilyDailyEntry>;
};

const NO_FORCE = { forceRequested: false, forceBlocked: false, forceBypassed: false };

function state(): GateState {
  const g = globalThis as typeof globalThis & { __fnTavilyDailyGate?: GateState };
  g.__fnTavilyDailyGate ??= {
    memory: new Map(),
    inflight: new Map(),
    failures: new Map(),
    fileQueue: Promise.resolve(),
    config: null,
  };
  return g.__fnTavilyDailyGate;
}

function defaultConfig(): GateConfig {
  if (process.env.VITEST) {
    return {
      filePath: path.join(os.tmpdir(), `fn-vitest-${process.pid}-${FILE_NAME}`),
      fallbackFilePath: null,
      useDb: false,
      now: Date.now,
    };
  }
  const fromEnv = process.env.TAVILY_DAILY_CACHE_FILE?.trim();
  return {
    filePath:
      fromEnv || (process.env.VERCEL ? null : path.join(process.cwd(), ".cache", FILE_NAME)),
    fallbackFilePath: path.join(os.tmpdir(), FILE_NAME),
    useDb: true,
    now: Date.now,
  };
}

function config(): GateConfig {
  const s = state();
  s.config ??= defaultConfig();
  return s.config;
}

function cacheFiles(cfg: GateConfig): string[] {
  return [...new Set([cfg.filePath, cfg.fallbackFilePath].filter((f): f is string => Boolean(f)))];
}

function isEntry(value: unknown): value is TavilyDailyEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<TavilyDailyEntry>;
  return (
    typeof e.scopeKey === "string" &&
    typeof e.dayKey === "string" &&
    typeof e.fetchedAt === "number" &&
    Number.isFinite(e.fetchedAt) &&
    "payload" in e
  );
}

function newer(
  a: TavilyDailyEntry | null | undefined,
  b: TavilyDailyEntry | null | undefined,
): TavilyDailyEntry | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return b.fetchedAt > a.fetchedAt ? b : a;
}

function remember(entry: TavilyDailyEntry): void {
  const memory = state().memory;
  memory.set(entry.scopeKey, newer(memory.get(entry.scopeKey), entry) ?? entry);
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

// --- Livello 1: file JSON -------------------------------------------------------------

async function readStore(file: string): Promise<FileStore | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8")) as Partial<FileStore>;
    if (parsed?.schema !== 1 || !parsed.entries || typeof parsed.entries !== "object") return null;
    return parsed as FileStore;
  } catch {
    return null;
  }
}

async function readFileEntry(scopeKey: string, cfg: GateConfig): Promise<TavilyDailyEntry | null> {
  let best: TavilyDailyEntry | null = null;
  for (const file of cacheFiles(cfg)) {
    const candidate = (await readStore(file))?.entries[scopeKey];
    if (isEntry(candidate)) best = newer(best, candidate);
  }
  return best;
}

async function writeStore(file: string, entry: TavilyDailyEntry): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const store: FileStore = (await readStore(file)) ?? { schema: 1, entries: {} };
  const prev = store.entries[entry.scopeKey];
  if (!isEntry(prev) || prev.fetchedAt <= entry.fetchedAt) store.entries[entry.scopeKey] = entry;
  for (const [key, e] of Object.entries(store.entries)) {
    if (!isEntry(e) || entry.fetchedAt - e.fetchedAt > FILE_RETENTION_MS) delete store.entries[key];
  }
  const body = JSON.stringify(store);
  const tmp = `${file}.${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  try {
    await fs.rename(tmp, file);
  } catch {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
    await fs.writeFile(file, body, "utf8");
  }
}

/** Scritture in fila: due scope salvati insieme non si sovrascrivono a vicenda. */
function writeFileEntry(entry: TavilyDailyEntry): Promise<void> {
  const s = state();
  const files = cacheFiles(config());
  s.fileQueue = s.fileQueue
    .then(async () => {
      for (const file of files) {
        try {
          await writeStore(file, entry);
          return;
        } catch {
          /* filesystem in sola lettura (es. Vercel): prova /tmp */
        }
      }
    })
    .catch(() => undefined);
  return s.fileQueue;
}

// --- Livello 1: Postgres --------------------------------------------------------------

async function readDbEntry(scopeKey: string): Promise<TavilyDailyEntry | null> {
  const row = await withTimeout(readTavilyDailyFromDb(scopeKey), DB_TIMEOUT_MS, null);
  return isEntry(row) ? row : null;
}

async function readPersisted(
  scopeKey: string,
): Promise<{ entry: TavilyDailyEntry; layer: "file" | "db" } | null> {
  const cfg = config();
  const [fromFile, fromDb] = await Promise.all([
    readFileEntry(scopeKey, cfg),
    cfg.useDb ? readDbEntry(scopeKey) : Promise.resolve(null),
  ]);
  if (fromFile && (!fromDb || fromFile.fetchedAt >= fromDb.fetchedAt)) {
    return { entry: fromFile, layer: "file" };
  }
  return fromDb ? { entry: fromDb, layer: "db" } : null;
}

async function persist(entry: TavilyDailyEntry): Promise<void> {
  const cfg = config();
  await Promise.all([
    writeFileEntry(entry),
    cfg.useDb ? withTimeout(writeTavilyDailyToDb(entry), DB_TIMEOUT_MS * 2, false) : null,
  ]);
}

// --- Gate -----------------------------------------------------------------------------

function forceBypassAllowed(secret: string | null | undefined): boolean {
  if (process.env.ALLOW_TAVILY_FORCE_REFRESH === "true") return true;
  const expected = process.env.TAVILY_FORCE_REFRESH_SECRET?.trim();
  if (!expected || !secret) return false;
  const given = Buffer.from(secret);
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

function messageFor(outcome: GateOutcome, fresh: boolean, now: number): string | null {
  const { entry } = outcome;
  switch (outcome.status) {
    case "disabled":
      return "Tavily non configurato: uso solo le fonti gratuite.";
    case "empty":
      return "Scansione Tavily di oggi non ancora eseguita.";
    case "error":
      return tavilyErrorMessage(outcome.retryAt ?? now + FAILURE_COOLDOWN_MS);
    case "stale":
      return entry ? tavilyStaleMessage(entry.fetchedAt, now, outcome.retryAt) : null;
    default:
      return entry && fresh ? tavilyDailyDoneMessage(entry.fetchedAt, now) : null;
  }
}

function buildMeta(
  scopeKey: string,
  outcome: GateOutcome,
  flags: { forceRequested: boolean; forceBlocked: boolean; forceBypassed: boolean },
  now: number,
): TavilyGateMeta {
  const { entry } = outcome;
  const fresh = entry ? isDailyEntryFresh(entry, now) : false;
  return {
    scopeKey,
    status: outcome.status,
    fromCache: entry != null && outcome.status !== "live",
    layer: outcome.layer,
    fetchedAt: entry ? new Date(entry.fetchedAt).toISOString() : null,
    dayKey: entry?.dayKey ?? null,
    nextAllowedRefreshAt: entry ? new Date(nextAllowedRefreshMs(entry.fetchedAt)).toISOString() : null,
    dailyScanDone: fresh,
    ...flags,
    forceBypassAvailable: process.env.ALLOW_TAVILY_FORCE_REFRESH === "true",
    message: messageFor(outcome, fresh, now),
    error: outcome.error,
  };
}

function toResult<T>(
  scopeKey: string,
  outcome: GateOutcome,
  flags: { forceRequested: boolean; forceBlocked: boolean; forceBypassed: boolean },
): TavilyDailyResult<T> {
  return {
    data: outcome.entry ? (outcome.entry.payload as T) : null,
    meta: buildMeta(scopeKey, outcome, flags, config().now()),
  };
}

function disabledOutcome(): GateOutcome {
  return { entry: null, layer: null, status: "disabled", error: null, retryAt: null };
}

async function execute(
  scopeKey: string,
  fetcher: () => Promise<unknown>,
  bypass: boolean,
): Promise<GateOutcome> {
  const s = state();
  const cfg = config();
  let persisted: TavilyDailyEntry | null = null;

  if (!bypass) {
    const hit = await readPersisted(scopeKey);
    if (hit) {
      persisted = hit.entry;
      remember(hit.entry);
      if (isDailyEntryFresh(hit.entry, cfg.now())) {
        return { entry: hit.entry, layer: hit.layer, status: "cache", error: null, retryAt: null };
      }
    }
    const failure = s.failures.get(scopeKey);
    if (failure && cfg.now() - failure.at < FAILURE_COOLDOWN_MS) {
      const stale = newer(s.memory.get(scopeKey), persisted);
      return {
        entry: stale,
        layer: stale ? "memory" : null,
        status: stale ? "stale" : "error",
        error: failure.message,
        retryAt: failure.at + FAILURE_COOLDOWN_MS,
      };
    }
  }

  try {
    const payload = await fetcher();
    const fetchedAt = cfg.now();
    const entry: TavilyDailyEntry = { scopeKey, dayKey: romeDayKey(fetchedAt), fetchedAt, payload };
    s.memory.set(scopeKey, entry);
    s.failures.delete(scopeKey);
    await persist(entry);
    return { entry, layer: "live", status: "live", error: null, retryAt: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore Tavily";
    const at = cfg.now();
    s.failures.set(scopeKey, { at, message });
    const stale = newer(s.memory.get(scopeKey), persisted);
    return {
      entry: stale,
      layer: stale ? "memory" : null,
      status: stale ? "stale" : "error",
      error: message,
      retryAt: at + FAILURE_COOLDOWN_MS,
    };
  }
}

/** Esegue `fetcher` solo se oggi non c'è già una scansione valida per `scopeKey`. */
export async function runTavilyDaily<T>(request: TavilyDailyRequest<T>): Promise<TavilyDailyResult<T>> {
  const { scopeKey } = request;
  const forceRequested = request.force === true;
  if (!isTavilyEnabled()) return toResult<T>(scopeKey, disabledOutcome(), NO_FORCE);

  const s = state();
  const forceBypassed = forceRequested && forceBypassAllowed(request.forceSecret);

  if (!forceBypassed) {
    const cached = s.memory.get(scopeKey);
    if (cached && isDailyEntryFresh(cached, config().now())) {
      return toResult<T>(
        scopeKey,
        { entry: cached, layer: "memory", status: "cache", error: null, retryAt: null },
        { forceRequested, forceBlocked: forceRequested, forceBypassed: false },
      );
    }
  }

  let job = s.inflight.get(scopeKey);
  if (!job) {
    const created = execute(scopeKey, request.fetcher, forceBypassed);
    const release = () => {
      if (s.inflight.get(scopeKey) === created) s.inflight.delete(scopeKey);
    };
    job = created;
    s.inflight.set(scopeKey, created);
    void created.then(release, release);
  }
  const outcome = await job;
  return toResult<T>(scopeKey, outcome, {
    forceRequested,
    forceBlocked: forceRequested && !forceBypassed && outcome.status !== "live",
    forceBypassed,
  });
}

/** Solo lettura: restituisce l'ultima scansione salvata (anche di ieri) senza mai chiamare Tavily. */
export async function peekTavilyDaily<T>(scopeKey: string): Promise<TavilyDailyResult<T>> {
  if (!isTavilyEnabled()) return toResult<T>(scopeKey, disabledOutcome(), NO_FORCE);
  const now = config().now();
  const cached = state().memory.get(scopeKey) ?? null;
  if (cached && isDailyEntryFresh(cached, now)) {
    return toResult<T>(
      scopeKey,
      { entry: cached, layer: "memory", status: "cache", error: null, retryAt: null },
      NO_FORCE,
    );
  }
  const persisted = await readPersisted(scopeKey);
  const best = newer(cached, persisted?.entry);
  if (!best) {
    return toResult<T>(
      scopeKey,
      { entry: null, layer: null, status: "empty", error: null, retryAt: null },
      NO_FORCE,
    );
  }
  remember(best);
  const layer: TavilyGateLayer = best === cached ? "memory" : (persisted?.layer ?? "file");
  return toResult<T>(
    scopeKey,
    {
      entry: best,
      layer,
      status: isDailyEntryFresh(best, now) ? "cache" : "stale",
      error: null,
      retryAt: null,
    },
    NO_FORCE,
  );
}

export function tavilyForceSecretFromRequest(req: Request): string | null {
  return req.headers.get(TAVILY_FORCE_SECRET_HEADER);
}

/** Solo test: percorsi della cache, Postgres e orologio. */
export function configureTavilyDailyGateForTests(overrides: Partial<GateConfig>): void {
  state().config = { ...defaultConfig(), ...overrides };
}

/** Solo test: svuota la RAM come un'istanza nuova (file e Postgres restano). */
export function resetTavilyDailyGateMemoryForTests(): void {
  const s = state();
  s.memory.clear();
  s.inflight.clear();
  s.failures.clear();
}
