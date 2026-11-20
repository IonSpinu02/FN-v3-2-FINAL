import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import {
  bipSolutionBadgeForCategory,
  formatBipSolutionBadge,
  type BipEmergency,
} from "@/lib/engine/bipProblemRadar";
import type {
  ElectoralSubTheme,
  TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";

/** B.I.P. — Base Ideologica e Programmatica (2027–2037), 15 capitoli. */
export type BipChapter = {
  num: number;
  title: string;
  pages: string;
  flagMeasures: string[];
  relatedCategories: TerritoryIssueCategory[];
};

export const BIP_PROGRAM_TITLE =
  "B.I.P. — Base Ideologica e Programmatica di Futuro Nazionale per l'Italia del futuro (2027–2037)";

export const BIP_CHAPTERS: BipChapter[] = [
  {
    num: 1,
    title: "Dottrina economica, fiscalità e previdenza",
    pages: "pp. 6–11",
    relatedCategories: ["LAVORO", "COSTO_VITA", "SANITA"],
    flagMeasures: [
      "Quoziente Familiare e Fattore Famiglia Italia (aliquota sui componenti mantenuti, figli e nonni coabitanti)",
      "Quote Azzurre nei concorsi pubblici per famiglie numerose",
      "Veto sul Bilancio Pluriennale UE per deroga strutturale al Patto di Stabilità (spese demografiche)",
      "Superamento saldo e acconto, IVA per cassa, Flat Tax, abolizione tasse sulla mera proprietà non produttiva",
      "Fondo Sovrano per la Crescita Nazionale, Golden Power, Moneta Fiscale volontaria",
      "Pensioni: 41 anni contributivi effettivi, sconto età per madri, equiparazione TFS/TFR pubblico-privato",
      "Deduzioni integrali spese sanitarie tracciabili",
    ],
  },
  {
    num: 2,
    title: "Lavoro, sussidi e cuneo fiscale",
    pages: "pp. 12–15",
    relatedCategories: ["LAVORO"],
    flagMeasures: [
      "Principio economico di San Paolo: revoca NASpI/assegni a chi rifiuta lavoro compatibile",
      "Impiego risparmi per taglio strutturale del cuneo fiscale",
      "Database Unico di Collocamento Nazionale",
      "Detassazione incrementi salariali e partecipazione lavoratori agli utili",
      "Innalzamento tetto contante a 10.000 €",
    ],
  },
  {
    num: 3,
    title: "Imprese, Made in Italy e filiere",
    pages: "pp. 15–18",
    relatedCategories: ["LAVORO", "TERRITORIO"],
    flagMeasures: [
      "Progetto Filiera Italia e reshoring produttivo",
      "ZES/ZLS strategiche",
      "Blocco accordi sleali (Mercosur)",
      "Potenziamento ferrovia, intermodalità e corridoi logistici ZLS/Porti",
    ],
  },
  {
    num: 4,
    title: "Credito, banche e famiglie",
    pages: "pp. 18–21",
    relatedCategories: ["LAVORO", "COSTO_VITA"],
    flagMeasures: [
      "Riabilitazione creditizia famiglie e PMI",
      "Banche d'interesse nazionale",
      "Tutela impignorabilità conti di sostentamento (stipendi e pensioni)",
    ],
  },
  {
    num: 5,
    title: "Assimilazione e piano di remigrazione (22 misure)",
    pages: "pp. 22–30",
    relatedCategories: ["SICUREZZA"],
    flagMeasures: [
      "Misure 1–3: confini impermeabili, divieto attracco ONG, asilo fuori territorio",
      "Misure 4–6: certificazioni sanitarie rimpatri con medici militari; MSNA alle Prefetture",
      "Misure 7–11: espulsioni accelerate, stop Decreti Flusso massivi",
      "Misure 14–17: ERP e bonus solo cittadini, stop ricongiungimenti, ius sanguinis",
      "Misure 20–22: no ius soli/scholae; 20 anni residenza, lingua C1; revoca cittadinanza",
    ],
  },
  {
    num: 6,
    title: "Istruzione, formazione e merito",
    pages: "pp. 31–41",
    relatedCategories: ["LAVORO", "SICUREZZA"],
    flagMeasures: [
      "Divieto smartphone a scuola e social sotto i 15 anni",
      "Botteghe di Cittadinanza e formazione professionale territoriale",
    ],
  },
  {
    num: 7,
    title: "Sicurezza, ordine pubblico e quartieri",
    pages: "pp. 42–49",
    relatedCategories: ["SICUREZZA"],
    flagMeasures: [
      "Legittima Difesa (artt. 52 e 55 c.p.): proporzionalità presunta in domicilio/lavoro",
      "Divieto assoluto di risarcimento all'aggressore",
      "Tutela Forze dell'Ordine (art. 53 c.p.), scudo legale, contatto e speronamento controllato",
      "Protocollo Modellare, Bonificare, Presidiare e Ricostruire (Forze Armate in quartieri ad alta densità criminale)",
      "Imputabilità minorile da 14 a 12 anni, Daspo urbano fino a 5 anni, Zone Rosse permanenti",
    ],
  },
  {
    num: 8,
    title: "Giustizia rapida e sistema penitenziario",
    pages: "pp. 50–57",
    relatedCategories: ["SICUREZZA"],
    flagMeasures: [
      "Tribunali reati di strada con sentenza entro 90 giorni",
      "Fondo vittime dei reati con indennizzo immediato",
      "Dipartimento autonomo Polizia Penitenziaria, 10.000 posti carcere in 36 mesi",
      "Lavoro intramurario obbligatorio detenuti",
      "Rimpatrio 31,5%–35% detenuti stranieri (~1 mld €/anno)",
    ],
  },
  {
    num: 9,
    title: "Energia, bollette e mobilità",
    pages: "pp. 58–67",
    relatedCategories: ["LAVORO", "TRASPORTI", "COSTO_VITA"],
    flagMeasures: [
      "Ora legale permanente, taglio oneri di sistema in bolletta",
      "Riapertura gas Russia, Nucleare SMR/AMR, idroelettrico e biomasse",
      "Rifiuto Green Deal e Fit for 55; motori termici oltre 2035 con HVO ed e-fuels",
    ],
  },
  {
    num: 10,
    title: "Difesa nazionale e sovranità strategica",
    pages: "pp. 68–78",
    relatedCategories: ["SICUREZZA", "LAVORO"],
    flagMeasures: [
      "No spesa militare al 5% del PIL",
      "No prestito europeo SAFE (debito comune condizionato)",
    ],
  },
  {
    num: 11,
    title: "Digitale, truffe e sussidiarietà comunale",
    pages: "pp. 79–88",
    relatedCategories: ["LAVORO", "COSTO_VITA"],
    flagMeasures: [
      "Cloud Italia immune da FISA/Cloud Act USA",
      "Bollino Impresa Sicura MIMIT (burocrazia GDPR PMI)",
      "Fondo CONSAP risarcimento Over 65 vittime truffe online",
      "Compartecipazione Comuni al gettito IRPEF e aliquota comunale negativa per sindaci virtuosi",
    ],
  },
  {
    num: 12,
    title: "Regioni, federalismo fiscale e servizi",
    pages: "pp. 89–93",
    relatedCategories: ["SANITA", "TRASPORTI"],
    flagMeasures: [
      "Compartecipazione IRPEF territoriale e costi standard con riutilizzo avanzi nelle Regioni virtuose",
    ],
  },
  {
    num: 13,
    title: "Famiglia, casa e natalità",
    pages: "pp. 94–100",
    relatedCategories: ["COSTO_VITA", "SANITA"],
    flagMeasures: [
      "Mutuo Tricolore Consap: tasso azzerato al 3° figlio, moratoria 1 anno a nascita, Burocrazia Zero anagrafe",
      "Reddito di Genitorialità, Reddito di Rinascita, Culla per la Vita",
      "Legge 38/2010 cure palliative e sostegno fiscale/previdenziale caregiver",
      "Quoziente Familiare con nonni coabitanti e Fattore Famiglia Italia",
    ],
  },
  {
    num: 14,
    title: "Sociale, ERP e tutela minori",
    pages: "pp. 100–101",
    relatedCategories: ["COSTO_VITA", "SICUREZZA"],
    flagMeasures: [
      "Priorità italiani nelle case popolari (ERP)",
      "Pensione minima 750 € per indigenti",
      "Indicatori di Performance Etica (EPI) nei servizi sociali",
      "Cantieri di Cittadinanza e divieto social under 15",
    ],
  },
  {
    num: 15,
    title: "Agricoltura, acqua, pesca e caccia",
    pages: "pp. 101–107",
    relatedCategories: ["TERRITORIO"],
    flagMeasures: [
      "Divieto vendita sottocosto, PAC solo ai veri agricoltori",
      "Revisione Codice Doganale UE contro falso Made in Italy",
      "Piano Nazionale dell'Acqua e regimazione Po",
      "Divieto fotovoltaico a terra su suolo agricolo, TEA",
      "Pesca lavoro usurante, data pesca in etichetta",
      "Riforma L. 157/1992 caccia e ricostituzione Corpo Forestale dello Stato",
    ],
  },
];

export type BipMessaging = {
  chapterNum: number;
  chapterTitle: string;
  pages: string;
  badgeLabel: string;
  pressDeclaration: string;
  provvedimento: {
    enteCompetente: string;
    tempiAttuazione: string;
    attoConcreto: string;
  };
};

function chapterByNum(n: number): BipChapter {
  return BIP_CHAPTERS.find((c) => c.num === n) ?? BIP_CHAPTERS[0]!;
}

export function formatBipBadge(chapterNum: number, chapterTitle?: string): string {
  const ch = chapterByNum(chapterNum);
  const title = chapterTitle ?? ch.title;
  const page = ch.pages.replace(/^pp\.\s*/, "");
  return formatBipSolutionBadge(chapterNum, title, page);
}

function pageRefForChapter(chapterNum: number): string {
  return chapterByNum(chapterNum).pages.replace(/^pp\.\s*/, "");
}

const CATEGORY_PRIMARY_CHAPTER: Record<TerritoryIssueCategory, number> = {
  SANITA: 13,
  TRASPORTI: 9,
  LAVORO: 2,
  SICUREZZA: 7,
  COSTO_VITA: 13,
  TERRITORIO: 15,
};

const SUBTHEME_CHAPTER: Partial<Record<ElectoralSubTheme, number>> = {
  immigrazione: 5,
  energia: 9,
  fisco_pmi: 1,
};

const PRESS_BY_CATEGORY: Record<TerritoryIssueCategory, string> = {
  SICUREZZA:
    "L'Italia non è un campo profughi né un laboratorio di impunità: applichiamo il Protocollo «Modellare, Bonificare, Presidiare e Ricostruire» con le Forze Armate nei quartieri ad alta densità criminale (B.I.P. Cap. 7), imputabilità a 12 anni e Daspo urbano fino a 5 anni, Tribunali dei reati di strada entro 90 giorni e Piano Carceri da 10.000 posti con rimpatrio del 35% dei detenuti stranieri (Cap. 8), gestione MSNA riportata alle Prefetture (Cap. 5, Misura 6).",
  SANITA:
    "Nessuno deve morire in lista d'attesa: deduzioni integrali delle spese sanitarie tracciabili (Cap. 1), compartecipazione IRPEF territoriale e costi standard nelle Regioni virtuose (Cap. 12), applicazione integrale della Legge 38/2010 sulle cure palliative e sostegno ai caregiver familiari (Cap. 13).",
  TRASPORTI:
    "Stop agli obblighi Fit for 55 e alla rottamazione forzata: biocarburanti HVO ed e-fuels sul parco circolante (Cap. 9), potenziamento ferrovia, intermodalità e corridoi ZLS/Porti (Cap. 3 e 9).",
  LAVORO:
    "Prima il lavoro che produce: Principio economico di San Paolo per finanziare il taglio del cuneo fiscale (Cap. 2), taglio oneri di sistema in bolletta, ora legale permanente, gas russo e Nucleare SMR (Cap. 9), superamento saldo e acconto, IVA per cassa, tetto contante 10.000 € e Bollino Impresa Sicura MIMIT (Cap. 1, 2, 11).",
  COSTO_VITA:
    "La famiglia italiana al centro: Mutuo Tricolore con tasso azzerato al terzo figlio e moratoria di un anno alla nascita (Cap. 13), Vero Quoziente Familiare con nonni coabitanti (Cap. 1 e 13), Reddito di Genitorialità e di Rinascita, priorità italiani negli ERP, pensione minima a 750 € e Fondo CONSAP anti-truffe Over 65 (Cap. 11, 13, 14).",
  TERRITORIO:
    "Sovranità alimentare e acqua: divieto di vendita sottocosto e PAC solo ai veri agricoltori (Cap. 15), revisione Codice Doganale UE e stop Mercosur (Cap. 3 e 15), Piano Nazionale dell'Acqua con regimazione del Po, divieto fotovoltaico a terra, TEA, pesca usurante e riforma L. 157/1992 con Corpo Forestale dello Stato (Cap. 15).",
};

const PRESS_SUBTHEME: Partial<Record<ElectoralSubTheme, string>> = {
  immigrazione:
    "Confini impermeabili, divieto d'attracco alle ONG, asilo valutato fuori dal territorio nazionale, stop ai Decreti Flusso da 500.000 ingressi, ERP e bonus riservati ai cittadini, no ius soli e ius scholae — 20 anni, lingua C1 e assimilazione alla civiltà greco-romana cristiana (B.I.P. Cap. 5, Misure 1–22).",
  energia:
    "Bollette difendibili: taglio oneri di sistema, ora legale permanente, riapertura acquisto gas dalla Russia, Nucleare SMR/AMR e idroelettrico — rifiuto del Green Deal che impoverisce famiglie e PMI (B.I.P. Cap. 9).",
  fisco_pmi:
    "Flat Tax, IVA per cassa, superamento saldo e acconto, Moneta Fiscale volontaria e Fondo Sovrano per la Crescita: fiscalità al servizio della produzione, non della mera proprietà (B.I.P. Cap. 1).",
};

const PROV_BY_CATEGORY: Record<
  TerritoryIssueCategory,
  BipMessaging["provvedimento"]
> = {
  SICUREZZA: {
    enteCompetente: "Governo / Ministero Difesa · Prefettura · Ministero Giustizia",
    tempiAttuazione: "Immediato: 15–90 giorni · Legge di Bilancio",
    attoConcreto:
      "Decreto-legge: attivazione Protocollo «Modellare, Bonificare, Presidiare e Ricostruire»; riforma imputabilità a 12 anni; Daspo urbano quinquennale e Zone Rosse; tribunali strada 90 giorni; avvio Piano Carceri 10.000 posti e rimpatrio detenuti stranieri; MSNA in capo alle Prefetture (Cap. 5–8).",
  },
  SANITA: {
    enteCompetente: "Governo · Regioni · INPS",
    tempiAttuazione: "Immediato: 45–90 giorni · Legge di Bilancio",
    attoConcreto:
      "Manovra: deduzioni integrali spese sanitarie tracciabili; delibere regionali su costi standard e compartecipazione IRPEF; decreto attuativo Legge 38/2010 cure palliative e caregiver (Cap. 1, 12, 13).",
  },
  TRASPORTI: {
    enteCompetente: "MIT · Regioni · MASE",
    tempiAttuazione: "Immediato: 30–60 giorni · Piano industriale",
    attoConcreto:
      "Disegno di legge: moratoria obblighi Fit for 55/2035; piano biocarburanti HVO ed e-fuels; contratti di servizio ferroviari e corridoi logistici ZLS/Porti (Cap. 3, 9).",
  },
  LAVORO: {
    enteCompetente: "Governo · MIMIT · Agenzia del Lavoro",
    tempiAttuazione: "Legge di Bilancio · 60 giorni",
    attoConcreto:
      "DDL lavoro e fiscalità: Principio di San Paolo su NASpI; Database Unico Collocamento; taglio oneri bolletta; tetto contante 10.000 €; Bollino Impresa Sicura MIMIT (Cap. 1, 2, 9, 11).",
  },
  COSTO_VITA: {
    enteCompetente: "Governo · CONSAP · INPS · Comuni",
    tempiAttuazione: "Legge di Bilancio · 6 mesi",
    attoConcreto:
      "Pacchetto famiglia: Mutuo Tricolore (tasso 0% al 3° figlio), Quoziente Familiare, Reddito di Genitorialità/Rinascita, ERP priorità italiani, pensione minima 750 €, Fondo CONSAP truffe Over 65 (Cap. 11, 13, 14).",
  },
  TERRITORIO: {
    enteCompetente: "MASE · MASAF · Regioni",
    tempiAttuazione: "Immediato: 60 giorni · PAC e PNRR",
    attoConcreto:
      "Manovra agricola e idrica: divieto sottocosto, PAC a imprenditori agricoli, revisione doganale anti-falso Made in Italy, Piano Nazionale Acqua/Po, divieto FV a terra, TEA, riforma L. 157/1992 e Corpo Forestale (Cap. 3, 15).",
  },
};

export function resolveBipChapterForIssue(
  category: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
): number {
  if (electoralSubTheme && SUBTHEME_CHAPTER[electoralSubTheme]) {
    return SUBTHEME_CHAPTER[electoralSubTheme]!;
  }
  return CATEGORY_PRIMARY_CHAPTER[category];
}

export function getBipMessaging(
  category: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
  emergency?: BipEmergency | null,
): BipMessaging {
  const chapterNum =
    emergency?.primaryChapter ?? resolveBipChapterForIssue(category, electoralSubTheme);
  const ch = chapterByNum(chapterNum);
  const chapterTitle = emergency?.chapterTitle ?? ch.title;
  const pageRef = emergency?.pageRef ?? pageRefForChapter(chapterNum);
  const pressDeclaration =
    (electoralSubTheme && PRESS_SUBTHEME[electoralSubTheme]) ??
    PRESS_BY_CATEGORY[category];
  return {
    chapterNum,
    chapterTitle,
    pages: ch.pages,
    badgeLabel: formatBipSolutionBadge(chapterNum, chapterTitle, pageRef),
    pressDeclaration,
    provvedimento: PROV_BY_CATEGORY[category],
  };
}

/** Badge standard per categoria / sottotema (card e trends). */
export function getBipSolutionBadgeLabel(
  category: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
): string {
  return bipSolutionBadgeForCategory(category, electoralSubTheme);
}

export type FnBipPromise = {
  id: string;
  shortTitle: string;
  category: TerritoryIssueCategory;
  testo: string;
  bipChapter: number;
  bipChapterTitle: string;
  bipPages: string;
  bipReference: string;
};

export const BIP_FN_PROMISES_CATALOG: FnBipPromise[] = [
  {
    id: "BIP.07",
    shortTitle: "SICUREZZA · Protocollo Modellare, Bonificare, Presidiare e Ricostruire",
    category: "SICUREZZA",
    bipChapter: 7,
    bipChapterTitle: "Sicurezza, ordine pubblico e quartieri",
    bipPages: "pp. 42–49",
    bipReference: "B.I.P. Cap. 7",
    testo:
      "Protocollo «Modellare, Bonificare, Presidiare e Ricostruire» con Forze Armate in quartieri ad alta densità criminale; Legittima Difesa con proporzionalità presunta; scudo integrale FdO; imputabilità a 12 anni, Daspo 5 anni, Zone Rosse permanenti (Cap. 7–8).",
  },
  {
    id: "BIP.05",
    shortTitle: "IMMIGRAZIONE · Piano remigrazione 22 misure",
    category: "SICUREZZA",
    bipChapter: 5,
    bipChapterTitle: "Assimilazione e remigrazione",
    bipPages: "pp. 22–30",
    bipReference: "B.I.P. Cap. 5",
    testo:
      "Confini impermeabili, stop ONG, asilo fuori territorio, MSNA alle Prefetture, stop Decreti Flusso, ERP e bonus solo cittadini, no ius soli/scholae (Cap. 5).",
  },
  {
    id: "BIP.02",
    shortTitle: "LAVORO · San Paolo & Filiera Italia",
    category: "LAVORO",
    bipChapter: 2,
    bipChapterTitle: "Lavoro, sussidi e cuneo fiscale",
    bipPages: "pp. 12–21",
    bipReference: "B.I.P. Cap. 2–4",
    testo:
      "Principio economico di San Paolo, Database Unico Collocamento, Filiera Italia, stop Mercosur, riabilitazione creditizia PMI, tetto contante 10.000 € (Cap. 2–4).",
  },
  {
    id: "BIP.09",
    shortTitle: "ENERGIA · Bollette & HVO / e-fuels",
    category: "LAVORO",
    bipChapter: 9,
    bipChapterTitle: "Energia, bollette e mobilità",
    bipPages: "pp. 58–67",
    bipReference: "B.I.P. Cap. 9",
    testo:
      "Taglio oneri di sistema, ora legale permanente, gas russo, Nucleare SMR, rifiuto Fit for 55 con HVO ed e-fuels senza rottamazione forzata (Cap. 9).",
  },
  {
    id: "BIP.13-SAN",
    shortTitle: "SANITÀ · Liste d'attesa & Legge 38/2010",
    category: "SANITA",
    bipChapter: 13,
    bipChapterTitle: "Famiglia, casa e natalità",
    bipPages: "pp. 94–100",
    bipReference: "B.I.P. Cap. 1, 12, 13",
    testo:
      "Deduzioni integrali spese sanitarie tracciabili (Cap. 1), compartecipazione IRPEF e costi standard regionali (Cap. 12), Legge 38/2010 cure palliative e caregiver (Cap. 13).",
  },
  {
    id: "BIP.09-TR",
    shortTitle: "TRASPORTI · Ferrovia & no Fit for 55",
    category: "TRASPORTI",
    bipChapter: 9,
    bipChapterTitle: "Energia, bollette e mobilità",
    bipPages: "pp. 58–67",
    bipReference: "B.I.P. Cap. 3, 9",
    testo:
      "Potenziamento ferrovia e intermodalità ZLS/Porti (Cap. 3); stop obblighi 2035, HVO ed e-fuels (Cap. 9).",
  },
  {
    id: "BIP.13-CV",
    shortTitle: "CARO-VITA · Mutuo Tricolore & ERP",
    category: "COSTO_VITA",
    bipChapter: 13,
    bipChapterTitle: "Famiglia, casa e natalità",
    bipPages: "pp. 94–100",
    bipReference: "B.I.P. Cap. 11, 13, 14",
    testo:
      "Mutuo Tricolore Consap (0% al 3° figlio), Quoziente Familiare, Reddito di Genitorialità/Rinascita, ERP priorità italiani, pensione minima 750 €, Fondo CONSAP truffe Over 65.",
  },
  {
    id: "BIP.15",
    shortTitle: "TERRITORIO · Acqua, PAC & Corpo Forestale",
    category: "TERRITORIO",
    bipChapter: 15,
    bipChapterTitle: "Agricoltura, acqua, pesca e caccia",
    bipPages: "pp. 101–107",
    bipReference: "B.I.P. Cap. 15",
    testo:
      "Divieto sottocosto, PAC ai veri agricoltori, Piano Nazionale Acqua/Po, divieto FV a terra, TEA, riforma L. 157/1992 e Corpo Forestale dello Stato.",
  },
  {
    id: "BIP.09-EN",
    shortTitle: "ENERGIA · Bollette sovrane",
    category: "COSTO_VITA",
    bipChapter: 9,
    bipChapterTitle: "Energia, bollette e mobilità",
    bipPages: "pp. 58–67",
    bipReference: "B.I.P. Cap. 9",
    testo:
      "Taglio oneri di sistema in bolletta, ora legale permanente, riapertura gas Russia, Nucleare SMR/AMR (Cap. 9).",
  },
];

const REGION_CATEGORY_PRIORITY: Record<Region, TerritoryIssueCategory[]> = Object.fromEntries(
  REGIONS.map((r) => {
    const s = r.length + r.charCodeAt(0);
    const base: TerritoryIssueCategory[] = [
      "SANITA",
      "LAVORO",
      "COSTO_VITA",
      "TRASPORTI",
      "SICUREZZA",
      "TERRITORIO",
    ];
    const rot = s % 6;
    const ordered = [...base.slice(rot), ...base.slice(0, rot)];
    if (r === "Lombardia" || r === "Veneto" || r === "Emilia-Romagna") {
      return [r, ["LAVORO", "TRASPORTI", "COSTO_VITA", "SANITA", "SICUREZZA", "TERRITORIO"]];
    }
    if (r === "Sicilia" || r === "Calabria" || r === "Campania") {
      return [r, ["COSTO_VITA", "LAVORO", "SANITA", "SICUREZZA", "TERRITORIO", "TRASPORTI"]];
    }
    if (r === "Puglia" || r === "Basilicata") {
      return [r, ["TERRITORIO", "LAVORO", "SANITA", "COSTO_VITA", "SICUREZZA", "TRASPORTI"]];
    }
    if (r === "Lazio") {
      return [r, ["SANITA", "TRASPORTI", "COSTO_VITA", "SICUREZZA", "LAVORO", "TERRITORIO"]];
    }
    return [r, ordered];
  }),
) as Record<Region, TerritoryIssueCategory[]>;

export type BipChapterRegionalView = BipChapter & {
  priorityRank: number;
  highlighted: boolean;
};

export function orderedBipChaptersForRegion(
  region: Region | "NAZIONALE",
): BipChapterRegionalView[] {
  const cats =
    region === "NAZIONALE"
      ? (["LAVORO", "SANITA", "COSTO_VITA", "SICUREZZA", "TRASPORTI", "TERRITORIO"] as const)
      : REGION_CATEGORY_PRIORITY[region];
  const scores = BIP_CHAPTERS.map((ch) => {
    let score = 0;
    for (let i = 0; i < cats.length; i++) {
      if (ch.relatedCategories.includes(cats[i]!)) {
        score += (6 - i) * 3;
      }
    }
    return { ch, score };
  });
  scores.sort((a, b) => b.score - a.score || a.ch.num - b.ch.num);
  return scores.map(({ ch, score }, idx) => ({
    ...ch,
    priorityRank: idx + 1,
    highlighted: idx < 6 && score > 0,
  }));
}

export function bipSoluzionePraticaForCategory(
  category: TerritoryIssueCategory,
  electoralSubTheme?: ElectoralSubTheme | null,
): string {
  const msg = getBipMessaging(category, electoralSubTheme);
  return msg.provvedimento.attoConcreto;
}

export function bipAzioneCampoForCategory(
  category: TerritoryIssueCategory,
): string {
  const msg = getBipMessaging(category);
  return `Conferenza stampa territoriale con scheda Cap. ${msg.chapterNum} (${msg.pages}).`;
}
