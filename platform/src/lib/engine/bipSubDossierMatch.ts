import { isHousingEvictionContext } from "./territoryIssueDisambiguation";
import type { TerritoryIssueCategory } from "./territoryIssuesTypes";
import { TERRITORY_ISSUE_CATEGORIES } from "./territoryIssuesTypes";
import type { BipSolutionSlide } from "./territoryIssuesTypes";

export type BipSubDossier = {
  id: string;
  categories: TerritoryIssueCategory[];
  keywords: RegExp;
  /** Badge completo (Capitolo, pagina, articolo). */
  bipReference: string;
  capRef: string;
  pressDeclaration: string;
  provvedimentoAtto: string;
  enteCompetente: string;
  tempiAttuazione: string;
  fnPromiseId?: string;
};

/** Ordine = priorità di match (più specifico in alto). */
const BIP_SUB_DOSSIERS: BipSubDossier[] = [
  // —— SICUREZZA (10) ——
  {
    id: "BIP_SEC_01",
    categories: ["SICUREZZA"],
    keywords:
      /legittima\s*difesa|sparato\s*al\s*ladro|rapina\s*in\s*villa|rapina\s*in\s*gioieller|rapina\s*in\s*tabaccher|difeso\s*in\s*casa|indagato\s*per\s*eccesso|furti\s*in\s*abitazione|furto\s*in\s*casa/i,
    bipReference: "B.I.P. Cap. 7, pp. 42–43 & Cap. 8, p. 50 · Legittima Difesa Artt. 52-55 c.p.",
    capRef: "Cap. 7–8 · Legittima difesa",
    pressDeclaration:
      "Chi entra con violenza in una casa o in un'attività commerciale si assume tutto il rischio della reazione: con Futuro Nazionale la proporzionalità della difesa è sempre presunta per legge e nessun criminale potrà mai chiedere un euro di risarcimento alla propria vittima.",
    provvedimentoAtto:
      "Modifica degli artt. 52 e 55 c.p. secondo il principio 'in extremis extrema sunt tenenda': presunzione assoluta di proporzionalità e di turbamento invincibile nella difesa del domicilio e dell'azienda, ed esclusione totale di qualsiasi risarcimento civile o penale a favore dell'aggressore o dei suoi aventi causa.",
    enteCompetente: "Parlamento · Ministero Giustizia",
    tempiAttuazione: "DDL immediato · 60–90 giorni",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_02",
    categories: ["SICUREZZA"],
    keywords:
      /inseguimento|non\s*si\s*ferma\s*all['']alt|forzato\s*il\s*posto\s*di\s*blocco|agente\s*indagato|poliziotto\s*indagato|carabiniere\s*indagato|aggressione\s*agli\s*agenti|feriti\s*agenti|scontri\s*corteo|antagonisti/i,
    bipReference: "B.I.P. Cap. 7, pp. 43–44 · Riforma Art. 53 c.p. & Speronamento Controllato",
    capRef: "Cap. 7 · Tutela FdO",
    pressDeclaration:
      "Chi attacca una divisa attacca lo Stato e chi fugge a un posto di blocco mette a rischio la vita dei cittadini: basta processi a freddo contro i nostri agenti, sì allo scudo legale integrale e al diritto di fermare i fuggitivi anche con lo speronamento controllato.",
    provvedimentoAtto:
      "Riforma dell'art. 53 c.p. sull'uso legittimo della forza e delle armi, superamento dell'iscrizione automatica e dell'inutile modello 45-bis con copertura legale integrale dello Stato, e introduzione della norma che legittima le manovre di contenimento, contatto e speronamento controllato dei veicoli in fuga.",
    enteCompetente: "Ministero Interno · Ministero Giustizia",
    tempiAttuazione: "Decreto-legge · 30–60 giorni",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_03",
    categories: ["SICUREZZA"],
    keywords:
      /baby\s*gang|minoren|14\s*anni|13\s*anni|15\s*anni|branco|bulli|accoltellamento\s*tra\s*giovani|rapina\s*giovanissim|stupro|violenza\s*sessuale/i,
    bipReference:
      "B.I.P. Cap. 7, pp. 46–47, Cap. 8, p. 51 & Cap. 14, p. 98 · Imputabilità 12 anni",
    capRef: "Cap. 7–8 · Baby gang",
    pressDeclaration:
      "Le bande giovanili usano lo scudo dei 14 anni per spadroneggiare impunite nelle nostre città: abbassiamo subito l'imputabilità penale a 12 anni con rito ordinario per i reati gravi e chiamiamo i genitori a pagare di tasca propria, sospendendo ogni sussidio pubblico.",
    provvedimentoAtto:
      "Abbassamento della soglia di imputabilità penale da 14 a 12 anni per i reati gravi, sanzioni pecuniarie e sospensione dei sussidi ai genitori inadempienti con obbligo di affiancare il figlio nei Cantieri di Cittadinanza supervisionati da personale delle Forze dell'Ordine in congedo.",
    enteCompetente: "Parlamento · Ministero Giustizia · INPS",
    tempiAttuazione: "DDL · Legge di Bilancio",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_04",
    categories: ["SICUREZZA"],
    keywords:
      /carcer|san\s*vittore|detenut|sovraffollament|polizia\s*penitenziaria|rivolta\s*in\s*carcere|evaso|suicidio\s*in\s*carcere|piede\s*libero|scarcerat|recidiv/i,
    bipReference: "B.I.P. Cap. 8, pp. 50–57 & Cap. 5, p. 23 · Piano Carceri & Rimpatrio",
    capRef: "Cap. 8 · Carceri",
    pressDeclaration:
      "Oggi teniamo in libertà i delinquenti abituali perché un terzo delle nostre celle è occupato da detenuti stranieri che ci costano un miliardo l'anno: rimpatriamo subito i detenuti stranieri nei Paesi d'origine, costruiamo 10.000 nuovi posti in 36 mesi e introduciamo il lavoro obbligatorio in carcere per pagarsi vitto e alloggio.",
    provvedimentoAtto:
      "Istituzione dell'autonomo Dipartimento di Polizia Penitenziaria, rimpatrio del 31,5%-35% di detenuti stranieri tramite accordi bilaterali condizionati, edilizia modulare per 10.000 nuovi posti in 36 mesi, lavoro intramurario obbligatorio, scanner anti-droga/telefoni e Tribunali per i reati di strada con sentenza in 90 giorni.",
    enteCompetente: "Ministero Giustizia · DAP",
    tempiAttuazione: "Piano triennale · DDL 90 giorni",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_05",
    categories: ["SICUREZZA"],
    keywords:
      /spaccio|droga|stupefacent|cocaina|eroina|hashish|pusher|arrestato\s*per\s*droga|piazza\s*di\s*spaccio|tossicodipenden/i,
    bipReference: "B.I.P. Cap. 7, pp. 45–46 & Cap. 14, p. 99 · Tolleranza zero spaccio",
    capRef: "Cap. 7 · Spaccio",
    pressDeclaration:
      "La scusa dell'uso personale è diventata il paravento del piccolo spaccio che avvelena i nostri quartieri e le nostre scuole: ripristiniamo l'arresto obbligatorio in flagranza e dotiamo le Polizie Locali di unità cinofile antidroga davanti agli istituti scolastici.",
    provvedimentoAtto:
      "Unificazione delle fattispecie di traffico di stupefacenti, superamento della copertura dell'uso personale e delle attenuanti per lo spaccio di strada, arresto obbligatorio in flagranza, istituzione di unità cinofile antidroga nelle Polizie Locali e Bio-consapevolezza obbligatoria nelle scuole.",
    enteCompetente: "Ministero Interno · Prefetture",
    tempiAttuazione: "Decreto-legge · 45 giorni",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_06",
    categories: ["SICUREZZA"],
    keywords:
      /occupazion[ei]?\s*abusiv|campo\s*abusiv|centr[oi]\s*social|racket\s*delle\s*case|allacci\s*abusiv|sgombero.{0,40}(campo|centr[oi]\s*social|migrant|clandestin|spaccio|degrad|criminal)/i,
    bipReference: "B.I.P. Cap. 7, p. 46 · Sgomberi & centri sociali",
    capRef: "Cap. 7 · Occupazioni",
    pressDeclaration:
      "La proprietà privata è sacra: chi occupa abusivamente una casa o trasforma un immobile in una centrale dell'illegalità va sgomberato in 24 ore, tagliando subito gli allacci abusivi e smantellando i centri sociali occupati.",
    provvedimentoAtto:
      "Procedura esecutiva lampo di sgombero senza rinvii, inasprimento penale per gli organizzatori del racket delle occupazioni, pesanti sanzioni per l'allacciamento abusivo alle utenze pubbliche e chiusura definitiva dei centri sociali occupati.",
    enteCompetente: "Prefettura · Tribunali · Comuni",
    tempiAttuazione: "Immediato · 24–72 ore operativo",
    fnPromiseId: "BIP.07",
  },
  {
    id: "BIP_SEC_07",
    categories: ["SICUREZZA"],
    keywords:
      /espulsion|rimpatr|cpr|foglio\s*di\s*via|irregolar|clandestin|richiedente\s*asilo|permesso\s*di\s*soggiorno|cittadinanza/i,
    bipReference: "B.I.P. Cap. 5, pp. 24–30 · Espulsioni & CPR",
    capRef: "Cap. 5 · Espulsioni",
    pressDeclaration:
      "Basta espulsioni bloccate dai ricorsi o da certificati compiacenti: il ricorso non sospende più il rimpatrio ma si presenta dal proprio Paese d'origine, le visite di idoneità nei CPR passano ai medici militari e chi commette reati violenti da naturalizzato perde la cittadinanza italiana.",
    provvedimentoAtto:
      "Abolizione della sospensione automatica dell'espulsione (ricorso dal Paese d'origine), accertamento sanitario nei CPR al personale medico militare, espulsione automatica per reati dolosi e revoca cittadinanza per naturalizzati autori di crimini violenti.",
    enteCompetente: "Ministero Interno · CPR · Prefetture",
    tempiAttuazione: "DDL Cap. 5 · 60 giorni",
    fnPromiseId: "BIP.05",
  },
  {
    id: "BIP_SEC_08",
    categories: ["SICUREZZA"],
    keywords:
      /msna|minori\s*stranier|sbarc|lampedusa|ong|migranti|accoglienza|prefettur/i,
    bipReference: "B.I.P. Cap. 5, pp. 24–26 · MSNA & ONG",
    capRef: "Cap. 5 · MSNA / sbarchi",
    pressDeclaration:
      "I sindaci non possono tagliare i servizi agli italiani per pagare milioni di euro per finti minori stranieri di 18 anni: togliamo subito la gestione MSNA ai Comuni riportandola alle Prefetture con esame radiografico obbligatorio dell'età e fermiamo il business degli approdi ONG con la confisca penale delle navi.",
    provvedimentoAtto:
      "Trasferimento integrale della gestione MSNA dai Comuni alle Prefetture, accertamento medico auxologico e radiografico obbligatorio, interdizione acque territoriali con dirottamento su primo approdo naturale, confisca obbligatoria navi ONG e domande d'asilo fuori UE.",
    enteCompetente: "Prefetture · Viminale · Guardia Costiera",
    tempiAttuazione: "Decreto-legge · 30 giorni",
    fnPromiseId: "BIP.05",
  },
  {
    id: "BIP_SEC_09",
    categories: ["SICUREZZA", "COSTO_VITA"],
    keywords:
      /truff|raggir|anzian|over\s*65|finto\s*maresciallo|finto\s*carabiniere|phishing|cyber|hacker/i,
    bipReference: "B.I.P. Cap. 11, p. 72 · Fondo CONSAP Anti-Truffe Over 65",
    capRef: "Cap. 11 · Truffe Over 65",
    pressDeclaration:
      "Ogni anno oltre 25.000 anziani vengono derubati dei risparmi di una vita dalle truffe online e telefoniche: istituiamo presso CONSAP il Fondo di Garanzia per risarcire gli Over 65 truffati e potenziamo i reparti investigativi della Polizia Postale.",
    provvedimentoAtto:
      "Istituzione del Fondo di Garanzia gestito da CONSAP per il risarcimento delle vittime di frodi online e raggiri Over 65, con rivalsa sui colpevoli e potenziamento tecnologico della Polizia Postale.",
    enteCompetente: "CONSAP · Polizia Postale",
    tempiAttuazione: "Legge di Bilancio · 6 mesi",
    fnPromiseId: "BIP.13-CV",
  },
  {
    id: "BIP_SEC_10",
    categories: ["SICUREZZA", "TRASPORTI"],
    keywords:
      /stazione\s*(centrale|ferrovi)|degrad\s*urban|daspo|zone\s*rosse|presidi\s*h24|quartier\s*degrad|metro\s*.*(furto|rapin|spaccio)/i,
    bipReference: "B.I.P. Cap. 7, pp. 44, 47 & Cap. 10, p. 69 · Protocollo militare & Daspo",
    capRef: "Cap. 7 · Stazioni / degrado",
    pressDeclaration:
      "Nelle stazioni e nei quartieri ostaggio del degrado non bastano controlli di poche ore: applichiamo il protocollo militare 'Modellare, Bonificare, Presidiare e Ricostruire', dando alle Forze Armate qualifiche di pubblica sicurezza e poteri di arresto, con Zone Rosse permanenti e Daspo urbano fino a 5 anni.",
    provvedimentoAtto:
      "Impiego organico delle Forze Armate sotto direzione prefettizia secondo la dottrina 'Modellare, Bonificare, Presidiare e Ricostruire' con qualifiche di pubblica sicurezza per l'arresto, Zone Rosse senza limiti cronologici e Daspo urbano fino a 5 anni.",
    enteCompetente: "Prefettura · Difesa · Polfer",
    tempiAttuazione: "Decreto operativo · 15–45 giorni",
    fnPromiseId: "BIP.07",
  },

  // —— TERRITORIO / AGRICOLTURA ——
  {
    id: "BIP_AGR_01",
    categories: ["TERRITORIO"],
    keywords: /cinghial|lup|ors|fauna|danni\s*coltur|caccia|legge\s*157|corpo\s*forestale|predator/i,
    bipReference: "B.I.P. Cap. 15, p. 106 · Legge 157/1992 & Corpo Forestale",
    capRef: "Cap. 15 · Fauna selvatica",
    pressDeclaration:
      "Lupi, orsi e cinghiali stanno mettendo in ginocchio agricoltura e sicurezza pubblica: riformiamo la Legge 157/1992, ricostituiamo il Corpo Forestale dello Stato e torniamo a gestire attivamente il territorio.",
    provvedimentoAtto:
      "Riforma L. 157/1992 per contenimento selettivo, gestione grandi carnivori compatibile con alpeggi e allevamenti, ricostituzione del Corpo Forestale dello Stato.",
    enteCompetente: "MASE · MASAF · Regioni",
    tempiAttuazione: "DDL · 90 giorni",
    fnPromiseId: "BIP.15",
  },
  {
    id: "BIP_AGR_02",
    categories: ["TERRITORIO"],
    keywords:
      /pesca|vongol|granchio\s*blu|tonno|mariner|gasolio\s*barche|fermo\s*biologico|porto\s*pesch/i,
    bipReference: "B.I.P. Cap. 15, p. 105 · Pesca & marinerie",
    capRef: "Cap. 15 · Pesca",
    pressDeclaration:
      "Le marinerie non possono chiudere per gasolio e regole UE assurde: difendiamo la pesca come lavoro usurante, la data di pesca in etichetta e le deroghe tecniche sulle taglie minime.",
    provvedimentoAtto:
      "Pesca tra i lavori usuranti, deroga taglia vongole, defiscalizzazione gasolio marinerie, obbligo data di pesca in etichetta e quote tonno rosso alle flotte locali.",
    enteCompetente: "MASAF · Mit · Regioni costiere",
    tempiAttuazione: "Manovra · PAC",
    fnPromiseId: "BIP.15",
  },
  {
    id: "BIP_AGR_03",
    categories: ["TERRITORIO"],
    keywords:
      /fotovoltaic|pannell\s*solari|pale\s*eolic|eolico|espropri.*agricol|campo\s*agricol.*fv/i,
    bipReference: "B.I.P. Cap. 9, p. 63 & Cap. 15, p. 105 · Stop FV a terra",
    capRef: "Cap. 9–15 · FV/eolico",
    pressDeclaration:
      "Basta speculazione energetica che divora suolo agricolo e paesaggio: divieto assoluto di fotovoltaico a terra su terreni agricoli e stop all'eolico selvaggio.",
    provvedimentoAtto:
      "Divieto assoluto di fotovoltaico a terra su suolo agricolo, tutela del paesaggio dall'eolico non compatibile e stop alle espropriazioni per impianti speculativi.",
    enteCompetente: "MASE · MASAF · Regioni",
    tempiAttuazione: "Decreto-legge · 60 giorni",
    fnPromiseId: "BIP.15",
  },
  {
    id: "BIP_AGR_04",
    categories: ["TERRITORIO"],
    keywords:
      /siccit|acqua|invas|dighe|irrigaz|alluvion|fiume\s*po|boschi|idrogeolog|frane/i,
    bipReference: "B.I.P. Cap. 9, p. 64 & Cap. 15, p. 104 · Piano Nazionale Acqua",
    capRef: "Cap. 15 · Acqua & Po",
    pressDeclaration:
      "Senza acqua e alvei curati non c'è agricoltura né sicurezza: Piano Nazionale dell'Acqua, regimazione del Po e gestione forestale attiva contro frane e alluvioni.",
    provvedimentoAtto:
      "Piano Nazionale dell'Acqua con invasi e reti irrigue, regimazione del fiume Po, manutenzione alvei e gestione forestale attiva per biomasse e contenimento idrogeologico.",
    enteCompetente: "MASE · Regioni · Autorità di bacino",
    tempiAttuazione: "PNRR / legge quadro · 12–36 mesi",
    fnPromiseId: "BIP.15",
  },
  {
    id: "BIP_AGR_05",
    categories: ["TERRITORIO"],
    keywords:
      /sottocosto|prezzo\s*(grano|latte|ortofrutta|latte)|pac\b|trattori|pomodoro\s*cinese|mercosur|made\s*in\s*italy\s*falso|dogan/i,
    bipReference: "B.I.P. Cap. 3, p. 18 & Cap. 15, pp. 101–103 · Sottocosto & dogane",
    capRef: "Cap. 15 · Prezzi agricoli",
    pressDeclaration:
      "Stop alla vendita sotto costo e al falso Made in Italy: fondi PAC solo ai veri agricoltori, revisione del Codice Doganale UE e blocco al Mercosur che affossa le nostre filiere.",
    provvedimentoAtto:
      "Divieto effettivo di cessione sottocosto, PAC solo a imprenditori agricoli, revisione Codice Doganale UE contro ultima trasformazione sleale e stop Mercosur.",
    enteCompetente: "MASAF · UE · MIMIT",
    tempiAttuazione: "Manovra · negoziato UE",
    fnPromiseId: "BIP.15",
  },

  // —— LAVORO & ENERGIA ——
  {
    id: "BIP_LAV_01",
    categories: ["LAVORO", "COSTO_VITA"],
    keywords: /bollett|luce|gas\b|energia|oneri\s*di\s*sistema|case\s*green|caldaie|fit\s*for\s*55/i,
    bipReference: "B.I.P. Cap. 9, pp. 58–61 · Bollette & Nucleare SMR",
    capRef: "Cap. 9 · Energia",
    pressDeclaration:
      "Tagliamo subito gli oneri di sistema in bolletta, blocchiamo l'ora legale che ci costa miliardi, riapriamo il gas russo dove serve e investiamo in Nucleare SMR per difendere famiglie e PMI.",
    provvedimentoAtto:
      "Taglio immediato oneri di sistema in bolletta, ora legale permanente, riapertura forniture gas russo dove conveniente, Nucleare SMR/AMR e idroelettrico.",
    enteCompetente: "MASE · ARERA · Governo",
    tempiAttuazione: "Decreto Aiuti · 30 giorni",
    fnPromiseId: "BIP.09",
  },
  {
    id: "BIP_LAV_02",
    categories: ["LAVORO"],
    keywords:
      /saldo\s*e\s*acconto|iva\s*per\s*cassa|partita\s*iva|p\.?\s*iva|f24\b|artigian|commerciant|contante|flat\s*tax|gdpr|bollino\s*impresa|burocrazia|manovra|legge\s*di\s*bilancio|pensioni?|tasse|fisco|acconti\s*fiscali|cartella\s*esattorial/i,
    bipReference: "B.I.P. Cap. 1, p. 9, Cap. 2, p. 14 & Cap. 11, p. 71 · Fisco PMI",
    capRef: "FISCO & PENSIONI · Stop Saldo-Acconto P.IVA",
    pressDeclaration:
      "Meno burocrazia e più produzione: superiamo saldo e acconto, IVA per cassa per artigiani e PMI, tetto al contante a 10.000 euro e pensione minima a 750 euro — senza Moneta Fiscale come prima leva.",
    provvedimentoAtto:
      "FISCO & PENSIONI · Stop Saldo-Acconto P.IVA, Tetto Contante 10.000 € e Pensione Minima 750 €. Superamento saldo e acconto, IVA per cassa, Bollino Impresa Sicura MIMIT.",
    enteCompetente: "MEF · MIMIT · Agenzia Entrate",
    tempiAttuazione: "Legge di Bilancio",
    fnPromiseId: "BIP.02",
  },
  {
    id: "BIP_LAV_03",
    categories: ["LAVORO", "COSTO_VITA"],
    keywords: /crif|segnalazion.*credit|mutui\s*impres|pignorament|debiti\s*pmi|centrale\s*rischi/i,
    bipReference: "B.I.P. Cap. 4, pp. 19–21 · Riabilitazione creditizia",
    capRef: "Cap. 4 · Credito PMI",
    pressDeclaration:
      "Un imprenditore segnalato in CRIF non deve chiudere: riabilitazione creditizia rapida e impignorabilità dei conti di sostentamento per sbloccare investimenti reali.",
    provvedimentoAtto:
      "Riabilitazione creditizia famiglie e PMI, tutela impignorabilità conti stipendi/pensioni e banche d'interesse nazionale.",
    enteCompetente: "MEF · Banca d'Italia",
    tempiAttuazione: "DDL · 6 mesi",
    fnPromiseId: "BIP.02",
  },
  {
    id: "BIP_LAV_04",
    categories: ["LAVORO"],
    keywords:
      /cassa\s*integraz|crisi\s*aziend|delocalizz|fabbric|filiera\s*auto|stellantis|mirafiori|sussidi/i,
    bipReference: "B.I.P. Cap. 2, p. 13 & Cap. 3, p. 16 · Filiera Italia",
    capRef: "Cap. 2–3 · Industria",
    pressDeclaration:
      "Salviamo le fabbriche strategiche con il Progetto Filiera Italia e il Fondo Sovrano: stop all'ideologia elettrica che uccide motori termici, cuneo fiscale tagliato con il Principio di San Paolo.",
    provvedimentoAtto:
      "Progetto Filiera Italia, Fondo Sovrano per la Crescita Nazionale, Golden Power, Principio di San Paolo sui sussidi e neutralità tecnologica HVO/e-fuels.",
    enteCompetente: "MIMIT · Invitalia · Governo",
    tempiAttuazione: "Piano industriale · 12 mesi",
    fnPromiseId: "BIP.02",
  },

  // —— FAMIGLIA & CARO-VITA ——
  {
    id: "BIP_FAM_07",
    categories: ["COSTO_VITA"],
    keywords:
      /sgomber|sfratt|emergenza\s*abitativ|inquilin|ributtat|proprietari[oa].{0,24}immobil|ordine\s*religios|anzian.{0,40}(sgomber|sfratt|strada)|donne.{0,40}(sgomber|sfratt|strada)|case\s*popolar|\berp\b|allogg/i,
    bipReference: "B.I.P. Cap. 5, Misura 14 & Cap. 13–14 · Emergenza abitativa & ERP",
    capRef: "Cap. 13–14 · Emergenza abitativa",
    pressDeclaration:
      "Anziani, donne e famiglie italiane non possono finire in strada per uno sfratto: priorità assoluta agli italiani e agli anziani fragili nelle assegnazioni ERP, fondo emergenza abitativa e recupero degli immobili pubblici sfitti.",
    provvedimentoAtto:
      "Fondo nazionale emergenza abitativa, priorità italiani/anziani fragili in graduatorie ERP, recupero immobili pubblici sfitti e tavolo prefettizio di salvaguardia alloggiativa con ricollocamento protetto.",
    enteCompetente: "Parlamento · Ministero Infrastrutture · ATER · Comuni",
    tempiAttuazione: "DDL / Legge di Bilancio · 60–90 giorni",
    fnPromiseId: "BIP.13-CV",
  },
  {
    id: "BIP_FAM_01",
    categories: ["COSTO_VITA"],
    keywords: /mutuo|affitt|comprare\s*casa|giovani\s*coppie|prima\s*casa|consap/i,
    bipReference: "B.I.P. Cap. 13, pp. 94–95 · Mutuo Tricolore",
    capRef: "Cap. 13 · Mutuo Tricolore",
    pressDeclaration:
      "Le giovani coppie devono poter fare figli senza rinunciare alla casa: Mutuo Tricolore con tasso che scende al 1° e 2° figlio e si azzera al terzo, con moratoria di un anno a ogni nascita.",
    provvedimentoAtto:
      "Mutuo Tricolore CONSAP: tasso 0% al 3° figlio, moratoria 12 mesi a nascita, portabilità nei comuni sotto 15.000 abitanti.",
    enteCompetente: "CONSAP · MEF · INPS",
    tempiAttuazione: "Legge di Bilancio · 6 mesi",
    fnPromiseId: "BIP.13-CV",
  },
  {
    id: "BIP_FAM_02",
    categories: ["COSTO_VITA"],
    keywords:
      /natalit|culle\s*vuote|asilo|nascit|figli|concors|quoziente\s*famili|quote\s*azzurr/i,
    bipReference: "B.I.P. Cap. 1, p. 8 & Cap. 13, pp. 89–93 · Natalità",
    capRef: "Cap. 13 · Famiglia",
    pressDeclaration:
      "Riprendiamo a fare figli con Vero Quoziente Familiare, Reddito di Genitorialità e Quote Azzurre nei concorsi: la famiglia italiana torna al centro della fiscalità.",
    provvedimentoAtto:
      "Quoziente familiare con nonni coabitanti, Fattore Famiglia Italia, Reddito di Genitorialità/Rinascita, Quote Azzurre e asili nido potenziati.",
    enteCompetente: "Governo · INPS · MEF",
    tempiAttuazione: "Manovra famiglia",
    fnPromiseId: "BIP.13-CV",
  },
  {
    id: "BIP_FAM_03",
    categories: ["COSTO_VITA", "SICUREZZA"],
    keywords: /case\s*popolar|erp\b|graduator|ater\b|bonus\s*comunal/i,
    bipReference: "B.I.P. Cap. 5, Misura 14, p. 28 & Cap. 14, p. 96 · ERP italiani",
    capRef: "Cap. 5–14 · Case popolari",
    pressDeclaration:
      "Prima gli italiani nelle graduatorie ERP: stop ai non cittadini nei bonus straordinari e nelle case popolari pagate dai contribuenti.",
    provvedimentoAtto:
      "Priorità assoluta ai cittadini italiani nelle graduatorie ERP ed esclusione dei non cittadini dai benefici abitativi straordinari.",
    enteCompetente: "Ministero Infrastrutture · ATER · Comuni",
    tempiAttuazione: "Circolare · DDL",
    fnPromiseId: "BIP.05",
  },
  {
    id: "BIP_FAM_04",
    categories: ["LAVORO", "COSTO_VITA"],
    keywords: /bilancio\s*comun|sindac|tagli\s*ai\s*comun|irpef\s*local|compartecipaz/i,
    bipReference: "B.I.P. Cap. 12, pp. 75–76 · Sussidiarietà comunale",
    capRef: "Cap. 12 · Comuni",
    pressDeclaration:
      "I sindaci virtuosi devono trattenere parte dell'IRPEF sul territorio: compartecipazione diretta dei Comuni e aliquota comunale negativa dove si taglia la spesa.",
    provvedimentoAtto:
      "Sussidiarietà verticale con compartecipazione Comuni al gettito IRPEF e facoltà di aliquota comunale negativa per sindaci virtuosi.",
    enteCompetente: "MEF · ANCI · Comuni",
    tempiAttuazione: "Riforma fiscale · 12 mesi",
    fnPromiseId: "BIP.02",
  },
  {
    id: "BIP_FAM_05",
    categories: ["COSTO_VITA", "SANITA"],
    keywords: /pensione\s*minim|619|750\s*€|anziani\s*indigent|età\s*pensionabile|41\s*anni/i,
    bipReference: "B.I.P. Cap. 1, p. 10 & Cap. 14, p. 97 · Pensioni minime",
    capRef: "Cap. 14 · Pensioni",
    pressDeclaration:
      "Nessun anziano indigente sotto i 750 euro: pensione minima reale, uscita a 41 anni di contributi e sconto età per le madri che hanno costruito il Paese.",
    provvedimentoAtto:
      "Pensione minima 750 € per indigenti, uscita a 41 anni contributivi effettivi, sconto età per madri e equiparazione TFS/TFR.",
    enteCompetente: "INPS · MEF · Parlamento",
    tempiAttuazione: "Legge di Bilancio",
    fnPromiseId: "BIP.13-CV",
  },
  {
    id: "BIP_FAM_06",
    categories: ["COSTO_VITA", "SICUREZZA"],
    keywords: /servizi\s*social|affidi\s*minor|bibbian|smartphone\s*scuol|social\s*sotto/i,
    bipReference: "B.I.P. Cap. 14, pp. 98–99 · Servizi sociali & minori",
    capRef: "Cap. 14 · Affidi",
    pressDeclaration:
      "Dopo Bibbiano serve rigore: allontanamento minori solo extrema ratio con indicatori EPI oggettivi, divieto smartphone a scuola e social sotto i 15 anni.",
    provvedimentoAtto:
      "Protocolli EPI nei servizi sociali, allontanamento solo extrema ratio, divieto smartphone in classe e social under 15, Cantieri di Cittadinanza.",
    enteCompetente: "Ministero Famiglia · Regioni · Comuni",
    tempiAttuazione: "DDL · 90 giorni",
    fnPromiseId: "BIP.13-CV",
  },

  // —— SANITÀ ——
  {
    id: "BIP_SAN_01",
    categories: ["SANITA", "COSTO_VITA"],
    keywords:
      /fine\s*vita|suicidio\s*assistito|malati\s*terminal|disabil|caregiver|non\s*autosuffic|legge\s*38|legge\s*104|invalidit|pensione\s*di\s*invalid|cure\s*palliativ|barriere\s*architetton/i,
    bipReference: "B.I.P. Cap. 13 · Sanità, Welfare & Tutela Disabilità/Caregiver",
    capRef: "Cap. 13 · Sanità, Welfare & Disabilità",
    pressDeclaration:
      "Prima i fondi a disabili e caregiver italiani: Legge 104 tutelata, detrazione piena delle spese di assistenza e stop a tagli che scaricano le famiglie mentre si finanziano MSNA e ONG.",
    provvedimentoAtto:
      "Fondo Priorità Disabili e Caregiver, applicazione integrale Legge 38/2010 e 104, detrazione 100% spese di assistenza, contributi previdenziali volontari per caregiver familiari.",
    enteCompetente: "Ministero Salute · Regioni · INPS",
    tempiAttuazione: "Decreto attuativo · 45 giorni",
    fnPromiseId: "BIP.13-SAN",
  },
  {
    id: "BIP_SAN_02",
    categories: ["SANITA"],
    keywords:
      /liste?\s*d['']attesa|\bcup\b|pronto\s*soccorso|code\s*(al\s*)?ps|carenza\s*medici|medicina\s*generale|ospedal/i,
    bipReference: "B.I.P. Cap. 1, p. 9 & Cap. 12, p. 75 · Liste & LEP",
    capRef: "Cap. 12 · Sanità",
    pressDeclaration:
      "Liste d'attesa e PS al collasso si curano con soldi tracciati e Regioni responsabili: deduzione integrale spese sanitarie, costi standard e garanzia statale dei LEP.",
    provvedimentoAtto:
      "Deduzione spese sanitarie tracciabili, costi standard regionali, riutilizzo libero avanzi nelle Regioni virtuose e garanzia LEP su tutto il territorio.",
    enteCompetente: "Ministero Salute · Regioni · AGENAS",
    tempiAttuazione: "Patto sanità · Manovra",
    fnPromiseId: "BIP.13-SAN",
  },

  // —— TRASPORTI ——
  {
    id: "BIP_TRA_01",
    categories: ["TRASPORTI"],
    keywords:
      /euro\s*[45]|hvo\b|e-fuel|ztl\b|area\s*b\b|rottamazione|ritard.*tren|pendolar|trenord|rimborso\s*abbonament/i,
    bipReference: "B.I.P. Cap. 9, pp. 65–66 · HVO & ferrovia",
    capRef: "Cap. 9 · Trasporti",
    pressDeclaration:
      "Stop ai divieti punitivi Euro 5: HVO ed e-fuels sul parco circolante, niente rottamazione forzata, e investimenti veri su treni regionali e pendolari.",
    provvedimentoAtto:
      "Moratoria Fit for 55/2035, biocarburanti HVO ed e-fuels, potenziamento TPL e ferrovia, rimborso abbonamenti per ritardi sistematici.",
    enteCompetente: "MIT · Regioni · RFI",
    tempiAttuazione: "DDL mobilità · 60 giorni",
    fnPromiseId: "BIP.09-TR",
  },
];

