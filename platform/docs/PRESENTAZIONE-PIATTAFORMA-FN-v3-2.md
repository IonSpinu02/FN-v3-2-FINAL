<div class="cover">
<p class="cover-kicker">Futuro Nazionale · Piattaforma v3.2</p>
<h1>Presentazione della piattaforma</h1>
<p class="cover-sub">Mappa elettorale, intelligence territoriale e programma B.I.P. — ogni dato con <strong>fonte</strong> e <strong>motivo di affidabilità</strong> · Ottobre 2026</p>
<p class="cover-meta"><strong>Legenda usata nel documento:</strong><br>
<span class="cover-badge">CERTA · dato ufficiale pubblico, verificabile da chiunque (elezioni, ISTAT, AGENAS dove indicato)</span><br>
<span class="cover-badge">ALTA · fonte istituzionale o documento di partito approvato; non ridondante al voto FN simulato</span><br>
<span class="cover-badge">MEDIA · aggregatori, cronaca, segnali online — utili, da confermare prima del live TV</span><br>
<span class="cover-badge">STIMATA · modello interno esplicito (scenario, conversione, poll simulato) — scenario, non promessa elettorale</span></p>
</div>

# Indice

1. A cosa serve  
2. Le tre aree della piattaforma  
3. Scenario — cosa vedi, fonti, perché è affidabile  
4. Osservatorio — problemi, B.I.P., Trends, fonti  
5. Locali e organizzazione  
6. Legenda dei quattro gradi  
7. Atlante: ogni numero in Scenario  
8. Atlante: Osservatorio, fabbisogni, conversione  
9. Dataset di base e parametri ufficiali  
10. Flussi elettorali Ipsos e Sky TG24  
11. Google Trends, notizie, Camera, B.I.P.  
12. Bibliografia e link  
13. Cosa si può dire in pubblico (sì / no)  
14. Giornata tipo e limiti d’uso  

---

## 1. A cosa serve

La piattaforma **Futuro Nazionale v3.2** aiuta a decidere **dove** andare, **su quale tema** parlare e **con quale misura di programma** rispondere — con numeri **tracciabili**.

Non sostituisce il giudizio del leader né un sondaggio certificato. Ogni cifra rientra in una di quattro famiglie (certa, alta, media, stimata): così in riunione e in televisione si sa **cosa difendere** e **cosa presentare come ipotesi**.

---

## 2. Le tre aree della piattaforma

| Area | Domanda | Output | Affidabilità complessiva |
|------|---------|--------|-------------------------|
| **Scenario** | Quanto siamo forti per regione dato il consenso S? | Mappa, voti, benchmark, incertezza | **Mix:** base elettorale CERTA + output STIMATA |
| **Osservatorio** | Su cosa intervenire e cosa dire (B.I.P.)? | Problemi, Analizza, Trends | **Mix:** ISTAT/AGENAS CERTA + cronaca MEDIA + conversione STIMATA |
| **Locali** | Chi rappresenta il movimento? | Registro cariche, effetto scenario | **ALTA** su conteggi · **STIMATA** su effetto elettorale |

**Regola d’oro:** lo **stress territoriale** (bisogni certificati) **non** equivale automaticamente a «voteranno FN». Due moduli distinti, due discorsi distinti in pubblico.

---

## 3. Scenario — cosa vedi, fonti, perché è affidabile

