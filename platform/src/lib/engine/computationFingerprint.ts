/**
 * Identificativo atomico di elaborazione: digest SHA-256 canonico sull'intero
 * stato degli input (non su un riepilogo superficiale).
 * Isomorfo client/server via sha256Canonical puro JS.
 */
import {
  FORECAST_V4_MODEL_ID,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
  type ForecastScenarioId,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import {
  canonicalJson,
  fnv1a64HexLegacy,
  sha256Canonical,
  sha256Hex,
} from "@/lib/engine/sha256Canonical";

export const CALIBRATION_VERSION = "cal-v1-walkforward";

/** Re-export per digest locali. */
export { canonicalJson, sha256Hex };
export { fnv1a64HexLegacy as fnv1a64Hex };

export type ComputationInputSummary = {
  engineVersion: string;
  calibrationVersion: string;
  consensusValue: number;
  pollsLastUpdated: string | null;
  scenarioMode: ForecastScenarioId;
  horizonDays: number;
  flowMatrixId: string | null;
  whatIf: ForecastNetworkDelta;
  evidenceDigest: string;
  newsConsidered: number;
  newsWindowHint: string | null;
  /** Digest completo SHA-256 (64 hex) dello stato canonico. */
  fullStateDigest: string;
};

export type ComputationFingerprintInput = {
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  networkDelta?: ForecastNetworkDelta;
  scenarioMode?: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  newsHeadlines?: string[];
  newsIds?: string[];
  eventIds?: string[];
  calibrationVersion?: string;
  excludedEntityIds?: string[];
  /** Coefficienti/versioni motore aggiuntive. */
  engineCoefficients?: Record<string, number | string | boolean>;
};

function horizonDaysOf(key: ForecastHorizonKey | undefined): number {
  if (key === "d30") return 30;
  if (key === "d90") return 90;
  return 180;
}

/** Digest stabile di un elenco titoli (ordine-insensitive). */
export function evidenceDigestOf(headlines: string[]): string {
  const normalized = [...headlines]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return sha256Hex(normalized.join("\n")).slice(0, 16);
}

function pollsLastUpdated(v4Input: ForecastV4Input, v4: ForecastV4Result): string | null {
  const fromPolls = (v4Input.polls ?? [])
    .map((p) => (p.publishedAt ?? p.fieldEnd)?.slice(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1);
  const fromHistory = (v4Input.history ?? [])
    .map((p) => p.isoDate.slice(0, 10))
    .sort()
    .at(-1);
  return fromPolls ?? fromHistory ?? v4.asOf.slice(0, 10) ?? null;
}

/**
 * Stato canonico completo: ogni rettifica a un sondaggio/serie/regione
 * invalida il computationId.
 */
export function buildCanonicalComputationState(
  input: ComputationFingerprintInput,
): Record<string, unknown> {
  const polls = [...(input.v4Input.polls ?? [])]
    .map((p) => ({
      id: p.id ?? null,
      institute: p.institute,
      fieldEnd: p.fieldEnd?.slice(0, 10) ?? null,
      publishedAt: p.publishedAt?.slice(0, 10) ?? null,
      fnPct: p.fnPct,
      sampleSize: p.sampleSize ?? null,
      weight: (p as { weight?: number }).weight ?? null,
      sourceUrl: p.sourceUrl ?? null,
    }))
    .sort(
      (a, b) =>
        String(a.fieldEnd).localeCompare(String(b.fieldEnd)) ||
        String(a.institute).localeCompare(String(b.institute)) ||
        String(a.id).localeCompare(String(b.id)),
    );

  const history = [...(input.v4Input.history ?? [])]
    .map((p) => ({ isoDate: p.isoDate.slice(0, 10), pct: p.pct }))
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate));

  const regions = [...(input.v4Input.regions ?? [])]
    .map((r) => ({
      regione: r.regione,
      consenso: r.sharePct,
      affinita: (r as { affinita?: number }).affinita ?? null,
      tesserati: r.tesserati,
      comitati: (r as { comitati?: number }).comitati ?? null,
      elettori: r.elettori,
      validi: r.validi,
      puntiIstituzionali: r.puntiIstituzionali,
    }))
    .sort((a, b) => String(a.regione).localeCompare(String(b.regione)));

  const headlines = [...(input.newsHeadlines ?? [])]
    .map((h) => h.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const newsIds = [...(input.newsIds ?? [])].map(String).sort();
  const eventIds = [...(input.eventIds ?? [])].map(String).sort();
  const excluded = [...(input.excludedEntityIds ?? [])].map(String).sort();

  return {
    engineVersion: input.v4.modelId ?? FORECAST_V4_MODEL_ID,
    calibrationVersion: input.calibrationVersion ?? CALIBRATION_VERSION,
    calibrationEngineLabel: "forecast-v4",
    formulaVersion: FORECAST_V4_MODEL_ID,
    asOf: input.v4.asOf,
    startPct: input.v4.startPct,
    startIsObservation: input.v4Input.startIsObservation ?? null,
    scenarioMode: input.scenarioMode ?? "base",
    horizonDays: horizonDaysOf(input.horizonKey),
    flowMatrixId: input.v4.diagnostics.flussiMatrixId,
    flussi: input.v4Input.flussi ?? null,
    whatIf: {
      comitati: input.networkDelta?.comitati ?? 0,
      tesserati: input.networkDelta?.tesserati ?? 0,
    },
    polls,
    history,
    regions,
    headlines,
    newsIds,
    eventIds,
    excludedEntityIds: excluded,
    diagnostics: {
      softFloorPct: input.v4.diagnostics.softFloorPct,
      donorShare: input.v4.diagnostics.donorShare,
      tesserati: input.v4.diagnostics.tesserati,
      validiNazionali: input.v4.diagnostics.validiNazionali,
    },
    engineCoefficients: input.engineCoefficients ?? {},
  };
}

export function buildComputationInputSummary(
  input: ComputationFingerprintInput,
): ComputationInputSummary {
  const state = buildCanonicalComputationState(input);
  const fullStateDigest = sha256Canonical(state);
  const headlines = input.newsHeadlines ?? [];
  const excluded = [...(input.excludedEntityIds ?? [])].sort();
  return {
    engineVersion: input.v4.modelId ?? FORECAST_V4_MODEL_ID,
    calibrationVersion: input.calibrationVersion ?? CALIBRATION_VERSION,
    consensusValue: Math.round(input.v4.startPct * 1000) / 1000,
    pollsLastUpdated: pollsLastUpdated(input.v4Input, input.v4),
    scenarioMode: input.scenarioMode ?? "base",
    horizonDays: horizonDaysOf(input.horizonKey),
    flowMatrixId: input.v4.diagnostics.flussiMatrixId,
    whatIf: {
      comitati: input.networkDelta?.comitati ?? 0,
      tesserati: input.networkDelta?.tesserati ?? 0,
    },
    evidenceDigest: evidenceDigestOf([
      ...headlines,
      ...excluded.map((id) => `excl:${id}`),
    ]),
    newsConsidered: headlines.length,
    newsWindowHint: headlines.length
      ? `ultimi ${headlines.length} titoli nel payload`
      : null,
    fullStateDigest,
  };
}

export function computationIdFromSummary(summary: ComputationInputSummary): string {
  // Preferisci il digest completo; fallback legacy solo se assente.
  const dig = summary.fullStateDigest || sha256Canonical(summary);
  return `cmp_${dig.slice(0, 32)}`;
}

export function buildComputationId(input: ComputationFingerprintInput): {
  computationId: string;
  inputSummary: ComputationInputSummary;
  fullStateDigest: string;
} {
  const inputSummary = buildComputationInputSummary(input);
  return {
    computationId: computationIdFromSummary(inputSummary),
    inputSummary,
    fullStateDigest: inputSummary.fullStateDigest,
  };
}

export type DataFreshnessState =
  | "PROVVISORIO"
  | "MANCANTE"
  | "PRECEDENTE"
  | "AGGIORNATO"
  | "NON_ALLINEATO";

export function freshnessLabel(state: DataFreshnessState): string {
  switch (state) {
    case "PROVVISORIO":
      return "Provvisorio (in caricamento)";
    case "MANCANTE":
      return "Mancante / fonte non disponibile";
    case "PRECEDENTE":
      return "Precedente (cache / storico)";
    case "AGGIORNATO":
      return "Aggiornato";
    case "NON_ALLINEATO":
      return "Sintesi non allineata agli input correnti (riferita a elaborazione precedente)";
  }
}

export function isBriefingAligned(
  briefingComputationId: string | undefined | null,
  activeComputationId: string,
): boolean {
  return Boolean(
    briefingComputationId && briefingComputationId === activeComputationId,
  );
}
