<div class="cover">
<p class="cover-kicker">Futuro Nazionale · Piattaforma v3.2</p>
<h1>La bussola — presentazione per la dirigenza</h1>
<p class="cover-sub">Testo orale · ogni numero con provenienza e grado di affidabilità · Ottobre 2026</p>
<p class="cover-meta"><strong>Legenda affidabilità (usata nel testo):</strong><br>
<span class="cover-badge">CERTA 100% · dati ufficiali pubblici verificabili (elezioni, ISTAT, AGENAS dove indicato)</span><br>
<span class="cover-badge">ALTA · fonti istituzionali o inchieste note, non ridondanti al voto FN</span><br>
<span class="cover-badge">MEDIA · aggregatori, modelli interni, RSS — utili ma non certificate come sondaggio</span><br>
<span class="cover-badge">STIMATA · simulazione esplicita (Monte Carlo, conversione promesse) — scenario, non promessa elettorale</span></p>
</div>

# Apertura — perché adesso

Buongiorno. So che il tuo tempo vale più di un’ora di slide. Per questo non ti chiedo di “credere alla tecnologia”: ti chiedo di guardare una cosa sola — **se domani mattina dovessi decidere dove mettere il tuo volto, la tua voce e le prossime risorse del movimento, preferisci decidere a sensazione o con una mappa che ti dice da dove viene ogni numero?**

Questa piattaforma l’abbiamo costruita **per te e per Futuro Nazionale**, non come prodotto generico. Il costo di **non** averla non è teorico: è spostare energie nella regione sbagliata, rispondere al tema sbagliato mentre Google e la stampa urlano su un altro, scoprire a fine mese che le tessere sono cresciute ma lo scenario elettorale non si è mosso — e non sapere perché.

Io voglio portarti dall’altra parte: **decisione rapida, difesa pubblica dei numeri**, perché ogni cifra che vedi ha un’etichetta di provenienza. Subito dopo ogni dato ti dico **come l’abbiamo ricavato** e se è **fonte certa al cento per cento** oppure **stima di modello** che va presentata come scenario. Questa onestà non ti indebolisce: ti rende **ingiocabile** in televisione quando ti chiedono “da dove lo sapete?”.

---

# Scenario — la mappa che obbedisce alle tue ipotesi

Apri la tab **Scenario**. Vedi venti regioni colorate.

**Cosa rappresenta il colore:** la **stima percentuale regionale FN** e i **voti di scenario** per quella regione.

**Come si ricava:** motore elettorale v3.2 (`calculate.ts`) che parte da quattro input mescolati con pesi configurabili: **flussi elettorali**, **preferenze di circoscrizione**, **iscritti FN per regione**, **presenze istituzionali** (sindaci, assessori, consiglieri dal registro Locali). La formula integra il **consenso nazionale S** che imposti tu in alto e i **validi alle Europee 2024** per regione.

**Affidabilità:**

- **Validi e quote FdI/Lega 2024 per regione → CERTA 100%.** File `platform/data/eu2024.json`, allineato ai risultati ufficiali Ministero dell’Interno, Elezioni Europee 8–9 giugno 2024.
- **Numero iscritti per regione → ALTA, non CERTA 100% audit esterno.** Dato anagrafe FN in `config_v3_2.json`, aggiornabile da CSV in tab Storico; è il dato che il partito dichiara, non certificato da ente terzo.
- **Presenze istituzionali → ALTA operativa.** Conteggio da `locali_registry.json` + regole punteggio in `localInstitutions.ts`; verificabile regione per regione nel registro Locali.
- **Stima % e voti di scenario → STIMATA.** Output del modello parametrico: cambia se cambi S, pesi o flussi; **non è un sondaggio Swg/Ipsos/Techne certificato**.

**Consenso nazionale S — default sette virgola venti per cento.**

**Come si ricava:** valore in ingresso scelto dall’operatore; default da **Supermedia YouTrend/AGI** (aggregatore di sondaggi pubblicati).

