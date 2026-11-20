import Anthropic from "@anthropic-ai/sdk";
import { REGIONS, type Region } from "@/lib/engine/constants";
import {
  ambitionProfile,
  buildOperationalRoadmap,
  type AmbitionProfile,
  type DetailedMove,
  type InterferenceMatrix,
  type OperationalRoadmap,
  type RoadmapAction,
  type RoadmapLane,
  type RoadmapPlace,
  type RoadmapPlaceKind,
  type RoadmapStage,
  type StrategicRationale,
} from "@/lib/engine/operationalRoadmapBuilder";
import { buildPoliticalInterferenceContext } from "@/lib/engine/politicalInterferenceContext";
import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { sanitizeStrategicRoadmapText } from "@/lib/ai/strategicRoadmapSanitizer";
import { ROADMAP_COMBINATORIAL_DIAGNOSTIC } from "@/lib/strategy/generatedStrategicPlan";

const PLACE_KINDS: readonly RoadmapPlaceKind[] = [
  "Stazione e sicurezza",
  "Distretto produttivo",
  "Polo sanitario",
  "Porto e logistica",
  "Periferia urbana",
  "Aree interne",
  "Area metropolitana",
];
const LANES: readonly RoadmapLane[] = ["Aria", "Terra", "Istituzioni"];
const REGION_SET = new Set<string>(REGIONS);

export type RoadmapGenerateInput = {
  targetPct: number;
  horizonDays: HorizonDays;
  strategicFocusNote?: string;
  backcast: StrategicBackcastResult;
  /** Opzionale: fetch iniettabile nei test. */
  fetchImpl?: typeof fetch;
};

export type RoadmapGenerateResult = {
  roadmap: OperationalRoadmap;
  provider: "openai" | "gemini" | "anthropic" | "none";
  /** true se il piano usa il motore combinatorio al posto della variante AI. */
  usedCombinatorialFallback?: boolean;
};

type AiDetailedMoveDraft = {
  lane?: string;
  headline?: string;
  whatToDo?: string;
  whyItWorks?: string;
  expectedFriction?: string;
};

type AiStageDraft = {
  stageId?: number;
  label?: string;
  focus?: string;
  places?: Array<{
    region?: string;
    place?: string;
    kind?: string;
    rationale?: string;
    socialPainPoint?: string;
    tacticalActionOnSite?: string;
  }>;
  actions?: Array<{ lane?: string; text?: string }>;
  detailedMoves?: AiDetailedMoveDraft[];
  strategicRationale?: {
    whyNow?: string;
    voterPsychologyMechanism?: string;
    structuralObjective?: string;
  };
  interferenceMatrix?: {
    socialDiscontentVector?: string;
    otherPartiesMoves?: string;
    eventsAndProtests?: string;
    internationalAndEuFactor?: string;
    contingencyPlaybook?: string;
  };
};

type AiRoadmapDraft = {
  executiveThesis?: string;
  keyBottleneckResolution?: string;
  stages?: AiStageDraft[];
};

function isolateJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  if (start < 0) throw new Error("JSON assente nella risposta AI");
  const slice = raw.slice(start);
  const end = slice.lastIndexOf("}");
  if (end <= 0 || !slice.trimEnd().endsWith("}")) return closeOpenJson(slice);
  return slice.slice(0, end + 1);
}

const CURLY_QUOTES = new Set(["\u201C", "\u201D", "\u00AB", "\u00BB"]);

