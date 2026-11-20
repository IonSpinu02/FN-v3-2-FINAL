<div class="cover">
<p class="cover-kicker">Futuro Nazionale · Piattaforma v3.2</p>
<h1>Metodologia numeri, simulazioni e fonti</h1>
<p class="cover-sub">Tracciabilità di ogni importo e indicatore in Scenario, Osservatorio e Locali — formule in linguaggio chiaro, fonti ufficiali e limiti di interpretazione.</p>
<p class="cover-meta"><strong>Documento interno</strong> · Ottobre 2026 · Orizzonte operativo Ott 2026 – Mag 2027<br>
Motore elettorale v3.2 · Allineato al modello analitico di partito<br>
<span class="cover-badge">Non è un sondaggio certificato · Scenario parametrico revisionabile</span></p>
</div>

# Indice

1. Principi e disclaimer
2. Atlante: cosa vedi in piattaforma
3. Catalogo dati e responsabilità
4. Modulo A — scenario elettorale
5. Monte Carlo
6. Poll regionale simulato
7. Crescita Ott ’26 → Mag ’27
8. Osservatorio: problemi, impatto, conversione
9. Modulo B — fabbisogni
10. Modulo C — eventi e Google Trends
11. Flussi elettorali Ipsos / Sky TG24
12. Locali — cariche istituzionali
13. Bibliografia e link ufficiali
14. Affidabilità: così sì, così no

---

## 1. Principi e disclaimer

<blockquote class="disclaimer">
<strong>Regola d’oro:</strong> la piattaforma produce <strong>scenari</strong> e <strong>priorità</strong>, non pronostici elettorali validati. Il consenso nazionale (S) è un <em>dato in ingresso</em> (default da aggregatore sondaggi), non un risultato calcolato dal motore.
</blockquote>

### Perché tre moduli (A / B / C)

| Modulo | Domanda | Fonte tipica | Errore da evitare |
|--------|---------|--------------|-------------------|
| **A · Elettorale** | Quota FN per regione dato S e organizzazione? | Europee 2024, iscritti, flussi, cariche | Confondere stima con poll indipendente |
| **B · Fabbisogni** | Dove il territorio è in stress oggettivo? | ISTAT BesT, AGENAS, OpenCivitas | Leggere stress = intenzione di voto FN |
| **C · Eventi / Trends** | Cosa accade e cosa cercano online? | Registro eventi, Google Trends, RSS | Trends 0–100 = percentuale elettorale |

**Perché ha senso integrarli in campagna:** la mappa A indica *dove* siamo forti; B *perché* un presidio è legittimo; C *cosa* emerge nell’agenda. Il +pp in Osservatorio collega tema e permeabilità storica con regole esplicite e limiti massimi/minimi — non con correlazioni automatiche.

**Affidabilità operativa:** un solo motore di calcolo per tutta la piattaforma; controlli automatici sui calcoli; snapshot congelati; parametri modificabili (S, pesi, flussi, cariche) con ricalcolo immediato e tracciabile.

---

## 2. Atlante: cosa vedi in piattaforma

Due tabelle di riferimento per operatori e revisori.

### 2.A Scenario, poll e Monte Carlo

| In interfaccia | Cosa significa | Come lo ricaviamo | Fonte |
|----------------|----------------|-------------------|-------|
| **S nazionale %** | Consenso FN impostato | Valore scelto dall’operatore | Default **7,20%** · Supermedia YouTrend/AGI (ott 2026) |
| **Stima % regione** | Quota FN coerente con S | Mix territoriale ÷ bacino centrodestra 2024 | Europee 2024 + pesi flussi/preferenze/iscritti/istituzioni |
| **Voti scenario** | Voti FN stimati | Stima % × validi regionali | Europee 2024 |
| **Benchmark %** | Riferimento bacino CDX | Stessa logica con solo FdI+Lega | Europee 2024 |
| **Scarto vs benchmark** | Differenza scenario − benchmark | Media ponderata sui validi | Derivato dallo scenario |
| **Entropia H** | Concentrazione vs dispersione territoriale | Indice di Shannon sulla distribuzione | Calcolo interno |
| **lo10 / hi90** | Fascia di incertezza | Estremi su 20.000 simulazioni | Monte Carlo su pesi e S |
| **Stima poll regionale** | Centro stima “sondaggio simulato” | Stima scenario aggiustata per affluenza | Affluenze 2024 in configurazione |
| **Margine errore / IC 95%** | Incertezza statistica | Campione virtuale + dispersione MC | Parametri poll (N=1000, livello 95%) |
| **Prob. sopra soglia 3%** | Quanto è probabile superare lo sbarramento | Simulazione statistica | Soglia 3% (configurabile) |
| **Voti da poll sim.** | Voti coerenti con stima poll | Stima poll × validi attesi | Europee 2024 |

