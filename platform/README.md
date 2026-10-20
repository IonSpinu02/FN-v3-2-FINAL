# FN Scenario Territoriale — Piattaforma v3.2

Dashboard interna per lo **scenario territoriale** Futuro Nazionale (motore v3.2, parità numerica con `modello_fn_v3_2.py`).

## Requisiti

- Node 20+
- Variabili d'ambiente (vedi `.env.example`)

## Sviluppo locale

```bash
cd platform
cp .env.example .env.local
# Imposta AUTH_SECRET, ALLOWLIST_EMAILS, PLATFORM_PASSWORD
npm install
npm run test    # golden test vs data/risultati_v3_2.json
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) → login → `/dashboard`.

## Deploy Vercel

Progetto collegato: **platform** (team `ionspinu29-4320s-projects`).

- **URL produzione:** https://platform-sigma-beige.vercel.app  
- **Dashboard progetto:** https://vercel.com/ionspinu29-4320s-projects/platform  

### Variabili d’ambiente (obbligatorie)

In [Settings → Environment Variables](https://vercel.com/ionspinu29-4320s-projects/platform/settings/environment-variables) aggiungi per **Production** (e opzionalmente Preview):

| Nome | Esempio |
|------|---------|
| `AUTH_SECRET` | stringa casuale ≥ 32 caratteri (`openssl rand -base64 32`) |
| `ALLOWLIST_EMAILS` | `tua@email.it` (più email separate da virgola) |
| `PLATFORM_PASSWORD` | password scelta per lo staff |

Poi **Redeploy** l’ultimo deployment (Deployments → ⋮ → Redeploy).

### CLI

```bash
cd platform
npx vercel link
npx vercel deploy --prod
```

Root directory del repo su Vercel: cartella **`platform`** (se importi da Git).

## Struttura

- `src/lib/engine/` — motore TypeScript (Monte Carlo con RNG compatibile CPython)
- `data/` — config, EU 2024, snapshot e golden JSON
- `src/app/dashboard/` — panorama metriche, mappa, tabella regioni

## Avvertenza

Scenario **descrittivo**, non previsione elettorale validata (`predizione_validata: false`).
