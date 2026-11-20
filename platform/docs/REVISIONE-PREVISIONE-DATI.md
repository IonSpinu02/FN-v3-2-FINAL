# Revisione della previsione nazionale — 9 novembre 2026

## Obiettivo e distinzione

La vista iniziale stima il consenso dai dati osservati. Lo scenario offensiva resta una vista separata, condizionata alle ipotesi del motore V4. Non viene presentato come l'esito più probabile. Il nuovo percorso non produce raccomandazioni di campagna.

## Riscontri sul codice precedente

1. Il motore V4 somma al livello iniziale contributi di agenda, bacini, rete, presenze istituzionali e calendario. Molti coefficienti sono ipotesi fisse o trasferimenti di risultati generali, non coefficienti stimati e verificati sulla serie nazionale FN. Una crescita regolare è una conseguenza delle formule, non una prova di capacità predittiva.
2. Il calendario distribuisce contributi mensili. Non contiene un modello empiricamente identificato di shock giornalieri da singoli eventi. Rendere il grafico ondulato avrebbe inventato informazione.
3. Il filtro temporale dei sondaggi verificava la fine del fieldwork senza verificare sempre la pubblicazione. Ciò poteva includere nelle ricostruzioni storiche dati non ancora conoscibili.
4. Array di osservazioni esplicitamente vuoti potevano attivare il ripiego sui dati statici. Questo rendeva ambiguo il significato di "nessun dato disponibile" nei backtest.
5. Le finestre di verifica si sovrappongono. Il numero totale di errori non coincide con il numero di confronti non sovrapposti. La scarsità della storia limita soprattutto le verifiche a 90 e 180 giorni.

## Percorso statistico implementato

`src/lib/engine/nationalConsensusForecast.ts`:

- Esclude date future, valori non finiti e sondaggi non ancora pubblicati alla data di riferimento.
- Parte dall'aggregato dei sondaggi disponibili; ripiega sull'ultima osservazione della serie. Un valore manuale serve solo in assenza di osservazioni e viene indicato come input senza dati.
- Ricostruisce aggregati alle date di pubblicazione. Quando ci sono almeno quattro date e almeno quattordici giorni di storia, usa questa serie. In caso contrario usa la serie storica ricevuta. Non somma sondaggi aggregati e Supermedia come se fossero osservazioni indipendenti.
- Esclude il punto odierno sintetico, quando coincide con l'input e non è dichiarato come osservazione.
- Confronta consenso invariato e regressione locale pesata per freschezza, con tendenza smorzata. La regressione usa gli ultimi sessanta giorni e pesi esponenziali a trenta giorni; smorzamento e limite della proiezione riutilizzano la primitiva `dampedSlopePp`.
- Le scelte sopra sono parametri iniziali dichiarati, non un modello già dimostrato ottimale.
- La tendenza deve migliorare l'errore assoluto medio del riferimento invariato di almeno il 5%, su almeno quattro confronti non sovrapposti. Questa soglia è una regola prudenziale, non un test di significatività.
- Per ogni origine della verifica progressiva, seleziona il metodo esclusivamente dagli errori i cui target erano già osservati a quell'origine. Il target successivo non entra nella scelta.
- I confronti hanno target a 14–50 giorni. La vista riporta il massimo orizzonte realmente verificato; le proiezioni più lunghe sono extrapolazioni.
- La storia vecchia smorza ulteriormente la proiezione, anziché sostenere indefinitamente una tendenza.

## Incertezza e limiti

L'intervallo è indicativo: usa la radice dell'errore quadratico medio delle previsioni progressive, un minimo prudenziale di 0,35 pp e una crescita della dispersione con la radice del tempo rispetto all'orizzonte medio verificato. Con pochi errori è usato un ripiego di 0,5 pp. Il livello nominale 80% non è una copertura dimostrata fuori campione.

Gli aggregati successivi possono riutilizzare gli stessi sondaggi. I target sovrapposti restano visibili nelle metriche diagnostiche, ma la selezione richiede confronti non sovrapposti. Anche questi non garantiscono indipendenza statistica.

Il nuovo percorso non aggiunge guadagni automatici da rete, calendario, programma, notizie o sforzo. Non anticipa eventi futuri non osservati. Una futura integrazione di shock richiederebbe archivio datato degli eventi, effetti stimati senza dati futuri e una verifica contro gli stessi riferimenti semplici. Nessuna oscillazione casuale o decorativa viene aggiunta alla linea centrale.

La presenza di riferimenti scientifici nei commenti del vecchio V4 non dimostra la validità dei suoi coefficienti specifici. Questa revisione non certifica i dati sorgente, né dimostra un miglioramento dell'accuratezza rispetto a tutti i modelli alternativi.

## Correzioni condivise

- `fnNationalAggregate.ts`: include solo rilevazioni pubblicate entro la data di riferimento.
- `forecastEngineV4.ts`: applica lo stesso vincolo e distingue input assente da array esplicitamente vuoto.
- Widget e report: previsione dai dati come impostazione iniziale; offensiva separata. I fattori e le serie del grafico seguono il percorso selezionato. Soglia di freno 6,8% e controlli dello scenario non entrano nella vista statistica.

## Verifica

I test coprono esclusione di pubblicazioni future, rispetto degli array vuoti, assenza di crescita da leve dello scenario, stabilità delle previsioni storiche al mutare del futuro, limiti percentuali, dati scarsi, sovrapposizione dei target e punti sintetici. Le metriche mostrate in app dipendono dal corpus effettivamente disponibile al momento della consultazione.

## Riferimenti metodologici

