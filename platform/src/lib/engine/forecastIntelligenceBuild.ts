import { BIP_FN_PROMISES_CATALOG } from "@/lib/bipProgramCatalog";
import { REGIONS, type Region } from "@/lib/engine/constants";
import {
  getCalibrationMetrics,
  type ForecastCalibrationMetrics,
  type ForecastIntelligencePayload,
  type ForecastMonthIntelligence,
  type ForecastNewsDriver,
} from "@/lib/engine/forecastCalibrationEngine";
import { buildExposurePriorityCards } from "@/lib/engine/exposurePriorityEngine";
import type { GrowthEvidence, HorizonProjection } from "@/lib/engine/growthTrajectory";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Pack strategico curato mese-per-mese. Vietato interpolare ordinary.title in queste frasi. */
type MonthPack = {
  eventTitle: string;
  calendarImpactPp: number;
  calendarExplanation: string;
  drivers: ForecastNewsDriver[];
  conflictTitle: string;
  strategicSummary: string;
  triggerCondition: string;
  moves: [string, string, string];
  levers: ForecastMonthIntelligence["bipResponse"]["levers"];
  readyStatement: string;
  targetRegions: Array<{ region: string; cdxPct: number }>;
};

const MONTH_PACKS: Record<string, MonthPack> = {
  "2026-11": {
    eventTitle: "Manovra di bilancio",
    calendarImpactPp: -0.08,
    calendarExplanation:
      "Sessione di Bilancio: i TG restano sui partiti di Governo (FdI/Lega) e il ciclo mediatico di chi è fuori maggioranza si accorcia.",
    drivers: [
      {
        title: "Meloni frena il flop di Vannacci: «Torna a casa chi aveva provato Futuro Nazionale»",
        source: "Il Dubbio",
        impactPp: -0.03,
        whyItMatters:
          "Tentativo della stampa d'area di frenare i flussi verso FN accreditando un rientro verso FdI.",
      },
      {
        title: "Sondaggio Liguria: peso territoriale e presidi regionali sotto osservazione",
        source: "Primocanale",
        impactPp: 0.01,
        whyItMatters:
          "Radicamento territoriale nei presidi regionali: mantiene alta l'attenzione sui territori del Nord-Ovest.",
      },
      {
        title: "Narrativa sul «calo» di Futuro Nazionale nei sondaggi di novembre",
        source: "HuffPost",
        impactPp: -0.02,
        whyItMatters:
          "Narrativa ostile usata per scoraggiare gli indecisi di centrodestra dal passare a FN.",
      },
    ],
    conflictTitle: "Scontro sulla Manovra fiscale",
    strategicSummary:
      "Durante la sessione di Bilancio i TG danno spazio solo ai partiti di maggioranza: per non subire il calo fisiologico dobbiamo attaccare il Governo sulle promesse fiscali tradite.",
    triggerCondition:
      "Tensioni tra Lega e FdI su tasse, canone, pensioni o invio di armi aprono lo spazio mediatico per l'affondo di Vannacci.",
    moves: [
      "1. Attacco politico: Sfidare Governo e MEF su Partite IVA (stop saldo-acconto), mancato taglio accise e tagli agli enti locali.",
      "2. Presidio TV & media: Rifiutare il chiacchiericcio sui sondaggi e imporre i dossier su caro-vita, mutui giovani e bollette PMI.",
      "3. Piazze prioritarie: Mobilitazione in Lombardia (CDX 54%) e Veneto (CDX 59%), dove artigiani e PMI chiedono una scossa fiscale.",
    ],
    levers: [
      {
        category: "FAMIGLIA & CASA",
        title: "Mutuo Tricolore Consap",
        concreteMeasure:
          "Tasso azzerato (0%) al 3° figlio, moratoria di 1 anno a ogni nascita e priorità assoluta agli italiani nelle graduatorie ERP.",
      },
      {
        category: "FISCO & IMPRESE",
        title: "Rivoluzione Fiscale P.IVA",
        concreteMeasure:
          "Abolizione immediata del meccanismo saldo e acconto, tetto al contante a 10.000 € e stop al Mercosur.",
      },
    ],
    readyStatement:
      "«Mentre nei palazzi romani passano le giornate a misurare i decimali dei sondaggi, le famiglie e le imprese italiane affogano tra bollette, tasse e stazioni fuori controllo. Sulla Legge di Bilancio chiediamo tre misure immediate: abolizione di saldo e acconto per le Partite IVA, tetto al contante a 10.000 euro e Mutuo Tricolore azzerato per i giovani italiani che mettono al mondo figli.»",
    targetRegions: [
      { region: "Lombardia", cdxPct: 54 },
      { region: "Veneto", cdxPct: 59 },
    ],
  },
  "2026-12": {
    eventTitle: "Sicurezza Città & Identità",
    calendarImpactPp: -0.06,
    calendarExplanation:
      "A dicembre la politica parlamentare rallenta: restano in agenda Milleproroghe, scadenze fiscali e l'emergenza sicurezza nelle stazioni durante le festività.",
    drivers: [
      {
        title: "Decreto Milleproroghe e scadenze fiscali di fine anno (IMU / acconti)",
        source: "Scadenze & Fronti · Dicembre",
        impactPp: -0.02,
        whyItMatters:
          "Conguagli e scadenze di dicembre colpiscono famiglie e proprietari di immobili.",
      },
      {
        title: "Emergenza sicurezza nelle stazioni e nei centri commerciali durante le festività",
        source: "Scadenze & Fronti · Dicembre",
        impactPp: 0.02,
        whyItMatters:
          "L'aumento di furti, borseggi e baby gang sposta l'opinione pubblica sulle posizioni d'ordine di FN.",
      },
    ],
    conflictTitle: "Sicurezza urbana e tradizioni natalizie",
    strategicSummary:
      "A dicembre la politica parlamentare rallenta, ma esplode il tema della sicurezza reale nelle stazioni, sui treni e nelle vie dello shopping insieme alla difesa delle nostre tradizioni.",
    triggerCondition:
      "Episodi di cronaca nera nelle grandi stazioni o casi di cancellazione del Natale nelle scuole portano i temi identitari di FN in prima serata.",
    moves: [
      "1. Attacco politico: Denunciare l'abbandono delle stazioni ferroviarie e delle periferie in mano a spacciatori, borseggiatori e baby gang.",
      "2. Presidio TV & media: Difendere a viso aperto le radici cristiane, il Presepe e l'autorità degli insegnanti contro le derive woke nelle scuole.",
      "3. Piazze prioritarie: Sopralluoghi e punti stampa davanti alle stazioni di Milano Centrale (Lombardia) e Roma Termini (Lazio).",
    ],
    levers: [
      {
        category: "SICUREZZA URBANA",
        title: "Protocollo Modellare, Bonificare, Presidiare e Ricostruire",
        concreteMeasure:
          "Impiego delle Forze Armate nei quartieri ad alta densità criminale e Legittima Difesa sempre presunta.",
      },
      {
        category: "IDENTITÀ & SCUOLA",
        title: "Scuola del Merito e Tradizione",
        concreteMeasure:
          "Stop ai progetti ideologici gender negli istituti, ripristino dell'autorità dei docenti e tutela delle festività nazionali.",
      },
    ],
    readyStatement:
      "«Gli italiani hanno il diritto di vivere le proprie città e le proprie stazioni in totale sicurezza, senza dover fare lo slalom tra spacciatori, baby gang e degrado. Chiediamo il presidio militare stabile dei punti caldi, la legittima difesa sempre presunta per chi si difende in casa o in negozio e il rispetto sacro delle nostre tradizioni nelle scuole.»",
    targetRegions: [
      { region: "Lombardia", cdxPct: 54 },
      { region: "Lazio", cdxPct: 47 },
    ],
  },
  "2027-01": {
    eventTitle: "Rincari Energetici & Crisi Industriale",
    calendarImpactPp: 0.06,
    calendarExplanation:
      "Gennaio presenta il conto energetico: bollette invernali, pedaggi e tavoli di crisi automotive al MIMIT riportano economia e lavoro in prima pagina.",
    drivers: [
      {
        title: "Stangata invernale bollette luce/gas e adeguamento tariffe autostradali",
        source: "Scadenze & Fronti · Gennaio",
        impactPp: 0.03,
        whyItMatters:
          "Il caro-energia di inizio anno riattiva la rabbia di famiglie, pendolari e piccole imprese.",
      },
      {
        title: "Tavoli di crisi automotive e manifattura al MIMIT su cassa integrazione",
        source: "Scadenze & Fronti · Gennaio",
        impactPp: 0.02,
        whyItMatters:
          "Le chiusure nella filiera dell'auto confermano le denunce di Vannacci contro il Green Deal europeo.",
      },
    ],
    conflictTitle: "Caro-energia e suicidio industriale UE",
    strategicSummary:
      "Gennaio presenta il conto economico alle famiglie e alle fabbriche: picco delle bollette invernali, rincari dei pedaggi e cassa integrazione nella filiera metalmeccanica.",
    triggerCondition:
      "Nuovi rincari energetici o annunci di tagli occupazionali negli stabilimenti del Nord Italia.",
    moves: [
      "1. Attacco politico: Attaccare frontalmente il suicidio industriale del Green Deal UE (bando motori 2035 e Case Green) subito in silenzio dal Governo.",
      "2. Presidio TV & media: Dare voce in TV a operai dell'indotto auto, autotrasportatori e imprenditori schiacciati dal costo dell'energia.",
      "3. Piazze prioritarie: Incontri operativi nei distretti industriali di Torino (Piemonte) e Vicenza/Padova (Veneto).",
    ],
    levers: [
      {
        category: "ENERGIA SOVRANA",
        title: "Piano Energia Nazionale (Cap. 9)",
        concreteMeasure:
          "Taglio strutturale degli oneri in bolletta, approvvigionamento gas senza veti ideologici e avvio del Nucleare SMR/AMR.",
      },
      {
        category: "INDUSTRIA & AUTO",
        title: "Scudo Filiera Automotive",
        concreteMeasure:
          "Cancellazione immediata dei vincoli UE 2035 sui motori endotermici, neutralità tecnologica e stop alla direttiva Case Green.",
      },
    ],
    readyStatement:
      "«L'anno nuovo si apre con i conguagli di luce e gas per le famiglie e con la cassa integrazione per migliaia di lavoratori dell'automotive sacrificati sull'altare dell'ideologia verde di Bruxelles. Futuro Nazionale chiede l'azzeramento degli oneri green in bolletta, il ritorno all'energia sovrana e lo stop immediato alle direttive UE che chiudono le nostre fabbriche.»",
    targetRegions: [
      { region: "Piemonte", cdxPct: 51 },
      { region: "Veneto", cdxPct: 59 },
    ],
  },
  "2027-02": {
    eventTitle: "Sanità, Liste d'Attesa & Giustizia",
    calendarImpactPp: 0.05,
    calendarExplanation:
      "A febbraio l'agenda sociale è dominata dal collasso dei pronto soccorso, dalle liste d'attesa e dall'emergenza carceraria.",
    drivers: [
      {
        title: "Monitoraggio AGENAS su tempi liste d'attesa e sovraffollamento Pronto Soccorso",
        source: "Scadenze & Fronti · Febbraio",
        impactPp: 0.02,
        whyItMatters:
          "Il picco invernale negli ospedali porta l'emergenza sanitaria in cima alle preoccupazioni dei cittadini.",
      },
      {
        title: "Relazione annuale sull'amministrazione della giustizia e capienza carceri (>130%)",
        source: "Scadenze & Fronti · Febbraio",
        impactPp: 0.01,
        whyItMatters:
          "Sovraffollamento carcerario e rivolte nei CPR rilanciano la richiesta di rimpatrio dei detenuti stranieri.",
      },
    ],
    conflictTitle: "Liste d'attesa e emergenza carceri",
    strategicSummary:
      "A febbraio l'agenda sociale è dominata dal collasso dei pronto soccorso, dalle liste d'attesa infinite negli ospedali e dall'emergenza nelle carceri italiane.",
    triggerCondition:
      "Inchieste sui tempi delle visite mediche o disordini nelle carceri riportano sanità e giustizia al centro del dibattito.",
    moves: [
      "1. Attacco politico: Denunciare lo scandalo delle liste d'attesa: chi paga le tasse viene costretto a pagare il privato o a rinunciare a curarsi.",
      "2. Presidio TV & media: Proporre l'espulsione dei detenuti stranieri (oltre un terzo dei reclusi) per liberare posti e risorse nelle carceri italiane.",
      "3. Piazze prioritarie: Presidi davanti agli ospedali e agli istituti penitenziari in Calabria (CDX 53%) e Puglia (CDX 46%).",
    ],
    levers: [
      {
        category: "SANITÀ PUBBLICA",
        title: "Diritto alla Cura & Detrazione 100%",
        concreteMeasure:
          "Detrazione integrale delle spese mediche private se il Servizio Sanitario Nazionale non rispetta i tempi massimi di legge.",
      },
      {
        category: "GIUSTIZIA & CARCERI",
        title: "Espulsione Detenuti Stranieri",
        concreteMeasure:
          "Accordi bilaterali obbligatori per far scontare la pena ai detenuti stranieri nelle carceri dei rispettivi Paesi d'origine.",
      },
    ],
    readyStatement:
      "«Non è accettabile che un cittadino italiano che ha pagato le tasse per quarant'anni debba aspettare un anno per un esame oncologico, mentre lo Stato spende centinaia di milioni per mantenere in carcere migliaia di detenuti stranieri. Chi non riceve cure nei tempi di legge deve poter detrarre fino all'ultimo euro speso nel privato.»",
    targetRegions: [
      { region: "Calabria", cdxPct: 53 },
      { region: "Puglia", cdxPct: 46 },
    ],
  },
  "2027-03": {
    eventTitle: "Confini, Flussi Migratori & Bilanci Comunali",
    calendarImpactPp: 0.09,
    calendarExplanation:
      "Con la primavera ripartono sbarchi e Rotta Balcanica: i Comuni denunciano il peso finanziario dei MSNA sui bilanci locali.",
    drivers: [
      {
        title: "Ripresa primaverile degli sbarchi nel Mediterraneo e pressione sulla Rotta Balcanica",
        source: "Scadenze & Fronti · Marzo",
        impactPp: 0.04,
        whyItMatters:
          "I dati Viminale sugli arrivi smentiscono la narrativa governativa e spingono gli elettori delusi verso FN.",
      },
      {
        title: "Bilanci preventivi dei Comuni in crisi per i costi di gestione dei minori stranieri (MSNA)",
        source: "Scadenze & Fronti · Marzo",
        impactPp: 0.02,
        whyItMatters:
          "I sindaci denunciano l'impossibilità di coprire le rette di accoglienza senza tagliare i servizi ai cittadini.",
      },
    ],
    conflictTitle: "Sbarchi e costi MSNA sui Comuni",
    strategicSummary:
      "Con l'arrivo della primavera ripartono i flussi migratori via mare e via terra, mettendo a nudo il fallimento delle promesse di blocco navale e il peso scaricato sui Comuni.",
    triggerCondition:
      "Impennata degli sbarchi o rivolta dei sindaci contro i costi obbligatori per i minori stranieri non accompagnati (MSNA).",
    moves: [
      "1. Attacco politico: Incalzare il Viminale sui numeri reali degli sbarchi e sullo scandalo dei falsi minori che prosciugano i bilanci comunali.",
      "2. Presidio TV & media: Portare in studio i dati di quanto costa l'accoglienza rispetto alle pensioni minime e all'assistenza ai disabili italiani.",
      "3. Piazze prioritarie: Mobilitazione sul confine orientale in Friuli-Venezia Giulia (CDX 57%) e nei porti della Sicilia (CDX 51%).",
    ],
    levers: [
      {
        category: "CONFINI & IMMIGRAZIONE",
        title: "Piano Immigrazione 22 Misure",
        concreteMeasure:
          "Blocco e sequestro delle navi ONG, rimpatri effettivi, abolizione della protezione speciale e test antropometrici sui falsi minori.",
      },
      {
        category: "TUTELA COMUNI",
        title: "Salva-Bilanci Comunali",
        concreteMeasure:
          "Esenzione dei Comuni dall'obbligo finanziario sui MSNA per destinare i fondi comunali ad anziani, disabili e asili nido italiani.",
      },
    ],
    readyStatement:
      "«La realtà dei numeri smentisce la propaganda: gli sbarchi continuano e i sindaci italiani sono costretti a tagliare i servizi agli anziani e ai disabili per pagare rette da 100 euro al giorno a sedicenti minori non accompagnati. Con Futuro Nazionale diciamo stop alle ONG, accertamento rigoroso dell'età e rimpatri immediati.»",
    targetRegions: [
      { region: "Friuli-Venezia Giulia", cdxPct: 57 },
      { region: "Sicilia", cdxPct: 51 },
    ],
  },
  "2027-04": {
    eventTitle: "Territori, Agricoltura & Amministrative",
    calendarImpactPp: 0.09,
    calendarExplanation:
      "Ad aprile entra nel vivo la campagna per le amministrative e la difesa di agricoltori e botteghe contro Mercosur e ZTL punitive.",
    drivers: [
      {
        title: "Deposito liste e apertura della campagna per le Elezioni Amministrative di primavera",
        source: "Scadenze & Fronti · Aprile",
        impactPp: 0.04,
        whyItMatters:
          "La presenza dei comitati FN sui territori trasforma il consenso d'opinione in radicamento strutturato.",
      },
      {
        title: "Scadenze PAC e proteste del comparto agricolo contro il Mercosur e le importazioni sleali",
        source: "Scadenze & Fronti · Aprile",
        impactPp: 0.02,
        whyItMatters:
          "Forte saldatura tra le battaglie di Vannacci a Bruxelles e i distretti agricoli italiani.",
      },
    ],
    conflictTitle: "Amministrative, agricoltura e ZTL",
    strategicSummary:
      "Ad aprile entra nel vivo la sfida per le amministrative e la difesa delle categorie produttive locali: agricoltori, commercianti e artigiani puniti da ZTL e vincoli europei.",
    triggerCondition:
      "Spaccature nel centrodestra locale sulle candidature o mobilitazioni degli agricoltori contro i trattati UE.",
    moves: [
      "1. Attacco politico: Schierare Futuro Nazionale contro i sindaci delle ZTL punitive, degli autovelox-bancomat e delle tasse comunali.",
      "2. Presidio TV & media: Difendere il Made in Italy agricolo e manifatturiero contro il trattato Mercosur, il cibo sintetico e la concorrenza sleale.",
      "3. Piazze prioritarie: Tour capillare nei capoluoghi e nelle province al voto in Piemonte (CDX 51%), Veneto (CDX 59%) e Puglia (CDX 46%).",
    ],
    levers: [
      {
        category: "AGRICOLTURA & MADE IN ITALY",
        title: "Filiera Italia & Stop Mercosur",
        concreteMeasure:
          "Prezzo minimo garantito sopra i costi di produzione, dazi contro la concorrenza sleale extra-UE e bando totale del cibo sintetico.",
      },
      {
        category: "LIBERTÀ DI MOVIMENTO",
        title: "Stop ZTL Ideologiche & Autovelox",
        concreteMeasure:
          "Abolizione dei divieti di circolazione per le auto Euro 4/5 dei lavoratori e taglio delle imposte per le botteghe storiche.",
      },
    ],
    readyStatement:
      "«Nelle province italiane chi lavora e produce viene trattato da nemico: gli agricoltori vengono schiacciati dal Mercosur e dalle importazioni sleali, mentre commercianti e lavoratori vengono multati con ZTL e divieti green. Futuro Nazionale porta nei Comuni la voce di chi produce ricchezza vera e difende il lavoro italiano.»",
    targetRegions: [
      { region: "Veneto", cdxPct: 59 },
      { region: "Piemonte", cdxPct: 51 },
    ],
  },
  "2027-05": {
    eventTitle: "Verifica Elettorale & Appello agli Astenuti",
    calendarImpactPp: 0.12,
    calendarExplanation:
      "Maggio è il mese della verifica: voto amministrativo e dibattito sul DEF polarizzano gli elettori tra promesse tradite e linea sovranista di FN.",
    drivers: [
      {
        title: "Voto amministrativo di primavera e verifica dei rapporti di forza nel centrodestra",
        source: "Scadenze & Fronti · Maggio",
        impactPp: 0.05,
        whyItMatters:
          "La polarizzazione del voto spinge gli elettori delusi da Lega e FdI a dare un segnale politico forte con FN.",
      },
      {
        title: "Documento di Economia e Finanza (DEF) e dibattito sulle spese militari NATO",
        source: "Scadenze & Fronti · Maggio",
        impactPp: 0.03,
        whyItMatters:
          "Il confronto tra tagli interni e impegni militari esteri premia la linea sovranista di Vannacci.",
      },
    ],
    conflictTitle: "Appello agli astenuti e resa dei conti sul DEF",
    strategicSummary:
      "Maggio è il mese della resa dei conti politica: il voto locale e il dibattito sul DEF mettono gli elettori davanti alla scelta tra chi ha tradito le promesse e la coerenza di Futuro Nazionale.",
    triggerCondition:
      "Sprint finale verso le urne amministrative e scontro sul DEF tra spesa sociale interna e spese militari esterne.",
    moves: [
      "1. Attacco politico: Chiamare al voto il grande blocco degli astenuti (oltre il 50%) e gli elettori di destra traditi su fisco, sicurezza e sovranità.",
      "2. Presidio TV & media: Chiudere la campagna mettendo a confronto le promesse del Governo del 2022 con la realtà delle tasse e degli sbarchi del 2027.",
      "3. Piazze prioritarie: Grandi comizi conclusivi a Milano (Lombardia), Verona (Veneto) e Roma (Lazio).",
    ],
    levers: [
      {
        category: "LAVORO & SOVRANITÀ",
        title: "Principio di San Paolo & Fisco Giusto",
        concreteMeasure:
          "Riforma radicale del lavoro contro l'assistenzialismo, tetto al contante a 10.000 € e detassazione degli straordinari.",
      },
      {
        category: "INTERESSE NAZIONALE",
        title: "Prima gli Italiani nei Bilanci dello Stato",
        concreteMeasure:
          "Priorità assoluta a sanità, pensioni minime a 750 € e sicurezza interna rispetto a qualsiasi impegno bellico estero.",
      },
    ],
    readyStatement:
      "«A chi chiedeva il voto promettendo il blocco navale, meno tasse e più sicurezza per poi obbedire a Bruxelles e alla NATO, oggi gli italiani rispondono con la scheda elettorale. Futuro Nazionale è la casa di chi non si rassegna al declino: riprendiamoci la nostra sicurezza, il nostro lavoro e la nostra sovranità.»",
    targetRegions: [
      { region: "Lombardia", cdxPct: 54 },
      { region: "Veneto", cdxPct: 59 },
      { region: "Lazio", cdxPct: 47 },
    ],
  },
};

