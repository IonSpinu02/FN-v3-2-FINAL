<div class="cover">
<p class="cover-kicker">Futuro Nazionale · Piattaforma v3.2</p>
<h1>Presentazione tecnica</h1>
<p class="cover-sub">Architettura, stack, motore di calcolo, API, dati e pipeline di deploy — documento per sviluppatori e revisori · Ottobre 2026</p>
<p class="cover-meta"><strong>Repository:</strong> monorepo FN_v3_2_FINAL · Root deploy Vercel: cartella <strong>platform</strong><br>
<strong>Runtime:</strong> Node 20+ · Next.js 16 App Router · TypeScript strict<br>
<span class="cover-badge">Motore elettorale v3.2 · Parità numerica con modello Python di riferimento</span></p>
</div>

# Indice

1. Obiettivo del sistema  
2. Stack tecnologico  
3. Architettura a layer  
4. Routing e shell applicativa  
5. Motore elettorale (Modulo A)  
6. Intelligence territoriale (Moduli B e C)  
7. Osservatorio — pipeline dati  
8. Catalogo API REST  
9. Layer dati e persistenza  
10. Autenticazione e sicurezza  
11. Cache, cron e performance  
12. Frontend e componenti  
13. Test e qualità  
14. Deploy e operazioni  
15. Estensioni recenti (v3.2)

---

## 1. Obiettivo del sistema

Applicazione web **full-stack** per:

- calcolare **scenari elettorali regionali** parametrici (consenso S, pesi, flussi, iscritti, cariche);
- esporre un **cockpit territoriale** (problemi, B.I.P., Google Trends, conversione stimata);
- gestire **registro Locali** con effetto sul mix istituzionale;
- sincronizzare stato **Osservatorio** (eventi, Trends CSV, priorità) su DB opzionale.

Il sistema è **descrittivo/simulativo** (`predizione_validata: false` in config): nessuna API presenta output come sondaggio certificato.

---

## 2. Stack tecnologico

| Area | Tecnologia | Note |
|------|------------|------|
| Framework | **Next.js 16.4** | App Router, Turbopack in dev/build |
| UI | **React 19**, **Tailwind CSS 4** | Client components per dashboard interattiva |
| Linguaggio | **TypeScript** | Engine e API tipizzati |
| Auth | **NextAuth v5** | Allowlist email + password piattaforma |
| Database | **Neon PostgreSQL** + **Drizzle ORM** | Opzionale; snapshot e cloud state |
| Mappe | **react-simple-maps**, GeoJSON | `public/geo/regioni-italia.geojson` |
| Animazioni | **Framer Motion** | Landing e transizioni stage |
| Test | **Vitest** | ~33+ file test su engine e lib |
| PDF docs | **md-to-pdf** | Stylesheet condiviso metodologia |
| Deploy | **Vercel** | Root Directory = `platform` |

**Dipendenze di dominio:** motore MC usa **`python-random`** per allineamento seed/stochasticità al modello Python storico.

---

## 3. Architettura a layer

```
┌─────────────────────────────────────────────────────────┐
│  Browser — React client (DashboardClient, Cockpit, Map)   │
└───────────────────────────┬─────────────────────────────┘
                            │ fetch / POST JSON
┌───────────────────────────▼─────────────────────────────┐
│  Next.js Route Handlers — src/app/api/*/route.ts        │
│  (auth session, cache headers, force-dynamic dove serve)│
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────────┐
│ src/lib/engine│  │ src/lib/*     │  │ platform/data/*  │
│ calculate,    │  │ fnProgram,    │  │ JSON seed +      │
│ poll, ingest  │  │ trends, BIP   │  │ eu2024, config   │
└───────────────┘  └───────────────┘  └──────────────────┘
                            │
                            ▼
                   Neon (snapshots, cloud, audit) — opzionale
```