| In interfaccia | Cosa significa | Fonte | Perché è affidabile (o no) |
|----------------|----------------|-------|----------------------------|
| **S nazionale %** | Consenso FN che si assume | Valore scelto dall’operatore; default **7,20%** | **MEDIA** — default da **Supermedia YouTrend/AGI** (media di sondaggi pubblicati), non un’unica rilevazione certificata sul FN in questo istante. Sostituibile con il valore della segreteria: da lì tutta la mappa è coerente con **vostra** premessa |
| **Stima % regione** | Quota FN coerente con S | Modello v3.2: mix territoriale ÷ bacino centrodestra 2024 | **STIMATA** — dipende da S, pesi e flussi; utile per pianificare, **non** è un poll regionale |
| **Voti scenario** | Voti FN stimati | Stima % × **validi regionali** | Validi **CERTI** (Europee 2024) · moltiplicatore **STIMATA** |
| **Benchmark %** | Riferimento FdI+Lega 2024 | Stesse Europee 2024 | **CERTA** sul dato storico ufficiale |
| **Scarto vs benchmark** | Differenza scenario − benchmark | Derivato | **STIMATA** — coerente con le premesse del modello |
| **Entropia H** | Concentrazione vs dispersione territoriale | Indice calcolato sulla distribuzione regionale | **STIMATA** — descrittivo del modello, non dato ISTAT |
| **lo10 / hi90** | Fascia di incertezza | ~**20.000** simulazioni Monte Carlo su pesi e S | **STIMATA** — misura incertezza **parametrica**, non errore campionario di inchiesta |
| **Poll regionale simulato** | Centro stima «come un sondaggio» | Trasformazione statistica dello scenario | **STIMATA** — **non** usarlo in TV come «abbiamo un sondaggio in Lombardia» |
| **Margine errore / IC 95%** | Incertezza attorno al poll simulato | Campione virtuale + dispersione Monte Carlo | **STIMATA** — coerente con § sopra |
| **Prob. sopra soglia 3%** | Probabilità di superare lo sbarramento | Simulazione statistica | **STIMATA** — riferimento operativo, non pronostico |
| **Target crescita Mag ’27** | Scenario lavoro campagna | S + incremento in punti (regime + matrice flussi) | **STIMATA** — obiettivo interno, non previsione certificata |

<div class="source-box">
<p><strong>Perché fidarsi del processo Scenario:</strong> le **quote e i validi 2024** sono verificabili sul sito del Ministero dell’Interno; le **regole** del mix (35% flussi, 25% preferenze, 25% iscritti, 15% istituzioni) sono fisse e modificabili solo consapevolmente; ogni ricalcolo è **ripetibile**. Ciò che **non** è certo è l’esito futuro: per quello servono etichetta **STIMATA** e Monte Carlo.</p>
</div>

---

## 4. Osservatorio — problemi, B.I.P., Trends, fonti

### Radar problemi e vista Italia

| Elemento | Fonte | Perché è affidabile (o no) |
|----------|-------|----------------------------|
| **Titolo e sintesi «Live»** | RSS **Google News** e fonti configurate, filtri sport/off-topic | **MEDIA** — evidenza di **attenzione** e link alla fonte; verifica umana consigliata prima di citare un fatto come accertato |
| **Scheda «Certificata» / catalogo** | Temi per regione + **Modulo B** | **ALTA** sul dato strutturale · **STIMATA** sul punteggio priorità elettorale |
| **Vista «Italia»** | Merge notizie live dalle 20 regioni, deduplicate | **MEDIA** come cronaca · ranking **STIMATA** per potenziale seggi |
| **Dato ufficiale in scheda** | Testi **AGENAS**, **ISTAT BesT**, **OpenCivitas** per categoria/regione | **CERTA** quando cita statistiche ufficiali **alla data di pubblicazione** (non previsione voto) |
| **Priorità 0–100** | Stress fabbisogni e/o impatto notizia | **STIMATA** — ordine di lavoro per staff |

### Programma B.I.P. e «Analizza»

| Elemento | Fonte | Perché è affidabile (o no) |
|----------|-------|----------------------------|
| **Capitolo, pagina, messaggio stampa, provvedimento** | Documento programmatico **B.I.P. 2027–2037** (FN) | **ALTA** — fedeltà al programma **approvato dal movimento**; non è dato ISTAT |
| **Abbinamento notizia → sotto-dossier** | Analisi titolo e sintesi su macro-tema (es. sicurezza: legittima difesa vs carceri vs spaccio…) | **ALTA** operativa — evita risposte generiche; richiede lettura umana del titolo in casi ambigui |
| **+pp / +voti su tema** | Storico partiti regionali (Europee 2024) + permeabilità + elasticità tema + intensità problema | **STIMATA** — ordine di grandezza **interno**, limiti min/max per singolo tema; **non** impegno di risultato |
| **Ripartizione 45% / 30% / 25%** (astenuti / Lega / CDX) nel modal | Schema illustrativo | **STIMATA** — **non** microdato elettorale osservato |
| **Simulazione fino a 3 temi** | Somma con fattore saturazione | **STIMATA** — evita doppi conteggi ottimistici |

**Elasticità per tema (conversione):** Sicurezza 1,08 · Lavoro 1,05 · Sanità 1,00 · Trasporti 0,98 · Caro-vita 1,02 · Territorio 0,95.

