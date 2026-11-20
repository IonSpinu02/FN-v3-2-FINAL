import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import { resolveConsensoLiveContext } from "@/lib/engine/consensoLiveContext";
import {
  computeForecastV4,
  staticForecastPolls,
  staticForecastRegions,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
  type ForecastPoll,
  type ForecastScenarioId,
  type ForecastV4Input,
} from "@/lib/engine/forecastEngineV4";
import {
  buildGrowthEvidence,
  isValidNewsHeadline,
  seriesWithCurrentPoint,
} from "@/lib/engine/growthEvidence";
import { fetchTavilyNewsDaily } from "@/lib/engine/tavilyNewsFetch";
import type { BuildStrategicDossierInput } from "@/lib/export/buildDossierPayload";

const DOSSIER_NEWS_SCOPE = "dossier-pdf-news-v1";

const DOSSIER_NEWS_QUERIES = [
  "Italia sicurezza immigrazione criminalità sbarchi",
  "Italia fisco partite IVA bollette energia manovra",
  "Italia caro vita mutui prezzi inflazione famiglie",
  "Italia sanità liste d'attesa ospedali pronto soccorso",
];

/** Headline tematiche di riserva: mai esportare con 0 notizie. */
export const DOSSIER_FALLBACK_HEADLINES = [
  "Manovra e pressione fiscale su Partite IVA — Il Sole 24 Ore",
  "Bollette e caro-energia sulle imprese del Nord — Il Sole 24 Ore",
  "Mutui e costo della casa sulle famiglie — Facile.it",
  "Sicurezza nelle stazioni metropolitane — Corriere della Sera",
  "Liste d'attesa sanitarie nelle regioni del Sud — Ansa",
] as const;

export type DossierExportClientHints = {
  /** Scelte utente / contesto scenario: non sostituiscono il dataset completo. */
  startPct?: number;
  regions?: ForecastV4Input["regions"];
  networkDelta?: ForecastNetworkDelta;
  horizonKey?: ForecastHorizonKey;
  scenarioMode?: ForecastScenarioId;
  excludedEntityIds?: string[];
  /** Eventuali polls client: usati SOLO se già completi (>=30) e più ricchi del server. */
  clientPolls?: ForecastPoll[];
  clientNewsHeadlines?: string[];
  clientHistory?: ForecastV4Input["history"];
  flussi?: ForecastV4Input["flussi"];
  comitati?: ForecastV4Input["comitati"];
  tesserati?: ForecastV4Input["tesserati"];
  ingressi?: ForecastV4Input["ingressi"];
  profiles?: ForecastV4Input["profiles"];
  asOf?: ForecastV4Input["asOf"];
};

/**
 * Sceglie il dataset sondaggi più completo. Mai preferire uno snippet da card (es. 7).
 */
export function preferCompletePolls(
  serverPolls: ForecastPoll[],
  clientPolls: ForecastPoll[] | undefined,
): ForecastPoll[] {
  const server = serverPolls.filter((p) => Number.isFinite(p.fnPct) && p.fnPct > 0);
  const client = (clientPolls ?? []).filter(
    (p) => Number.isFinite(p.fnPct) && p.fnPct > 0,
  );
  if (server.length >= 30) return server;
  if (client.length >= 30) return client;
  if (server.length >= client.length && server.length > 0) return server;
  if (client.length > 0) return client;
  return staticForecastPolls();
}

/**
 * Preferisce `primary` se ha almeno 5 titoli; altrimenti `secondary`;
 * altrimenti le headline tematiche di riserva (mai 0 notizie).
 */
export function preferCompleteNews(
  primary: string[],
  secondary: string[] | undefined,
): string[] {
  const a = primary.map((h) => h.trim()).filter((h) => h.length >= 12);
  const b = (secondary ?? []).map((h) => h.trim()).filter((h) => h.length >= 12);
  if (a.length >= 5) return a;
  if (b.length >= 5) return b;
  if (a.length > 0) return a;
  if (b.length > 0) return b;
  return [...DOSSIER_FALLBACK_HEADLINES];
}