/** Il feed mescola esteri, cronaca e lifestyle: solo la politica italiana spiega il nostro consenso. */
const ITALIAN_POLITICS_NEWS =
  /vannacci|futuro nazionale|meloni|governo|manovra|legge di bilancio|parlament|\blega\b|salvini|\bfdi\b|fratelli d'italia|centrodestra|sondagg|elezion|tasse|fisco|fiscal|sicurezza|immigra|sbarch|pension|bollett|accise|sanità|liste d'attesa|carcer|regionali/i;

function novDriversFromEvidence(evidence: GrowthEvidence): ForecastNewsDriver[] | null {
  const items = (evidence.newsItems ?? evidence.newsHeadlines.map((title) => ({ title }))).filter(
    (item) => ITALIAN_POLITICS_NEWS.test(item.title),
  );
  if (items.length === 0) return null;

  return items.slice(0, 2).map((item, index) => {
    const outletSplit = item.title.match(/^(.*\S)\s+[|–-]\s+([^|–-]{2,40})$/);
    const title = outletSplit ? outletSplit[1]! : item.title;
    const lower = item.title.toLowerCase();
    const aboutUs = /vannacci|futuro nazionale/.test(lower);
    const declineStory = /flop|frenat|calo|perde|crollo|finit|declin|sgonf|huff/.test(lower);
    let impactPp = 0;
    let whyItMatters = "Tiene in agenda un tema su cui FN ha una posizione riconoscibile.";
    if (declineStory && (aboutUs || /meloni/.test(lower))) {
      impactPp = index === 0 ? -0.03 : -0.02;
      whyItMatters =
        "Racconta un nostro calo: serve a scoraggiare gli indecisi di centrodestra dal passare a FN.";
    } else if (/meloni|rientro|dubbio/.test(lower)) {
      impactPp = -0.02;
      whyItMatters =
        "Tentativo della stampa d'area di frenare i flussi verso FN accreditando un rientro verso FdI.";
    } else if (/liguria|primocanale|regionale|presid/.test(lower)) {
      impactPp = 0.01;
      whyItMatters =
        "Radicamento territoriale nei presidi regionali: mantiene alta l'attenzione sui territori.";
    } else if (aboutUs) {
      whyItMatters = "Parla direttamente di noi: tiene FN al centro del dibattito.";
    } else if (/sondagg/.test(lower)) {
      whyItMatters = "Sondaggio ripreso dalla stampa: conta per come viene raccontato il nostro consenso.";
    }
    const source = /dubbio/.test(lower)
      ? "Il Dubbio"
      : /primocanale/.test(lower)
        ? "Primocanale"
        : /huff/.test(lower)
          ? "HuffPost"
          : (outletSplit?.[2]?.trim() ?? "Notizie di oggi");
    return { title, source, impactPp: round2(impactPp), whyItMatters };
  });
}