### Google Trends

| Elemento | Fonte | Perché è affidabile (o no) |
|----------|-------|----------------------------|
| **Query per regione** | Catalogo curato (es. Trenord in Lombardia, Cardarelli in Campania…) | **ALTA** come scelta editoriale allineata al territorio |
| **Indice 0–100** | **Google Trends** (import CSV o feed live) | **MEDIA** — misura **attenzione relativa**, non percentuale elettorale né volumi assoluti |
| **Picco «ULTIM’ORA»** | Merge RSS Trends geo Italia / regione | **MEDIA** — segnale reale di picco ricerche, da incrociare con agenda politica |

### Rassegna stampa e defezioni

| Elemento | Fonte | Perché è affidabile (o no) |
|----------|-------|----------------------------|
| **Gruppo parlamentare, mandato** | Open data **Camera dei Deputati** (SPARQL / dati.camera.it) | **CERTA / ALTA** sullo stato anagrafico al momento della query |
| **Voci di stampa** | RSS e catalogo verificato | **MEDIA** — fino a conferma ufficiale |
| **Beneficio simulato ingresso FN** | Regole elettorali interne | **STIMATA** |

---

## 5. Locali e organizzazione

| Elemento | Fonte | Perché è affidabile (o no) |
|----------|-------|----------------------------|
| **Registro comuni e cariche** | Inserimento operatori + anagrafe FN | **ALTA** operativa — tracciabile, verificabile regione per regione |
| **Iscritti per regione** | Anagrafe partito (configurazione aggiornabile) | **ALTA** come dato **dichiarato dal partito** · **non** certificazione indipendente |
| **Preferenze / seggi** | Osservate (Lombardia, Sardegna) o stimate da Lega 2024 | **ALTA** dove osservate · **STIMATA** dove ripartite |
| **Effetto cariche sullo scenario** | Punteggio pesato (deputato, CR, sindaco, consigliere…) | **STIMATA** sull’impatto quota — **ALTA** sul conteggio cariche |

---

## 6. Legenda dei quattro gradi

| Grado | Quando usarlo | Esempi in piattaforma |
|-------|---------------|------------------------|
| **CERTA** | Ente pubblico, risultato elettorale ufficiale, statistica ISTAT/AGENAS citata in scheda | Validi EU 2024, quote FdI/Lega 2024, indicatori BesT/AGENAS in Modulo B |
| **ALTA** | Fonte istituzionale credibile o documento FN; verificabile ma non «legge elettorale» | B.I.P., open data Camera, flussi Ipsos/Sky **come pubblicati**, iscritti FN |
| **MEDIA** | Segnale utile, non certificate come sondaggio | Supermedia per S default, titoli Google News, Google Trends, Supermedia |
| **STIMATA** | Modello esplicitamente simulativo | Voti scenario, +pp promessa, poll regionale simulato, Monte Carlo, crescita Mag ’27 |

---

## 7. Atlante: ogni numero in Scenario (modulo elettorale A)

Il motore parte dai **validi Europee 2024** per regione, ricostruisce elettori e astenuti con **affluenze 2024** in configurazione, calcola quattro indici e applica il consenso **S**.

| Indice | Cosa misura | Fonti principali | Affidabilità |
|--------|-------------|------------------|--------------|
| **Flussi** | Provenienza potenziale voti (FdI, Lega, astenuti…) | Profilo regionale 2024 + matrice **Ipsos** o **Sky** (§10) | Base **CERTA** · mix **STIMATA** |
| **Preferenze** | Forza organizzativa circoscrizioni | **532.368** preferenze totali; osservate Lombardia/Sardegna | **ALTA** dove osservate |
| **Iscritti** | Tessere FN normalizzate | Anagrafe (**158.320** totali dichiarati, agg. ott 2026) | **ALTA** partito, non audit esterno |
| **Istituzioni** | Sindaci, consiglieri, deputati… | Registro Locali + punteggi ufficiali config | Conteggio **ALTA** · effetto **STIMATA** |

**Pesi ufficiali del mix:** flussi **35%** · preferenze **25%** · iscritti **25%** · istituzioni **15%**.

**Punteggi cariche (config):** deputato **5** · consigliere regionale **3** · sindaco **2** · consigliere comunale **1** · smoothing istituzionale **30**.

---

## 8. Atlante: Osservatorio, fabbisogni, conversione

