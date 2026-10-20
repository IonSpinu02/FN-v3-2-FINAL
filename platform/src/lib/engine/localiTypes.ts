import type { Region } from "./constants";
import type { InstitutionalRow } from "./calculate";

export type CaricaLocale = keyof InstitutionalRow;

export type LocalEventType =
  | "ingresso_fn"
  | "uscita_fn"
  | "cambio_giunta";

export interface LocalRegistryEntry {
  id: string;
  comune: string;
  regione: Region;
  carica: CaricaLocale;
  /** true se la carica è attribuita a FN (conteggio nel rollup istituzionale) */
  partito_fn: boolean;
  note?: string;
  ultimo_aggiornamento?: string;
}

export interface LocalApprovedEvent {
  id: string;
  registryId: string;
  tipo: LocalEventType;
  data: string;
  fonte: string;
  url?: string;
  titolo: string;
}

export interface LocaliRegistryFile {
  version: 1;
  entries: LocalRegistryEntry[];
}

export interface LocaliEventsFile {
  version: 1;
  events: LocalApprovedEvent[];
}

export interface NewsCandidate {
  id: string;
  titolo: string;
  link: string;
  pubDate: string | null;
  snippet: string;
  matchedKeywords: string[];
  comuneGuess?: string;
  regioneGuess?: Region;
  suggestedAction?: LocalEventType;
  feedUrl: string;
  suggestedRegion?: Region;
  suggestedComune?: string;
  suggestedRole?: CaricaLocale;
}

export interface IstituzioniDeltaSummary {
  byRegion: Partial<
    Record<
      Region,
      Partial<InstitutionalRow> & { config: Partial<InstitutionalRow>; registry: Partial<InstitutionalRow> }
    >
  >;
  hasChanges: boolean;
}
