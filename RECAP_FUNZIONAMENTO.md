# Recap — Futuro Nazionale: modello v3.2 e piattaforma web

Documento di riferimento (ottobre 2026) su **cosa fa il sistema**, **come si calcola lo scenario**, **come usare file/Python**, **come funziona la piattaforma** e **come è deployata su Vercel**.

---

## 1. Qualificazione (leggere sempre)

| Affermazione | Stato |
|--------------|--------|
| Previsione elettorale validata | **No** (`predizione_validata: false`) |
| Dati iscritti / organizzazione | Forniti dal committente, **non certificati** in modo indipendente |
| Ripartizione territoriale simulata | **Non** equivale a un sondaggio regionale |
| Diff. media scenario vs benchmark (~0,98 pp) | Confronto **diagnostico**, non “errore predittivo” |
| Intervalli Monte Carlo (lo10–hi90) | **Sensibilità** ai pesi, non copertura predittiva certificata |
| Validazione ex post | **In attesa** di esiti elettorali completi e comparabili (20 regioni) |

---

## 2. Pacchetto originale v3.2 (cartella radice)

### 2.1 File principali

| File | Ruolo |
|------|--------|
| `LEGGIMI_INIZIA_QUI.txt` | Nota introduttiva, novità v3.2, comandi Python |
| `modello_fn_v3_2.py` | Motore di calcolo (stdlib, nessuna dipendenza esterna) |
| `config_v3_2.json` | Input: iscritti, preferenze, pesi, flussi Ipsos, Monte Carlo, S=7,2% |
| `eu2024.json` | Voti validi e quote FdI/Lega 2024 per regione |
| `risultati_v3_2.json` | Output precalcolato del motore |
| `scenario_congelato_18-10-2026.json` | Snapshot **immutabile** ex ante (post-voto / storico) |
| `storico_iscritti_TEMPLATE.csv` | Template monitoraggio mensile iscritti |
| `esiti_futuri_TEMPLATE.csv` | Template esiti elettorali futuri |
| `SHA256_CHECKSUM.txt` | Integrità byte-per-byte del pacchetto distribuito |
| `VERIFICA_TECNICA_v3.2.txt` | Registro verifica del 18/10/2026 |

PDF ed Excel citati nel LEGGIMI possono non essere presenti in ogni copia della cartella; il motore riproducibile è **Python + JSON**.

### 2.2 Comandi Python (dalla cartella radice)

```bash
python modello_fn_v3_2.py --output risultati_ricalcolati.json
python modello_fn_v3_2.py --storico storico_iscritti_TEMPLATE.csv --output storico.json
python modello_fn_v3_2.py --snapshot scenario_congelato_18-10-2026.json --esiti esiti_finali.csv --output validazione_post_voto.json
python modello_fn_v3_2.py --crea-template
```

---

## 3. Logica del modello (20 regioni)

### 3.1 Regioni e circoscrizioni

- **20 regioni** in ordine fisso (Piemonte → Sardegna).
- **5 circoscrizioni** per le preferenze: NO, NE, C, S, I (4+4+4+6+2 regioni).

### 3.2 Input principali (`config_v3_2.json`)

- **S** (`sondaggio_nazionale`): quota nazionale di riferimento (es. 0,072 = 7,2%).
- **Iscritti per regione** + totali dichiarati (158 320) vs somma regionalizzata (156 456 → gap da monitorare).
- **Preferenze**: totali e ripartizione per circoscrizione; **Lombardia e Sardegna osservate**, altre **ricostruite** via quote Lega nel resto della circoscrizione.
- **Affluenza 2024** per regione → ricostruzione elettori e astensione.
- **Flussi Ipsos** (FdI, Lega, ast) + residuo “altri” sulla geografia del voto 2024.
- **Presenze istituzionali** (dep, creg, sind, com) con punteggi e `lambda_istituzionale` (30).
- **Pesi** del mix: flussi 35%, preferenze 25%, iscritti 25%, istituzioni 15%.