### Modulo B — fabbisogni (stress territoriale)

| Indicatore | Fonte tipica | Perché è affidabile |
|------------|--------------|---------------------|
| Sanità (liste, mobilità…) | **AGENAS** | Dati amministrativi/settoriali ufficiali |
| Occupazione, prezzi, condizioni di vita | **ISTAT BesT** | Statistiche nazionali ufficiali |
| Qualità TPL, servizi locali | **OpenCivitas** | Indici documentati, periodo indicato in scheda |
| Ambiente, dissesto | **ISPRA / ARPA** | Fonti settoriali pubbliche |
| **Score stress 0–100** | Normalizzazione interna sul catalogo | **STIMATA** — ranking relativo, non verità assoluta |

### Modulo C — eventi e Trends

| Elemento | Fonte | Affidabilità |
|----------|-------|--------------|
| Diario eventi campagna | Redazione interna + cloud | **ALTA** qualitativa · non implica causalità sul voto |
| Confronto pre/post su Trends | Protocollo event study interno | **MEDIA–STIMATA** — correlazione, non causa provata |

### Permeabilità e verdict campagna

Lo **storico regionale** (FdI, Lega, PD, astensione…) da Europee 2024 alimenta un indice **0–100**: quanto il territorio è storicamente recettivo.

- Permeabilità alta → **priorità assoluta** (STIMATA come priorità, CERTA come base storica).  
- Permeabilità bassa, blocco PD → **conversione limitata** — la piattaforma lo segnala per non sprecare risorse.

---

## 9. Dataset di base e parametri ufficiali

| Dataset | Contenuto | Provenienza | Perché ci fidiamo / avvertenza |
|---------|-----------|-------------|--------------------------------|
| **Configurazione v3.2** | S, pesi, iscritti, flussi, cariche | Aggiornamento **16 ottobre 2026** | Tracciabile; iscritti = dato partito |
| **Europee 2024** | Validi, FdI, Lega per regione | Ministero Interno · 8–9 giugno 2024 | **CERTA** — allineamento risultati ufficiali |
| **Snapshot 18-10-2026** | Scenario congelato | Export a data fissa | **ALTA** audit interno: «a quella data il modello diceva X» |
| **Catalogo fabbisogni** | 4 indicatori × 20 regioni | Metadati AGENAS / ISTAT / OpenCivitas · 2024 | **CERTA** sul dato citato · sintesi **ALTA** |
| **Storico partiti regionali** | Quote per permeabilità | Baseline Europee 2024 | **CERTA** storico · uso conversione **STIMATA** |

<div class="source-box">
<p><strong>Italia 2024 (ricostruzione elettorato):</strong> elettori <strong>49.552.399</strong> · votanti <strong>24.621.499</strong> — coerenti con dati elettorali ufficiali usati dal motore.</p>
<p><strong>Monte Carlo:</strong> 20.000 simulazioni · variabilità su S circa ±1,2 punti percentuali (1 sigma) — quantifica incertezza delle **premesse**, non «probabilidade di vittoria».</p>
</div>

---

## 10. Flussi elettorali Ipsos e Sky TG24

| Matrice | Fonte pubblica | Quote indicative (FdI / Lega / Astenuti / Altri) | Affidabilità |
|---------|------------------|-----------------------------------------------------|--------------|
| **Default Ipsos** | Ipsos Doxa, analisi flussi · **5 luglio 2026** (~20.000 interviste feb–giu 2026) | 31% / 25% / 36% / 8% | **ALTA** per ciò che Ipsos ha pubblicato · **STIMATA** come traduzione in quota regionale FN |
| **Alternativa Sky** | Sky TG24 «Numeri» · **10 ottobre 2026** (riferimento EU 2024) | 19,5% / 13,8% / 57,4% / 9,3% | **ALTA** sulla pubblicazione · **STIMATA** in modello; può aggiungere **+0,35 pp** nello scenario crescita |

<blockquote>
Ipsos (luglio) e Sky (ottobre) **non** vanno letti come trend automatico nel tempo: campioni e domande possono differire. Servono a **calibrare** l’indice flussi, non a certificare il risultato delle prossime elezioni.
</blockquote>

---

## 11. Google Trends, notizie, Camera, B.I.P.