/** Tiene le virgolette tipografiche interne alla stringa, senza spezzare il JSON. */
function normalizeModelJson(input: string): string {
  let s = input.replace(/^\uFEFF/, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s.replace(/(^|[^:"\w])\/\/.*$/gm, "$1");
  let out = "";
  let inString = false;
  let escape = false;
  for (const ch of s) {
    const curly = CURLY_QUOTES.has(ch);
    if (inString) {
      if (escape) {
        escape = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        out += ch;
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        out += "\\n";
        continue;
      }
      if (curly) {
        out += '\\"';
        continue;
      }
      if (ch === '"') inString = false;
      out += ch;
      continue;
    }
    if (ch === '"' || curly) {
      inString = true;
      out += '"';
      continue;
    }
    out += ch === "\u2018" || ch === "\u2019" ? "'" : ch;
  }
  if (inString) out += '"';
  return out.replace(/,\s*([}\]])/g, "$1");
}

/** Mette le virgolette alle chiavi nude `{ chiave: ... }` senza toccare il testo già quotato. */
function quoteBareKeys(source: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inString) {
      out += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = out.length - 1;
      while (j >= 0 && /\s/.test(out[j]!)) j -= 1;
      const prev = out[j] ?? "";
      if (prev === "{" || prev === ",") {
        let k = i;
        while (k < source.length && /[A-Za-z0-9_]/.test(source[k]!)) k += 1;
        let t = k;
        while (t < source.length && /\s/.test(source[t]!)) t += 1;
        if (source[t] === ":") {
          out += `"${source.slice(i, k)}"`;
          i = k - 1;
          continue;
        }
      }
    }
    out += ch;
  }
  return out;
}

function stripCommaBefore(source: string, pos: number): string | null {
  let i = Math.min(pos, source.length) - 1;
  while (i >= 0 && /\s/.test(source[i]!)) i -= 1;
  if (i >= 0 && source[i] === ",") return source.slice(0, i) + source.slice(i + 1);
  return null;
}

/** Converte chiavi 'snake' in "snake" solo fuori dalle stringhe JSON con ". */
function quoteSingleQuotedKeys(source: string): string {
  let out = "";
  let inDouble = false;
  let escape = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (inDouble) {
      out += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      out += ch;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== "'") j += 1;
      if (j < source.length) {
        let t = j + 1;
        while (t < source.length && /\s/.test(source[t]!)) t += 1;
        if (source[t] === ":") {
          out += `"${source.slice(i + 1, j).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
          i = j;
          continue;
        }
      }
    }
    out += ch;
  }
  return out;
}

/** Cerca un identificatore non quotato vicino alla posizione d'errore e lo quota. */
function quoteBareKeyNearPosition(source: string, pos: number): string | null {
  const startScan = Math.max(0, pos - 8);
  const endScan = Math.min(source.length, pos + 64);
  const window = source.slice(startScan, endScan);
  const patterns = [
    /,\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/,
    /\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/,
    /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/,
  ];
  for (const pattern of patterns) {
    const match = window.match(pattern);
    if (!match || match.index === undefined) continue;
    const key = match[1]!;
    const absKeyStart = startScan + match.index + match[0].indexOf(key);
    if (absKeyStart > 0 && source[absKeyStart - 1] === '"') continue;
    return (
      source.slice(0, absKeyStart) +
      `"${key}"` +
      source.slice(absKeyStart + key.length)
    );
  }
  return null;
}

function patchAtJsonError(source: string, message: string): string | null {
  const at = message.match(/position (\d+)/);
  if (!at) return null;
  const pos = Number(at[1]);
  if (!Number.isFinite(pos) || pos < 0 || pos > source.length) return null;
  const ch = source[pos] ?? "";
  if (/double-quoted property name/i.test(message)) {
    const nearKey = quoteBareKeyNearPosition(source, pos);
    if (nearKey && nearKey !== source) return nearKey;
    const stripped = stripCommaBefore(source, pos);
    if (stripped && stripped !== source) return stripped;
    const quoted = quoteBareKeys(source);
    if (quoted !== source) return quoted;
    if (pos >= source.trimEnd().length) return closeOpenJson(source);
    return null;
  }
  const expectsComma = /Expected ','/.test(message);
  if (!expectsComma) return null;
  if (ch === "}" && /'\]'/.test(message)) return `${source.slice(0, pos)}]${source.slice(pos)}`;
  if (ch === "]" && /'}'/.test(message)) return `${source.slice(0, pos)}}${source.slice(pos)}`;
  if (/[A-Za-zÀ-ÿ0-9+]/.test(ch)) {
    const quote = source.lastIndexOf('"', pos - 1);
    if (quote >= 0) return `${source.slice(0, quote)}\\"${source.slice(quote + 1)}`;
  }
  if (ch !== ",") return `${source.slice(0, pos)},${source.slice(pos)}`;
  return null;
}

