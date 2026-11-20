import type { Region } from "@/lib/engine/constants";
import type { HorizonDays, RegionPlan, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import { buildPoliticalInterferenceContext } from "@/lib/engine/politicalInterferenceContext";
import {
  buildDetailedMoves,
  buildInterferenceMatrix,
  buildStrategicRationale,
  detailedMovesToActions,
  enrichPlaces,
  type DetailedMove,
  type InterferenceMatrix,
  type StrategicRationale,
} from "@/lib/engine/operationalRoadmapDeepCopy";

export type { DetailedMove, InterferenceMatrix, StrategicRationale };

export type RoadmapLane = "Aria" | "Terra" | "Istituzioni";

export type RoadmapPlaceKind =
  | "Stazione e sicurezza"
  | "Distretto produttivo"
  | "Polo sanitario"
  | "Porto e logistica"
  | "Periferia urbana"
  | "Aree interne"
  | "Area metropolitana";

export type RoadmapPlace = {
  region: Region;
  place: string;
  kind: RoadmapPlaceKind;
  rationale: string;
  /** Disagio sociale/economico reale del territorio (Osservatorio · STIMA MODELLO). */
  socialPainPoint?: string;
  /** Azione concreta da eseguire sul posto e perché è simbolica. */
  tacticalActionOnSite?: string;
};

export type RoadmapAction = {
  lane: RoadmapLane;
  text: string;
};

export type RoadmapStage = {
  stageId: 1 | 2 | 3 | 4;
  label: string;
  focus: string;
  dayRangeLabel: string;
  fromDay: number;
  toDay: number;
  targetConsensusPct: number;
  /** Regioni assediate in questa finestra, scelte tra i bacini prioritari del piano. */
  regions: Region[];
  placesToPresidiate: RoadmapPlace[];
  /** Sintesi compatibile: headline + cosa fare (derivata da detailedMoves). */
  concreteActions: readonly [RoadmapAction, RoadmapAction, RoadmapAction];
  /** Dossier tattico: perché ora, meccanismo di conversione, collo di bottiglia. */
  strategicRationale: StrategicRationale;
  /** Azioni approfondite Aria / Terra / Istituzioni. */
  detailedMoves: readonly [DetailedMove, DetailedMove, DetailedMove];
  /** Quattro vettori di interferenza esterna + piano B. */
  interferenceMatrix: InterferenceMatrix;
  verificationMilestone: {
    minOnTrackPct: number;
    presidiOpened: number;
    regionsAboveTarget: number;
  };
  stageVotesDelta: number;
  stageCommitteesDelta: number;
  stageMembersDelta: number;
  stageOfficialsDelta: number;
  cumulativeVotesTarget: number;
  committees: number;
  members: number;
  elected: number;
  epistemic: "IPOTESI";
};

export type RoadmapGeneratedBy = "AI_MODEL" | "DETERMINISTIC_ENGINE";

export type RoadmapGenerationMeta = {
  provider: "anthropic" | "openai" | "gemini" | "none";
  modelLabel: string;
  diagnostic: string;
};

export type OperationalRoadmap = {
  horizonDays: HorizonDays;
  epistemic: "IPOTESI";
  ambition: AmbitionProfile;
  stages: readonly [RoadmapStage, RoadmapStage, RoadmapStage, RoadmapStage];
  /** Tesi strategica esecutiva. Sempre IPOTESI. */
  executiveThesis: string;
  /** Come risolvere il collo di bottiglia principale. Sempre IPOTESI. */
  keyBottleneckResolution: string;
  generatedBy: RoadmapGeneratedBy;
  generatedAt: string;
  /** Diagnostica sobria su quale motore ha prodotto i testi. */
  generationMeta?: RoadmapGenerationMeta;
};

/** Profilo operativo derivato dal backcast: decide testi, geografie e densità dei presidi. */
export type AmbitionProfile = "PRESIDIO" | "ESPANSIONE" | "SFONDAMENTO" | "SHOCK";

type PlaceSeed = Omit<RoadmapPlace, "region">;
type RegionCatalog = { field: readonly PlaceSeed[]; metro: readonly PlaceSeed[] };

const p = (place: string, kind: RoadmapPlaceKind, rationale: string): PlaceSeed => ({ place, kind, rationale });

const CATALOG: Partial<Record<Region, RegionCatalog>> = {
  Lombardia: {
    field: [
      p("Milano Stazione Centrale e San Vittore", "Stazione e sicurezza", "Punto di crisi a massima esposizione mediatica nazionale: ideale per lanciare il tema ariete."),
      p("Distretti manifatturieri Brescia-Bergamo", "Distretto produttivo", "Prima manifattura d'Italia, elettorato produttivo deluso dalla coalizione."),
      p("Asse della Brianza produttiva", "Distretto produttivo", "Densità di PMI e partite IVA sensibili a fisco ed energia."),
    ],
    metro: [p("Area metropolitana Milano-Brianza", "Area metropolitana", "Primo bacino d'Italia per numero assoluto di schede valide.")],
  },
  Veneto: {
    field: [
      p("Asse PMI Vicenza-Treviso-Verona", "Distretto produttivo", "Cuore delle PMI esportatrici, alta affinità con i temi di sicurezza e lavoro."),
      p("Snodo logistico del Quadrante Europa, Verona", "Porto e logistica", "Corridoio merci e lavoro autonomo dei trasporti."),
      p("Artigianato del Veneto centrale", "Distretto produttivo", "Rete artigiana diffusa, voto d'opinione mobile."),
    ],
    metro: [p("Asse metropolitano Venezia-Padova", "Area metropolitana", "Secondo polo elettorale del Nord-Est per volume di schede.")],
  },
  "Friuli-Venezia Giulia": {
    field: [
      p("Porto di Trieste e confine orientale", "Porto e logistica", "Frontiera dei flussi migratori: tema sicurezza a forte risonanza."),
      p("Distretti PMI del Friuli", "Distretto produttivo", "Meccanica e mobile, imprese sensibili al costo dell'energia."),
      p("Asse logistico di Udine", "Porto e logistica", "Snodo dei trasporti verso Austria e Slovenia."),
    ],
    metro: [p("Trieste e Udine capoluoghi", "Area metropolitana", "Concentrazione del voto urbano regionale.")],
  },
  "Trentino-Alto Adige": {
    field: [
      p("Asse del Brennero, Trento-Bolzano", "Porto e logistica", "Corridoio dei transiti e del trasporto pesante."),
      p("Valli produttive del Trentino", "Distretto produttivo", "PMI e turismo esposti a fisco e caro energia."),
      p("Aree montane del Trentino", "Aree interne", "Comuni con servizi in calo e astensione crescente."),
    ],
    metro: [p("Trento e Bolzano capoluoghi", "Area metropolitana", "Voto urbano regionale concentrato in due poli.")],
  },
  Piemonte: {
    field: [
      p("Polo automotive Torino-Mirafiori", "Distretto produttivo", "Crisi dell'indotto auto e transizione forzata: tema Stop Green Deal."),
      p("Indotto produttivo di Cuneo", "Distretto produttivo", "Agroindustria e meccanica, elettorato moderato contendibile."),
      p("Provincia produttiva di Novara", "Distretto produttivo", "Cerniera industriale con la Lombardia."),
    ],
    metro: [p("Torino città metropolitana", "Area metropolitana", "Terzo bacino del Nord per schede valide.")],
  },
  "Emilia-Romagna": {
    field: [
      p("Distretto ceramico di Sassuolo", "Distretto produttivo", "Settore energivoro colpito dal caro gas: tema Energia PMI."),
      p("Motor Valley e meccanica emiliana", "Distretto produttivo", "Filiera meccanica e artigiani specializzati."),
      p("Nodi logistici della via Emilia", "Porto e logistica", "Interporti e trasporto merci, lavoro autonomo."),
    ],
    metro: [p("Bologna e cintura metropolitana", "Area metropolitana", "Principale bacino urbano della regione.")],
  },
  Liguria: {
    field: [
      p("Porto di Genova e logistica portuale", "Porto e logistica", "Primo porto italiano, lavoro portuale e autotrasporto."),
      p("Entroterra ligure", "Aree interne", "Spopolamento e servizi sanitari ridotti."),
      p("PMI della riviera", "Distretto produttivo", "Turismo e commercio sotto pressione fiscale."),
    ],
    metro: [p("Genova città metropolitana", "Area metropolitana", "Concentra oltre metà dell'elettorato regionale.")],
  },
  Toscana: {
    field: [
      p("Porto di Livorno e costa logistica", "Porto e logistica", "Logistica portuale e lavoro dei trasporti."),
      p("Distretto tessile di Prato", "Distretto produttivo", "Concorrenza sleale e sicurezza del lavoro."),
      p("Poli sanitari dei capoluoghi toscani", "Polo sanitario", "Liste d'attesa in crescita nei presidi pubblici."),
    ],
    metro: [p("Asse metropolitano Firenze-Prato", "Area metropolitana", "Principale concentrazione di schede del Centro-Nord.")],
  },
  Marche: {
    field: [
      p("Distretto calzaturiero e meccanico marchigiano", "Distretto produttivo", "PMI manifatturiere esposte a energia e credito."),
      p("Porto di Ancona", "Porto e logistica", "Snodo adriatico e trasporti."),
      p("Entroterra del cratere sismico", "Aree interne", "Ricostruzione lenta e astensione alta."),
    ],
    metro: [p("Ancona e costa adriatica", "Area metropolitana", "Fascia urbana costiera a più alta densità di voto.")],
  },
  Umbria: {
    field: [
      p("Polo siderurgico di Terni", "Distretto produttivo", "Industria pesante e caro energia."),
      p("Presidi sanitari di Perugia", "Polo sanitario", "Liste d'attesa e mobilità sanitaria passiva."),
      p("Borghi dell'Appennino umbro", "Aree interne", "Servizi in calo e astensione crescente."),
    ],
    metro: [p("Perugia e Terni capoluoghi", "Area metropolitana", "I due poli urbani della regione.")],
  },
  Lazio: {
    field: [
      p("Periferie di Roma Est e litorale", "Periferia urbana", "Degrado urbano e sicurezza: bacino di astensione recuperabile."),
      p("Poli ospedalieri della capitale", "Polo sanitario", "Pronto soccorso saturi e liste d'attesa record."),
      p("Distretti produttivi di Latina e Frosinone", "Distretto produttivo", "Agroindustria e chimica, voto moderato deluso."),
    ],
    metro: [p("Roma Capitale e provincia", "Area metropolitana", "Primo bacino del Centro-Sud per numero di schede.")],
  },
  Abruzzo: {
    field: [
      p("Polo automotive della Val di Sangro", "Distretto produttivo", "Indotto auto esposto alla transizione forzata."),
      p("Entroterra aquilano", "Aree interne", "Ricostruzione e servizi sanitari ridotti."),
      p("Presidi sanitari di Pescara-Chieti", "Polo sanitario", "Liste d'attesa e carenza di personale."),
    ],
    metro: [p("Area urbana Pescara-Chieti", "Area metropolitana", "Principale conurbazione regionale.")],
  },
  Campania: {
    field: [
      p("Presidi ospedalieri di Napoli-Caserta", "Polo sanitario", "Emergenza liste d'attesa e pronto soccorso: tema sanità a massimo impatto."),
      p("Aree industriali di Caserta e Agro Aversano", "Distretto produttivo", "Lavoro irregolare e sicurezza del territorio."),
      p("Entroterra campano ad alta astensione", "Aree interne", "Grande serbatoio di elettori che non votano più."),
    ],
    metro: [p("Napoli città metropolitana", "Area metropolitana", "Primo bacino del Mezzogiorno per schede valide.")],
  },
  Puglia: {
    field: [
      p("Poli produttivi Bari-Taranto", "Distretto produttivo", "Crisi siderurgica e lavoro: tema energia e industria."),
      p("Distretti agricoli del Tavoliere", "Distretto produttivo", "Agricoltori colpiti da costi e burocrazia europea."),
      p("Presidi ospedalieri pugliesi", "Polo sanitario", "Mobilità sanitaria verso il Nord e liste d'attesa."),
    ],
    metro: [p("Bari città metropolitana", "Area metropolitana", "Principale bacino elettorale dell'Adriatico meridionale.")],
  },
  Basilicata: {
    field: [
      p("Polo di Melfi", "Distretto produttivo", "Indotto auto e transizione energetica."),
      p("Val d'Agri energetica", "Distretto produttivo", "Estrazioni e ricadute mancate sul territorio."),
      p("Aree interne lucane", "Aree interne", "Spopolamento e servizi sanitari lontani."),
    ],
    metro: [p("Potenza e Matera capoluoghi", "Area metropolitana", "I due poli urbani regionali.")],
  },
  Calabria: {
    field: [
      p("Presidi ospedalieri della Calabria", "Polo sanitario", "Sanità commissariata da anni: emergenza liste d'attesa."),
      p("Porto di Gioia Tauro", "Porto e logistica", "Primo porto di transhipment, lavoro e legalità."),
      p("Aree interne calabresi ad alta astensione", "Aree interne", "Serbatoio di astensione tra i più ampi d'Italia."),
    ],
    metro: [p("Reggio Calabria e area dello Stretto", "Area metropolitana", "Principale bacino urbano calabrese.")],
  },
  Sicilia: {
    field: [
      p("Snodi portuali e trasporti Palermo-Catania", "Porto e logistica", "Isolamento infrastrutturale e caro trasporti."),
      p("Poli ospedalieri siciliani", "Polo sanitario", "Liste d'attesa e mobilità sanitaria passiva."),
      p("Aree interne siciliane ad alta astensione", "Aree interne", "Comuni con affluenza sotto la media nazionale."),
    ],
    metro: [p("Palermo e Catania città metropolitane", "Area metropolitana", "Due grandi bacini con alto volume di schede.")],
  },
  Sardegna: {
    field: [
      p("Porti e continuità territoriale, Cagliari-Olbia", "Porto e logistica", "Caro trasporti e collegamenti con il continente."),
      p("Polo industriale del Sulcis", "Distretto produttivo", "Crisi industriale e costo dell'energia."),
      p("Aree interne della Barbagia", "Aree interne", "Spopolamento e presidi sanitari ridotti."),
    ],
    metro: [p("Cagliari città metropolitana", "Area metropolitana", "Principale bacino urbano dell'isola.")],
  },
  Molise: {
    field: [
      p("Area industriale di Termoli", "Distretto produttivo", "Indotto auto e lavoro."),
      p("Presidi sanitari molisani", "Polo sanitario", "Sanità commissariata e liste d'attesa."),
      p("Borghi del Molise interno", "Aree interne", "Spopolamento e astensione."),
    ],
    metro: [p("Campobasso e Isernia capoluoghi", "Area metropolitana", "I due poli urbani regionali.")],
  },
  "Valle d'Aosta": {
    field: [
      p("Asse del Monte Bianco e del Gran San Bernardo", "Porto e logistica", "Transiti alpini e trasporto pesante."),
      p("PMI e turismo valdostano", "Distretto produttivo", "Imprese stagionali esposte a fisco ed energia."),
      p("Comuni di montagna valdostani", "Aree interne", "Servizi ridotti e astensione."),
    ],
    metro: [p("Aosta capoluogo", "Area metropolitana", "Unico polo urbano regionale.")],
  },
};

function genericCatalog(region: Region): RegionCatalog {
  return {
    field: [
      p(`Capoluogo e province contendibili di ${region}`, "Periferia urbana", "Comuni dove lo scarto con la coalizione è più recuperabile."),
      p(`Aree interne di ${region}`, "Aree interne", "Astensione alta e servizi in calo."),
      p(`Comuni sopra 15.000 abitanti di ${region}`, "Periferia urbana", "Soglia utile per patti con liste civiche."),
    ],
    metro: [p(`Capoluogo di ${region}`, "Area metropolitana", "Concentrazione del voto urbano regionale.")],
  };
}

function catalogOf(region: Region): RegionCatalog {
  return CATALOG[region] ?? genericCatalog(region);
}

type StageChrome = { label: string; focus: string };

/** Classifica l'ambizione del piano: da essa dipendono testi, geografie e densità dei posti. */
export function ambitionProfile(backcast: StrategicBackcastResult): AmbitionProfile {
  if (backcast.feasibilityBand === "SHOCK_ESOGENO_RICHIESTO" || backcast.regime === "OLTRE_FRONTIERA_ENDOGENA") {
    return "SHOCK";
  }
  const gap = backcast.targetPct - backcast.currentPct;
  if (backcast.regime === "INERZIA_COPERTA" || backcast.regime === "CONSOLIDAMENTO_BASE" || gap <= 1.8) {
    return "PRESIDIO";
  }
  if (
    gap <= 3.5 ||
    backcast.feasibilityBand === "ESPANSIONE_ORGANICA" ||
    backcast.feasibilityBand === "COPERTA_DA_MODELLO" ||
    backcast.regime === "ESECUZIONE_OFFENSIVA_V4"
  ) {
    return "ESPANSIONE";
  }
  return "SFONDAMENTO";
}

function stagePack(
  profile: AmbitionProfile,
  theme: string,
  fronts: number,
  gapPp: number,
): readonly [StageChrome, StageChrome, StageChrome, StageChrome] {
  const gap = gapPp.toFixed(1).replace(".", ",");
  const frontLabel = fronts > 0 ? `${fronts} fronti prioritari` : "i bacini già aperti";
  if (profile === "PRESIDIO") {
    return [
      {
        label: `Tenuta identitaria su ${theme}`,
        focus: `Consolidare i ${frontLabel}: densificare la presenza dove il consenso esiste già, senza aprire troppi fronti nuovi (+${gap} pp).`,
      },
      {
        label: "Rete locale e temi di vicinato",
        focus: `Rafforzare comitati e amministratori nei distretti consolidati, usando ${theme} come messaggio di difesa e appartenenza.`,
      },
      {
        label: "Copertura dei buchi di presenza",
        focus: "Chiudere i comuni scoperti nei bacini forti e recuperare l'astensione di protesta solo dove è a portata di mano.",
      },
      {
        label: "Conversione del consenso in scheda",
        focus: "Gazebo, rappresentanti di lista e richiamo ai tesserati: trasformare la notorietà già acquisita in voto senza diluire il messaggio.",
      },
    ];
  }
  if (profile === "ESPANSIONE") {
    return [
      {
        label: `Innesco controllato su ${theme}`,
        focus: `Aprire il varco mediatico e territoriale sui ${frontLabel}, con un carico di rete proporzionato a +${gap} pp.`,
      },
      {
        label: "Allargamento sui temi-ponte del piano",
        focus: "Attivare i temi secondari del piano e i tavoli con categorie produttive solo nei fronti già aperti.",
      },
      {
        label: "Estensione ai bacini complementari",
        focus: "Portare presenza e eletti nelle macro-aree ancora scoperte, con un ritmo di comitati sostenibile mese per mese.",
      },
      {
        label: "Chiusura metropolitana e macchina d'urna",
        focus: "Concentrare la spinta finale sulle aree metropolitane dei bacini e blindare i rappresentanti di lista.",
      },
    ];
  }
  if (profile === "SFONDAMENTO") {
    return [
      {
        label: fronts > 0 ? `Innesco mediatico e assedio dei ${fronts} fronti` : "Innesco mediatico e assedio dei bacini",
        focus: `Lancio di ${theme} come tema ariete e apertura rapida dei coordinamenti provinciali sui fronti a maggior potenziale (+${gap} pp).`,
      },
      {
        label: "Allargamento produttivo e temi-ponte",
        focus: "Attivazione dei temi economici del piano e tavoli con artigiani, partite IVA e associazioni di categoria.",
      },
      {
        label: "Sfondamento Sud, Isole e reti civiche",
        focus: "Emergenza tematica e caro vita, accordi strutturati con sindaci, consiglieri e liste civiche nei bacini ad alta astensione.",
      },
      {
        label: "Assedio finale alle aree metropolitane",
        focus: "Mobilitazione totale su gazebo, rappresentanti di lista e tesserati per convertire il consenso in voto.",
      },
    ];
  }
  return [
    {
      label: `Piano condizionato: ${theme} e catalizzatore esterno`,
      focus: `Il traguardo (+${gap} pp) supera la frontiera organizzativa endogena: senza uno shock esterno la probabilità crolla. Intanto si apre il massimo carico sui ${frontLabel}.`,
    },
    {
      label: "Rete straordinaria e saturazione dei temi",
      focus: "Moltiplicare comitati e messaggi su tutti i temi del piano: la rete deve anticipare un eventuale vento esterno.",
    },
    {
      label: "Copertura nazionale dei bacini residuali",
      focus: "Nessuna macro-area lasciata scoperta: Sud, Isole, astensione e reti civiche entrano tutte nel calendario operativo.",
    },
    {
      label: "Conversione di massa se arriva lo shock",
      focus: "Macchina d'urna già pronta: metropoli, rappresentanti di lista e tesserati devono poter convertire un picco di attenzione in schede.",
    },
  ];
}

const REGION_COUNTS: Record<AmbitionProfile, readonly [number, number, number, number]> = {
  PRESIDIO: [2, 3, 2, 4],
  ESPANSIONE: [3, 3, 3, 5],
  SFONDAMENTO: [3, 4, 4, 6],
  SHOCK: [4, 4, 4, 6],
};

const PLACE_COUNTS: Record<AmbitionProfile, readonly [number, number, number, number]> = {
  PRESIDIO: [2, 2, 2, 3],
  ESPANSIONE: [3, 3, 3, 4],
  SFONDAMENTO: [3, 4, 4, 4],
  SHOCK: [4, 4, 5, 5],
};

function bounds(horizon: HorizonDays): readonly [number, number, number, number] {
  const cut = (ratio: number) => Math.max(1, Math.round(horizon * ratio));
  const ends = [cut(60 / 360), cut(150 / 360), cut(270 / 360), horizon] as [number, number, number, number];
  if (ends[0] >= ends[1]) ends[1] = Math.min(horizon - 2, ends[0] + 1);
  if (ends[1] >= ends[2]) ends[2] = Math.min(horizon - 1, ends[1] + 1);
  if (ends[2] >= ends[3]) ends[2] = Math.max(ends[1] + 1, horizon - 1);
  return ends;
}

function expectedAt(result: StrategicBackcastResult, day: number): number {
  const points = [{ day: 0, expectedPct: result.currentPct }, ...result.checkpoints];
  let previous = points[0]!;
  for (const point of points) {
    if (point.day === day) return point.expectedPct;
    if (point.day > day) {
      const span = point.day - previous.day || 1;
      return previous.expectedPct + ((point.expectedPct - previous.expectedPct) * (day - previous.day)) / span;
    }
    previous = point;
  }
  return result.achievablePct;
}

function ballotsOf(result: StrategicBackcastResult): number {
  const gap = result.targetPct - result.currentPct;
  if (Math.abs(gap) < 1e-6 || result.totalDeltaVotes <= 0) return 23_257_062;
  return Math.round(result.totalDeltaVotes / (gap / 100));
}

function activeRegions(result: StrategicBackcastResult): RegionPlan[] {
  const active = result.regions.filter((row) => row.addedVotes > 0).sort((a, b) => b.addedVotes - a.addedVotes);
  return active.length > 0 ? active : [...result.regions].sort((a, b) => b.ceilingPct - a.ceilingPct);
}

function pick(pool: RegionPlan[], used: Set<Region>, filter: (row: RegionPlan) => boolean, count: number): RegionPlan[] {
  const fresh = pool.filter((row) => filter(row) && !used.has(row.region));
  const fallback = pool.filter((row) => !used.has(row.region) && !fresh.includes(row));
  const reused = pool.filter((row) => filter(row) && used.has(row.region));
  const chosen = [...fresh, ...fallback, ...reused, ...pool].filter((row, index, all) => all.indexOf(row) === index).slice(0, count);
  for (const row of chosen) used.add(row.region);
  return chosen;
}

/** Geografie guidate dai fronti prioritari del piano, con conteggi scalati al profilo. */
function stageRegions(
  result: StrategicBackcastResult,
  profile: AmbitionProfile,
): [RegionPlan[], RegionPlan[], RegionPlan[], RegionPlan[]] {
  const pool = activeRegions(result);
  const used = new Set<Region>();
  const [n1, n2, n3, n4] = REGION_COUNTS[profile];
  const fronts = pool.filter((row) => row.role === "FRONTE_PRIORITARIO");
  const frontSet = new Set(fronts.map((row) => row.region));
  const first = pick(pool, used, (row) => frontSet.has(row.region) || row.role === "FRONTE_PRIORITARIO", n1);
  const firstAreas = new Set(first.map((row) => row.macroArea));
  const second = pick(
    pool,
    used,
    (row) =>
      row.role === "SUPPORTO_ESPANSIONE" ||
      (!firstAreas.has(row.macroArea) && (row.macroArea === "Nord-Ovest" || row.macroArea === "Centro" || row.macroArea === "Nord-Est")),
    n2,
  );
  const third = pick(
    pool,
    used,
    (row) => row.macroArea === "Sud" || row.macroArea === "Isole" || row.role === "SUPPORTO_ESPANSIONE",
    n3,
  );
  const fourth = pool.slice(0, Math.min(n4, pool.length));
  return [first, second, third, fourth];
}

function placesFor(regions: RegionPlan[], source: "field" | "metro", count: number, taken: Set<string>): RoadmapPlace[] {
  const out: RoadmapPlace[] = [];
  const queues = regions.map((row) => {
    const catalog = catalogOf(row.region);
    const ordered = source === "metro" ? [...catalog.metro, ...catalog.field] : [...catalog.field, ...genericCatalog(row.region).field];
    return { region: row.region, seeds: ordered };
  });
  for (let round = 0; out.length < count && round < 6; round += 1) {
    for (const queue of queues) {
      if (out.length >= count) break;
      const seed = queue.seeds.find((item) => !taken.has(item.place));
      if (!seed) continue;
      taken.add(seed.place);
      out.push({ region: queue.region, ...seed });
    }
  }
  return out;
}

function cumulative(total: number, day: number, horizon: number): number {
  return Math.max(0, Math.round(total * (day / horizon)));
}

function topThemes(backcast: StrategicBackcastResult): [string, string, string] {
  return [
    backcast.themes[0]?.theme ?? "Sicurezza",
    backcast.themes[1]?.theme ?? "Liste d'attesa Sanità",
    backcast.themes[2]?.theme ?? backcast.themes[0]?.theme ?? "Energia PMI",
  ];
}

/** Garantisce i campi dossier anche su roadmap persistite prima dell'upgrade. */
export function ensureRoadmapStageDepth(stage: RoadmapStage): RoadmapStage {
  const detailedMoves =
    stage.detailedMoves?.length === 3
      ? stage.detailedMoves
      : (stage.concreteActions.map((action) => ({
          lane: action.lane,
          headline: action.lane,
          whatToDo: action.text,
          whyItWorks: "La presenza concreta e il messaggio tematico riducono la distanza tra simpatia e scheda. IPOTESI.",
          expectedFriction: "Resistenze locali e framing avversario sul 'voto inutile': rispondere con garanti territoriali e dati di disagio. IPOTESI.",
        })) as unknown as RoadmapStage["detailedMoves"]);
  const strategicRationale = stage.strategicRationale ?? {
    whyNow: stage.focus,
    voterPsychologyMechanism:
      "L'elettore target passa al voto quando riconosce una risposta concreta al proprio disagio e un volto locale che riduce il rischio percepito. IPOTESI.",
    structuralObjective: "Convertire attenzione in struttura territoriale (comitati, tesserati, amministratori). IPOTESI.",
  };
  const interferenceMatrix = stage.interferenceMatrix ?? {
    socialDiscontentVector: "Presidiare il disagio sociale ed economico dei territori della tappa con dati Osservatorio (stima). IPOTESI.",
    otherPartiesMoves:
      "Anticipare il framing del 'voto inutile' e la delegittimazione mediatica con presenza locale e dossier concreti. IPOTESI.",
    eventsAndProtests: "Posizionarsi su scioperi, vertenze e scadenze istituzionali senza farsi scavalcare. IPOTESI.",
    internationalAndEuFactor: "Tradurre dazi, direttive UE ed energia in proposte nazionali per famiglie e imprese. IPOTESI.",
    contingencyPlaybook: "Se lo scenario cambia: dossier lampo sul dolore territoriale più caldo e tre uscite locali coordinate entro 48 ore. IPOTESI.",
  };
  return {
    ...stage,
    detailedMoves,
    concreteActions: detailedMovesToActions(detailedMoves),
    strategicRationale,
    interferenceMatrix,
    placesToPresidiate: stage.placesToPresidiate.map((place) => ({
      ...place,
      socialPainPoint: place.socialPainPoint ?? place.rationale,
      tacticalActionOnSite: place.tacticalActionOnSite ?? `Presidio operativo a ${place.place}.`,
    })),
  };
}

export function ensureOperationalRoadmapDepth(roadmap: OperationalRoadmap): OperationalRoadmap {
  const stages = roadmap.stages.map(ensureRoadmapStageDepth) as unknown as OperationalRoadmap["stages"];
  return { ...roadmap, stages };
}

export function buildOperationalRoadmap(backcast: StrategicBackcastResult, horizonDays: HorizonDays): OperationalRoadmap {
  const profile = ambitionProfile(backcast);
  const ends = bounds(horizonDays);
  const ballots = ballotsOf(backcast);
  const themes = topThemes(backcast);
  const gapPp = Math.max(0, backcast.targetPct - backcast.currentPct);
  const chrome = stagePack(profile, themes[0], backcast.activeFronts, gapPp);
  const groups = stageRegions(backcast, profile);
  const placeCounts = PLACE_COUNTS[profile];
  const taken = new Set<string>();
  const { deltaCommittees, deltaMembers, electedTarget } = backcast.network;
  const allRegions = [...new Set(groups.flat().map((row) => row.region))];
  const interference = buildPoliticalInterferenceContext({
    regions: allRegions,
    themes,
    horizonDays,
  });
  let previousVotes = 0;
  const stages = ends.map((toDay, index) => {
    const stageId = (index + 1) as 1 | 2 | 3 | 4;
    const fromDay = index === 0 ? 1 : ends[index - 1]! + 1;
    const rows = groups[index]!;
    const regionNames = rows.map((row) => row.region);
    const expected = expectedAt(backcast, toDay);
    const committees = cumulative(deltaCommittees, toDay, horizonDays);
    const members = cumulative(deltaMembers, toDay, horizonDays);
    const elected = cumulative(electedTarget, toDay, horizonDays);
    const stageCommitteesDelta = Math.max(0, committees - cumulative(deltaCommittees, fromDay - 1, horizonDays));
    const stageMembersDelta = Math.max(0, members - cumulative(deltaMembers, fromDay - 1, horizonDays));
    const stageOfficialsDelta = Math.max(0, elected - cumulative(electedTarget, fromDay - 1, horizonDays));
    const cumulativeVotesTarget = Math.max(0, Math.round(((expected - backcast.currentPct) / 100) * ballots));
    const stageVotesDelta = Math.max(0, cumulativeVotesTarget - previousVotes);
    previousVotes = cumulativeVotesTarget;
    const places = enrichPlaces(
      placesFor(rows, stageId === 4 ? "metro" : "field", placeCounts[index]!, taken),
      interference,
      regionNames,
    );
    const pains = interference.regionalDiscontent.filter((row) => regionNames.includes(row.region)).slice(0, 3);
    const detailedMoves = buildDetailedMoves({
      stageId,
      profile,
      rows,
      themes,
      numbers: {
        committees: stageCommitteesDelta,
        members: stageMembersDelta,
        officials: stageOfficialsDelta,
        officialsTotal: elected,
      },
      pains,
    });
    const strategicRationale = buildStrategicRationale({
      stageId,
      profile,
      rows,
      theme: themes[0],
      fromDay,
      toDay,
      gapPp,
      committees: stageCommitteesDelta,
      officials: stageOfficialsDelta,
    });
    const interferenceMatrix = buildInterferenceMatrix({
      stageId,
      rows,
      themes,
      context: interference,
      pains,
    });
    return {
      stageId,
      label: chrome[index]!.label,
      focus: chrome[index]!.focus,
      dayRangeLabel: `Giorni ${fromDay}–${toDay}`,
      fromDay,
      toDay,
      targetConsensusPct: expected,
      regions: regionNames,
      placesToPresidiate: places,
      concreteActions: detailedMovesToActions(detailedMoves),
      strategicRationale,
      detailedMoves,
      interferenceMatrix,
      verificationMilestone: {
        minOnTrackPct: expected - 0.22,
        presidiOpened: committees,
        regionsAboveTarget: rows.filter((row) => row.targetPct >= 10).length,
      },
      stageVotesDelta,
      stageCommitteesDelta,
      stageMembersDelta,
      stageOfficialsDelta,
      cumulativeVotesTarget,
      committees,
      members,
      elected,
      epistemic: "IPOTESI" as const,
    };
  });
  const [first, secondStage, third, fourth] = stages;
  const thesis =
    profile === "SHOCK"
      ? `Il traguardo ${backcast.targetPct.toFixed(1).replace(".", ",")}% supera la frontiera organizzativa: la macchina territoriale arriva al ${backcast.achievablePct.toFixed(1).replace(".", ",")}% e il resto richiede un fattore politico esterno. IPOTESI.`
      : profile === "PRESIDIO"
        ? `Piano di tenuta su ${themes[0]}: concentrare le risorse sui ${backcast.activeFronts || "bacini"} fronti già aperti senza disperdere la rete. IPOTESI.`
        : `Progressione asimmetrica da ${backcast.currentPct.toFixed(2).replace(".", ",")}% a ${backcast.targetPct.toFixed(1).replace(".", ",")}%: convertire notorietà in struttura territoriale sui fronti prioritari. IPOTESI.`;
  const bottleneck =
    backcast.targetPct > backcast.maxEndogenousPct
      ? `Il surplus oltre ${backcast.maxEndogenousPct.toFixed(1).replace(".", ",")}% non è coperto dalla sola rete: servono manovre politiche straordinarie oltre i vincoli Aria×Terra×Istituzioni. IPOTESI.`
      : `Il collo di bottiglia è la conversione di ${themes[0]} in comitati, tesserati e rappresentanti di lista nei tempi dell'orizzonte. IPOTESI.`;
  return {
    horizonDays,
    epistemic: "IPOTESI",
    ambition: profile,
    stages: [first!, secondStage!, third!, fourth!],
    executiveThesis: thesis,
    keyBottleneckResolution: bottleneck,
    generatedBy: "DETERMINISTIC_ENGINE",
    generatedAt: new Date().toISOString(),
    generationMeta: {
      provider: "none",
      modelLabel: "Motore Combinatorio",
      diagnostic: "Nessuna chiave AI in .env.local (ANTHROPIC_API_KEY / OPENAI_API_KEY / GEMINI_API_KEY). Testi prodotti dal motore deterministico arricchito.",
    },
  };
}
