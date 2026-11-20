# Previsione di crescita — funzionamento e UI

Documento sul blocco **02 // PREVISIONE DI CRESCITA** dello Scenario. Il codice sorgente è in `docs/PREVISIONE-CRESCITA-CODICE.md`. Qui si descrive cosa fa il motore e cosa vede chi usa la piattaforma.

## Dove sta

Nello Scenario, colonna sinistra, sotto il consenso nazionale.

Due livelli:

1. **Preview** nella colonna. Numero indicativo, tre lassi, un pulsante.
2. **Report tecnico** sopra la mappa dell’Italia, aperto da **Analizza previsione**.

Il punto di partenza è il consenso **S** dello scenario. Se **S live** è attivo, S si aggiorna da solo e la previsione riparte da quel valore.

## Preview (colonna sinistra)

Mostra:

- badge di traiettoria (in calo, stabile, crescita moderata, in espansione) e la scritta **preview**
- consenso di oggi → consenso al lasso scelto
- nuovi voti stimati e totale
- delta in punti

Tre pulsanti cambiano solo la preview:

| Pulsante | Mesi nel motore |
| --- | --- |
| 30 giorni | 1 |
| 90 giorni | 3 |
| 180 giorni | 6 |

Colori del delta:

- sopra +0,05 punti: verde
- sotto −0,05 punti: rosa
- in mezzo: ambra

Se è selezionata una regione, i voti della preview sono quelli di quella regione (`voti_di_scenario` della riga), non il totale Italia. Il consenso di partenza resta nazionale.

**Analizza previsione** apre il report già sul lasso della preview.

## Report sulla mappa

Si apre al centro, sopra la mappa, senza coprire le due colonne. Si chiude con **Chiudi** o Esc.

A sinistra:

- slider dei mesi, da 1 fino almeno a 6 (e fino a maggio 2027 se quel traguardo è più lontano)
- preset **30 giorni**, **90 giorni**, **180 giorni**, **Maggio 2027**
- se maggio 2027 cade proprio a 6 mesi, i due preset coincidono e resta un solo bottone: **180 gg · Maggio 2027**
- sensibilità **Base organica** (0,7×), **Spinta territori** (1×), **Massima espansione** (1,3×)

A destra, per il mese selezionato:

- da dove si parte e dove si arriva
- delta e banda
- quattro addendi: pendenza, notizie, B.I.P., stagione/calendario/astensione
- i mesi di calendario entrati in quel lasso, con link se c’è una fonte, altrimenti la dicitura «ipotesi di modello»
- il **perché**, riscritto su quel lasso (non è un testo fisso)
- la sezione **Fonti**
- il registro di affinamento: ogni ricalcolo del consenso aggiunge una riga con orario, S, pendenza e risultato

## Come si calcola

Non è la pendenza di oggi moltiplicata per i mesi. È una simulazione mese per mese, dal mese corrente fino all’orizzonte.

Ogni mese somma:

1. **Pendenza del consenso.** Differenza tra l’ultimo punto della serie Supermedia e un punto di almeno 45 giorni prima, in punti al mese. Ogni mese se ne applica una quota, poi il residuo si riduce. Un orizzonte lungo non prolunga all’infinito il calo o la crescita di oggi.
2. **Notizie.** Titoli degli ultimi tempi su Futuro Nazionale e Vannacci. Un titolo entra solo se ha almeno 22 caratteri e 4 parole. Nomi di social e etichette corte (`Instagram`, `Facebook`, `Home`, …) sono scartati. Il punteggio è positivo, negativo o misto. L’impulso è forte nel primo mese e si dimezza circa ogni 30 giorni. Tetto: ±0,30 punti entro 3 mesi, ±0,45 oltre.
3. **B.I.P.** Se un titolo valido tocca una misura di programma, un piccolo contributo (tetto 0,20 punti). Senza notizie valide il contributo è zero.
4. **Stagione, calendario, astensione.** Solo i mesi che cadono dentro il lasso. Novembre 2026 è la manovra di bilancio (legge di contabilità 196/2009). Dicembre è la pausa festiva. Da gennaio al maggio 2027 entrano bollette, costo della vita, poi la mobilitazione dall’astensione. I pesi di questi mesi, tranne la manovra, sono ipotesi di modello.
5. **Zoccolo duro.** Sotto il 6% i colpi negativi pesano il 55%. Tra 6% e 6,8% pesano l’80%. Sopra il 9% anche i rialzi sono ridotti.

Il delta è la somma dei quattro addendi, moltiplicata per la sensibilità. La banda si allarga con i mesi.

I numeri sono arrotondati a due decimali. La preview e il report usano la stessa funzione (`projectMonths`), quindi il 30 / 90 / 180 della colonna coincide con lo stesso lasso nel report.

## Perché il testo cambia con il lasso

`explainProjection` legge la proiezione del mese selezionato, non un paragrafo unico scritto una volta per tutte.

Cambiano, insieme al numero:

- quanta pendenza è ancora viva
- quanto dello shock di notizia è decaduto
- quali mesi di calendario sono dentro (un mese solo non include la primavera; sei mesi sì)
- l’ampiezza della banda

Il testo è in sei blocchi: esito, pendenza, notizie, B.I.P., calendario, zoccolo.

## Fonti

| Pezzo | Fonte |
| --- | --- |
| Pendenza | [Supermedia YouTrend/AGI](https://www.youtrend.it/la-supermedia/) e [archivio sondaggi](https://supermedia.youtrend.it/sondaggi/) |
| Notizie | URL dell’articolo, se Tavily ne ha restituito uno valido |
| Manovra di novembre | [Legge 31 dicembre 2009, n. 196](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2009-12-31;196) |
| Stagione, pausa di dicembre, bollette, astensione | Ipotesi di modello, senza fonte esterna. Sono etichettate così nel report |

## Aggiornamento

- Il consenso live ricalcola S. La preview usa subito il nuovo S.
- La chiamata a `GET /api/forecast/growth` (notizie Tavily + eventuale paragrafo AI) parte 350 ms dopo l’ultimo cambio di S o di sensibilità, per non sparare una richiesta a ogni scatto dello slider.
- I titoli Tavily restano in memoria 15 minuti.
- Se c’è `AI_GATEWAY_API_KEY`, il modello può riscrivere un paragrafo, ma non cambia le percentuali e può citare solo le fonti già nel pacchetto. Nel report il testo visibile è quello ricalcolato sul lasso, così segue lo slider.

## File

| Ruolo | Percorso |
| --- | --- |
| Simulazione mese per mese e testo del perché | `src/lib/engine/growthTrajectory.ts` |
| Filtro notizie, punteggio, elenco fonti | `src/lib/engine/growthEvidence.ts` |
| Narrativa AI opzionale | `src/lib/engine/growthNarration.ts` |
| API | `src/app/api/forecast/growth/route.ts` |
| Preview e pulsanti 30/90/180 | `src/components/ScenarioGrowthForecastPanel.tsx` |
| Report sulla mappa | `src/components/GrowthForecastReport.tsx` |
| Collegamento allo scenario (voti, badge, ventaglio interno) | `src/lib/engine/partyGrowthForecast.ts` |