### 2.B Crescita, Osservatorio, organizzazione

| In interfaccia | Cosa significa | Come lo ricaviamo | Fonte |
|----------------|----------------|-------------------|-------|
| **Target S Mag ’27** | Scenario crescita nazionale | S + incremento in punti percentuali | Regime campagna + matrice flussi |
| **+pp / +voti su tema** | Effetto presidio su un problema | Impatto × permeabilità regionale × tema | Storico partiti + score problema |
| **Priorità 0–100** | Urgenza territoriale | Stress fabbisogni e/o impatto notizia | ISTAT/AGENAS + RSS |
| **Google Trends 0–100** | Attenzione relativa online | Normalizzazione serie | Google Trends (CSV o live) |
| **Iscritti per regione** | Tessere FN | Anagrafe partito | Dato dichiarato · non audit esterno |
| **Preferenze / seggi** | Forza organizzativa circoscrizioni | Osservate (Lombardia, Sardegna) o stimate da Lega 2024 | Configurazione partito |
| **Cariche istituzionali** | Dep., consiglieri, sindaci, comuni | Conteggi registro + eventuali incrementi | Tab Locali |

---

## 3. Catalogo dati e responsabilità

| Dataset | Contenuto | Provenienza | Avvertenza |
|---------|-----------|-------------|------------|
| **Configurazione v3.2** | S, pesi, iscritti, flussi, cariche, simulazioni | Aggiornamento **16-10-2026** · **158.320** iscritti totali dichiarati | Iscritti: fonte partito, non certificazione indipendente |
| **Europee 2024** | Validi, FdI, Lega per regione | Dati elettorali forniti al progetto | Senza audit esterno aggiuntivo |
| **Snapshot 18-10-2026** | Scenario congelato | Export ufficiale a data fissata | Baseline per audit e post-voto |
| **Catalogo fabbisogni** | 4 indicatori × 20 regioni | Metadati AGENAS / ISTAT BesT / OpenCivitas · 2024 | Spesso valori descrittivi, non serie complete |
| **Eventi Osservatorio** | Episodi campagna | Redazione interna | Non implica causalità sul voto |
| **Storico partiti regionali** | Quote FdI, Lega, PD, astensione | Baseline storica documentata | Solo per permeabilità territoriale, non per S |

### Parametri numerici ufficiali (configurazione v3.2)

<div class="source-box">
<p><strong>Italia 2024 (ricostruzione):</strong> elettori <strong>49.552.399</strong> · votanti <strong>24.621.499</strong>.</p>
<p><strong>Pesi del mix:</strong> flussi elettorali <strong>35%</strong> · preferenze <strong>25%</strong> · iscritti <strong>25%</strong> · istituzioni <strong>15%</strong>.</p>
<p><strong>Flussi Ipsos (default):</strong> da Fratelli d’Italia <strong>31%</strong> · da Lega <strong>25%</strong> · da astenuti <strong>36%</strong> · altre <strong>8%</strong>.</p>
<p><strong>Punteggi cariche:</strong> deputato <strong>5</strong> · consigliere regionale <strong>3</strong> · sindaco <strong>2</strong> · consigliere comunale <strong>1</strong>.</p>
<p><strong>Smooting istituzionale:</strong> coefficiente <strong>30</strong>. <strong>Monte Carlo:</strong> 20.000 simulazioni · variabilità su S circa ±1,2 pp (1 sigma).</p>
</div>

