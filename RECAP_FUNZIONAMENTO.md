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

### 4.1 Repository e cartelle

| Risorsa | Percorso |
|---------|----------|
| **Repository GitHub** | https://github.com/IonSpinu02/FN-v3-2-FINAL |
| **App Next.js** | cartella `platform/` nel repo (su Vercel: **Root Directory** = `platform`) |
| **Dati motore (seed)** | `platform/data/` — copia allineata ai JSON in radice |
| **Documentazione** | `RECAP_FUNZIONAMENTO.md` (questo file), `REPORT_TECNICO_COMPLETO.md`, `README.md` |

### 4.2 Stack

| Componente | Tecnologia |
|------------|------------|
| Frontend / SSR | Next.js 16 (App Router), React 19, Tailwind |
| Motore | TypeScript in `src/lib/engine/` |
| RNG Monte Carlo | `python-random` + `gauss` / `gammavariate` allineati a CPython |
| Test | Vitest — golden test vs `data/risultati_v3_2.json` |
| Auth | Auth.js v5, credentials + allowlist email |
| Deploy | Vercel (progetto **platform**) |

### 4.3 Struttura codice (sintesi)

```
platform/
  data/
    config_v3_2.json, eu2024.json, risultati_v3_2.json
    scenario_congelato_18-10-2026.json
    locali_registry.json, locali_events.json   # seed registro locali (read-only su server)
  public/geo/regioni-italia.geojson
  public/templates/                            # CSV per storico, post-voto, registro locali
  src/app/
    login/, dashboard/
    api/scenario/          # POST: S, pesi, nSim, includePoll, overrides (istituzioniDelta, …)
    api/regional-poll/
    api/locali/registry/   # GET seed registro + eventi
    api/locali/compute-delta/
    api/news/scan/         # POST: scan RSS → candidati (sessione richiesta)
    api/auth/[...nextauth]/
  src/lib/engine/
    calculate.ts           # motore + CalculateOverrides
    localInstitutions.ts   # rollup registro → istituzioniDelta
    newsIngest.ts, newsFeedCatalog.ts
    regionalPoll.ts, historyAndEval.ts, golden.test.ts, …
  src/components/
    DashboardClient.tsx    # tab sidebar + integrazione scenario/locali
    LocaliPanel.tsx, NewsReviewPanel.tsx, …
  auth.ts, middleware.ts
```

**Vincolo golden:** `calculate(cfg, eu)` **senza** override resta identico al pacchetto v3.2; test `golden.test.ts` sempre verde. Adeguamenti (S, pesi, delta istituzionale, flussi Ipsos) passano **solo** via `CalculateOverrides` nelle API.

### 4.4 Flusso utente e API

```mermaid
flowchart LR
  A[Utente] --> B{/login}
  B -->|allowlist + PLATFORM_PASSWORD| C[Sessione Auth.js]
  C --> D[/dashboard]
  D --> E[POST /api/scenario]
  E --> F[calculate + optional overrides]
  F --> G[Mappa metriche PDF]
  D --> H[Tab Locali e News]
  H --> I[POST /api/news/scan]
  I --> J[Revisione umana registro]
  J --> K[istituzioniDelta opzionale]
  K --> E
```

1. Apertura URL → **login** se non autenticati (`middleware` su `/dashboard`).
2. **Email** in `ALLOWLIST_EMAILS` (virgola, trim, confronto case-insensitive).
3. **Password** = `PLATFORM_PASSWORD` (env, non committare).
4. Le route API di calcolo (`/api/scenario`, `/api/regional-poll`, `/api/news/scan`, `/api/locali/*`) richiedono **sessione** (`requireSession()`).
5. Dashboard: stato client (S, pesi, sondaggio simulato) → `POST /api/scenario` con `includePoll: true`; debounce MC ~250 ms (20k sim).

### 4.5 Dashboard (tab sidebar)

Navigazione: **Scenario** · **Locali & News** · **Storico iscritti** · **Post-voto**.

**Scenario**

- Disclaimer; badge **Scenario personalizzato** se S/pesi ≠ ufficiale v3.2 **oppure** se è attivo l’adeguamento istituzionale da registro locali.
- Slider **S** e pesi (preset, ripristino default); pannello **Provenienza Flussi (FdI / Lega / Astensione)** con preset Ipsos v3.2 / Ex-Lega / Astensione; invio `flussi_ipsos` a `/api/scenario` solo se diversi dal default golden.
- Controlli **sondaggio regionale simulato** (campione, soglia, affluenza); tabella con **Margine Soglia (voti)**, **Salute Tessere**, toggle **Confronta snapshot 18-10-2026**; drawer regionale con **Campagna Acquisti** (Δ istituzionale rapido per regione, combinato con registro Locali).
- Mappa: stima sondaggio, prob. soglia, scarto vs benchmark (`regionalPoll`).
- **Esporta report PDF** (stampa browser).

**Locali & News (MVP)**

- **Registro** comuni/cariche FN: seed da `GET /api/locali/registry`, edit in memoria, **export/import JSON** (su Vercel il filesystem non è scrivibile).
- **Scansiona feed**: `POST /api/news/scan` — RSS da catalogo predefinito (`newsFeedCatalog.ts`) se `NEWS_RSS_URLS` non è in env; filtro keyword; NER leggero via `italianGeoLookup.ts` (comune/provincia/feed ANSA → regione, ruolo istituzionale).
- Coda **revisione**: tag suggeriti + **Approva suggerimento (1 clic)**; registro persistito in **localStorage** (`localiStorage.ts`) con indicatore «Salvato nel browser» e ripristino seed server.
- Rollup `computeIstituzioniDelta(config, registro)` vs baseline **`config_v3_2.json`** `presenze_istituzionali` (non lo snapshot congelato).
- Toggle **Applica al scenario** → le chiamate a `/api/scenario` includono `istituzioniDelta`.
- Copy: notizie non verificate, `predizione_validata: false`.