const FALLBACK_BY_CATEGORY: Record<TerritoryIssueCategory, string> = {
  SICUREZZA: "BIP_SEC_10",
  TERRITORIO: "BIP_AGR_05",
  LAVORO: "BIP_LAV_02",
  COSTO_VITA: "BIP_FAM_01",
  SANITA: "BIP_SAN_02",
  TRASPORTI: "BIP_TRA_01",
};

function normalizeCategory(
  category: TerritoryIssueCategory | string,
): TerritoryIssueCategory {
  const c = String(category).toUpperCase().replace(/-/g, "_");
  if (c.includes("SICUREZZ")) return "SICUREZZA";
  if (c.includes("SANIT")) return "SANITA";
  if (c.includes("TRASPORT")) return "TRASPORTI";
  if (c.includes("LAVOR")) return "LAVORO";
  if (c.includes("CARO") || c.includes("FAMIGL") || c.includes("COSTO")) return "COSTO_VITA";
  if (c.includes("AGRICOL") || c.includes("TERRITOR")) return "TERRITORIO";
  if (TERRITORY_ISSUE_CATEGORIES.includes(c as TerritoryIssueCategory)) {
    return c as TerritoryIssueCategory;
  }
  return "SICUREZZA";
}

function dossierById(id: string): BipSubDossier {
  return BIP_SUB_DOSSIERS.find((d) => d.id === id) ?? BIP_SUB_DOSSIERS[0]!;
}