---

## 4. Modulo A — scenario elettorale

Il motore ricostruisce l’elettorato 2024, costruisce quattro indici per regione e ricava stima % e voti.

### 4.1 Ricostruzione elettorato (post-Europee 2024)

Partiamo dai **validi** per regione e dall’**affluenza %** registrata. Allineiamo i totali regionali ai votanti nazionali 2024, poi ricaviamo elettori e astenuti per ogni regione. Il **bacino centrodestra** (quota FdI+Lega sui validi) serve a normalizzare le stime quando si applica il consenso nazionale S.

**Affluenze:** percentuali per regione in configurazione, coerenti con i dati elettorali 2024.

### 4.2 Preferenze (organizzazione seggi)

Preferenze totali **532.368**, ripartite sulle cinque circoscrizioni (Nord-Ovest, Nord-Est, Centro, Sud, Isole). **Osservate** in Lombardia (**122.608**) e Sardegna (**15.162**); per le altre regioni il residuo è ripartito in proporzione al peso Lega 2024 sui validi.

### 4.3 Flussi elettorali

Per ogni regione combiniamo il profilo storico FdI, Lega e astenuti con le **quote di provenienza** della matrice attiva (Ipsos o Sky — vedi §11). Così otteniamo l’indice “flussi”.

### 4.4 Iscritti e istituzioni

Gli **iscritti** sono normalizzati sul totale nazionale. Le **cariche** (deputati, consiglieri regionali, sindaci, consiglieri comunali) producono un punteggio pesato; l’indice istituzionale tiene conto anche del bacino regionale con un coefficiente di smoothing pari a **30**.

### 4.5 Mix finale e stima

I quattro indici (flussi, preferenze, iscritti, istituzioni) entrano nel mix con i pesi 35/25/25/15. La **stima %** regionale è il consenso S applicato al mix, corretto per il bacino centrodestra. I **voti** moltiplicano la stima per i validi. Il **benchmark** ripete il calcolo usando solo il mix FdI+Lega.

Sono disponibili anche scenari di sensibilità (pesi uguali, solo flussi, senza istituzioni, ecc.) per capire quanto la stima dipende dalle assunzioni.

---

## 5. Monte Carlo

| Parametro | Valore | Ruolo |
|-----------|--------|--------|
| Numero simulazioni | 20.000 | Distribuzione delle stime possibili |
| Variabilità pesi | Modello Dirichlet | Oscillazione realistica intorno ai pesi medi |
| Rumore su S | σ ≈ 0,012 | Incertezza sul consenso nazionale in input |

Ogni simulazione sorteggia pesi leggermente diversi e un valore di S intorno a quello impostato, ricalcola le stime regionali e costruisce le bande **lo10 / hi90**. Non sostituisce un sondaggio reale: quantifica l’incertezza **parametrica**.

---

## 6. Poll regionale simulato

Non è un’inchiesta sul campo: è un **modello statistico** costruito sopra lo scenario corrente.

| Impostazione | Valore | Significato |
|--------------|--------|-------------|
| Campione virtuale | 1.000 (o proporzionale ai validi) | Base per margine errore |
| Livello di confidenza | 95% | Intervallo attorno alla stima |
| Effetto disegno | 1,15 | Correzione per complessità territoriale |
| Soglia sbarramento | 3,0% | Riferimento legale/operativo |
| Simulazioni probabilità | 10.000 | Stima prob. di superare la soglia |

Combiniamo l’errore da campione virtuale con la dispersione emersa dal Monte Carlo. Da qui: margine di errore, intervallo al 95%, probabilità di superare il 3%, classificazione regione (sicura / contesa / critica) e contributo percentuale di flussi, preferenze, iscritti e istituzioni al mix.

---

## 7. Crescita Ott ’26 → Mag ’27

