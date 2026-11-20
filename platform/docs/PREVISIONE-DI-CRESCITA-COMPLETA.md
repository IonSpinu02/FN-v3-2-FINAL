# Previsione di crescita — documento completo

**Ambito:** blocco **02 // PREVISIONE DI CRESCITA** della piattaforma Futuro Nazionale  
**Data documento:** 10 novembre 2026  
**Modello numerico principale:** `FN_FORECAST_V4` («Modello v4.0 · 8 fattori»)  
**Stato:** descrizione operativa del prodotto attuale (motore, UI, API, memoria decisionale, supervisione)

Questo file unifica e aggiorna la documentazione storica in `PREVISIONE-CRESCITA-FUNZIONAMENTO-UI.md` e `PREVISIONE-CRESCITA-CODICE.md`, che descrivevano soprattutto il percorso mese-per-mese (`growthTrajectory`). Il percorso attuale del report è centrato su **Forecast V4**, con strati di consenso statistico, calibrazione walk-forward, telemetria fonti, ledger append-only e Stratega AI.

---

## 1. A cosa serve

La sezione non è un grafico decorativo. Serve a:

1. Partire dal **consenso nazionale S** dello scenario (riquadro 01).
2. Proiettare scenari a **30 / 90 / ~180 giorni (Maggio 2027)** con fattori additivi ispezionabili.
3. Separare chiaramente **dato osservato**, **ipotesi di modello** e **sintesi interpretativa**.
4. Consentire a un revisore di ricostruire *point-in-time* cosa sapeva il sistema quando ha emesso una previsione.
5. Far intervenire un umano su estrazioni incerte (notizie, cambi di partito, claim) senza cancellare la traccia della rettifica.

**Non** è auto-apprendimento online delle percentuali. «Aggiornamento» = riacquisizione fonti + ricalcolo con formula fissa (e, se presente, ricalcolo del briefing con vincolo `computationId`).

---

## 2. Dove si vede nell’interfaccia

### 2.1 Preview (colonna Scenario)

Componente: `ScenarioGrowthForecastPanel.tsx`  
Sottocomponente compact: `ForecastSidebarCompact` (`ForecastOperationalBlocks.tsx`)

Mostra:

- etichetta **02 // PREVISIONE DI CRESCITA**
- consenso di partenza e valori agli orizzonti 30g / 90g / Maggio
- nota regionale opzionale (proporzionale al dato nazionale, se c’è focus regione)
- CTA per aprire il report a schermo pieno

Comportamento refresh browser-side:

- fetch a `GET /api/forecast/growth` ~350 ms dopo cambio di S / regime
- ripetizione ogni **15 minuti** se la pagina è visibile
- refresh anche su `visibilitychange` / `focus`
- in errore: restano gli ultimi dati disponibili + messaggio di stato

> Nota epistemologica: questo ciclo è legato alla **finestra aperta**. La continuità indipendente dal browser è sul cron `GET /api/cron/system-monitor` (ogni 15′ via `vercel.json`), protetto da `CRON_SECRET`.

### 2.2 Report a schermo pieno («workspace editoriale»)

Componente: `GrowthForecastReport.tsx`  
CSS principali: `forecast-workspace.css`, `forecast-dossier.css`, `forecast-material.css`, `forecast-evidence-lab.css`

Layout tipico:

| Zona | Contenuto |
| --- | --- |
| Topbar compatta | Torna allo Scenario · titolo · Stratega · refresh · tema |
| Sezione **Previsione** | Hero KPI + grafico outlook + Evidence Lab + report calibrazione + eventi |
| Sezione **Dettaglio** | Stratega (briefing + chat drawer) + drawer tecnico (fattori, what-if, simulazioni) |

Chiusura: Esc o «← Scenario».

### 2.3 Telemetria globale fonti

`CoverageTelemetryPanel` (montato da `DashboardShell`) sostituisce diciture ambigue tipo «Aggiornamento automatico attivo». Per ogni fonte espone:

- ultimo controllo effettuato
- ultimo contenuto nuovo acquisito
- ultimo ricalcolo / versione metodo
- **Coverage Manifest** (quanti elementi considerati sul totale rilevato; fallback BCE dichiarato)

---

## 3. Architettura a strati

