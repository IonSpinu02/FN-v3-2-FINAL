import type { Region } from "./constants";

/** Codici geo Google Trends (ISO 3166-2:IT). */
export const GOOGLE_TRENDS_GEO: Record<Region | "NAZIONALE", string> = {
  NAZIONALE: "IT",
  Abruzzo: "IT-65",
  Basilicata: "IT-77",
  Calabria: "IT-78",
  Campania: "IT-72",
  "Emilia-Romagna": "IT-45",
  "Friuli-Venezia Giulia": "IT-36",
  Lazio: "IT-62",
  Liguria: "IT-42",
  Lombardia: "IT-25",
  Marche: "IT-57",
  Molise: "IT-67",
  Piemonte: "IT-21",
  Puglia: "IT-75",
  Sardegna: "IT-88",
  Sicilia: "IT-82",
  Toscana: "IT-52",
  "Trentino-Alto Adige": "IT-32",
  Umbria: "IT-55",
  "Valle d'Aosta": "IT-23",
  Veneto: "IT-34",
};

export function googleTrendsGeoForTerritory(
  territory: Region | "NAZIONALE",
): string {
  return GOOGLE_TRENDS_GEO[territory] ?? "IT";
}