Scenario di **lavoro campagna**, non previsione elettorale certificata.

### 7.1 Incremento nazionale (punti percentuali)

Sommiamo tre componenti:

1. **Regime:** base organica **+1,15 pp** · spinta territori **+1,85 pp** · massima espansione **+2,60 pp**
2. **Matrice Sky TG24 (se attiva):** **+0,35 pp**
3. **Aggiustamento se S ≠ 7,2%:** (S − 7,2) × 100 × **0,85**

Il **consenso obiettivo** è S più l’incremento totale. I **nuovi voti** si ottengono scalando i voti scenario in proporzione al rapporto tra consenso obiettivo e S iniziale.

### 7.2 Dettaglio regionale

Stesso incremento nazionale, moltiplicato per un **fattore territoriale** (potenziale vs bacino, peso astenuti dalla matrice flussi, quota di partenza). Voti e percentuali a maggio 2027 seguono la stessa proporzione tra quota iniziale e finale. La **curva mensile** (ottobre 2026 → maggio 2027) usa interpolazione morbida; la fascia di incertezza si allarga con l’incremento previsto.

**Riferimento concettuale:** documento interno «Provenienza potenziali voti FN · Analisi Flussi 2026».

---

## 8. Osservatorio: problemi, impatto, conversione

### 8.1 Da dove arrivano i problemi

- **Catalogo** temi per regione e categoria (sanità, trasporti, lavoro, sicurezza, caro-vita, territorio).
- **Notizie live** da Google News, quando disponibili, con titolo, sintesi e link.
- **Merge** tra notizia e scheda certificata, con badge Live / Certificata.
- **Stress territoriale** da Modulo B; **impatto notizia** da analisi testuale (gravità, recency, scala persone/tempi).
- Riga **dato ufficiale** in scheda: testi AGENAS / ISTAT BesT / OpenCivitas per categoria e regione.

### 8.2 +pp e +voti su un tema

Partiamo dallo **storico elettorale regionale** (FdI, Lega, FI, PD, M5S, astensione) e calcoliamo un indice di **permeabilità** (0–100): quanto il territorio è recettivo rispetto a un messaggio FN.

Il guadagno stimato in punti percentuali combina: intensità del problema (0–100), permeabilità, **elasticità del tema** (es. sicurezza leggermente sopra media, territorio leggermente sotto), fattori di attenuazione se la permeabilità è bassa, e limiti tra **0,04 e 0,85 pp** per singolo tema. I **voti** = validi regionali × (pp / 100).

**Elasticità per tema:** Sicurezza 1,08 · Lavoro 1,05 · Sanità 1,00 · Trasporti 0,98 · Caro-vita 1,02 · Territorio 0,95.

**Verdict campagna:** permeabilità alta → priorità assoluta · media → presidio mirato · bassa → roccaforte PD/centrosinistra (conversione limitata).

### 8.3 Simulazione in cockpit

L’operatore può includere fino a **tre temi** per regione; i punti percentuali si sommano con un fattore di **saturazione 0,88** per evitare doppi conteggi ottimistici.

La ripartizione **45% / 30% / 25%** (astenuti / Lega / centrodestra) nel modal Analizza è **illustrativa**, non microdato elettorale osservato.

---

## 9. Modulo B — fabbisogni

Catalogo per 20 regioni con metadati obbligatori: **fonte** (AGENAS, ISTAT BesT, OpenCivitas, …), **periodo** (tipicamente 2024), **metodo** (amministrativo, indagine ISTAT, …), natura osservato/derivato.

Lo **stress 0–100** per macro-tema deriva dal ranking degli indicatori e dai riferimenti territoriali vs Italia.

<blockquote>
Modulo B misura <strong>bisogno pubblico</strong>. Non implica che gli elettori in quella regione voteranno FN.
</blockquote>

---

## 10. Modulo C — eventi e Google Trends

