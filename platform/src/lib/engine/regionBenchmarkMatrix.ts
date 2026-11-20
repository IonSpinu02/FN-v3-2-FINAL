import { REGIONS } from "@/lib/engine/constants";
import type {
  TerritoryIssue,
  TerritoryIssueCategory,
} from "@/lib/engine/territoryIssuesTypes";
import { TERRITORY_ISSUE_CATEGORIES } from "@/lib/engine/territoryIssuesTypes";
import { politicalActionForCategory } from "@/lib/engine/territoryIssueContext";
import {
  staffBipLeverForCategory,
  type RegionOrNational,
} from "@/lib/engine/osservatorioStaffBipLevers";

export type { RegionOrNational };

export type RegionBenchmarkRow = Record<TerritoryIssueCategory, string>;

/** Badge «DATO REALE TERRITORIO» — ISTAT / Viminale / AGENAS / Giustizia / MIMIT. */
export const REGION_BENCHMARK_MATRIX: Record<
  RegionOrNational,
  RegionBenchmarkRow
> = {
  NAZIONALE: {
    SICUREZZA:
      "Dato Italia: Sovraffollamento carceri al 132% (31,5% detenuti stranieri) · +14% reati nei nodi ferroviari",
    SANITA:
      "Dato Italia: Oltre 4,5 milioni di italiani rinunciano alle cure per liste d'attesa e costi (ISTAT)",
    LAVORO:
      "Dato Italia: 4,9 milioni di Partite IVA e PMI colpite da pressione fiscale oltre il 42,5% e caro-energia",
    COSTO_VITA:
      "Dato Italia: Rata media mutuo +38% in 3 anni · Fecondità scesa al minimo storico di 1,14 figli/donna",
    TERRITORIO:
      "Dato Italia: Oltre 23.000 MSNA a carico di Stato e Comuni (costo fino a 100 €/giorno per minore)",
    TRASPORTI:
      "Dato Italia: Oltre 5,5 milioni di pendolari giornalieri tra ritardi ferroviari e rincari pedaggi",
  },
  Lombardia: {
    SICUREZZA:
      "Dato Lombardia: Carceri al 148% (San Vittore >200%) · hub Milano Centrale/Rogoredo sotto pressione",
    SANITA:
      "Dato Lombardia: Liste d'attesa e Pronto Soccorso metropolitani in sofferenza (AGENAS / ATS)",
    LAVORO:
      "Dato Lombardia: Circa 820.000 P.IVA/PMI sotto pressione fiscale e caro-energia (MIMIT / Infocamere)",
    COSTO_VITA:
      "Dato Lombardia: Affitti e mutui record a Milano · giovani esclusi dal mercato abitativo",
    TERRITORIO:
      "Dato Lombardia: Stress idrico bacino Po e pressione FV su suoli agricoli (ISPRA / MASAF)",
    TRASPORTI:
      "Dato Lombardia: Circa 750.000 pendolari/giorno Trenord tra ritardi e nodo milanese",
  },
  Veneto: {
    SICUREZZA:
      "Dato Veneto: Furti in abitazione e predatori sull'asse A4 · pressione Rotta Balcanica a Est",
    SANITA:
      "Dato Veneto: Carenza medici di base e Pronto Soccorso sotto stress (AGENAS)",
    LAVORO:
      "Dato Veneto: Distretti Vicenza/Padova/Treviso/Verona colpiti da caro-energia (MIMIT)",
    COSTO_VITA:
      "Dato Veneto: Bollette e costi casa in crescita nei capoluoghi produttivi",
    TERRITORIO:
      "Dato Veneto: Pressione migratoria Rotta Balcanica e costi MSNA sui Comuni di confine",
    TRASPORTI:
      "Dato Veneto: Pendolari e logistica A4/A27 sotto pressione di traffico e pedaggi",
  },
  Piemonte: {
    SICUREZZA:
      "Dato Piemonte: Sicurezza Torino Porta Nuova / Barriera di Milano sotto osservazione",
    SANITA:
      "Dato Piemonte: Liste d'attesa e invecchiamento demografico nei distretti ASL",
    LAVORO:
      "Dato Piemonte: Crisi filiera automotive (Mirafiori e indotto metalmeccanico in CIG)",
    COSTO_VITA:
      "Dato Piemonte: Caro-energia e costo vita nelle aree industriali",
    TERRITORIO:
      "Dato Piemonte: Aree interne e agricoltura di collina sotto stress demografico",
    TRASPORTI:
      "Dato Piemonte: Nodo ferroviario torinese e pendolari metropolitani",
  },
  Liguria: {
    SICUREZZA:
      "Dato Liguria: Sicurezza centro storico Genova e confine Ventimiglia",
    SANITA:
      "Dato Liguria: Emergenza anziani e liste d'attesa ASL (popolazione più anziana d'Italia)",
    LAVORO:
      "Dato Liguria: PMI e portualità sotto pressione costi energetici e logistici",
    COSTO_VITA:
      "Dato Liguria: Caro-vita e costi abitativi lungo la costa",
    TERRITORIO:
      "Dato Liguria: Dissesto idrogeologico e coste sotto stress climatico",
    TRASPORTI:
      "Dato Liguria: Code A10/A12/A26 e cantieri ferroviari — isolamento infrastrutturale",
  },
  "Emilia-Romagna": {
    SICUREZZA:
      "Dato Emilia-Romagna: Sicurezza stazione Bologna e città della via Emilia (baby gang/spaccio)",
    SANITA:
      "Dato Emilia-Romagna: Pronto Soccorso e liste d'attesa nei capoluoghi",
    LAVORO:
      "Dato Emilia-Romagna: Distretti ceramico/meccanico colpiti da costi energia",
    COSTO_VITA:
      "Dato Emilia-Romagna: Caro-vita nelle città della via Emilia",
    TERRITORIO:
      "Dato Emilia-Romagna: Messa in sicurezza idrogeologica post-alluvioni e ristori imprese",
    TRASPORTI:
      "Dato Emilia-Romagna: Nodo Bologna e traffico merci/pendolari",
  },
  Toscana: {
    SICUREZZA:
      "Dato Toscana: Sicurezza urbana Firenze (Cascine/SMN) e Prato",
    SANITA:
      "Dato Toscana: Liste d'attesa ospedaliere nei capoluoghi",
    LAVORO:
      "Dato Toscana: Crisi distretti moda/pelletteria/tessile e concorrenza sleale",
    COSTO_VITA:
      "Dato Toscana: Caro-affitti a Firenze e coste turistiche",
    TERRITORIO:
      "Dato Toscana: Agricoltura e aree interne sotto pressione demografica",
    TRASPORTI:
      "Dato Toscana: Pendolari Firenze–Prato–Pisa e nodi ferroviari",
  },
  "Friuli-Venezia Giulia": {
    SICUREZZA:
      "Dato FVG: Epicentro Rotta Balcanica (Trieste/Gorizia) e pressione sui Comuni",
    SANITA:
      "Dato FVG: Liste d'attesa sanitarie regionali",
    LAVORO:
      "Dato FVG: Manifattura e portualità sotto pressione costi",
    COSTO_VITA:
      "Dato FVG: Costo vita e casa nei capoluoghi di confine",
    TERRITORIO:
      "Dato FVG: Peso MSNA sui bilanci comunali di confine",
    TRASPORTI:
      "Dato FVG: Corridoi di confine e portualità triestina",
  },
  "Trentino-Alto Adige": {
    SICUREZZA:
      "Dato Trentino-Alto Adige: Sicurezza nei capoluoghi (Trento/Bolzano, aree stazioni)",
    SANITA:
      "Dato Trentino-Alto Adige: Sanità territoriale e tempi di accesso",
    LAVORO:
      "Dato Trentino-Alto Adige: Economia alpina e turismo sotto pressione costi",
    COSTO_VITA:
      "Dato Trentino-Alto Adige: Caro-casa per le giovani famiglie locali",
    TERRITORIO:
      "Dato Trentino-Alto Adige: Agricoltura di montagna e gestione grandi carnivori",
    TRASPORTI:
      "Dato Trentino-Alto Adige: Mobilità alpina e costi infrastrutturali",
  },
  "Valle d'Aosta": {
    SICUREZZA:
      "Dato Valle d'Aosta: Sicurezza e legalità nei centri urbani alpini",
    SANITA:
      "Dato Valle d'Aosta: Sanità territoriale di montagna e tempi di accesso",
    LAVORO:
      "Dato Valle d'Aosta: Occupazione turistica/stagionale sotto pressione costi",
    COSTO_VITA:
      "Dato Valle d'Aosta: Rincari riscaldamento invernale e costo vita alpino",
    TERRITORIO:
      "Dato Valle d'Aosta: Montagna, turismo e tutela paesaggio",
    TRASPORTI:
      "Dato Valle d'Aosta: Trafori (Monte Bianco) e autostrada tra le più care d'Italia",
  },
  Lazio: {
    SICUREZZA:
      "Dato Lazio: Emergenza Roma Termini/Esquilino e periferie capitoline",
    SANITA:
      "Dato Lazio: Pronto Soccorso e ospedali romani in sofferenza (AGENAS)",
    LAVORO:
      "Dato Lazio: PMI e lavoro pubblico/privato sotto pressione fiscale",
    COSTO_VITA:
      "Dato Lazio: Caro-mutui e affitti a Roma",
    TERRITORIO:
      "Dato Lazio: Aree interne e costa sotto pressione abitativa/turistica",
    TRASPORTI:
      "Dato Lazio: Caos pendolari Cotral/Roma-Lido/FL",
  },
  Marche: {
    SICUREZZA:
      "Dato Marche: Sicurezza urbana nei capoluoghi e entroterra",
    SANITA:
      "Dato Marche: Liste d'attesa sanità provinciale",
    LAVORO:
      "Dato Marche: Crisi distretto calzaturiero e mobile (caro-energia/export)",
    COSTO_VITA:
      "Dato Marche: Costo vita e casa nelle province produttive",
    TERRITORIO:
      "Dato Marche: Ricostruzione post-sisma ed entroterra",
    TRASPORTI:
      "Dato Marche: Collegamenti costa–entroterra e A14",
  },
  Umbria: {
    SICUREZZA:
      "Dato Umbria: Spaccio e sicurezza a Perugia/Fontivegge",
    SANITA:
      "Dato Umbria: Liste d'attesa sanitarie regionali",
    LAVORO:
      "Dato Umbria: Crisi siderurgia/manifattura (polo di Terni)",
    COSTO_VITA:
      "Dato Umbria: Costo vita e spopolamento giovanile",
    TERRITORIO:
      "Dato Umbria: Aree interne e agricoltura sotto stress demografico",
    TRASPORTI:
      "Dato Umbria: Isolamento ferroviario e stradale",
  },
  Abruzzo: {
    SICUREZZA:
      "Dato Abruzzo: Sicurezza nei capoluoghi e costa",
    SANITA:
      "Dato Abruzzo: Mobilità sanitaria passiva e difesa ospedali dei centri interni",
    LAVORO:
      "Dato Abruzzo: Crisi automotive Val di Sangro (Sevel/indotto)",
    COSTO_VITA:
      "Dato Abruzzo: Costo vita e casa nelle aree industriali",
    TERRITORIO:
      "Dato Abruzzo: Aree interne e ricostruzione",
    TRASPORTI:
      "Dato Abruzzo: Rincari autostradali A24/A25",
  },
  Molise: {
    SICUREZZA:
      "Dato Molise: Sicurezza e legalità nei centri urbani",
    SANITA:
      "Dato Molise: Commissariamento sanitario e tagli ospedali (Isernia/Termoli/Campobasso)",
    LAVORO:
      "Dato Molise: Crisi automotive Termoli (Stellantis/Gigafactory)",
    COSTO_VITA:
      "Dato Molise: Spopolamento giovanile e costo servizi",
    TERRITORIO:
      "Dato Molise: Spopolamento e viabilità interna",
    TRASPORTI:
      "Dato Molise: Viabilità interna e collegamenti carenti",
  },
  Campania: {
    SICUREZZA:
      "ISTAT / Ministero Interno · Campania: furti in abitazione 287,4/100.000 ab. (Italia 247,1) · Rapine 58,2/100.000 (Italia 38,9)",
    SANITA:
      "AGENAS 2024 · Campania: attesa specialistica media 49 gg vs 36 gg Italia · PS Cardarelli oltre saturazione nei picchi",
    LAVORO:
      "ISTAT BesT · Campania: occupazione 20–64 anni 48,7% vs 62,1% Italia · Disoccupazione giovanile >30%",
    COSTO_VITA:
      "ISTAT BesT / MIT · Campania: sovraccarico costo abitativo 11,8% (Italia 7,9%) · Sfratti eseguiti ~3.100/anno",
    TERRITORIO:
      "ISPRA · Campania: indice dissesto idrogeologico 61/100 · Costa e aree interne sotto pressione",
    TRASPORTI:
      "OpenCivitas / EAV · Campania: Circumvesuviana regolarità 48/100 · Pendolarismo >45 min 31,2%",
  },
  Puglia: {
    SICUREZZA:
      "Dato Puglia: Furti d'auto e sicurezza nel Foggiano",
    SANITA:
      "Dato Puglia: Liste d'attesa ASL",
    LAVORO:
      "Dato Puglia: Crisi ex Ilva di Taranto e indotto",
    COSTO_VITA:
      "Dato Puglia: Costo vita e casa nei capoluoghi",
    TERRITORIO:
      "Dato Puglia: Agricoltura (Xylella, siccità, grano sottopagato, concorrenza extra-UE)",
    TRASPORTI:
      "Dato Puglia: Collegamenti costa–entroterra e logistica",
  },
  Calabria: {
    SICUREZZA:
      "Dato Calabria: Sicurezza e legalità nei capoluoghi",
    SANITA:
      "Dato Calabria: Commissariamento sanitario storico · oltre 300 mln €/anno emigrazione sanitaria",
    LAVORO:
      "Dato Calabria: Occupazione e imprese sotto stress demografico",
    COSTO_VITA:
      "Dato Calabria: Costo vita e servizi nei centri interni",
    TERRITORIO:
      "Dato Calabria: Dissesto Comuni, carenza idrica e incompiute (SS106 / A2)",
    TRASPORTI:
      "Dato Calabria: Incompiute infrastrutturali SS106 / A2",
  },
  Basilicata: {
    SICUREZZA:
      "Dato Basilicata: Sicurezza nei centri urbani",
    SANITA:
      "Dato Basilicata: Sanità territoriale e tempi di accesso",
    LAVORO:
      "Dato Basilicata: Crisi polo automotive Melfi e indotto",
    COSTO_VITA:
      "Dato Basilicata: Paradosso estrazioni petrolifere/gas senza benefici in bolletta",
    TERRITORIO:
      "Dato Basilicata: Emergenza idrica e spopolamento dei piccoli comuni",
    TRASPORTI:
      "Dato Basilicata: Collegamenti interni e logistica industriale",
  },
  Sicilia: {
    SICUREZZA:
      "Dato Sicilia: Prima linea sbarchi (Lampedusa, Porto Empedocle, Pozzallo)",
    SANITA:
      "Dato Sicilia: Liste d'attesa negli ospedali",
    LAVORO:
      "Dato Sicilia: Occupazione e imprese sotto pressione costi",
    COSTO_VITA:
      "Dato Sicilia: Caro-voli e continuità territoriale",
    TERRITORIO:
      "Dato Sicilia: Emergenza siccità per agricoltura/allevamento",
    TRASPORTI:
      "Dato Sicilia: Continuità territoriale aerea/marittima e costi",
  },
  Sardegna: {
    SICUREZZA:
      "Dato Sardegna: Sicurezza nei capoluoghi",
    SANITA:
      "Dato Sardegna: Sanità territoriale e tempi di accesso",
    LAVORO:
      "Dato Sardegna: Occupazione e imprese locali sotto pressione",
    COSTO_VITA:
      "Dato Sardegna: Caro-trasporti (continuità territoriale aerea e marittima)",
    TERRITORIO:
      "Dato Sardegna: Assalto speculativo eolico/FV sul paesaggio · crisi pastorizia/agricoltura",
    TRASPORTI:
      "Dato Sardegna: Continuità territoriale e costi di collegamento",
  },
};

