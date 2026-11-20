import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";

type FlagshipCluster =
  | "FAMIGLIA_CASA"
  | "LAVORO_AUTO_GREEN"
  | "SICUREZZA_CITTA"
  | "TRASPORTI_PENDOLARI"
  | "AGRICOLTURA_TERRITORIO";

type FlagshipQueryType = "Termine di ricerca testuale" | "Argomento riconosciuto da Google";

/** Solo query cittadine con soluzione distintiva nel B.I.P. */
export type BipFlagshipTrendTemplate = {
  slug: string;
  cluster: FlagshipCluster;
  pillarLabel: string;
  exactQuery: string;
  queryType: FlagshipQueryType;
  category: TerritoryIssueCategory;
  fixedSurgePct: number;
  fixedIndex: number;
  relatedQueries: [string, string, string, string];
  datoBase: string;
  causaRadice: string;
  soluzioneBip: string;
  enteCompetente: string;
  tempiAttuazione: string;
  azioneSulCampo48h: string;
};

export const BIP_FLAGSHIP_TREND_TEMPLATES: BipFlagshipTrendTemplate[] = [
  {
    slug: "mutuo-prima-casa-under-35",
    cluster: "FAMIGLIA_CASA",
    pillarLabel: "FAMIGLIA",
    exactQuery: "tassi mutuo prima casa giovani under 35",
    queryType: "Termine di ricerca testuale",
    category: "COSTO_VITA",
    fixedSurgePct: 142,
    fixedIndex: 100,
    relatedQueries: [
      "fondo consap prima casa requisiti",
      "mutuo 100 per cento giovani coppie",
      "costo medio bilocale mutuo",
      "agevolazioni acquisto prima casa figli",
    ],
    datoBase:
      "Casa media 180.000–250.000 € vs redditi giovanili 24.000–28.000 € lordi; fecondità 1,14 figli/donna (B.I.P. Cap. 13, pp. 89–94).",
    causaRadice:
      "Giovani coppie escluse dal mutuo e natalità al collasso spingono ricerche su tassi e garanzie pubbliche.",
    soluzioneBip:
      'Mutuo Tricolore (Cap. 13, p. 94): gara Consap con tasso che scende al 1° e 2° figlio e si azzera (0%) al 3° figlio, moratoria 1 anno a ogni nascita, attivazione automatica anagrafe (Burocrazia Zero).',
    enteCompetente: "Governo · CONSAP · INPS",
    tempiAttuazione: "Legge di Bilancio · 6 mesi",
    azioneSulCampo48h:
      "Sportello FN con simulatore Mutuo Tricolore; conferenza stampa con famiglie in coda al CAF.",
  },
  {
    slug: "bollette-oneri-sistema",
    cluster: "LAVORO_AUTO_GREEN",
    pillarLabel: "LAVORO & ENERGIA",
    exactQuery: "rincaro bollette luce gas oneri di sistema",
    queryType: "Termine di ricerca testuale",
    category: "COSTO_VITA",
    fixedSurgePct: 128,
    fixedIndex: 92,
    relatedQueries: [
      "taglio oneri di sistema bolletta",
      "ora legale tutto l'anno risparmio",
      "direttiva case green obbligo caldaia",
      "costo energia piccole imprese",
    ],
    datoBase:
      "Dispacciamento e incentivi rinnovabili in bolletta; >60% patrimonio edilizio pre-1980 sotto direttive UE (B.I.P. Cap. 9, pp. 58–61).",
    causaRadice:
      "Oneri di sistema e obblighi Case Green alimentano ricerche disperate su bollette e caldaie.",
    soluzioneBip:
      "Piano Energia Sovrana (Cap. 9, pp. 58–65): stop incentivi non autosostenibili in bolletta, ora legale permanente, gas Russia, Nucleare SMR/AMR, idroelettrico ripompaggio, stop direttiva Case Green.",
    enteCompetente: "Governo · MASE · ARERA",
    tempiAttuazione: "Decreto-legge · 30–60 giorni",
    azioneSulCampo48h:
      "Volantino «bolletta prima/dopo taglio oneri»; tavolo PMI con schema decreto Cap. 9.",
  },
  {
    slug: "baby-gang-legittima-difesa",
    cluster: "SICUREZZA_CITTA",
    pillarLabel: "SICUREZZA",
    exactQuery: "baby gang furti stazione e legittima difesa",
    queryType: "Termine di ricerca testuale",
    category: "SICUREZZA",
    fixedSurgePct: 119,
    fixedIndex: 85,
    relatedQueries: [
      "minorenni non imputabili sotto 14 anni",
      "risarcimento ladro legittima difesa",
      "esercito nelle stazioni e periferie",
      "daspo urbano spacciatori",
    ],
    datoBase:
      "Impunità sotto i 14 anni; carceri al 138% Italia (>200% San Vittore); rapine e omicidi — B.I.P. Cap. 5, 7, 8.",
    causaRadice:
      "Baby gang e insicurezza in stazione spingono ricerche su impunità, Legittima Difesa e presidi militari.",
    soluzioneBip:
      "Pacchetto Sicurezza (Cap. 7 & 8, pp. 42–55): imputabilità a 12 anni, protocollo «Modellare, Bonificare, Presidiare e Ricostruire», Legittima Difesa artt. 52-55 c.p., tribunali strada 90 giorni, rimpatrio 35% detenuti stranieri.",
    enteCompetente: "Governo · Difesa · Prefettura · Giustizia",
    tempiAttuazione: "Immediato: 15–90 giorni",
    azioneSulCampo48h:
      "Presidio stazione con scheda Cap. 7; incontro commercianti e sindacati FdO.",
  },
  {
    slug: "erp-msna-comuni",
    cluster: "SICUREZZA_CITTA",
    pillarLabel: "IMMIGRAZIONE & COMUNI",
    exactQuery: "graduatorie case popolari e costi minori stranieri comuni",
    queryType: "Termine di ricerca testuale",
    category: "SICUREZZA",
    fixedSurgePct: 112,
    fixedIndex: 79,
    relatedQueries: [
      "requisiti case popolari priorità italiani",
      "bilancio comune spesa minori stranieri",
      "stop ricongiungimenti familiari",
      "decreto flussi quote ingressi",
    ],
    datoBase:
      "Onere MSNA sui bilanci comunali e welfare locale — B.I.P. Cap. 5 & 14, pp. 26–28, 96.",
    causaRadice:
      "Cittadini cercano priorità ERP e costi MSNA quando i Comuni tagliano servizi.",
    soluzioneBip:
      "Remigrazione 22 Misure (Cap. 5, pp. 24–30): MSNA alle Prefetture con radiografia età (5-6), priorità italiani ERP, stop ricongiungimenti (15), compartecipazione IRPEF Comuni (Cap. 12).",
    enteCompetente: "Governo · Interno · Comuni",
    tempiAttuazione: "Decreto-legge · 60 giorni",
    azioneSulCampo48h:
      "Conferenza con sindaci; dossier Misure 14-15 e delibera tipo Prefettura MSNA.",
  },
  {
    slug: "blocco-diesel-euro5-hvo",
    cluster: "TRASPORTI_PENDOLARI",
    pillarLabel: "TRASPORTI",
    exactQuery: "blocco auto diesel euro 5 e rincaro assicurazione",
    queryType: "Termine di ricerca testuale",
    category: "TRASPORTI",
    fixedSurgePct: 104,
    fixedIndex: 73,
    relatedQueries: [
      "deroga blocco euro 5 regione",
      "biocarburante HVO diesel compatibilità",
      "stop motori termici 2035 rinvio",
      "ritardi treni regionali rimborso",
    ],
    datoBase:
      "Fit for 55 e scadenze 2035 penalizzano pendolari e automotive — B.I.P. Cap. 9, pp. 65–66.",
    causaRadice:
      "Multe Euro 5 e assicurazioni spingono ricerche su deroghe, HVO e rinvio 2035.",
    soluzioneBip:
      "Pluralità tecnologica (Cap. 9, pp. 65–66): HVO ed e-fuels senza rottamazione obbligatoria, potenziamento ferrovia/TPL e corridoi ZLS.",
    enteCompetente: "MIT · Regioni · MASE",
    tempiAttuazione: "Legge · 6 mesi",
    azioneSulCampo48h:
      "Punto ascolto autotrasportatori; emendamento moratoria LEZ con tabella HVO.",
  },
  {
    slug: "cinghiali-fv-agricoltura",
    cluster: "AGRICOLTURA_TERRITORIO",
    pillarLabel: "AGRICOLTURA",
    exactQuery: "danni cinghiali agricoltura, fotovoltaico su terreni e prezzo latte grano",
    queryType: "Termine di ricerca testuale",
    category: "TERRITORIO",
    fixedSurgePct: 96,
    fixedIndex: 68,
    relatedQueries: [
      "prezzo grano latte sotto costi produzione",
      "divieto pannelli solari terreni agricoli",
      "emergenza cinghiali riforma legge 157",
      "invasi acqua siccità agricoltura",
    ],
    datoBase:
      "Vendite sottocosto, falso Made in Italy, FV a terra, fauna selvatica — B.I.P. Cap. 15, pp. 101–107.",
    causaRadice:
      "Produttori cercano tutele su prezzi, suolo agricolo e danni fauna.",
    soluzioneBip:
      "Sovranità Alimentare (Cap. 15, pp. 101–107): divieto sottocosto, PAC veri agricoltori, revisione Codice Doganale UE, divieto FV a terra, Piano Acqua/Po, riforma L. 157/1992 e Corpo Forestale.",
    enteCompetente: "MASAF · MASE · Regioni",
    tempiAttuazione: "Manovra · 60 giorni",
    azioneSulCampo48h:
      "Sopralluogo azienda agricola con scheda Cap. 15; tavolo Coldiretti locale.",
  },
];
