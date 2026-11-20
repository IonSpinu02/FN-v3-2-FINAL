/**
 * Political Context Graph — nodi + archi deterministici per il Consigliere Strategico.
 * Nessuna cifra inventata: tutto deriva da forecastEngineV4 e cataloghi piattaforma.
 */
import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { officialModuloBLine } from "@/lib/engine/territoryIssueContext";
import {
  factorPp,
  forecastHorizon,
  type ForecastBacktestV4,
  type ForecastFactorId,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { TERRITORY_ISSUE_CATEGORIES } from "@/lib/engine/territoryIssuesTypes";
import {
  getRegionalPartyHistory,
} from "@/lib/fnProgramAndAffinityEngine";
import {
  COCKPIT_TIER_VERDE,
  cockpitTierForRegion,
} from "@/lib/osservatorioCockpitTiers";
import { formatApproximateVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt } from "@/lib/formatIt";

export type GraphNodeType =
  | "ForecastState"
  | "Region"
  | "SocialGrievance"
  | "News"
  | "BipMeasure"
  | "Organization"
  | "Calendar";

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  data: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  rel:
    | "HAS_HORIZON"
    | "IN_TIER"
    | "HAS_GRIEVANCE"
    | "SOLVES_GRIEVANCE"
    | "APPEALS_TO_VOTER_POOL"
    | "COVERED_BY_NEWS"
    | "IN_PHASE";
  data?: Record<string, unknown>;
};

export type PoliticalKnowledgeGraph = {
  asOf: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Snapshot compatto per prompt caching (senza duplicare archi). */
  summary: PoliticalGraphSummary;
};

export type PoliticalGraphSummary = {
  consensoOggiPct: number;
  tendenzaSoliSondaggiPct: number;
  /** Orizzonte UI attivo (d30 | d90 | d180). */
  horizonKey: ForecastHorizonKey;
  horizonDays: number;
  horizonLabel: string;
  horizonPhase: string;
  /** Scenari sull'orizzonte attivo (non sempre Maggio). */
  scenarioBasePct: number;
  scenarioOffensivaPct: number;
  scenarioPassivoPct: number;
  deltaBasePp: number;
  approxVotesDeltaBase: string;
  fascia80Base: { lo: number; hi: number };
  /** Traguardo Maggio 2027 di sfondo. */
  maggioBasePct: number;
  maggioOffensivaPct: number;
  maggioPassivoPct: number;
  backtest30d: {
    n: number;
    maeModello: number;
    maeFlat: number;
  } | null;
  /** Fattori V4 sull'orizzonte attivo (Base). */
  fattoriAttivi: Array<{ id: ForecastFactorId; pp: number; short: string }>;
  /** Alias storico = fattoriAttivi quando horizon=d180; altrimenti fattori Maggio. */
  fattoriBase180: Array<{ id: ForecastFactorId; pp: number; short: string }>;
  organizzazione: {
    tesserati: number;
    comitati: number;
    eletti: { dep: number; reg: number; sind: number; com: number };
  };
  /** Validi nazionali usati per voti indicativi. */
  validiNazionali: number;
  /** Livello filtrato (zoccolo duro strutturale) — da usare in testi pubblici. */
  levelPct: number;
  /** Soglia indicativa di smorzamento (ipotesi), non pavimento garantito. */
  softFloorPct: number;
  regioniVerdi: string[];
  prioritaTop: Array<{
    regione: string;
    affinita: number;
    fnPct: number;
    tier: string;
  }>;
  bipMisure: Array<{ id: string; titolo: string; categoria: string }>;
  calendarioFase: string;
};

export type BuildPoliticalGraphInput = {
  v4: ForecastV4Result;
  v4Input?: ForecastV4Input;
  backtest?: ForecastBacktestV4 | null;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  /** Orizzonte selezionato in UI: guida tesi/priorità del briefing. */
  horizonKey?: ForecastHorizonKey;
  grievances?: Array<{
    id: string;
    title: string;
    category: TerritoryIssueCategory;
    region: string;
  }>;
};