function resolvePack(
  monthKey: string,
  evidence: GrowthEvidence,
  calibration: ForecastCalibrationMetrics,
): MonthPack {
  const pack = MONTH_PACKS[monthKey] ?? MONTH_PACKS["2026-11"]!;
  if (monthKey === "2026-11") {
    const live = novDriversFromEvidence(evidence);
    if (live && live.length > 0) {
      return { ...pack, drivers: live };
    }
  }
  void calibration;
  return pack;
}

export function buildFallbackForecastIntelligence(input: {
  startPct: number;
  evidence: GrowthEvidence;
  projection: HorizonProjection;
  calibration: ForecastCalibrationMetrics;
  source?: ForecastIntelligencePayload["source"];
}): ForecastIntelligencePayload {
  const { evidence, projection, calibration } = input;
  const months: ForecastMonthIntelligence[] = projection.timeline.map((item) => {
    const pack = resolvePack(item.monthKey, evidence, calibration);
    const calendarImpactPp = clamp(
      round2(pack.calendarImpactPp * calibration.calendarWeight),
      -0.15,
      0.2,
    );
    return {
      monthKey: item.monthKey,
      monthShort: item.monthShort,
      eventTitle: pack.eventTitle,
      calendarImpactPp,
      whyItMoves: {
        inertiaExplanation: `Pendenza reale ${round2(evidence.slopePpPerMonth * calibration.slopeWeight)
          .toFixed(2)
          .replace(".", ",")} pp/mese (peso adattivo ${calibration.slopeWeight}): il modello raddrizza la curva con bias ${calibration.biasCorrectionPp >= 0 ? "+" : ""}${calibration.biasCorrectionPp.toFixed(2).replace(".", ",")} pp su ${calibration.observationsCount} sondaggi.`,
        calendarExplanation: pack.calendarExplanation,
        newsOrWebDrivers: pack.drivers.slice(0, 2),
      },
      actionPlan: {
        conflictTitle: pack.conflictTitle,
        strategicSummary: pack.strategicSummary,
        triggerCondition: pack.triggerCondition,
        moves: [...pack.moves],
      },
      bipResponse: {
        levers: pack.levers,
        readyStatement: pack.readyStatement,
        targetRegions: pack.targetRegions,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    source: input.source ?? "fallback_model",
    calibration,
    months,
  };
}

export function regionScoresSnapshot(newsHeadlines: string[] = []): Array<{
  region: Region;
  conversionScore: number;
  socialDistress: number;
}> {
  const cards = buildExposurePriorityCards({
    rows: REGIONS.map((regione) => ({
      regione,
      stima: 0,
      voti_di_scenario: 0,
      elettori_ricostruiti: 1,
    })),
    newsHeadlines,
  });
  return cards.map((card) => ({
    region: card.regione,
    conversionScore: card.conversionScore,
    socialDistress: card.socialDistressScore,
  }));
}

export function bipCatalogSnapshot(): Array<{
  id: string;
  shortTitle: string;
  category: string;
}> {
  return BIP_FN_PROMISES_CATALOG.map((p) => ({
    id: p.id,
    shortTitle: p.shortTitle,
    category: p.category,
  }));
}

export { getCalibrationMetrics, MONTH_PACKS };
