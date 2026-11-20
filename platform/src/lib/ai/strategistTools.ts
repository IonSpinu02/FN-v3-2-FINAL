/**
 * Tool suite Anthropic per il Consigliere Strategico FN.
 * Ogni cifra esposta ai tool proviene da motori deterministici.
 */
import { BIP_FN_PROMISES_CATALOG, getBipMessaging } from "@/lib/bipProgramCatalog";
import { REGIONS, type Region } from "@/lib/engine/constants";
import {
  computeForecastV4,
  forecastHorizon,
  sanitizeForecastV4Input,
  type ForecastNetworkDelta,
  type ForecastScenarioId,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { officialModuloBLine } from "@/lib/engine/territoryIssueContext";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { TERRITORY_ISSUE_CATEGORIES } from "@/lib/engine/territoryIssuesTypes";
import { formatApproximateVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt } from "@/lib/formatIt";
import { getRegionalPartyHistory } from "@/lib/fnProgramAndAffinityEngine";
import {
  cockpitTierForRegion,
  COCKPIT_TIER_VERDE,
} from "@/lib/osservatorioCockpitTiers";
import {
  buildPoliticalKnowledgeGraph,
  graphSummaryForPrompt,
  queryGraphNodes,
  type PoliticalKnowledgeGraph,
  type BuildPoliticalGraphInput,
} from "@/lib/ai/politicalKnowledgeGraph";
import type Anthropic from "@anthropic-ai/sdk";

export type StrategistToolContext = {
  graph: PoliticalKnowledgeGraph;
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  networkDelta: ForecastNetworkDelta;
};

export const STRATEGIST_TOOLS: Anthropic.Tool[] = [
  {
    name: "query_political_graph",
    description:
      "Esplora il grafo di conoscenza politica FN filtrando per tipo nodo, regione, tema o testo libero. Usa questo tool prima di citare dati strutturali.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "ForecastState",
            "Region",
            "SocialGrievance",
            "News",
            "BipMeasure",
            "Organization",
            "Calendar",
          ],
        },
        region: { type: "string", description: "Nome regione italiana" },
        category: {
          type: "string",
          enum: [...TERRITORY_ISSUE_CATEGORIES],
        },
        q: { type: "string", description: "Ricerca testuale libera" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "get_region_deep_dive",
    description:
      "KPI elettorali, demoscopici, organizzativi e disagi strutturali di una regione italiana.",
    input_schema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Es. Veneto, Lombardia, Puglia" },
      },
      required: ["region"],
    },
  },
  {
    name: "simulate_what_if_scenario",
    description:
      "Ricalcola forecastEngineV4 con variazioni di comitati, tesserati, scenario o effort. Restituisce percentuali esatte del motore.",
    input_schema: {
      type: "object",
      properties: {
        scenario: {
          type: "string",
          enum: ["passivo", "base", "offensiva"],
        },
        deltaComitati: { type: "number" },
        deltaTesserati: { type: "number" },
        effort: { type: "number", description: "Moltiplicatore sforzo (1 = base)" },
        horizon: {
          type: "string",
          enum: ["d30", "d90", "d180"],
        },
      },
    },
  },
  {
    name: "get_active_news_and_grievances",
    description:
      "Notizie e disagi pertinenti dal grafo/Osservatorio su un tema (Sicurezza, Sanità, Casa, ecc.).",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [...TERRITORY_ISSUE_CATEGORIES],
        },
        region: { type: "string" },
      },
    },
  },
  {
    name: "get_bip_program_details",
    description:
      "Dettagli tecnici e comunicativi delle misure ufficiali B.I.P. di Futuro Nazionale.",
    input_schema: {
      type: "object",
      properties: {
        bipId: { type: "string", description: "Es. BIP.07" },
        category: {
          type: "string",
          enum: [...TERRITORY_ISSUE_CATEGORIES],
        },
      },
    },
    // Breakpoint esplicito sull'ultimo tool: cache di tutto l'array tools.
    // TTL 1h (più lungo) perché le definizioni cambiano raramente; deve apparire
    // prima dei breakpoint 5m su system/messages (gerarchia tools → system → messages).
    cache_control: { type: "ephemeral", ttl: "1h" },
  },
];

function resolveRegion(raw: string): Region | null {
  const q = raw.trim().toLowerCase();
  return REGIONS.find((r) => r.toLowerCase() === q) ?? null;
}