| Elemento | Fonte | Nota |
|----------|-------|------|
| Registro eventi | Redazione + cloud | Qualitativo; date per analisi pre/post |
| Google Trends | CSV import o feed live | Indice **relativo** 0–100, non volumi assoluti |
| Event study | Protocollo interno | Confronto finestre temporali su serie Trends |
| Scheda mensile | Sintesi A+B+C | Dove non c’è causalità voto, lo si dichiara esplicitamente |

---

## 11. Flussi elettorali Ipsos / Sky TG24

| Matrice | Fonte citata | Quote FdI / Lega / Astenuti / Altri |
|---------|--------------|--------------------------------------|
| **Ipsos luglio 2026** | Ipsos Doxa, Pagnoncelli · 5 lug 2026 · ~20.000 interviste feb–giu 2026 | 31% / 25% / 36% / 8% |
| **Sky TG24 ottobre 2026** | Sky TG24 «Numeri» · 10 ott 2026 (riferimento Europee 2024) | 19,5% / 13,8% / 57,4% / 9,3% |

Servono a calibrare l’indice flussi e, per Sky, l’eventuale **+0,35 pp** nello scenario crescita.

<blockquote>
Ipsos (luglio) e Sky (ottobre) <strong>non</strong> vanno letti come trend temporale automatico: campioni e domande possono differire.
</blockquote>

---

## 12. Locali — cariche istituzionali

Il **registro Locali** registra comuni e cariche FN. Ogni incremento aggiorna i conteggi istituzionali e può alzare la stima **solo nelle regioni** dove le cariche sono effettivamente presenti — in modo tracciabile dall’operatore.

---

<div class="page-break"></div>

## 13. Bibliografia e link ufficiali

### Consenso e flussi (input politici)

| Risorsa | Link / riferimento | Uso |
|---------|-------------------|-----|
| Supermedia YouTrend/AGI | https://www.youtrend.it/la-supermedia/ | Default S = 7,2% |
| Ipsos Doxa | Analisi flussi FN · luglio 2026 | Matrice flussi default |
| Sky TG24 «Numeri» | Ottobre 2026 | Matrice alternativa + boost crescita |

### Dati pubblici (Modulo B e schede territorio)

| Ente | Cosa citiamo |
|------|--------------|
| **ISTAT** | BesT 2025, occupazione, prezzi, condizioni di vita |
| **AGENAS** | Liste attesa, mobilità sanitaria |
| **OpenCivitas** | Qualità servizi e TPL |
| **ISPRA / ARPA** | Ambiente, dissesto, rischi |

### Dati elettorali e organizzativi

| Dato | Provenienza |
|------|-------------|
| Validi, FdI, Lega 2024 | Europee 2024 (dataset progetto) |
| Affluenze regionali | Configurazione v3.2 |
| Preferenze e iscritti | Configurazione partito (con avvertenze §3) |

---

## 14. Affidabilità: così sì, così no

| Affermazione | Giudizio | Perché |
|--------------|----------|--------|
| «Ogni cifra in Scenario deriva da regole e dati citati» | **Sì** | Tracciabilità §2–§4 |
| «Le simulazioni mostrano incertezza su pesi e S» | **Sì** | Monte Carlo §5 |
| «Il poll regionale è un sondaggio sul campo» | **No** | Modello statistico §6 |
| «Mag ’27 è una previsione elettorale certa» | **No** | Scenario parametrico §7 |
| «Google Trends +10 = +10 pp FN» | **No** | Salvo regole conversione con limiti §8 |
| «Gli iscritti sono certificati da terzi» | **No** | Avvertenza §3 |
| «Le priorità campagna sono coerenti con le regole» | **Sì**, accettando le assunzioni | Permeabilità + stress + promesse |

### Controllo qualità

- Test automatici su calcoli critici (scenario, poll, conversione, dati territoriali).
- Snapshot congelati per audit e confronto post-voto.
- Export PDF scenario/osservatorio = stato della piattaforma al momento della stampa.

<p class="fn-footer-note">
Futuro Nazionale · Piattaforma scenario territoriale v3.2 · Documento metodologico interno · Non pubblicare come inchiesta demoscopica certificata.
</p>
