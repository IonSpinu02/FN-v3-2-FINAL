import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { OperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import type { StrategicCommandBrief } from "@/lib/engine/strategicCommandBrief";

export const GENERATED_PLAN_KEY = "fn-generated-strategic-plan";
export const GENERATED_PLAN_EVENT = "fn:generated-strategic-plan-change";

export const ROADMAP_COMBINATORIAL_DIAGNOSTIC =
  "Variante automatica di riserva (testo AI non disponibile).";

/** Nasconde messaggi tecnici di parsing JSON nei tooltip e nelle etichette motore. */
export function sanitizeRoadmapGenerationDiagnostic(diagnostic?: string): string | undefined {
  if (!diagnostic?.trim()) return diagnostic;
  if (
    /Generazione AI non riuscita|property name|Expected double-quoted|JSON at position|syntax error|generazione fallita/i.test(
      diagnostic,
    )
  ) {
    return ROADMAP_COMBINATORIAL_DIAGNOSTIC;
  }
  let s = diagnostic.trim();
  if (/Chiavi AI assenti/i.test(s)) {
    return "Assistente AI non configurato: in uso la variante automatica di riserva.";
  }
  if (/Generata con (Anthropic|OpenAI|Gemini)|gpt-|gemini-|claude/i.test(s)) {
    return "Strategia redatta con assistente AI.";
  }
  s = s.replace(/\bmodello V4\b/gi, "previsione");
  s = s.replace(/\bV4\b/g, "").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/\bMotore [Cc]ombinatorio\b/g, "Variante automatica");
  s = s.replace(/\bSTIMA MODELLO\b/g, "STIMA");
  return s || undefined;
}

function sanitizeStoredRoadmap(roadmap: OperationalRoadmap): OperationalRoadmap {
  const diagnostic = roadmap.generationMeta?.diagnostic;
  if (!diagnostic) return roadmap;
  const next = sanitizeRoadmapGenerationDiagnostic(diagnostic);
  if (next === diagnostic) return roadmap;
  return {
    ...roadmap,
    generationMeta: { ...roadmap.generationMeta!, diagnostic: next! },
  };
}

export type GeneratedStrategicPlan = {
  targetPct: number;
  horizonDays: HorizonDays;
  strategicFocusNote?: string;
  plan: StrategicBackcastResult;
  brief: StrategicCommandBrief;
  roadmap: OperationalRoadmap;
  ballots: number;
  floor: number;
  warning?: string;
  usedCombinatorialFallback?: boolean;
  savedAt: string;
};

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function parseGeneratedStrategicPlan(raw: unknown): GeneratedStrategicPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<GeneratedStrategicPlan>;
  if (typeof value.targetPct !== "number" || !Number.isFinite(value.targetPct)) return null;
  if (![30, 90, 180, 360].includes(value.horizonDays as number)) return null;
  if (!value.plan || typeof value.plan !== "object") return null;
  if (!value.roadmap || typeof value.roadmap !== "object") return null;
  if (!value.brief || typeof value.brief !== "object") return null;
  if (typeof value.ballots !== "number" || typeof value.floor !== "number") return null;
  if (!Array.isArray((value.roadmap as OperationalRoadmap).stages) || (value.roadmap as OperationalRoadmap).stages.length !== 4) {
    return null;
  }
  return {
    targetPct: value.targetPct,
    horizonDays: value.horizonDays as HorizonDays,
    ...(typeof value.strategicFocusNote === "string" && value.strategicFocusNote.trim()
      ? { strategicFocusNote: value.strategicFocusNote.trim().slice(0, 280) }
      : {}),
    plan: value.plan as StrategicBackcastResult,
    brief: value.brief as StrategicCommandBrief,
    roadmap: sanitizeStoredRoadmap(value.roadmap as OperationalRoadmap),
    ballots: value.ballots,
    floor: value.floor,
    ...(value.usedCombinatorialFallback === true ||
    (typeof value.warning === "string" && /combinatorio|JSON/i.test(value.warning))
      ? { usedCombinatorialFallback: true }
      : {}),
    savedAt: typeof value.savedAt === "string" ? value.savedAt : new Date().toISOString(),
  };
}

export function readGeneratedStrategicPlan(storage: Storage | null = browserStorage()): GeneratedStrategicPlan | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(GENERATED_PLAN_KEY);
    if (!raw) return null;
    const parsed = parseGeneratedStrategicPlan(JSON.parse(raw) as unknown);
    if (!parsed) return null;
    const normalized = JSON.stringify(parsed);
    if (normalized !== raw) storage.setItem(GENERATED_PLAN_KEY, normalized);
    return parsed;
  } catch {
    return null;
  }
}

export function writeGeneratedStrategicPlan(
  value: GeneratedStrategicPlan,
  storage: Storage | null = browserStorage(),
): void {
  if (!storage) return;
  const parsed = parseGeneratedStrategicPlan({ ...value, savedAt: value.savedAt || new Date().toISOString() });
  if (!parsed) return;
  storage.setItem(GENERATED_PLAN_KEY, JSON.stringify(parsed));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(GENERATED_PLAN_EVENT));
}

export function clearGeneratedStrategicPlan(storage: Storage | null = browserStorage()): void {
  if (!storage) return;
  storage.removeItem(GENERATED_PLAN_KEY);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(GENERATED_PLAN_EVENT));
}