function closeOpenJson(source: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of source) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if ((ch === "}" || ch === "]") && stack.length) stack.pop();
  }
  let suffix = inString ? '"' : "";
  for (let i = stack.length - 1; i >= 0; i -= 1) suffix += stack[i] === "{" ? "}" : "]";
  return source.replace(/,\s*$/, "") + suffix;
}

function salvagePartialJson(source: string, errorPos: number): unknown | null {
  const start = Math.max(0, Math.min(errorPos, source.length));
  for (let i = start; i > Math.max(0, start - 6000); i -= 1) {
    const boundary = source[i - 1];
    if (boundary !== "}" && boundary !== "]" && boundary !== '"') continue;
    const closed = closeOpenJson(source.slice(0, i).replace(/,\s*$/, ""));
    try {
      return JSON.parse(closed) as unknown;
    } catch {
      /* prova il taglio precedente */
    }
  }
  return null;
}

function parseModelJson(source: string): unknown {
  let s = quoteBareKeys(quoteSingleQuotedKeys(normalizeModelJson(source))).replace(/,\s*([}\]])/g, "$1");
  let lastMessage = "JSON non valido";
  const seen = new Set<string>();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return JSON.parse(s) as unknown;
    } catch (err) {
      lastMessage = err instanceof Error ? err.message : lastMessage;
      const patched = patchAtJsonError(s, lastMessage) ?? closeOpenJson(s);
      if (!patched || patched === s || seen.has(patched)) break;
      seen.add(patched);
      s = quoteBareKeys(quoteSingleQuotedKeys(patched)).replace(/,\s*([}\]])/g, "$1");
    }
  }
  const at = lastMessage.match(/position (\d+)/);
  const salvaged = salvagePartialJson(s, at ? Number(at[1]) : s.length);
  if (salvaged && typeof salvaged === "object") return salvaged;
  throw new Error(lastMessage);
}

function extractJsonObject(text: string): unknown {
  const isolated = isolateJsonObject(text);
  try {
    return JSON.parse(isolated) as unknown;
  } catch {
    return parseModelJson(isolated);
  }
}