export function createStrategistToolContext(
  input: BuildPoliticalGraphInput & { v4Input: ForecastV4Input },
): StrategistToolContext {
  const v4Input = sanitizeForecastV4Input(input.v4Input);
  const graph = buildPoliticalKnowledgeGraph({ ...input, v4Input });
  return {
    graph,
    v4: input.v4,
    v4Input,
    networkDelta: input.networkDelta ?? { comitati: 0, tesserati: 0 },
  };
}

export function executeStrategistTool(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: StrategistToolContext,
): { label: string; result: unknown } {
  try {
    return executeStrategistToolInner(name, rawInput, ctx);
  } catch (err) {
    console.error("[strategist-tool]", name, err);
    return {
      label: toolStatusLabel(name, rawInput),
      result: {
        error: "tool_failed",
        tool: name,
        message:
          "Modulo temporaneamente non disponibile. Usa i numeri già presenti nel grafo di contesto e non inventare percentuali.",
      },
    };
  }
}

function executeStrategistToolInner(
  name: string,
  rawInput: Record<string, unknown>,
  ctx: StrategistToolContext,
): { label: string; result: unknown } {
  switch (name) {
    case "query_political_graph": {
      const nodes = queryGraphNodes(ctx.graph, {
        type: rawInput.type as never,
        region: typeof rawInput.region === "string" ? rawInput.region : undefined,
        category: typeof rawInput.category === "string" ? rawInput.category : undefined,
        q: typeof rawInput.q === "string" ? rawInput.q : undefined,
      }).slice(0, Math.min(40, Number(rawInput.limit) || 20));
      return {
        label: `🔎 Consulto grafo${rawInput.region ? ` · ${rawInput.region}` : ""}${rawInput.type ? ` · ${rawInput.type}` : ""}…`,
        result: {
          count: nodes.length,
          summary: graphSummaryForPrompt(ctx.graph),
          nodes: nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            data: n.data,
          })),
        },
      };
    }
    case "get_region_deep_dive": {
      const region = resolveRegion(String(rawInput.region ?? ""));
      if (!region) {
        return {
          label: "⚠️ Regione non riconosciuta",
          result: { error: "Regione non valida", regioni: REGIONS },
        };
      }
      const hist = getRegionalPartyHistory(region);
      const row = ctx.v4Input.regions?.find((r) => r.regione === region);
      const tier = cockpitTierForRegion(region);
      return {
        label: `🔎 Consulto grafo regione ${region}…`,
        result: {
          regione: region,
          tier,
          isVerde: COCKPIT_TIER_VERDE.includes(region),
          consensoFnPct: row?.sharePct ?? null,
          affinitaBacino: hist.permeabilitaVannacciScore,
          bacino: {
            fdi: hist.fdiPct,
            lega: hist.legaPct,
            fi: hist.fiPct,
            astensione: hist.astensionePct,
            pd: hist.pdPct,
            blocco: hist.bloccoPrevalente,
            label: hist.permeabilitaLabel,
          },
          organizzazione: {
            iscritti: row?.tesserati ?? null,
            puntiIstituzionali: row?.puntiIstituzionali ?? null,
          },
          disagiStrutturali: TERRITORY_ISSUE_CATEGORIES.map((cat) => ({
            categoria: cat,
            contesto: officialModuloBLine(region, cat),
          })),
        },
      };
    }
    case "simulate_what_if_scenario": {
      const scenario = (String(rawInput.scenario ?? "base") ||
        "base") as ForecastScenarioId;
      const horizon = (String(rawInput.horizon ?? "d180") || "d180") as
        | "d30"
        | "d90"
        | "d180";
      const deltaComitati = Number(rawInput.deltaComitati) || 0;
      const deltaTesserati = Number(rawInput.deltaTesserati) || 0;
      const effort =
        rawInput.effort != null && Number.isFinite(Number(rawInput.effort))
          ? Number(rawInput.effort)
          : ctx.v4Input.effort ?? 1;
      const nextInput = sanitizeForecastV4Input({
        ...ctx.v4Input,
        effort,
        networkDelta: {
          comitati: (ctx.networkDelta.comitati ?? 0) + deltaComitati,
          tesserati: (ctx.networkDelta.tesserati ?? 0) + deltaTesserati,
        },
      });
      const v4 = computeForecastV4(nextInput);
      const h = forecastHorizon(v4, scenario, horizon);
      const votes = (h.deltaPp / 100) * v4.diagnostics.validiNazionali;
      return {
        label: `📐 Simulo ${scenario} ${horizon}${deltaComitati ? ` · +${deltaComitati} comitati` : ""}${deltaTesserati ? ` · +${deltaTesserati} tesserati` : ""}…`,
        result: {
          scenario,
          horizon,
          startPct: v4.startPct,
          centralPct: h.centralPct,
          deltaPp: h.deltaPp,
          fascia80: { lo: h.lo10Pct, hi: h.hi90Pct },
          votiIndicativi: formatApproximateVotes(votes),
          fattori: h.factors.map((f) => ({
            id: f.id,
            short: f.short,
            pp: Number(formatDecimalIt(f.pp, 3).replace(",", ".")),
            ppLabel: `${f.pp >= 0 ? "+" : ""}${formatDecimalIt(f.pp, 2)}`,
          })),
          nota: "Proiezione condizionata alle ipotesi del motore V4 — non è un sondaggio né una garanzia.",
        },
      };
    }
    case "get_active_news_and_grievances": {
      const category = rawInput.category as TerritoryIssueCategory | undefined;
      const region = typeof rawInput.region === "string" ? rawInput.region : undefined;
      const news = queryGraphNodes(ctx.graph, { type: "News" }).slice(0, 12);
      const grievances = queryGraphNodes(ctx.graph, {
        type: "SocialGrievance",
        category,
        region,
      });
      return {
        label: `📰 Recupero notizie/disagi${category ? ` · ${category}` : ""}…`,
        result: {
          news: news.map((n) => n.label),
          grievances: grievances.map((g) => ({
            title: g.label,
            category: g.data.category,
            region: g.data.region,
          })),
          structuralFallback:
            category && region
              ? officialModuloBLine(
                  (resolveRegion(region) ?? "Lazio") as Region,
                  category,
                )
              : null,
        },
      };
    }
    case "get_bip_program_details": {
      const bipId = typeof rawInput.bipId === "string" ? rawInput.bipId : undefined;
      const category = rawInput.category as TerritoryIssueCategory | undefined;
      const items = BIP_FN_PROMISES_CATALOG.filter((b) => {
        if (bipId && b.id !== bipId) return false;
        if (category && b.category !== category) return false;
        return true;
      });
      const messaging = category ? getBipMessaging(category) : null;
      return {
        label: `📘 Consulto B.I.P.${bipId ? ` · ${bipId}` : category ? ` · ${category}` : ""}…`,
        result: {
          misure: items.map((b) => ({
            id: b.id,
            titolo: b.shortTitle,
            categoria: b.category,
            capitolo: b.bipChapter,
            pagine: b.bipPages,
            riferimento: b.bipReference,
            testo: b.testo,
          })),
          messaging,
        },
      };
    }
    default:
      return { label: `⚠️ Tool sconosciuto: ${name}`, result: { error: "unknown_tool" } };
  }
}