```text
Scenario (S, regioni, flussi)
        │
        ▼
ScenarioGrowthForecastPanel
   ├─ computeForecastV4 / forecastHorizon     ← motore numerico
   ├─ GET /api/forecast/growth               ← evidence + narrative opzionale
   └─ GrowthForecastReport
        ├─ ForecastHeroSplit / outlook chart
        ├─ ForecastEvidenceLab               ← sondaggi, backtest, ledger, supervisione
        ├─ calibrationReport UI              ← walk-forward 30g
        ├─ ForecastEventsPanel               ← calendario / fallback
        └─ ForecastStrategistPanel
             ├─ POST /api/ai/forecast-briefing
             └─ POST /api/ai/strategist-chat (SSE)
```

Strati di supporto trasversali:

| Strato | Ruolo |
| --- | --- |
| `computationFingerprint.ts` | Hash deterministico `computationId` |
| `decisionLedger.ts` + schema Drizzle | Memoria append-only (Postgres o `.ledger/`) |
| `coverageManifest.ts` | Dichiarazione perimetro informativo |
| `forecastCalibrationEngine.ts` + `calibrationReport.ts` | Bias/damping + confronto out-of-sample |
| `epistemicStatus.ts` + `EpistemicBadge` | Stati epistemologici + coda umana |

---

## 4. Motore V4 — formula e fattori

**File:** `src/lib/engine/forecastEngineV4.ts`  
**ID:** `FN_FORECAST_V4`

### 4.1 Identità del risultato

```text
S(t) = S0 + Σ contributi_fattore_i   (± cono di incertezza lo10–hi90)
```

I contributi sono arrotondati al centesimo con metodo dei resti: **la somma delle righe + S0 coincide col risultato mostrato**.

### 4.2 Orizzonti e scenari

| Chiave | Significato tipico |
| --- | --- |
| `d30` | ~30 giorni |
| `d90` | ~90 giorni |
| `d180` | Maggio 2027 / ~180 giorni (in UI spesso etichettato «Maggio 2027») |

Scenari: `passivo` · `base` · `offensiva` (`FORECAST_SCENARIO_ORDER`).

What-if di rete: `ForecastNetworkDelta = { comitati, tesserati }`.

### 4.3 Sette fattori additivi (+ cono)

| # | ID | Contenuto sintetico |
| --- | ---: | --- |
| 1 | `momentum` | Pendenza filtrata (Kalman local-level + effetto istituto) e rientro verso livello filtrato |
| 2 | `agenda` | Salienza × possesso temi × copertura B.I.P. × elasticità |
| 3 | `donor` | Bacini contendibili FdI/Lega (costo del governare, crisi alleati) |
| 4 | `ground` | Rete territorio (tesserati, comitati, entropia) |
| 5 | `magnet` | Magnete istituzionale (presenze, what-if, profili «+ Simula») |
| 6 | `cycle` | Ciclo elettorale (manovra, inverno, mobilitazione dall’astensione) |
| 7 | `bounds` | Pavimento convesso e tetto di assorbimento |
| 8 | *(cono)* | Incertezza sondaggi / storia / modello |

Costanti di riferimento (estratto):

- Momentum: finestre 21/60 giorni, τ inerzia 28g, cap ±1,5 pp  
- Agenda: yield max 0,4 pp, τ priming 75g  
- Costo del governare: ~0,64 pp/anno (Nannestad–Paldam)  
- Rete: 1 voto / 20 contatti (riferimento Gerber–Green)  
- Magnete: 2.000 voti per punto carica istituzionale  
- Soft floor: 6,8%  
- Cono: z≈1,28 (80%), esponente orizzonte 0,55  

Provenienza per riga: `dati` | `ipotesi` | `misto`, con `sources[]` e testo `plain` per non-tecnici.

### 4.4 Funzioni chiave

| Funzione | Ruolo |
| --- | --- |
| `computeForecastV4(input)` | Calcolo completo multi-scenario |
| `forecastV4AtDays` / `forecastHorizon` | Orizzonte singolo |
| `forecastV4Regional` | Discesa regionale |
| `walkForwardBacktestV4` | Verifica storica V4 vs flat |
| `factorPp(horizon, id)` | Lettura contributo di un fattore |
| `forecastRegionsFromScenario` | Bridge da righe scenario + poll |

### 4.5 Percorso legacy `growthTrajectory`

Ancora usato per evidence/proiezioni mese e bridge API:

- `growthTrajectory.ts` — `projectMonths`, pendenza smorzata, shock notizie, B.I.P., stagione  
- `growthEvidence.ts` — filtro titoli, score, fonti  
- `growthNarration.ts` — paragrafo AI opzionale (non altera le %)  
- `partyGrowthForecast.ts` — collegamento scenario / badge / ventaglio  

La preview e parti del report possono ancora citare questi componenti; **il dossier decisionale e lo Stratega sono vincolati a V4 + fingerprint**.

---

