import type { Region } from "@/lib/engine/constants";
import { REGIONS } from "@/lib/engine/constants";
import type { TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { TrendsClusterId, TrendsQueryTypeLabel } from "@/lib/googleTrendsIntelligence";

export type RegionalGoogleTrendSeed = {
  slug: string;
  cluster: TrendsClusterId;
  pillarLabel: string;
  exactQuery: string;
  queryType: TrendsQueryTypeLabel;
  category: TerritoryIssueCategory;
  fixedIndex: number;
  fixedSurgePct: number;
  relatedQueries: [string, string, string, string];
  datoOggettivoModuloB: string;
  causaRadice: string;
  soluzioneBip: string;
  enteCompetente: string;
  tempiAttuazione: string;
  azioneSulCampo48h: string;
};

function rt(
  slug: string,
  cluster: TrendsClusterId,
  pillar: string,
  category: TerritoryIssueCategory,
  exactQuery: string,
  fixedIndex: number,
  fixedSurgePct: number,
  related: [string, string, string, string],
  dato: string,
  causa: string,
  soluzione: string,
  ente = "Regione / Governo",
  tempi = "Decreto-legge · 60–90 giorni",
  azione48h = "Presidio territoriale FN con scheda B.I.P. e monitoraggio query.",
): RegionalGoogleTrendSeed {
  return {
    slug,
    cluster,
    pillarLabel: pillar,
    exactQuery,
    queryType: "Termine di ricerca testuale",
    category,
    fixedIndex,
    fixedSurgePct,
    relatedQueries: related,
    datoOggettivoModuloB: dato,
    causaRadice: causa,
    soluzioneBip: soluzione,
    enteCompetente: ente,
    tempiAttuazione: tempi,
    azioneSulCampo48h: azione48h,
  };
}

const LOMBARDIA: RegionalGoogleTrendSeed[] = [
  rt(
    "lomb-trenord",
    "TRASPORTI_PENDOLARI",
    "TRASPORTI",
    "TRASPORTI",
    "rimborso abbonamento Trenord ritardi 2026",
    100,
    148,
    [
      "treni soppressi Trenord oggi",
      "bonus trasporti regione Lombardia",
      "blocco diesel Euro 5 Area B Milano",
      "carburante HVO diesel compatibilità",
    ],
    "Pendolarismo Milano–Brescia: ritardi Trenord e Area B alimentano ricerche su rimborso abbonamento.",
    "Soppressioni e ritardi Trenord spingono domanda di rimborso e alternative HVO.",
    "B.I.P. Cap. 9 (p. 65): pluralità HVO/e-fuels senza rottamazione forzata e potenziamento ferrovia.",
  ),
  rt(
    "lomb-san-vittore",
    "SICUREZZA_CITTA",
    "SICUREZZA",
    "SICUREZZA",
    "furti Stazione Centrale Milano e carcere San Vittore",
    93,
    134,
    [
      "sovraffollamento San Vittore 200 per cento",
      "baby gang Milano metro presidi esercito",
      "espulsione detenuti stranieri",
      "legittima difesa furto negozio",
    ],
    "San Vittore oltre 200% capienza; Stazione Centrale tra nodi furti metro.",
    "Sovraffollamento carceri e degrado stazioni aumentano ricerche su sicurezza e rimpatri.",
    "B.I.P. Cap. 7 & 8 (pp. 44, 54): protocollo Shape-Clear-Hold-Build, rimpatrio 35% detenuti stranieri, 10.000 posti carcere.",
  ),
  rt(
    "lomb-mutuo-milano",
    "FAMIGLIA_CASA",
    "FAMIGLIA",
    "COSTO_VITA",
    "tassi mutuo prima casa giovani Milano e provincia",
    86,
    122,
    [
      "mutuo 100 per cento consap under 36",
      "costo medio bilocale hinterland Milano",
      "quoziente familiare detrazioni figli",
      "asilo nido comunale graduatoria",
    ],
    "Affitti e mutui hinterland Milano vs redditi giovani 24–28k €.",
    "Costo casa blocca famiglie giovani in provincia di Milano.",
    "B.I.P. Cap. 13 (p. 94): Mutuo Tricolore tasso 0% al 3° figlio, moratoria 1 anno a nascita.",
  ),
  rt(
    "lomb-medici-ats",
    "SANITA_CUP",
    "SANITÀ",
    "SANITA",
    "carenza medici di base ATS Lombardia comuni scoperti",
    79,
    115,
    [
      "cambio medico fascicolo sanitario Lombardia",
      "tempi attesa visite specialistiche CUP",
      "guardia medica notturna provincia",
      "detrazione visite private",
    ],
    "Comuni scoperti medico di base in ATS Lombardia; CUP specialistiche in crescita.",
    "Liste attesa e medici assenti spingono ricerche su CUP e fascicolo sanitario.",
    "B.I.P. Cap. 1 & 12 (pp. 9, 73): deduzione spese sanitarie tracciabili e avanzi sanitari Regioni virtuose.",
  ),
  rt(
    "lomb-bollette-brianza",
    "LAVORO_AUTO_GREEN",
    "LAVORO & ENERGIA",
    "LAVORO",
    "rincaro bollette energia PMI manifattura Bresciano e Brianza",
    74,
    108,
    [
      "taglio oneri di sistema bolletta imprese",
      "saldo e acconto partite iva abolizione",
      "bollino impresa sicura GDPR",
      "tetto contante 10000 euro",
    ],
    "Distretto manifatturiero Bresciano: energia e oneri sistema pesano su PMI.",
    "Bollette e burocrazia fiscale comprimono margini PMI Brianza.",
    "B.I.P. Cap. 1, 9 & 11 (pp. 9, 58, 71): taglio oneri bolletta, gas russo, SMR, saldo/acconto, Bollino MIMIT.",
  ),
  rt(
    "lomb-po-latte",
    "AGRICOLTURA_TERRITORIO",
    "AGRICOLTURA",
    "TERRITORIO",
    "regimazione fiume Po irrigazione e prezzo latte Lombardia",
    68,
    97,
    [
      "prezzo latte alla stalla sotto costi",
      "cagliate estere falso formaggio italiano",
      "invasi bacino del Po siccità",
      "stop fotovoltaico terreni agricoli Pianura Padana",
    ],
    "Po e invasi: siccità e latte sotto costo in Pianura Padana.",
    "Concorrenza sleale formaggi e siccità alimentano ricerche agricole.",
    "B.I.P. Cap. 15 (pp. 102–105): Codice Doganale UE, divieto sottocosto, Piano Nazionale dell'Acqua e Po.",
  ),
];

const VENETO: RegionalGoogleTrendSeed[] = [
  rt(
    "ven-legittima-difesa",
    "SICUREZZA_CITTA",
    "SICUREZZA",
    "SICUREZZA",
    "furti in abitazione Veneto legittima difesa risarcimento",
    100,
    152,
    [
      "riforma articolo 52 legittima difesa",
      "nessun risarcimento al ladro ferito",
      "baby gang Padova Verona Mestre",
      "daspo urbano 5 anni",
    ],
    "Furti abitazione Padova–Verona–Mestre e dibattito art. 52 c.p.",
    "Cittadini cercano tutele in legittima difesa e stop risarcimenti all'aggressore.",
    "B.I.P. Cap. 7 & 8 (pp. 42, 50): proporzionalità presunta in legittima difesa e divieto risarcimento aggressore.",
  ),
  rt(
    "ven-energia-vicenza",
    "LAVORO_AUTO_GREEN",
    "LAVORO & ENERGIA",
    "LAVORO",
    "costo energia distretti industriali Vicenza Treviso PMI",
    91,
    136,
    [
      "taglio cuneo fiscale aziende manifatturiere",
      "principio San Paolo sussidi disoccupazione",
      "riabilitazione creditizia CRIF piccole imprese",
      "iva per cassa artigiani",
    ],
    "Distretti Vicenza–Treviso: energia e cuneo fiscale al centro del dibattito PMI.",
    "Caro energia spinge ricerche su cuneo fiscale e credito PMI.",
    "B.I.P. Cap. 1, 2, 4 & 9: taglio oneri, gas russo, Principio di San Paolo, riabilitazione creditizia.",
  ),
  rt(
    "ven-vongole-chioggia",
    "AGRICOLTURA_TERRITORIO",
    "AGRICOLTURA",
    "TERRITORIO",
    "crisi vongole Polesine granchio blu e gasolio pesca Chioggia",
    84,
    124,
    [
      "deroga taglia minima vongole UE",
      "pesca lavoro usurante pensione",
      "defiscalizzazione gasolio marinerie Adriatico",
      "obbligo data di pesca in etichetta",
    ],
    "Polesine e laguna: vongole, granchio blu, gasolio pesca Chioggia.",
    "Marinerie in crisi per regolamentazione UE e caro gasolio.",
    "B.I.P. Cap. 15 (p. 105): deroghe taglia vongole, pesca usurante, difesa marinerie.",
  ),
  rt(
    "ven-msna-comuni",
    "FAMIGLIA_CASA",
    "FAMIGLIA",
    "COSTO_VITA",
    "costi minori stranieri non accompagnati bilanci comuni Veneto",
    78,
    116,
    [
      "gestione MSNA prefetture non comuni",
      "accertamento radiografico età minori stranieri",
      "priorità italiani case popolari ATER",
      "compartecipazione IRPEF sindaci",
    ],
    "MSNA e ERP: peso su bilanci comunali veneti.",
    "Cittadini chiedono MSNA alle Prefetture e priorità italiani in ERP.",
    "B.I.P. Cap. 5 (Misure 5–6, 14) & Cap. 12: MSNA Prefetture, ERP italiani, IRPEF ai sindaci.",
  ),
  rt(
    "ven-ulss-liste",
    "SANITA_CUP",
    "SANITÀ",
    "SANITA",
    "liste attesa ULSS Veneto e carenza medici pronto soccorso",
    72,
    105,
    [
      "tempi attesa pronto soccorso Padova",
      "medici PS sotto organico ULSS",
      "cure palliative legge 38",
      "ticket farmaci Veneto",
    ],
    "ULSS Veneto: liste CUP e PS sotto stress organico.",
    "Attese sanitarie spingono ricerche su PS e cure palliative.",
    "B.I.P. Cap. 12 & 13: autonomia virtuosa costi standard e Legge 38/2010 cure palliative.",
  ),
  rt(
    "ven-pedemontana",
    "TRASPORTI_PENDOLARI",
    "TRASPORTI",
    "TRASPORTI",
    "pedaggi Pedemontana Veneta traffico A4 e blocchi Euro 5",
    65,
    94,
    [
      "pedaggio Pedemontana Veneta costi",
      "traffico A4 Vicenza Padova",
      "blocco Euro 5 Veneto deroga",
      "HVO diesel compatibilità autostrada",
    ],
    "Pedemontana e A4: pedaggi, traffico e blocchi Euro 5.",
    "Pendolari cercano alternative a pedaggi e divieti Euro 5.",
    "B.I.P. Cap. 3 & 9: interporti/logistica Nord-Est e stop blocchi Euro 5 con HVO.",
  ),
];

const PIEMONTE: RegionalGoogleTrendSeed[] = [
  rt("piem-mirafiori", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "cassa integrazione Mirafiori Torino e crisi indotto auto", 100, 164, ["stop divieto motori termici 2035 UE", "biocarburanti HVO e-fuels filiera auto", "reshoring produzioni industriali Filiera Italia", "fondo sovrano tutela imprese strategiche"], "Mirafiori e filiera auto torinese in cassa integrazione.", "Crisi automotive spinge ricerche su motori termici e HVO.", "B.I.P. Cap. 3 & 9 (pp. 16, 65): Filiera Italia, Fondo Sovrano, stop ideologia elettrica 2035."),
  rt("piem-euro5-torino", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "blocco diesel Euro 5 Torino e comuni fascia 1 Piemonte", 92, 141, ["deroga blocco Euro 5 Piemonte", "sanzioni ZTL autovelox comuni", "ritardi treni regionali SFM Torino", "rottamazione non obbligatoria auto"], "ZTL Torino e Euro 5: pendolarismo e sanzioni.", "Divieti diesel alimentano ricerche su deroghe e TPL.", "B.I.P. Cap. 9 (p. 65): cancellazione divieti punitivi e pluralità tecnologica."),
  rt("piem-barriera-milano", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "spaccio e baby gang Torino Barriera di Milano Porta Nuova", 85, 129, ["operazione esercito quartieri degradati", "sgombero centri sociali occupati", "imputabilità minori 12 anni", "arresto obbligatorio spaccio"], "Barriera di Milano e Porta Nuova: spaccio e baby gang.", "Degrado urbano spinge ricerche su presidi e minorenni.", "B.I.P. Cap. 7 & 8 (pp. 44–46, 51): bonifica militare, centri occupati, imputabilità 12 anni."),
  rt("piem-risicoltura-po", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "siccità canali Cavour risicoltura Vercelli Novara e danni cinghiali", 78, 114, ["invasi acqua bacino fiume Po", "dazi riso asiatico concorrenza sleale", "riforma legge 157 caccia contenimento cinghiali", "ricostituzione Corpo Forestale"], "Vercelli–Novara: acqua, riso e cinghiali.", "Siccità e fauna selvatica danneggiano risicoltura.", "B.I.P. Cap. 3 & 15 (pp. 18, 104, 106): reciprocità commerciale, Po, Legge 157/1992."),
  rt("piem-cup-piemonte", "SANITA_CUP", "SANITÀ", "SANITA", "tempi attesa CUP Piemonte e chiusura punti nascita provincia", 71, 102, ["punti nascita chiusi provincia", "tempi attesa risonanza CUP", "maternità aree interne Piemonte", "piano vita nascente"], "Chiusure punti nascita e CUP in provincia.", "Attese e maternità periferica al centro delle ricerche.", "B.I.P. Cap. 13: Piano Nazionale Vita Nascente e tutela maternità aree interne."),
  rt("piem-mutuo-montagna", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "mutuo giovani coppie Piemonte e ripopolamento comuni montani", 66, 93, ["mutuo tricolore comuni sotto 15000 abitanti", "incentivi giovani montagna", "quoziente familiare IRPEF", "assegno unico figli"], "Spopolamento montano e accesso mutuo giovani.", "Famiglie cercano Mutuo Tricolore in comuni piccoli.", "B.I.P. Cap. 13 (p. 94): Mutuo Tricolore portabile sotto 15.000 abitanti."),
];

const LAZIO: RegionalGoogleTrendSeed[] = [
  rt("lazio-ps-roma", "SANITA_CUP", "SANITÀ", "SANITA", "pronto soccorso Roma al collasso barelle Umberto I San Camillo", 100, 158, ["attesa pronto soccorso Roma ore", "visite specialistiche RECUP Lazio tempi", "applicazione legge 38 cure palliative", "assistenza domiciliare anziani caregiver"], "PS Roma: Umberto I, San Camillo, barelle e RECUP.", "Collasso PS spinge ricerche su attese e cure palliative.", "B.I.P. Cap. 1, 13 & 14: deduzione sanitaria, sblocco organici, Legge 38/2010 caregiver."),
  rt("lazio-metromare", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "sciopero e guasti Roma Lido Metromare Cotral pendolari", 93, 144, ["treni soppressi Roma Lido Ostia", "ritardi Cotral provincia Roma Latina", "traffico Grande Raccordo Anulare", "fascia verde Roma blocco diesel"], "Metromare, Cotral e GRA: pendolarismo Lazio.", "Guasti TPL e GRA alimentano ricerche pendolari.", "B.I.P. Cap. 9 (p. 65): modernizzazione TPL senza ZTL punitive."),
  rt("lazio-termini", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza Stazione Termini Esquilino e occupazioni abusive Roma", 86, 133, ["sgombero immobili occupati Roma", "presidi militari H24 Stazione Termini", "borseggi metro Roma carcere effettivo", "tribunale reati di strada 90 giorni"], "Termini, Esquilino, occupazioni abusive.", "Sicurezza stazioni e sgomberi occupazioni.", "B.I.P. Cap. 7 & 8 (pp. 46, 50): sgombero immediato, tribunali reati strada 90 giorni."),
  rt("lazio-affitti-roma", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "caro affitti e mutuo prima casa giovani coppie Roma", 80, 121, ["mutuo tricolore tasso zero terzo figlio", "graduatorie case popolari ATER Roma italiani", "quoziente familiare IRPEF nonni", "quote azzurre concorsi pubblici"], "Affitti Roma e mutuo giovani.", "Caro affitti spinge Mutuo Tricolore e ERP.", "B.I.P. Cap. 13 & 14 (pp. 90, 94, 96): Mutuo Tricolore, Quote Azzurre, priorità italiani ERP."),
  rt("lazio-pomezia-pmi", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi aziendali Pomezia Frosinone cassa integrazione e credito PMI", 73, 109, ["fondo sovrano imprese strategiche", "filiera italia reshoring", "riabilitazione creditizia PMI", "taglio cuneo fiscale assunzioni"], "Pomezia–Frosinone: cassa integrazione e PMI.", "Crisi industriale e credito PMI.", "B.I.P. Cap. 2, 3 & 4: Fondo Sovrano, Filiera Italia, credito PMI."),
  rt("lazio-cinghiali-agro", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "danni cinghiali Roma Nord e crisi agricola Agro Pontino Latina", 67, 98, ["abbattimento selettivo cinghiali", "prezzo minimo ortofrutta", "stop sfruttamento braccianti", "legge 157 caccia"], "Agro Pontino e cinghiali Roma Nord.", "Danni fauna e agricoltura.", "B.I.P. Cap. 5 & 15: stop sfruttamento campi e Legge 157/1992."),
];

const EMILIA_ROMAGNA: RegionalGoogleTrendSeed[] = [
  rt("emr-alluvione", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "risarcimenti alluvione Romagna cassa espansione e pulizia fiumi", 100, 155, ["manutenzione alvei fiumi Romagna", "assicurazione catastrofale agricoltura frutteti", "gestione boschi appennino biomasse", "piano nazionale acqua invasi"], "Alluvione Romagna: alvei, frutteti, invasi.", "Post-alluvione: risarcimenti e manutenzione idraulica.", "B.I.P. Cap. 9 & 15 (pp. 64, 101, 104): gestione forestale, Piano Acqua, mutualismo agricolo."),
  rt("emr-ceramica-sassuolo", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "costo gas distretto ceramico Sassuolo e manifattura Emilia", 91, 139, ["cogenerazione industriale ceramica costi", "riapertura forniture gas russo prezzi", "oneri di sistema bolletta energivori", "stop quote ETS emissioni UE"], "Distretto ceramico Sassuolo: gas e cogenerazione.", "Caro gas energivori.", "B.I.P. Cap. 9 (pp. 59–60): cogenerazione, gas russo, stop Green Deal."),
  rt("emr-bibbiano", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "tutela famiglie affidi minori servizi sociali e cure palliative", 84, 126, ["riforma servizi sociali dopo caso Bibbiano", "allontanamento minori solo extrema ratio", "legge regionale fine vita Emilia Romagna ricorso", "sostegno economico caregiver familiari"], "Caso Bibbiano e fine vita regionale.", "Famiglie e servizi sociali.", "B.I.P. Cap. 13 & 14 (pp. 85, 98): protocolli EPI e Legge 38/2010."),
  rt("emr-bologna-spaccio", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "baby gang e spaccio Bologna Piazza XX Settembre Modena Reggio", 78, 118, ["zone rosse permanenti Bologna", "daspo urbano 5 anni", "imputabilità minori 12 anni", "presidio Forze Ordine piazze"], "Bologna–Modena–Reggio: spaccio e baby gang.", "Sicurezza piazze.", "B.I.P. Cap. 7 & 8: Zone Rosse, Daspo 5 anni, imputabilità 12 anni."),
  rt("emr-euro5-padana", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "blocco diesel Euro 5 comuni Pianura Padana Emilia", 71, 104, ["deroga Euro 5 Emilia Romagna", "HVO biocarburante autostrada A1", "ZTL Bologna Modena", "bonus mobilità alternativa"], "Euro 5 Pianura Padana.", "Divieti diesel pendolari.", "B.I.P. Cap. 9: stop divieti e HVO."),
  rt("emr-ausl-ticket", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa AUSL Emilia Romagna e ticket farmaci", 65, 95, ["tempi attesa CUP Emilia", "ticket esenzione farmaci", "costi standard sanità regione", "deduzione spese sanitarie"], "AUSL Emilia: liste e ticket.", "Sanità regionale.", "B.I.P. Cap. 1 & 12: deduzione sanitaria e costi standard."),
];

const TOSCANA: RegionalGoogleTrendSeed[] = [
  rt("tosc-prato-moda", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi distretto tessile Prato pelletteria Firenze e concorrenza sleale", 100, 149, ["controlli aziende illegali distretto Prato", "cassa integrazione moda pelletteria Scandicci", "tracciabilità blockchain Made in Italy", "dazi contro concorrenza sleale extra UE"], "Prato–Scandicci: tessile e pelletteria.", "Concorrenza sleale e sommerso.", "B.I.P. Cap. 3 (p. 18): Made in Italy, reciprocità doganale, blockchain filiera."),
  rt("tosc-lupi-chianti", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "emergenza lupi predatori Maremma e danni cinghiali vigneti Chianti", 91, 135, ["contenimento grandi carnivori lupi allevamenti", "riforma legge 157 caccia Toscana", "ricostituzione Corpo Forestale dello Stato", "prezzo olio extravergine e vino"], "Maremma e Chianti: lupi, cinghiali, vigneti.", "Grandi carnivori e danni agricoli.", "B.I.P. Cap. 15 (p. 106): Legge 157/1992 e Corpo Forestale."),
  rt("tosc-forteto-quote", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "concorsi pubblici Regione Toscana quote riservate e affidi minori", 84, 123, ["bando regione Toscana quote gender polemica", "quote azzurre concorsi famiglie numerose", "controlli comunità minori dopo caso Forteto", "contrasto legge regionale suicidio assistito Toscana"], "Bando Toscana, Forteto, fine vita regionale.", "Famiglia e minori.", "B.I.P. Cap. 13 & 14 (pp. 85, 91, 99): Quote Azzurre, comunità minori, cure palliative."),
  rt("tosc-cascine-smn", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "spaccio parco delle Cascine Firenze e sicurezza stazione SMN", 77, 115, ["presidio Cascine Firenze", "unità cinofile antidroga stazione", "Forze Armate poteri arresto", "videosorveglianza SMN"], "Cascine e Santa Maria Novella.", "Spaccio e stazione.", "B.I.P. Cap. 7: Forze Armate con poteri d'arresto e cinofili antidroga."),
  rt("tosc-msna-erp", "SANITA_CUP", "SANITÀ", "SANITA", "costi minori stranieri bilanci comuni toscani e case popolari", 70, 103, ["MSNA prefetture Toscana", "priorità italiani ERP", "costi assistenza MSNA comuni", "accertamento età minori"], "MSNA e ERP comuni toscani.", "Costi sociali.", "B.I.P. Cap. 5 (Misure 6 e 14): MSNA Prefetture e ERP italiani."),
  rt("tosc-fipi-li", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "cantieri Fi-Pi-Li pedaggio e ritardi treni regionali Toscana", 64, 92, ["pedaggio Fi-Pi-Li", "ritardi treni regionali Trenitalia Toscana", "cantieri autostrada Livorno", "bonus pendolari regione"], "Fi-Pi-Li e TPL Toscana.", "Infrastrutture.", "B.I.P. Cap. 3 & 9: logistiche e stop pedaggi punitivi."),
];

const PUGLIA: RegionalGoogleTrendSeed[] = [
  rt("pug-grano-foggia", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "prezzo grano duro Foggia sottocosto e siccità invasi Capitanata", 100, 161, ["divieto vendita grano sotto costi produzione", "navi grano estero controlli porto Bari", "espropri terreni agricoli fotovoltaico Puglia", "xylella reimpianto ulivi indennizzi"], "Capitanata: grano, siccità, xylella.", "Agricoltura pugliese sotto costo.", "B.I.P. Cap. 15 (pp. 101–105): divieto sottocosto, PAC agricoltori, stop FV a terra."),
  rt("pug-carceri-165", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sovraffollamento carceri Puglia 165 per cento e criminalità Foggia Bari", 92, 143, ["emergenza carceri Bari Foggia Taranto", "polizia penitenziaria sotto organico", "confisca patrimoni criminalità organizzata", "furti auto e rapine Cerignola"], "Distretto Puglia-Basilicata carceri 165%.", "Carceri e criminalità.", "B.I.P. Cap. 7 & 8 (pp. 46, 54): Polizia Penitenziaria, 10.000 posti, rimpatri."),
  rt("pug-ilva-taranto", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "vertenza ex Ilva Taranto cassa integrazione e ZES Mezzogiorno", 84, 128, ["golden power siderurgia Taranto", "idrogeno nucleare SMR", "ZES unica Mezzogiorno", "cassa integrazione operai"], "Ilva Taranto e ZES.", "Industria pesante.", "B.I.P. Cap. 3 & 9: Golden Power, Fondo Sovrano, idrogeno nucleare."),
  rt("pug-asl-cup", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASL Puglia CUP e carenza medici pronto soccorso", 76, 114, ["tempi attesa CUP Bari", "medici PS sotto organico", "costi standard ASL", "sprechi clientela sanità"], "ASL Puglia liste attesa.", "Sanità.", "B.I.P. Cap. 1 & 12: costi standard e deduzione sanitaria."),
  rt("pug-mutuo-sud", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "mutuo prima casa giovani Puglia e incentivi Io Resto al Sud 2.0", 70, 103, ["io resto al sud 2.0 requisiti", "mutuo tricolore giovani Puglia", "agevolazioni prima casa under 36", "reddito genitorialità"], "Giovani e casa in Puglia.", "Mutuo e Sud.", "B.I.P. Cap. 11 & 13 (pp. 71, 94): Io Resto al Sud 2.0 e Mutuo Tricolore."),
  rt("pug-fse-gargano", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "ritardi Ferrovie Sud Est Bari Gargano e cantieri SS16", 63, 91, ["ferrovie sud est ritardi", "cantieri SS16 Adriatica", "hub logistico Bari porto", "bonus pendolari Puglia"], "FSE e SS16.", "Trasporti Puglia.", "B.I.P. Cap. 3 & 9: hub mediterraneo e ferrovie regionali."),
];

const SICILIA: RegionalGoogleTrendSeed[] = [
  rt("sic-siccita-dighe", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "emergenza siccità Sicilia dighe vuote razionamento acqua e agricoltura", 100, 168, ["perdite reti idriche Sicilia invasi", "grano duro siciliano prezzo sottocosto", "quote tonno rosso e caro gasolio pesca Mazara", "arance e ortofrutta concorrenza nord Africa"], "Sicilia: dighe, agricoltura, pesca Mazara.", "Siccità e concorrenza.", "B.I.P. Cap. 15 (pp. 101–105): Piano Acqua, divieto sottocosto, tonno rosso, reciprocità."),
  rt("sic-lampedusa", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sbarchi Lampedusa rotta mediterranea e costi MSNA comuni siciliani", 93, 151, ["divieto attracco navi ONG porti italiani", "dirottamento sbarchi Malta primo approdo", "domande asilo in paesi terzi nord Africa", "gestione minori stranieri prefetture"], "Lampedusa e MSNA comuni siciliani.", "Immigrazione e costi.", "B.I.P. Cap. 5 (Misure 1–6, pp. 24–26): confini marittimi, ONG, asilo extra-UE, MSNA Prefetture."),
  rt("sic-voli-a19", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "caro voli Sicilia continuità territoriale e cantieri autostrada A19 A20", 85, 132, ["voucher continuità territoriale voli", "cantieri A19 Palermo Catania", "porti interporti Sicilia hub", "ferrovie siciliane ritardi"], "Continuità territoriale e A19.", "Isolamento logistico.", "B.I.P. Cap. 3 (p. 17): porti, aeroporti, hub Mediterraneo."),
  rt("sic-io-resto", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "lavoro giovani Sicilia Io Resto al Sud 2.0 e stop lavoro povero", 78, 119, ["database collocamento nazionale", "io resto al sud 55 anni", "taglio cuneo fiscale Sicilia", "naspi rifiuto lavoro San Paolo"], "Giovani e lavoro in Sicilia.", "Collocamento e Sud.", "B.I.P. Cap. 2 & 11 (pp. 12, 71): collocamento, Io Resto al Sud, cuneo fiscale."),
  rt("sic-asp-palermo", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASP Palermo Catania e carenza medici ospedali", 71, 107, ["tempi attesa ASP Sicilia", "medici ospedali sotto organico", "LEP garantiti stato", "costi standard sanità"], "ASP Palermo–Catania.", "Sanità siciliana.", "B.I.P. Cap. 12: costi standard e LEP garantiti."),
  rt("sic-mutuo-madri", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "mutuo prima casa giovani Sicilia e reddito di rinascita per madri", 65, 96, ["mutuo tricolore Sicilia", "reddito di rinascita madri", "no tax area famiglie", "assegno unico figli"], "Famiglie giovani Sicilia.", "Mutuo e natalità.", "B.I.P. Cap. 13 (pp. 92, 94): Mutuo Tricolore e Reddito di Rinascita."),
];

const CAMPANIA: RegionalGoogleTrendSeed[] = [
  rt("camp-baby-gang", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "violenza baby gang Napoli armi minorenni e abbassamento imputabilità", 100, 162, ["minori non imputabili sotto 14 anni riforma", "imputabilità a 12 anni reati gravi", "cantieri di cittadinanza atti vandalici", "responsabilità penale e multe genitori"], "Baby gang Napoli e minorenni.", "Violenza urbana.", "B.I.P. Cap. 7, 8 & 14 (pp. 46, 51, 98): imputabilità 12 anni, Cantieri Cittadinanza, multe genitori."),
  rt("camp-pomodoro-cinese", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "falso Made in Italy concentrato pomodoro cinese e tutela agroalimentare", 92, 145, ["pomodoro cinese spacciato per italiano", "revisione codice doganale origine materie prime", "tutela mozzarella di bufala e ortofrutta", "prezzo minimo garantito agricoltori"], "Pomodoro cinese vs agro campano.", "Falso Made in Italy.", "B.I.P. Cap. 15 (pp. 102–103): Codice Doganale UE e origine materie prime."),
  rt("camp-cardarelli", "SANITA_CUP", "SANITÀ", "SANITA", "emergenza barelle Cardarelli Napoli e aggressioni personale sanitario", 85, 133, ["code barelle Cardarelli", "aggressioni infermieri PS", "presidio Forze Ordine ospedali", "nomine ASL trasparenza"], "Cardarelli Napoli.", "PS e aggressioni.", "B.I.P. Cap. 7 & 12: presidi ospedali e fine partitocrazia ASL."),
  rt("camp-circumvesuviana", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "treni soppressi Circumvesuviana Cumana EAV pendolari Napoli", 78, 120, ["commissariamento EAV", "ritardi Circumvesuviana", "rimborso abbonamento EAV", "modernizzazione rotabili"], "EAV e Circumvesuviana.", "TPL Napoli.", "B.I.P. Cap. 9: commissariamento e modernizzazione ferrovie pendolari."),
  rt("camp-pomigliano", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "stabilimento Pomigliano indotto auto e incentivi assunzioni giovani", 72, 109, ["salvaguardia motori termici automotive", "HVO filiera auto", "taglio cuneo fiscale giovani", "cassa integrazione Pomigliano"], "Pomigliano automotive.", "Lavoro giovani.", "B.I.P. Cap. 2, 3 & 9: motori termici, Filiera Italia, cuneo fiscale."),
  rt("camp-affitti-napoli", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "caro affitti Napoli mutuo tricolore e reddito di genitorialità", 66, 98, ["mutuo tricolore Napoli", "reddito genitorialità INPS", "graduatoria ATER Napoli", "quoziente familiare"], "Affitti Napoli.", "Casa giovani.", "B.I.P. Cap. 13 (pp. 91–94): Mutuo Tricolore e Reddito di Genitorialità."),
];

const CALABRIA: RegionalGoogleTrendSeed[] = [
  rt("cal-sbarchi-ionica", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sbarchi rotta ionica Roccella Crotone e CPR Calabria", 100, 156, ["CPR Calabria tempi", "sbarchi Roccella Jonica", "rimpatri accelerati", "confini marittimi ONG"], "Roccella/Crotone: sbarchi e CPR.", "Frontiera ionica.", "B.I.P. Cap. 5: confini marittimi, CPR, asilo extra-UE."),
  rt("cal-emigrazione-sanitaria", "SANITA_CUP", "SANITÀ", "SANITA", "ospedali commissariati Calabria ed emigrazione sanitaria", 91, 138, ["ospedali commissariati Calabria", "emigrazione sanitaria nord", "LEP garantiti", "medici di base scoperti"], "Ospedali commissariati.", "Emigrazione sanitaria.", "B.I.P. Cap. 12: LEP e commissariamenti."),
  rt("cal-sila-biomassa", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "gestione boschi Sila Aspromonte biomasse ed energia Calabria", 84, 125, ["biomasse Sila", "gestione attiva boschi", "idrogeno nucleare", "stop fotovoltaico agricolo"], "Sila/Aspromonte boschi.", "Energia e boschi.", "B.I.P. Cap. 9 & 15: biomasse, gestione forestale."),
  rt("cal-ss106-jonica", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "cantieri SS106 Jonica e Alta Velocità Calabria collegamenti", 77, 112, ["SS106 Jonica cantieri", "alta velocità Calabria", "porto Gioia Tauro hub", "continuità territoriale"], "SS106 e AV.", "Infrastrutture.", "B.I.P. Cap. 3: hub logistico e AV."),
  rt("cal-spopolamento-mutuo", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "spopolamento borghi Calabria e Mutuo Tricolore comuni piccoli", 70, 101, ["mutuo tricolore sotto 15000 abitanti", "incentivi giovani borghi", "reddito rinascita", "assegno unico"], "Spopolamento borghi.", "Mutuo montano.", "B.I.P. Cap. 13: Mutuo Tricolore comuni piccoli."),
  rt("cal-lavoro-sud", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "disoccupazione giovani Calabria Io Resto al Sud e lavoro nero", 63, 92, ["io resto al sud Calabria", "lavoro nero agricoltura", "database collocamento", "principio San Paolo NASpI"], "Giovani e lavoro Calabria.", "Collocamento.", "B.I.P. Cap. 2 & 11: collocamento e Io Resto al Sud."),
];

const SARDEGNA: RegionalGoogleTrendSeed[] = [
  rt("sar-eolico-agricolo", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "speculazione pale eoliche fotovoltaico suolo agricolo Sardegna", 100, 153, ["stop fotovoltaico terreni agricoli", "eolico offshore regole", "paesaggio costa Sardegna", "PAC solo agricoltori"], "Eolico/FV su suolo sardo.", "Speculazione energetica.", "B.I.P. Cap. 9 & 15 (pp. 63, 105): stop FV a terra, eolico regolato."),
  rt("sar-continuita", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "continuità territoriale aerea marittima Sardegna caro voli", 92, 140, ["voucher continuità territoriale", "caro voli Cagliari Olbia", "porto Cagliari hub", "traghetti costi"], "Isola: voli e traghetti.", "Continuità.", "B.I.P. Cap. 3: porti e continuità."),
  rt("sar-latte-ovino", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "prezzo latte ovino Sardegna e siccità invasi agricoli", 85, 127, ["latte ovino sotto costo", "invasi siccità Sardegna", "divieto vendita sottocosto", "gasolio agricolo detrazione"], "Latte ovino e siccità.", "Pastorizia.", "B.I.P. Cap. 15: divieto sottocosto e acqua."),
  rt("sar-portovesme", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi polo industriale Portovesme Sulcis ed energia Sardegna", 78, 115, ["Portovesme Sulcis lavoro", "gas russo bollette", "nucleare SMR", "golden power industria"], "Sulcis industriale.", "Energia e polo.", "B.I.P. Cap. 9: gas, SMR, Golden Power."),
  rt("sar-medici-interni", "SANITA_CUP", "SANITÀ", "SANITA", "carenza medici di base aree interne Sardegna Barbagia Ogliastra", 71, 104, ["medico base scoperto Ogliastra", "guardia medica Barbagia", "telemedicina isole", "deduzione sanitaria"], "Aree interne senza medico.", "Sanità periferica.", "B.I.P. Cap. 12: LEP e costi standard."),
  rt("sar-msna-costi", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "costi MSNA comuni sardi e case popolari ATER", 64, 93, ["MSNA prefetture Sardegna", "ERP priorità italiani", "compartecipazione IRPEF", "accertamento età minori"], "MSNA comuni sardi.", "ERP.", "B.I.P. Cap. 5 & 14: MSNA e ERP."),
];

const LIGURIA: RegionalGoogleTrendSeed[] = [
  rt("lig-autostrade-a10", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "traffico cantieri autostrade A10 A12 A26 e Porto Genova logistica", 100, 150, ["cantieri A10 Genova", "porto Genova hub", "A26 traffico", "pedaggi autostrada Liguria"], "A10/A12/A26 e porto Genova.", "Logistica.", "B.I.P. Cap. 3 (p. 17): porti e infrastrutture."),
  rt("lig-truffe-over65", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "truffe online telefoniche Over 65 Liguria regione più anziana", 93, 142, ["fondo garanzia CONSAP over 65 truffe", "truffe telefoniche anziani", "bollino impresa sicura", "cloud italia dati"], "Liguria anziana: truffe.", "Over 65.", "B.I.P. Cap. 11 (p. 72): Fondo CONSAP Over 65 truffe online."),
  rt("lig-ventimiglia", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza vicoli Genova e Ventimiglia confine migratorio", 86, 128, ["presidio Ventimiglia confine", "furti vicoli Genova", "sgombero occupazioni", "confini impermeabili"], "Genova e Ventimiglia.", "Confine e degrado.", "B.I.P. Cap. 5 & 7: confini e sicurezza urbana."),
  rt("lig-frane-boschi", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "dissesto idrogeologico entroterra Liguria e boschi", 79, 116, ["frane Liguria entroterra", "gestione boschi attiva", "piano nazionale acqua", "biomasse legno"], "Frane e boschi liguri.", "Idrogeologico.", "B.I.P. Cap. 15: gestione forestale attiva."),
  rt("lig-asl-caregiver", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASL Liguria e assistenza caregiver anziani", 72, 106, ["liste attesa ASL Liguria", "caregiver detrazione", "legge 38 cure palliative", "assistenza domiciliare"], "ASL Liguria anziani.", "Caregiver.", "B.I.P. Cap. 13: Legge 38 e caregiver."),
  rt("lig-energia-pmi", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "caro energia PMI Liguria cantieristica e porto", 65, 95, ["bollette PMI porto", "taglio oneri sistema", "gas russo", "cogenerazione"], "PMI liguri energia.", "Bollette.", "B.I.P. Cap. 9: taglio oneri e gas."),
];

const FVG: RegionalGoogleTrendSeed[] = [
  rt("fvg-balcani-trieste", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "rotta balcanica confini Trieste Gorizia e riammissioni", 100, 154, ["confine Trieste migranti", "riammissioni Dublino", "CPR Gorizia", "patuglie Frontex"], "Trieste/Gorizia rotta balcanica.", "Confine NE.", "B.I.P. Cap. 5: confini e riammissioni."),
  rt("fvg-monfalcone-navale", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi manifattura cantieristica navale Monfalcone FVG", 92, 141, ["cantieri Monfalcone lavoro", "golden power difesa", "filiera italia", "export reciprocità"], "Monfalcone navale.", "Cantieristica.", "B.I.P. Cap. 3, 5 & 10: Filiera Italia e difesa."),
  rt("fvg-moschee-assimilazione", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "sovranità moschee centri culturali Trieste assimilazione FVG", 85, 125, ["controllo centri culturali", "finanziamenti esteri moschee", "cittadinanza requisiti lingua", "no ius soli"], "Centri culturali e moschee.", "Assimilazione.", "B.I.P. Cap. 5 & 13 (pp. 29, 88): assimilazione e cittadinanza."),
  rt("fvg-energia-pordenone", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "caro energia PMI Pordenone Udine manifattura FVG", 78, 114, ["bollette PMI Friuli", "taglio cuneo fiscale", "gas russo", "SMR nucleare"], "PMI Pordenone/Udine.", "Energia.", "B.I.P. Cap. 9: gas e nucleare."),
  rt("fvg-asugi-liste", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASUGI ASUFC Friuli Venezia Giulia", 71, 103, ["tempi attesa ASUGI", "CUP Udine", "costi standard", "deduzione sanitaria"], "ASUGI/ASUFC.", "Sanità FVG.", "B.I.P. Cap. 12: costi standard."),
  rt("fvg-brennero-treni", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "sicurezza stazione Bolzano confine Brennero e treni FVG", 64, 93, ["treni regionali FVG", "Brennero traffico", "pedemontana Friuli", "HVO Euro 5"], "Treni e Brennero.", "Trasporti.", "B.I.P. Cap. 3 & 9: logistiche e HVO."),
];

const MARCHE: RegionalGoogleTrendSeed[] = [
  rt("mar-calzaturiero-export", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi distretto calzaturiero Fermo Macerata Pesaro ed export", 100, 152, ["export calzature Marche", "reciprocità doganale UE", "tracciabilità filiera", "credito PMI export"], "Fermo–Macerata–Pesaro calzature.", "Export.", "B.I.P. Cap. 3: mercati esteri e reciprocità."),
  rt("mar-pesca-ancona", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "marinerie pesca San Benedetto Ancona caro gasolio fermo biologico", 91, 137, ["gasolio pesca detrazione", "fermo biologico Adriatico", "data pesca etichetta", "pesca usurante pensione"], "Marinerie Adriatiche.", "Pesca.", "B.I.P. Cap. 15 (p. 105): pesca usurante e gasolio."),
  rt("mar-sisma-mutuo", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "ricostruzione cratere sismico Marche e Mutuo Tricolore Appennino", 84, 124, ["ricostruzione sisma Marche", "mutuo tricolore comuni piccoli", "spopolamento Appennino", "bonus ristrutturazione"], "Cratere sismico.", "Ricostruzione.", "B.I.P. Cap. 13: Mutuo Tricolore Appennino."),
  rt("mar-adriatica-a14", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "ferrovia Adriatica e cantieri A14 Marche collegamenti", 77, 113, ["cantieri A14 Marche", "ferrovia Adriatica", "pedaggi autostrada", "hub Ancona porto"], "A14 e ferrovia.", "Infrastrutture.", "B.I.P. Cap. 3: porti e ferrovie."),
  rt("mar-credit-crif", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "riabilitazione creditizia PMI marchigiane dopo acquisizioni bancarie", 70, 102, ["riabilitazione creditizia CRIF", "PMI marchigiane finanziamenti", "iva per cassa", "filiera italia"], "PMI marchigiane credito.", "CRIF.", "B.I.P. Cap. 4 (p. 20): riabilitazione creditizia."),
  rt("mar-asur-cup", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASUR Marche CUP e medici base", 63, 91, ["tempi attesa ASUR", "medici base scoperti", "ticket farmaci", "LEP"], "ASUR Marche.", "Sanità.", "B.I.P. Cap. 12: LEP."),
];

const ABRUZZO: RegionalGoogleTrendSeed[] = [
  rt("abr-idrica-fauna", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "emergenza idrica reti rurali Abruzzo e danni fauna selvatica", 100, 151, ["siccità entroterra Abruzzo", "cinghiali danni campi", "legge 157 caccia", "piano acqua invasi"], "Entroterra: acqua e fauna.", "Idrica e cinghiali.", "B.I.P. Cap. 15: acqua e Legge 157."),
  rt("abr-sevel-auto", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi automotive Val di Sangro Sevel e veicoli commerciali HVO", 92, 139, ["Sevel Val di Sangro cassa", "HVO veicoli commerciali", "stop 2035 termico", "filiera auto"], "Sevel/indotto.", "Automotive.", "B.I.P. Cap. 9 (p. 65): HVO e termico."),
  rt("abr-pescara-spaccio", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza costa adriatica Pescara e spaccio", 85, 126, ["spaccio Pescara litorale", "presidio Forze Ordine", "imputabilità 12 anni", "zone rosse"], "Pescara costa.", "Spaccio.", "B.I.P. Cap. 7: sicurezza costiera."),
  rt("abr-a24-pedaggi", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "caro pedaggi A24 A25 e treni Roma Pescara pendolari", 78, 115, ["pedaggi A24 A25", "treni Roma Pescara ritardi", "rimborso abbonamento", "HVO autostrada"], "A24/A25 pendolari.", "Pedaggi.", "B.I.P. Cap. 3 & 9: ferrovie e HVO."),
  rt("abr-punti-nascita", "SANITA_CUP", "SANITÀ", "SANITA", "punti nascita ospedali montani L'Aquila Chieti Teramo", 71, 104, ["punti nascita chiusi Abruzzo", "maternità montana", "piano vita nascente", "PS Teramo"], "Punti nascita montani.", "Maternità.", "B.I.P. Cap. 13: Vita Nascente."),
  rt("abr-mutuo-borghi", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "mutuo giovani Abruzzo borghi Appennino e spopolamento", 64, 93, ["mutuo tricolore borghi", "incentivi giovani montagna", "quoziente familiare", "assegno unico"], "Borghi appennini.", "Mutuo.", "B.I.P. Cap. 13: Mutuo Tricolore."),
];

const UMBRIA: RegionalGoogleTrendSeed[] = [
  rt("umb-ast-terni", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "futuro acciaierie AST Terni e costo energia hard-to-abate", 100, 148, ["AST Terni energia", "idrogeno nucleare SMR", "gas russo industria", "golden power acciaio"], "AST Terni energivora.", "Acciaio.", "B.I.P. Cap. 9 (p. 61): idrogeno e nucleare/idroelettrico."),
  rt("umb-fontivegge", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza e spaccio Perugia Fontivegge stazione", 91, 135, ["spaccio Fontivegge", "presidio stazione Perugia", "Forze Armate arresto", "daspo urbano"], "Fontivegge Perugia.", "Spaccio.", "B.I.P. Cap. 7 (p. 45): presidi stazione."),
  rt("umb-e45-isolamento", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "isolamento ferroviario e stradale E45 Umbria", 84, 122, ["E45 cantieri", "ferrovie Umbria ritardi", "pedaggi autostrada", "collegamenti Roma Perugia"], "E45 isolamento.", "Viabilità.", "B.I.P. Cap. 3: infrastrutture."),
  rt("umb-cinghiali-olio", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "danni cinghiali e tutela filiera olearia viticola umbra", 77, 112, ["cinghiali vigneti Umbria", "olio umbro prezzo", "legge 157 caccia", "corpo forestale"], "Olio/vino e cinghiali.", "Agricoltura.", "B.I.P. Cap. 15: Legge 157."),
  rt("umb-caregiver-anziani", "SANITA_CUP", "SANITÀ", "SANITA", "sostegno anziani non autosufficienti e caregiver Umbria", 70, 101, ["caregiver detrazione", "legge 38 palliative", "assistenza domiciliare", "RSA Umbria"], "Anziani caregiver.", "Sociale-sanità.", "B.I.P. Cap. 13: caregiver e Legge 38."),
  rt("umb-mutuo-perugia", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "mutuo prima casa giovani Perugia Terni e caro affitti", 63, 90, ["mutuo tricolore Umbria", "affitti Perugia", "quoziente familiare", "reddito genitorialità"], "Affitti Perugia.", "Mutuo.", "B.I.P. Cap. 13: Mutuo Tricolore."),
];

const BASILICATA: RegionalGoogleTrendSeed[] = [
  rt("bas-val-dagri-petrolio", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "estrazioni petrolifere Val d'Agri Tempa Rossa royalties e bollette Basilicata", 100, 157, ["royalties petrolio Basilicata", "Tempa Rossa giacimenti", "bollette gas russo", "ricadute territorio"], "Val d'Agri/Tempa Rossa.", "Petrolio e royalties.", "B.I.P. Cap. 9 (p. 60): giacimenti nazionali e royalties ai territori."),
  rt("bas-melfi-stellantis", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "crisi Stellantis Melfi e indotto auto Basilicata", 92, 140, ["Stellantis Melfi cassa", "HVO motori", "filiera auto", "fondo sovrano"], "Melfi Stellantis.", "Automotive.", "B.I.P. Cap. 3 & 9: Filiera Italia e termico/HVO."),
  rt("bas-carceri-165", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "scheda carceri distretto Puglia Basilicata sovraffollamento 165 percento", 85, 128, ["carceri 165 percento", "rimpatri detenuti stranieri", "10000 posti carcere", "polizia penitenziaria"], "Carceri 165%.", "Penitenziario.", "B.I.P. Cap. 8 (p. 54): 10.000 posti e rimpatri."),
  rt("bas-invasi-lucani", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "gestione invasi idrici lucani e siccità agricoltura Basilicata", 78, 114, ["invasi Basilicata siccità", "irrigazione agricola", "piano nazionale acqua", "grano sottocosto"], "Invasi lucani.", "Acqua agricola.", "B.I.P. Cap. 15: Piano Acqua."),
  rt("bas-spopolamento-mutuo", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "spopolamento comuni sotto 15000 abitanti Basilicata Mutuo Tricolore", 71, 103, ["mutuo tricolore comuni piccoli", "io resto al sud", "incentivi giovani", "assegno unico"], "Comuni piccoli.", "Spopolamento.", "B.I.P. Cap. 13: Mutuo Tricolore."),
  rt("bas-asl-potenza", "SANITA_CUP", "SANITÀ", "SANITA", "liste attesa ASL Basilicata Potenza Matera CUP", 64, 92, ["CUP Potenza Matera", "medici base scoperti", "LEP", "costi standard"], "ASL Basilicata.", "Sanità.", "B.I.P. Cap. 12: LEP."),
];

const MOLISE: RegionalGoogleTrendSeed[] = [
  rt("mol-ospedali-rientro", "SANITA_CUP", "SANITÀ", "SANITA", "ospedali piano di rientro Molise presidi Isernia Campobasso Termoli", 100, 149, ["ospedali rientro Molise", "LEP garantiti stato", "PS Termoli", "emigrazione sanitaria"], "Ospedali in rientro.", "Presidi sanitari.", "B.I.P. Cap. 12: garanzia LEP."),
  rt("mol-termoli-gigafactory", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "futuro stabilimento Termoli motori gigafactory neutralità tecnologica auto", 91, 136, ["Termoli stabilimento motori", "neutralità tecnologica auto", "HVO e-fuels", "stop 2035 UE"], "Termoli motori.", "Auto.", "B.I.P. Cap. 9: neutralità tecnologica."),
  rt("mol-mutuo-portabilita", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "spopolamento Molise portabilità Mutuo Tricolore piccoli comuni", 84, 123, ["mutuo tricolore portabilità", "comuni sotto 15000", "reddito rinascita", "incentivi giovani"], "Spopolamento estremo.", "Mutuo portabile.", "B.I.P. Cap. 13 (p. 95): portabilità Mutuo Tricolore."),
  rt("mol-bifernina-viabilita", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "dissesto idrogeologico viabilità Bifernina Trignina Molise", 77, 111, ["Bifernina frane", "Trignina cantieri", "viabilità interna", "hub Termoli porto"], "Bifernina/Trignina.", "Viabilità.", "B.I.P. Cap. 3 & 15: viabilità e idrogeologico."),
  rt("mol-msna-costi", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "costi migranti e MSNA bilanci comuni Molise", 70, 100, ["MSNA prefetture", "CPR Molise", "confini", "ERP italiani"], "MSNA Molise.", "Migranti.", "B.I.P. Cap. 5: MSNA Prefetture."),
  rt("mol-agricoltura-colline", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "olivicoltura Molise prezzo olio e siccità colline", 63, 89, ["olio molise prezzo", "siccità colline", "divieto sottocosto", "PAC agricoltori"], "Olivicoltura.", "Agricoltura.", "B.I.P. Cap. 15: divieto sottocosto."),
];

const TAA: RegionalGoogleTrendSeed[] = [
  rt("taa-orsi-lupi", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "gestione grandi carnivori orsi lupi sicurezza alpeggi Trentino Alto Adige", 100, 160, ["orsi Trentino incidenti", "lupi alpeggi danni", "legge 157 grandi carnivori", "sicurezza pubblica montagna"], "Orsi/lupi e alpeggi.", "Grandi carnivori.", "B.I.P. Cap. 15 (p. 106): carnivori e sicurezza pubblica."),
  rt("taa-idroelettrico", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "concessioni ripotenziamento centrali idroelettriche alpine pompaggio TAA", 93, 143, ["idroelettrico alpino pompaggio", "concessioni bacini", "bollette riscaldamento", "biomasse legno"], "Idroelettrico alpino.", "Energia.", "B.I.P. Cap. 9 (p. 63): idroelettrico e pompaggio."),
  rt("taa-legno-biomassa", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "filiera legno biomassa gestione attiva boschi alpini Trentino", 86, 127, ["gestione boschi attiva", "biomasse legnose", "foreste alpine", "stop frane"], "Boschi alpini.", "Biomasse.", "B.I.P. Cap. 9 & 15: gestione forestale."),
  rt("taa-brennero-sicurezza", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza stazione Bolzano Trento e Brennero confine", 79, 116, ["Brennero migranti", "stazione Bolzano sicurezza", "confine Austria", "presidio militare"], "Brennero e stazioni.", "Confine.", "B.I.P. Cap. 5 & 7: confini e sicurezza."),
  rt("taa-mele-vino", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "tutela agricoltura montagna mele vino Trentino Alto Adige", 72, 105, ["mele Alto Adige prezzo", "vino Trentino DOC", "PAC montagna", "stop concorrenza sleale"], "Mele e vino montani.", "Agricoltura montana.", "B.I.P. Cap. 15: PAC e reciprocità."),
  rt("taa-asl-montagna", "SANITA_CUP", "SANITÀ", "SANITA", "medici base e presidi sanitari vallate Trentino Alto Adige", 65, 94, ["medico base vallate", "guardia medica montagna", "telemedicina", "deduzione sanitaria"], "Vallate alpine.", "Sanità montana.", "B.I.P. Cap. 12: LEP vallate."),
];

const VDA: RegionalGoogleTrendSeed[] = [
  rt("vda-tunnel-monte-bianco", "TRASPORTI_PENDOLARI", "TRASPORTI", "TRASPORTI", "costo traforo Monte Bianco Gran San Bernardo isolamento logistico Valle d'Aosta", 100, 155, ["pedaggio Monte Bianco", "Gran San Bernardo costi", "isolamento logistico valle", "collegamenti Torino Aosta"], "Trafori alpini.", "Isolamento.", "B.I.P. Cap. 3: collegamenti alpini."),
  rt("vda-idroelettrico-riscaldamento", "LAVORO_AUTO_GREEN", "LAVORO & ENERGIA", "LAVORO", "valorizzazione idroelettrico alpino bollette riscaldamento montano Valle d'Aosta", 92, 141, ["idroelettrico valle", "riscaldamento montano", "biomasse legnose", "stop case green obbligo"], "Riscaldamento montano.", "Energia alpina.", "B.I.P. Cap. 9 (pp. 63–65): ibridi e biomasse senza divieti Case Green."),
  rt("vda-lupi-allevamenti", "AGRICOLTURA_TERRITORIO", "AGRICOLTURA", "TERRITORIO", "difesa allevamenti bovini montagna e gestione lupi Valle d'Aosta", 85, 126, ["lupi predazioni bovini", "legge 157 alpeggi", "corpo forestale", "indennizzi pastori"], "Lupi e bovini montani.", "Pastorizia.", "B.I.P. Cap. 15 (p. 106): grandi carnivori."),
  rt("vda-medici-vallate", "SANITA_CUP", "SANITÀ", "SANITA", "medici di base presidi sanitari vallate Valle d'Aosta", 78, 114, ["medico base vallata", "ospedale Aosta tempi", "telemedicina montagna", "caregiver detrazione"], "Vallate senza medico.", "Sanità alpina.", "B.I.P. Cap. 12: presidi e LEP."),
  rt("vda-turismo-costi", "FAMIGLIA_CASA", "FAMIGLIA", "COSTO_VITA", "caro vita turismo montano affitti Courmayeur Aosta giovani", 71, 103, ["affitti Courmayeur", "mutuo tricolore valle", "costo vita montagna", "quoziente familiare"], "Caro vita valle.", "Affitti.", "B.I.P. Cap. 13: Mutuo Tricolore."),
  rt("vda-confine-francia", "SICUREZZA_CITTA", "SICUREZZA", "SICUREZZA", "sicurezza confine Francia Valle d'Aosta transito Monte Bianco", 64, 92, ["confine Francia transito", "presidio traforo", "migranti valle", "videosorveglianza"], "Confine franco-valdostano.", "Sicurezza.", "B.I.P. Cap. 5: confini."),
];

export const REGIONAL_GOOGLE_TRENDS_CATALOG: Record<Region, RegionalGoogleTrendSeed[]> = {
  Lombardia: LOMBARDIA,
  Veneto: VENETO,
  Piemonte: PIEMONTE,
  Lazio: LAZIO,
  "Emilia-Romagna": EMILIA_ROMAGNA,
  Toscana: TOSCANA,
  Puglia: PUGLIA,
  Sicilia: SICILIA,
  Campania: CAMPANIA,
  Calabria: CALABRIA,
  Sardegna: SARDEGNA,
  Liguria: LIGURIA,
  "Friuli-Venezia Giulia": FVG,
  Marche: MARCHE,
  Abruzzo: ABRUZZO,
  Umbria: UMBRIA,
  Basilicata: BASILICATA,
  Molise: MOLISE,
  "Trentino-Alto Adige": TAA,
  "Valle d'Aosta": VDA,
};

export function regionalTrendSeedsFor(region: Region): RegionalGoogleTrendSeed[] {
  return REGIONAL_GOOGLE_TRENDS_CATALOG[region] ?? [];
}

export function allRegionalTrendSlugs(): Map<string, RegionalGoogleTrendSeed> {
  const m = new Map<string, RegionalGoogleTrendSeed>();
  for (const r of REGIONS) {
    for (const s of REGIONAL_GOOGLE_TRENDS_CATALOG[r]) {
      m.set(`${r}-${s.slug}`, s);
      m.set(s.slug, s);
    }
  }
  return m;
}

export function breakoutQueriesForSeed(seed: RegionalGoogleTrendSeed): {
  query: string;
  growthPct: number;
}[] {
  const base = [190, 145, 110, 95];
  return seed.relatedQueries.map((q, i) => ({
    query: q,
    growthPct: base[i]! - i * 8,
  }));
}