**Affidabilità: MEDIA.** È la media delle inchieste disponibili in rete, **non** un’unica rilevazione certificata al cento per cento sul FN in questo istante. Tu puoi sostituirlo con un S che ti dà la segreteria: da quel momento **tutta la mappa** è coerente con **la tua** premessa, tracciata nello snapshot.

**Monte Carlo — intervallo lo10 / hi90.**

**Come si ricava:** simulazione (tipicamente ventimila estrazioni) che varia leggermente pesi e S secondo regole in config (`PythonRandom` allineato al motore storico).

**Affidabilità: STIMATA.** Misura **incertezza del modello**, non errore campionario di un poll. Serve a rispondere: “siamo robusti o siamo sul filo?” — non a dire “vinciamo al 90%”.

**Flussi Ipsos in UI.**

**Come si ricava:** matrice flussi verso FdI/Lega/astensione da documento analisi **Ipsos Doxa luglio 2026** (default in config); opzionalmente matrice **Sky TG24 ottobre 2026** per provenienza voti.

**Affidabilità: ALTA per quello che Ipsos/Sky hanno pubblicato; STIMATA** per come il motore traduce quei flussi in quota regionale FN insieme agli altri tre indici.

**Poll regionale simulato (TARGET / WATCH).**

**Come si ricava:** `regionalPoll.ts` — trasformazione statistica dello **scenario già calcolato**, con margini e probabilità soglia.

**Affidabilità: STIMATA.** **Non usarla mai** come “abbiamo un sondaggio in Lombardia”. Usala **solo** in staff interno per priorità giornaliera.

**Perché dovresti adottarla psicologicamente:** la mappa crea **ancoraggio visivo**. Il cervello ricorda le forme e i colori meglio delle tabelle. Tu entri in riunione con **un’immagine condivisa**; chi oppone un’intuizione deve confrontarsi con **venti regioni già calcolate**, non con un “secondo me”. È **authority transfer**: non sei tu che inventi, è il modello — e tu controlli le leve.

---

# Quadro FN — dove andare domani

Tab **Quadro FN**: tabella venti regioni — stima, voti scenario, iscritti, **stress fabbisogni** (Modulo B), eventi.

**Stress territoriale (sanità, lavoro, abitare, entropia).**

**Come si ricava:** catalogo `fabbisogni_catalog.json` — indicatori da **ISTAT BesT**, **AGENAS**, **OpenCivitas** dove indicato in scheda; score di stress calcolato in `territorialIntelligence.ts` (es. occupazione: stress alto se occupazione bassa).

**Affidabilità:**

- **Valori ISTAT/AGENAS sottostanti → CERTA 100%** come statistiche ufficiali **alla data di pubblicazione** (non previsione elettorale).
- **Score stress 0–100 in piattaforma → STIMATA** (regola di normalizzazione interna).

**Ordine regioni per “voti guadagnabili”.**

**Come si ricava:** ranking interno che combina elasticità storica, permeabilità del bacino, stima scenario — **non** un dato ISTAT.

**Affidabilità: STIMATA.** È **priorità di campagna**, non verità assoluta.

**Regola d’oro (ti protegge):** stress BesT **non** viene convertito automaticamente in “voteranno FN”. Due moduli separati. In public speaking puoi dire: “Il territorio qui è in sofferenza **certificata ISTAT**; la nostra **stima** di conversione elettorale è un altro capitolo, ed è nel simulatore promesse.” Nessuno ti accusa di numerologia.

---

# Osservatorio — il cockpit che il movimento non ha mai avuto

Qui c’è il cuore emotivo e operativo. L’Osservatorio è progettato **zero scroll**: apri **Lombardia** (o altra regione) e hai subito **Problemi · Google · Dati**.

**Menu venti regioni ordinato per potenziale seggi.**

**Come si ricava:** `selectRegionalDisplayIssues` / ranking seggi — storico partiti regionali (Europee 2024), indice permeabilità, impatto problema, segnale Trends.

