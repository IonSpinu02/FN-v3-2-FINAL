import type { Region } from "./constants";

export type TerritoryIssueCategory =
  | "SANITA"
  | "TRASPORTI"
  | "LAVORO"
  | "SICUREZZA"
  | "COSTO_VITA"
  | "TERRITORIO";

export type ElectoralSubTheme = "immigrazione" | "energia" | "fisco_pmi";

export type TerritoryIssueContentSource = "catalog" | "live" | "blended";

export type TerritoryIssueVerification = "fallback" | "auto" | "editorial";

export type TerritoryIssueEvidence = {
  title: string;
  snippet: string;
  url: string;
  pubDate: string | null;
  feedHint?: string;
};

export type TerritoryIssueAction = {
  doveAndare: string;
  cosaDire: string;
};

export type TerritoryIssueConversion = {
  potentialGainPp: number;
  potentialNewVotes: number;
  campaignVerdict: "PRIORITA_ASSOLUTA" | "PRESIDIO_MIRATO" | "SCONSIGLIATO_MURO_PD";
  campaignVerdictText: string;
  conversionBadge: "ALTA" | "MIRATA" | "MURO_PD";
  fnPromise: {
    id: string;
    shortTitle: string;
    category: TerritoryIssueCategory;
    testo: string;
    bipChapter?: number;
    bipChapterTitle?: string;
    bipPages?: string;
    bipReference?: string;
  };
  voteSourceMix: string;
};

export type TerritoryIssue = {
  id: string;
  regione: Region | "NAZIONALE";
  provinciaComune: string;
  categoria: TerritoryIssueCategory;
  titoloProblema: string;
  sintesiLamentela: string;
  canaleVirale: string;
  visualizzazioniStimate: string;
  impattoScore: number;
  datoUfficialeModuloB: string;
  azionePoliticaConsigliata: TerritoryIssueAction;
  sourceUrl: string;
  pubDate: string | null;
  live?: boolean;
  conversion?: TerritoryIssueConversion;
  contentSource?: TerritoryIssueContentSource;
  verification?: TerritoryIssueVerification;
  evidence?: TerritoryIssueEvidence;
  electoralSubTheme?: ElectoralSubTheme | null;
  /** Ranking interno potenziale seggi (non percentuale voto). */
  electionScore?: number;
  /** Stress ISTAT/fabbisogni 0–100 per macro-tema in regione. */
  categoryStress?: number;
  /** Emergenza B.I.P. collegata (radar programma-driven). */
  bipEmergencyId?: string;
  /** Badge tracciabilità soluzione ufficiale. */
  bipSolutionBadge?: string;
  /** Una o più misure B.I.P. applicabili allo stesso problema. */
  bipSolutions?: BipSolutionSlide[];
};

export type BipSolutionSlide = {
  emergencyId: string;
  capRef: string;
  /** Provvedimento tecnico (box 3). */
  measures: string;
  badgeLabel?: string;
  pressDeclaration?: string;
};

export const TERRITORY_ISSUE_CATEGORIES: TerritoryIssueCategory[] = [
  "SANITA",
  "TRASPORTI",
  "LAVORO",
  "SICUREZZA",
  "COSTO_VITA",
  "TERRITORIO",
];

/** Sei macro-temi elettorali per regione (cockpit). */
export const REGIONAL_ELECTORAL_CATS: TerritoryIssueCategory[] = [
  "SANITA",
  "TRASPORTI",
  "LAVORO",
  "SICUREZZA",
  "COSTO_VITA",
  "TERRITORIO",
];

export function categoryLabel(c: TerritoryIssueCategory): string {
  const map: Record<TerritoryIssueCategory, string> = {
    SANITA: "Sanità, Pronto Soccorso e Liste d'Attesa",
    TRASPORTI: "Trasporti, Pendolari, Strade e Infrastrutture",
    LAVORO: "Lavoro, Crisi Aziendali, Stipendi e Imprese",
    SICUREZZA: "Sicurezza Urbana, Degrado e Legalità",
    COSTO_VITA: "Caro-Vita, Affitti, Mutui e Bollette",
    TERRITORIO: "Agricoltura, Ambiente, Dissesto e Aree Interne",
  };
  return map[c];
}