### 3.3 Costruzione dello scenario

Per ogni regione `r`:

1. **q** = quota elettorato 2024 (voti validi normalizzati).
2. **f** = indice flussi (mix Ipsos su FdI/Lega/ast/altri pesato su q).
3. **v** = preferenze normalizzate.
4. **s** = iscritti normalizzati.
5. **m** = istituzioni (punteggi + smoothing verso q).
6. **p** = mix pesato: `p = w_flussi·f + w_pref·v + w_isc·s + w_ist·m` (normalizzato).
7. **b** = benchmark = normalizzazione (FdI + Lega) 2024.

**Stima % regione:** `stima = S · p / q`  
**Benchmark % regione:** `benchmark = S · b / q`  
**Voti scenario:** `S · p · V` (V = validi 2024 totali).

### 3.4 Monte Carlo (sensibilità)

- Seme fisso (42), N simulazioni (20 000).
- Per ogni simulazione: pesi campionati (Dirichlet via `gammavariate`), S perturbato (`gauss`), si ricostruisce la distribuzione → **lo10 / hi90** per stima % regionale.
- Anche **min_pesi / max_pesi** da scenari alternativi (pesi uguali, solo flussi, ecc.).

### 3.5 Metriche

- **H**: entropia normalizzata (dispersione territoriale) su elettorato, iscritti, scenario, benchmark, componenti.
- **KL / JS**: divergenze tra scenario, benchmark, iscritti ed elettorato.
- **Diff. media ponderata scenario–benchmark (pp)**: ~0,976 (diagnostica).
- Valori di riferimento verifica: H iscritti **0,898449**, H scenario **0,884337**, H elettorato **0,886090**.

### 3.6 Post-voto (`evaluate`)

Con CSV 20 righe (`regione`, `voti_validi`, `voti_fn`):

- Usa **solo** lo **snapshot congelato** come previsione ex ante.
- Calcola MAE/RMSE ponderati, skill vs benchmark, copertura intervalli sensibilità.
- Avvertenza: comparabilità del risultato elettorale (FN con simbolo proprio, ecc.).

### 3.7 Storico iscritti (`parse_history`)

CSV `mese,regione,iscritti`:

- Mesi **completi** (20 regioni): H, ΔH, JS vs mese precedente.
- Con snapshot: **H scenario condizionato** (aggiorna solo componente iscritti, resto congelato).

---

## 4. Piattaforma web (`platform/`)

### 4.1 Path

```
C:\Users\User\Desktop\FN_v3_2_FINAL\platform
```

### 4.2 Stack

| Componente | Tecnologia |
|------------|------------|
| Frontend / SSR | Next.js 16 (App Router), React 19, Tailwind |
| Motore | TypeScript in `src/lib/engine/` |
| RNG Monte Carlo | `python-random` + `gauss` / `gammavariate` allineati a CPython |
| Test | Vitest — golden test vs `data/risultati_v3_2.json` |
| Auth | Auth.js v5, credentials + allowlist email |
| Deploy | Vercel (progetto **platform**) |

### 4.3 Struttura codice

```
platform/
  data/                          # config, eu2024, risultati golden, snapshot
  src/
    app/
      page.tsx                   # redirect → /dashboard o /login
      login/page.tsx             # form accesso
      dashboard/page.tsx         # calcolo + UI
      api/auth/[...nextauth]/    # Auth.js
    lib/engine/
      calculate.ts               # motore principale
      constants.ts, math.ts, types.ts
      pythonDistributions.ts     # gauss / gammavariate
      loadData.ts                # lettura JSON da data/
      golden.test.ts
    components/                  # Dashboard, mappa, tabella, disclaimer
    auth.ts                      # configurazione Auth.js
    middleware.ts                # protezione /dashboard
```

### 4.4 Flusso utente