export function horizonBriefingMeta(key: ForecastHorizonKey | undefined): {
  key: ForecastHorizonKey;
  days: number;
  label: string;
  phase: string;
} {
  if (key === "d30") {
    return {
      key: "d30",
      days: 30,
      label: "30 giorni (~Dicembre 2026 · Fase Manovra)",
      phase: "Fase Manovra",
    };
  }
  if (key === "d90") {
    return {
      key: "d90",
      days: 90,
      label: "90 giorni (~Febbraio 2027 · Fase Consolidamento Invernale)",
      phase: "Fase Consolidamento Invernale",
    };
  }
  return {
    key: "d180",
    days: 180,
    label: "180 giorni (Maggio 2027 · Fase Mobilitazione Primaverile)",
    phase: "Fase Mobilitazione Primaverile",
  };
}

const FACTOR_SHORT: Record<ForecastFactorId, string> = {
  momentum: "Sondaggi (inerzia)",
  agenda: "Agenda / temi",
  donor: "Flussi da bacini",
  ground: "Radicamento territoriale",
  magnet: "Eletti / magnete",
  cycle: "Calendario politico",
  bounds: "Pavimento / tetto",
};

function calendarPhase(asOf: Date): string {
  const m = asOf.getMonth(); // 0-indexed
  if (m >= 9 && m <= 11) return "Manovra di Bilancio → preparazione campagna";
  if (m >= 0 && m <= 2) return "Precampagna invernale / territori";
  if (m >= 3 && m <= 5) return "Campagna primaverile verso Maggio";
  return "Fase estiva / consolidamento organizzativo";
}

function pct2(n: number): string {
  return formatDecimalIt(n, 2);
}