async function loadServerPolls(): Promise<ForecastPoll[]> {
  try {
    const live = await resolveConsensoLiveContext();
    return live.pollReleases.map((p) => ({
      id: p.id,
      institute: p.institute,
      fieldEnd: p.fieldEnd,
      publishedAt: p.publishedAt,
      fnPct: p.fnPct,
      sampleSize: p.sampleSize,
      sourceUrl: p.sourceUrl,
    }));
  } catch {
    return staticForecastPolls();
  }
}

async function loadServerHistory(): Promise<
  Array<{ isoDate: string; pct: number }>
> {
  try {
    const live = await resolveConsensoLiveContext();
    if (live.supermediaSeries.length > 0) {
      return live.supermediaSeries.map((p) => ({
        isoDate: p.isoDate,
        pct: p.pct,
      }));
    }
  } catch {
    /* fallback sotto */
  }
  return FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
    isoDate: p.isoDate,
    pct: p.pct,
  }));
}

async function loadServerNewsHeadlines(): Promise<string[]> {
  try {
    const newsResult = await fetchTavilyNewsDaily(
      DOSSIER_NEWS_SCOPE,
      DOSSIER_NEWS_QUERIES,
      { maxResultsPerQuery: 5, timeRange: "month", includeDomainsMode: "prefer" },
    );
    return newsResult.items
      .map((item) => {
        const source = item.link
          ? (() => {
              try {
                return new URL(item.link).hostname.replace(/^www\./, "");
              } catch {
                return "";
              }
            })()
          : "";
        return source ? `${item.titolo} — ${source}` : item.titolo;
      })
      .filter((title) => isValidNewsHeadline(title));
  } catch {
    return [];
  }
}

/**
 * Costruisce l'input dossier allineato al dataset completo (stesso percorso di
 * /api/forecast/growth), applicando dal client solo scelte esplicite.
 */
export async function resolveDossierExportInput(
  hints: DossierExportClientHints = {},
): Promise<BuildStrategicDossierInput> {
  const [serverPolls, history, serverNews] = await Promise.all([
    loadServerPolls(),
    loadServerHistory(),
    loadServerNewsHeadlines(),
  ]);

  const polls = preferCompletePolls(serverPolls, hints.clientPolls);
  const newsHeadlines = preferCompleteNews(serverNews, hints.clientNewsHeadlines);

  const hist =
    hints.clientHistory && hints.clientHistory.length > history.length
      ? hints.clientHistory
      : history;

  const lastHist = hist.at(-1)?.pct;
  const startPct =
    hints.startPct ??
    (Number.isFinite(lastHist) ? Number(lastHist) : 6.59);

  const regions =
    hints.regions && hints.regions.length > 0
      ? hints.regions
      : staticForecastRegions(startPct);

  // Evidence allineata a growth API (serie + polls + news).
  const evidence = buildGrowthEvidence({
    series: seriesWithCurrentPoint(
      hist.map((p) => ({ isoDate: p.isoDate, pct: p.pct })),
      startPct,
    ),
    news: newsHeadlines.map((title) => ({ title })),
    polls,
  });

  const v4Input: ForecastV4Input = {
    asOf: hints.asOf,
    startPct,
    history: hist,
    polls: evidence.polls ?? polls,
    newsHeadlines: evidence.newsHeadlines.length
      ? evidence.newsHeadlines
      : newsHeadlines,
    newsScore: evidence.newsScore,
    regions,
    flussi: hints.flussi,
    comitati: hints.comitati,
    tesserati: hints.tesserati,
    ingressi: hints.ingressi,
    profiles: hints.profiles,
    networkDelta: hints.networkDelta,
  };

  const v4 = computeForecastV4(v4Input);

  return {
    v4,
    v4Input,
    networkDelta: hints.networkDelta,
    newsHeadlines: v4Input.newsHeadlines ?? newsHeadlines,
    scenarioMode: hints.scenarioMode ?? "base",
    horizonKey: hints.horizonKey ?? "d180",
    excludedEntityIds: hints.excludedEntityIds,
  };
}