```mermaid
flowchart LR
  A[Utente] --> B{/login}
  B -->|email in allowlist + password| C[Sessione JWT]
  C --> D[/dashboard]
  D --> E[runDefaultScenario]
  E --> F[calculate config + eu2024]
  F --> G[Metriche + mappa + tabella]
```

1. Apertura URL → redirect a **login** se non autenticati.
2. **Email** deve essere in `ALLOWLIST_EMAILS` (env, minuscolo, trim).
3. **Password** = valore di `PLATFORM_PASSWORD` (env).
4. Dashboard: ricalcolo server-side (20k sim MC) e rendering.

### 4.5 Dashboard (tab)

Navigazione: **Scenario & Sensibilità** · **Storico Iscritti** · **Validazione Post-Voto**.

**Scenario & Sensibilità**

- Banner **disclaimer**; badge **SCENARIO PERSONALIZZATO (NON UFFICIALE)** se S/pesi ≠ default v3.2.
- Slider **S** (1–20%) e pesi mix (normalizzati dal motore); preset e **Ripristina Default (v3.2)**.
- Ricalcolo: deterministico immediato (`nSim=0`), Monte Carlo 20k con debounce 300 ms (`POST /api/scenario`).
- Mappa choropleth da **`/geo/regioni-italia.geojson`** (locale, ex Openpolis).
- Tabella regioni; **Esporta Nota Dirigenza (PDF)** via stampa browser (`@media print`).

**Storico Iscritti**

- Upload CSV (`mese,regione,iscritti`); template in `/templates/storico_iscritti_TEMPLATE.csv`.
- Motore `parseHistory()` vs snapshot congelato → H, ΔH, JS, H scenario condizionato.

**Validazione Post-Voto**

- Upload CSV 20 righe (`regione,voti_validi,voti_fn`); template in `/templates/esiti_futuri_TEMPLATE.csv`.
- Motore `evaluatePostVote()` **solo** su `scenario_congelato_18-10-2026.json` → MAE, RMSE, skill, copertura lo10–hi90.

**Auth:** sign out → login.

### 4.6 Variabili d’ambiente

| Variabile | Obbligatoria | Descrizione |
|-----------|--------------|-------------|
| `AUTH_SECRET` | Sì | Secret Auth.js (≥ 32 caratteri casuali) |
| `ALLOWLIST_EMAILS` | Sì | Email autorizzate, separate da virgola |
| `PLATFORM_PASSWORD` | Sì | Password condivisa per lo staff (interna) |

File esempio: `platform/.env.example`  
Sviluppo locale: `platform/.env.local` (non committare).

### 4.7 Comandi sviluppo

```bash
cd platform
npm install
npm run test          # parità motore vs golden JSON
npm run dev           # http://localhost:3000
npm run build
```

---

## 5. Deploy Vercel

| | |
|---|---|
| **URL produzione** | https://platform-sigma-beige.vercel.app |
| **Alias alternativo** | https://platform-ionspinu29-4320s-projects.vercel.app |
| **Progetto** | https://vercel.com/ionspinu29-4320s-projects/platform |
| **Env vars** | Settings → Environment Variables → **Redeploy** obbligatorio dopo modifica |

**Sintomi se mancano le env:**

- Pagina login visibile (HTTP 200) ma **login fallisce** o API auth in errore (es. 400 senza `AUTH_SECRET`).

**Deployment Protection (opzionale Vercel):** se compare login Vercel prima del form FN, disattivare o autorizzare in Settings → Deployment Protection.

**Redeploy da CLI:**

```bash
cd platform
npx vercel deploy --prod
```

---

## 6. Parità Python ↔ TypeScript

- Il motore TS replica `modello_fn_v3_2.py` per metriche deterministiche e Monte Carlo (seme 42, 20 000 sim).
- Test: `platform/src/lib/engine/golden.test.ts` vs `platform/data/risultati_v3_2.json`.
- Dati seed in `platform/data/` copiati dalla radice del pacchetto v3.2.

