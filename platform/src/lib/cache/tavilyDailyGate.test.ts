import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as dbRepo from "@/lib/db/tavilyDailyCacheRepository";
import { tavilyQueriesForInstitutionalNews, TAVILY_DEFECTION_NEWS_QUERY } from "@/lib/engine/tavilyInstitutionalQueries";
import { fetchTavilyNewsDaily } from "@/lib/engine/tavilyNewsFetch";
import { tavilyQueriesForTerritory } from "@/lib/engine/tavilyTerritoryQueries";
import { resolveViralReels } from "@/lib/news/tavilyViralVideosEngine";
import { TAVILY_MAX_QUERY_CHARS, viralNationalBatchQueries } from "@/lib/news/viralRegionQueries";
import { clearProcessedViralItems } from "@/lib/news/viralVideosCache";
import { CATALOG_POLITICIANS_FOR_NEWS } from "@/lib/politicalDefectionsCatalog";
import { fetchLiveDefectionNews } from "@/lib/politicalDefectionsLiveRss";
import {
  configureTavilyDailyGateForTests,
  peekTavilyDaily,
  resetTavilyDailyGateMemoryForTests,
  runTavilyDaily,
  tavilyForceSecretFromRequest,
} from "./tavilyDailyGate";
import {
  isDailyEntryFresh,
  nextAllowedRefreshMs,
  romeDayKey,
  startOfNextRomeDay,
  tavilyDailyBadgeLabel,
  tavilyDailyDoneMessage,
} from "./tavilyDailyMeta";

vi.mock("@/lib/db/tavilyDailyCacheRepository", () => ({
  readTavilyDailyFromDb: vi.fn(async () => null),
  writeTavilyDailyToDb: vi.fn(async () => true),
}));

const TAVILY_ORIGIN = "https://api.tavily.com/";
const TIKTOK_OEMBED = "https://www.tiktok.com/oembed";
const ENV_KEYS = [
  "TAVILY_API_KEY",
  "TAVILY_ENABLED",
  "ALLOW_TAVILY_FORCE_REFRESH",
  "TAVILY_FORCE_REFRESH_SECRET",
] as const;

/** 09:12 a Roma (CET, UTC+1). */
const MORNING = "2026-11-06T08:12:00.000Z";
const DONE_TODAY_MESSAGE =
  "Aggiornamento giornaliero già eseguito oggi alle 09:12 (prossima scansione disponibile domani — risparmio crediti Tavily attivo)";

const NEWS_RESULTS = [
  {
    title: "Deputato lascia la Lega e passa al Gruppo Misto",
    url: "https://www.ansa.it/politica/deputato-lascia-lega.html",
    content: "Il deputato annuncia l'uscita dalla Lega e il passaggio al Gruppo Misto.",
    score: 0.9,
    published_date: "2026-11-05T10:00:00Z",
  },
];

const VIRAL_RESULTS = [
  {
    title: "Milano, borseggio alla stazione Centrale: nessuno interviene, che vergogna",
    url: "https://www.tiktok.com/@pendolare.milano/video/7300000000000000001",
    content:
      "Il video della denuncia alla stazione di Milano Centrale: borseggio sotto gli occhi di tutti. 120K visualizzazioni, 8.400 Mi piace, 950 commenti",
    raw_content: "Sfogo di una pendolare: alla stazione non c'è sicurezza, basta degrado.",
    score: 0.82,
  },
  {
    title: "Sono una caregiver e non ce la faccio più: la legge 104 non basta",
    url: "https://www.tiktok.com/@caregiver.stanca/video/7300000000000000002",
    content:
      "Sfogo di una madre caregiver con figlio disabile: per le pratiche dell'invalidità ci vogliono mesi. 45K visualizzazioni",
    raw_content: "Nessuno ci aiuta, siamo soli con un figlio disabile e le spese.",
    score: 0.74,
  },
];

type FetchCall = { url: string; body: Record<string, unknown> | null };