| Tipo | Fonte | Perché è utile | Limite |
|------|-------|----------------|--------|
| **Notizie** | Google News RSS, testate collegate | Agenda del giorno, link verificabile | **MEDIA** — titolo ≠ sentenza |
| **Trends** | Google Trends | Cosa cercano i cittadini **adesso** | **MEDIA** — indice relativo, non voti |
| **Parlamento** | dati.camera.it | Stato gruppi e mandati | **CERTA/ALTA** su anagrafica parlamentare |
| **Programma** | B.I.P. FN 2027–2037 | Risposta politica coerente | **ALTA** — documento di partito, non sondaggio |

---

## 12. Bibliografia e link

### Consenso e flussi

| Risorsa | Dove | Uso in piattaforma |
|---------|------|---------------------|
| **Supermedia YouTrend/AGI** | youtrend.it/la-supermedia | Default **S = 7,20%** |
| **Ipsos Doxa** | Analisi flussi FN · luglio 2026 | Matrice flussi default |
| **Sky TG24 «Numeri»** | Ottobre 2026 | Matrice alternativa, boost crescita |

### Dati pubblici (territorio e schede)

| Ente | Cosa citiamo |
|------|--------------|
| **Ministero dell’Interno** | Risultati Europee 2024 |
| **ISTAT** | BesT, occupazione, prezzi, condizioni di vita |
| **AGENAS** | Liste attesa, mobilità sanitaria |
| **OpenCivitas** | Qualità servizi e TPL |
| **ISPRA / ARPA** | Ambiente, dissesto, rischi |
| **Camera dei Deputati** | Open data gruppi e mandati |

### Documenti di partito

| Documento | Uso |
|-----------|-----|
| **B.I.P. 2027–2037** | Capitoli, pagine, messaggi stampa, provvedimenti in Osservatorio |
| **Snapshot scenario 18-10-2026** | Audit e confronto post-voto |

---

## 13. Cosa si può dire in pubblico (sì / no)

| Affermazione | In TV / stampa | Perché |
|--------------|----------------|--------|
| Validi e quote FdI/Lega 2024 per regione | **Sì, certo** | Ministero dell’Interno |
| Indicatori ISTAT/AGENAS in scheda Osservatorio | **Sì, con data fonte** | Statistiche ufficiali |
| Testo misura B.I.P. (capitolo/pagina) | **Sì** | Programma FN approvato |
| «S = 7,20%» come verità assoluta | **No** | Aggregatore Supermedia |
| Voti scenario in Lombardia (o altra regione) | **No** (scenario interno) | Modello parametrico |
| «+0,4 pp se enfatizziamo promessa X» | **No** come promessa | Simulazione con limiti |
| «Abbiamo un sondaggio regionale in piattaforma» | **No** | Poll **simulato** |
| Google Trends «+148%» = +148% voti | **No** | Attenzione online ≠ voto |
| Gruppo parlamentare da open data Camera | **Sì** | Fonte istituzionale |
| «Priorità campagna coerente con regole piattaforma» | **Sì**, spiegando assunzioni | Trasparenza metodologica |

<div class="source-box">
<p><strong>Controllo qualità:</strong> test automatici sui calcoli critici; snapshot congelati; export PDF = stato della piattaforma al momento della stampa. La **onestà** sul grado di affidabilità **rafforza** il leader in dibattito: «questo è ISTAT, questa è la nostra simulazione».</p>
</div>

---

## 14. Giornata tipo e limiti d’uso

**Flusso operativo:** conferma **S** → mappa Scenario → Osservatorio (regione o Italia) → **Analizza** (fonte MEDIA live + B.I.P. ALTA + conversione STIMATA) → Trends → Locali → snapshot.

<blockquote class="disclaimer">
<strong>La piattaforma non</strong> predice l’esito elettorale, non certifica sondaggi, non sostituisce pareri legali sui fatti di cronaca, non garantisce che ogni titolo RSS sia già accertato in sede penale.
</blockquote>

**Sì:** priorità territoriali, messaggio allineato al B.I.P., difesa trasparente delle fonti, stesso quadro per leader e coordinatori.

**No:** presentare simulazioni come inchieste; confondere stress ISTAT e intenzione di voto FN.

---

<p class="fn-footer-note">Futuro Nazionale · Piattaforma v3.2 · Presentazione con fonti e affidabilità · Ottobre 2026 · Approfondimento: guida «Metodologia numeri e simulazioni» nella sezione Guida dell’applicazione.</p>