**Affidabilità: STIMATA** per il ranking; **CERTA 100%** solo per le quote elettorali storiche di base (eu2024).

---

## Passo 2 — Radar problemi

**Notizie “Dato live”.**

**Come si ricavano:** ingest RSS Google News e fonti configurate (`newsIngest.ts`), fino a ~120 titoli per regione, filtri off-topic/sport, classificazione su sei macro-temi.

**Affidabilità: MEDIA.** Sono **titoli di cronaca** con link; verifica umana consigliata prima di citarli in pubblico come “fatto giudiziario”. In piattaforma sono **evidenza di attenzione**, non sentenza.

**Schede catalogo quando manca cronaca.**

**Come si ricavano:** `territoryIssuesCatalog.ts` + Modulo B regionale.

**Affidabilità: ALTA** sul dato strutturale B; **STIMATA** sul punteggio impatto elettorale.

**Simulatore promesse FN (+pp, +voti, max tre temi).**

**Come si ricava:** `computeIssueConversionGain` — promessa da catalogo `FN_PROMISES_CATALOG`, storico regionale, intensità problema.

**Affidabilità: STIMATA esplicita.** È **ordine di grandezza** per staff, non impegno di risultato. In demo: “Se **investiamo** su questo tema **in questa regione**, il modello **ipotesi** X — vediamo insieme le assunzioni.”

**Tecnica persuasiva:** **commitment ladder**. Chiedi solo: “Seleziona un problema.” Poi: “Aggancia la promessa.” Poi: “Simula.” Tre sì piccoli → **ownership** della decisione. Non stai vendendo software; stai facendo **lui** premere Simula.

---

## Passo 3 — Google Trends e B.I.P.

**Query `exactQuery` per regione (es. Trenord, Cardarelli, alluvione Romagna).**

**Come si ricavano:** catalogo curato `REGIONAL_GOOGLE_TRENDS_CATALOG` in `googleTrendsRegionalCatalog.ts` — query e correlate **diverse per ciascuna delle 20 regioni**, agganciate a capitoli **B.I.P. 2027–2037** (documento programmatico FN).

**Affidabilità:**

- **Testo soluzione B.I.P. (capitolo/pagina) → ALTA** come fedeltà al documento di programma **che avete approvato**; non è dato ISTAT.
- **Indici 100/100 e surge +148% in catalogo → STIMATA / didattica.** Servono a **ordinare priorità in UI**; non sono export ufficiale Google in tempo reale finché non arriva il feed live.
- **Picco “ULTIM’ORA” → MEDIA quando attivo:** merge RSS Google Trends (`googleTrendsLiveRss.ts`, geo IT / IT-XX) con fuzzy match su query B.I.P.; **affidabilità del picco: MEDIA** (Google Trends RSS è segnale reale, ma non inchiesta demoscopica).

**Dato oggettivo Modulo B nel box centrale.**

**Come si ricava:** testo curato per regione + indicatori fabbisogni dove collegati.

**Affidabilità: mix CERTA 100%** (se cita ISTAT/AGENAS) **+ ALTA** (sintesi redazionale).

**Perché ti convince un leader:** **loss aversion**. Il cittadino sta già cercando su Google **oggi**; se tu parli ieri, **perdi** attenzione. La piattaforma ti mette **la frase esatta** che digitano e **la risposta B.I.P. già scritta** — riduce **cognitive load** sotto stress mediatico. Sentirsi **preparati** aumenta **perceived control**; la gente segue chi sembra avere il piano, non chi improvvisa.

**Prova sociale implicita:** “In Campania la query dominante è baby gang e imputabilità; in Piemonte Mirafiori e Euro 5.” Non stai inventando un’Italia piatta — stai mostrando **competenza territoriale**, segno di partito **serio**, non nazionale-spot.

---

## Rassegna stampa defezioni

**Elenco politici e cambi gruppo.**

**Come si ricava:** catalogo verificato + merge **SPARQL Camera** (`dati.camera.it`) dove disponibile, RSS Google News; simulatore beneficio ingresso FN da regole elettorali.

