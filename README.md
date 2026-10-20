# Futuro Nazionale — modello v3.2 e piattaforma

Pacchetto scenario elettorale **v3.2** (20 regioni): motore Python, dati JSON, piattaforma web Next.js con dashboard, sensibilità, sondaggio simulato, storico iscritti, post-voto e tab **Locali & News**.

Documentazione operativa: [`RECAP_FUNZIONAMENTO.md`](RECAP_FUNZIONAMENTO.md).

## Struttura

| Percorso | Contenuto |
|----------|-----------|
| Radice | `modello_fn_v3_2.py`, `config_v3_2.json`, `eu2024.json`, snapshot e template CSV |
| `platform/` | App Next.js (Auth, API scenario, deploy Vercel) |

## Piattaforma (sviluppo locale)

```bash
cd platform
cp .env.example .env.local   # AUTH_SECRET, ALLOWLIST_EMAILS, PLATFORM_PASSWORD
npm install
npm run test
npm run dev
```

Login → `/dashboard`.

## Python (solo modello)

```bash
python modello_fn_v3_2.py --output risultati_ricalcolati.json
```

## Qualificazione

Output **descrittivo** (`predizione_validata: false`); non sostituisce sondaggi certificati.
