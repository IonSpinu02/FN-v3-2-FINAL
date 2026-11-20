# Refactor architettura real-time — Ledger di avanzamento

Progetto: **Futuro Nazionale v3.2** (`platform/`)

## Checklist Step 1–4

| Step | Stato | Note |
|------|-------|------|
| **1 — Single Source of Truth** | **[x]** | Cache Neon, rate limit, ledger |
| **2 — Ingestion vs lettura** | **[x]** | Read API DB-only + cron `ingest-domains`; vedi residui sotto |
| **3 — Real-time + client layer** | **[x]** | `/api/realtime/version` + `RealtimeSyncProvider` |
| **4 — Sicurezza + alerting** | **[x]** | Auth fail-closed, cron, system-monitor health |

---

## Migrazioni Neon (apply in ordine)

```bash
cd platform
# SQL Editor o:
npm run db:schema
```

| File | Contenuto |
|------|-----------|
| `drizzle/0001_ledger_append_only_hardening.sql` | Trigger ledger |
| `drizzle/0002_domain_cache_rate_limit.sql` | `domain_cache`, `api_rate_limit_hits` |
| `drizzle/0003_cron_locks_published_state.sql` | `cron_locks`, `published_state` |

**Rollback Step 2 (solo test):**

```sql
DROP TABLE IF EXISTS published_state;
DROP TABLE IF EXISTS cron_locks;
```

---

## Step 2 — deliverable

### Read API (solo Postgres, ETag)

| Route | Comportamento |
|-------|----------------|
| `GET /api/consenso/live` | `getStaleOrFresh(CONSENSO_LIVE_SNAPSHOT_KEY)` → seed locale se assente; **ETag** da `published_state.consenso` |
| `POST /api/news/scan` | `getStaleOrFresh(news:scan:{entriesKey})`; **no fetch RSS**; `forceRefresh` non avvia ingestion |
| `GET /api/territory/issues` | `getStaleOrFresh(territory:issues:…)`; payload vuoto se mai warmato |

Contratti JSON baseline invariati; aggiunti header `ETag` e supporto `If-None-Match` → `304`.

### Cron / ingestion

| Route | Auth | Lock |
|-------|------|------|
| `GET /api/cron/ingest-domains` | `authorizeCronRequest` | `cron:ingest-domains` |
| `GET /api/consenso/sync` | idem | `cron:consenso-sync` (solo consenso) |
| `GET /api/territory/issues/warm` | idem | `cron:territory-warm` |
| `GET /api/cron/system-monitor` | già allineato | — |

**`vercel.json`:** cron ogni 30 min su `/api/cron/ingest-domains`; conservati `consenso/sync` (05:00) e `system-monitor` (06:00).

### Nuovi moduli

- `src/lib/db/cronLockRepository.ts` — lock atomico + release `finally`
- `src/lib/db/publishedStateRepository.ts` — `version` + `etag` leggeri
- `src/lib/ingestion/runDomainIngestion.ts` — consenso, news, territorio, Google Trends
- `src/lib/ingestion/newsScanIngestion.ts` — RSS `Promise.allSettled` + timeout 3.5s
- `src/lib/ingestion/domainCacheSafeWrite.ts` + `validators.ts` (Zod)
- `src/lib/observability/logger.ts` — log JSON strutturato
- `src/lib/api/etagRead.ts`

### Env

| Variabile | Note |
|-----------|------|
| `DATABASE_URL` | Obbligatorio in prod per read/write |
| `CRON_SECRET` | Fail-closed 503 se assente su cron |
| `YOUTREND_ARCHIVE_*`, `NEWS_RSS_URLS`, … | Solo worker cron |

### Test aggiunti (Vitest)

- `cronLockRepository.test.ts`, `validators.test.ts`, `domainCacheSafeWrite.test.ts`

### Definition of Done Step 2

| Check | Esito |
|-------|--------|
| `npx tsc --noEmit` | OK |
| ESLint file toccati | OK |
| `npm test` | 419 pass |
| `npm run build` | Compila; advisory security Next (non applicato per scelta) |

---

## Step 3 — Realtime version + sync client (Opzione B)

### API

- `GET /api/realtime/version` — `force-dynamic`, solo colonne leggere da `published_state`, `ETag` composito deterministico, `304 Not Modified` con `If-None-Match`.
- Bump server su mutazioni: `PUT/POST /api/locali/registry` → `locali`; `POST /api/ledger/supervision` → `supervision`; `POST /api/osservatorio` → `news`.

### Allineamento consenso (residuo Step 2)

- `publishConsensoIfAligned()` in `consensoPublishAligned.ts`: warm briefing + `isExplanationCachedForHash` prima di `bumpPublishedState("consenso")` con `computationId = explanationHash`.

### Client (zero npm nuovi)

