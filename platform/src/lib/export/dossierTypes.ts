import type { CoverageManifest } from "@/lib/engine/coverageManifest";
import type {
  ForecastFactorId,
  ForecastHorizonKey,
  ForecastProvenance,
  ForecastScenarioId,
} from "@/lib/engine/forecastEngineV4";

export type DossierTextOrigin =
  | "Analisi AI live Anthropic"
  | "Regole deterministiche di modello";

export type DossierNewsBipCard = {
  fronteLabel: string;
  notiziaTitolo: string;
  testata: string;
  dataPubblicazione: string;
  rischioOpportunitaConsenso: string;
  codiceBip: string;
  titoloBip: string;
  azioneRimedioBip: string;
  regioniTarget: string[];
  origin: DossierTextOrigin;
};

export type DossierFactorRow = {
  id: ForecastFactorId;
  label: string;
  short: string;
  plain: string;
  nature: "Dato osservato" | "Dato + Ipotesi" | "Ipotesi" | "Regola di prudenza";
  explanation: string;
  votesHint: string;
  pp30: number;
  pp90: number;
  pp180: number;
};

export type DossierRegionRow = {
  regione: string;
  affinity: number;
  sharePct: number;
  emergency: string;
  levaBip: string;
  /** Fascia operativa: priorità alta, espansione o presidio. */
  roleLabel: string;
  shareNote?: string;
  score?: number;
};

/** Alias usato da dossierRegionalPriority. */
export type DossierRegionPriority = DossierRegionRow;

export type DossierHorizonRow = {
  horizonKey: ForecastHorizonKey;
  horizonLabel: string;
  days: number;
  pollsAlonePct: number;
  passivoPct: number;
  basePct: number;
  offensivaPct: number;
  deltaBaseVsOggiPp: number;
  deltaBaseVsPollsPp: number;
  deltaOffVsOggiPp: number;
  votesBaseHint: string;
  votesOffHint: string;
  growthBaseLabel: string;
};

export type DossierPollRow = {
  institute: string;
  date: string;
  dateDisplay: string;
  pct: number;
  scartoLabel: string;
};

/** Blocco obbligatorio: perché il consenso è salito / sceso / stabile. */
export type DossierMovementWhy = {
  headline: string;
  pct: number;
  previousPct: number | null;
  previousIsoDate: string | null;
  deltaPp: number | null;
  supermediaPct: number | null;
  gapPp: number | null;
  /** Retrocompat: testo completo (plainWhy + note). */
  paragraph: string;
  /** Spiegazione discorsiva in italiano semplice (stesso concetto del popup). */
  plainWhy: string;
  /** Fatti/uscite verificate: badge testata·data + sintesi pulita. */
  factsBullets: Array<{ badge: string; text: string }>;
  /** Nota semplice sulla differenza tra sondaggisti. */
  pollstersNote: string;
  /** Indicazione operativa Team FN. */
  teamAction: string;
  disclaimer: string;
  sources: Array<{ label: string; url?: string }>;
  polls: Array<{ institute: string; dateDisplay: string; pct: number }>;
};

export type StrategicDossierPayload = {
  meta: {
    generatedAtISO: string;
    computationId: string;
    computationRef: string;
    verificationCode: string;
    startDateISO: string;
    endDateISO: string;
    startDateDisplay: string;
    endDateDisplay: string;
    exactDays: number;
    horizonActiveLabel: string;
    scenarioMode: ForecastScenarioId;
    textOrigin: DossierTextOrigin;
    textOriginPublic: string;
    freshnessNote: string;
    votesBaseNote: string;
    coverage: CoverageManifest;
  };
  consenso: {
    s0Pct: number;
    forkMinPct: number | null;
    forkMaxPct: number | null;
    recentVariationNote: string;
    polls: DossierPollRow[];
    tesserati: number;
    comitati: number;
    eletti: number;
    regionsAbove3: number;
    horizons: DossierHorizonRow[];
    kpiExplain: [string, string, string];
    pollsCount: number;
    /** Spiegazione obbligatoria del movimento di consenso (popup «i»). */
    movementWhy: DossierMovementWhy;
  };
  fattori: {
    chart: Array<{
      day: number;
      label: string;
      isoDate: string;
      isToday: boolean;
      pollsAlone: number | null;
      base: number | null;
      offensiva: number | null;
    }>;
    rows: DossierFactorRow[];
    totalPp: number;
    totalVotesHint: string;
    totalEquation: string;
  };
  newsBip: DossierNewsBipCard[];
  /** Stessa mossa di dailyOrderEngine (ordine operativo nel dossier). */
  ordineOperativo: {
    region: string;
    piazza: string;
    problema: string;
    misura: string;
    frase: string;
    fork: string;
    /** Presente solo se l'export ha ricevuto un bersaglio confermato. */
    bersaglio?: string;
    /** Presente solo se l'export riceve una rotta operativa attiva. */
    routeNote?: string;
  };
  cabina: {
    regions: DossierRegionRow[];
    regionsSubtitle: string;
    tesiParagraphs: [string, string, string];
    directives: Array<{
      rank: number;
      azione: string;
      perche: string;
      regioni: string[];
      levaBip: string;
    }>;
    draftComms: [string, string];
    draftTitles: [string, string];
    reliabilityBox: string;
  };
};

export function provenanceBadge(
  p: ForecastProvenance,
): DossierFactorRow["nature"] {
  if (p === "dati") return "Dato osservato";
  if (p === "misto") return "Dato + Ipotesi";
  if (p === "ipotesi") return "Ipotesi";
  return "Regola di prudenza";
}