/**
 * Matching semantico granulare titolo + sintesi → sotto-dossier B.I.P.
 * (sostituisce risposte generiche per sola macro-categoria).
 */
export function matchExactBipSubDossier(
  title: string,
  summary: string,
  category: TerritoryIssueCategory | string,
): BipSubDossier {
  const blob = `${title} ${summary}`.normalize("NFC");
  if (isHousingEvictionContext(blob)) {
    return dossierById("BIP_FAM_07");
  }
  const cat = normalizeCategory(category);
  for (const d of BIP_SUB_DOSSIERS) {
    if (!d.categories.includes(cat)) continue;
    if (d.keywords.test(blob)) return d;
  }
  return dossierById(FALLBACK_BY_CATEGORY[cat]);
}

export function fnPromiseIdForSubDossier(subDossierId: string): string | undefined {
  return dossierById(subDossierId).fnPromiseId;
}

export function subDossierToSolutionSlide(d: BipSubDossier): BipSolutionSlide {
  return {
    emergencyId: d.id,
    capRef: d.capRef,
    measures: d.provvedimentoAtto,
    badgeLabel: d.bipReference,
    pressDeclaration: d.pressDeclaration,
  };
}

export function applySubDossierToIssueFields(
  title: string,
  summary: string,
  category: TerritoryIssueCategory,
): {
  dossier: BipSubDossier;
  bipEmergencyId: string;
  bipSolutionBadge: string;
  bipSolutions: BipSolutionSlide[];
  cosaDire: string;
} {
  const dossier = matchExactBipSubDossier(title, summary, category);
  return {
    dossier,
    bipEmergencyId: dossier.id,
    bipSolutionBadge: dossier.bipReference,
    bipSolutions: [subDossierToSolutionSlide(dossier)],
    cosaDire: dossier.pressDeclaration,
  };
}

export function provvedimentoFromSubDossier(d: BipSubDossier): {
  enteCompetente: string;
  tempiAttuazione: string;
  attoConcreto: string;
} {
  return {
    enteCompetente: d.enteCompetente,
    tempiAttuazione: d.tempiAttuazione,
    attoConcreto: d.provvedimentoAtto,
  };
}
