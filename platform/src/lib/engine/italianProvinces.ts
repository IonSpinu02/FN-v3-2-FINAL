import type { Region } from "./constants";

/** Province e città metropolitane per regione (denominazione ISTAT operativa). */
export const PROVINCES_BY_REGION: Record<Region, readonly string[]> = {
  Piemonte: [
    "Tutte le province del Piemonte",
    "Torino",
    "Cuneo",
    "Asti",
    "Alessandria",
    "Novara",
    "Verbano-Cusio-Ossola",
    "Vercelli",
    "Biella",
  ],
  "Valle d'Aosta": ["Tutte le province della Valle d'Aosta", "Aosta"],
  Liguria: [
    "Tutte le province della Liguria",
    "Genova",
    "Imperia",
    "Savona",
    "La Spezia",
  ],
  Lombardia: [
    "Tutte le province della Lombardia",
    "Milano",
    "Bergamo",
    "Brescia",
    "Como",
    "Cremona",
    "Lecco",
    "Lodi",
    "Mantova",
    "Monza e Brianza",
    "Pavia",
    "Sondrio",
    "Varese",
  ],
  "Trentino-Alto Adige": [
    "Tutte le province del Trentino-Alto Adige",
    "Trento",
    "Bolzano",
  ],
  Veneto: [
    "Tutte le province del Veneto",
    "Venezia",
    "Verona",
    "Padova",
    "Vicenza",
    "Treviso",
    "Rovigo",
    "Belluno",
  ],
  "Friuli-Venezia Giulia": [
    "Tutte le province del FVG",
    "Trieste",
    "Udine",
    "Pordenone",
    "Gorizia",
  ],
  "Emilia-Romagna": [
    "Tutte le province dell'Emilia-Romagna",
    "Bologna",
    "Modena",
    "Parma",
    "Reggio Emilia",
    "Ferrara",
    "Ravenna",
    "Forlì-Cesena",
    "Rimini",
    "Piacenza",
  ],
  Toscana: [
    "Tutte le province della Toscana",
    "Firenze",
    "Pisa",
    "Livorno",
    "Siena",
    "Arezzo",
    "Grosseto",
    "Lucca",
    "Pistoia",
    "Prato",
    "Massa-Carrara",
  ],
  Umbria: [
    "Tutte le province dell'Umbria",
    "Perugia",
    "Terni",
  ],
  Marche: [
    "Tutte le province delle Marche",
    "Ancona",
    "Pesaro e Urbino",
    "Macerata",
    "Ascoli Piceno",
    "Fermo",
  ],
  Lazio: [
    "Tutte le province del Lazio",
    "Roma",
    "Latina",
    "Frosinone",
    "Viterbo",
    "Rieti",
  ],
  Abruzzo: [
    "Tutte le province dell'Abruzzo",
    "L'Aquila",
    "Pescara",
    "Chieti",
    "Teramo",
  ],
  Molise: [
    "Tutte le province del Molise",
    "Campobasso",
    "Isernia",
  ],
  Campania: [
    "Tutte le province della Campania",
    "Napoli",
    "Salerno",
    "Caserta",
    "Avellino",
    "Benevento",
  ],
  Puglia: [
    "Tutte le province della Puglia",
    "Bari",
    "Foggia",
    "Lecce",
    "Taranto",
    "Brindisi",
    "Barletta-Andria-Trani",
  ],
  Basilicata: [
    "Tutte le province della Basilicata",
    "Potenza",
    "Matera",
  ],
  Calabria: [
    "Tutte le province della Calabria",
    "Reggio Calabria",
    "Catanzaro",
    "Cosenza",
    "Crotone",
    "Vibo Valentia",
  ],
  Sicilia: [
    "Tutte le province della Sicilia",
    "Palermo",
    "Catania",
    "Messina",
    "Siracusa",
    "Trapani",
    "Agrigento",
    "Caltanissetta",
    "Enna",
    "Ragusa",
  ],
  Sardegna: [
    "Tutte le province della Sardegna",
    "Cagliari",
    "Sassari",
    "Nuoro",
    "Oristano",
    "Sud Sardegna",
  ],
};

export function provincesForRegion(region: Region): readonly string[] {
  return PROVINCES_BY_REGION[region];
}

export function isAllProvincesChoice(province: string): boolean {
  return province.startsWith("Tutte le province");
}

/** Offset deterministico ±4 pt stress per lettura provinciale (non sostituisce micro-dati ISTAT). */
export function provincialStressOffset(region: Region, province: string): number {
  if (isAllProvincesChoice(province)) return 0;
  let h = 0;
  const s = `${region}:${province}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h % 9) - 4;
}