let calls: FetchCall[] = [];
let tavilyResults: unknown[] = NEWS_RESULTS;
let tavilyStatus = 200;
let clock = Date.parse(MORNING);
let cacheFile = "";
let seq = 0;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {};

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = urlOf(input);
  calls.push({
    url,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
  });
  if (url.startsWith(TAVILY_ORIGIN)) {
    if (tavilyStatus !== 200) return new Response("quota esaurita", { status: tavilyStatus });
    return new Response(JSON.stringify({ results: tavilyResults, response_time: 0.4 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response("not found", { status: 404 });
});

function tavilyCalls(): FetchCall[] {
  return calls.filter((c) => c.url.startsWith(TAVILY_ORIGIN));
}

function setClock(iso: string): void {
  clock = Date.parse(iso);
}

function newsDaily(scopeKey = "test-scope", options?: { force?: boolean; forceSecret?: string | null }) {
  return fetchTavilyNewsDaily(scopeKey, ["Futuro Nazionale Vannacci"], options);
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.TAVILY_API_KEY = "tvly-test";

  calls = [];
  tavilyResults = NEWS_RESULTS;
  tavilyStatus = 200;
  setClock(MORNING);
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);

  vi.mocked(dbRepo.readTavilyDailyFromDb).mockReset().mockResolvedValue(null);
  vi.mocked(dbRepo.writeTavilyDailyToDb).mockReset().mockResolvedValue(true);

  cacheFile = path.join(os.tmpdir(), `fn-tavily-gate-${process.pid}-${++seq}.json`);
  configureTavilyDailyGateForTests({
    filePath: cacheFile,
    fallbackFilePath: null,
    useDb: false,
    now: () => clock,
  });
  resetTavilyDailyGateMemoryForTests();
  clearProcessedViralItems();
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] == null) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  fs.rmSync(cacheFile, { force: true });
});

