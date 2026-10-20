import type { Region } from "./constants";

/** Capoluoghi e città metropolitane principali → Regione ISTAT (107+ voci). */
export const CAPOLUOGHI_TO_REGIONE: Record<string, Region> = {
  Torino: "Piemonte",
  Novara: "Piemonte",
  Alessandria: "Piemonte",
  Asti: "Piemonte",
  Biella: "Piemonte",
  Cuneo: "Piemonte",
  "Verbano-Cusio-Ossola": "Piemonte",
  Verbania: "Piemonte",
  Vercelli: "Piemonte",
  Aosta: "Valle d'Aosta",
  Milano: "Lombardia",
  Brescia: "Lombardia",
  Bergamo: "Lombardia",
  Como: "Lombardia",
  Cremona: "Lombardia",
  Lecco: "Lombardia",
  Lodi: "Lombardia",
  Mantova: "Lombardia",
  Monza: "Lombardia",
  Pavia: "Lombardia",
  Sondrio: "Lombardia",
  Varese: "Lombardia",
  Trento: "Trentino-Alto Adige",
  Bolzano: "Trentino-Alto Adige",
  Rovereto: "Trentino-Alto Adige",
  Merano: "Trentino-Alto Adige",
  Venezia: "Veneto",
  Verona: "Veneto",
  Padova: "Veneto",
  Vicenza: "Veneto",
  Treviso: "Veneto",
  Rovigo: "Veneto",
  Belluno: "Veneto",
  Trieste: "Friuli-Venezia Giulia",
  Udine: "Friuli-Venezia Giulia",
  Pordenone: "Friuli-Venezia Giulia",
  Gorizia: "Friuli-Venezia Giulia",
  Genova: "Liguria",
  "La Spezia": "Liguria",
  Savona: "Liguria",
  Imperia: "Liguria",
  Bologna: "Emilia-Romagna",
  Modena: "Emilia-Romagna",
  Parma: "Emilia-Romagna",
  "Reggio Emilia": "Emilia-Romagna",
  Ferrara: "Emilia-Romagna",
  Ravenna: "Emilia-Romagna",
  Rimini: "Emilia-Romagna",
  Forlì: "Emilia-Romagna",
  Cesena: "Emilia-Romagna",
  Piacenza: "Emilia-Romagna",
  Firenze: "Toscana",
  Pisa: "Toscana",
  Livorno: "Toscana",
  Arezzo: "Toscana",
  Siena: "Toscana",
  Lucca: "Toscana",
  Pistoia: "Toscana",
  Prato: "Toscana",
  Grosseto: "Toscana",
  Massa: "Toscana",
  Carrara: "Toscana",
  Perugia: "Umbria",
  Terni: "Umbria",
  Foligno: "Umbria",
  Spoleto: "Umbria",
  Ancona: "Marche",
  Pesaro: "Marche",
  Urbino: "Marche",
  Macerata: "Marche",
  "Ascoli Piceno": "Marche",
  Fermo: "Marche",
  Roma: "Lazio",
  Viterbo: "Lazio",
  Latina: "Lazio",
  Frosinone: "Lazio",
  Rieti: "Lazio",
  Civitavecchia: "Lazio",
  "L'Aquila": "Abruzzo",
  Pescara: "Abruzzo",
  Chieti: "Abruzzo",
  Teramo: "Abruzzo",
  Campobasso: "Molise",
  Isernia: "Molise",
  Termoli: "Molise",
  Napoli: "Campania",
  Salerno: "Campania",
  Caserta: "Campania",
  Avellino: "Campania",
  Benevento: "Campania",
  Bari: "Puglia",
  Lecce: "Puglia",
  Taranto: "Puglia",
  Foggia: "Puglia",
  Brindisi: "Puglia",
  Barletta: "Puglia",
  Andria: "Puglia",
  Trani: "Puglia",
  Potenza: "Basilicata",
  Matera: "Basilicata",
  Catanzaro: "Calabria",
  "Reggio Calabria": "Calabria",
  Cosenza: "Calabria",
  Crotone: "Calabria",
  "Vibo Valentia": "Calabria",
  Palermo: "Sicilia",
  Catania: "Sicilia",
  Messina: "Sicilia",
  Siracusa: "Sicilia",
  Ragusa: "Sicilia",
  Trapani: "Sicilia",
  Agrigento: "Sicilia",
  Caltanissetta: "Sicilia",
  Enna: "Sicilia",
  Cagliari: "Sardegna",
  Sassari: "Sardegna",
  Nuoro: "Sardegna",
  Oristano: "Sardegna",
  Olbia: "Sardegna",
};

const COMUNI_SORTED = Object.keys(CAPOLUOGHI_TO_REGIONE).sort(
  (a, b) => b.length - a.length,
);

export function normalizeGeoText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/'/g, " ");
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rileva comune con word boundary `\b` (no sottostringhe). */
export function findCapoluogoInText(
  text: string,
  extraLabels = "",
): string | undefined {
  const hay = normalizeGeoText(`${text} ${extraLabels}`);
  for (const name of COMUNI_SORTED) {
    const n = normalizeGeoText(name);
    if (n.length < 3) continue;
    const re = new RegExp(`\\b${escapeRegExp(n)}\\b`, "i");
    if (re.test(hay)) return name;
  }
  return undefined;
}

export function regioneForComune(comune: string): Region | undefined {
  return CAPOLUOGHI_TO_REGIONE[comune];
}
