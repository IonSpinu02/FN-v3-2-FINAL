export type ForecastHorizonDays = 30 | 90 | 180;
export type StrategicRegime = "passivo" | "base" | "offensiva";

export interface ScheduledPoliticalEvent {
  id: string;
  title: string;
  expectedWindowDays: ForecastHorizonDays; // Entro quale finestra cade (30, 90 o 180gg)
  dateLabel: string; // es. "Dicembre 2026" o "Entro 30 giorni"
  category: "economico_sociale" | "politico_ue" | "sicurezza_flussi" | "azione_fn";
  probability: number; // 0..1 (es. 0.85)
  baseImpactPct: number; // Impatto potenziale se presidiato, es. +0.35 o -0.15
  whyItMatters: string; // Perché sposta i voti degli italiani
  howFnMustAct: string; // Come il team e Vannacci devono agire sull'evento
}

export interface HorizonBreakdown {
  horizonDays: ForecastHorizonDays;
  targetDateISO: string;
  targetDateFormatted: string;
  regimes: {
    passivo: number; // Se FN resta ferma / subisce l'agenda altrui
    base: number; // Traiettoria attuale a regime costante
    offensiva: number; // Se il team esegue il piano sui temi ed eventi
  };
  confidenceInterval80: [number, number]; // Forchetta 80% attorno allo scenario Base
  stepByStepFactors: {
    pollMomentum: number;
    scheduledEventsImpact: number;
    territorialGrowthImpact: number;
    governmentWearImpact: number;
    ceilingDamping: number;
  };
  relevantEvents: ScheduledPoliticalEvent[];
  detailedWhyAndHow: string; // Spiegazione nei minimi dettagli del perché e per come
}

export interface FullForecast180Report {
  generatedAtISO: string;
  currentBaseline: number;
  horizons: {
    d30: HorizonBreakdown;
    d90: HorizonBreakdown;
    d180: HorizonBreakdown;
  };
  allEvents: ScheduledPoliticalEvent[];
  strategicExecutiveSummary: string;
}