export function buildPoliticalKnowledgeGraph(
  input: BuildPoliticalGraphInput,
): PoliticalKnowledgeGraph {
  const { v4, backtest, networkDelta } = input;
  const asOf = new Date(v4.asOf);
  const d = v4.diagnostics;
  const hz = horizonBriefingMeta(input.horizonKey);
  const hActiveBase = forecastHorizon(v4, "base", hz.key);
  const hActiveOff = forecastHorizon(v4, "offensiva", hz.key);
  const hActivePass = forecastHorizon(v4, "passivo", hz.key);
  const h180Base = forecastHorizon(v4, "base", "d180");
  const h180Off = forecastHorizon(v4, "offensiva", "d180");
  const h180Pass = forecastHorizon(v4, "passivo", "d180");
  const momentumPp = factorPp(hActiveBase, "momentum");
  const pollsAlone = v4.startPct + momentumPp;
  const fattoriAttivi = hActiveBase.factors.map((f) => ({
    id: f.id,
    pp: f.pp,
    short: FACTOR_SHORT[f.id] ?? f.short,
  }));
  const fattori180 = h180Base.factors.map((f) => ({
    id: f.id,
    pp: f.pp,
    short: FACTOR_SHORT[f.id] ?? f.short,
  }));
  const approxVotes = formatApproximateVotes(
    (hActiveBase.deltaPp / 100) * d.validiNazionali,
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  nodes.push({
    id: "forecast:state",
    type: "ForecastState",
    label: "Stato previsione nazionale",
    data: {
      consensoOggiPct: v4.startPct,
      tendenzaSoliSondaggiPct: pollsAlone,
      horizonKey: hz.key,
      horizonDays: hz.days,
      horizonLabel: hz.label,
      passivoAttivo: hActivePass.centralPct,
      baseAttivo: hActiveBase.centralPct,
      offensivaAttivo: hActiveOff.centralPct,
      passivo180: h180Pass.centralPct,
      base180: h180Base.centralPct,
      offensiva180: h180Off.centralPct,
      fascia80: { lo: hActiveBase.lo10Pct, hi: hActiveBase.hi90Pct },
      backtest30d: backtest
        ? {
            n: backtest.n,
            maeModello: backtest.maeV4,
            maeFlat: backtest.maeFlat,
            nota: "Verifica storica solo a 30 giorni; 90/180 non calibrati su storico",
          }
        : null,
      fattori: fattoriAttivi.map((f) => ({
        ...f,
        provenance:
          hActiveBase.factors.find((row) => row.id === f.id)?.provenance ??
          "ipotesi",
      })),
      orizonti: (["d30", "d90", "d180"] as ForecastHorizonKey[]).map((key) => ({
        key,
        base: forecastHorizon(v4, "base", key).centralPct,
        offensiva: forecastHorizon(v4, "offensiva", key).centralPct,
        passivo: forecastHorizon(v4, "passivo", key).centralPct,
        fattori: forecastHorizon(v4, "base", key).factors.map((f) => ({
          id: f.id,
          pp: f.pp,
          short: FACTOR_SHORT[f.id] ?? f.short,
        })),
      })),
      votiIndicativiBase: approxVotes,
    },
  });

  for (const key of ["d30", "d90", "d180"] as ForecastHorizonKey[]) {
    const hid = `forecast:horizon:${key}`;
    nodes.push({
      id: hid,
      type: "ForecastState",
      label: `Orizzonte ${key}`,
      data: {
        base: forecastHorizon(v4, "base", key).centralPct,
        offensiva: forecastHorizon(v4, "offensiva", key).centralPct,
        passivo: forecastHorizon(v4, "passivo", key).centralPct,
      },
    });
    edges.push({
      id: `e:state-${key}`,
      from: "forecast:state",
      to: hid,
      rel: "HAS_HORIZON",
    });
  }

  const regionInputs = new Map<Region, NonNullable<ForecastV4Input["regions"]>[number]>();
  for (const r of input.v4Input?.regions ?? []) {
    regionInputs.set(r.regione, r);
  }

  const prioritaTop: PoliticalGraphSummary["prioritaTop"] = [];

  for (const region of REGIONS) {
    const hist = getRegionalPartyHistory(region);
    const tier = cockpitTierForRegion(region);
    const row = regionInputs.get(region);
    const fnPct = row?.sharePct ?? null;
    const id = `region:${region}`;
    nodes.push({
      id,
      type: "Region",
      label: region,
      data: {
        regione: region,
        fnPct,
        affinitaBacino: hist.permeabilitaVannacciScore,
        tier,
        isVerde: COCKPIT_TIER_VERDE.includes(region),
        bacino: {
          fdi: hist.fdiPct,
          lega: hist.legaPct,
          fi: hist.fiPct,
          astensione: hist.astensionePct,
          pd: hist.pdPct,
          blocco: hist.bloccoPrevalente,
        },
        iscritti: row?.tesserati ?? null,
        puntiIstituzionali: row?.puntiIstituzionali ?? null,
        disagiStrutturali: TERRITORY_ISSUE_CATEGORIES.map((cat) => ({
          categoria: cat,
          contesto: officialModuloBLine(region, cat),
        })),
      },
    });
    edges.push({
      id: `e:tier-${region}`,
      from: id,
      to: `tier:${tier}`,
      rel: "IN_TIER",
    });
    prioritaTop.push({
      regione: region,
      affinita: hist.permeabilitaVannacciScore,
      fnPct: fnPct ?? 0,
      tier,
    });
  }

  for (const tier of ["verde", "giallo", "rosso"] as const) {
    nodes.push({
      id: `tier:${tier}`,
      type: "Region",
      label: `Tier ${tier}`,
      data: { tier },
    });
  }

  prioritaTop.sort((a, b) => b.affinita - a.affinita);

  for (const g of input.grievances ?? []) {
    const gid = `grievance:${g.id}`;
    nodes.push({
      id: gid,
      type: "SocialGrievance",
      label: g.title,
      data: { category: g.category, region: g.region },
    });
    edges.push({
      id: `e:griev-${g.id}`,
      from: `region:${g.region}`,
      to: gid,
      rel: "HAS_GRIEVANCE",
    });
  }

  for (const [i, title] of (input.newsHeadlines ?? []).slice(0, 24).entries()) {
    const nid = `news:${i}`;
    nodes.push({
      id: nid,
      type: "News",
      label: title,
      data: { title },
    });
    edges.push({
      id: `e:news-${i}`,
      from: "forecast:state",
      to: nid,
      rel: "COVERED_BY_NEWS",
    });
  }

  for (const bip of BIP_FN_PROMISES_CATALOG) {
    const bid = `bip:${bip.id}`;
    nodes.push({
      id: bid,
      type: "BipMeasure",
      label: bip.shortTitle,
      data: {
        id: bip.id,
        category: bip.category,
        chapter: bip.bipChapter,
        pages: bip.bipPages,
        reference: bip.bipReference,
        testo: bip.testo,
      },
    });
    edges.push({
      id: `e:bip-pool-${bip.id}`,
      from: bid,
      to: "forecast:state",
      rel: "APPEALS_TO_VOTER_POOL",
      data: { pools: ["FdI delusi", "Lega", "Astenuti"] },
    });
    for (const g of input.grievances ?? []) {
      if (g.category === bip.category) {
        edges.push({
          id: `e:bip-solves-${bip.id}-${g.id}`,
          from: bid,
          to: `grievance:${g.id}`,
          rel: "SOLVES_GRIEVANCE",
        });
      }
    }
  }

  const tesserati = d.tesserati + (networkDelta?.tesserati ?? 0);
  const comitati = d.comitati + (networkDelta?.comitati ?? 0);
  nodes.push({
    id: "org:fn",
    type: "Organization",
    label: "Organizzazione Futuro Nazionale",
    data: {
      tesserati,
      comitati,
      eletti: {
        dep: input.v4Input?.ingressi?.dep ?? 9,
        reg: input.v4Input?.ingressi?.creg ?? 7,
        sind: input.v4Input?.ingressi?.sind ?? 3,
        com: input.v4Input?.ingressi?.com ?? 19,
      },
      densitaComitati: d.comitatiDensityFactor,
    },
  });

  const fase = calendarPhase(asOf);
  nodes.push({
    id: "calendar:phase",
    type: "Calendar",
    label: fase,
    data: { fase, asOf: v4.asOf },
  });
  edges.push({
    id: "e:cal-phase",
    from: "forecast:state",
    to: "calendar:phase",
    rel: "IN_PHASE",
  });

  const summary: PoliticalGraphSummary = {
    consensoOggiPct: v4.startPct,
    tendenzaSoliSondaggiPct: pollsAlone,
    horizonKey: hz.key,
    horizonDays: hz.days,
    horizonLabel: hz.label,
    horizonPhase: hz.phase,
    scenarioBasePct: hActiveBase.centralPct,
    scenarioOffensivaPct: hActiveOff.centralPct,
    scenarioPassivoPct: hActivePass.centralPct,
    deltaBasePp: hActiveBase.deltaPp,
    approxVotesDeltaBase: approxVotes,
    fascia80Base: { lo: hActiveBase.lo10Pct, hi: hActiveBase.hi90Pct },
    maggioBasePct: h180Base.centralPct,
    maggioOffensivaPct: h180Off.centralPct,
    maggioPassivoPct: h180Pass.centralPct,
    backtest30d: backtest
      ? { n: backtest.n, maeModello: backtest.maeV4, maeFlat: backtest.maeFlat }
      : null,
    fattoriAttivi,
    fattoriBase180: fattori180,
    organizzazione: {
      tesserati,
      comitati,
      eletti: {
        dep: input.v4Input?.ingressi?.dep ?? 9,
        reg: input.v4Input?.ingressi?.creg ?? 7,
        sind: input.v4Input?.ingressi?.sind ?? 3,
        com: input.v4Input?.ingressi?.com ?? 19,
      },
    },
    validiNazionali: Math.max(1, d.validiNazionali || 23_257_062),
    levelPct: v4.diagnostics.levelPct,
    softFloorPct: d.softFloorPct,
    regioniVerdi: [...COCKPIT_TIER_VERDE],
    prioritaTop: prioritaTop.slice(0, 8),
    bipMisure: BIP_FN_PROMISES_CATALOG.map((b) => ({
      id: b.id,
      titolo: b.shortTitle,
      categoria: b.category,
    })),
    calendarioFase: fase,
  };

  return { asOf: v4.asOf, nodes, edges, summary };
}

/** Serializzazione compatta per cache_control Anthropic (ephemeral). */
export function graphSummaryForPrompt(graph: PoliticalKnowledgeGraph): string {
  const s = graph.summary;
  return [
    `ORIZZONTE ATTIVO: ${s.horizonLabel} (${s.horizonKey}, ${s.horizonDays}g, ${s.horizonPhase})`,
    `CONSENSO OGGI: ${pct2(s.consensoOggiPct)}%`,
    `TENDENZA SOLI SONDAGGI sull'orizzonte attivo: ${pct2(s.tendenzaSoliSondaggiPct)}%`,
    `SCENARIO BASE CONDIZIONATO (${s.horizonKey}): ${pct2(s.scenarioBasePct)}% (${s.deltaBasePp >= 0 ? "+" : ""}${pct2(s.deltaBasePp)} pt · ${s.approxVotesDeltaBase})`,
    `SCENARIO OFFENSIVA (${s.horizonKey}): ${pct2(s.scenarioOffensivaPct)}%`,
    `SCENARIO PASSIVO (${s.horizonKey}): ${pct2(s.scenarioPassivoPct)}%`,
    `TRAGUARDO MAGGIO 2027 (sfondo): Base ${pct2(s.maggioBasePct)}% · Offensiva ${pct2(s.maggioOffensivaPct)}% · Passivo ${pct2(s.maggioPassivoPct)}%`,
    `FASCIA 80% TEORICA BASE (${s.horizonKey}): ${pct2(s.fascia80Base.lo)}% – ${pct2(s.fascia80Base.hi)}%`,
    s.backtest30d
      ? `VERIFICA STORICA 30g (n=${s.backtest30d.n}): modello ±${pct2(s.backtest30d.maeModello)} vs flat ±${pct2(s.backtest30d.maeFlat)} — 90/180 non verificabili su storico`
      : `VERIFICA STORICA 30g: non disponibile`,
    `FATTORI BASE (${s.horizonKey}): ${s.fattoriAttivi.map((f) => `${f.short} ${f.pp >= 0 ? "+" : ""}${pct2(f.pp)}`).join("; ")}`,
    `FATTORI BASE 180g (Maggio, sfondo): ${s.fattoriBase180.map((f) => `${f.short} ${f.pp >= 0 ? "+" : ""}${pct2(f.pp)}`).join("; ")}`,
    `ORGANIZZAZIONE: tesserati ${s.organizzazione.tesserati}, comitati ${s.organizzazione.comitati}, eletti dep/reg/sind/com ${s.organizzazione.eletti.dep}/${s.organizzazione.eletti.reg}/${s.organizzazione.eletti.sind}/${s.organizzazione.eletti.com}`,
    `REGIONI VERDI: ${s.regioniVerdi.join(", ")}`,
    `TOP AFFINITÀ: ${s.prioritaTop.map((r) => `${r.regione} aff=${r.affinita}/100 tier=${r.tier}`).join("; ")}`,
    `FASE CALENDARIO (asOf): ${s.calendarioFase}`,
    `MISURE B.I.P.: ${s.bipMisure.map((b) => b.id).join(", ")}`,
    `EPISTEMOLOGIA: i % Base/Offensiva/Passivo citati sopra sono proiezioni sull'orizzonte ${s.horizonKey}; Maggio è solo traguardo di sfondo. La sola componente osservata è la tendenza sondaggi (${pct2(s.tendenzaSoliSondaggiPct)}%).`,
  ].join("\n");
}

export function queryGraphNodes(
  graph: PoliticalKnowledgeGraph,
  opts: {
    type?: GraphNodeType;
    region?: string;
    category?: string;
    q?: string;
  },
): GraphNode[] {
  const q = opts.q?.toLowerCase().trim();
  return graph.nodes.filter((n) => {
    if (opts.type && n.type !== opts.type) return false;
    if (opts.region && String(n.data.regione ?? n.label) !== opts.region) return false;
    if (opts.category && String(n.data.category ?? n.data.categoria ?? "") !== opts.category) {
      return false;
    }
    if (q && !`${n.label} ${JSON.stringify(n.data)}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}