## 5. Consenso statistico e calibrazione

### 5.1 `nationalConsensusForecast.ts`

Costruisce un riferimento «solo dati» (flat vs tendenza smorzata) con selezione walk-forward:

- se i casi validati sono pochi o il vantaggio MAE della tendenza è &lt; 5%, resta **`flat`** (consenso invariato);
- non confonde serie sondaggi aggregati e Supermedia come campioni indipendenti;
- può aggiungere eventi con effetto stimato (`fitNationalEventEffects`), senza pretendere causalità;
- espone `calibration` / `calibrationReport`.

### 5.2 `forecastCalibrationEngine.ts` + `calibrationReport.ts`

Produce un oggetto ispezionabile:

- parametri attivi: `biasCorrection`, `damping`
- osservazioni su cui sono stimati
- confronto **solo a 30 giorni** tra:
  - Metodo non calibrato  
  - Metodo calibrato  
  - Riferimento consenso invariato  
- metriche: MAE numerica + accuratezza di direzione  
- `walkForward90d` / `walkForward180d` = **`null`** (divieto di estendere metriche 30g)

Se la calibrazione **non** batte il riferimento fuori campione:

- `appliedToPrimary = false`
- `experimentalOnly = true`  
→ non viene spacciata come correzione «ufficiale» sul valore principale.

Tie-break MAE: a parità preferisce `consensus_invariant`.

---

## 6. Evidence, eventi e copertura

### 6.1 Evidence Lab

`ForecastEvidenceLab.tsx` — tab:

| Tab | Natura |
| --- | --- |
| Sondaggi | Osservazioni istituzionali vs stima attuale |
| Verifica storica | Confronti walk-forward V4 |
| Sessione | Diff **volatile** client-side (si azzera alla chiusura) |
| Ledger | Snapshot **immutabili** server-side |
| Supervisione | Coda umana su titoli del payload |

### 6.2 Calendario / eventi nazionali

- `nationalForecastEventFeed.ts` — feed ufficiale se raggiungibile; altrimenti **catalogo locale**
- Campo obbligatorio: `usedFallback: boolean`
- UI: `ForecastEventsPanel` dichiara esplicitamente se è live o ripiego (`usedFallback: true — non live`)

### 6.3 Coverage Manifest

`coverageManifest.ts` + `GET /api/coverage/manifest`

Esempio di dichiarazione attesa:

> Considerati 24 titoli su X rilevati nella finestra [inizio – fine]; Y esclusi per fuori-tema / duplicazione / supervisione.  
> Calendario BCE: feed ufficiale **oppure** catalogo locale di ripiego (`usedFallback: true`).

---

## 7. Coerenza atomica stato ↔ sintesi (`computationId`)

**File:** `src/lib/engine/computationFingerprint.ts`

Il `computationId` è un hash deterministico (FNV-1a 64-bit → `cmp_…`) su payload canonico che include, tra l’altro:

- `engineVersion` / `calibrationVersion`
- `consensusValue` + `pollsLastUpdated`
- `scenarioMode`, `horizonDays`, `flowMatrixId`
- `whatIf` (comitati/tesserati)
- `evidenceDigest` (titoli + esclusioni supervisione)

### Flusso anti-race (Stratega)

1. Client calcola `activeComputationId` e lo manda a `/api/ai/forecast-briefing`.
2. Server ricalcola e **obbliga** `briefing.computationId`, `generatedAt`, `inputSummary` nella risposta.
3. UI usa `AbortController` + `requestSeq`.
4. Se `briefing.computationId !== activeComputationId` → stato:

   **«Sintesi non allineata agli input correnti (riferita a elaborazione precedente)»**

   con CTA «Ri-allinea sintesi». Testo vecchio e numeri nuovi non sono presentati come stessa elaborazione.

### Stati di freschezza del dato

| Stato | Etichetta UI |
| --- | --- |
| `PROVVISORIO` | Provvisorio (in caricamento) |
| `MANCANTE` | Mancante / fonte non disponibile |
| `PRECEDENTE` | Precedente (cache / storico) |
| `AGGIORNATO` | Aggiornato |
| `NON_ALLINEATO` | Sintesi non allineata… |

---

## 8. Memoria immutabile (ledger append-only)

### 8.1 Schema (`src/lib/db/schema.ts`)

1. **`decision_ledger_snapshots`**  
   `computation_id`, `emitted_at`, `engine_version`,  
   `calibration_state_json`, `inputs_manifest_json`, `assumptions_json`,  
   `outputs_json` (mai sovrascritto), `subsequent_outcome_json` (compilabile a posteriori).

