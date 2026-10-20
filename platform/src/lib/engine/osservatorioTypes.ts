import type { Region } from "./constants";

export type DatoNatura =
  | "osservato"
  | "ricostruito"
  | "ipotesi"
  | "simulazione";

export type EventoLivello = "attenzione" | "valutazione" | "voto_dichiarato";

export type EventoVerificaStato =
  | "draft"
  | "documentato"
  | "in_analisi"
  | "chiuso";

/** Regola comune — 8 campi obbligatori (Osservatorio.docx §1). */
export interface MetadatiDato {
  fonte: string;
  territorio: string;
  popolazioneRiferimento: string;
  periodoMisurato: string;
  dataPubblicazione: string;
  metodo: string;
  naturaDato: DatoNatura;
  gradoConfrontabilita: string;
}

export interface FabbisognoIndicatore {
  id: string;
  tema: string;
  indicatore: string | null;
  valore: number | string | null;
  unita: string | null;
  periodoRiferimento: string | null;
  metadati: MetadatiDato;
}

export interface PrioritaDichiarateRilevazione {
  regione: Region;
  campioneN: number;
  metodoSelezione: string;
  mancataRispostaPct: number;
  margineIncertezzaPct: number;
  periodoRilevazione: string;
  /** Aggregati questionario neutrale (5 domande doc §4) */
  q1_problemiTerritorio?: string;
  q2_difficoltaPersonali?: string;
  q3_soddisfazioneServizi?: string;
  q4_urgenzaSoluzioni?: string;
  q5_intenzioneVotoFacoltativa?: string;
}

export interface FabbisogniRegione {
  indicatori: FabbisognoIndicatore[];
  prioritaDichiarate: {
    stato: "non_rilevato" | "parziale" | "rilevato";
    nota: string;
    campione?: number;
    periodo?: string;
  };
}

export interface FabbisogniCatalogFile {
  version: 1;
  updatedAt: string;
  regions: Partial<Record<Region, FabbisogniRegione>>;
}

export interface OsservatorioEvento {
  id: string;
  titolo: string;
  data: string;
  ora?: string;
  regione?: Region;
  provincia?: string;
  tema: string;
  livello: EventoLivello;
  fontePrimaria: string;
  url?: string;
  finestraPreGiorni: number;
  finestraPostGiorni: number;
  finestraExtraGiorni?: number[];
  statoVerifica: EventoVerificaStato;
  eventiConcorrenti?: string;
  notaMetodologica: string;
  sondaggioComparabile?: "non_disponibile" | "pre_post_pianificato" | "disponibile";
}

export interface OsservatorioEventsFile {
  version: 1;
  events: OsservatorioEvento[];
}

export interface GoogleTrendsPoint {
  date: string;
  value: number;
}

export interface GoogleTrendsSeries {
  id: string;
  query: string;
  queryType: "term" | "topic";
  territory: string;
  windowStart: string;
  windowEnd: string;
  extractedAt: string;
  isDemo?: boolean;
  points: GoogleTrendsPoint[];
}

export type PrioritaDichiarateByRegion = Partial<
  Record<Region, PrioritaDichiarateRilevazione>
>;

export type MonthlyNotesByRegion = Partial<Record<Region, string>>;

export interface OsservatorioCloudPayload {
  events: OsservatorioEvento[];
  trendsSeries: GoogleTrendsSeries[];
  prioritaDichiarate: PrioritaDichiarateByRegion;
  monthlyNotes: MonthlyNotesByRegion;
}

export interface SchedaMensileRiga {
  dimensione: string;
  indicatoreStato: string;
  nota: string;
}