describe("calendario Europe/Rome", () => {
  it("il giorno cambia alla mezzanotte di Roma, non a quella UTC", () => {
    expect(romeDayKey(Date.parse("2026-11-06T22:59:00Z"))).toBe("2026-11-06");
    expect(romeDayKey(Date.parse("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
    expect(romeDayKey(Date.parse("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
    expect(romeDayKey(Date.parse("2026-07-01T22:01:00Z"))).toBe("2026-07-02");
  });

  it("mezzanotte successiva corretta anche nei giorni del cambio d'ora", () => {
    const next = (iso: string) => new Date(startOfNextRomeDay(Date.parse(iso))).toISOString();
    expect(next("2026-10-24T12:00:00Z")).toBe("2026-10-24T22:00:00.000Z");
    expect(next("2026-10-24T23:30:00Z")).toBe("2026-10-25T23:00:00.000Z");
    expect(next("2026-10-25T10:00:00Z")).toBe("2026-10-25T23:00:00.000Z");
    expect(next("2026-03-28T12:00:00Z")).toBe("2026-03-28T23:00:00.000Z");
    expect(next("2026-03-29T12:00:00Z")).toBe("2026-03-29T22:00:00.000Z");
  });

  it("regola: stesso giorno a Roma OPPURE meno di 24 ore", () => {
    const fetchedAt = Date.parse("2026-11-06T22:00:00Z");
    const entry = { dayKey: romeDayKey(fetchedAt), fetchedAt };
    expect(isDailyEntryFresh(entry, Date.parse("2026-11-07T07:00:00Z"))).toBe(true);
    expect(isDailyEntryFresh(entry, Date.parse("2026-11-07T21:59:00Z"))).toBe(true);
    expect(isDailyEntryFresh(entry, Date.parse("2026-11-07T22:01:00Z"))).toBe(false);
    expect(new Date(nextAllowedRefreshMs(fetchedAt)).toISOString()).toBe("2026-11-07T22:00:00.000Z");
  });

  it("messaggio e badge con i testi richiesti", () => {
    const at = Date.parse(MORNING);
    const now = Date.parse("2026-11-06T15:40:00Z");
    expect(tavilyDailyDoneMessage(at, now)).toBe(DONE_TODAY_MESSAGE);
    expect(
      tavilyDailyBadgeLabel({ fetchedAt: new Date(at).toISOString(), dayKey: "2026-11-06" }, now),
    ).toBe("✓ Scansione giornaliera completata (Oggi ore 09:12 · Prossima: domani)");
  });

  it("scansione delle 23:00: il mattino dopo dice «ieri» e indica l'ora esatta di sblocco", () => {
    const at = Date.parse("2026-11-06T22:00:00Z");
    const now = Date.parse("2026-11-07T07:00:00Z");
    expect(tavilyDailyDoneMessage(at, now)).toBe(
      "Aggiornamento giornaliero già eseguito ieri alle 23:00 (prossima scansione disponibile oggi alle 23:00 — risparmio crediti Tavily attivo)",
    );
    expect(
      tavilyDailyBadgeLabel({ fetchedAt: new Date(at).toISOString(), dayKey: "2026-11-06" }, now),
    ).toBe("✓ Scansione giornaliera completata (Ieri ore 23:00 · Prossima: oggi ore 23:00)");
  });
});

describe("tavilyDailyGate", () => {
  it("5 chiamate di seguito nella stessa giornata: fetch verso api.tavily.com esattamente 1 volta", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await newsDaily());
      clock += 37 * 60 * 1000;
    }

    expect(tavilyCalls()).toHaveLength(1);
    expect(results.map((r) => r.meta.status)).toEqual(["live", "cache", "cache", "cache", "cache"]);
    expect(results.slice(1).every((r) => r.meta.fromCache && r.meta.dailyScanDone)).toBe(true);
    expect(results[4]?.items).toEqual(results[0]?.items);
    expect(results[4]?.meta.fetchedAt).toBe(MORNING);
    expect(results[4]?.meta.nextAllowedRefreshAt).toBe("2026-11-07T08:12:00.000Z");
  });

  it("richieste concorrenti condividono la stessa chiamata (in-flight)", async () => {
    const out = await Promise.all(Array.from({ length: 5 }, () => newsDaily()));
    expect(tavilyCalls()).toHaveLength(1);
    expect(out.every((r) => r.items.length === 1)).toBe(true);
  });

  it("ogni scopeKey ha il proprio budget giornaliero", async () => {
    await newsDaily("viral-reels-italia");
    await newsDaily("party-switches-radar");
    await newsDaily("viral-reels-italia");
    await newsDaily("party-switches-radar");
    expect(tavilyCalls()).toHaveLength(2);
  });

  it("force=true viene bloccato con il messaggio giornaliero", async () => {
    await newsDaily();
    setClock("2026-11-06T14:30:00Z");
    const forced = await newsDaily("test-scope", { force: true });

    expect(tavilyCalls()).toHaveLength(1);
    expect(forced.meta.status).toBe("cache");
    expect(forced.meta.forceRequested).toBe(true);
    expect(forced.meta.forceBlocked).toBe(true);
    expect(forced.meta.forceBypassed).toBe(false);
    expect(forced.meta.message).toBe(DONE_TODAY_MESSAGE);
    expect(forced.items).toHaveLength(1);
  });

  it("bypass solo con ALLOW_TAVILY_FORCE_REFRESH=true", async () => {
    await newsDaily();
    process.env.ALLOW_TAVILY_FORCE_REFRESH = "true";
    const forced = await newsDaily("test-scope", { force: true });
    expect(tavilyCalls()).toHaveLength(2);
    expect(forced.meta.status).toBe("live");
    expect(forced.meta.forceBypassed).toBe(true);
    expect(forced.meta.forceBypassAvailable).toBe(true);

    const plain = await newsDaily();
    expect(tavilyCalls()).toHaveLength(2);
    expect(plain.meta.status).toBe("cache");
  });

  it("bypass con header segreto interno (x-tavily-force-secret)", async () => {
    process.env.TAVILY_FORCE_REFRESH_SECRET = "segreto-staff";
    await newsDaily();

    const wrong = await newsDaily("test-scope", { force: true, forceSecret: "indovino" });
    expect(wrong.meta.forceBlocked).toBe(true);
    expect(tavilyCalls()).toHaveLength(1);

    const req = new Request("http://localhost/api/viral-reels?force=1", {
      headers: { "x-tavily-force-secret": "segreto-staff" },
    });
    const right = await newsDaily("test-scope", {
      force: true,
      forceSecret: tavilyForceSecretFromRequest(req),
    });
    expect(right.meta.forceBypassed).toBe(true);
    expect(tavilyCalls()).toHaveLength(2);
  });

  it("il segreto senza force non forza nulla", async () => {
    process.env.TAVILY_FORCE_REFRESH_SECRET = "segreto-staff";
    await newsDaily();
    const again = await newsDaily("test-scope", { forceSecret: "segreto-staff" });
    expect(again.meta.status).toBe("cache");
    expect(tavilyCalls()).toHaveLength(1);
  });

  it("dopo un riavvio (RAM vuota) legge il file .cache senza chiamare Tavily", async () => {
    await newsDaily();
    expect(fs.existsSync(cacheFile)).toBe(true);

    resetTavilyDailyGateMemoryForTests();
    const after = await newsDaily();
    expect(tavilyCalls()).toHaveLength(1);
    expect(after.meta.layer).toBe("file");
    expect(after.meta.fromCache).toBe(true);
    expect(after.items).toHaveLength(1);

    const again = await newsDaily();
    expect(again.meta.layer).toBe("memory");
  });

  it("Postgres: legge la scansione salvata da un'altra istanza e salva quella nuova", async () => {
    configureTavilyDailyGateForTests({
      filePath: cacheFile,
      fallbackFilePath: null,
      useDb: true,
      now: () => clock,
    });
    vi.mocked(dbRepo.readTavilyDailyFromDb).mockResolvedValueOnce({
      scopeKey: "test-scope",
      dayKey: "2026-11-06",
      fetchedAt: Date.parse("2026-11-06T07:00:00Z"),
      payload: [{ titolo: "Da Postgres", link: "https://x.it/a", pubDate: null, snippet: "", feedUrl: "tavily://news/search" }],
    });

    const fromDb = await newsDaily();
    expect(tavilyCalls()).toHaveLength(0);
    expect(fromDb.meta.layer).toBe("db");
    expect(fromDb.items[0]?.titolo).toBe("Da Postgres");

    await newsDaily("altro-scope");
    expect(tavilyCalls()).toHaveLength(1);
    expect(dbRepo.writeTavilyDailyToDb).toHaveBeenCalledWith(
      expect.objectContaining({ scopeKey: "altro-scope", dayKey: "2026-11-06" }),
    );
  });

  it("scansione alle 23:00: il mattino dopo resta in cache, la sera dopo riparte", async () => {
    setClock("2026-11-06T22:00:00Z");
    await newsDaily();

    setClock("2026-11-07T07:00:00Z");
    const morning = await newsDaily();
    expect(morning.meta.status).toBe("cache");
    expect(tavilyCalls()).toHaveLength(1);

    setClock("2026-11-07T22:30:00Z");
    const evening = await newsDaily();
    expect(evening.meta.status).toBe("live");
    expect(evening.meta.dayKey).toBe("2026-11-07");
    expect(tavilyCalls()).toHaveLength(2);
  });

  it("errore Tavily: nessun nuovo tentativo per un'ora", async () => {
    tavilyStatus = 432;
    const first = await newsDaily();
    expect(first.meta.status).toBe("error");
    expect(first.meta.error).toContain("Tavily HTTP 432");
    expect(first.items).toEqual([]);

    clock += 20 * 60 * 1000;
    const cooled = await newsDaily();
    expect(cooled.meta.status).toBe("error");
    expect(tavilyCalls()).toHaveLength(1);

    tavilyStatus = 200;
    clock += 45 * 60 * 1000;
    const retry = await newsDaily();
    expect(retry.meta.status).toBe("live");
    expect(tavilyCalls()).toHaveLength(2);
  });

  it("errore Tavily con scansione di ieri: serve quella (stale)", async () => {
    await newsDaily();
    setClock("2026-11-07T10:00:00Z");
    tavilyStatus = 500;
    const stale = await newsDaily();
    expect(stale.meta.status).toBe("stale");
    expect(stale.meta.dailyScanDone).toBe(false);
    expect(stale.meta.message).toContain("Tavily non ha risposto");
    expect(stale.items).toHaveLength(1);
    expect(tavilyCalls()).toHaveLength(2);
  });

  it("senza chiave Tavily non chiama mai e lo dichiara", async () => {
    delete process.env.TAVILY_API_KEY;
    const fetcher = vi.fn(async () => ["mai"]);
    const out = await runTavilyDaily({ scopeKey: "test-scope", fetcher });
    expect(out.meta.status).toBe("disabled");
    expect(out.data).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("peek legge soltanto: mai una chiamata", async () => {
    const empty = await peekTavilyDaily("test-scope");
    expect(empty.meta.status).toBe("empty");
    expect(tavilyCalls()).toHaveLength(0);

    await newsDaily();
    const cached = await peekTavilyDaily("test-scope");
    expect(cached.meta.status).toBe("cache");

    setClock("2026-11-08T10:00:00Z");
    const old = await peekTavilyDaily("test-scope");
    expect(old.meta.status).toBe("stale");
    expect(tavilyCalls()).toHaveLength(1);
  });
});

describe("moduli sul gate", () => {
  it("radar cambi di partito: 5 chiamate del motore → 1 sola fetch verso api.tavily.com", async () => {
    const statuses: string[] = [];
    for (let i = 0; i < 5; i++) {
      const out = await fetchLiveDefectionNews(CATALOG_POLITICIANS_FOR_NEWS);
      statuses.push(out.tavily.status);
    }
    expect(tavilyCalls()).toHaveLength(1);
    expect(statuses).toEqual(["live", "cache", "cache", "cache", "cache"]);
    expect(calls.some((c) => c.url.startsWith("https://news.google.com/rss/"))).toBe(true);
  });

  it("reel virali: 5 richieste (anche su regioni diverse) → un solo batch nazionale di 3 chiamate", async () => {
    tavilyResults = VIRAL_RESULTS;
    const regions = ["NAZIONALE", "Lombardia", "Lazio", "NAZIONALE", "Campania"];
    const payloads = [];
    for (const region of regions) payloads.push(await resolveViralReels(region));

    expect(tavilyCalls()).toHaveLength(3);
    expect(payloads.map((p) => p.queryCount)).toEqual([3, 0, 0, 0, 0]);
    expect(payloads.map((p) => p.tavily.fromCache)).toEqual([false, true, true, true, true]);
    expect(calls.filter((c) => c.url.startsWith(TIKTOK_OEMBED))).toHaveLength(2);

    const [nazionale, lombardia, lazio] = payloads;
    expect(nazionale?.source).toBe("tavily");
    expect(lombardia?.items[0]?.regione).toBe("Lombardia");
    expect(lazio?.items.length).toBeGreaterThan(0);
    expect(lazio?.items.every((item) => item.regione === "NAZIONALE")).toBe(true);
  });

  it("reel virali: la lettura solo-cache non chiama mai Tavily", async () => {
    const cached = await resolveViralReels("Lombardia", { mode: "cache-only" });
    expect(tavilyCalls()).toHaveLength(0);
    expect(cached.tavily.status).toBe("empty");
    expect(cached.source).toBe("fallback");
    expect(cached.items.length).toBeGreaterThan(0);
  });

  it("reel virali: il pulsante con force riceve i dati del giorno e il messaggio", async () => {
    tavilyResults = VIRAL_RESULTS;
    await resolveViralReels("NAZIONALE");
    const forced = await resolveViralReels("NAZIONALE", { force: true });
    expect(tavilyCalls()).toHaveLength(3);
    expect(forced.tavily.forceBlocked).toBe(true);
    expect(forced.tavily.message).toBe(DONE_TODAY_MESSAGE);
  });

  it("query: al massimo 3 per i reel e tutte entro il limite di caratteri Tavily", () => {
    const viral = Object.values(viralNationalBatchQueries());
    expect(viral).toHaveLength(3);
    const longComuni = [
      "San Giovanni in Persiceto",
      "Castelnuovo di Garfagnana",
      "Reggio nell'Emilia",
      "Sant'Agata de' Goti",
      "Montecatini Terme",
    ];
    const keywords = ["dimissioni", "passa a", "elezioni comunali", "sfiducia", "rimpasto", "giunta", "assessore", "commissariamento", "consiglio comunale", "ballottaggio"];
    const all = [
      ...viral,
      ...tavilyQueriesForTerritory("NAZIONALE"),
      TAVILY_DEFECTION_NEWS_QUERY,
      ...tavilyQueriesForInstitutionalNews(longComuni, keywords),
      ...tavilyQueriesForInstitutionalNews([], []),
    ];
    for (const query of all) expect(query.length).toBeLessThanOrEqual(TAVILY_MAX_QUERY_CHARS);
  });

  it("le chiamate dei reel usano i domini social e le opzioni previste", async () => {
    tavilyResults = VIRAL_RESULTS;
    await resolveViralReels("NAZIONALE");
    const bodies = tavilyCalls().map((c) => c.body);
    expect(bodies.filter((b) => b?.topic === "general")).toHaveLength(2);
    expect(bodies.filter((b) => b?.topic === "news")).toHaveLength(1);
    for (const body of bodies) {
      expect(body?.search_depth).toBe("advanced");
      expect(body?.max_results).toBe(20);
    }
    expect(bodies[0]?.include_domains).toContain("tiktok.com");
  });
});

describe("architettura: nessuna chiamata Tavily fuori dal gate", () => {
  const SRC = path.resolve(__dirname, "..", "..");
  const SERVER_ONLY = [
    "lib/cache/tavilyDailyGate.ts",
    "lib/db/tavilyDailyCacheRepository.ts",
    "lib/engine/tavilyNewsFetch.ts",
    "lib/engine/territoryIssuesLive.ts",
  ];

  function rel(file: string): string {
    return path.relative(SRC, file).split(path.sep).join("/");
  }

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [full] : [];
    });
  }

  const files = sourceFiles(SRC);
  const text = new Map(files.map((f) => [f, fs.readFileSync(f, "utf8")]));

  it("solo tavilyClient.ts conosce l'endpoint api.tavily.com", () => {
    const hits = files.filter((f) => text.get(f)?.includes("api.tavily.com")).map(rel);
    expect(hits).toEqual(["lib/engine/tavilyClient.ts"]);
  });

  it("le funzioni di ricerca sono usate solo dentro runTavilyDaily", () => {
    const users = files
      .filter((f) => /\btavilySearch(Raw|News)\b/.test(text.get(f) ?? ""))
      .map(rel)
      .sort();
    expect(users).toEqual([
      "lib/engine/tavilyClient.ts",
      "lib/engine/tavilyNewsFetch.ts",
      "lib/news/tavilyViralVideosEngine.ts",
    ]);
    for (const user of users.filter((u) => u !== "lib/engine/tavilyClient.ts")) {
      expect(text.get(path.join(SRC, user))).toMatch(/runTavilyDaily(<[^>]+>)?\(/);
    }
  });

  it("i componenti client non arrivano ai moduli server del gate", () => {
    // Statici (non `import type`) e dinamici; `import("x").Tipo` è solo un tipo e non conta.
    const importRe =
      /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^"';]*?\sfrom\s*)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)(?!\.(?!then\b))/g;

    function resolveImport(from: string, spec: string): string | null {
      let base: string;
      if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
      else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
      else return null;
      for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), base]) {
        if (text.has(candidate)) return candidate;
      }
      return null;
    }

    const queue = files.filter((f) => /^\s*["']use client["']/.test(text.get(f) ?? ""));
    expect(queue.length).toBeGreaterThan(0);
    const reached = new Set(queue);
    while (queue.length > 0) {
      const file = queue.pop() as string;
      for (const match of (text.get(file) ?? "").matchAll(importRe)) {
        const target = resolveImport(file, match[1] ?? match[2] ?? "");
        if (target && !reached.has(target)) {
          reached.add(target);
          queue.push(target);
        }
      }
    }
    const reachedRel = [...reached].map(rel);
    expect(reachedRel).toContain("lib/cache/tavilyDailyMeta.ts");
    expect(reachedRel.filter((f) => SERVER_ONLY.includes(f))).toEqual([]);
  });
});