const DOSSIER_TITLES: Record<
  RegionOrNational,
  Record<TerritoryIssueCategory, string>
> = {
  NAZIONALE: {
    SICUREZZA: "Carceri al 132% e reati nei nodi ferroviari: emergenza ordine pubblico nazionale",
    SANITA: "4,5 milioni di italiani rinunciano alle cure: liste d'attesa e costi fuori controllo",
    LAVORO: "4,9 milioni di P.IVA/PMI sotto pressione fiscale oltre il 42,5% e caro-energia",
    COSTO_VITA: "Mutui +38% in 3 anni e fecondità a 1,14: giovani famiglie escluse",
    TERRITORIO: "Oltre 23.000 MSNA a carico di Stato e Comuni: bilanci locali al collasso",
    TRASPORTI: "5,5 milioni di pendolari tra ritardi ferroviari e rincari pedaggi",
  },
  Lombardia: {
    SICUREZZA: "San Vittore oltre il 200% e stazioni milanesi: tripla emergenza sicurezza",
    SANITA: "Liste d'attesa e Pronto Soccorso metropolitani: Lombardia sotto stress",
    LAVORO: "820.000 P.IVA/PMI lombarde tra fisco e caro-energia",
    COSTO_VITA: "Milano inaccessibile: affitti e mutui fuori portata per le giovani famiglie",
    TERRITORIO: "Po sotto stress e fotovoltaico su terreni agricoli",
    TRASPORTI: "750.000 pendolari Trenord al giorno: ritardi e nodo milanese",
  },
  Veneto: {
    SICUREZZA: "Furti in abitazione e asse A4: sicurezza delle famiglie venete",
    SANITA: "Medici di base e Pronto Soccorso: carenza strutturale in Veneto",
    LAVORO: "Distretti Vicenza-Padova-Treviso-Verona: caro-energia sulle PMI",
    COSTO_VITA: "Bollette e casa: costo della vita nei capoluoghi veneti",
    TERRITORIO: "Rotta Balcanica e MSNA: pressione sui Comuni di confine",
    TRASPORTI: "Pendolari e logistica A4: traffico e pedaggi",
  },
  Piemonte: {
    SICUREZZA: "Torino Porta Nuova e Barriera di Milano: sicurezza urbana",
    SANITA: "Liste d'attesa e demografia: sanità piemontese sotto pressione",
    LAVORO: "Mirafiori e indotto in CIG: crisi automotive",
    COSTO_VITA: "Caro-energia nelle aree industriali piemontesi",
    TERRITORIO: "Aree interne e collina: spopolamento e agricoltura",
    TRASPORTI: "Nodo ferroviario torinese e pendolari",
  },
  Liguria: {
    SICUREZZA: "Genova centro storico e Ventimiglia: legalità e confine",
    SANITA: "Anziani e liste d'attesa ASL: emergenza demografica ligure",
    LAVORO: "Portualità e PMI: costi energetici e logistici",
    COSTO_VITA: "Caro-vita sulla costa ligure",
    TERRITORIO: "Dissesto idrogeologico e coste",
    TRASPORTI: "A10/A12/A26 e cantieri: isolamento infrastrutturale",
  },
  "Emilia-Romagna": {
    SICUREZZA: "Stazione Bologna e via Emilia: baby gang e spaccio",
    SANITA: "Pronto Soccorso e liste d'attesa nei capoluoghi emiliani",
    LAVORO: "Distretti ceramico e meccanico: bollette fuori controllo",
    COSTO_VITA: "Caro-vita sulla via Emilia",
    TERRITORIO: "Post-alluvioni: messa in sicurezza e ristori",
    TRASPORTI: "Nodo Bologna merci e pendolari",
  },
  Toscana: {
    SICUREZZA: "Firenze Cascine/SMN e Prato: sicurezza urbana",
    SANITA: "Liste d'attesa ospedaliere toscane",
    LAVORO: "Moda, pelletteria e tessile: concorrenza sleale e costi",
    COSTO_VITA: "Caro-affitti a Firenze",
    TERRITORIO: "Agricoltura e aree interne toscane",
    TRASPORTI: "Pendolari Firenze–Prato–Pisa",
  },
  "Friuli-Venezia Giulia": {
    SICUREZZA: "Trieste e Gorizia: Rotta Balcanica in prima linea",
    SANITA: "Liste d'attesa sanitarie in FVG",
    LAVORO: "Manifattura e porto: costi e competitività",
    COSTO_VITA: "Costo vita nei capoluoghi di confine",
    TERRITORIO: "MSNA e bilanci comunali di confine",
    TRASPORTI: "Corridoi di confine e portualità",
  },
  "Trentino-Alto Adige": {
    SICUREZZA: "Trento e Bolzano: sicurezza nelle aree stazione",
    SANITA: "Sanità territoriale alpina",
    LAVORO: "Economia alpina e costi energetici",
    COSTO_VITA: "Caro-casa per le giovani famiglie locali",
    TERRITORIO: "Agricoltura di montagna e grandi carnivori",
    TRASPORTI: "Mobilità alpina e costi",
  },
  "Valle d'Aosta": {
    SICUREZZA: "Legalità nei centri alpini",
    SANITA: "Sanità di montagna: tempi e accessibilità",
    LAVORO: "Occupazione stagionale e costi",
    COSTO_VITA: "Riscaldamento invernale e caro-vita",
    TERRITORIO: "Montagna e tutela del paesaggio",
    TRASPORTI: "Monte Bianco e pedaggi tra i più cari d'Italia",
  },
  Lazio: {
    SICUREZZA: "Roma Termini, Esquilino e periferie: emergenza sicurezza",
    SANITA: "Ospedali e Pronto Soccorso romani in sofferenza",
    LAVORO: "PMI e lavoro nel Lazio sotto pressione fiscale",
    COSTO_VITA: "Caro-mutui e affitti a Roma",
    TERRITORIO: "Aree interne e costa laziale",
    TRASPORTI: "Cotral, Roma-Lido e FL: caos pendolari",
  },
  Marche: {
    SICUREZZA: "Sicurezza nei capoluoghi marchigiani",
    SANITA: "Liste d'attesa nella sanità provinciale",
    LAVORO: "Calzatura e mobile: crisi export e caro-energia",
    COSTO_VITA: "Costo vita nelle province produttive",
    TERRITORIO: "Ricostruzione post-sisma ed entroterra",
    TRASPORTI: "Costa–entroterra e A14",
  },
  Umbria: {
    SICUREZZA: "Perugia Fontivegge: spaccio e degrado",
    SANITA: "Liste d'attesa sanitarie umbre",
    LAVORO: "Terni: crisi siderurgia e manifattura",
    COSTO_VITA: "Spopolamento giovanile e costo servizi",
    TERRITORIO: "Aree interne umbre",
    TRASPORTI: "Isolamento ferroviario e stradale",
  },
  Abruzzo: {
    SICUREZZA: "Sicurezza nei capoluoghi abruzzesi",
    SANITA: "Ospedali dei centri interni e mobilità sanitaria passiva",
    LAVORO: "Val di Sangro: crisi Sevel e indotto",
    COSTO_VITA: "Costo vita nelle aree industriali",
    TERRITORIO: "Aree interne e ricostruzione",
    TRASPORTI: "A24/A25: rincari pedaggi",
  },
  Molise: {
    SICUREZZA: "Legalità nei centri molisani",
    SANITA: "Commissariamento e tagli ospedali (Isernia/Termoli/Campobasso)",
    LAVORO: "Termoli: Stellantis e Gigafactory sotto incertezza",
    COSTO_VITA: "Spopolamento e costo dei servizi",
    TERRITORIO: "Viabilità interna e spopolamento",
    TRASPORTI: "Collegamenti interni carenti",
  },
  Campania: {
    SICUREZZA: "Napoli: baby gang, armi tra minorenni e stazioni",
    SANITA: "Cardarelli e liste d'attesa: Pronto Soccorso al collasso",
    LAVORO: "Disoccupazione giovanile e crisi imprese",
    COSTO_VITA: "Caro-vita e povertà relativa urbana",
    TERRITORIO: "Aree interne e costa campana",
    TRASPORTI: "Circumvesuviana: caos pendolari",
  },
  Puglia: {
    SICUREZZA: "Foggiano: furti d'auto e legalità",
    SANITA: "Liste d'attesa ASL pugliesi",
    LAVORO: "Taranto: ex Ilva e indotto",
    COSTO_VITA: "Costo vita nei capoluoghi",
    TERRITORIO: "Xylella, siccità e grano sottopagato",
    TRASPORTI: "Logistica costa–entroterra",
  },
  Calabria: {
    SICUREZZA: "Legalità nei capoluoghi calabresi",
    SANITA: "Commissariamento storico e 300 mln €/anno di emigrazione sanitaria",
    LAVORO: "Occupazione e imprese sotto stress demografico",
    COSTO_VITA: "Costo vita e servizi nei centri interni",
    TERRITORIO: "Dissesto Comuni, acqua e incompiute SS106/A2",
    TRASPORTI: "Incompiute SS106 e A2",
  },
  Basilicata: {
    SICUREZZA: "Sicurezza nei centri lucani",
    SANITA: "Sanità territoriale e tempi di accesso",
    LAVORO: "Melfi: crisi automotive e indotto",
    COSTO_VITA: "Estrazioni senza benefici in bolletta per i lucani",
    TERRITORIO: "Emergenza idrica e spopolamento",
    TRASPORTI: "Logistica industriale e collegamenti",
  },
  Sicilia: {
    SICUREZZA: "Lampedusa, Porto Empedocle, Pozzallo: prima linea sbarchi",
    SANITA: "Liste d'attesa negli ospedali siciliani",
    LAVORO: "Occupazione e imprese sotto pressione costi",
    COSTO_VITA: "Caro-voli e continuità territoriale",
    TERRITORIO: "Siccità: agricoltura e allevamento",
    TRASPORTI: "Continuità territoriale aerea e marittima",
  },
  Sardegna: {
    SICUREZZA: "Sicurezza nei capoluoghi sardi",
    SANITA: "Sanità territoriale sarda",
    LAVORO: "Imprese locali sotto pressione",
    COSTO_VITA: "Caro-trasporti e continuità territoriale",
    TERRITORIO: "Speculazione eolico/FV e crisi pastorizia",
    TRASPORTI: "Continuità territoriale e costi di collegamento",
  },
};