- [Hyndman e Athanasopoulos: tendenze smorzate](https://otexts.com/fpp3/holt.html)
- [Valutazione con origini previsionali successive](https://otexts.com/fpp3/tscv.html)

Sono riferimenti per il disegno della verifica e lo smorzamento; non una validazione dei parametri o dei risultati di questa implementazione.


## Aggiornamento: eventi verificati e ricalcolo periodico

La pagina ricarica gli input ogni 15 minuti quando è visibile e al ritorno nella finestra; il pulsante di aggiornamento richiama ora anche i dati della previsione. Errori di rete conservano gli ultimi dati e mostrano un avviso. Le cache delle singole fonti restano attive: non viene promesso un nuovo sondaggio a ogni controllo. Non è stato installato un servizio in background: a pagina chiusa il ricalcolo avviene alla successiva apertura.

Il catalogo `data/national_forecast_events.json` distingue eventi programmati, avvenuti, plausibili e annullati, con data, prima conoscenza e fonte. Il calendario ufficiale BCE aggiorna automaticamente le date future (cache giornaliera), con ripiego dichiarato sul catalogo locale. Il loader non presume che una riunione programmata sia effettivamente avvenuta e non inventa il suo esito. Per apprendere effetti servono eventi storici avvenuti e verificati nell'archivio; il calendario futuro, da solo, non li fornisce.

`nationalForecastEvents.ts` raccoglie finestre pre/post già completate (punto pre entro 14 giorni, punto post tra 7 e 21 giorni, attesa di almeno 21 giorni), sottrae la previsione di base disponibile all'origine e scarta gli eventi concomitanti entro 28 giorni. Si tratta di associazioni residuali, non di identificazione causale.

Per ogni categoria, la stima è regolarizzata verso zero con quattro pseudo-osservazioni nulle. Una verifica cronologica usa almeno quattro eventi precedenti completamente osservati per prevedere ogni evento successivo. L'effetto entra nella traiettoria solo dopo almeno tre verifiche successive e una riduzione dell'errore assoluto medio di almeno il 5% rispetto a nessun effetto aggiuntivo. L'ampiezza può essere positiva o negativa. La forma temporale dichiarata cresce con costante di sette giorni e si riassorbe con costante di trenta giorni: non è a sua volta una dinamica già validata sui dati FN.

Gli eventi plausibili o annullati non entrano automaticamente nella stima centrale. Gli eventi programmati già trascorsi restano da verificare e non vengono trasformati automaticamente in eventi avvenuti. La sottrazione della risposta alla data corrente evita di aggiungere integralmente effetti già assorbiti dal punto iniziale.

Le metriche della componente dati restano separate dalle verifiche per categoria evento. Questa implementazione non dimostra una capacità di prevedere shock politici, né una precisione superiore al riferimento invariato. Con il catalogo iniziale di sole date future, nessun impatto degli eventi è ancora stimabile: la piattaforma lo mostra esplicitamente.

Fonte delle date iniziali: [calendario ufficiale BCE](https://www.ecb.europa.eu/press/calendars/mgcgc/html/index.en.html), verificato il 9 novembre 2026. Nessun rialzo/ribasso dei tassi o del consenso è assunto dal semplice calendario.


## News e simulazioni esplorative

`nationalNewsSignals.ts` analizza metadati, titoli e brevi estratti delle notizie già acquisite dal provider della piattaforma. La ricerca copre sia FN/sondaggi sia il calendario istituzionale ed economico. Il gate giornaliero del provider è conservato; la vista riporta stato di scansione e data di acquisizione, senza fingere un aggiornamento continuo delle notizie.

Il lettore elimina duplicati e tracking URL, scarta URL non HTTP(S) e pubblicazioni future, conserva come sconosciuta la data mancante e classifica per ambito con regole lessicali dichiarate nel codice. Non è una lettura integrale degli articoli né un modello linguistico capace di verificarne le affermazioni. Una citazione di FN è informazione descrittiva, non prova di rilevanza causale.

Le date future sono estratte soltanto quando il testo presenta un'indicazione di evento e una data completa di anno. Date impossibili o anni mancanti non vengono completati automaticamente. La data rimane una dichiarazione nella notizia da verificare; i collegamenti con il catalogo sono tematici e non confermano che si tratti dello stesso evento. Le news estratte non diventano automaticamente eventi verificati per l'apprendimento.

Il simulatore `ForecastNewsSimulation.tsx` permette di selezionare una notizia o un evento e variare data, ampiezza ipotizzata in pp, sviluppo e riassorbimento. Sovrappone alla medesima previsione centrale uno shock positivo e uno negativo. Il valore iniziale ±0,25 pp è un parametro esplorativo scelto per rendere visibile la sensibilità, non una stima dal titolo, una probabilità o un coefficiente appreso.

La risposta per un'età positiva t dall'evento è proporzionale a `(1-exp(-t/rise))*exp(-t/decay)`, normalizzata al suo massimo, che cade a `rise*log(1+decay/rise)`. L'ampiezza immessa è quindi il picco aggiuntivo; alla fine dell'orizzonte lo shock può essere attenuato. Prima dell'evento la risposta è esattamente zero. Tutte le quote sono limitate tra 0 e 100. I valori finali e il confronto con la stima centrale sono riportati separatamente.

I tre tracciati sono esperimenti di sensibilità non calibrati, non fasce di confidenza o scenari probabilistici. Non modificano la previsione centrale, non vengono registrati come dati osservati e non addestrano il modello. La funzione non deduce il segno dell'effetto dal tono del titolo e non suggerisce azioni, territori o messaggi per massimizzare il consenso.

Per passare da questa esplorazione a previsioni dell'impatto specifico delle notizie restano necessari un archivio verificato, etichette di eventi datate, risultati successivi e validazione cronologica su dati sufficienti. I dati attuali non dimostrano ancora tale capacità.