---

## 7. Funzionalità piattaforma e roadmap

### Implementate

1. **Sensibilità live** — slider S e pesi, preset, ripristino v3.2, MC debounced (250 ms), API `/api/scenario`.
2. **Simulatore sondaggio regionale** — modulo `regionalPoll.ts`: SE campionario + SE modello (MC), MoE, IC, prob. soglia, classificazione Sicura/Contesa/Critica; UI con controlli campione/soglia/affluenza, mappa multi-metrica, drawer regionale; API `/api/regional-poll`.
3. **Storico iscritti** — `historyAndEval.ts` → `parseHistory`, tab CSV, test vs Python.
4. **Post-voto** — `evaluatePostVoteWithPoll` (MAE/RMSE/skill + copertura forbice sondaggio), tab esiti.
5. **Export PDF** — Nota Demoscopica & Scenario Dirigenza (stampa A4).
6. **GeoJSON locale** — `public/geo/regioni-italia.geojson`.
7. **Locali & News (MVP)** — tab dashboard: registro comuni/cariche FN (`locali_registry.json`), rollup su `presenze_istituzionali` in `config_v3_2.json` → `istituzioniDelta` (motore `localInstitutions.ts`); toggle **Applica al scenario** passa il delta a `POST /api/scenario` **senza** alterare il golden default. Scan RSS rule-based (`newsIngest.ts`, catalogo `newsFeedCatalog.ts`, `POST /api/news/scan`) con revisione umana obbligatoria — **nessuna** auto-scrittura al registro. **Feed predefiniti** (se `NEWS_RSS_URLS` assente): ANSA politica/cronaca, AGI, Rai, Repubblica, Adnkronos, Sole 24 Ore, Quotidiano.net, ANSA per tutte e 20 le regioni, campioni CityToday/Repubblica local. Override opzionale via env. Persistenza registro: export/import JSON in UI. Env opz.: `NEWS_RSS_URLS`, `NEWS_KEYWORDS`, `NEWS_SCAN_MAX_ITEMS`.

**Disclaimer operativo (news/locali):** titoli RSS e keyword **non sono verificati**; collegamento comune/regione manuale; output scenario con delta istituzionale resta **descrittivo** (`predizione_validata: false`).

### Roadmap futura

1. **News avanzate**: NER/LLM o servizio esterno, geocoding comune → regione.
2. **Snapshot DB**: versioni congelate, diff, audit trail (Neon + Drizzle).

---

## 8. Checklist operativa rapida

**Solo modello (Python):**

- [ ] `config_v3_2.json` e `eu2024.json` aggiornati
- [ ] `python modello_fn_v3_2.py` → verifica H iscritti / H scenario
- [ ] Post-voto: snapshot congelato + CSV 20 regioni complete

**Piattaforma locale:**

- [ ] `.env.local` con AUTH_SECRET, ALLOWLIST_EMAILS, PLATFORM_PASSWORD; opz. `NEWS_RSS_URLS` per scan feed
- [ ] `npm run test` verde
- [ ] `npm run dev` → login → dashboard

**Piattaforma Vercel:**

- [ ] Tre env in Production (+ redeploy)
- [ ] Login con email in allowlist
- [ ] Dashboard carica mappa e tabella

---

## 9. Contatti dati e responsabilità

- Interpretazione **descrittiva / scenario sperimentale**; decisioni politiche non devono basarsi su questo output come unico sondaggio.
- Aggiornamenti iscritti **non provano** crescita del consenso senza verifica elettorale indipendente.
- Hash SHA256 del pacchetto v3.2 = integrità file, **non** prova di data di creazione.

---

*Ultimo aggiornamento recap: piattaforma v3.2 con sensibilità, storico, post-voto, export PDF, GeoJSON locale, tab Locali & News (MVP).*
