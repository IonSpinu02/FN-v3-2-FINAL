export interface DiscomfortRemedyCard {
  id: string;
  scope: "nazionale" | "regionale";
  regionName?: string;
  macroArea:
    | "Sanità & Liste d’Attesa"
    | "Sicurezza & Degrado Urbano"
    | "Potere d’Acquisto & Fisco"
    | "Crisi Industriale & Lavoro"
    | "Infrastrutture & Spopolamento"
    | "Agricoltura & Territorio";
  severityScore: number; // 1..100
  citizenPainDescription: string; // Qual è il disagio concreto vissuto dalle persone
  hardDataEvidence: string; // Dato numerico oggettivo da citare (ISTAT/AGENAS/Viminale/MEF)
  politicalResponsibility: string; // Perché chi governa oggi (nazionale o regione) non sta risolvendo
  targetSocialGroups: string[]; // Categorie sociali colpite da intercettare
  fnTechnicalRemedy: string; // Soluzione tecnica concreta FN / Programma B.I.P.
  teamOperationalChecklist: string[]; // Azioni pratiche per il Team Tecnico FN
  vannacciSoundbite: string; // Frase d'impatto pronta per TV, palco o social
}

export interface RegionalStrategicDossier {
  regionName: string;
  currentGovernance: "Centrodestra" | "Centrosinistra" | "Autonomisti/Misto";
  electoralOpportunityScore: number; // 1..100 priorità per FN
  socialAngerIndex: number; // 1..100 livello di esasperazione sociale rilevata
  primaryCrisisSummary: string;
  politicalVacuumAnalysis: string; // Dove pescare voti e perché
  discomfortsAndRemedies: DiscomfortRemedyCard[];
}

