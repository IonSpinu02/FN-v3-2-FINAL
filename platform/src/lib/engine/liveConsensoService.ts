import {
  FN_SUPERMEDIA_CONSENSO_SERIES,
  type FnSupermediaPollPoint,
} from "@/lib/fnSupermediaConsensoSeries";
import { OFFICIAL_S, OFFICIAL_S_SOURCE_LABEL } from "./defaults";
import { loadJson } from "./loadData";
import { computeFnNationalAggregate, normalizeToUtcNoon } from "./fnNationalAggregate";
import {
  latestSupermediaFnPointFromSeries,
  type SupermediaFnSnapshot,
} from "./supermediaFnSync";
import type { LiveConsensoPayload as LivePayload } from "./pollTypes";
import type { LiveConsensoPayload, PollRelease } from "./pollTypes";
import type { AggregateResult } from "./fnNationalAggregate";
import { causeNoteForWindow } from "./consensoCauseNote";
import { formatIsoDateIt } from "@/lib/formatIt";

export type LiveConsensoMode = "aggregate" | "supermedia" | "auto";

export type LiveConsensoBuildOptions = {
  asOf?: Date;
  pollReleases?: PollRelease[];
  supermediaSeries?: FnSupermediaPollPoint[];
  feedSyncedAt?: string;
  /** Variazione rispetto al giorno precedente (pp), se calcolabile. */
  dailyDeltaPp?: number | null;
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type PollReleasesFile = { releases: PollRelease[] };

function loadPollReleases(): PollRelease[] {
  try {
    const file = loadJson<PollReleasesFile>("poll_releases.json");
    return file.releases ?? [];
  } catch {
    return [];
  }
}

type SelectionState = {
  method: LiveConsensoPayload["method"];
  s: number;
  sPct: number;
  reliabilityTier: LiveConsensoPayload["reliabilityTier"];
  sourceLabel: string;
  sourceUrl?: string;
  confidenceBandPp: [number, number];
  pollsUsed: LiveConsensoPayload["pollsUsed"];
};

function applyAggregateSelection(aggregate: AggregateResult): SelectionState {
  return {
    method: "FN_DAILY_V2",
    s: aggregate.s,
    sPct: aggregate.fnPct,
    reliabilityTier: "MEDIA",
    sourceLabel:
      "Stima FN giornaliera · un istituto un sondaggio, peso = freschezza × radice del campione",
    sourceUrl: "https://supermedia.youtrend.it/sondaggi/",
    confidenceBandPp: aggregate.confidenceBandPp,
    pollsUsed: aggregate.pollsUsed,
  };
}

function applySupermediaSelection(
  supermedia: SupermediaFnSnapshot,
): SelectionState {
  const sPct = supermedia.pct;
  return {
    method: "SUPERMEDIA_SYNC",
    s: supermedia.s,
    sPct,
    reliabilityTier: "ALTA",
    sourceLabel: supermedia.sourceLabel,
    sourceUrl: supermedia.sourceUrl,
    confidenceBandPp: [round1(sPct - 0.25), round1(sPct + 0.25)],
    pollsUsed: [],
  };
}

function applyManualSelection(
  supermedia: SupermediaFnSnapshot | null,
): SelectionState {
  const sPct = supermedia?.pct ?? OFFICIAL_S * 100;
  const s = supermedia?.s ?? OFFICIAL_S;
  return {
    method: "MANUAL",
    s,
    sPct,
    reliabilityTier: "ALTA",
    sourceLabel: supermedia?.sourceLabel ?? OFFICIAL_S_SOURCE_LABEL,
    sourceUrl: supermedia?.sourceUrl,
    confidenceBandPp: [round1(sPct - 0.3), round1(sPct + 0.3)],
    pollsUsed: [],
  };
}

function pctIt(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

function movementHeadline(delta: number | null): string {
  if (delta == null) return "Cosa dicono i sondaggi";
  if (delta < -0.1) return "Perché il consenso è sceso";
  if (delta > 0.1) return "Perché il consenso è salito";
  return "Perché il consenso è stabile";
}

type StubPoll = { institute: string; fieldEnd: string; fnPct: number };

function forkLineFromPolls(polls: StubPoll[]): string {
  if (polls.length < 2) return "";
  const sorted = [...polls].sort((a, b) => a.fnPct - b.fnPct);
  const lo = sorted[0]!;
  const hi = sorted[sorted.length - 1]!;
  return `${hi.institute} stima FN al ${pctIt(hi.fnPct)}% mentre ${lo.institute} al ${pctIt(lo.fnPct)}%: quando esce ${hi.institute} la media sale più facilmente.`;
}

function scrubStubProse(text: string): string {
  return text
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*;/g, ".")
    .replace(/;\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function directionalStubWhy(
  delta: number | null,
  selectedPct: number,
  previousPct: number | null,
  previousIsoDate: string | null,
  pollLine: string,
  measure: string,
  polls: StubPoll[] = [],
): string {
  const prevDateIt = previousIsoDate ? formatIsoDateIt(previousIsoDate) : "";
  const from = previousPct != null ? `${pctIt(previousPct)}%` : null;
  const to = `${pctIt(selectedPct)}%`;
  const deltaTxt =
    delta == null ? null : `${delta > 0 ? "+" : ""}${pctIt(delta)} punti`;
  const fork = forkLineFromPolls(polls);

  let core: string;
  if (delta == null || Math.abs(delta) <= 0.1) {
    core = `La stima di piattaforma resta sostanzialmente ferma al ${to}${from ? ` (era ${from}${prevDateIt ? ` il ${prevDateIt}` : ""})` : ""}. Ipotesi di lettura: la base tiene, in attesa di una nuova uscita pubblica forte; non è una prova causale.`;
  } else if (delta > 0) {
    core = `La stima di piattaforma passa${from ? ` dal ${from}` : ""}${prevDateIt ? ` (${prevDateIt})` : ""} al ${to}${deltaTxt ? ` (${deltaTxt})` : ""}. Una parte del movimento può dipendere dal mix di sondaggisti in finestra. Ipotesi di lettura: maggiore presenza di Vannacci nel dibattito e spazio lasciato su temi di destra; non è una prova causale.`;
  } else {
    core = `La stima di piattaforma passa${from ? ` dal ${from}` : ""}${prevDateIt ? ` (${prevDateIt})` : ""} al ${to}${deltaTxt ? ` (${deltaTxt})` : ""}. Pesano anche i sondaggisti più bassi in finestra. Ipotesi di lettura: minore presenza pubblica/TV e attenzione mediatica su altre polemiche o sulla manovra; non è una prova causale.`;
  }

  return scrubStubProse([core, fork, pollLine, measure].filter(Boolean).join(" "));
}

function movementBriefFrom(
  supermedia: SupermediaFnSnapshot | null,
  selectedPct: number,
  selection?: SelectionState,
): LivePayload["movementBrief"] {
  if (
    (selection?.method === "FN_DAILY_V2" || selection?.method === "FN_AGGREGATE_V1") &&
    selection.pollsUsed.length > 0
  ) {
    const previousPct = supermedia?.previousPct ?? null;
    const delta =
      previousPct != null ? round1(selectedPct - previousPct) : (supermedia?.deltaPp ?? null);
    const below =
      previousPct == null
        ? []
        : selection.pollsUsed.filter((row) => row.fnPct < previousPct - 0.05);
    const lowest = [...selection.pollsUsed].sort((a, b) => a.fnPct - b.fnPct).slice(0, 3);
    const pollLine =
      previousPct != null && below.length === selection.pollsUsed.length
        ? `Dopo il ${supermedia?.previousIsoDate ? formatIsoDateIt(supermedia.previousIsoDate) : "rilievo precedente"}, tutti i sondaggi in finestra stanno sotto il ${pctIt(previousPct)}%: i più bassi sono ${lowest.map((row) => `${row.institute} al ${pctIt(row.fnPct)}%`).join(", ")}.`
        : lowest.length > 0
          ? `Le rilevazioni più basse della finestra sono ${lowest.map((row) => `${row.institute} al ${pctIt(row.fnPct)}% (${formatIsoDateIt(row.fieldEnd)})`).join(", ")}.`
          : "";
    const cause = causeNoteForWindow(supermedia?.isoDate ?? supermedia?.previousIsoDate);
    const measure =
      supermedia?.deltaPp != null
        ? `YouTrend misura lo stesso movimento: ${pctIt(supermedia.deltaPp)} punti, al ${pctIt(supermedia.pct)}% nella Supermedia del ${formatIsoDateIt(supermedia.isoDate)}.`
        : "";
    return {
      pct: selectedPct,
      previousPct,
      previousIsoDate: supermedia?.previousIsoDate ?? null,
      deltaPp: delta,
      isoDate: supermedia?.isoDate ?? selection.pollsUsed[0]!.fieldEnd,
      headline: movementHeadline(delta),
      why: directionalStubWhy(
        delta,
        selectedPct,
        previousPct,
        supermedia?.previousIsoDate ?? null,
        pollLine,
        measure,
        selection.pollsUsed.map((p) => ({
          institute: p.institute,
          fieldEnd: p.fieldEnd,
          fnPct: p.fnPct,
        })),
      ),
      articleUrl: supermedia?.articleUrl ?? supermedia?.sourceUrl,
      benchmarkPct: supermedia?.pct ?? null,
      gapPp: supermedia != null ? round1(selectedPct - supermedia.pct) : null,
      inputs: selection.pollsUsed,
      // Fonti verificate come candidati per l'agent; il testo hardcoded del calo non viene più usato come body.
      sources: cause?.sources,
    };
  }
  if (!supermedia) return undefined;
  if (Math.abs(supermedia.pct - selectedPct) > 0.15) return undefined;
  const delta =
    supermedia.deltaPp ??
    (supermedia.previousPct != null
      ? Math.round((supermedia.pct - supermedia.previousPct) * 10) / 10
      : null);
  const previousPct =
    supermedia.previousPct ??
    (delta != null ? Math.round((supermedia.pct - delta) * 10) / 10 : null);
  const why = supermedia.why?.trim() || supermedia.caption;
  if (!why) return undefined;
  return {
    pct: supermedia.pct,
    previousPct,
    previousIsoDate: supermedia.previousIsoDate ?? null,
    deltaPp: delta,
    isoDate: supermedia.isoDate,
    headline: movementHeadline(delta),
    why:
      why && !/è sceso|calo/i.test(why)
        ? why
        : directionalStubWhy(
            delta,
            supermedia.pct,
            previousPct,
            supermedia.previousIsoDate ?? null,
            "",
            "",
            [],
          ),
    articleUrl: supermedia.articleUrl ?? supermedia.sourceUrl,
  };
}

/**
 * Consenso nazionale live: aggregato FN e/o ultima Supermedia.
 * `auto`: Stima FN se ≥2 sondaggi grezzi in finestra; altrimenti Supermedia come ancora → MANUAL.
 * `aggregate`: aggregato se ≥1 poll; se finestra vuota → Supermedia → MANUAL.
 */
export function buildLiveConsensoPayload(
  mode: LiveConsensoMode = "auto",
  buildOptions: LiveConsensoBuildOptions = {},
): LiveConsensoPayload {
  const refDate = normalizeToUtcNoon(buildOptions.asOf ?? new Date());
  const asOf = refDate.toISOString();
  const calendarDay = asOf.slice(0, 10);
  const supermediaSeries =
    buildOptions.supermediaSeries ?? FN_SUPERMEDIA_CONSENSO_SERIES;
  const supermedia = latestSupermediaFnPointFromSeries(supermediaSeries, refDate);
  const aggregate = computeFnNationalAggregate(
    buildOptions.pollReleases ?? loadPollReleases(),
    { asOf: refDate },
  );

  let selection: SelectionState;

  if (mode === "supermedia") {
    selection = supermedia
      ? applySupermediaSelection(supermedia)
      : applyManualSelection(supermedia);
  } else if (mode === "aggregate") {
    if (aggregate != null) {
      selection = applyAggregateSelection(aggregate);
    } else if (supermedia != null) {
      selection = applySupermediaSelection(supermedia);
    } else {
      selection = applyManualSelection(null);
    }
  } else {
    const autoAggregate = aggregate != null && aggregate.pollsUsed.length >= 2;
    if (autoAggregate && aggregate) {
      selection = applyAggregateSelection(aggregate);
    } else if (supermedia != null) {
      selection = applySupermediaSelection(supermedia);
      selection.sourceLabel =
        "Ancora Supermedia YouTrend (meno di 2 sondaggi in finestra)";
    } else {
      selection = applyManualSelection(null);
    }
  }

  return {
    s: selection.s,
    sPct: selection.sPct,
    method: selection.method,
    reliabilityTier: selection.reliabilityTier,
    asOf,
    calendarDay,
    feedSyncedAt: buildOptions.feedSyncedAt,
    dailyDeltaPp: buildOptions.dailyDeltaPp ?? null,
    sourceLabel: selection.sourceLabel,
    sourceUrl: selection.sourceUrl,
    confidenceBandPp: selection.confidenceBandPp,
    pollsUsed: selection.pollsUsed,
    supermediaReference: supermedia
      ? {
          pct: supermedia.pct,
          isoDate: supermedia.isoDate,
          caption: supermedia.caption,
        }
      : undefined,
    aggregateReference: aggregate
      ? {
          pct: aggregate.fnPct,
          pollCount: aggregate.pollsUsed.length,
          windowDays: aggregate.windowDays,
        }
      : undefined,
    movementBrief: movementBriefFrom(supermedia, selection.sPct, selection),
  };
}