export function territoryBenchmarkLine(
  scope: RegionOrNational,
  category: TerritoryIssueCategory,
): string {
  return (
    REGION_BENCHMARK_MATRIX[scope]?.[category] ??
    REGION_BENCHMARK_MATRIX.NAZIONALE[category]
  );
}

function hashId(scope: string, cat: string): string {
  return `dossier-${scope.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${cat.toLowerCase()}`;
}

/** Schede emergenza certificate usate per backfill a minimo 6 card. */
export function buildCertifiedDossierIssues(
  scope: RegionOrNational,
): TerritoryIssue[] {
  const leverByCat = TERRITORY_ISSUE_CATEGORIES.map((categoria) => {
    const lever = staffBipLeverForCategory(categoria);
    const actionRegion = scope === "NAZIONALE" ? "Lazio" : scope;
    return {
      id: hashId(scope, categoria),
      regione: scope,
      provinciaComune:
        scope === "NAZIONALE" ? "Italia · Dossier certificato" : "Ambito regionale",
      categoria,
      titoloProblema: DOSSIER_TITLES[scope][categoria],
      sintesiLamentela: territoryBenchmarkLine(scope, categoria),
      canaleVirale: "Dossier emergenza reale · fonti istituzionali",
      visualizzazioniStimate: "Scheda prioritaria staff",
      impattoScore: 88,
      datoUfficialeModuloB: territoryBenchmarkLine(scope, categoria),
      bipSolutionBadge: lever.badge,
      bipSolutions: [
        {
          emergencyId: `STAFF_${categoria}`,
          capRef: lever.badge,
          measures: lever.measure,
          badgeLabel: lever.badge,
          pressDeclaration: lever.declaration(scope),
        },
      ],
      azionePoliticaConsigliata: {
        ...politicalActionForCategory(actionRegion, categoria),
        cosaDire: lever.declaration(scope),
      },
      sourceUrl: "",
      pubDate: new Date().toISOString(),
      live: false,
      contentSource: "catalog" as const,
      verification: "editorial" as const,
      electionScore: 80,
    } satisfies TerritoryIssue;
  });
  return leverByCat;
}

