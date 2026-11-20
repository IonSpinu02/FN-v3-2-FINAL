import type { Region } from "@/lib/engine/constants";
import type { RegionPlan } from "@/lib/engine/strategicBackcastEngine";
import type {
  AmbitionProfile,
  RoadmapLane,
  RoadmapPlace,
  RoadmapPlaceKind,
} from "@/lib/engine/operationalRoadmapBuilder";
import {
  painsForStageRegions,
  type PoliticalInterferenceContext,
  type SocialPainSignal,
} from "@/lib/engine/politicalInterferenceContext";

export type StrategicRationale = {
  whyNow: string;
  voterPsychologyMechanism: string;
  structuralObjective: string;
};

export type DetailedMove = {
  lane: RoadmapLane;
  headline: string;
  whatToDo: string;
  whyItWorks: string;
  expectedFriction: string;
};

export type InterferenceMatrix = {
  socialDiscontentVector: string;
  otherPartiesMoves: string;
  eventsAndProtests: string;
  internationalAndEuFactor: string;
  contingencyPlaybook: string;
};

function listNames(rows: RegionPlan[]): string {
  const names = rows.map((row) => row.region);
  if (names.length === 0) return "i bacini prioritari";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

function voterArchetype(rows: RegionPlan[], stageId: 1 | 2 | 3 | 4): string {
  const macros = new Set(rows.map((row) => row.macroArea));
  if (stageId === 3 || macros.has("Sud") || macros.has("Isole")) {
    return "l'ex elettore astenuto del Sud e delle aree interne, stanco di promesse senza presenza fisica";
  }
  if (stageId === 4) {
    return "il lavoratore pendolare e il nucleo urbano incerto, che decide all'ultimo se la scheda merita lo spostamento";
  }
  if (macros.has("Nord-Est") || macros.has("Nord-Ovest")) {
    return "il piccolo imprenditore e la partita IVA del Nord produttivo, delusi dalla coalizione ma terrorizzati dal 'voto inutile'";
  }
  return "l'elettore di opinione del Centro, sensibile a sanità, casa e ordine quotidiano";
}

export function buildStrategicRationale(input: {
  stageId: 1 | 2 | 3 | 4;
  profile: AmbitionProfile;
  rows: RegionPlan[];
  theme: string;
  fromDay: number;
  toDay: number;
  gapPp: number;
  committees: number;
  officials: number;
}): StrategicRationale {
  const names = listNames(input.rows);
  const gap = input.gapPp.toFixed(1).replace(".", ",");
  const window = `giorni ${input.fromDay}–${input.toDay}`;
  const archetype = voterArchetype(input.rows, input.stageId);

  const whyNow =
    input.stageId === 1
      ? `In questa prima finestra (${window}) va fissata l'identità del piano su ${input.theme} prima che i competitor saturino lo stesso spazio emotivo: chi arriva secondo sulla rabbia reale perde il diritto di rappresentarla. IPOTESI.`
      : input.stageId === 2
        ? `Tra ${window} la notorietà va trasformata in interlocuzione di categoria e presenza locale su ${names}: senza questo passaggio il consenso resta televisivo e non diventa scheda. IPOTESI.`
        : input.stageId === 3
          ? `Nella fascia ${window} si aprono i bacini ad alta astensione e i nodi civici: ritardare significa lasciare piazze e proteste in mano ad altri attori. IPOTESI.`
          : `Nella chiusura (${window}) ogni giorno perso sulla macchina d'urna brucia i punti guadagnati: l'elettore indeciso decide tardi e solo se trova un garante locale. IPOTESI.`;

  const voterPsychologyMechanism = `Il passaggio da simpatia passiva a voto reale avviene quando ${archetype} riconosce in Vannacci non uno slogan, ma una risposta concreta a un disagio vissuto ogni giorno (su ${input.theme}) e un volto locale che riduce il costo psicologico del 'rischio' di votare fuori dal voto utile. IPOTESI.`;

  const structuralObjective =
    input.profile === "PRESIDIO"
      ? `Sbloccare il collo di bottiglia della densità: ${input.committees} punti di presenza e ${input.officials} amministratori nei distretti già caldi di ${names}, senza disperdere energie. IPOTESI.`
      : input.profile === "SHOCK"
        ? `Preparare una macchina capace di convertire un picco esterno in rete: audience volatile → delegati di distretto, comitati e gruppi consiliari su ${names} (+${gap} pp). IPOTESI.`
        : `Trasformare l'attenzione mediatica su ${input.theme} in struttura territoriale: ${input.committees} aperture e ${input.officials} innesti istituzionali su ${names}. IPOTESI.`;

  return { whyNow, voterPsychologyMechanism, structuralObjective };
}

export function buildDetailedMoves(input: {
  stageId: 1 | 2 | 3 | 4;
  profile: AmbitionProfile;
  rows: RegionPlan[];
  themes: readonly [string, string, string];
  numbers: { committees: number; members: number; officials: number; officialsTotal: number };
  pains: SocialPainSignal[];
}): readonly [DetailedMove, DetailedMove, DetailedMove] {
  const names = listNames(input.rows);
  const [theme, second, third] = input.themes;
  const pain = input.pains[0];
  const painHint = pain
    ? `${pain.label.toLowerCase()} (${pain.indicatorLine})`
    : `il disagio prioritario su ${theme}`;
  const { committees, officials, officialsTotal } = input.numbers;

  const aria: DetailedMove = {
    lane: "Aria",
    headline:
      input.stageId === 1
        ? `Dossier ariete su ${theme}`
        : input.stageId === 4
          ? `Chiusura narrativa su ${theme}`
          : `Campagna di penetrazione su ${second}`,
    whatToDo:
      input.stageId === 1
        ? `Pubblicare un dossier documentato su ${theme} con conferenze stampa nei punti di crisi di ${names}; briefing settimanali alle testate locali e tre clip verticali di denuncia-proposta per saturare il dibattito prima dei competitor.`
        : input.stageId === 2
          ? `Attivare dossier di settore su ${second} e ${third} in ${names}: format 'problema misurato → proposta operativa', senza allargare a temi non priorizzati dal piano.`
          : input.stageId === 3
            ? `Portare al centro ${second === "Liste d'attesa Sanità" ? "l'emergenza liste d'attesa" : second} con presidi mediatici davanti a ospedali, CUP e snodi di ${names}.`
            : `Campagna di chiusura su ${theme} nei bacini di ${names}: richiamo ai tesserati, testimonial locali e messaggi di garanzia anti-'voto inutile'.`,
    whyItWorks: `Sposta voti perché collega ${theme} a ${painHint}: l'elettore smette di vedere FN come forza astratta e inizia a credere che qualcuno abbia mappato il suo problema concreto. IPOTESI.`,
    expectedFriction: `Le testate coalizionali e l'opposizione tenteranno di etichettare il messaggio come estremista o 'voto dispersivo'. Superamento: tono istituzionale, dati territoriali e confronti con amministratori locali già presenti, mai sola polemica. IPOTESI.`,
  };

  const terra: DetailedMove = {
    lane: "Terra",
    headline:
      input.stageId === 4
        ? "Macchina d'urna e gazebo"
        : input.profile === "PRESIDIO"
          ? "Densificazione dei presidi esistenti"
          : `Apertura di ${committees} punti territoriali`,
    whatToDo:
      input.stageId === 1
        ? `Aprire ${committees} coordinamenti provinciali e banchetti fissi nei capoluoghi di ${names}, con cadenza settimanale di ascolto categorie (PMI, pendolari, famiglie) e raccolta firme tematiche su ${theme}.`
        : input.stageId === 2
          ? `Aprire ${committees} nuovi comitati e tavoli con artigiani, partite IVA e associazioni di categoria solo dove il piano ha già assegnato potenziale di voto in ${names}.`
          : input.stageId === 3
            ? `Aprire ${committees} comitati nelle aree ad alta astensione e campagne porta a porta nei quartieri periferici di ${names}, con materiale che parla di ${painHint}.`
            : `Gazebo in ogni municipio chiave, ${committees} comitati di quartiere e rete completa dei rappresentanti di lista: turni di presenza fino al giorno del voto.`,
    whyItWorks: `La conversione avviene per prossimità: chi tocca con mano un banchetto e un referente locale riduce l'ansia del voto 'controcorrente' e trasforma la rabbia su ${theme} in appartenenza. IPOTESI.`,
    expectedFriction: `Carenza di quadri intermedi e resistenza dei circuiti coalizionali locali. Superamento: reclutare delegati di distretto dai tavoli di categoria e dare loro autonomia operativa entro tre settimane. IPOTESI.`,
  };

  const istituzioni: DetailedMove = {
    lane: "Istituzioni",
    headline:
      input.stageId === 4
        ? "Garanti locali del voto"
        : `Innesto di ${officials} amministratori e patti civici`,
    whatToDo:
      input.stageId === 1
        ? `Avviare contatto riservato con ${officials} amministratori disponibili e mappare le liste civiche dei comuni sopra 15.000 abitanti in ${names}; agenda: sicurezza, sanità, imprese.`
        : input.stageId === 2
          ? `Firmare patti programmatici selettivi e innestare ${officials} amministratori nei distretti in espansione di ${names}, con clausole chiare su ${theme} e servizi locali.`
          : input.stageId === 3
            ? `Chiudere ${officials} accordi con sindaci, consiglieri e liste civiche nei comuni ad alta astensione di ${names}; priorità ai territori con stress sociale acuto.`
            : `Schierare i ${officialsTotal} amministratori acquisiti come garanti territoriali e testimoni del programma nei comuni di chiusura.`,
    whyItWorks: `L'eletto locale è il riduttore di rischio: l'elettore vota FN se riconosce un volto già legittimato sul territorio, non solo una leadership nazionale. IPOTESI.`,
    expectedFriction: `Pressione dei partiti di governo sugli amministratori 'in bilico' e rischio di esser dipinti come scissionisti. Superamento: patti su dossier concreti (non su etichette) e discrezione fino all'annuncio pubblico coordinato. IPOTESI.`,
  };

  return [aria, terra, istituzioni];
}

export function buildInterferenceMatrix(input: {
  stageId: 1 | 2 | 3 | 4;
  rows: RegionPlan[];
  themes: readonly [string, string, string];
  context: PoliticalInterferenceContext;
  pains: SocialPainSignal[];
}): InterferenceMatrix {
  const names = listNames(input.rows);
  const [theme, second] = input.themes;
  const topPain = input.pains[0];
  const stageEvents = input.context.eventsAndCalendar;
  const intl = input.context.internationalAndEu;

  const socialDiscontentVector = topPain
    ? `In ${topPain.region} e nei bacini di ${names} presidiare ${topPain.label}: ${topPain.indicatorLine}. Segnale locale: «${topPain.localHeadline}». Cavalcare la tensione senza ridurla a slogan: ascolto, dossier e presenza fisica. IPOTESI.`
    : `Presidiare il disagio su ${theme} e ${second} nei territori di ${names}, ancorandosi agli indicatori Osservatorio (stima) e alle lamentele reali di famiglie e imprese. IPOTESI.`;

  const otherPartiesMoves = [
    input.context.competitorDynamics.governmentArena,
    input.context.competitorDynamics.oppositionArena,
    `Contromossa in questa tappa: framing «presenza che risolve» contro «voto inutile», anticipando dichiarazioni avversarie con dati locali su ${theme} e garanti amministrativi già annunciati. IPOTESI.`,
  ].join(" ");

  const eventsAndProtests =
    stageEvents[Math.min(input.stageId - 1, stageEvents.length - 1)] ??
    `Intersecare le scadenze istituzionali e le proteste di categoria rilevanti per ${names} senza farsi scavalcare né isolare. IPOTESI.`;

  const internationalAndEuFactor =
    intl[Math.min(input.stageId - 1, intl.length - 1)] ??
    `Tradurre ogni variabile internazionale/UE che colpisce ${names} in proposta nazionale concreta per famiglie e imprese. IPOTESI.`;

  const contingencyPlaybook =
    input.stageId === 1
      ? `Se un attacco concentrico o un evento imprevisto congela l'attenzione: entro 48 ore riunione di crisi, dossier lampo sul dolore territoriale più caldo e tre uscite locali coordinate (non una sola replica nazionale). IPOTESI.`
      : input.stageId === 4
        ? `Se lo scenario precipita in chiusura: proteggere la macchina d'urna, rafforzare i garanti locali e spostare il messaggio su sicurezza del voto e tutela concreta, evitando polemiche che allontanano l'indeciso. IPOTESI.`
        : `Se piazze o competitor tentano di sequestrare ${theme}: aprire immediatamente un tavolo con le categorie colpite, pubblicare un protocollo operativo di 5 punti e presidiare fisicamente il luogo del conflitto entro 72 ore. IPOTESI.`;

  return {
    socialDiscontentVector,
    otherPartiesMoves,
    eventsAndProtests,
    internationalAndEuFactor,
    contingencyPlaybook,
  };
}

function painForPlace(region: Region, kind: RoadmapPlaceKind, pains: SocialPainSignal[]): string {
  const byKind: Partial<Record<RoadmapPlaceKind, TerritoryCategoryHint>> = {
    "Polo sanitario": "SANITA",
    "Stazione e sicurezza": "SICUREZZA",
    "Distretto produttivo": "LAVORO",
    "Porto e logistica": "TRASPORTI",
    "Periferia urbana": "SICUREZZA",
    "Aree interne": "TERRITORIO",
    "Area metropolitana": "COSTO_VITA",
  };
  const hint = byKind[kind];
  const match = pains.find((row) => row.region === region && (!hint || row.category === hint)) ?? pains.find((row) => row.region === region);
  if (match) return `${match.label}: ${match.indicatorLine}`;
  return `Pressione sociale locale in ${region} (stima)`;
}

type TerritoryCategoryHint = SocialPainSignal["category"];

function tacticalForKind(kind: RoadmapPlaceKind, place: string): string {
  switch (kind) {
    case "Polo sanitario":
      return `Punto stampa e ascolto fuori dal pronto soccorso/CUP di ${place}: raccogliere denunce documentate e annunciare un tavolo con associazioni pazienti entro 10 giorni.`;
    case "Distretto produttivo":
      return `Tavolo riservato con indotto e associazioni di categoria a ${place}: protocollo su energia, fisco e continuità occupazionale, poi uscita pubblica congiunta.`;
    case "Stazione e sicurezza":
      return `Sopralluogo e briefing forze dell'ordine/commercianti a ${place}, seguito da punto stampa su ordine urbano e servizi essenziali.`;
    case "Porto e logistica":
      return `Incontro con autotrasporto e operatori di ${place} su costi, tempi e sicurezza dei corridoi; proposta di snodo operativo entro la settimana.`;
    case "Aree interne":
      return `Assemblea civica nei comuni di ${place} su spopolamento e servizi: mappare sindaci disponibili e fissare un patto di presenza mensile.`;
    case "Periferia urbana":
      return `Presidio di quartiere a ${place} con gazebo fisso, raccolta priorità e incontro con comitati di cittadini entro 15 giorni.`;
    case "Area metropolitana":
      return `Blitz coordinato sui municipi di ${place}: gazebo, rappresentanti di lista e testimonianze di amministratori già acquisiti.`;
  }
}

export function enrichPlaces(
  places: RoadmapPlace[],
  context: PoliticalInterferenceContext,
  regions: readonly Region[],
): RoadmapPlace[] {
  const pains = painsForStageRegions(context, regions, 12);
  return places.map((place) => ({
    ...place,
    socialPainPoint: painForPlace(place.region, place.kind, pains),
    tacticalActionOnSite: tacticalForKind(place.kind, place.place),
  }));
}

export function detailedMovesToActions(moves: readonly [DetailedMove, DetailedMove, DetailedMove]) {
  return moves.map((move) => ({
    lane: move.lane,
    text: `${move.headline}: ${move.whatToDo}`,
  })) as [{ lane: RoadmapLane; text: string }, { lane: RoadmapLane; text: string }, { lane: RoadmapLane; text: string }];
}
