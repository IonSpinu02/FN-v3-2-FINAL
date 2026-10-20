# Osservatorio integrato — Guida metodologica

Documento di lavoro **20 ottobre 2026** (origine: `Osservatorio.docx`).  
Periodo operativo: **ottobre 2026 – maggio 2027**.

## Obiettivo

Lettura coordinata di consenso elettorale (Modulo A), fabbisogni pubblici (Modulo B) ed eventi/opinione (Modulo C), mantenendo distinzioni metodologiche.

## Integrazione piattaforma FN v3.2

| Modulo | Implementazione |
|--------|-----------------|
| A · Elettorale | Tab **Scenario**, **Post-voto**, **Snapshot & Audit** |
| B · Fabbisogni | `data/fabbisogni_catalog.json`, tab **Osservatorio** |
| C · Eventi | Registro in **Osservatorio**, **Locali & News**, import CSV **Google Trends** |

API: `GET /api/osservatorio`, `POST /api/osservatorio` (cloud state Moduli B/C)  
Tabella DB: `osservatorio_cloud_state` (eventi, Trends, priorità dichiarate, note mensili)  
Guida web: `/guida/osservatorio`  
Catalogo: `data/fabbisogni_catalog.json` (20 regioni × 4 indicatori, 8 metadati ciascuno)  
Generazione catalogo: `node scripts/generate-fabbisogni-catalog.mjs`

## Consegne mensili

1. Quadro sondaggi/scenari e scostamenti con incertezza.  
2. Scheda fabbisogni con fonti e lacune.  
3. Nota eventi (cronologia, attenzione, opinioni se disponibili).

## Comandi dati

- Popolare indicatori: editare `platform/data/fabbisogni_catalog.json` (ISTAT BesT, AGENAS, OpenCivitas).  
- Eventi seed: `platform/data/osservatorio_events.json`; override browser via tab Osservatorio.  
- Trends: esportare da Google Trends → CSV → import in tab Osservatorio.

## Limiti (sempre in UI)

Vedi tab Osservatorio e `DisclaimerBanner` — in particolare: no causalità da Trends, no errore ecologico fabbisogni↔voto, entropia ≠ consenso.