**Affidabilità:**

- **Mandato e gruppo parlamentare da open data Camera → ALTA / CERTA 100%** sullo **stato anagrafico parlamentare** al momento della query.
- **Voci “rumor” o non confermate → escluse o etichettate** in UI dove previsto.
- **Beneficio simulato ingresso FN → STIMATA.**

---

# Locali — tessere e cariche che muovono lo Scenario

**Delta istituzionale quando registri un sindaco o un consigliere.**

**Come si ricava:** `computeIstituzioniDelta` → override opzionale in `POST /api/scenario`.

**Affidabilità: ALTA** sul conteggio cariche; **STIMATA** sull’effetto sulla quota regionale (dipende dai pesi del modello).

**Messaggio persuasivo:** **reciprocity.** Il partito **investe** anagrafe e locali; la piattaforma **restituisce** visibilità immediata dell’effetto. Chi fa radicamento vede **numeri muoversi** — rinforzo positivo per coordinatori regionali.

---

# Snapshot, audit, post-voto

**Scenario congelato 18 ottobre 2026.**

**Come si ricava:** file `scenario_congelato_18-10-2026.json` — output `calculate` a data fissa.

**Affidabilità: STIMATA** come ogni scenario, ma **CERTA 100%** sul fatto che **è quello** che avevate in quella data (audit interno).

**Utilità psicologica:** **consistency**. Coerenza narrativa nel tempo: “A ottobre avevamo ipotizzato X; a gennaio S è Y; ecco il delta **tracciato**.” Elimina accuse di numeri **cambiati a piacimento**.

---

# Cosa chiederti di fare — chiusura

Non ti chiedo di abbandonare il tuo istinto politico. **Quello è irreplaceable.** Ti chiedo di **sovrapporre** questo strato: mappa, problemi, Google, B.I.P., Locali — **prima** di allocare un weekend in un capoluogo.

**Ripasso onestà (ti rende più forte, non più debole):**

| Affermazione in public | Puoi dirla “certa al 100%”? |
|------------------------|----------------------------|
| Validi EU 2024 per regione | **Sì** — Ministero Interno |
| Indicatori ISTAT BesT in scheda | **Sì** — alla data fonte |
| S = 7,20% default | **No** — aggregatore Supermedia |
| Voti scenario Lombardia | **No** — modello parametrico |
| +0,4 pp se enfatizzi promessa X | **No** — simulazione |
| Query Google “Trenord ritardi” in Lombardia | **Catalogo curato + live RSS** — segnale attenzione, non voto |

**Commitment richiesto (piccolo, reversibile):** quindici minuti di demo live. Lombardia → Campania → un Simula intervento. Se alla fine **non** ti senti più in controllo della mappa rispetto a prima, abbiamo fallito noi, non tu.

**Peak-end rule:** voglio che l’ultima immagine sia **Campania che cambia** query Google e problemi rispetto a Lombardia — **prova visiva** che non è cosmetica. Poi **Locali**: una carica inserita, effetto istituzioni visibile.

Futuro Nazionale ha un programma (**B.I.P.** — documento ALTA, vostro). Ha un territorio (**ISTAT/Camera — CERTA dove indicato**). Ha bisogno di **sincronizzare** leader, staff e coordinatori sulla **stessa mappa**. Questa piattaforma esiste per **non lasciare nulla al caso** là dove il caso costa seggi.

Grazie. Sono pronto: dimmi una regione a caso e la apriamo **adesso**.

---

<p class="cover-meta" style="margin-top: 10mm; border: none; color: #64748b;"><strong>Audio ElevenLabs:</strong> <code>PRESENTAZIONE-VANNACCI-PIATTAFORMA-AUDIO.txt</code> — ogni blocco dati con <em>come lo ricaviamo</em> + <em>perché è affidabile</em> (~28–35 min).<br><strong>Rigenera PDF:</strong> <code>npm run docs:vannacci-pdf</code></p>
