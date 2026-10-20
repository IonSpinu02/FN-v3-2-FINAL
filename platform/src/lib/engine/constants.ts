export const REGIONS = [
  "Piemonte",
  "Valle d'Aosta",
  "Liguria",
  "Lombardia",
  "Trentino-Alto Adige",
  "Veneto",
  "Friuli-Venezia Giulia",
  "Emilia-Romagna",
  "Toscana",
  "Umbria",
  "Marche",
  "Lazio",
  "Abruzzo",
  "Molise",
  "Campania",
  "Puglia",
  "Basilicata",
  "Calabria",
  "Sicilia",
  "Sardegna",
] as const;

export type Region = (typeof REGIONS)[number];

export const CIRC: Record<string, readonly Region[]> = {
  NO: REGIONS.slice(0, 4),
  NE: REGIONS.slice(4, 8),
  C: REGIONS.slice(8, 12),
  S: REGIONS.slice(12, 18),
  I: REGIONS.slice(18),
};

export type RegionMap = Record<Region, number>;
