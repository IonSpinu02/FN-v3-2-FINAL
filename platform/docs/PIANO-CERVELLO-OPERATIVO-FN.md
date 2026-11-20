# Futuro Nazionale — piano per un cervello operativo

Documento di revisione. Non è codice e non è ancora stato attuato. Data: 3 novembre 2026.

Lo staff deve aprire la piattaforma e uscire con un ordine: dove andare, cosa dire, come dirlo, e come si muove il consenso se accade un fatto o se quella frase viene detta. Il codice ha già i pezzi. Sono tre prodotti affiancati, e diverse cifre sembrano misure senza esserlo.

## Cosa chiedere a chi legge

Approvare o respingere questo piano, non inventarne un altro. Giudicare tre cose:

1. La linea è una sola, dallo schermo di apertura al diario.
2. Nessuna fase aggiunge una formula nuova o fa produrre punti percentuali a un modello linguistico.
3. Ogni cifra in schermo dice se è misura, stima o bozza, prima di guidare una dichiarazione pubblica.

Se una fase va cambiata, indicarla per numero e dire cosa manca. Se il piano è approvato, si attua nell’ordine scritto.

## 1. Cosa c’è, e perché non basta

Tre schede stanno allo stesso livello, nel file `DashboardClient.tsx`: Scenario, Osservatorio, Locali. Lo staff deve capire da solo in che ordine usarle.

- **Scenario.** Voti, circoscrizioni e una leva di programma sulla regione sotto il mouse. La leva esce da `buildRegionalCampaignSummary`: il tema con il guadagno più alto, calcolato su tabelle di permeabilità e su un’intensità fissa a 82. È una stima di conversione, non un voto atteso.
- **Osservatorio.** È l’unico posto che dice dove parlare, con chi, quale frase e quale atto (`OsservatorioIssueAnalyzePanel.tsx`). La frase è `messaggioStampa` del catalogo di programma: una bozza stabile, non una lettura della notizia di oggi. `simulateSelectedIssuesGain` somma un altro guadagno in punti se si simula la scheda. È una seconda stima, non collegata alla curva nazionale.
- **Previsione.** In `growthTrajectory.ts`: pendenza dei sondaggi smorzata, notizie che si dimezzano circa ogni mese, calendario. Lo shock della timeline sposta tutta la curva di una quantità già scritta nel codice. Non simula il testo di una dichiarazione. `growthNarration.ts` vieta al testo di citare cifre che non sono nel pacchetto dati: questo vincolo va tenuto.

Il pulsante «Registra intervento» esiste nel dossier e non torna nel consenso successivo. La linea si interrompe lì.

## 2. Dove un numero mente

Finché questi punti restano, la piattaforma non può presentarsi come cervello affidabile.

- Il segno delle notizie, in `growthEvidence.ts`, è un conteggio di parole nel titolo (calo, cresce, indagato). Non è un giudizio sul pezzo. Va chiamato «segno dalle parole del titolo».
- La banda intorno alla previsione è la base del lasso più il 10 percento del movimento. Non è l’errore statistico delle rilevazioni. Se resta in interfaccia, si chiama «ampiezza di modello».
- Gli eventi possibili della timeline sono testi fissi da novembre 2026 a maggio 2027. Solo la manovra di bilancio ha una fonte normativa. Gli altri mesi sono ipotesi di modello.
- In `googleTrendsIntelligence.ts` molte crescite di ricerca sono scritte in un catalogo e poi spostate con una funzione pseudocasuale (`rand01`). Non sono una misura Google del giorno. Non possono stare accanto a una frase da dire in pubblico.

**Regola di tutto il lavoro.** Non si aggiunge un modello nuovo. Non si chiede a un modello linguistico di produrre punti percentuali. Si riusano i motori già scritti e si dice che tipo di numero sono.

## 3. La linea

Ogni apertura parte da un brief. Il resto della piattaforma è il dettaglio di una riga del brief, non una seconda home.

1. **Misurato.** Consenso di oggi, fonte, data, variazione rispetto alla rilevazione precedente. Esempio: serie Supermedia.
2. **Stima — dove.** Una regione e un luogo. Motivo: voti del partito, bacino convertibile, problema territoriale. I punti della leva portano l’etichetta Stima.
3. **Bozza — cosa dire.** Una frase legata a un capitolo del programma, più l’atto e l’interlocutore. Non è una previsione e non sposta il numero.
4. **Stima — se succede.** La traiettoria ordinaria e lo spostamento se si attiva lo shock già definito nel codice, con il tetto visibile.

Dal brief si aprono, in quest’ordine, la mappa sulla regione scelta, il dossier dello stesso tema, la curva con quello shock. Il diario registra l’intervento. La rilevazione successiva si affianca, con la scritta «controllo, non prova».

Tre etichette, sempre accanto alla cifra:

- **Misurato.** Fonte, data, indirizzo. Esempio: consenso Supermedia.
- **Stima.** Formula del codice, con il tetto scritto. Esempio: punti della leva, delta dello shock, ampiezza di modello.
- **Bozza.** Testo per lo staff. Non sposta il consenso.

## 4. Fasi di attuazione

Ogni fase si chiude solo se lo staff, senza spiegazioni, capisce la riga e la sua etichetta. Controllo dei tipi a ogni fase. Nessuna fase introduce una formula nuova.

### Fase 1 — Verità in schermo

Si marca ogni cifra visibile. I blocchi che usano `rand01`, o una crescita scritta nel catalogo, escono dal primo piano oppure portano la scritta «scheda, non misura». Il punteggio notizie, se resta, si chiama «segno dalle parole del titolo». La banda, se resta, si chiama «ampiezza di modello».

File: `googleTrendsIntelligence.ts`, i pannelli Osservatorio che mostrano la crescita, `GrowthForecastReport.tsx`, `growthEvidence.ts`.

Chiusura: chi legge «+128%» sa se è una ricerca misurata o una scheda.

### Fase 2 — Un solo ordine del giorno

Una funzione pura, `buildDailyOrder`, in un file nuovo sotto `src/lib/engine/`. Non calcola. Chiama ciò che esiste: ultimo consenso e delta; `buildRegionalCampaignSummary` sulla regione dell'ordine (a freddo quella con `maxCumulativeNewVotes` più alto, non quella con più voti assoluti; al click, la regione scelta; il mouse non cambia l'ordine); frase, luogo, interlocutori e atto dal catalogo di programma, gli stessi campi del pannello Osservatorio; `projectMonths` per la traiettoria ordinaria e lo shock di quel mese, se c’è.

Il brief è una barra orizzontale di quattro celle dentro lo Scenario a schermo intero, non un blocco verticale che spinge fuori il ticker. Quattro celle: misurato, dove, frase, se succede.

Chiusura: all’apertura si legge un solo ordine, senza entrare in Osservatorio, e non è sempre la Lombardia. Un click aggiorna l'ordine. Il mouse no.

### Fase 3 — Un solo percorso

Dal brief, tre azioni. «Apri sulla mappa» seleziona la regione dell’ordine. «Apri il dossier» apre l’Osservatorio sulla stessa regione e sullo stesso tema. «Vedi la curva» apre il report con i mesi e lo shock già impostati. Il dossier riceve regione e tema: oggi parte sempre dalla Lombardia e non legge l'indirizzo. Il radar a destra si intitola come esplorazione sotto il cursore, non come un secondo ordine.

Le altre classifiche (prime cinque regioni, circoscrizioni, radar) restano sotto, come dettaglio. Non propongono un secondo «dove andare». Se un numero del dettaglio contraddice il brief, vince il brief.

Chiusura: dal brief si arriva al dossier e alla curva senza scegliere un’altra regione a mano.

### Fase 4 — Dichiarazioni ed eventi, con una regola

Due casi, tenuti separati.

- **Fatto già uscito.** Titolo, indirizzo, data. Entra nella curva solo attraverso il decadimento delle notizie già scritto. Etichetta: «segno dalle parole del titolo», finché non c’è una lettura umana.
- **Fatto possibile o frase da dire.** Resta bozza o ipotesi. I pulsanti della timeline spostano la curva della quantità già nel codice, etichetta Stima, tetto visibile. La frase del catalogo non aggiunge punti. Una regola nuova si scrive solo con un tetto in punti, un decadimento, una fonte nel codice e un test che quel tetto non si supera. Fino ad allora a schermo c’è la frase: «questa dichiarazione non sposta il numero».

Chiusura: non esiste un punto percentuale nato da una frase senza una funzione e un test.

### Fase 5 — Il diario chiude il giro

«Registra intervento» salva regione, tema, frase e data, più il consenso in quel momento. Il confronto si mostra solo entro i 14 giorni già previsti. Alla rilevazione successiva il brief mostra, accanto all’ordine vecchio, il consenso nuovo e la data. Testo fisso: «controllo, non prova». Nessuna freccia causale. Se le date non si sovrappongono, il confronto non si mostra.

Chiusura: un intervento registrato ricompare vicino al numero successivo solo dentro la finestra, senza attribuirgli il merito del movimento.

## 5. Cosa non si fa

- Non si aggiunge una quarta scheda.
- Non si fa generare un discorso libero da un modello linguistico senza il capitolo di programma e senza etichetta Bozza.
- Non si ricalcola la permeabilità regionale in questa linea. Si etichetta la stima che c’è già.
- Non si rimette l’area intorno alla curva come se fosse un intervallo di sondaggio.

## 6. Esito della revisione

Approvato, con i tre vincoli delle fasi 2, 3 e 5 già scritti sopra. Si attua in quest'ordine. Il vincolo da difendere resta questo: lo staff riceve un ordine professionale, e ogni numero che lo sostiene è o misurato, o stimato entro un tetto, o una bozza che non finge di essere un voto.