| Layer | Percorso | Responsabilità |
|-------|----------|----------------|
| **App** | `src/app/` | Pagine, layout, API routes |
| **Components** | `src/components/` | UI tab Scenario, Osservatorio, Locali |
| **Engine** | `src/lib/engine/` | Calcoli deterministici, MC, ingest news, territory |
| **Lib dominio** | `src/lib/` | B.I.P., Trends intelligence, defezioni, formattazione IT |
| **Data** | `platform/data/` | Config, elezioni 2024, fabbisogni, registro locali |
| **DB** | `src/lib/db/` | Schema Drizzle, accesso Neon |

**Principio:** la matematica elettorale vive in **engine** (test golden); la UI non duplica formule.

---

## 4. Routing e shell applicativa

| URL | Contenuto |
|-----|-----------|
| `/` | Showcase / landing pubblica |
| `/app/scenario` | Mappa elettorale, controlli S/pesi, Monte Carlo |
| `/app/osservatorio` | Cockpit Bento — problemi, Trends, Analizza |
| `/app/news` | Locali / rassegna (tab organizzazione) |
| `/guida/metodologia`, `/guida/osservatorio` | Documentazione statica |
| `/dashboard`, `/login` | Redirect → `/app/scenario` |

Shell: `DashboardShell` + `StageTopHud` + tab da `appRoutes.ts` (`AppTab`: scenario | osservatorio | locali).

**Bootstrap client:** `DashboardClientLoader` → `GET /api/dashboard-data` restituisce scenario iniziale, snapshot congelato, `fnConfig`.

---

## 5. Motore elettorale (Modulo A)

**File centrale:** `src/lib/engine/calculate.ts` — funzione `calculate()` con pesi normalizzati, mix flussi/preferenze/iscritti/istituzioni, output `ScenarioResult`.

| Modulo | File / area | Funzione |
|--------|-------------|----------|
| Config e default | `defaults.ts`, `config_v3_2.json` | S, pesi 35/25/25/15, flussi Ipsos/Sky |
| Monte Carlo | `calculate.ts` + config MC | ~20.000 run, bande lo10/hi90 |
| Poll regionale simulato | `regionalPoll.ts` | IC 95%, prob. soglia 3% — **non** poll reale |
| Crescita campagna | `partyGrowthForecast.ts`, `politicalModel.ts` | Ott ’26 → Mag ’27 |
| Istituzioni | `localInstitutions.ts` | Delta cariche → indice regionale |
| Override API | `POST /api/scenario` | Ricalcolo con payload client |

**Golden tests:** `golden.test.ts` — hash/parità con output Python; **non alterare la matematica senza test verdi**.

---

## 6. Intelligence territoriale (Moduli B e C)

| Modulo | Implementazione | Input | Output |
|--------|-----------------|-------|--------|
| **B · Fabbisogni** | `fabbisogni_catalog.json`, `territorialIntelligence.ts`, `moduloBFabbisogniView.ts` | ISTAT/AGENAS/OpenCivitas | Stress 0–100 per macro-tema |
| **C · Eventi** | `osservatorioStorage`, API osservatorio | Eventi manuali + cloud | Event study (`eventStudyProtocol.ts`) |
| **Trends** | `googleTrendsIntelligence.ts`, `googleTrendsRegionalCatalog.ts`, `useLiveGoogleTrends.ts` | CSV / RSS live | Serie 0–100 per regione e query B.I.P. |

Modulo B **non** alimenta direttamente la quota FN: separazione esplicita in UI e tipi.

---

## 7. Osservatorio — pipeline dati

```
RSS / Google News          Catalogo temi           Merge
      │                         │                    │
      ▼                         ▼                    ▼
 newsIngest.ts ──► classify ──► territoryIssuesResolver.ts
      │              6 cat.         │
      │                             ├── rank regionale / nazionale
      ▼                             ├── enrichIssuesWithConversion
 bipSubDossierMatch.ts              └── cache TTL (territoryIssuesCache)
 (titolo+sintesi → B.I.P.)
```