**Storico iscritti**

- Upload CSV; `parseHistory()` vs snapshot congelato.

**Post-voto**

- Upload CSV 20 regioni; valutazione ex post sullo **snapshot 18/10/2026** (+ metriche sondaggio dove previsto).

**Auth:** sign out in sidebar.

### 4.6 Variabili d’ambiente

| Variabile | Obbligatoria | Descrizione |
|-----------|--------------|-------------|
| `AUTH_SECRET` | Sì | Secret Auth.js (≥ 32 caratteri casuali) |
| `ALLOWLIST_EMAILS` | Sì | Email autorizzate, separate da virgola |
| `PLATFORM_PASSWORD` | Sì | Password condivisa staff (interna) |
| `NEWS_RSS_URLS` | No | Override feed RSS (virgola). Se assente: **catalogo integrato** (31 sorgenti: nazionali + ANSA 20 regioni + campioni locali) |
| `NEWS_KEYWORDS` | No | Keyword aggiuntive (virgola); default in `newsIngest.ts` |
| `NEWS_SCAN_MAX_ITEMS` | No | Max candidati in risposta scan (default 30, cap 50) |

File esempio: `platform/.env.example`  
Sviluppo locale: `platform/.env.local` (in `.gitignore`, **non** pushare).

**RSS — condizioni d’uso:** rispettare i termini degli editori (es. [ANSA RSS](https://www.ansa.it/sito/static/ansa_rss.html): uso non commerciale su aggregatore/reader interno).

### 4.7 Comandi sviluppo

```bash
cd platform
npm install
npm run test          # parità motore vs golden JSON
npm run dev           # http://localhost:3000
npm run build
```

---

## 5. Deploy Vercel e CI Git

| | |
|---|---|
| **URL produzione** | https://platform-sigma-beige.vercel.app |
| **Progetto Vercel** | https://vercel.com/ionspinu29-4320s-projects/platform |
| **Repo collegato** | `IonSpinu02/FN-v3-2-FINAL`, branch **`master`** |
| **Root Directory** | `platform` (monorepo: codice Next.js non è in radice repo) |
| **Env Production** | `AUTH_SECRET`, `ALLOWLIST_EMAILS`, `PLATFORM_PASSWORD` (valori solo in dashboard Vercel, mai in git) |

**Deploy automatico:** push su `master` → build Vercel sulla cartella `platform/`.

**Deploy manuale (CLI):**

```bash
cd platform
npx vercel link          # una tantum, progetto platform
npx vercel deploy --prod
```

**Dopo modifica env:** Settings → Environment Variables → **Redeploy** production.

**Sintomi env mancanti/errate:** login visibile ma credenziali rifiutate; errori Auth.js senza `AUTH_SECRET`.

**Deployment Protection:** su alcuni URL di preview può comparire login Vercel; il dominio alias di produzione sopra serve l’app FN (`/login` → `/dashboard`). Regolare in Settings → Deployment Protection se necessario.

**Hobby plan:** scan news con ~31 feed in parallelo può richiedere fino a ~60 s (`maxDuration` su `/api/news/scan`); in caso di timeout ridurre feed via `NEWS_RSS_URLS`.

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
7. **Locali & News (MVP)** — vedi §4.5; API §4.3; catalogo RSS in `src/lib/engine/newsFeedCatalog.ts`.
8. **Auth API** — calcolo e news protetti da sessione; nSim clamp e validazione S lato server.
9. **Override motore** — `istituzioniDelta`, `flussi_ipsos` (Fase 1 hardening) via body `/api/scenario`; `isOfficialParams` considera anche flussi e delta istituzionali.
10. **Intelligenza territoriale poll** — `margineVotiSoglia`, `statoTesseramento`, `votiPerIscritto` in `regionalPoll.ts`.
11. **Geo lookup news** — `italianGeoLookup.ts` + `italianGeoData.ts` (capoluoghi e comuni principali → 20 regioni).

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

- [ ] `platform/.env.local` da `.env.example` (AUTH_SECRET, ALLOWLIST_EMAILS, PLATFORM_PASSWORD)
- [ ] `npm run test` verde (`golden.test.ts` incluso)
- [ ] `npm run dev` → login → tutte e 4 le tab

**Piattaforma Vercel:**

- [ ] Repo GitHub collegato, Root Directory = `platform`
- [ ] Tre env obbligatorie in Production (+ redeploy dopo cambio)
- [ ] Login con email in allowlist
- [ ] Tab Scenario + Locali (scan feed opzionale senza env RSS)
- [ ] Push su `master` → deploy automatico

---

## 9. Contatti dati e responsabilità

- Interpretazione **descrittiva / scenario sperimentale**; decisioni politiche non devono basarsi su questo output come unico sondaggio.
- Aggiornamenti iscritti **non provano** crescita del consenso senza verifica elettorale indipendente.
- Hash SHA256 del pacchetto v3.2 = integrità file, **non** prova di data di creazione.

---

*Ultimo aggiornamento recap: ottobre 2026 — UI flussi Ipsos 2026, margine soglia/salute tessere, campagna acquisti drawer, geo lookup news, localStorage registro, PDF esteso.*