export function toolStatusLabel(name: string, input: Record<string, unknown>): string {
  if (name === "get_region_deep_dive") {
    return `🔎 Consulto grafo regione ${String(input.region ?? "")}…`;
  }
  if (name === "simulate_what_if_scenario") {
    const dC = Number(input.deltaComitati) || 0;
    const dT = Number(input.deltaTesserati) || 0;
    return `📐 Simulo ${String(input.scenario ?? "base")} sul motore V4${dC ? ` · +${dC} comitati` : ""}${dT ? ` · +${dT} tesserati` : ""}…`;
  }
  if (name === "get_bip_program_details") return "📘 Consulto misure B.I.P.…";
  if (name === "get_active_news_and_grievances") return "📰 Recupero notizie e disagi…";
  return "🔎 Consulto grafo politico…";
}

/** Etichetta stabile per «Dati / moduli consultati» (senza stato/loading né ellissi). */
export function toolModuleLabel(name: string): string {
  switch (name) {
    case "query_political_graph":
    case "get_region_deep_dive":
      return "Grafo politico";
    case "simulate_what_if_scenario":
      return "Simulazione motore V4";
    case "get_active_news_and_grievances":
      return "Notizie e disagi";
    case "get_bip_program_details":
      return "Programma B.I.P.";
    default:
      return "Modulo strategico";
  }
}