function mathConstraints(backcast: StrategicBackcastResult, note?: string): string {
  const fronts = [...backcast.regions]
    .filter((row) => row.addedVotes > 0)
    .sort((a, b) => b.addedVotes - a.addedVotes)
    .slice(0, 12)
    .map(
      (row) =>
        `${row.region} [${row.role}] +${row.addedVotes} voti · oggi ${row.todayPct.toFixed(2)}% → ${row.targetPct.toFixed(2)}% · macro ${row.macroArea}`,
    );
  const themes = backcast.themes
    .slice(0, 6)
    .map((theme) => `${theme.theme}: +${theme.votes} voti · ${theme.regions.slice(0, 4).join(", ")}`);
  const checkpoints = backcast.checkpoints
    .map((point) => `${point.day}g: min ${point.minOnTrackPct.toFixed(2)}% · atteso ${point.expectedPct.toFixed(2)}% · stretch ${point.stretchPct.toFixed(2)}%`)
    .join(" | ");
  return [
    `CONSENSO OGGI (MISURATO): ${backcast.currentPct.toFixed(2)}%`,
    `TRAGUARDO (IPOTESI): ${backcast.targetPct.toFixed(2)}% in ${backcast.horizonDays} giorni`,
    `SCENARI PASSIVO/BASE/OFFENSIVA (STIMA): ${backcast.passiveCentral.toFixed(2)}% / ${backcast.baseCentral.toFixed(2)}% / ${backcast.offensiveCentral.toFixed(2)}%`,
    `MAX ENDOGENO: ${backcast.maxEndogenousPct.toFixed(2)}% · ACHIEVABLE: ${backcast.achievablePct.toFixed(2)}% · GAP ESOGENO: ${backcast.exogenousGapPct.toFixed(2)} pp`,
    `REGIME: ${backcast.regime} · BAND: ${backcast.feasibilityBand} · REALISMO: ${backcast.feasibilityIndex}/100`,
    `VOTI NETTI DA CONQUISTARE: ${backcast.totalDeltaVotes}`,
    `RETE MAX: comitati +${backcast.network.deltaCommittees}, tesserati +${backcast.network.deltaMembers}, eletti ${backcast.network.electedTarget}`,
    `CHECKPOINT: ${checkpoints}`,
    `FRONTI: ${fronts.join("; ")}`,
    `TEMI: ${themes.join("; ")}`,
    note ? `DIRETTIVA UTENTE: ${note.slice(0, 280)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function systemPrompt(horizonDays: HorizonDays, profile: AmbitionProfile, targetPct: number, maxEndogenous: number): string {
  return [
    "Sei il Capo Stratega elettorale di Roberto Vannacci / Futuro Nazionale.",
    "Scrivi come un dossier riservato di altissimo livello: italiano istituzionale, concreto, senza gergo informatico.",
    "VIETATO usare parole tecniche interne: solver, bundle, massimali, schema, JSON, API, motore, algoritmo.",
    "I numeri del vincolo matematico sono INVIOLABILI: non inventare percentuali, voti, comitati, tesserati o eletti diversi da quelli forniti.",
    "Ogni tappa deve essere un dossier tattico completo: perché ora, meccanismo psicologico di conversione del voto, azioni Aria/Terra/Istituzioni con Cosa+Perché+Attrito, matrice interferenze (disagio sociale, altri partiti, eventi/piazze, internazionale/UE) e Piano B.",
    "Integra il contesto di interferenza fornito (Osservatorio, competitor, eventi, UE) in modo chirurgico e realistico.",
    "Marca mentalmente tutto come IPOTESI: nessuna certezza assoluta. Usa etichette MISURATO / STIMA / IPOTESI solo dove pertinenti.",
    "Vietato usare: «Conv.», «Interesse Google (30G)», «Cosa cercano su Google», sigle interne tipo d30/d90/V4/ERP.",
    horizonDays <= 90
      ? "Orizzonte corto: strategia d'urto mediatica e nodi ad alta densità; vietate aperture lente di sedi o lunghe trattative amministrative."
      : "Orizzonte medio-lungo: progressione asimmetrica Aria × Terra × Istituzioni.",
    targetPct <= 8
      ? "Target moderato: consolidamento chirurgico e difesa roccaforti, senza disperdere energie."
      : targetPct >= 10
        ? "Target di sfondamento: convertire notorietà mediatica in struttura territoriale (Paradosso Vannacci)."
        : "Target di espansione controllata sui fronti prioritari.",
    targetPct > maxEndogenous
      ? "Il traguardo supera la frontiera organizzativa: spiega fin dove arriva la macchina e quali manovre straordinarie servono per il surplus."
      : "Il traguardo è entro o vicino alla frontiera organizzativa.",
    `Profilo operativo: ${profile}.`,
    "Rispondi SOLO con un oggetto JSON valido: virgola tra ogni elemento di array e ogni campo, nessuna virgola finale, nessun commento, nessun markdown."
  ].join("\n");
}

function userPrompt(
  backcast: StrategicBackcastResult,
  skeleton: OperationalRoadmap,
  interferenceSummary: string,
  note?: string,
): string {
  const stageHints = skeleton.stages.map((stage) => ({
    stageId: stage.stageId,
    fromDay: stage.fromDay,
    toDay: stage.toDay,
    dayRangeLabel: stage.dayRangeLabel,
    targetConsensusPct: stage.targetConsensusPct,
    regions: stage.regions,
    stageVotesDelta: stage.stageVotesDelta,
    stageCommitteesDelta: stage.stageCommitteesDelta,
    stageMembersDelta: stage.stageMembersDelta,
    stageOfficialsDelta: stage.stageOfficialsDelta,
    cumulativeVotesTarget: stage.cumulativeVotesTarget,
    committees: stage.committees,
    members: stage.members,
    elected: stage.elected,
  }));
  return [
    "VINCOLI MATEMATICI:",
    mathConstraints(backcast, note),
    "",
    interferenceSummary,
    "",
    "SCHELETRO NUMERICO DELLE 4 TAPPE (usa queste regioni e cifre; inventa solo testi e luoghi coerenti):",
    JSON.stringify(stageHints),
    "",
    "SCHEMA JSON RICHIESTO:",
    JSON.stringify({
      executiveThesis: "string",
      keyBottleneckResolution: "string",
      stages: [
        {
          stageId: 1,
          label: "string",
          focus: "string",
          strategicRationale: {
            whyNow: "perché in questa finestra",
            voterPsychologyMechanism: "leva di conversione elettorale",
            structuralObjective: "collo di bottiglia sbloccato",
          },
          places: [
            {
              region: "Lombardia",
              place: "nome reale",
              kind: "Distretto produttivo",
              rationale: "perché",
              socialPainPoint: "dato/disagio locale",
              tacticalActionOnSite: "cosa fare sul posto",
            },
          ],
          detailedMoves: [
            {
              lane: "Aria",
              headline: "titolo",
              whatToDo: "piano operativo dettagliato",
              whyItWorks: "perché sposta voti",
              expectedFriction: "ostacolo e superamento",
            },
            { lane: "Terra", headline: "...", whatToDo: "...", whyItWorks: "...", expectedFriction: "..." },
            { lane: "Istituzioni", headline: "...", whatToDo: "...", whyItWorks: "...", expectedFriction: "..." },
          ],
          interferenceMatrix: {
            socialDiscontentVector: "...",
            otherPartiesMoves: "mosse altrui + nostra contromossa",
            eventsAndProtests: "eventi/piazze + posizionamento",
            internationalAndEuFactor: "dazi/UE/energia → proposta interna",
            contingencyPlaybook: "Piano B anti-interferenza",
          },
        },
      ],
    }),
    "Produci esattamente 4 stages con stageId 1..4. Per ogni stage: strategicRationale completo, 2-5 places, 3 detailedMoves (Aria, Terra, Istituzioni), interferenceMatrix completa.",
  ].join("\n");
}

function asRegion(value: unknown, allowed: readonly Region[]): Region | null {
  if (typeof value !== "string") return null;
  if (!REGION_SET.has(value)) return null;
  const region = value as Region;
  return allowed.includes(region) ? region : allowed[0] ?? null;
}

function asKind(value: unknown): RoadmapPlaceKind {
  return PLACE_KINDS.includes(value as RoadmapPlaceKind) ? (value as RoadmapPlaceKind) : "Periferia urbana";
}

function sanitizeLong(value: unknown, fallback: string, min: number, max: number): string {
  const text = sanitizeStrategicRoadmapText(String(value ?? "")).slice(0, max);
  return text.length >= min ? text : sanitizeStrategicRoadmapText(fallback).slice(0, max);
}

function mergeRationale(draft: AiStageDraft["strategicRationale"], base: StrategicRationale): StrategicRationale {
  return {
    whyNow: sanitizeLong(draft?.whyNow, base.whyNow, 40, 520),
    voterPsychologyMechanism: sanitizeLong(draft?.voterPsychologyMechanism, base.voterPsychologyMechanism, 40, 520),
    structuralObjective: sanitizeLong(draft?.structuralObjective, base.structuralObjective, 30, 420),
  };
}

function mergeInterference(draft: AiStageDraft["interferenceMatrix"], base: InterferenceMatrix): InterferenceMatrix {
  return {
    socialDiscontentVector: sanitizeLong(draft?.socialDiscontentVector, base.socialDiscontentVector, 40, 700),
    otherPartiesMoves: sanitizeLong(draft?.otherPartiesMoves, base.otherPartiesMoves, 40, 700),
    eventsAndProtests: sanitizeLong(draft?.eventsAndProtests, base.eventsAndProtests, 30, 700),
    internationalAndEuFactor: sanitizeLong(draft?.internationalAndEuFactor, base.internationalAndEuFactor, 30, 700),
    contingencyPlaybook: sanitizeLong(draft?.contingencyPlaybook, base.contingencyPlaybook, 30, 700),
  };
}

function mergeDetailedMoves(
  draftMoves: AiDetailedMoveDraft[] | undefined,
  base: readonly [DetailedMove, DetailedMove, DetailedMove],
  legacyActions: Array<{ lane?: string; text?: string }> | undefined,
): readonly [DetailedMove, DetailedMove, DetailedMove] {
  return LANES.map((lane, index) => {
    const found = draftMoves?.find((row) => String(row.lane) === lane);
    const legacy = legacyActions?.find((row) => String(row.lane) === lane);
    const fallback = base[index]!;
    const headline = sanitizeLong(found?.headline, fallback.headline, 8, 120);
    const whatToDo = sanitizeLong(found?.whatToDo ?? legacy?.text, fallback.whatToDo, 40, 700);
    const whyItWorks = sanitizeLong(found?.whyItWorks, fallback.whyItWorks, 30, 520);
    const expectedFriction = sanitizeLong(found?.expectedFriction, fallback.expectedFriction, 30, 520);
    return { lane, headline, whatToDo, whyItWorks, expectedFriction } satisfies DetailedMove;
  }) as [DetailedMove, DetailedMove, DetailedMove];
}

function mergeAiOntoSkeleton(skeleton: OperationalRoadmap, draft: AiRoadmapDraft): OperationalRoadmap {
  const byId = new Map((draft.stages ?? []).map((stage) => [Number(stage.stageId), stage]));
  const stages = skeleton.stages.map((base) => {
    const draftStage = byId.get(base.stageId);
    const places: RoadmapPlace[] = [];
    for (const raw of draftStage?.places ?? []) {
      const region = asRegion(raw.region, base.regions);
      if (!region) continue;
      const place = sanitizeStrategicRoadmapText(String(raw.place ?? "")).slice(0, 120);
      const rationale = sanitizeStrategicRoadmapText(String(raw.rationale ?? "")).slice(0, 280);
      if (!place || place.length < 3 || rationale.length < 8) continue;
      const basePlace = base.placesToPresidiate.find((row) => row.region === region);
      places.push({
        region,
        place,
        kind: asKind(raw.kind),
        rationale,
        socialPainPoint: sanitizeLong(raw.socialPainPoint, basePlace?.socialPainPoint ?? rationale, 12, 280),
        tacticalActionOnSite: sanitizeLong(
          raw.tacticalActionOnSite,
          basePlace?.tacticalActionOnSite ?? `Presidio operativo a ${place}.`,
          12,
          320,
        ),
      });
      if (places.length >= 5) break;
    }

    const detailedMoves = mergeDetailedMoves(draftStage?.detailedMoves, base.detailedMoves, draftStage?.actions);
    const concreteActions = detailedMoves.map((move) => ({
      lane: move.lane,
      text: `${move.headline}: ${move.whatToDo}`,
    })) as [RoadmapAction, RoadmapAction, RoadmapAction];

    const label = sanitizeStrategicRoadmapText(String(draftStage?.label ?? base.label)).slice(0, 120) || base.label;
    const focus = sanitizeStrategicRoadmapText(String(draftStage?.focus ?? base.focus)).slice(0, 420) || base.focus;
    const stage: RoadmapStage = {
      ...base,
      label,
      focus,
      placesToPresidiate:
        places.length >= 2
          ? places
          : base.placesToPresidiate.map((place) => ({
              ...place,
              place: sanitizeStrategicRoadmapText(place.place),
              rationale: sanitizeStrategicRoadmapText(place.rationale),
              socialPainPoint: place.socialPainPoint ? sanitizeStrategicRoadmapText(place.socialPainPoint) : place.socialPainPoint,
              tacticalActionOnSite: place.tacticalActionOnSite
                ? sanitizeStrategicRoadmapText(place.tacticalActionOnSite)
                : place.tacticalActionOnSite,
            })),
      detailedMoves,
      concreteActions,
      strategicRationale: mergeRationale(draftStage?.strategicRationale, base.strategicRationale),
      interferenceMatrix: mergeInterference(draftStage?.interferenceMatrix, base.interferenceMatrix),
      epistemic: "IPOTESI",
    };
    return stage;
  }) as unknown as OperationalRoadmap["stages"];

  const thesis = sanitizeStrategicRoadmapText(String(draft.executiveThesis ?? skeleton.executiveThesis)).slice(0, 900);
  const bottleneck = sanitizeStrategicRoadmapText(String(draft.keyBottleneckResolution ?? skeleton.keyBottleneckResolution)).slice(0, 700);

  return {
    ...skeleton,
    stages,
    executiveThesis: thesis.length >= 40 ? thesis : skeleton.executiveThesis,
    keyBottleneckResolution: bottleneck.length >= 30 ? bottleneck : skeleton.keyBottleneckResolution,
    generatedBy: "AI_MODEL",
    generatedAt: new Date().toISOString(),
    epistemic: "IPOTESI",
  };
}

async function callOpenAi(system: string, user: string, fetchImpl: typeof fetch): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY assente");
  const model = process.env.OPENAI_ROADMAP_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI: contenuto vuoto");
  return content;
}

async function callGemini(system: string, user: string, fetchImpl: typeof fetch): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY assente");
  const model = process.env.GEMINI_ROADMAP_MODEL?.trim() || "gemini-2.5-flash";
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!content) throw new Error("Gemini: contenuto vuoto");
  return content;
}

async function callAnthropic(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error("ANTHROPIC_API_KEY assente");
  const client = new Anthropic({ apiKey: key });
  const model = roadmapAnthropicModel();
  const message = await client.messages.create({
    model,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
  });
  const content = message.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("\n");
  if (!content) throw new Error("Anthropic: contenuto vuoto");
  return content;
}

/** Priorità: Anthropic Claude Sonnet 5.5, poi OpenAI/Gemini come fallback. */
export function aiRoadmapProviderAvailable(): "anthropic" | "openai" | "gemini" | "none" {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "anthropic";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return "none";
}

export function roadmapAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5-5";
}

export function roadmapProviderModelLabel(provider: "anthropic" | "openai" | "gemini" | "none"): string {
  if (provider === "anthropic") return roadmapAnthropicModel();
  if (provider === "openai") return process.env.OPENAI_ROADMAP_MODEL?.trim() || "gpt-4o-mini";
  if (provider === "gemini") return process.env.GEMINI_ROADMAP_MODEL?.trim() || "gemini-2.5-flash";
  return "Motore Combinatorio";
}

/** Genera roadmap AI ancorata al backcast; fallback deterministico se manca chiave o fallisce la rete. */
export async function generateStrategicRoadmap(input: RoadmapGenerateInput): Promise<RoadmapGenerateResult> {
  const skeleton = buildOperationalRoadmap(input.backcast, input.horizonDays);
  const profile = ambitionProfile(input.backcast);
  const provider = aiRoadmapProviderAvailable();
  const modelLabel = roadmapProviderModelLabel(provider);

  if (provider === "none") {
    return {
      roadmap: {
        ...skeleton,
        generationMeta: {
          provider: "none",
          modelLabel,
          diagnostic:
            "Chiavi AI assenti in .env.local. Imposta ANTHROPIC_API_KEY (priorità Claude Sonnet 5.5), oppure OPENAI_API_KEY / GEMINI_API_KEY.",
        },
      },
      provider: "none",
      usedCombinatorialFallback: true,
    };
  }

  const interference = buildPoliticalInterferenceContext({
    regions: [...new Set(skeleton.stages.flatMap((stage) => stage.regions))],
    themes: input.backcast.themes.slice(0, 4).map((row) => row.theme),
    horizonDays: input.horizonDays,
  });
  const system = systemPrompt(input.horizonDays, profile, input.targetPct, input.backcast.maxEndogenousPct);
  const user = userPrompt(input.backcast, skeleton, interference.summaryForPrompt, input.strategicFocusNote);
  const fetchImpl = input.fetchImpl ?? fetch;

  try {
    const raw =
      provider === "anthropic"
        ? await callAnthropic(system, user)
        : provider === "openai"
          ? await callOpenAi(system, user, fetchImpl)
          : await callGemini(system, user, fetchImpl);
    const draft = extractJsonObject(raw) as AiRoadmapDraft;
    const merged = mergeAiOntoSkeleton(skeleton, draft);
    return {
      roadmap: {
        ...merged,
        generationMeta: {
          provider,
          modelLabel,
          diagnostic: "Strategia redatta con assistente AI.",
        },
      },
      provider,
    };
  } catch (err) {
    return {
      roadmap: {
        ...skeleton,
        generationMeta: {
          provider,
          modelLabel,
          diagnostic: ROADMAP_COMBINATORIAL_DIAGNOSTIC,
        },
      },
      provider,
      usedCombinatorialFallback: true,
    };
  }
}
