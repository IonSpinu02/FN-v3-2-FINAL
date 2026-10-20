# Report tecnico completo — Futuro Nazionale v3.2 + Piattaforma web

**Destinatari:** staff tecnico e dirigenza con competenze informatiche.  
**Workspace:** `C:\Users\User\Desktop\FN_v3_2_FINAL`  
**Aggiornamento:** ottobre 2026  

Documenti correlati: `RECAP_FUNZIONAMENTO.md` (operativo), `GUIDA_SEMPLICE_FUNZIONAMENTO.html` / `.pdf` (non tecnico).

---

## Indice

1. [Qualificazione e vincoli](#1-qualificazione-e-vincoli)
2. [Architettura generale](#2-architettura-generale)
3. [Pacchetto Python v3.2](#3-pacchetto-python-v32)
4. [Modello matematico (dettaglio)](#4-modello-matematico-dettaglio)
5. [Monte Carlo e parità RNG](#5-monte-carlo-e-parità-rng)
6. [Piattaforma Next.js](#6-piattaforma-nextjs)
7. [Motore TypeScript (`calculate.ts`)](#7-motore-typescript-calculatets)
8. [API HTTP](#8-api-http)
9. [Dashboard e UX (sensibilità, debounce)](#9-dashboard-e-ux)
10. [Simulatore sondaggio regionale](#10-simulatore-sondaggio-regionale)
11. [Storico iscritti e post-voto](#11-storico-iscritti-e-post-voto)
12. [Autenticazione e sicurezza](#12-autenticazione-e-sicurezza)
13. [Test e golden parity](#13-test-e-golden-parity)
14. [Deploy Vercel](#14-deploy-vercel)
15. [Ottimizzazioni progettuali](#15-ottimizzazioni-progettuali)
16. [Roadmap](#16-roadmap)
17. [Appendice: struttura file e comandi](#17-appendice)

---

## 1. Qualificazione e vincoli

| Affermazione | Stato nel codice / JSON |
|--------------|-------------------------|
| Previsione elettorale validata | **`predizione_validata: false`** in output scenario |
| Intervalli lo10–hi90 | Sensibilità ai pesi Monte Carlo, **non** margini elettorali certificati |
| Sondaggio regionale simulato | **Simulazione interna**, non istituto esterno |
| Post-voto | Richiede CSV comparabile (FN con simbolo proprio, 20 regioni) |
| Golden ufficiale | Default `S=0.072`, pesi `35/25/25/15`, seme MC `42`, `20000` sim |

**Regola di manutenzione:** non alterare il comportamento di default di `calculate()` senza aggiornare `golden.test.ts` e `risultati_v3_2.json`.

---

## 2. Architettura generale

```mermaid
flowchart TB
  subgraph root [FN_v3_2_FINAL]
    PY[modello_fn_v3_2.py]
    CFG[config_v3_2.json]
    EU[eu2024.json]
    RES[risultati_v3_2.json]
    SNAP[scenario_congelato_18-10-2026.json]
  end
  subgraph platform [platform/]
    NEXT[Next.js 16 App Router]
    ENG[src/lib/engine/*]
    UI[components + dashboard]
    API[/api/scenario + /api/regional-poll]
  end
  CFG --> PY
  EU --> PY
  PY --> RES
  CFG --> ENG
  EU --> ENG
  RES --> ENG
  SNAP --> UI
  ENG --> API
  API --> UI
  NEXT --> UI
```

| Layer | Tecnologie |
|-------|------------|
| Motore originale | Python 3, stdlib (`json`, `random`, `csv`) |
| Motore web | TypeScript, `python-random` + `gauss`/`gammavariate` allineati a CPython |
| Frontend | React 19, Tailwind 4, `react-simple-maps`, D3 scale |
| Auth | Auth.js v5 (`next-auth`), JWT, credentials |
| Test | Vitest |
| Hosting | Vercel (`platform`) |

---

## 3. Pacchetto Python v3.2

### 3.1 File principali

| File | Ruolo |
|------|--------|
| `modello_fn_v3_2.py` | Calcolo scenario, storico, evaluate, template CSV |
| `config_v3_2.json` | Input (iscritti, pesi, flussi Ipsos, MC, S) |
| `eu2024.json` | Voti validi, FdI, Lega per regione (`D`) |
| `risultati_v3_2.json` | Output golden |
| `scenario_congelato_18-10-2026.json` | Snapshot ex ante immutabile |
| `SHA256_CHECKSUM.txt` | Integrità pacchetto |

### 3.2 Regioni e circoscrizioni (identiche in Python e TS)

```1:32:platform/src/lib/engine/constants.ts
export const REGIONS = [
  "Piemonte",
  "Valle d'Aosta",
  // ... 20 regioni ...
  "Sardegna",
] as const;

export const CIRC: Record<string, readonly Region[]> = {
  NO: REGIONS.slice(0, 4),
  NE: REGIONS.slice(4, 8),
  C: REGIONS.slice(8, 12),
  S: REGIONS.slice(12, 18),
  I: REGIONS.slice(18),
};
```

Python equivalente:

```python
R=["Piemonte","Valle d'Aosta", ... ,"Sardegna"]
CIRC={'NO':R[:4], 'NE':R[4:8], 'C':R[8:12], 'S':R[12:18], 'I':R[18:]}
```

### 3.3 CLI Python

```bash
python modello_fn_v3_2.py --output risultati_ricalcolati.json
python modello_fn_v3_2.py --storico storico_iscritti.csv --output storico.json
python modello_fn_v3_2.py --snapshot scenario_congelato_18-10-2026.json --esiti esiti.csv --output validazione.json
python modello_fn_v3_2.py --crea-template
```

---

## 4. Modello matematico (dettaglio)

### 4.1 Parametri chiave (`config_v3_2.json`)

Estratto strutturale:

```json
{
  "sondaggio_nazionale": 0.072,
  "pesi": { "flussi": 0.35, "pref": 0.25, "isc": 0.25, "ist": 0.15 },
  "flussi_ipsos": { "FdI": 0.31, "Lega": 0.25, "ast": 0.36 },
  "lambda_istituzionale": 30,
  "monte_carlo": {
    "simulazioni": 20000,
    "seme": 42,
    "concentrazione_dirichlet": 20,
    "sd_sondaggio": 0.012
  },
  "iscritti_totali_dichiarati": 158320
}
```

`altri` nei flussi: `1 - FdI - Lega - ast` (residuo sulla quota elettorato `q`).

### 4.2 Ricostruzione elettorato e preferenze

Per ogni regione `r`:

- `valid[r]` da `eu2024.json`
- `ratio = sum(valid) / italia_2024.votanti`
- `votanti[r] = valid[r] / ratio`
- `elettori[r] = votanti[r] / (affluenza[r]/100)`
- `ast[r] = elettori[r] - votanti[r]`

**Preferenze per circoscrizione:** totale circoscrizione = `preferenze_circoscrizione[c] * k` con  
`k = preferenze_totali / sum(preferenze_circoscrizione)`.

- Regioni in `preferenze_regionali_osservate` → valore **osservato**
- Altre nella stessa circoscrizione → ripartizione del residuo **proporzionale a Lega 2024** (`ricostruito`)

### 4.3 Indici territoriali

| Simbolo | Definizione |
|---------|-------------|
| `q` | `norm(valid)` — quota elettorato |
| `f` | Mix flussi Ipsos su `norm(FdI)`, `norm(Lega)`, `norm(ast)`, `q` |
| `v` | `norm(preferenze)` |
| `s` | `norm(iscritti)` |
| `m` | Istituzioni: punteggi cariche + smoothing `(punti + λ·q) / (sum(punti)+λ)` |
| `p` | `w_f·f + w_p·v + w_i·s + w_t·m` poi normalizzato implicitamente via mix su regioni |
| `b` | `norm(FdI + Lega)` benchmark |

### 4.4 Stime per regione

```
stima[r]     = S * p[r] / q[r]
benchmark[r] = S * b[r] / q[r]
voti_scenario = S * p[r] * V    (V = sum(valid))
```

Python (nucleo):

```python
p=mix(w); b=norm({r:fdi[r]+lega[r] for r in R}); S=cfg['sondaggio_nazionale']
yp=S*p[r]/q[r]; yb=S*b[r]/q[r]
```

### 4.5 Metriche

- **H(x)**: entropia normalizzata su 20 regioni (`-sum(v log v)/log(20)`)
- **KL, JS**: divergenze tra distribuzioni territoriali
- **differenza_media_ponderata_scenario_benchmark_punti**: ~0,976 pp (diagnostica)
- Valori golden H: iscritti **0,898449**, scenario **0,884337**, elettorato **0,886090**

### 4.6 Scenari alternativi (stabilità)

Pesi fissi predefiniti (`Pesi uguali`, `Solo flussi`, …) → `min_pesi` / `max_pesi` per riga.

---

## 5. Monte Carlo e parità RNG

### 5.1 Algoritmo (Python e TS identici)

Per ogni simulazione `i = 1..N`:

1. Campiona pesi `α` via Dirichlet: `g_k ~ Gamma(w_k * c, 1)`, `α_k = g_k / sum(g)`
2. `pp = mix(α)`
3. `SS = max(0.02, Normal(S, sd_sondaggio))`
4. Per ogni regione: push `SS * pp[r] / q[r]` in `simulations[r]`
5. `lo10`, `hi90` = quantili 0.1 e 0.9

TypeScript:

```208:233:platform/src/lib/engine/calculate.ts
  const N = nSim ?? working.monte_carlo.simulazioni;
  const seed = working.monte_carlo.seme;
  // ...
  if (N > 0) {
    const rng = new PythonRandom(seed);
    const c = working.monte_carlo.concentrazione_dirichlet;
    const sd = working.monte_carlo.sd_sondaggio;
    for (let i = 0; i < N; i++) {
      const g = weightValues.map((a) => rng.gammavariate(a * c, 1));
      const z = g.reduce((a, b) => a + b, 0);
      // ... alpha from g/z ...
      const pp = mix(alpha, f, v, s, m);
      const SS = Math.max(0.02, rng.gauss(S, sd));
      for (const r of REGIONS) {
        simulations[r].push((SS * pp[r]) / q[r]);
      }
    }
  }
```

### 5.2 Fast path piattaforma

`calculate(cfg, eu, nSim=0, overrides)` → **salta** il loop MC; `lo10`/`hi90` = stima puntual.

Usato dalla dashboard per risposta immediata agli slider; MC completo via API.

---

## 6. Piattaforma Next.js

### 6.1 Directory dati

```
platform/data/
  config_v3_2.json
  eu2024.json
  risultati_v3_2.json
  scenario_congelato_18-10-2026.json
```

Caricamento server-side:

```15:19:platform/src/lib/engine/loadData.ts
export function runDefaultScenario(nSim?: number): ScenarioResult {
  const cfg = loadJson<FnConfig>("config_v3_2.json");
  const euRaw = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json");
  return calculate(cfg, euRaw.D, nSim);
}
```

### 6.2 Entry dashboard

```8:20:platform/src/app/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await auth();
  const initialScenario = runDefaultScenario();
  const frozenSnapshot = loadJson<ScenarioResult>(
    "scenario_congelato_18-10-2026.json",
  );
  return (
    <DashboardClient
      initialScenario={initialScenario}
      frozenSnapshot={frozenSnapshot}
      userEmail={session?.user?.email}
    />
  );
}
```

- **initialScenario**: ricalcolo live (default ufficiale + MC 20k al load)
- **frozenSnapshot**: immutabile per storico/post-voto

### 6.3 GeoJSON

`platform/public/geo/regioni-italia.geojson` — mappa choropleth, nessuna dipendenza runtime da CDN esterno per i confini.

### 6.4 Template CSV

- `public/templates/storico_iscritti_TEMPLATE.csv` → `mese,regione,iscritti`
- `public/templates/esiti_futuri_TEMPLATE.csv` → `regione,voti_validi,voti_fn`

---

## 7. Motore TypeScript (`calculate.ts`)

### 7.1 Overrides (scenari what-if)

```16:19:platform/src/lib/engine/calculate.ts
export type CalculateOverrides = {
  S?: number;
  pesi?: Weights;
};
```

`normalizePesi()` ri-normalizza i pesi UI a somma 1.

### 7.2 Funzione `mix`

```32:47:platform/src/lib/engine/calculate.ts
function mix(
  alpha: Weights,
  f: RegionMap,
  v: RegionMap,
  s: RegionMap,
  m: RegionMap,
): RegionMap {
  const out = {} as RegionMap;
  for (const r of REGIONS) {
    out[r] =
      alpha.flussi * f[r] +
      alpha.pref * v[r] +
      alpha.isc * s[r] +
      alpha.ist * m[r];
  }
  return out;
}
```

### 7.3 Controlli di coerenza

- Somma `p` ≈ 1 (`1e-12`)
- Somma `voti_di_scenario` ≈ `S * V` (`1e-4`)
- Metadati output includono `predizione_validata: false`

### 7.4 Parametri ufficiali UI

```3:10:platform/src/lib/engine/defaults.ts
export const OFFICIAL_S = 0.072;

export const OFFICIAL_PESI: FnConfig["pesi"] = {
  flussi: 0.35,
  pref: 0.25,
  isc: 0.25,
  ist: 0.15,
};
```

`isOfficialParams(S, pesi)` → badge **SCENARIO PERSONALIZZATO (NON UFFICIALE)** se fuori tolleranza.

---

## 8. API HTTP

### 8.1 `POST /api/scenario`

Body JSON:

```typescript
{
  S?: number;           // es. 0.072
  pesi?: FnConfig["pesi"];
  nSim?: number;        // 0 = solo deterministico; default 20000
}
```

Implementazione:

```8:26:platform/src/app/api/scenario/route.ts
export async function POST(req: Request) {
  const body = (await req.json()) as { S?: number; pesi?: FnConfig["pesi"]; nSim?: number };
  const cfg = loadJson<FnConfig>("config_v3_2.json");
  const eu = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json").D;
  const overrides: CalculateOverrides = {};
  if (body.S !== undefined) overrides.S = body.S;
  if (body.pesi !== undefined) overrides.pesi = body.pesi;
  const nSim = body.nSim ?? cfg.monte_carlo.simulazioni;
  const result = calculate(cfg, eu, nSim, overrides);
  return Response.json(result);
}
```

**Nota:** endpoint non protetto da middleware separato; l’app è dietro login su `/dashboard`, ma in produzione valutare rate limiting se esposto.

### 8.2 `POST /api/regional-poll`

Body:

```typescript
{
  scenario: ScenarioResult;  // scenario corrente (anche custom)
  config?: Partial<RegionalPollConfig>;
}
```

Risposta: `{ poll: RegionPollResult[], config }`.

---

## 9. Dashboard e UX

### 9.1 Debounce Monte Carlo e poll

```91:98:platform/src/components/DashboardClient.tsx
  useEffect(() => {
    fetchScenario(0);
    if (mcTimer.current) clearTimeout(mcTimer.current);
    mcTimer.current = setTimeout(() => fetchScenario(20000), 250);
    return () => {
      if (mcTimer.current) clearTimeout(mcTimer.current);
    };
  }, [fetchScenario]);
```

Sequenza:

1. Cambio `S` o pesi → **immediato** `nSim=0`
2. Dopo **250 ms** senza ulteriori cambi → `nSim=20000`
3. `reqId` / `pollReqId` scartano risposte stale

### 9.2 Tab

| Tab | Moduli engine | Input |
|-----|---------------|-------|
| Scenario & sondaggio | `calculate`, `computeRegionalPoll` | Slider + API |
| Storico iscritti | `parseHistory` | CSV upload |
| Post-voto | `evaluatePostVote`, `evaluatePostVoteWithPoll` | CSV upload |

### 9.3 Export PDF

`PrintNotaReport.tsx` + `@media print` — stampa browser / PDF locale (“Nota Demoscopica & Scenario Dirigenza”). Include flussi Ipsos attivi, riepilogo delta istituzionale, colonne margine soglia e salute tessere.

---

## 10. Simulatore sondaggio regionale

**Modulo:** `platform/src/lib/engine/regionalPoll.ts`  
**Non** fa parte del golden v3.2; estensione demoscopica simulata.

### 10.1 Config default

```27:35:platform/src/lib/engine/regionalPoll.ts
export const DEFAULT_POLL_CONFIG: RegionalPollConfig = {
  sampleMode: "fixed1000",
  confidenceLevel: 0.95,
  designEffect: 1.15,
  thresholdPct: 3.0,
  turnoutDeltaPct: 0,
  pollSeed: 42,
  pollDraws: 10_000,
};
```

### 10.2 Formule

| Grandezza | Formula / logica |
|-----------|------------------|
| `piHat` | `adjustPiHatForTurnout(stima, affluenza, delta)` — lift moderato se affluenza cambia |
| `Nr` | 600 / 1000 / 2000 o proporzionale a validi 2024 |
| `SE_sample` | `sqrt(deff * piHat * (1-piHat) / Nr)` |
| `SE_model` | `(hi90 - lo10) / 2.563` (approx. p10–p90 → σ) |
| `SE_tot` | `sqrt(SE_model² + SE_sample²)` |
| `MoE` | `z * SE_tot` (z da livello confidenza) |
| `probAboveThreshold` | Monte Carlo: `draw ~ N(piHat, SE_tot)`, fraction ≥ soglia |

Core loop:

```169:206:platform/src/lib/engine/regionalPoll.ts
export function computeRegionalPoll(
  scenario: ScenarioResult,
  config: RegionalPollConfig = DEFAULT_POLL_CONFIG,
): RegionPollResult[] {
  // ...
  const SE_tot = Math.sqrt(SE_model ** 2 + SE_sample ** 2);
  const probAboveThreshold = simulateThresholdProbability(
    piHat, SE_tot, threshold, config.pollDraws, seed,
  );
  classificazione: classifyThresholdProbability(probAboveThreshold),
  // sicura >= 0.9, contesa >= 0.35, altrimenti critica
}
```

### 10.3 UI

- `RegionalPollControls`, `RegionalPollTable`, `RegionPollDrawer`
- `ItalyMap` — modalità colore: stima, prob. soglia, scarto benchmark
- Toggle **Confronta snapshot 18-10-2026** (Δ pp vs `scenario_congelato` per regione)
- Colonne **Margine Soglia (voti)** e **Salute Tessere** (`statoTesseramento`)

### 10.4 Metriche territoriali (estensione 2026)

Per ogni regione, oltre ai campi storici del poll:

| Campo | Definizione |
|-------|-------------|
| `validiAttesi` | `round(validi2024 × (1 + turnoutDeltaPct/100))` |
| `votiStimatiSondaggio` | `round(piHat × validiAttesi)` |
| `votiSoglia` | `round((thresholdPct/100) × validiAttesi)` |
| `margineVotiSoglia` | `votiStimatiSondaggio − votiSoglia` |
| `rapportoIscrittiFlussi` | `row.s / max(1e-6, row.f)` |
| `votiPerIscritto` | `voti_di_scenario / max(1, iscritti)` |
| `statoTesseramento` | `anomalia_tessere` se rapporto > 1.35; `da_strutturare` se < 0.70; altrimenti `equilibrato` |

**Drawer regionale — Campagna Acquisti:** delta istituzionale rapido (`dep/creg/sind/com`) per la regione aperta, sommato via `mergeIstituzioniDelta.ts` al delta del registro Locali (se applicato) e inviato come `istituzioniDelta` a `/api/scenario`.

### 10.5 Flussi mercato 2026 (UI Scenario)

- `OFFICIAL_FLUSSI` in `defaults.ts` (31/25/36) allineato a `config_v3_2.json`
- Slider + preset in `SensitivityControls.tsx`; payload `flussi_ipsos` solo se ≠ ufficiale
- `isOfficialParams(S, pesi, flussi_ipsos?, istituzioniDelta?)` — scenario “golden” solo se tutti allineati e delta istituzionale nullo

### 10.6 News — geo lookup (`italianGeoLookup.ts`)

Lookup deterministico (no API esterne): comuni/capoluoghi in `italianGeoData.ts`, slug feed ANSA regionali, keyword ruolo (`sind`, `creg`, `com`, `dep`). Output su `NewsCandidate`: `suggestedRegion`, `suggestedComune`, `suggestedRole`. Persistenza registro client: `localiStorage.ts` (localStorage).

---

## 11. Storico iscritti e post-voto

### 11.1 `parseHistory`

Port Python `parse_history`. Mesi **COMPLETI** (20 regioni) → H, ΔH, JS vs mese precedente.

**H scenario condizionato** (con baseline snapshot): congela `f`, `v`, `m` dallo snapshot; sostituisce solo componente iscritti `s` con il mese osservato:

```78:91:platform/src/lib/engine/parseHistory.ts
      for (const r of REGIONS) {
        mixT[r] =
          weights.flussi * frozen[r].f +
          weights.pref * frozen[r].v +
          weights.isc * pp[r] +
          weights.ist * frozen[r].m;
      }
      entry.H_scenario_condizionato = entropyH(mixT);
```

### 11.2 `evaluatePostVote`

**Usa esclusivamente** lo snapshot passato (non ricalcola scenario ex post).

```33:37:platform/src/lib/engine/evaluatePostVote.ts
/** Port di `evaluate()` — usa ESCLUSIVAMENTE lo snapshot congelato ex ante. */
export function evaluatePostVote(
  snapshot: ScenarioResult,
  csvContent: string,
): PostVoteResult {
```

Metriche:

- MAE / RMSE ponderati su quote elettorali osservate (`q_actual`)
- **Skill** vs benchmark: `1 - MAE_scenario / MAE_benchmark`
- **Controllo geografico**: ricalcolo con `S_actual` osservato e stesse `p`, `b` del snapshot
- **Copertura**: frazione regioni con `obs[r]` ∈ `[lo10, hi90]` del snapshot

Python equivalente (`evaluate` in `modello_fn_v3_2.py` linee 104–129).

### 11.3 `evaluatePostVoteWithPoll`

`historyAndEval.ts` — estende post-voto con `copertura_forbice_sondaggio` (confronto voto vs IC simulato).

---

## 12. Autenticazione e sicurezza

### 12.1 Auth.js credentials

```14:39:platform/src/auth.ts
export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const list = allowlist();
        if (!email || !list.has(email)) return null;
        const expected = process.env.PLATFORM_PASSWORD ?? "";
        if (!expected || password !== expected) return null;
        return { id: email, email };
      },
    }),
  ],
  session: { strategy: "jwt" },
});
```

### 12.2 Middleware

```1:13:platform/src/middleware.ts
export default auth((req) => {
  if (!req.auth) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(login);
  }
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
```

### 12.3 Variabili ambiente (Vercel / `.env.local`)

| Variabile | Uso |
|-----------|-----|
| `AUTH_SECRET` | Firma JWT (≥ 32 char) |
| `ALLOWLIST_EMAILS` | CSV email autorizzate |
| `PLATFORM_PASSWORD` | Password condivisa staff |

Template: `platform/.env.example`. **Non committare** segreti.

---

## 13. Test e golden parity

### 13.1 Suite

```bash
cd platform
npm run test   # vitest run
```

File principali:

- `golden.test.ts` — parità vs `data/risultati_v3_2.json`
- `regionalPoll.test.ts` — simulatore
- `historyAndEval.test.ts` — storico + post-voto (confronto subprocess Python opzionale)

### 13.2 Golden test (estratti)

```19:48:platform/src/lib/engine/golden.test.ts
  it("metriche H e diff media benchmark", () => {
    const out = calculate(cfg, eu, 500);
    expect(out.metriche.H.iscritti).toBeCloseTo(golden.metriche.H.iscritti, 6);
    expect(out.metriche.H.scenario).toBeCloseTo(golden.metriche.H.scenario, 6);
    // ...
  });

  it("stima e p per ogni regione (deterministico)", () => {
    const out = calculate(cfg, eu, 100);
    for (const g of golden.righe) {
      const row = out.righe.find((r) => r.regione === g.regione)!;
      expect(row.stima).toBeCloseTo(g.stima, 10);
      expect(row.p).toBeCloseTo(g.p, 10);
    }
  });
```

Test MC completo: `calculate(cfg, eu, 20000)` → `lo10`/`hi90` Piemonte vs golden.

---

## 14. Deploy Vercel

| | |
|---|---|
| URL produzione (esempio progetto) | https://platform-sigma-beige.vercel.app |
| CLI | `npm run deploy` / `npm run deploy:prod` da `platform/` |

**Checklist post-deploy:**

1. Impostare le 3 env in Production
2. Redeploy
3. Login allowlist
4. Verificare mappa GeoJSON e tabella 20 regioni

**Deployment Protection Vercel:** può mostrare login Vercel prima del form FN — configurazione team-specific.

---

## 15. Ottimizzazioni progettuali

| Area | Scelta | Motivo |
|------|--------|--------|
| Parità TS/Python | Golden test + RNG CPython-like | Un solo “vero” ufficiale v3.2 |
| MC debounced + nSim=0 | UX slider | Latenza percepita bassa |
| Snapshot JSON congelato | Audit ex ante | Post-voto non “ricorda” future versioni |
| Poll sim separato | `regionalPoll.ts` | Estensione senza toccare golden |
| GeoJSON locale | Affidabilità mappa | No fetch confini a runtime |
| Auth allowlist | MVP interno | No DB utenti |
| Export print CSS | Zero dipendenza PDF server | Report dirigenza immediato |

---

## 16. Roadmap

| Item | Stato |
|------|--------|
| Sensibilità live + API scenario | ✅ |
| Storico iscritti CSV | ✅ |
| Post-voto + snapshot | ✅ |
| Simulatore sondaggio regionale | ✅ |
| Export nota PDF (print) | ✅ |
| GeoJSON locale | ✅ |
| **Snapshot DB** (Neon + Drizzle, versioni, diff, audit) | 🔜 pianificato |

---

## 17. Appendice

### 17.1 Struttura `platform/src` (engine + app)

```
platform/src/
  app/
    page.tsx                    # redirect login/dashboard
    login/page.tsx
    dashboard/page.tsx
    api/scenario/route.ts
    api/regional-poll/route.ts
    api/auth/[...nextauth]/route.ts
  lib/engine/
    calculate.ts                # motore core
    constants.ts, math.ts, types.ts
    pythonDistributions.ts
    loadData.ts, defaults.ts
    parseHistory.ts
    evaluatePostVote.ts
    regionalPoll.ts
    historyAndEval.ts
    golden.test.ts
    regionalPoll.test.ts
    historyAndEval.test.ts
  components/
    DashboardClient.tsx
    SensitivityControls.tsx
    ItalyMap.tsx
    HistoryPanel.tsx
    PostVotePanel.tsx
    PrintNotaReport.tsx
    RegionalPoll*.tsx
  auth.ts
  middleware.ts
```

### 17.2 Comandi utili

```bash
# Modello Python (radice repo)
python modello_fn_v3_2.py

# Piattaforma
cd platform && npm install && npm run test && npm run dev
cd platform && npm run build
cd platform && npm run deploy:prod

# Guida PDF semplice
python scripts/generate_guida_pdf.py
```

### 17.3 Esempio riga output (`ScenarioRow`)

Campi principali per regione (JSON `righe[]`):

- Input eco: `validi2024`, `FdI2024`, `Lega2024`, `affluenza2024`, `iscritti`, `tipo_preferenze`
- Indici: `q`, `f`, `v`, `s`, `m`, `p`, `b`
- Output: `stima`, `benchmark`, `voti_di_scenario`, `lo10`, `hi90`, `min_pesi`, `max_pesi`

### 17.4 Riferimenti legali / metodologici nel codice

Header Python:

```1:8:modello_fn_v3_2.py
"""Futuro Nazionale - scenario regionale v3.2 / audit predittivo.
...
Non produce probabilità di esiti elettorali e NON afferma validazione predittiva.
"""
```

Output metadati TS:

```297:307:platform/src/lib/engine/calculate.ts
    metadati: {
      titolo: "Scenario territoriale FN v3.2",
      predizione_validata: false,
      diagnostica:
        "Sensibilità e confronti strutturali NON equivalgono ad accuratezza predittiva",
      seme: seed,
      simulazioni: N,
    },
```

---

*Fine report — Futuro Nazionale v3.2 + platform.*
