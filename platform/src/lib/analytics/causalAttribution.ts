export interface PollObservationInput {
  date: string; // YYYY-MM-DD
  institute: string;
  value: number; // es. 7.4
  sampleSize?: number;
}

export interface MediaSalienceInput {
  securityAndImmigration: number; // 0..100 pressione mediatica sul tema
  costOfLivingAndTaxes: number; // 0..100
  greenDealAndEU: number; // 0..100
  coalitionInternalNoise: number; // 0..100 (litigi tecnici di palazzo che oscurano i temi reali)
}

export interface TerritorialActivityInput {
  newCommitteesLast30d: number;
  newMembersGrowthPct: number;
  localDefectionsCount: number; // ingressi consiglieri/sindaci/parlamentari
  vannacciMediaSpikes: number; // 0..10 intensità ospitate TV / picchi Google Trends
}

export interface CausalDriverDetail {
  id: string;
  label: string;
  deltaContribution: number; // in punti percentuali, es. +0.22 o -0.15
  direction: "positivo" | "negativo" | "neutro";
  confidence: "alta" | "media" | "bassa";
  whyExplanation: string; // Spiegazione dettagliata del PERCHÉ
  technicalActionForTeam: string; // Cosa deve fare il team tecnico FN
}

export interface ConsensusCausalReport {
  currentConsensus: number;
  previous7dConsensus: number;
  previous30dConsensus: number;
  delta7d: number;
  delta30d: number;
  realNetDelta30d: number; // Delta depurato dall'house effect dei sondaggisti
  houseEffectBias: number; // Distorsione dovuta agli istituti usciti nell'ultima settimana
  headlineVerdict: string; // Sintesi esecutiva in 2 righe per Vannacci
  deepNarrativeWhy: string; // Spiegazione estesa del perché siamo saliti o scesi
  drivers: CausalDriverDetail[];
  competitorFlowsSummary: {
    fromFdI: number;
    fromLega: number;
    fromAbstention: number;
    fromOthers: number;
    explanation: string;
  };
}

