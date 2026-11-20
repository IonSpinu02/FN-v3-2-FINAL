# Osservatorio integrato — Guida per la dirigenza FN

**Periodo:** ottobre 2026 – maggio 2027 · Documento di lavoro 20 ottobre 2026 (`Osservatorio.docx`).

---

## Cockpit zero-scroll (Vannacci)

La tab **Osservatorio** apre subito il **dossier regionale** (default **Lombardia**): a sinistra testata KPI + 3 tab (Problemi · Google · Dati), a destra **menu semaforo** delle 20 regioni ordinate per voti guadagnabili (non ISTAT). Metodologia e CSV restano nei drawer.

**Radar problemi (ibrido):** per ogni regione **tutte le notizie RSS verificate** (fino a ~120) come card «Dato live», più **schede catalogo** solo per macro-temi senza cronaca. Ranking per potenziale seggi (elasticità FN × stress ISTAT × impatto notizia × Trends).

**Consenso nazionale (7,20%):** input da [Supermedia YouTrend/AGI](https://www.youtrend.it/la-supermedia/) — allineato al tab Scenario.

---

## Tre fili di analisi

### Consenso & scenario territoriale

- Quote regionali dal modello Monte Carlo FN (tab Scenario).
- Provenienza voti: matrici Ipsos luglio 2026 e Sky TG24 ottobre 2026.

### Fabbisogni & servizi

- Indicatori su sanità, lavoro, costo vita, trasporti, territorio (BesT / AGENAS / OpenCivitas).
- Catalogo: `platform/data/fabbisogni_catalog.json`.

### Eventi & attenzione mediatica

- Registro episodi (±14 gg), Google Trends (0–100), event study senza causalità automatica sul voto.

---

## Simulatore Promesse FN × problemi

Nel **Passo 2**, ogni problema è collegato a una promessa FN e a una stima di conversione basata sullo storico elettorale regionale (Europee 2024).

---

## Consegne mensili

1. Quadro scenari e scostamenti con incertezza.  
2. Scheda fabbisogni con fonti e lacune.  
3. Nota eventi (cronologia, attenzione, opinioni se disponibili).

---

## Nota per amministratori di sistema

| Risorsa | Dettaglio |
|---------|-----------|
| API | `GET/POST /api/osservatorio` |
| Radar problemi | `GET /api/territory/issues?region=…&validVotes=…` (6 macro-temi, ranking seggi, cache 15 min) |
| Warm radar (cron) | `GET /api/territory/issues/warm?secret=…` |
| Guida web | `/guida/osservatorio` |
| Doc tecnica | `docs/OSSERVATORIO_FUNZIONAMENTO_COMPLETO.md` |

**Limiti:** no inferenza Trends→voto; no errore ecologico bisogni↔voto; entropia H ≠ consenso.
