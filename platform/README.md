# FN Scenario Territoriale — Piattaforma v3.2

Dashboard interna **Futuro Nazionale** (motore v3.2, parità numerica con `modello_fn_v3_2.py`).

**Routing:** `/` = showcase (landing); area operativa sotto `/app/scenario`, `/app/quadro`, `/app/osservatorio`, `/app/news`, `/app/audit`. I link legacy `/dashboard` reindirizzano a `/app/scenario`.

Documentazione: [`docs/RECAP-PIATTAFORMA.md`](docs/RECAP-PIATTAFORMA.md) · repo root [`RECAP_FUNZIONAMENTO.md`](../RECAP_FUNZIONAMENTO.md).

## Requisiti

- Node 20+
- Variabili d'ambiente: [`.env.example`](.env.example)

## Comandi

Dalla **radice del monorepo** (`FN_v3_2_FINAL/`) puoi usare il bridge:

```bash
npm run test
npm run dev
npm run build
npm run db:push
npm run db:studio
```

Oppure sempre da `platform/`:

```bash
cd platform
cp .env.example .env.local
npm install
npm run test
npm run dev
```

## Database (Neon + Drizzle)

```bash
cd platform
npx vercel env pull .env.local
npm run db:push
```

`drizzle.config.ts` carica `.env.local` / `.env` e accetta `DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`.  
Senza URL, `npm run db:push` esce con messaggio diagnostico (script `scripts/db-push-safe.mjs`).

## Tab dashboard

Scenario (Landing / Stage / Console) · **Quadro FN** · Osservatorio (A/B/C) · **Rassegna stampa (tab 04)** · **Audit & Post-Voto (tab 05, WIP)**.

## Dati

- `data/` — seed allineati ai JSON in radice repo (test SHA-256 in `golden.test.ts`)
- `src/lib/engine/calculate.ts` — motore MC (non alterare la matematica senza golden verdi)

## Deploy Vercel

Root Directory del progetto Git: **`platform`**.

Variabili obbligatorie: `AUTH_SECRET`, `ALLOWLIST_EMAILS`, `PLATFORM_PASSWORD`.  
Opzionali: `ALLOWLIST_CREDENTIALS`, `DATABASE_URL`, `NEWS_RSS_URLS`, `NEWS_KEYWORDS`, `NEWS_SCAN_MAX_ITEMS`.  
Tab **04 Rassegna stampa**: solo RSS live (31 feed), refresh automatico ogni **30 min** (cache server allineata).

## Avvertenza

Scenario **descrittivo** (`predizione_validata: false`).