2. **`source_ingestion_log`**  
   Per fonte: `checked_at`, `last_new_item_at`, fetched/accepted/rejected, `used_fallback`, errori, `trigger_type` ∈ `cron` | `manual` | `page_lifecycle`.

3. **`supervision_audit_log`**  
   `entity_type` ∈ `news_item` | `party_switch` | `event` | `claim`,  
   transizione di stato, nota, timestamp.

### 8.2 Storage

- Con `DATABASE_URL`: Postgres via Drizzle.  
- Senza DB (dev locale): file strutturati in **`.ledger/`**.  
- La UI dichiara sempre lo storage attivo (`postgres` | `file`).

API:

- `GET/POST /api/ledger/snapshots`
- `GET/POST /api/ledger/supervision`
- `GET/POST /api/ledger/ingestion` (telemetria ingestion)

### 8.3 Cron system-monitor

`GET /api/cron/system-monitor` (schedule `*/15 * * * *` in `vercel.json`):

- interroga fonti secondo cadenze
- scrive `source_ingestion_log`
- archivia snapshot giornaliero immutabile se rileva nuove osservazioni

---

## 9. Stratega AI

### 9.1 Briefing

- UI: `ForecastStrategistPanel.tsx`
- Generazione: `lib/ai/strategistAgent.ts`
- Endpoint: `POST /api/ai/forecast-briefing`

Payload tipico in uscita:

- `tesi`, `priorita[]` (azione / perché / regioni / leva B.I.P.), `rischi[]`
- `computationId`, `generatedAt`, `inputSummary`
- badge epistemologico di default sul testo: **INTERPRETAZIONE / IPOTESI DI SCENARIO**

### 9.2 Chat streaming

- `POST /api/ai/strategist-chat` (SSE)
- drawer laterale, chip rapide, tool-use lato server
- stesso vincolo di contesto del briefing (`computationId` / input correnti)

Il copy editoriale nell’UI ammorbidisce gergo motore («ground», «V4», «fallback deterministico», …) senza alterare i numeri.

---

## 10. Stati epistemologici e supervisione umana

**File:** `epistemicStatus.ts`, UI `EpistemicBadge.tsx`

| Codice | Etichetta | Quando |
| --- | --- | --- |
| `FATTO_DOCUMENTATO` | Fatto documentato | Fonte primaria / atto diretto verificato |
| `ESTRAZIONE_DA_VERIFICARE` | Estrazione automatica da verificare | Matching NLP / confidenza media |
| `INTERPRETAZIONE_IPOTESI` | Interpretazione / ipotesi di scenario | Conclusioni e claim di scenario |
| `DATI_INSUFFICIENTI_CONTRADDIZIONE` | Dati insufficienti / contraddizione | Conflitto o bassa confidenza |

Azioni rapide su estrazioni:

- **Conferma pertinenza**
- **Escludi elemento**
- **Segnala errore**

Effetti:

1. Append in `supervision_audit_log` (storico intatto).
2. Aggiornamento `activeExclusions`.
3. Scomparsa dai conteggi / feed attivi (Evidence Lab, Rassegna stampa).
4. Nuovo `computationId` → briefing e report si riallineano in modo tracciabile.

ID stabili (hash): `newsEntityId`, `partySwitchEntityId`, `claimEntityId`.

Superfici collegate: Evidence Lab (tab Supervisione), `RassegnaStampaDefezioniPanel` (notizie + passaggi).

---

## 11. Mappa file (riferimento rapido)

### UI

| File | Ruolo |
| --- | --- |
| `components/ScenarioGrowthForecastPanel.tsx` | Preview colonna + refresh 15′ |
| `components/GrowthForecastReport.tsx` | Workspace report completo |
| `components/ForecastStrategistPanel.tsx` | Briefing + chat + anti-stale |
| `components/ForecastEvidenceLab.tsx` | Sondaggi / backtest / ledger / supervisione |
| `components/ForecastOperationalBlocks.tsx` | Hero, sidebar compact, blocchi operativi |
| `components/ForecastEventsPanel.tsx` | Eventi + disclosure fallback |
| `components/ForecastPredictiveVisuals.tsx` | Grafici predittivi |
| `components/ForecastV4Views.tsx` | Viste fattori V4 |
| `components/CoverageTelemetryPanel.tsx` | Telemetria & copertura fonti |
| `components/EpistemicBadge.tsx` | Badge + controlli supervisione |
| `components/RassegnaStampaDefezioniPanel.tsx` | Supervisione su news/passaggi |

### Motore / dati