export const NATIONAL_DISCOMFORT_REMEDIES: DiscomfortRemedyCard[] = [
  {
    id: "nat-sanita",
    scope: "nazionale",
    macroArea: "Sanità & Liste d’Attesa",
    severityScore: 94,
    citizenPainDescription:
      "Milioni di cittadini costretti a pagare visite private o a rinunciare alle cure per tempi di attesa oltre 8-14 mesi su diagnostica e specialistica, con pronto soccorso al collasso.",
    hardDataEvidence:
      "Oltre 4,5 milioni di italiani hanno rinunciato a prestazioni sanitarie nell’ultimo anno per liste d’attesa o costi (dati ISTAT/Fondazione Gimbe-AGENAS).",
    politicalResponsibility:
      "Decenni di tagli lineari ai posti letto, tetti di spesa sul personale medico/infermieristico e lottizzazione partitica delle ASL sia nelle regioni di CDX sia in quelle di CSX.",
    targetSocialGroups: [
      "Pensionati",
      "Famiglie monoreddito",
      "Malati cronici",
      "Personale medico e infermieristico",
    ],
    fnTechnicalRemedy:
      "Piano B.I.P. Sanità: abolizione immediata del tetto di spesa per assunzioni mediche/infermieristiche, apertura ambulatori pubblici serali e festivi retribuiti con detassazione degli straordinari, commissariamento meritocratico dei manager ASL che non abbattono le liste entro 180 giorni.",
    teamOperationalChecklist: [
      "Raccogliere tramite i comitati provinciali le ricevute dei tempi d’attesa reali CUP regione per regione.",
      "Incontrare sindacati autonomi medici di pronto soccorso e infermieri.",
      "Presentare mozione-tipo nei consigli regionali per trasparenza in tempo reale delle agende pubblico/intramoenia.",
    ],
    vannacciSoundbite:
      "Uno Stato che pretende le tasse al centesimo ma ti dà una TAC tra quattordici mesi ha rotto il patto con i cittadini: i manager ASL incapaci vanno mandati a casa, non premiati per tessera di partito.",
  },
  {
    id: "nat-sicurezza",
    scope: "nazionale",
    macroArea: "Sicurezza & Degrado Urbano",
    severityScore: 92,
    citizenPainDescription:
      "Stazioni ferroviarie, mezzi pubblici e periferie ostaggio di baby-gang, spaccio, borseggi e immigrazione irregolare impunita; donne, anziani e pendolari hanno paura a uscire la sera.",
    hardDataEvidence:
      "Oltre il 60% dei reati predatori di strada nei grandi poli urbani coinvolge soggetti recidivi o irregolari già noti alle forze dell’ordine ma rimessi in libertà.",
    politicalResponsibility:
      "Sinistra ideologicamente permissiva nei grandi comuni e centrodestra frenato da burocrazia, mancata esecuzione effettiva dei rimpatri e tutele insufficienti agli agenti in strada.",
    targetSocialGroups: [
      "Pendolari",
      "Commercianti di quartiere",
      "Donne e giovani",
      "Forze dell’Ordine",
    ],
    fnTechnicalRemedy:
      "Presidio interforze permanente h24 su stazioni e snodi trasporti, tutela legale integrale automatica per gli agenti in servizio, certezza dell’esecuzione pena senza sconti automatici per recidivi e accordi bilaterali vincolanti per rimpatri immediati.",
    teamOperationalChecklist: [
      "Mappare le 30 stazioni e piazze più pericolose d’Italia con dossier fotografico e dati denunce.",
      "Organizzare punti stampa davanti alle stazioni negli orari dei pendolari (17:30–19:30).",
      "Attivare tavolo tecnico con rappresentanze di Polizia, Carabinieri e Polizia Locale.",
    ],
    vannacciSoundbite:
      "La sicurezza non è uno slogan da campagna elettorale: se chi delinque esce dopo due ore e il poliziotto rischia il processo, lo Stato sta difendendo la parte sbagliata.",
  },
  {
    id: "nat-potere-acquisto",
    scope: "nazionale",
    macroArea: "Potere d’Acquisto & Fisco",
    severityScore: 90,
    citizenPainDescription:
      "Stipendi italiani fermi mentre carrello della spesa, mutui, affitti, assicurazioni e bollette erodono il ceto medio; piccole imprese e partite IVA schiacciate da fisco, adempimenti e credito caro.",
    hardDataEvidence:
      "I salari reali in Italia sono ancora inferiori ai livelli del 2008 (-8% potere d’acquisto reale cumulato OCSE), con pressione fiscale effettiva sopra il 42,5%.",
    politicalResponsibility:
      "Subalternità ai vincoli austero-burocratici UE, tassazione eccessiva sul lavoro ed extraprofitti energetici/finanziari mai realmente redistribuiti a famiglie e PMI.",
    targetSocialGroups: [
      "Lavoratori dipendenti ceto medio",
      "Artigiani e Commercianti",
      "Partite IVA",
      "Giovani coppie con mutuo/affitto",
    ],
    fnTechnicalRemedy:
      "Detassazione strutturale di premi produttività, tredicesime e straordinari; semplificazione radicale per microimprese e partite IVA; revisione delle accise energetiche e stop immediato agli oneri da transizione ecologica ideologica scaricati su bollette e auto.",
    teamOperationalChecklist: [
      'Produrre il calcolatore "Quanto ti costa la burocrazia verde e fiscale" per famiglie e artigiani.',
      "Incontrare associazioni commercianti e distretti artigiani provinciali.",
      "Preparare scheda comparativa sui costi reali di Casa Green e stop motori termici.",
    ],
    vannacciSoundbite:
      "In Italia chi lavora e produce viene trattato come un bancomat, mentre a Bruxelles decidono quale auto devi comprare e quanto devi spendere per ristrutturare casa tua.",
  },
  {
    id: "nat-industria-agricoltura",
    scope: "nazionale",
    macroArea: "Crisi Industriale & Lavoro",
    severityScore: 86,
    citizenPainDescription:
      "Delocalizzazioni selvagge, crisi dell’indotto automotive, meccanica e moda, più concorrenza sleale extra-UE contro gli agricoltori e il Made in Italy.",
    hardDataEvidence:
      "Forte crescita delle ore di Cassa Integrazione Guadagni nel manifatturiero e perdita continua di aziende agricole familiari negli ultimi 5 anni.",
    politicalResponsibility:
      "Accettazione passiva del Green Deal europeo e di trattati commerciali asimmetrici senza clausole di reciprocità sanitaria e lavorativa.",
    targetSocialGroups: [
      "Operai manifatturieri",
      "Imprenditori PMI indotto",
      "Agricoltori e Allevatori",
      "Autotrasportatori",
    ],
    fnTechnicalRemedy:
      "Neutralità tecnologica totale (difesa endotermico, biocarburanti e filiera nazionale), dazi di reciprocità contro il dumping ambientale/salariale estero, piano energetico sovrano (incluso nucleare di nuova generazione) per abbattere il costo industriale del kWh.",
    teamOperationalChecklist: [
      "Presidiare fisicamente i cancelli delle aziende in crisi e i consorzi agrari.",
      "Costruire dossier per ogni distretto industriale regionale a rischio.",
    ],
    vannacciSoundbite:
      "Stiamo distruggendo le nostre fabbriche e i nostri agricoltori per importare batterie dalla Cina e cibo senza regole dall’estero: questa non è ecologia, è suicidio economico.",
  },
];