const INSTITUTE_HOUSE_EFFECTS: Record<string, number> = {
  SWG: 0.15,
  YouTrend: 0.0,
  Supermedia: 0.0,
  Ipsos: -0.2,
  Quorum: -0.1,
  Tecne: -0.15,
  Tecnè: -0.15,
  EMG: 0.1,
  Euromedia: 0.05,
  Ixè: -0.25,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildConsensusCausalReport(params: {
  currentConsensus: number;
  previous7dConsensus: number;
  previous30dConsensus: number;
  recentPolls?: PollObservationInput[];
  media?: MediaSalienceInput;
  territory?: TerritorialActivityInput;
}): ConsensusCausalReport {
  const {
    currentConsensus,
    previous7dConsensus,
    previous30dConsensus,
    recentPolls = [],
    media = {
      securityAndImmigration: 68,
      costOfLivingAndTaxes: 74,
      greenDealAndEU: 55,
      coalitionInternalNoise: 42,
    },
    territory = {
      newCommitteesLast30d: 14,
      newMembersGrowthPct: 6.5,
      localDefectionsCount: 3,
      vannacciMediaSpikes: 7,
    },
  } = params;

  const delta7d = round2(currentConsensus - previous7dConsensus);
  const delta30d = round2(currentConsensus - previous30dConsensus);

  // 1. Calcolo House Effect sugli ultimi sondaggi
  let houseEffectBias = 0;
  if (recentPolls.length > 0) {
    const biases = recentPolls.map((p) => {
      const matchedKey = Object.keys(INSTITUTE_HOUSE_EFFECTS).find((k) =>
        p.institute.toLowerCase().includes(k.toLowerCase()),
      );
      return matchedKey ? (INSTITUTE_HOUSE_EFFECTS[matchedKey] ?? 0) : 0;
    });
    houseEffectBias = round2(biases.reduce((a, b) => a + b, 0) / biases.length);
  }
  const realNetDelta30d = round2(delta30d - houseEffectBias);

  // 2. Scomposizione dei fattori causali sui 30 giorni
  const mediaProprietaryScore =
    media.securityAndImmigration * 0.45 +
    media.costOfLivingAndTaxes * 0.35 +
    media.greenDealAndEU * 0.2 -
    media.coalitionInternalNoise * 0.35;

  const agendaRawImpact = round2(((mediaProprietaryScore - 48) / 100) * 0.55);
  const territoryRawImpact = round2(
    Math.min(
      0.45,
      territory.newCommitteesLast30d * 0.012 +
        territory.localDefectionsCount * 0.045 +
        (territory.newMembersGrowthPct / 100) * 0.8,
    ),
  );
  const mediaVisibilityImpact = round2(
    ((territory.vannacciMediaSpikes - 5) / 10) * 0.35,
  );

  // Residuo attribuito alla dinamica competitiva (flussi da CDX e astensione)
  const explainedSoFar =
    agendaRawImpact +
    territoryRawImpact +
    mediaVisibilityImpact +
    houseEffectBias;
  const competitorFlowImpact = round2(delta30d - explainedSoFar);

  const drivers: CausalDriverDetail[] = [
    {
      id: "agenda-salience",
      label: "Agenda Mediatica e Temi Proprietari",
      deltaContribution: agendaRawImpact,
      direction:
        agendaRawImpact > 0.02
          ? "positivo"
          : agendaRawImpact < -0.02
            ? "negativo"
            : "neutro",
      confidence: "alta",
      whyExplanation:
        agendaRawImpact >= 0
          ? `La pressione mediatica su sicurezza/immigrazione (${media.securityAndImmigration}/100) e caro-vita/fisco (${media.costOfLivingAndTaxes}/100) ha tenuto il dibattito pubblico sul terreno naturale di FN, spostando elettori in cerca di risposte nette.`
          : `Il dibattito pubblico è stato monopolizzato da tatticismi di palazzo (${media.coalitionInternalNoise}/100) comprimendo lo spazio mediatico sui temi identitari e sociali di FN.`,
      technicalActionForTeam:
        agendaRawImpact >= 0
          ? "Raddoppiare i dossier numerici su reati nelle stazioni, liste d'attesa e potere d'acquisto per consolidare la leadership tematica."
          : "Rompere l'agenda di palazzo lanciando entro 48 ore un caso-simbolo concreto su sicurezza urbana o bollette/imprese.",
    },
    {
      id: "competitor-flows",
      label: "Flussi Elettorali (Delusi CDX + Astensione)",
      deltaContribution: competitorFlowImpact,
      direction:
        competitorFlowImpact > 0.02
          ? "positivo"
          : competitorFlowImpact < -0.02
            ? "negativo"
            : "neutro",
      confidence: "media",
      whyExplanation:
        competitorFlowImpact >= 0
          ? `Logoramento dei partiti di governo tra promesse elettorali e realtà quotidiana (pressione fiscale, sicurezza reale, vincoli UE): FN intercetta sia elettori delusi di FdI/Lega sia astenuti che tornano al voto.`
          : `Fisiologico rientro tattico di una quota di elettorato conservatore verso i partiti di maggioranza per effetto polarizzazione governo/opposizione.`,
      technicalActionForTeam:
        competitorFlowImpact >= 0
          ? "Presidiare i ceti produttivi (partite IVA, artigiani, agricoltori, forze dell'ordine) con proposte emendative concrete."
          : "Evitare polemiche politiciste; attaccare esclusivamente sui problemi irrisolti dei cittadini mostrando il rimedio tecnico FN.",
    },
    {
      id: "territorial-ground",
      label: "Radicamento Territoriale e Ingressi Locali",
      deltaContribution: territoryRawImpact,
      direction: territoryRawImpact > 0.02 ? "positivo" : "neutro",
      confidence: "alta",
      whyExplanation: `L'apertura di ${territory.newCommitteesLast30d} nuovi presidi territoriali, la crescita tesserati (+${territory.newMembersGrowthPct}%) e ${territory.localDefectionsCount} nuovi ingressi istituzionali hanno consolidato una base strutturale che non dipende dalla sola esposizione TV.`,
      technicalActionForTeam:
        "Trasformare ogni nuovo comitato in uno sportello di ascolto dei disagi regionali (sanità, degrado, crisi aziendali) per radicare il voto.",
    },
    {
      id: "leader-visibility",
      label: "Spinta Comunicativa Vannacci (TV & Social)",
      deltaContribution: mediaVisibilityImpact,
      direction:
        mediaVisibilityImpact > 0.02
          ? "positivo"
          : mediaVisibilityImpact < -0.02
            ? "negativo"
            : "neutro",
      confidence: "alta",
      whyExplanation:
        mediaVisibilityImpact >= 0
          ? `Indice di penetrazione mediatica ${territory.vannacciMediaSpikes}/10: gli interventi diretti hanno generato picchi di ricerca organica e condivisione sui social.`
          : `Minore frequenza di passaggi televisivi nazionali ad alto ascolto rispetto alla media del mese precedente (indice ${territory.vannacciMediaSpikes}/10).`,
      technicalActionForTeam:
        "Preparare clip verticali da 45 secondi con dati ufficiali sovraimpressi estratti da ogni intervento televisivo.",
    },
    {
      id: "house-effect",
      label: "Correzione Statistica Sondaggisti (House Effect)",
      deltaContribution: houseEffectBias,
      direction:
        houseEffectBias > 0.03
          ? "positivo"
          : houseEffectBias < -0.03
            ? "negativo"
            : "neutro",
      confidence: "alta",
      whyExplanation:
        Math.abs(houseEffectBias) <= 0.03
          ? "Il campione degli istituti pubblicati è bilanciato: il dato rilevato riflette fedelmente il consenso reale."
          : houseEffectBias < 0
            ? `Attenzione: ${Math.abs(houseEffectBias)}% del calo apparente NON è perdita di voti reali, ma dipende dalla pubblicazione di istituti storicamente sottostimanti verso FN.`
            : `Una frazione (+${houseEffectBias}%) della variazione dipende da istituti tradizionalmente più generosi nella stima del voto d'opinione.`,
      technicalActionForTeam:
        "Valutare sempre la tendenza sul dato depurato (Real Net Delta) a 30 giorni ed evitare cambi di linea per oscillazioni statistiche di ±0,2%.",
    },
  ];

  // Stima ripartizione flussi
  const positiveBase = Math.max(0.1, currentConsensus - 6.0);
  const fromFdI = round2(positiveBase * 0.36);
  const fromLega = round2(positiveBase * 0.29);
  const fromAbstention = round2(positiveBase * 0.25);
  const fromOthers = round2(positiveBase * 0.1);

  const trendWord =
    realNetDelta30d > 0.1
      ? "IN CRESCITA REALE"
      : realNetDelta30d < -0.1
        ? "IN RALLENTAMENTO"
        : "IN CONSOLIDAMENTO STABILE";

  const headlineVerdict = `Consenso attuale al ${currentConsensus.toFixed(1)}% (${delta30d >= 0 ? "+" : ""}${delta30d.toFixed(2)}% a 30gg; variazione reale netta ${realNetDelta30d >= 0 ? "+" : ""}${realNetDelta30d.toFixed(2)}%) — Stato: ${trendWord}.`;

  const deepNarrativeWhy =
    realNetDelta30d >= 0
      ? `Il movimento registra un saldo netto positivo su base mensile (${realNetDelta30d >= 0 ? "+" : ""}${realNetDelta30d.toFixed(2)}% depurato dalle distorsioni degli istituti). La crescita è trainata dalla salienza dei dossier sicurezza e costo della vita (+${Math.max(0, agendaRawImpact).toFixed(2)}%) combinata con il radicamento organizzativo (+${territoryRawImpact.toFixed(2)}%). Gli elettori premiamo la chiarezza identitaria laddove percepiscono esitazione o compromesso nei partiti tradizionali.`
      : `Si registra una flessione netta di ${realNetDelta30d.toFixed(2)}% su base mensile (dato grezzo ${delta30d.toFixed(2)}%, house effect ${houseEffectBias.toFixed(2)}%). La causa principale non è il rigetto delle proposte FN, ma lo spostamento temporaneo dell'agenda mediatica su temi tecnici di coalizione e una minore pressione sui dossier proprietari. Riportando il focus su sanità regionale, sicurezza urbana e tutela del ceto medio il differenziale è integralmente recuperabile entro 30 giorni.`;

  return {
    currentConsensus,
    previous7dConsensus,
    previous30dConsensus,
    delta7d,
    delta30d,
    realNetDelta30d,
    houseEffectBias,
    headlineVerdict,
    deepNarrativeWhy,
    drivers,
    competitorFlowsSummary: {
      fromFdI,
      fromLega,
      fromAbstention,
      fromOthers,
      explanation: `Dei punti sopra la soglia strutturale del 6,0%, circa il 36% proviene da elettori delusi di FdI su sicurezza/fisco, il 29% da elettorato storico Lega in cerca di coerenza, il 25% dal recupero dell'astensione popolare e il 10% da altri schieramenti.`,
    },
  };
}
