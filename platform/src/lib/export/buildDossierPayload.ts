import {
  buildDeterministicBriefing,
  anthropicConfigured,
  sanitizePublicStrategistText,
  type ForecastBriefing,
} from "@/lib/ai/strategistAgent";
import { buildPoliticalKnowledgeGraph } from "@/lib/ai/politicalKnowledgeGraph";
import {
  buildCoverageManifest,
  type CoverageManifest,
} from "@/lib/engine/coverageManifest";
import { buildComputationId } from "@/lib/engine/computationFingerprint";
import { FN_SUPERMEDIA_CONSENSO_SERIES } from "@/lib/fnSupermediaConsensoSeries";
import {
  FORECAST_FACTOR_ORDER,
  forecastHorizon,
  forecastV4HorizonDefs,
  recommendForecastAction,
  staticForecastPolls,
  staticForecastRegions,
  walkForwardBacktestV4,
  type ForecastBacktestV4,
  type ForecastFactorId,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
  type ForecastScenarioId,
  type ForecastV4Input,
  type ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import { formatApproximateVotes } from "@/lib/formatApproximateVotes";
import { formatDecimalIt, formatIntIt } from "@/lib/formatIt";
import { selectNewsForDossier } from "@/lib/export/matchNewsToBip";
import { buildDossierRegionPriorities } from "@/lib/export/dossierRegionalPriority";
import {
  buildConsensusDriversInput,
  buildDeterministicConsensusExplanation,
  headlineForDirection,
  consensusDirectionOf,
} from "@/lib/ai/consensusExplanationAgent";
import {
  provenanceBadge,
  type DossierMovementWhy,
  type StrategicDossierPayload,
} from "@/lib/export/dossierTypes";
import { buildDailyOrder } from "@/lib/engine/dailyOrderEngine";
import { buildGrowthEvidence, seriesWithCurrentPoint } from "@/lib/engine/growthEvidence";
import { OFFICIAL_S_SOURCE_LABEL } from "@/lib/engine/defaults";
import {
  formatDateIt,
  pdfSafeText,
  pdfSignedPp,
  sanitizeDossierPublicText,
} from "@/lib/export/pdfSafeText";
import {
  DOSSIER_FALLBACK_HEADLINES,
  preferCompleteNews,
  preferCompletePolls,
} from "@/lib/export/resolveDossierExportInput";

export type BuildStrategicDossierInput = {
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  scenarioMode?: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  excludedEntityIds?: string[];
  briefing?: ForecastBriefing | null;
  backtest?: ForecastBacktestV4 | null;
  coverageOverride?: CoverageManifest | null;
  /** Preferito: spiegazione live dal server (popup Consenso). */
  movementWhy?: DossierMovementWhy | null;
  /** Assente: l'ordine operativo resta quello di oggi. */
  consensusTarget?: { targetPct: number; horizon: "d30" | "d90" | "d180" } | null;
  /** Assente: nessuna riga di rotta nel riquadro operativo. */
  activeRouteNote?: string | null;
};

function dayISO(d: Date | string | number | null | undefined): string {
  const x =
    d instanceof Date
      ? d
      : typeof d === "string" || typeof d === "number"
        ? new Date(d)
        : new Date();
  if (!Number.isFinite(x.getTime())) return new Date().toISOString().slice(0, 10);
  return x.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pct(n: number): string {
  return formatDecimalIt(n, 2);
}

function verificationCode(computationId: string): string {
  const bare = computationId.replace(/^cmp_/i, "");
  return bare.slice(0, 6);
}

function shortRef(computationId: string): string {
  return `Codice verifica calcolo: #${verificationCode(computationId)}`;
}

function votesHint(deltaPp: number, validi: number): string {
  return pdfSafeText(
    formatApproximateVotes((deltaPp / 100) * validi, { suffix: " voti" }),
  );
}

function monthLabel(iso: string): string {
  const m = Number(iso.slice(5, 7));
  const y = iso.slice(2, 4);
  const names = [
    "GEN",
    "FEB",
    "MAR",
    "APR",
    "MAG",
    "GIU",
    "LUG",
    "AGO",
    "SET",
    "OTT",
    "NOV",
    "DIC",
  ];
  const name = names[m - 1] ?? iso.slice(5, 7);
  if (m === 5 && Number(iso.slice(0, 4)) >= 2027) return `MAG '${y}`;
  return name;
}

/** Deduplica etichette mese consecutive (niente OTT OTT OTT). */
function dedupeMonthLabels(
  labels: string[],
): string[] {
  let prev = "";
  return labels.map((label) => {
    if (label === "OGGI" || label.startsWith("MAG")) {
      prev = label;
      return label;
    }
    if (label === prev) return "";
    prev = label;
    return label;
  });
}

function cleanDraftText(raw: string): string {
  let t = sanitizePublicStrategistText(raw);
  t = t.replace(/\bORGANIZZAZIONE\s*·\s*/gi, "");
  t = t.replace(/\(ORGANIZZAZIONE[^)]*\)/gi, "");
  t = t.replace(
    /\bRete Comitati\s*&\s*Presidio Regioni Verdi\b/gi,
    "rete comitati e presidio territoriale",
  );
  t = t.replace(/\.{2,}/g, ".");
  return sanitizeDossierPublicText(t);
}

function factorPublicLabel(id: ForecastFactorId): string {
  switch (id) {
    case "momentum":
      return "Assestamento sondaggi";
    case "agenda":
      return "Spinta su temi caldi e B.I.P.";
    case "donor":
      return "Recupero delusi da FdI e Lega";
    case "ground":
      return "Contatto diretto tesserati e comitati";
    case "magnet":
      return "Traino personale degli eletti";
    case "cycle":
      return "Effetto calendario politico";
    case "bounds":
      return "Tetto prudenziale del modello";
    default:
      return id;
  }
}

function zoccoloPct(levelPct: number): string {
  return formatDecimalIt(levelPct, 1);
}

function factorExplanation(args: {
  id: ForecastFactorId;
  pp: number;
  levelPct: number;
  tesserati: number;
  comitati: number;
  eletti: { dep: number; reg: number; sind: number; com: number };
}): string {
  // Senza prefisso "Dato + Ipotesi:" (già nel badge nature a sinistra).
  const soft = zoccoloPct(args.levelPct);
  const tess = formatIntIt(args.tesserati);
  const com = formatIntIt(args.comitati);
  switch (args.id) {
    case "momentum":
      if (args.pp < -0.005) {
        return `Fisiologico rientro dopo il picco mediatico di settembre (7,7%) verso lo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti).`;
      }
      if (args.pp > 0.005) {
        return `Spinta rialzista degli ultimi sondaggi rispetto allo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti).`;
      }
      return `Assestamento dei sondaggi in linea con lo zoccolo duro strutturale stimato intorno al ${soft}% (al netto delle oscillazioni tra istituti).`;
    case "agenda":
      return `Presidio quotidiano in TV e social su sicurezza, bollette, fisco Partite IVA e mutui, collegato alle proposte chiave del Programma B.I.P.`;
    case "donor":
      return `Sul calo fisiologico dei partiti di governo (circa 0,44% in sessione di Manovra), si stima prudenzialmente di intercettarne il 18% (il resto va nell'astensione).`;
    case "ground":
      return `Lavoro sul campo di ${tess} tesserati e ${com} comitati (1 voto conquistato ogni circa 20 contatti porta-a-porta/banchetti).`;
    case "magnet":
      return `Radicamento nei collegi dei ${args.eletti.dep} deputati, ${args.eletti.reg} consiglieri regionali, ${args.eletti.sind} sindaci e ${args.eletti.com} consiglieri comunali già in FN.`;
    case "cycle":
      return `Superata la stretta mediatica della Manovra invernale, in primavera si riattiva al voto una quota di astenuti.`;
    case "bounds":
      return `Correttivo automatico che impedisce sovrastime irrealistiche.`;
    default:
      return "";
  }
}

/** Sostituisce voti finto-precisi; non antepone "circa" se è già presente. */
function roundVotesInProse(text: string): string {
  let out = text.replace(
    /(circa\s+)?([+\-−]?)(\d{1,3}(?:\.\d{3})+)\s*voti(?:\s+indicativi)?/gi,
    (_m, _circa: string, sign: string, body: string) => {
      const n = Number(String(body).replace(/\./g, ""));
      if (!Number.isFinite(n)) return _m;
      const signed = sign === "-" || sign === "−" ? -n : n;
      return formatApproximateVotes(signed, { suffix: " voti" });
    },
  );
  out = out.replace(/\b(circa\s+){2,}/gi, "circa ");
  return out;
}

function finalizePublicProse(text: string): string {
  return sanitizeDossierPublicText(roundVotesInProse(text));
}

function scartoDallaMedia(pollPct: number, media: number): string {
  const d = pollPct - media;
  const body = pdfSignedPp(d);
  if (Math.abs(d) < 0.005) return `${body} pt in linea con la media`;
  if (d < 0) return `${body} pt sotto media`;
  return `${body} pt sopra media`;
}

function buildFallbackMovementWhy(args: {
  currentPct: number;
  history: Array<{ isoDate: string; pct: number }>;
  polls: Array<{ institute: string; fieldEnd: string; publishedAt?: string; fnPct: number; id?: string }>;
  asOfISO: string;
}): DossierMovementWhy {
  const hist = [...args.history].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const before = hist.filter((h) => h.isoDate <= args.asOfISO);
  const lastHist = before.at(-1) ?? null;
  // Se l'ultimo punto storico ≈ livello corrente, il riferimento è quello precedente (es. Supermedia 6,1% del 2 nov).
  const prev =
    lastHist && Math.abs(lastHist.pct - args.currentPct) < 0.15
      ? (before.at(-2) ?? null)
      : lastHist;
  const previousPct = prev?.pct ?? null;
  const deltaPp =
    previousPct != null
      ? Math.round((args.currentPct - previousPct) * 10) / 10
      : null;
  const drivers = buildConsensusDriversInput({
    currentConsensus: args.currentPct,
    previousReferenceValue: previousPct,
    previousReferenceDate: prev?.isoDate ?? null,
    deltaPp,
    supermediaValue: hist.at(-1)?.pct ?? null,
    releases: args.polls.map((p, i) => ({
      id: p.id ?? `poll-${i}`,
      institute: p.institute,
      fieldEnd: dayISO(p.fieldEnd),
      publishedAt: dayISO(p.publishedAt ?? p.fieldEnd),
      fnPct: p.fnPct,
    })),
    asOf: args.asOfISO,
  });
  const explanation = buildDeterministicConsensusExplanation(drivers);
  const { headline } = headlineForDirection(consensusDirectionOf(deltaPp));
  const ui = explanation.uiBlocks;
  const plainWhy = sanitizeDossierPublicText(
    explanation.plainWhy || ui?.plainWhy || explanation.paragraph,
  );
  const pollstersNote = sanitizeDossierPublicText(
    ui?.pollstersNote ||
      "In questa finestra le stime dei sondaggisti vanno lette insieme al quadro pubblico.",
  );
  const teamAction = sanitizeDossierPublicText(
    ui?.teamDirective ||
      "Insistere in TV e sui social su sicurezza, bollette e tasse.",
  );
  const factsBullets = (ui?.newsBullets ?? [])
    .slice(0, 5)
    .map((n) => ({
      badge: sanitizeDossierPublicText(
        (n.badge || n.sourceDate || "Stampa").replace(/^fonte\s*[-–—:]\s*/i, ""),
      ),
      text: sanitizeDossierPublicText(n.text || n.summary || ""),
    }))
    .filter((n) => n.text.length > 2);
  return {
    headline: sanitizeDossierPublicText(explanation.headline || headline),
    pct: args.currentPct,
    previousPct,
    previousIsoDate: prev?.isoDate ?? null,
    deltaPp,
    supermediaPct: drivers.supermediaValue,
    gapPp: drivers.scarto,
    paragraph: sanitizeDossierPublicText(
      [plainWhy, pollstersNote, `Cosa fare ora (Team FN): ${teamAction}`]
        .filter(Boolean)
        .join(" "),
    ),
    plainWhy,
    factsBullets,
    pollstersNote,
    teamAction,
    disclaimer: sanitizeDossierPublicText(explanation.disclaimer),
    sources: explanation.citedSources.slice(0, 6).map((s) => ({
      label: sanitizeDossierPublicText(s.label.replace(/^fonte\s*[-–—:]\s*/i, "")),
      url: s.url,
    })),
    polls: drivers.recentPolls.slice(0, 6).map((p) => ({
      institute: sanitizeDossierPublicText(p.institute),
      dateDisplay: formatDateIt(
        dayISO(p.publishedAt ?? p.fieldEnd),
        "short",
      ),
      pct: p.fnPct,
    })),
  };
}

/**
 * Costruisce il payload del Dossier Strategico PDF, vincolato allo stesso computationId
 * dei dati a schermo e sincronizzato con V4 / consenso / grafo / B.I.P.
 */
export function buildStrategicDossierPayload(
  input: BuildStrategicDossierInput,
): StrategicDossierPayload {
  const horizonKey = input.horizonKey ?? "d180";
  const scenarioMode = input.scenarioMode ?? "base";
  // Mai 0 notizie: usa titoli reali se >=5, altrimenti fallback tematico.
  const newsHeadlines = preferCompleteNews(
    input.newsHeadlines ?? input.v4Input.newsHeadlines ?? [],
    [...DOSSIER_FALLBACK_HEADLINES],
  );
  const { computationId } = buildComputationId({
    v4: input.v4,
    v4Input: input.v4Input,
    networkDelta: input.networkDelta,
    scenarioMode,
    horizonKey,
    newsHeadlines,
    excludedEntityIds: input.excludedEntityIds,
  });

  const asOfISO = dayISO(input.v4.asOf ?? input.v4Input.asOf);
  const defs = forecastV4HorizonDefs(input.v4.asOf ?? input.v4Input.asOf);
  const mayDef = defs.find((d) => d.key === "d180")!;
  const endDateISO = addDaysISO(asOfISO, mayDef.days);
  const code = verificationCode(computationId);

  // Preferisci sempre il set più completo (il route server passa già i 32).
  const allPolls = preferCompletePolls(
    input.v4Input.polls ?? [],
    staticForecastPolls(),
  )
    .filter((p) => Number.isFinite(p.fnPct) && p.fnPct > 0)
    .sort((a, b) =>
      dayISO(b.publishedAt ?? b.fieldEnd).localeCompare(
        dayISO(a.publishedAt ?? a.fieldEnd),
      ),
    );
  const pollsForTable = allPolls.slice(0, 8);
  const pollPcts = allPolls.map((p) => p.fnPct);
  const forkMin = pollPcts.length ? Math.min(...pollPcts) : null;
  const forkMax = pollPcts.length ? Math.max(...pollPcts) : null;
  const forkMinRecent = pollsForTable.length
    ? Math.min(...pollsForTable.map((p) => p.fnPct))
    : forkMin;
  const forkMaxRecent = pollsForTable.length
    ? Math.max(...pollsForTable.map((p) => p.fnPct))
    : forkMax;

  const historySeries =
    input.v4Input.history?.length
      ? input.v4Input.history
      : FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
          isoDate: p.isoDate,
          pct: p.pct,
        }));

  const backtest =
    input.backtest ??
    walkForwardBacktestV4({
      series: historySeries,
      polls: allPolls,
    });

  const graph = buildPoliticalKnowledgeGraph({
    v4: input.v4,
    v4Input: input.v4Input,
    backtest,
    networkDelta: input.networkDelta,
    newsHeadlines,
    horizonKey,
  });
  const s = graph.summary;
  const briefing = input.briefing ?? buildDeterministicBriefing(graph);
  const backtestMae = {
    n: backtest.n,
    maeModello: backtest.maeV4,
    maeFlat: backtest.maeFlat,
  };

  const filteredBaselinePct = input.v4.diagnostics.levelPct;
  const obsPolls =
    input.v4.diagnostics.observations.polls || allPolls.length;
  const obsSupermedia =
    input.v4.diagnostics.observations.supermedia || historySeries.length;
  const pollsCount = Math.max(obsPolls, allPolls.length);
  const eletti = s.organizzazione.eletti;
  const elettiTot = eletti.dep + eletti.reg + eletti.sind + eletti.com;
  const validi = s.validiNazionali;

  const horizons = defs.map((def) => {
    const base = forecastHorizon(input.v4, "base", def.key);
    const passivo = forecastHorizon(input.v4, "passivo", def.key);
    const off = forecastHorizon(input.v4, "offensiva", def.key);
    const momPp = base.factors.find((f) => f.id === "momentum")?.pp ?? 0;
    const pollsAlone = input.v4.startPct + momPp;
    const votesBase = votesHint(base.deltaPp, validi);
    return {
      horizonKey: def.key,
      horizonLabel: def.label,
      days: def.days,
      pollsAlonePct: pollsAlone,
      passivoPct: passivo.centralPct,
      basePct: base.centralPct,
      offensivaPct: off.centralPct,
      deltaBaseVsOggiPp: base.deltaPp,
      deltaBaseVsPollsPp: base.centralPct - pollsAlone,
      deltaOffVsOggiPp: off.deltaPp,
      votesBaseHint: votesBase,
      votesOffHint: votesHint(off.deltaPp, validi),
      growthBaseLabel: `${pdfSignedPp(base.deltaPp)} pt - ${votesBase}`,
    };
  });

  const h30 = forecastHorizon(input.v4, "base", "d30");
  const h90 = forecastHorizon(input.v4, "base", "d90");
  const h180 = forecastHorizon(input.v4, "base", "d180");
  const factorBy = (h: typeof h30) =>
    new Map(h.factors.map((f) => [f.id, f] as const));
  const f30 = factorBy(h30);
  const f90 = factorBy(h90);
  const f180 = factorBy(h180);

  const factorRows = FORECAST_FACTOR_ORDER.map((id) => {
    const row = f180.get(id) ?? f90.get(id) ?? f30.get(id)!;
    const pp180 = f180.get(id)?.pp ?? 0;
    const nature =
      id === "bounds"
        ? ("Regola di prudenza" as const)
        : provenanceBadge(row.provenance);
    return {
      id,
      label: factorPublicLabel(id),
      short: factorPublicLabel(id),
      plain: sanitizeDossierPublicText(row.plain),
      nature,
      explanation: factorExplanation({
        id,
        pp: pp180,
        levelPct: filteredBaselinePct,
        tesserati: s.organizzazione.tesserati,
        comitati: s.organizzazione.comitati,
        eletti,
      }),
      votesHint: votesHint(pp180, validi),
      pp30: f30.get(id)?.pp ?? 0,
      pp90: f90.get(id)?.pp ?? 0,
      pp180,
    };
  });

  const totalPp = factorRows.reduce((acc, r) => acc + r.pp180, 0);
  const totalVotes = votesHint(totalPp, validi);
  const sumBody = formatDecimalIt(Math.abs(totalPp), 2);
  const sumPart =
    totalPp < 0 ? `-${sumBody}%` : `${sumBody}%`;
  const totalEquation = sanitizeDossierPublicText(
    `${pct(s.consensoOggiPct)}% (Oggi) + ${sumPart} (Somma dei 7 fattori) = ${pct(h180.centralPct)}% (Scenario Base Maggio 2027 - ${totalVotes})`,
  );

  const historyTail = historySeries
    .filter((p) => dayISO(p.isoDate) <= asOfISO)
    .slice(-6);
  const rawHistoryLabels = historyTail.map((p) => monthLabel(dayISO(p.isoDate)));
  const dedupedHistory = dedupeMonthLabels(rawHistoryLabels);

  const todayPoint = {
    day: historyTail.length,
    label: "OGGI",
    isoDate: asOfISO,
    isToday: true as const,
    pollsAlone: input.v4.startPct,
    base: input.v4.startPct,
    offensiva: input.v4.startPct,
  };
  const projPoints = horizons.map((h, i) => ({
    day: historyTail.length + 1 + i,
    label:
      h.horizonKey === "d30"
        ? "DIC"
        : h.horizonKey === "d90"
          ? "FEB"
          : "MAG '27",
    isoDate: addDaysISO(asOfISO, h.days),
    isToday: false as const,
    pollsAlone: h.pollsAlonePct,
    base: h.basePct,
    offensiva: h.offensivaPct,
  }));
  const chart = [
    ...historyTail.map((p, i) => ({
      day: i,
      label: dedupedHistory[i] ?? monthLabel(dayISO(p.isoDate)),
      isoDate: dayISO(p.isoDate),
      isToday: false as const,
      pollsAlone: p.pct,
      base: p.pct,
      offensiva: p.pct,
    })),
    todayPoint,
    ...projPoints,
  ];

  const newsBip = selectNewsForDossier(newsHeadlines, 5).map((card) => ({
    ...card,
    codiceBip: card.codiceBip,
    titoloBip: card.titoloBip,
    azioneRimedioBip: sanitizeDossierPublicText(card.azioneRimedioBip),
    rischioOpportunitaConsenso: sanitizeDossierPublicText(
      card.rischioOpportunitaConsenso,
    ),
  }));

  const softRight = zoccoloPct(filteredBaselinePct);
  const tesiRaw = roundVotesInProse(
    briefing.tesi
      .replace(
        /linea di fondo filtrata\s*\(~?\s*[^)]+%\)/gi,
        `zoccolo duro strutturale stimato intorno al ${softRight}% (al netto delle oscillazioni tra istituti)`,
      )
      .replace(
        /zoccolo duro strutturale stimato(?:\s+intorno)?\s+al\s+[\d,]+%/gi,
        `zoccolo duro strutturale stimato intorno al ${softRight}%`,
      ),
  );
  const tesiParts = tesiRaw
    .split(/\n\s*\n/)
    .map((p) =>
      finalizePublicProse(
        p
          .trim()
          .replace(
            /circa\s+([+\-][\d,]+)\s*pt\s+di\s+contributi\s+strutturali,\s*a\s+fronte\s+di\s+un\s+recupero\s+di\s+\1\s*pt/gi,
            "circa $1 pt di leve operative",
          ),
      ),
    )
    .filter(Boolean);
  while (tesiParts.length < 3)
    tesiParts.push(tesiParts[tesiParts.length - 1] ?? "");
  const tesiParagraphs: [string, string, string] = [
    tesiParts[0]!,
    tesiParts[1]!,
    finalizePublicProse(
      `${tesiParts[2]!} Il modello Base concentra la spinta organizzativa sulle 8 Regioni Verdi. Questo dossier allega comunque la mappatura operativa estesa a tutte le 20 regioni italiane.`,
    ),
  ];

  const regionsAbove3 = (input.v4Input.regions ?? []).filter(
    (r) => (r.sharePct ?? 0) >= 3,
  ).length;

  const pollsAloneMay =
    horizons.find((h) => h.horizonKey === "d180")?.pollsAlonePct ??
    s.tendenzaSoliSondaggiPct;
  const maggio = horizons.find((h) => h.horizonKey === "d180")!;

  const forkLo = forkMinRecent ?? forkMin;
  const forkHi = forkMaxRecent ?? forkMax;
  const recentVariationNote =
    forkLo != null && forkHi != null
      ? `Gli istituti oscillano oggi tra il ${pct(forkLo)}% e il ${pct(forkHi)}%; stima odierna ${pct(s.consensoOggiPct)}%; proiezione sui soli sondaggi a maggio ${pct(pollsAloneMay)}% (zoccolo duro strutturale stimato intorno al ${softRight}%, al netto delle oscillazioni tra istituti).`
      : `Stima odierna ${pct(s.consensoOggiPct)}%; proiezione sui soli sondaggi ${pct(pollsAloneMay)}%.`;

  const votesBaseNote =
    "Stima voti calcolata su circa 23 milioni di voti validi (ogni 1% equivale a circa 230.000 voti, ipotesi affluenza 50%).";

  const coverage =
    input.coverageOverride ??
    buildCoverageManifest({
      newsConsidered: newsHeadlines.length,
      newsDetected: newsHeadlines.length,
      newsExcluded: 0,
      windowStart: asOfISO,
      windowEnd: endDateISO,
      calendarSource: "local-catalog",
      storage: "file",
      sources: [
        {
          sourceKey: "polls",
          label: "Sondaggi nazionali",
          lastCheckedAt: asOfISO,
          lastNewItemAt: allPolls[0]
            ? dayISO(allPolls[0].publishedAt ?? allPolls[0].fieldEnd)
            : null,
          lastRecalcAt: asOfISO,
          methodVersion: "forecastEngineV4",
          usedFallback: !(input.v4Input.polls && input.v4Input.polls.length > 0),
          fallbackLabel: input.v4Input.polls?.length
            ? null
            : "staticForecastPolls",
          itemsFetched: pollsCount,
          itemsAccepted: pollsCount,
          itemsRejected: 0,
          status: allPolls.length ? "ok" : "fallback",
        },
        {
          sourceKey: "supermedia",
          label: "Supermedia / serie storica",
          lastCheckedAt: asOfISO,
          lastNewItemAt: historySeries.at(-1)?.isoDate ?? null,
          lastRecalcAt: asOfISO,
          methodVersion: "forecastEngineV4",
          usedFallback: false,
          itemsFetched: Math.max(obsSupermedia, historySeries.length),
          itemsAccepted: Math.max(obsSupermedia, historySeries.length),
          itemsRejected: 0,
          status: "ok",
        },
        {
          sourceKey: "news",
          label: "Feed notizie",
          lastCheckedAt: asOfISO,
          lastNewItemAt: asOfISO,
          lastRecalcAt: asOfISO,
          methodVersion: "growthEvidence",
          usedFallback: newsHeadlines.length === 0,
          fallbackLabel: newsHeadlines.length
            ? null
            : "schede tematiche di sistema",
          itemsFetched: newsHeadlines.length,
          itemsAccepted: Math.min(5, Math.max(newsHeadlines.length, 1)),
          itemsRejected: 0,
          status: newsHeadlines.length ? "live" : "fallback",
        },
      ],
    });

  const textOrigin =
    anthropicConfigured() && briefing.source === "anthropic"
      ? ("Analisi AI live Anthropic" as const)
      : ("Regole deterministiche di modello" as const);
  const textOriginPublic =
    textOrigin === "Analisi AI live Anthropic"
      ? "Analisi strategica AI su dati aggiornati"
      : "Elaborazione automatica su dati piattaforma";

  const reliabilityBox = sanitizeDossierPublicText(
    [
      `Attendibilità: ogni cifra del dossier è allineata al codice verifica calcolo #${code}.`,
      backtestMae.n > 0
        ? `Verifica storica a 30 giorni (su ${backtestMae.n} confronti): scarto medio del modello +/-${pct(backtestMae.maeModello)} pt rispetto all'ipotesi di consenso fermo (+/-${pct(backtestMae.maeFlat)} punti).`
        : `Verifica storica a 30 giorni non disponibile su questo aggiornamento.`,
      `Stima odierna ${pct(s.consensoOggiPct)}% rispetto alla proiezione sui soli sondaggi ${pct(pollsAloneMay)}% (zoccolo duro strutturale stimato intorno al ${softRight}%, al netto delle oscillazioni tra istituti).`,
      `Limiti: 90 giorni e Maggio non sono verificabili sullo stesso campione storico; mosse degli avversari, affluenza e shock esterni restano fuori dal modello.`,
      `Origine dei testi: ${textOriginPublic}. Schede notizie e misure B.I.P.: elaborazione automatica su dati piattaforma.`,
    ].join(" "),
  );

  const draftTitles: [string, string] = [
    "Dichiarazione sui sondaggi e gli obiettivi",
    "Intervento economico su Manovra, bollette e Partite IVA",
  ];
  const draftComms: [string, string] = [
    cleanDraftText(
      `Oggi Futuro Nazionale è stimato al ${pct(s.consensoOggiPct)}%, media ponderata degli ultimi ${pollsCount} sondaggi nazionali. Guardando solo la curva dei sondaggi, a maggio il consenso si assesterebbe intorno al ${pct(pollsAloneMay)}%. Con l'impegno attuale della rete e del Programma B.I.P., lo scenario Base indica ${pct(maggio.basePct)}% (${maggio.votesBaseHint}). Non è un destino: è lavoro politico e territoriale misurabile.`,
    ),
    cleanDraftText(
      `Sulla Manovra, sulle bollette e sulle Partite IVA chiediamo misure concrete: tutela del lavoro autonomo, taglio degli oneri energetici impropri e risposte chiare a famiglie sotto mutuo. FN porta in campo le proposte del Programma B.I.P. nei territori guida (${s.prioritaTop
        .slice(0, 3)
        .map((r) => r.regione)
        .join(", ")}): niente protesta vuota, soluzioni da rivendicare in pubblico.`,
    ),
  ];

  const forkLabel =
    forkLo != null && forkHi != null
      ? `gli istituti oscillano oggi tra il ${pct(forkLo)}% e il ${pct(forkHi)}%`
      : "forbice istituti in aggiornamento";

  const kpiExplain: [string, string, string] = [
    sanitizeDossierPublicText(
      `Consenso attuale (${pct(s.consensoOggiPct)}%): media ponderata degli ultimi ${pollsCount} sondaggi nazionali pubblicati (${forkLabel}).`,
    ),
    sanitizeDossierPublicText(
      `Tendenza soli sondaggi (${pct(pollsAloneMay)}%): dove si assesterebbe il consenso a maggio guardando solo la curva dei sondaggi, senza nuove campagne sul territorio.`,
    ),
    sanitizeDossierPublicText(
      `Scenario Base (${pct(maggio.basePct)}%) e Offensiva (${pct(maggio.offensivaPct)}%): obiettivi raggiungibili attivando la rete (${formatIntIt(s.organizzazione.tesserati)} tesserati, ${formatIntIt(s.organizzazione.comitati)} comitati, ${formatIntIt(elettiTot)} eletti) e le proposte chiave del Programma B.I.P.`,
    ),
  ];

  const shareRows = [
    ...s.prioritaTop.map((row) => ({
      regione: row.regione,
      affinita: row.affinita,
      fnPct: row.fnPct,
      tier: row.tier,
    })),
    ...(input.v4Input.regions ?? []).map((row) => ({
      regione: row.regione,
      sharePct: row.sharePct,
    })),
  ];
  const regions = buildDossierRegionPriorities(shareRows);
  const top4PriorityRegions = regions.slice(0, 4).map((row) => row.regione);

  return {
    meta: {
      generatedAtISO: new Date().toISOString(),
      computationId,
      computationRef: shortRef(computationId),
      verificationCode: code,
      startDateISO: asOfISO,
      endDateISO,
      startDateDisplay: formatDateIt(asOfISO, "long"),
      endDateDisplay: formatDateIt(endDateISO, "long"),
      exactDays: mayDef.days,
      horizonActiveLabel: s.horizonLabel,
      scenarioMode,
      textOrigin,
      textOriginPublic,
      freshnessNote: sanitizeDossierPublicText(recentVariationNote),
      votesBaseNote,
      coverage,
    },
    consenso: {
      s0Pct: s.consensoOggiPct,
      forkMinPct: forkLo,
      forkMaxPct: forkHi,
      recentVariationNote: sanitizeDossierPublicText(recentVariationNote),
      polls: pollsForTable.map((p) => {
        const iso = dayISO(p.publishedAt ?? p.fieldEnd);
        return {
          institute: pdfSafeText(p.institute),
          date: iso,
          dateDisplay: formatDateIt(iso, "short"),
          pct: p.fnPct,
          scartoLabel: scartoDallaMedia(p.fnPct, s.consensoOggiPct),
        };
      }),
      tesserati: s.organizzazione.tesserati,
      comitati: s.organizzazione.comitati,
      eletti: elettiTot,
      regionsAbove3,
      horizons,
      kpiExplain,
      pollsCount,
      movementWhy:
        input.movementWhy ??
        buildFallbackMovementWhy({
          currentPct: s.consensoOggiPct,
          history: historySeries,
          polls: allPolls,
          asOfISO,
        }),
    },
    fattori: {
      chart,
      rows: factorRows,
      totalPp,
      totalVotesHint: totalVotes,
      totalEquation,
    },
    newsBip,
    ordineOperativo: (() => {
      const regionInputs =
        input.v4Input.regions && input.v4Input.regions.length > 0
          ? input.v4Input.regions
          : staticForecastRegions(s.consensoOggiPct);
      const history = (input.v4Input.history ?? []).map((p) => ({
        isoDate: p.isoDate,
        pct: p.pct,
      }));
      const evidence = buildGrowthEvidence({
        series: seriesWithCurrentPoint(
          history.length
            ? history
            : FN_SUPERMEDIA_CONSENSO_SERIES.map((p) => ({
                isoDate: p.isoDate,
                pct: p.pct,
              })),
          s.consensoOggiPct,
        ),
        headlines: [],
      });
      const order = buildDailyOrder({
        currentPct: s.consensoOggiPct,
        previousPct: null,
        deltaPp: null,
        sourceLabel: OFFICIAL_S_SOURCE_LABEL,
        asOfIso: asOfISO,
        focusRegion: null,
        rows: regionInputs.map((r) => {
          const share = r.sharePct / 100;
          return {
            regione: r.regione,
            stima: share,
            voti_di_scenario: r.validi * share,
            iscritti: r.tesserati,
          };
        }),
        evidence,
        ...(input.consensusTarget
          ? {
              consensusTarget: {
                forecast: input.v4,
                targetPct: input.consensusTarget.targetPct,
                horizon: input.consensusTarget.horizon,
              },
            }
          : {}),
      });
      const action = recommendForecastAction(input.v4);
      const n = (v: number) => formatDecimalIt(v, 2);
      const summary = order.targetSummary;
      const bersaglio = summary
        ? [
            `Bersaglio ${n(summary.targetPct)}% a ${summary.horizonLabel}.`,
            `Stima ${n(summary.modelPct)}%.`,
            `IPOTESI ${n(summary.hypothesisPct)} punti.`,
            summary.bandNote ? `${summary.bandNote}.` : "",
            `Regime ${summary.regimeLabel}.`,
            summary.firstLeverLabel ? `Prima leva: ${summary.firstLeverLabel}.` : "",
            summary.equalFallback ? "Riparto in parti uguali." : "",
            summary.methodNote,
          ]
            .filter(Boolean)
            .join(" ")
        : "";
      return {
        region: order.stimaDove.region,
        piazza: order.stimaDove.piazza,
        problema: order.stimaDove.tema,
        misura: `${order.stimaDove.leva} (${order.bozzaCosaDire.capitolo})`,
        frase: order.bozzaCosaDire.messaggioStampa,
        fork: `Stima. A 30 giorni: inerzia ${n(action.passivoPct)}%, base ${n(action.basePct)}%, offensiva ${n(action.offensivaPct)}%. Fascia 80% ${n(action.lo10Pct)}–${n(action.hi90Pct)}%. Tetto ${n(action.hi90Pct)}%.`,
        ...(bersaglio ? { bersaglio } : {}),
        ...(input.activeRouteNote ? { routeNote: input.activeRouteNote } : {}),
      };
    })(),
    cabina: {
      regions,
      regionsSubtitle: finalizePublicProse(
        `Classifica nazionale per potenziale di bacino, stima FN locale, criticità territoriale e risposta B.I.P. Le 20 regioni sono ordinate per fascia strategica (prima le 8 Regioni Verdi, poi l'espansione, poi i presidi) e, dentro ogni fascia, per potenziale decrescente. La stima FN locale non è un sondaggio regionale separato: è la proiezione calcolata a partire dal ${pct(s.consensoOggiPct)}% nazionale in base al radicamento territoriale.`,
      ),
      tesiParagraphs,
      directives: briefing.priorita.slice(0, 4).map((p, i) => ({
        rank: p.rank,
        azione: finalizePublicProse(cleanDraftText(p.azione)),
        perche: finalizePublicProse(cleanDraftText(p.perche)),
        // Mosse 01-02: stesse top 4 della matrice regionale (Pagina 5), non tier verde hardcoded.
        regioni:
          i < 2 && top4PriorityRegions.length > 0 ? top4PriorityRegions : p.regioni,
        levaBip: finalizePublicProse(p.levaBip),
      })),
      draftComms: [
        finalizePublicProse(draftComms[0]),
        finalizePublicProse(draftComms[1]),
      ],
      draftTitles,
      reliabilityBox: finalizePublicProse(reliabilityBox),
    },
  };
}

export function formatDossierFilename(generatedAtISO: string): string {
  const d = new Date(generatedAtISO);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `Dossier_Strategico_FN_${yyyy}-${mm}-${dd}_${hh}${mi}.pdf`;
}

export { formatIntIt, pct as formatPct2 };