const REGIONAL_SEED_DATA: Array<{
  regionName: string;
  gov: "Centrodestra" | "Centrosinistra" | "Autonomisti/Misto";
  oppScore: number;
  anger: number;
  macro: DiscomfortRemedyCard["macroArea"];
  crisis: string;
  evidence: string;
  vacuum: string;
  remedy: string;
  targets: string[];
}> = [
  {
    regionName: "Lombardia",
    gov: "Centrodestra",
    oppScore: 93,
    anger: 84,
    macro: "Sicurezza & Degrado Urbano",
    crisis:
      "Insicurezza cronica a Milano e lungo le linee ferroviarie regionali Trenord, costo proibitivo di affitti/vita e liste d’attesa sanitarie che spingono forzatamente verso il privato.",
    evidence:
      "Milano prima in Italia per indice di criminalità denunciata per 100mila abitanti; tempi medi visite specialistiche pubbliche oltre soglia massima in numerose ASST.",
    vacuum:
      "Forte delusione del ceto produttivo lombardo e degli elettori storici Lega/FdI stanchi del degrado metropolitano e dei disservizi pendolari.",
    remedy:
      "Presidio permanente ferrovie regionali, sblocco agende sanitarie pubbliche senza favorire solo i grandi gruppi privati accreditati e taglio burocrazia per PMI manifatturiere.",
    targets: [
      "Pendolari Trenord",
      "Artigiani e PMI",
      "Cittadini periferie Milano/Brescia/Bergamo",
    ],
  },
  {
    regionName: "Veneto",
    gov: "Centrodestra",
    oppScore: 95,
    anger: 80,
    macro: "Crisi Industriale & Lavoro",
    crisis:
      "Pressione su distretti manifatturieri ed export, carenza medici di base/pronto soccorso nelle province e malcontento per accoglienza diffusa e microcriminalità nelle città medie.",
    evidence:
      "Oltre 400mila veneti senza medico di medicina generale titolare fisso nelle aree interne/provinciali e rallentamento ordini metalmeccanica.",
    vacuum:
      "Elettorato autonomista e produttivo orfano di una rappresentanza identitaria netta dopo anni di promesse incompiute su autonomia reale e fisco.",
    remedy:
      "Tutela integrale dei distretti produttivi veneti contro vincoli UE, incentivi per medici sul territorio provinciale e tolleranza zero contro baby-gang a Padova, Verona, Vicenza, Mestre.",
    targets: [
      "Piccoli imprenditori e partite IVA",
      "Elettorato deluso post-Zaia",
      "Famiglie comuni medi",
    ],
  },
  {
    regionName: "Piemonte",
    gov: "Centrodestra",
    oppScore: 90,
    anger: 87,
    macro: "Crisi Industriale & Lavoro",
    crisis:
      "Crollo storico della produzione automotive a Mirafiori e desertificazione dell’indotto torinese, uniti a degrado acuto in quartieri come Barriera di Milano.",
    evidence:
      "Produzione auto a Torino ai minimi storici dal dopoguerra con migliaia di lavoratori dell’indotto in ammortizzatori sociali.",
    vacuum:
      "Operai, tecnici e ceto medio impoverito traditi sia dalla sinistra ZTL torinese sia dall’inerzia nazionale sulle multinazionali che incassano incentivi e delocalizzano.",
    remedy:
      "Vincolo ferreo anti-delocalizzazione per chi ha ricevuto fondi pubblici, riconversione industriale ad alto valore (difesa/aerospazio/meccanica) e bonifica sicurezza Torino Nord.",
    targets: [
      "Operai e tecnici indotto auto",
      "Commercianti Torino e provincia",
      "Pensionati",
    ],
  },
  {
    regionName: "Emilia-Romagna",
    gov: "Centrosinistra",
    oppScore: 88,
    anger: 85,
    macro: "Agricoltura & Territorio",
    crisis:
      "Lentezza burocratica nei rimborsi e nella messa in sicurezza idrogeologica post-alluvioni, crisi distretti ceramica/meccanica per costi energetici ed emergenza sicurezza a Bologna/Modena/Reggio.",
    evidence:
      "Migliaia di famiglie e imprese agricole romagnole ancora in attesa di opere strutturali definitive sui bacini fluviali.",
    vacuum:
      "Cittadini e agricoltori furiosi per lo scaricabarile istituzionale Roma-Bologna e per il degrado ideologico nei capoluoghi amministrati dal PD.",
    remedy:
      "Piano straordinario manutenzione fiumi/invasi senza veti ambientalisti ideologici, energia a prezzo calmierato per distretto ceramico/meccanico e sicurezza reale a Bologna.",
    targets: [
      "Alluvionati e Agricoltori Romagna",
      "Imprese ceramica/motor valley",
      "Cittadini Bologna/Modena",
    ],
  },
  {
    regionName: "Toscana",
    gov: "Centrosinistra",
    oppScore: 91,
    anger: 86,
    macro: "Potere d’Acquisto & Fisco",
    crisis:
      "Addizionale IRPEF regionale ai massimi per coprire i buchi della sanità, crisi profonda dei distretti moda/pelletteria/tessile (Prato, Scandicci, Santa Croce) e illegalità diffusa.",
    evidence:
      "Aumento stangata IRPEF regionale sul ceto medio e impennata cassa integrazione nella filiera moda/pelle toscana.",
    vacuum:
      "Terra storicamente di Vannacci con altissima permeabilità: il sistema di potere PD è logoro e il centrodestra locale appare spesso debole e diviso.",
    remedy:
      "Taglio sprechi machine regionali per azzerare gli aumenti IRPEF, contrasto durissimo al lavoro nero e alla concorrenza illegale nei distretti produttivi, tutela coste e turismo.",
    targets: [
      "Ceto medio tassato",
      "Artigiani moda e pelletteria",
      "Residenti costa tirrenica e Prato/Firenze",
    ],
  },
  {
    regionName: "Lazio",
    gov: "Centrodestra",
    oppScore: 89,
    anger: 88,
    macro: "Sanità & Liste d’Attesa",
    crisis:
      "Pronto soccorso romani saturi, trasporti pubblici e rifiuti nella Capitale cronicamente insufficienti, desertificazione sanitaria ed economica nelle province (Frosinone, Latina, Rieti, Viterbo).",
    evidence:
      "Tempi medi di permanenza nei PS di Roma tra i più alti d’Italia prima del ricovero; pendolarismo ferroviario laziale tra le linee peggiori nei report utenti.",
    vacuum:
      "Enorme bacino di pubblico impiego, forze armate/polizia, professionisti e residenti delle periferie romane e delle province dimenticate dal centralismo capitolino.",
    remedy:
      "Rete sanitaria provinciale potenziata per decongestionare Roma, pugno duro contro occupazioni abusive e roghi tossici, piano infrastrutture pendolari Lazio.",
    targets: [
      "Pendolari province laziali",
      "Comparto Difesa e Sicurezza",
      "Famiglie quadranti periferici Roma",
    ],
  },
  {
    regionName: "Puglia",
    gov: "Centrosinistra",
    oppScore: 92,
    anger: 89,
    macro: "Agricoltura & Territorio",
    crisis:
      "Agricoltura in ginocchio tra Xylella, siccità/reti idriche colabrodo, nodo ex-Ilva a Taranto, sanità clientelare con liste bloccate e furti d’auto/criminalità nel Foggiano e Barese.",
    evidence:
      "Oltre il 40% di dispersione idrica nelle reti regionali e mobilità sanitaria passiva costosa verso il Nord.",
    vacuum:
      "Ventennio di gestione clientelare del centrosinistra pugliese a fine corsa e opposizione locale frammentata: spazio enorme per una proposta d’ordine e merito.",
    remedy:
      "Commissariamento infrastrutture idriche ed espianto/reimpianto rapido per gli olivicoltori, smantellamento clientelismo ASL e presidio antimafia/antipredatorio in Capitanata e Bari.",
    targets: [
      "Agricoltori e Olivicoltori",
      "Lavoratori Taranto e Brindisi",
      "Famiglie Bari, Foggia e Salento",
    ],
  },
  {
    regionName: "Campania",
    gov: "Centrosinistra",
    oppScore: 84,
    anger: 91,
    macro: "Sanità & Liste d’Attesa",
    crisis:
      "Fuga dei giovani laureati, caos pronto soccorso e carenza cronica di personale sanitario, emergenza sicurezza giovanile/armi a Napoli e provincia, trasporti Circumvesuviana al limite.",
    evidence:
      "Saldo migratorio giovanile costantemente negativo e altissimo tasso di rinuncia alle cure nelle fasce popolari.",
    vacuum:
      "Ceto medio, professionisti e famiglie oneste stanchi sia del sistema di potere feudale regionale sia dell’assistenzialismo senza sviluppo.",
    remedy:
      "Meritocrazia rigorosa nella sanità pubblica campana, piano sicurezza strade e scuole contro la cultura camorristica, zone economiche reali per chi assume stabilmente.",
    targets: [
      "Famiglie e commercianti onesti",
      "Giovani qualificati",
      "Utenti sanità e trasporti locali",
    ],
  },
  {
    regionName: "Sicilia",
    gov: "Centrodestra",
    oppScore: 87,
    anger: 92,
    macro: "Infrastrutture & Spopolamento",
    crisis:
      "Crisi idrica severa per dighe incompiute, caro-voli insulare, strade interne crollate, pressione sbarchi a Lampedusa/coste sud e sanità lottizzata.",
    evidence:
      "Dispersione idrica oltre il 50% in diverse province e infrastrutture ferroviarie interne a binario unico con tempi di percorrenza ottocenteschi.",
    vacuum:
      "Forte rabbia contro una classe politica regionale percepita come autoreferenziale e incapace di spendere bene i fondi esistenti.",
    remedy:
      "Completamento militare di invasi e reti idriche, continuità territoriale aerea a tetto tariffario garantito, difesa confini marittimi e stop lottizzazione ospedali.",
    targets: [
      "Agricoltori e Allevatori siciliani",
      "Lavoratori e studenti fuori sede",
      "Comuni costieri",
    ],
  },
  {
    regionName: "Liguria",
    gov: "Centrodestra",
    oppScore: 86,
    anger: 82,
    macro: "Infrastrutture & Spopolamento",
    crisis:
      "Isolamento infrastrutturale (cantieri autostradali eterni, ferrovie fragili), regione più anziana d’Italia con enorme bisogno sanitario e pressione su balneari/turismo.",
    evidence:
      "Indice di vecchiaia più alto d’Europa con picchi critici di domanda domiciliare e ospedaliera.",
    vacuum:
      "Cittadini esausti per pedaggi pagati a fronte di code quotidiane e operatori turistici/portuali timorosi delle direttive UE.",
    remedy:
      "Sospensione automatica pedaggi su tratte cantierizzate, tutela imprese balneari familiari liguri, potenziamento assistenza sanitaria territoriale agli anziani.",
    targets: [
      "Automobilisti e autotrasportatori portuali",
      "Imprese balneari e turistiche",
      "Pensionati",
    ],
  },
  {
    regionName: "Friuli-Venezia Giulia",
    gov: "Centrodestra",
    oppScore: 88,
    anger: 78,
    macro: "Sicurezza & Degrado Urbano",
    crisis:
      "Pressione continua lungo la Rotta Balcanica su Trieste e Gorizia, carenza personale sanitario di confine e timori industriali nella manifattura.",
    evidence:
      "Migliaia di rintrilli irregolari annui lungo il confine orientale con costi di gestione scaricati sui comuni.",
    vacuum:
      "Elettorato di confine estremamente sensibile a ordine, identità nazionale e controllo rigoroso delle frontiere.",
    remedy:
      "Controllo sistematico permanente dei valichi orientali con riammissioni immediate, incentivi fiscali di frontiera per trattenere medici e lavoratori in FVG.",
    targets: [
      "Residenti fascia confinaria Trieste/Gorizia/Udine",
      "Forze dell’Ordine",
      "PMI manifatturiere",
    ],
  },
  {
    regionName: "Marche",
    gov: "Centrodestra",
    oppScore: 85,
    anger: 81,
    macro: "Crisi Industriale & Lavoro",
    crisis:
      "Crisi prolungata dei distretti calzaturiero, mobile ed elettrodomestico, ricostruzione e rilancio economico lento del cratere sismico interno e carenza medici.",
    evidence:
      "Contrazione export calzaturiero/elettrodomestico e spopolamento continuo dei comuni montani appenninici.",
    vacuum:
      "Piccoli imprenditori e famiglie delle aree interne che si sentono periferia dimenticata dai grandi partiti nazionali.",
    remedy:
      "Defiscalizzazione quinquennale per imprese e residenti del cratere appenninico, difesa attiva del Made in Italy calzaturiero/manifatturiero e ospedali di territorio.",
    targets: [
      "Artigiani calzature/mobile",
      "Comunità aree interne sisma",
      "Famiglie costa marchigiana",
    ],
  },
  {
    regionName: "Abruzzo",
    gov: "Centrodestra",
    oppScore: 84,
    anger: 82,
    macro: "Sanità & Liste d’Attesa",
    crisis:
      "Deficit sanitario regionale coperto con aumenti fiscali, difficoltà dell’automotive in Val di Sangro e spopolamento delle aree montane interne.",
    evidence:
      "Disavanzo ASL abruzzesi scaricato su addizionali regionali e rallentamento produttivo del polo veicoli commerciali.",
    vacuum:
      "Contribuenti abruzzesi traditi dall’aumento delle tasse regionali nonostante le promesse di segno opposto.",
    remedy:
      "Audit indipendente sui conti ASL per tagliare sprechi anziché alzare l’IRPEF, blindatura occupazionale del polo industriale Val di Sangro e collegamenti trasversali Roma-Adriatico.",
    targets: [
      "Lavoratori Val di Sangro",
      "Contribuenti ceto medio",
      "Residenti L’Aquila e aree interne",
    ],
  },
  {
    regionName: "Calabria",
    gov: "Centrodestra",
    oppScore: 82,
    anger: 93,
    macro: "Sanità & Liste d’Attesa",
    crisis:
      "Emergenza sanitaria cronica dopo oltre un decennio di commissariamenti, emigrazione sanitaria record, SS106 e collegamenti interni pericolosi, spopolamento giovanile.",
    evidence:
      "Oltre 300 milioni di euro annui pagati dalla Calabria ad altre regioni per curare i propri cittadini fuori regione.",
    vacuum:
      "Cittadini stanchi di annunci mirabolanti mentre negli ospedali provinciali mancano reparti base e ambulanze medicalizzate.",
    remedy:
      "Riapertura operativa presidi ospedalieri territoriali con incentivi economici speciali per medici che scelgono la Calabria, messa in sicurezza prioritaria SS106 e viabilità interna.",
    targets: [
      "Famiglie costrette a viaggi della speranza",
      "Giovani e professionisti calabresi",
      "Agricoltori",
    ],
  },
  {
    regionName: "Sardegna",
    gov: "Centrosinistra",
    oppScore: 83,
    anger: 88,
    macro: "Agricoltura & Territorio",
    crisis:
      "Assalto speculativo eolico/fotovoltaico sul paesaggio sardo senza benefici sulle bollette locali, caro-trasporti aerei/navali, crisi pastorizia e sanità territoriale sguarnita.",
    evidence:
      "Centinaia di richieste di impianti rinnovabili giganti per multipli del fabbisogno elettrico reale dell’isola mentre spopolano i paesi interni.",
    vacuum:
      "Fortissimo sentimento identitario contro la colonizzazione energetica speculativa e l’inefficienza della giunta attuale.",
    remedy:
      "Moratoria ferrea contro la speculazione eolica su suolo agricolo/paesaggistico, continuità territoriale garantita tutto l’anno e prezzo giusto per latte/produzioni agropastorali.",
    targets: [
      "Pastori e Agricoltori",
      "Comitati difesa territorio sardo",
      "Pendolari continuità territoriale",
    ],
  },
  {
    regionName: "Umbria",
    gov: "Centrosinistra",
    oppScore: 84,
    anger: 80,
    macro: "Infrastrutture & Spopolamento",
    crisis:
      "Isolamento ferroviario alta velocità, nodo industriale ed energetico acciaierie di Terni, liste d’attesa sanitarie e spaccio/degrado in aree urbane come Fontivegge a Perugia.",
    evidence:
      "Costi dell’energia industriale insostenibili per la siderurgia speciale ternana e invecchiamento demografico accelerato.",
    vacuum:
      "Elettorato moderato e produttivo deluso dall’alternanza inconcludente tra blocchi tradizionali.",
    remedy:
      "Contratto energetico strategico nazionale per la siderurgia di Terni, collegamento rapido all’Alta Velocità e presidio sicurezza permanente nelle stazioni umbre.",
    targets: [
      "Operai e indotto Terni",
      "Commercianti Perugia/Foligno",
      "Famiglie ceto medio",
    ],
  },
  {
    regionName: "Basilicata",
    gov: "Centrodestra",
    oppScore: 80,
    anger: 86,
    macro: "Crisi Industriale & Lavoro",
    crisis:
      "Crisi gravissima dello stabilimento Stellantis di Melfi, crisi idrica paradossale in una regione ricca d’acqua ed emigrazione giovanile costante.",
    evidence:
      "Crollo dei volumi produttivi a Melfi e fortissima perdita demografica prevista nei prossimi 10 anni.",
    vacuum:
      "Rabbia sociale in una terra che estrae petrolio e fornisce acqua ma vede chiudere le fabbriche e partire i figli.",
    remedy:
      "Uso vincolato delle royalties energetiche per tagliare tasse regionali, manutenere le dighe e finanziare nuova manifattura a Melfi e Matera.",
    targets: [
      "Operai polo Melfi",
      "Agricoltori Metapontino",
      "Famiglie Potenza e Matera",
    ],
  },
  {
    regionName: "Molise",
    gov: "Centrodestra",
    oppScore: 78,
    anger: 85,
    macro: "Sanità & Liste d’Attesa",
    crisis:
      "Rischio smantellamento reparti salvavita (emodinamica, punti nascita), strade interne franate e incertezza industriale su Termoli.",
    evidence:
      "Spopolamento tra i più rapidi d’Italia e tagli continui alla rete ospedaliera pubblica per vincoli ragionieristici.",
    vacuum:
      "Cittadini molisani che si sentono cittadini di serie B sacrificati sull’altare dei parametri numerici.",
    remedy:
      "Deroga montana/demografica obbligatoria ai parametri standard per salvare ospedali e punti nascita molisani, più rilancio industriale vero a Termoli.",
    targets: [
      "Comitati difesa ospedali pubblici",
      "Lavoratori area Termoli",
      "Comuni aree interne",
    ],
  },
  {
    regionName: "Trentino-Alto Adige",
    gov: "Autonomisti/Misto",
    oppScore: 76,
    anger: 72,
    macro: "Sicurezza & Degrado Urbano",
    crisis:
      "Degrado in crescita nei centri di Bolzano, Trento e Rovereto, costo delle abitazioni inaccessibile per le giovani famiglie locali e convivenza gestione grandi carnivori.",
    evidence:
      "Aumento reati predatori nei capoluoghi alpini e prezzi al mq residenziale fuori portata per i redditi medi locali.",
    vacuum:
      "Elettorato italiano e valligiano in cerca di fermezza su sicurezza urbana, difesa delle comunità montane e tutela delle famiglie.",
    remedy:
      "Sicurezza urbana rigorosa a Bolzano e Trento, politiche abitative riservate prioritariamente ai residenti storici e gestione pragmatica della sicurezza nei boschi.",
    targets: [
      "Comunità italiane Bolzano/Merano",
      "Residenti valli trentine",
      "Giovani famiglie",
    ],
  },
  {
    regionName: "Valle d’Aosta",
    gov: "Autonomisti/Misto",
    oppScore: 74,
    anger: 73,
    macro: "Infrastrutture & Spopolamento",
    crisis:
      "Costi esorbitanti del pedaggio autostradale A5, criticità trafori alpini (Monte Bianco/Gran San Bernardo) e carenza medici ospedalieri.",
    evidence:
      "Autostrada A5 tra le più care d’Europa al chilometro con pesante impatto su residenti, turismo e merci.",
    vacuum:
      "Spazio per una voce fuori dalle vecchie consorterie autonomiste su trasporti, costo della vita montano e sanità.",
    remedy:
      "Abbattimento tariffe autostradali per residenti e lavoratori, blindatura raddoppio/continuità trafori alpini e attrazione personale sanitario.",
    targets: [
      "Operatori turistici e commerciali",
      "Pendolari valdostani",
      "Famiglie residenti",
    ],
  },
];