export const DEFAULT_UPCOMING_EVENTS_180D: ScheduledPoliticalEvent[] = [
  {
    id: "evt-manovra-fisco-30",
    title:
      "Voto finale Legge di Bilancio, conguagli fiscali e caro-bollette invernale",
    expectedWindowDays: 30,
    dateLabel: "Entro 30 giorni",
    category: "economico_sociale",
    probability: 0.95,
    baseImpactPct: 0.25,
    whyItMatters:
      "Famiglie e partite IVA verificano nel concreto il divario tra annunci fiscali e impatto reale su buste paga, pensioni e costi energetici invernali.",
    howFnMustAct:
      "Pubblicare tabelle verità comprensibili a tutti sul potere d'acquisto reale e rilanciare le misure B.I.P. su taglio sprechi e tutela del ceto medio produttivo.",
  },
  {
    id: "evt-sicurezza-citta-30",
    title:
      "Picco microcriminalità urbana, stazioni e periferie nei grandi capoluoghi",
    expectedWindowDays: 30,
    dateLabel: "Entro 30 giorni",
    category: "sicurezza_flussi",
    probability: 0.85,
    baseImpactPct: 0.2,
    whyItMatters:
      "L'insicurezza percepita e reale dei pendolari e dei commercianti è il primo fattore di rottura fiduciaria verso chi governa città e ministeri.",
    howFnMustAct:
      "Sopralluoghi mirati nelle zone rosse urbane con sindacati autonomi di polizia e proposta operativa immediata su certezza della pena ed espulsioni effettive.",
  },
  {
    id: "evt-scadenze-imprese-sanita-90",
    title:
      "Scadenze fiscali primo trimestre, crisi manifattura/automotive e nodi liste d'attesa regionali",
    expectedWindowDays: 90,
    dateLabel: "Tra 31 e 90 giorni",
    category: "economico_sociale",
    probability: 0.88,
    baseImpactPct: 0.35,
    whyItMatters:
      "Cassa integrazione nei distretti industriali del Nord/Centro e tempi biblici della sanità regionale creano un bacino enorme di cittadini esasperati.",
    howFnMustAct:
      "Incontrare categorie produttive e comitati malati regione per regione; attaccare i costi delle direttive Green UE sull'industria italiana.",
  },
  {
    id: "evt-radicamento-fn-90",
    title:
      "Nuova ondata apertura circoli FN e transito amministratori locali delusi",
    expectedWindowDays: 90,
    dateLabel: "Tra 31 e 90 giorni",
    category: "azione_fn",
    probability: 0.8,
    baseImpactPct: 0.25,
    whyItMatters:
      "Gli amministratori locali portano voti strutturati sul territorio e legittimano FN come forza pronta a governare comuni e regioni.",
    howFnMustAct:
      "Selezionare profili integri e radicati nelle province ad alta affinità (Veneto, Lombardia, Piemonte, Puglia, Lazio, Toscana) evitando riciclati impopolari.",
  },
  {
    id: "evt-primavera-amministrative-sbarchi-180",
    title:
      "Ripresa stagionale flussi migratori mediterranei + Campagna Amministrative e dossier UE",
    expectedWindowDays: 180,
    dateLabel: "Tra 91 e 180 giorni",
    category: "politico_ue",
    probability: 0.85,
    baseImpactPct: 0.45,
    whyItMatters:
      "Con il miglioramento meteo ripartono gli sbarchi e si apre la finestra elettorale locale: i temi identitari, confini e sovranità economica tornano in cima al TG.",
    howFnMustAct:
      "Lanciare la mobilitazione nazionale di primavera con Vannacci nelle piazze chiave, saldando difesa dei confini, sicurezza sociale e difesa del lavoro italiano.",
  },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addDays(
  baseDate: Date,
  days: number,
): { iso: string; formatted: string } {
  const d = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  const iso = d.toISOString().slice(0, 10);
  const formatted = d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return { iso, formatted };
}

export function generateStrategicForecast180(params: {
  currentConsensus: number;
  monthlyMomentum?: number; // es. +0.20 o -0.10
  activeCommitteesCount?: number;
  customEvents?: ScheduledPoliticalEvent[];
  referenceDate?: Date;
}): FullForecast180Report {
  const {
    currentConsensus,
    monthlyMomentum = 0.18,
    activeCommitteesCount = 120,
    customEvents,
    referenceDate = new Date(),
  } = params;

  const events =
    customEvents && customEvents.length > 0
      ? customEvents
      : DEFAULT_UPCOMING_EVENTS_180D;

  const computeHorizon = (horizonDays: ForecastHorizonDays): HorizonBreakdown => {
    const { iso, formatted } = addDays(referenceDate, horizonDays);
    const monthsScale = horizonDays / 30;

    // Eventi cumulati fino a quell'orizzonte
    const cumulativeEvents = events.filter(
      (e) => e.expectedWindowDays <= horizonDays,
    );
    const windowSpecificEvents = events.filter(
      (e) => e.expectedWindowDays === horizonDays,
    );

    // 1. Inerzia sondaggi smorzata nel tempo (evita estrapolazioni lineari irrealistiche)
    const pollMomentum = round2(monthlyMomentum * Math.sqrt(monthsScale) * 0.75);

    // 2. Impatto ponderato per probabilità degli eventi futuri (scenario Base = presidio al 65% dell'efficacia massima)
    const rawEventsExpected = cumulativeEvents.reduce(
      (acc, ev) => acc + ev.baseImpactPct * ev.probability,
      0,
    );
    const scheduledEventsImpact = round2(rawEventsExpected * 0.65);

    // 3. Crescita organizzativa sul campo (circoli + tesseramento)
    const territorialGrowthImpact = round2(
      Math.min(
        0.65,
        (activeCommitteesCount / 100) * 0.09 * Math.sqrt(monthsScale),
      ),
    );

    // 4. Logoramento fisiologico partiti di governo su economia/sicurezza
    const governmentWearImpact = round2(0.08 * Math.sqrt(monthsScale));

    // 5. Fattore di smorzamento/tetto (più si sale sopra il 9-10%, più cresce la resistenza dei competitor)
    const rawProjected =
      currentConsensus +
      pollMomentum +
      scheduledEventsImpact +
      territorialGrowthImpact +
      governmentWearImpact;
    const excessOver9 = Math.max(0, rawProjected - 9.0);
    const ceilingDamping = round2(-excessOver9 * 0.22);

    const baseVal = round2(Math.max(4.5, rawProjected + ceilingDamping));

    // Regime Passivo: se FN non presidia gli eventi e lascia spazio mediatico agli altri
    const passivoVal = round2(
      Math.max(
        4.0,
        currentConsensus +
          pollMomentum * 0.3 -
          0.12 * Math.sqrt(monthsScale) +
          governmentWearImpact * 0.4,
      ),
    );

    // Regime Offensiva: esecuzione al 100% del piano eventi + tour territoriale Vannacci
    const offensivaVal = round2(
      Math.min(
        14.5,
        baseVal + rawEventsExpected * 0.35 + 0.15 * Math.sqrt(monthsScale),
      ),
    );

    // Cono d'incertezza all'80% crescente col tempo (radice quadrata dei giorni)
    const halfWidth = round2(0.35 + 0.22 * Math.sqrt(monthsScale));
    const confidenceInterval80: [number, number] = [
      round2(Math.max(3.5, baseVal - halfWidth)),
      round2(baseVal + halfWidth),
    ];

    const netDeltaBase = round2(baseVal - currentConsensus);
    const eventTitles = cumulativeEvents.map((e) => `«${e.title}»`).join(", ");

    const detailedWhyAndHow =
      `A +${horizonDays} giorni (${formatted}) il consenso nello scenario Base è stimato al ${baseVal.toFixed(2)}% ` +
      `(${netDeltaBase >= 0 ? "+" : ""}${netDeltaBase.toFixed(2)}% rispetto al ${currentConsensus.toFixed(2)}% attuale; forchetta probabile 80%: ${confidenceInterval80[0].toFixed(1)}%–${confidenceInterval80[1].toFixed(1)}%). ` +
      `PERCHÉ: la variazione nasce dalla somma di inerzia attuale (${pollMomentum >= 0 ? "+" : ""}${pollMomentum.toFixed(2)}%), ` +
      `impatto ponderato degli eventi in calendario (+${scheduledEventsImpact.toFixed(2)}% da ${eventTitles}), ` +
      `lavoro organizzativo dei comitati sul territorio (+${territorialGrowthImpact.toFixed(2)}%) e logoramento fisiologico governativo (+${governmentWearImpact.toFixed(2)}%)` +
      `${ceilingDamping < 0 ? `, frenato da un effetto resistenza competitor di ${ceilingDamping.toFixed(2)}%` : ""}. ` +
      `PER COME: se il movimento resta passivo rischia di fermarsi al ${passivoVal.toFixed(2)}%; se invece il team anticipa gli eventi con proposte tecniche B.I.P. e presenza sul territorio (Regime Offensiva), il potenziale sale fino al ${offensivaVal.toFixed(2)}%.`;

    return {
      horizonDays,
      targetDateISO: iso,
      targetDateFormatted: formatted,
      regimes: {
        passivo: passivoVal,
        base: baseVal,
        offensiva: offensivaVal,
      },
      confidenceInterval80,
      stepByStepFactors: {
        pollMomentum,
        scheduledEventsImpact,
        territorialGrowthImpact,
        governmentWearImpact,
        ceilingDamping,
      },
      relevantEvents:
        windowSpecificEvents.length > 0
          ? windowSpecificEvents
          : cumulativeEvents,
      detailedWhyAndHow,
    };
  };

  const d30 = computeHorizon(30);
  const d90 = computeHorizon(90);
  const d180 = computeHorizon(180);

  const strategicExecutiveSummary =
    `Partendo dal ${currentConsensus.toFixed(1)}% odierno, la traiettoria Base proietta Futuro Nazionale al ${d30.regimes.base.toFixed(1)}% a 30 giorni, ` +
    `al ${d90.regimes.base.toFixed(1)}% a 90 giorni e al ${d180.regimes.base.toFixed(1)}% a 180 giorni (fino al ${d180.regimes.offensiva.toFixed(1)}% in assetto Offensiva). ` +
    `La partita nei prossimi 6 mesi si decide sulla capacità di saldare la protesta sociale (sanità, bollette, stipendi, sicurezza) con soluzioni di governo credibili prima delle scadenze primaverili.`;

  return {
    generatedAtISO: referenceDate.toISOString(),
    currentBaseline: currentConsensus,
    horizons: { d30, d90, d180 },
    allEvents: events,
    strategicExecutiveSummary,
  };
}
