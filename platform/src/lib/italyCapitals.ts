import type { Region } from "@/lib/engine/constants";

export type CapitalMeta = {
  city: string;
  coordinates: [number, number];
};

/** Capoluoghi di regione — coordinate [lon, lat] WGS84. */
export const ITALY_CAPITALS: Record<Region, CapitalMeta> = {
  Piemonte: { city: "Torino", coordinates: [7.6869, 45.0703] },
  "Valle d'Aosta": { city: "Aosta", coordinates: [7.3201, 45.7372] },
  Lombardia: { city: "Milano", coordinates: [9.19, 45.4642] },
  "Trentino-Alto Adige": { city: "Trento", coordinates: [11.1211, 46.0748] },
  Veneto: { city: "Venezia", coordinates: [12.3155, 45.4408] },
  "Friuli-Venezia Giulia": { city: "Trieste", coordinates: [13.7768, 45.6495] },
  Liguria: { city: "Genova", coordinates: [8.9463, 44.4056] },
  "Emilia-Romagna": { city: "Bologna", coordinates: [11.3426, 44.4949] },
  Toscana: { city: "Firenze", coordinates: [11.2558, 43.7696] },
  Umbria: { city: "Perugia", coordinates: [12.3908, 43.1107] },
  Marche: { city: "Ancona", coordinates: [13.5189, 43.6158] },
  Lazio: { city: "Roma", coordinates: [12.4964, 41.9028] },
  Abruzzo: { city: "L'Aquila", coordinates: [13.3995, 42.3498] },
  Molise: { city: "Campobasso", coordinates: [14.6684, 41.56] },
  Campania: { city: "Napoli", coordinates: [14.2681, 40.8518] },
  Puglia: { city: "Bari", coordinates: [16.8719, 41.1171] },
  Basilicata: { city: "Potenza", coordinates: [15.8056, 40.6404] },
  Calabria: { city: "Catanzaro", coordinates: [16.5877, 38.9098] },
  Sicilia: { city: "Palermo", coordinates: [13.3615, 38.1157] },
  Sardegna: { city: "Cagliari", coordinates: [9.1217, 39.2238] },
};

export const FLOW_HUB: [number, number] = ITALY_CAPITALS.Lazio.coordinates;

export const FLOW_SPOKES: Region[] = [
  "Lombardia",
  "Piemonte",
  "Veneto",
  "Campania",
  "Sicilia",
  "Puglia",
  "Emilia-Romagna",
  "Toscana",
];
