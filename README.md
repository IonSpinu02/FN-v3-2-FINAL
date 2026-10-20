# Futuro Nazionale — modello v3.2 e piattaforma

Pacchetto scenario elettorale **v3.2** (20 regioni): motore Python, dati JSON, piattaforma web Next.js con dashboard, sensibilità, sondaggio simulato, Osservatorio integrato, Locali & News, snapshot su Neon, storico iscritti e post-voto.

Documentazione estesa: [`RECAP_FUNZIONAMENTO.md`](RECAP_FUNZIONAMENTO.md) · [`platform/docs/RECAP-PIATTAFORMA.md`](platform/docs/RECAP-PIATTAFORMA.md).

## Struttura monorepo

| Percorso | Contenuto |
|----------|-----------|
| **Radice** | `modello_fn_v3_2.py`, `config_v3_2.json`, `eu2024.json`, snapshot, template CSV |
| **`platform/`** | App Next.js 16, motore TS, dati seed in `platform/data/` (allineati ai JSON in radice — test SHA-256 in Vitest) |
| **`package.json` (radice)** | Bridge npm verso `platform/` (`npm run dev`, `test`, `build`, `db:push`, …) |

## Comandi (dalla radice **o** da `platform/`)

```bash
# Dalla radice del repo (consigliato)
npm install          # solo se aggiungi dipendenze in platform/
npm run test         # Vitest in platform/ (golden + parità JSON radice/data)
npm run build
npm run dev
npm run db:push      # Drizzle → Neon (richiede DATABASE_URL in platform/.env.local)
npm run db:studio
npm run py:calc      # python modello_fn_v3_2.py --output risultati_ricalcolati.json

# Equivalente in platform/
cd platform && npm run dev
```

## Database cloud (Neon + Drizzle)

```bash
cd platform
npx vercel env pull .env.local   # scarica DATABASE_URL da Vercel
npm run db:push                  # snapshots, audit_logs, osservatorio_cloud_state, locali_cloud_state
```

Se `DATABASE_URL` manca, `db:push` stampa istruzioni diagnostiche senza crash con `url: ''`.

## Piattaforma — tab dashboard

| Tab | Funzione |
|-----|----------|
| **Scenario** | Vista **Landing** / **Stage** / **Console** — mappa SVG, poll simulato, sensibilità S/pesi/flussi |
| **Quadro FN** | Cruscotto territoriale integrato (scenario + fabbisogni + mobilitazione organizzativa) |
| **Osservatorio** | Moduli A/B/C, schede mensili, fabbisogni 20 regioni, eventi, Google Trends |
| **Locali & News** | Registro comuni, geocoding, scan RSS (~31 feed, cache 15 min), delta istituzionale |
| **Snapshot & Audit** | Congela scenario su Neon, diff, audit trail (email lowercase) |
| **Storico iscritti** | CSV monitoraggio |
| **Post-voto** | Confronto vs snapshot 18-10-2026 |

Login → `/dashboard` (Auth: `ALLOWLIST_EMAILS` + `PLATFORM_PASSWORD`, opzionale `ALLOWLIST_CREDENTIALS`).

## Python (solo modello)

```bash
python modello_fn_v3_2.py --output risultati_ricalcolati.json
```

Dopo modifiche ai JSON in radice, allineare le copie in `platform/data/` (verificato da `golden.test.ts`).

## Qualificazione

Output **descrittivo** (`predizione_validata: false`); non sostituisce sondaggi certificati. Fabbisogni e RSS **non** ricalcolano il voto automaticamente.