export const ALL_REGIONAL_DOSSIERS: RegionalStrategicDossier[] =
  REGIONAL_SEED_DATA.map((r) => ({
    regionName: r.regionName,
    currentGovernance: r.gov,
    electoralOpportunityScore: r.oppScore,
    socialAngerIndex: r.anger,
    primaryCrisisSummary: r.crisis,
    politicalVacuumAnalysis: r.vacuum,
    discomfortsAndRemedies: [
      {
        id: `reg-${r.regionName.toLowerCase().replace(/[^a-z]/g, "-")}-1`,
        scope: "regionale" as const,
        regionName: r.regionName,
        macroArea: r.macro,
        severityScore: r.anger,
        citizenPainDescription: r.crisis,
        hardDataEvidence: r.evidence,
        politicalResponsibility: `Amministrazione regionale (${r.gov}) incapace di invertire il deterioramento dei servizi essenziali e la perdita di competitività locale.`,
        targetSocialGroups: r.targets,
        fnTechnicalRemedy: r.remedy,
        teamOperationalChecklist: [
          `Attivare il referente FN ${r.regionName} per raccogliere 3 casi documentati sul territorio entro 7 giorni.`,
          `Incontrare rappresentanti di: ${r.targets.join(", ")}.`,
          `Diffondere comunicato stampa locale con il dato ufficiale e la proposta risolutiva FN.`,
        ],
        vannacciSoundbite: `In ${r.regionName} i cittadini pagano tasse da primo mondo per avere servizi in affanno: noi non veniamo a fare passerelle, portiamo la soluzione concreta dove gli altri hanno fallito.`,
      },
    ],
  })).sort(
    (a, b) => b.electoralOpportunityScore - a.electoralOpportunityScore,
  );

export function getRegionalDossierByName(
  regionName: string,
): RegionalStrategicDossier | undefined {
  return ALL_REGIONAL_DOSSIERS.find(
    (d) => d.regionName.toLowerCase() === regionName.toLowerCase(),
  );
}