| File | Ruolo |
| --- | --- |
| `lib/engine/forecastEngineV4.ts` | Motore V4 |
| `lib/engine/nationalConsensusForecast.ts` | Riferimento consenso + eventi |
| `lib/engine/forecastCalibrationEngine.ts` | Calibrazione adattiva |
| `lib/engine/calibrationReport.ts` | Report walk-forward ispezionabile |
| `lib/engine/computationFingerprint.ts` | `computationId` |
| `lib/engine/coverageManifest.ts` | Manifesto copertura |
| `lib/engine/nationalForecastEventFeed.ts` | Feed eventi / fallback |
| `lib/engine/growthTrajectory.ts` | Proiezione mese (legacy/bridge) |
| `lib/engine/growthEvidence.ts` | Evidence notizie |
| `lib/engine/growthNarration.ts` | Narrativa opzionale |
| `lib/engine/partyGrowthForecast.ts` | Bridge scenario |
| `lib/engine/epistemicStatus.ts` | Tassonomia epistemologica |
| `lib/ai/strategistAgent.ts` | Briefing / agent tools |
| `lib/db/decisionLedger.ts` | Persistenza ledger |
| `lib/db/schema.ts` | Tabelle Drizzle |

### API

| Endpoint | Ruolo |
| --- | --- |
| `GET /api/forecast/growth` | Evidence + narrative growth |
| `POST /api/forecast-intelligence` | Intelligence mensile / B.I.P. |
| `POST /api/ai/forecast-briefing` | Briefing vincolato a `computationId` |
| `POST /api/ai/strategist-chat` | Chat SSE Stratega |
| `GET /api/coverage/manifest` | Manifesto copertura |
| `GET /api/cron/system-monitor` | Monitor fonti + snapshot |
| `GET/POST /api/ledger/snapshots` | Ledger previsioni |
| `GET/POST /api/ledger/supervision` | Audit supervisione |
| `GET/POST /api/ledger/ingestion` | Log ingestion |

### Test obbligatori (Vitest)

`src/lib/engine/decisionSupportWorkstreams.test.ts` verifica:

1. Invarianza / anti-stale `computationId`
2. Riproducibilità point-in-time snapshot ledger
3. Disclosure `usedFallback` calendario
4. Propagazione supervisione (conteggi attivi vs audit)
5. Classificazione badge epistemologici
6. Walk-forward calibrazione senza leakage 90/180

Altri suite correlate: `forecastEngineV4.test.ts`, `nationalConsensusForecast.test.ts`, `nationalForecastEvents.test.ts`, `growthTrajectory.test.ts`, `strategistAgent.test.ts`.

---

## 12. Flusso utente tipico

1. Nello Scenario si legge S (live o impostato).
2. La preview mostra 30 / 90 / Maggio da V4.
3. Si apre il report → hero + grafico + Evidence Lab.
4. Si ispeziona calibrazione 30g e, se presente, fallback eventi.
5. Si escludono titoli fuori tema → cambia `computationId`.
6. Si genera / ri-allinea il briefing Stratega sullo stesso `computationId`.
7. Si archivia uno snapshot nel Ledger (o lo fa il cron).
8. In un secondo momento un revisore riapre lo snapshot **identico**, anche se nel frattempo sono arrivati nuovi sondaggi.

---

## 13. Limiti dichiarati (da non nascondere in UI)

- L’aggiornamento a 15′ **in pagina** non equivale da solo a monitoraggio 24/7; il cron server-side è il pezzo autonomo.
- Le metriche di calibrazione **non** si estendono da 30 a 90/180 giorni.
- Il cono di incertezza è indicativo; la copertura all’80% non è dimostrata su campioni radi.
- Il briefing AI è **interpretazione**, non fatto documentato.
- Senza `DATABASE_URL` la memoria vive in `.ledger/` (adeguato al dev, non a produzione multi-istanza).
- Titoli considerati nella sintesi: tipicamente **primi 24** del payload, con esclusione esplicita nel manifesto / supervisione.

---

## 14. Documenti correlati

| Documento | Contenuto |
| --- | --- |
| `docs/PREVISIONE-CRESCITA-FUNZIONAMENTO-UI.md` | UI storica (trajectory / mese-per-mese) |
| `docs/PREVISIONE-CRESCITA-CODICE.md` | Dump codice storico `growthTrajectory` |
| `ANALISI_CORE_DECISIONALE_2026-11-10.md` (repo root) | Valutazione requisiti decisionali §1–12 |
| Questo file | **Vista unica aggiornata** della sezione Previsione di crescita |

---

*Fine documento — Previsione di crescita (completa).*