| Componente | Ruolo |
|------------|--------|
| `territoryIssuesEngine.ts` | RSS → `TerritoryIssue`, score impatto |
| `territoryIssuesResolver.ts` | Ibrido live + catalogo; vista **NAZIONALE** merge 20 regioni |
| `bipSubDossierMatch.ts` | Matching keyword → sotto-dossier B.I.P. (25+ schede) |
| `fnProgramAndAffinityEngine.ts` | `computeIssueConversionGain`, promesse FN |
| `territoryIssueAnalyzeCopy.ts` | Testi modal Analizza (badge, stampa, provvedimento) |
| `OsservatorioCockpit.tsx` | UI griglia, simulazione top-N, Trends tab |

**API:** `GET /api/territory/issues?region=&validVotes=` — cache server 5 min + stale-while-revalidate.  
**Warm:** `GET /api/territory/issues/warm` — precaricamento cron regioni.

---

## 8. Catalogo API REST

| Endpoint | Metodo | Scopo |
|----------|--------|--------|
| `/api/dashboard-data` | GET | Bootstrap scenario + config + snapshot |
| `/api/scenario` | POST | Ricalcolo scenario (S, pesi, override istituzioni) |
| `/api/regional-poll` | POST | Poll regionale simulato |
| `/api/osservatorio` | GET/POST | Stato cloud Osservatorio |
| `/api/territory/issues` | GET | Payload problemi per regione/categoria |
| `/api/territory/issues/warm` | GET | Warm cache territorio |
| `/api/google-trends` | GET | Proxy/normalize Trends live |
| `/api/press/defections` | GET | Defezioni + merge Camera SPARQL |
| `/api/locali/registry` | GET/POST | Registro comuni/cariche |
| `/api/locali/compute-delta` | POST | Delta istituzionale |
| `/api/news/scan`, `/api/news/read` | POST/GET | Pipeline rassegna stampa RSS |
| `/api/snapshots`, `/api/snapshots/[id]` | CRUD | Snapshot scenario su Neon |
| `/api/post-vote` | POST | Confronto post-elettorale |
| `/api/db/health` | GET | Diagnostica connessione DB |
| `/api/auth/[...nextauth]` | * | Sessione |
| `/api/ai-gateway/chat`, `/health` | POST/GET | Gateway AI opzionale |

Quasi tutte le route sensibili richiedono **sessione autenticata** (middleware / check handler).

---

## 9. Layer dati e persistenza

### JSON statici (`platform/data/`)

| File | Contenuto |
|------|-----------|
| `config_v3_2.json` | S, pesi, iscritti, flussi, parametri MC/poll |
| `eu2024.json` | Validi e quote FdI/Lega per regione |
| `fabbisogni_catalog.json` | Indicatori Modulo B × 20 regioni |
| `locali_registry.json` | Seed registro Locali |
| `scenario_congelato_18-10-2026.json` | Baseline audit |

Import JSON lato server; **attenzione bundle client** — dati elettorali pesanti importati solo dove serve (es. resolver usa import diretto, non `fs` in path client).

### PostgreSQL (Drizzle)

| Tabella | Uso |
|---------|-----|
| `snapshots` | Scenario congelati, hash SHA-256, params |
| `osservatorio_cloud_state` | Eventi, serie Trends, priorità, note mensili |
| `locali_cloud_state` | Registry + eventi locali |
| `audit_logs` | Azioni operatori |

Script: `npm run db:push` (safe wrapper), `db:schema`, `db:studio`.

---

## 10. Autenticazione e sicurezza

- **NextAuth** con `AUTH_SECRET`, `ALLOWLIST_EMAILS`, `PLATFORM_PASSWORD` (e opz. `ALLOWLIST_CREDENTIALS`).
- Deploy Vercel: **Deployment Protection** possibile (SSO team).
- Nessun segreto in repo; `.env.local` da `vercel env pull` o `.env.example`.
- RSS e fetch esterni: timeout e filtri keyword; nessuna esecuzione codice utente.

