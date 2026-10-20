import type { Region } from "@/lib/engine/constants";
import type { CaricaLocale } from "@/lib/engine/localiTypes";

export type BroadsheetArticle = {
  id: string;
  source: string;
  /** URL RSS o link feed grezzo (solo per cleanFeedLabel). */
  feedSource?: string;
  titolo: string;
  sommario: string;
  pubDate: string;
  suggestedRegion: Region;
  suggestedComune: string;
  suggestedRole: CaricaLocale;
  link: string;
  confidenceScore?: number;
  matchedRoleKeyword?: string;
  matchedGeoKeyword?: string;
};

export const BROADSHEET_FIRST_SEED_ID = "seed-lazio-roma";

type BroadsheetSeedTemplate = Omit<BroadsheetArticle, "pubDate"> & {
  /** Giorni prima della data di riferimento (0 = oggi). */
  daysAgo: number;
  /** Orario UTC «HH:MM». */
  timeUtc: string;
};

function pubDateFromOffset(asOf: Date, daysAgo: number, timeUtc: string): string {
  const [h, m] = timeUtc.split(":").map((x) => parseInt(x, 10));
  const d = new Date(asOf);
  d.setUTCHours(h ?? 12, m ?? 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

/** Dispacci certificati con data pubblicazione ancorata al giorno di riferimento. */
export function getBroadsheetBaseEdition(
  asOf: Date = new Date(),
): BroadsheetArticle[] {
  return BROADSHEET_SEED_TEMPLATES.map(({ daysAgo, timeUtc, ...rest }) => ({
    ...rest,
    pubDate: pubDateFromOffset(asOf, daysAgo, timeUtc),
  }));
}

/** Seed operativo: 12+ dispacci istituzionali certificati (copertura nazionale). */
const BROADSHEET_SEED_TEMPLATES: BroadsheetSeedTemplate[] = [
  {
    id: "seed-lazio-roma",
    source: "ANSA LAZIO",
    titolo:
      "Comune di Roma, piano straordinario su trasporto pubblico e municipi capitolini",
    sommario:
      "Assemblea Capitolina e giunta comunale definiscono interventi su Atac e periferie. Sindaco e consiglieri sollecitano tavolo con Regione Lazio.",
    daysAgo: 0,
    timeUtc: "09:00",
    suggestedRegion: "Lazio",
    suggestedComune: "Roma",
    suggestedRole: "sind",
    link: "https://www.ansa.it/lazio/notizie/",
  },
  {
    id: "seed-lombardia-milano",
    source: "IL SOLE 24 ORE",
    titolo:
      "Milano, consiglio comunale su housing sociale e mobility hub metropolitani",
    sommario:
      "Sindaco e assessori presentano pacchetto edilizia pubblica e nodi intermodali. Consiglieri di opposizione chiedono tempi certi su M4 e scalo Farini.",
    daysAgo: 0,
    timeUtc: "11:20",
    suggestedRegion: "Lombardia",
    suggestedComune: "Milano",
    suggestedRole: "com",
    link: "https://www.ilsole24ore.com/",
  },
  {
    id: "seed-lombardia-brescia",
    source: "IL GAZZETTINO",
    titolo:
      "Brescia, consiglio comunale approva pacchetto lavoro e formazione metropolitana",
    sommario:
      "Consiglieri comunali e giunta comunale in audizione con imprenditori del distretto meccatronico. Focus su occupazione giovanile.",
    daysAgo: 1,
    timeUtc: "14:40",
    suggestedRegion: "Lombardia",
    suggestedComune: "Brescia",
    suggestedRole: "com",
    link: "https://www.gazzettino.it/",
    confidenceScore: 92,
    matchedRoleKeyword: "consiglio comunale",
    matchedGeoKeyword: "Brescia -> Lombardia (Certificato ISTAT)",
  },
  {
    id: "seed-veneto-verona",
    source: "ANSA VENETO",
    titolo:
      "Verona, giunta e opposizione sul piano del trasporto pubblico regionale",
    sommario:
      "Il Comune apre un tavolo con TPL e commercianti del centro storico. Sindaco e consiglieri chiedono tempi certi sui rinnovi del parco mezzi.",
    daysAgo: 1,
    timeUtc: "09:15",
    suggestedRegion: "Veneto",
    suggestedComune: "Verona",
    suggestedRole: "sind",
    link: "https://www.ansa.it/veneto/notizie/",
  },
  {
    id: "seed-veneto-venezia",
    source: "ANSA VENETO",
    titolo:
      "Venezia, consiglio comunale e giunta comunale su turismo sostenibile",
    sommario:
      "Sindaco e consiglieri comunali definiscono regole su accessi e trasporto lagunare in consiglio comunale.",
    daysAgo: 2,
    timeUtc: "10:00",
    suggestedRegion: "Veneto",
    suggestedComune: "Venezia",
    suggestedRole: "com",
    link: "https://www.ansa.it/veneto/notizie/",
    confidenceScore: 94,
    matchedRoleKeyword: "consiglio comunale",
    matchedGeoKeyword: "Venezia -> Veneto (Certificato ISTAT)",
  },
  {
    id: "seed-piemonte-torino",
    source: "CORRIERE DELLA SERA",
    titolo:
      "Torino, vertice istituzionale su mobility e investimenti industriali",
    sommario:
      "Sindaco e consiglieri incontrano rappresentanti camerali su pendolarismo e costo abitativo. Focus su collegamenti ferroviari verso Milano.",
    daysAgo: 2,
    timeUtc: "08:50",
    suggestedRegion: "Piemonte",
    suggestedComune: "Torino",
    suggestedRole: "sind",
    link: "https://www.corriere.it/",
  },
  {
    id: "seed-emr-bologna",
    source: "IL RESTO DEL CARLINO",
    titolo:
      "Bologna, consiglio regionale su sanita metropolitana e liste d attesa",
    sommario:
      "Consiglieri regionali e sindaci dell area metropolitana definiscono priorita su ambulatori di prossimita e potenziamento del 118.",
    daysAgo: 3,
    timeUtc: "14:40",
    suggestedRegion: "Emilia-Romagna",
    suggestedComune: "Bologna",
    suggestedRole: "creg",
    link: "https://www.ilrestodelcarlino.it/",
  },
  {
    id: "seed-puglia-bari",
    source: "GAZZETTA DEL MEZZOGIORNO",
    titolo:
      "Bari, sanita territoriale: consiglieri chiedono rafforzo ambulatori periferici",
    sommario:
      "Consiglieri comunali e regionali sollecitano piano triennale con AGENAS e ASL. Priorita alle liste d attesa e al potenziamento del 118.",
    daysAgo: 4,
    timeUtc: "11:05",
    suggestedRegion: "Puglia",
    suggestedComune: "Bari",
    suggestedRole: "creg",
    link: "https://www.lagazzettadelmezzogiorno.it/",
  },
  {
    id: "seed-sicilia-catania",
    source: "ANSA SICILIA",
    titolo:
      "Catania, energia e reti idriche: consiglio regionale in sessione straordinaria",
    sommario:
      "Deputati e consiglieri regionali sollecitano monitoraggio perdite idriche e interventi su reti eolico-solare in provincia.",
    daysAgo: 5,
    timeUtc: "10:10",
    suggestedRegion: "Sicilia",
    suggestedComune: "Catania",
    suggestedRole: "creg",
    link: "https://www.ansa.it/sicilia/notizie/",
  },
  {
    id: "seed-calabria-rc",
    source: "ANSA CALABRIA",
    titolo:
      "Reggio Calabria, infrastrutture portuali al centro del dibattito in consiglio",
    sommario:
      "Deputati e sindaci dello Stretto discutono intermodalita e decongestione del traffico merci. Richieste di fondi PNRR ancora in pipeline.",
    daysAgo: 6,
    timeUtc: "16:20",
    suggestedRegion: "Calabria",
    suggestedComune: "Reggio Calabria",
    suggestedRole: "dep",
    link: "https://www.ansa.it/calabria/notizie/",
  },
  {
    id: "seed-toscana-firenze",
    source: "LA STAMPA",
    titolo:
      "Firenze, universita e Comune su housing studentesco e mobilita dolce",
    sommario:
      "Consiglieri comunali avanzano proposta per piu posti in residenze e ciclovie verso il campus. Coinvolgimento consiglieri regionali su fondi europei.",
    daysAgo: 7,
    timeUtc: "13:30",
    suggestedRegion: "Toscana",
    suggestedComune: "Firenze",
    suggestedRole: "com",
    link: "https://www.lastampa.it/",
  },
  {
    id: "seed-campania-napoli",
    source: "IL MATTINO",
    titolo:
      "Napoli, giunta comunale e consiglio su porti, ZES e servizi periferici",
    sommario:
      "Sindaco e consiglieri calendarizzano tavolo tecnico su sviluppo portuale e cronoprogramma cantieri. Priorita alle periferie e al trasporto pubblico.",
    daysAgo: 8,
    timeUtc: "07:45",
    suggestedRegion: "Campania",
    suggestedComune: "Napoli",
    suggestedRole: "sind",
    link: "https://www.ilmattino.it/",
  },
  {
    id: "seed-marche-ancona",
    source: "ADNKRONOS",
    titolo:
      "Ancona, consiglio regionale e giunta regionale su sanita costiera",
    sommario:
      "Consiglieri regionali in commissione con assessore regionale. Giunta regionale definisce priorita su liste d attesa.",
    daysAgo: 9,
    timeUtc: "09:40",
    suggestedRegion: "Marche",
    suggestedComune: "Ancona",
    suggestedRole: "creg",
    link: "https://www.adnkronos.com/",
    confidenceScore: 91,
    matchedRoleKeyword: "consiglio regionale",
    matchedGeoKeyword: "Ancona -> Marche (Certificato ISTAT)",
  },
  {
    id: "seed-sardegna-cagliari",
    source: "LA REPUBBLICA",
    titolo:
      "Cagliari, consiglio comunale e sindaco su porto e servizi metropolitani",
    sommario:
      "Giunta comunale presenta piano in consiglio comunale. Consiglieri comunali approvano linee guida.",
    daysAgo: 10,
    timeUtc: "08:35",
    suggestedRegion: "Sardegna",
    suggestedComune: "Cagliari",
    suggestedRole: "sind",
    link: "https://www.repubblica.it/",
    confidenceScore: 93,
    matchedRoleKeyword: "consiglio comunale",
    matchedGeoKeyword: "Cagliari -> Sardegna (Certificato ISTAT)",
  },
];

export function caricaLabel(role: CaricaLocale): string {
  switch (role) {
    case "dep":
      return "Deputato";
    case "creg":
      return "Consigliere regionale";
    case "sind":
      return "Sindaco";
    case "com":
      return "Consigliere comunale";
    default:
      return role;
  }
}

export function caricaBadgeClass(role: CaricaLocale): string {
  switch (role) {
    case "sind":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
    case "creg":
      return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
    case "com":
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    case "dep":
      return "border-violet-500/40 bg-violet-500/10 text-violet-300";
    default:
      return "border-slate-500/40 bg-slate-500/10 text-slate-300";
  }
}