export function ensureMinimumDossiers(
  issues: TerritoryIssue[],
  scope: RegionOrNational,
  minCount = 6,
): TerritoryIssue[] {
  if (issues.length >= minCount) return issues;
  const haveTitles = new Set(
    issues.map((i) => i.titoloProblema.toLowerCase().slice(0, 48)),
  );
  const haveCats = new Set(issues.map((i) => i.categoria));
  const extras: TerritoryIssue[] = [];
  for (const dossier of buildCertifiedDossierIssues(scope)) {
    if (issues.length + extras.length >= minCount) break;
    if (haveCats.has(dossier.categoria) && issues.length >= 3) {
      // preferisci categorie mancanti prima
      const missing = TERRITORY_ISSUE_CATEGORIES.some((c) => !haveCats.has(c));
      if (missing && haveCats.has(dossier.categoria)) continue;
    }
    const key = dossier.titoloProblema.toLowerCase().slice(0, 48);
    if (haveTitles.has(key)) continue;
    extras.push(dossier);
    haveTitles.add(key);
    haveCats.add(dossier.categoria);
  }
  // Se ancora sotto soglia, aggiungi comunque i restanti dossier
  if (issues.length + extras.length < minCount) {
    for (const dossier of buildCertifiedDossierIssues(scope)) {
      if (issues.length + extras.length >= minCount) break;
      if (extras.some((e) => e.id === dossier.id)) continue;
      if (issues.some((i) => i.id === dossier.id)) continue;
      extras.push(dossier);
    }
  }
  return [...issues, ...extras].slice(0, Math.max(minCount, issues.length));
}

export function allRegionScopes(): RegionOrNational[] {
  return ["NAZIONALE", ...REGIONS];
}