- `RealtimeSyncProvider` — polling unico 15s, `visibilitychange`, dedup in-flight, invalidazione per dominio.
- Collegati: `useLiveConsenso`, `ScenarioGrowthForecastPanel`, `NewsReviewPanel`, `OsservatorioCockpit`, `RassegnaStampaDefezioniPanel`; refresh post-mutazione in `LocaliPanel`, `HumanSupervisionControls`, `OsservatorioPanel`.

### Moduli nuovi

- `src/app/api/realtime/version/route.ts`
- `src/lib/realtime/versionEtag.ts`
- `src/lib/ingestion/consensoPublishAligned.ts`
- `src/components/realtime/RealtimeSyncProvider.tsx`

### Test aggiunti (Vitest)

- `src/lib/realtime/versionEtag.test.ts` — ETag composito, `304`, `domainsWithVersionChange`

### Definition of Done Step 3

| Check | Esito |
|-------|--------|
| `npx tsc --noEmit` | OK |
| ESLint file toccati | OK |
| `npm test` | 425 pass (+6) |
| `npm run build` | OK (advisory security Next ignorato per scelta branch) |

### Rischi residui (Step 3 → 4)

1. **Route AI/coverage** che ancora chiamano `resolveConsensoLiveContext()` in scrittura — refactor opzionale.
2. **Primo deploy:** finché non gira `ingest-domains`, read API possono servire seed/vuoto (SWR stale).
3. **`locali` news:** scan con `entries` custom richiede estensione cron o ingest on-demand futuro.

---

## Step 4 — Hardening sicurezza, auth fail-closed & alerting

### Auth

- `requireSession()` → NextAuth `auth()`; **nessun** `interno@fn` in produzione.
- Dev bypass esplicito: `FN_AUTH_DEV_BYPASS=1` solo se `NODE_ENV !== "production"`.
- Mutazioni: tutte le route `POST`/`PUT`/`DELETE` API già su `requireSession`; aggiunto `POST /api/forecast-intelligence`.

### Cron

- `authorizeCronRequest()`: `timingSafeEqual`, **503** senza `CRON_SECRET`.
- Audit: `GET /api/cron/ingest-domains`, `/api/cron/system-monitor`, `/api/consenso/sync`, `/api/territory/issues/warm` — tutte protette.

### System monitor

- `verifyLedgerIntegrity()` + ingest streak ≥ 2 in `source_ingestion_log`.
- `dispatchAlertIfAllowed()` via `ALERT_WEBHOOK_URL`, cooldown Neon `domain_cache` (`system_alert_cooldown:*`).
- `pruneExpiredRateLimitRows()` ogni run (giornaliero su Vercel cron 06:00 UTC).

### Moduli

- `src/lib/security/ingestionHealth.ts`, `alertDispatcher.ts`
- Test: `requireSession.test.ts`, `cronAuth.test.ts`, `ingestionHealth.test.ts`, `alertDispatcher.test.ts`

### Definition of Done Step 4

| Check | Esito |
|-------|--------|
| `npx tsc --noEmit` | OK |
| ESLint file toccati | OK |
| `npm test` | 437 pass (+12) |
| `npm run build` | OK |
| Audit `rg` src/ | `interno@fn` 0; `hits = new Map` 0; cron protetti 4/4 |

---

## Checklist di Deploy Produzione (Neon + Vercel Env Vars)

| Variabile | Obbligatoria prod | Scopo |
|-----------|-------------------|--------|
| `DATABASE_URL` | **Sì** | Neon Postgres (cache, ledger, rate limit, published_state) |
| `AUTH_SECRET` | **Sì** | NextAuth JWT |
| `ALLOWLIST_EMAILS` / `PLATFORM_PASSWORD` (o `ALLOWLIST_CREDENTIALS`) | **Sì** | Login interno |
| `CRON_SECRET` | **Sì** | Bearer per cron Vercel (`ingest-domains`, `consenso/sync`, `system-monitor`, `territory/issues/warm`) |
| `ALERT_WEBHOOK_URL` | Consigliata | Webhook alert (Slack/Discord/custom) da system-monitor |
| `ALERT_WEBHOOK_COOLDOWN_MS` | No | Default 1h deduplica alert |
| `FN_AUTH_DEV_BYPASS` | **No** (mai in prod) | Solo locale: `1` per saltare login |
| `UPSTASH_REDIS_REST_*` | Opzionale | Rate limit Redis; senza → Postgres `api_rate_limit_hits` |

**Post-deploy**

1. `npm run db:schema` (migrazioni `0001`–`0003` su Neon).
2. Verificare cron Vercel in `vercel.json` con header `Authorization: Bearer $CRON_SECRET` (Vercel lo inietta se configurato).
3. Chiamata manuale: `GET /api/cron/system-monitor` → `health.ledgerIntegrity.ok`, `health.rateLimitPruned`.
4. Login dashboard → mutazione test (es. supervision) → `401` senza cookie sessione.

---

## Step 1 (riepilogo)

Vedi commit precedente: `domain_cache`, rate limit distribuito, ledger file guard, migrazioni `0001`–`0002`.

---

_Ultimo aggiornamento: Step 4 — refactor real-time completo (Step 1–4)._