---

## 11. Cache, cron e performance

| Meccanismo | Dove | TTL / note |
|------------|------|------------|
| Territory issues cache | `territoryIssuesCache.ts` | Schema versionato (v6+), TTL ~5 min |
| HTTP Cache-Control | `/api/territory/issues` | s-maxage 300, SWR 600 |
| News scan | Server cache allineata | Refresh ~30 min (31 feed) |
| Next.js | `cacheComponents: false` | Evita errori client PPR in v16 |

**Osservatorio client:** fetch problemi on region change; Trends hook `useLiveGoogleTrends` con swap regione immediato.

---

## 12. Frontend e componenti

| Area | Componenti chiave |
|------|-------------------|
| Scenario | `ScenarioTerritoryStage`, `ItalyMap`, `SensitivityControls`, `AnalyticalChartsSuite` |
| Osservatorio | `OsservatorioBentoLayout`, `OsservatorioCockpit`, `OsservatorioIssueAnalyzePanel`, `OsservatorioGoogleTrendsTab` |
| Locali | `LocaliPanel`, `LocaliRegistryTable` |
| Report | `PrintOsservatorioReport`, `PrintNotaReport` (stampa browser) |
| Formattazione | `formatIt.ts`, `osservatorioFormatIt.ts` — locale it-IT |

Pattern: **stato scenario** in `DashboardClient` (S, pesi, snapshot); **props drilling** verso tab; dynamic import per tab pesanti.

---

## 13. Test e qualità

- **Vitest** — `npm run test` in `platform/`.
- **golden.test.ts** — parità motore con baseline Python.
- Test dominio: `territoryIssuesResolver`, `bipSubDossierMatch`, `fnProgramAndAffinityEngine`, `newsIngest`, `regionalPoll`, Trends RSS, ecc.
- **Lint:** ESLint (script `npm run lint`).

Pipeline consigliata pre-deploy: `test` → `build` → deploy da **root monorepo** con Root Directory Vercel = `platform`.

---

## 14. Deploy e operazioni

| Variabile | Obbligatoria | Uso |
|-----------|--------------|-----|
| `AUTH_SECRET` | Sì | Sessione |
| `ALLOWLIST_EMAILS` | Sì | Accesso |
| `PLATFORM_PASSWORD` | Sì | Login |
| `DATABASE_URL` | No | Cloud + snapshot |
| `NEWS_RSS_URLS`, `NEWS_KEYWORDS` | No | Rassegna stampa |

```text
Monorepo root:  npx vercel deploy --prod
(Vercel project Root Directory = platform)
```

Dev locale:

```text
cd platform
npm install
npm run dev   → http://localhost:3000
```

Documentazione PDF: `docs:presentazione-pdf`, `docs:metodologia-pdf`, `docs:presentazione-tecnica-pdf`.

---

## 15. Estensioni recenti (v3.2)

| Feature | Implementazione tecnica |
|---------|-------------------------|
| B.I.P. granulare | `bipSubDossierMatch.ts` → campi issue + Analizza |
| Vista Italia | `fetchNationalRegionalLiveOverview`, ranking nazionale |
| Trends per regione | `googleTrendsRegionalCatalog.ts`, live RSS merge |
| Defezioni live | `politicalDefectionsEngine.ts`, API press, SPARQL Camera |
| Conversione per issue | `computeIssueConversionGain` + testo issue per promessa |

---

<p class="fn-footer-note">Futuro Nazionale · Piattaforma v3.2 · Presentazione tecnica · Dettaglio esteso: docs/RECAP-PIATTAFORMA.md · docs/OSSERVATORIO_FUNZIONAMENTO_COMPLETO.md</p>
