# Consenso nazionale live — implementazione completa (codice)

Documento autoconclusivo con **tutto il codice** del modulo consenso live: aggregato FN in-house, sync Supermedia, API REST, hook React, dati seed e test.

**Stato:** codice presente nel repository sotto i path indicati. Integrazione UI in `DashboardClient` descritta in fondo (non ancora collegata di default).

---

## Metodologia (sintesi)

| Provider | Regole |
|----------|--------|
| **Supermedia YouTrend/AGI** | Media ponderata (non aritmetica); finestra **14 giorni** fieldwork; **1 sondaggio per istituto** (il più recente); pesi: **recency**, **campione**, **metodo**, **istituto** (parte non pubblica). Fonte: [supermedia.youtrend.it/metodologia](https://supermedia.youtrend.it/metodologia/) |
| **FN Aggregate v1** | Stesse regole **documentate** in piattaforma: `w = exp(-giorni/τ) × √(n/1500) × tier_metodo`; **non** replica i pesi segreti YouTrend per istituto. |

**API:** `GET /api/consenso/live?mode=auto|aggregate|supermedia`

- `auto` — aggregato se ≥2 poll in `poll_releases.json`, altrimenti ultimo punto Supermedia (`fnSupermediaConsensoSeries.ts`).
- `aggregate` — forza FN Aggregate v1.
- `supermedia` — forza ultima Supermedia curata.

---

## 1. `src/lib/engine/pollTypes.ts`

```typescript
/** Singola rilevazione pubblicata (intenzioni di voto nazionali). */
export type PollRelease = {
  id: string;
  institute: string;
  /** Ultimo giorno fieldwork (ISO date YYYY-MM-DD). */
  fieldEnd: string;
  /** Data pubblicazione su media (ISO). */
  publishedAt: string;
  /** Percentuale Futuro Nazionale (0–100). */
  fnPct: number;
  /** Campione se noto. */
  sampleSize?: number;
  /** CATI | CAWI | mixed | unknown */
  method?: "CATI" | "CAWI" | "mixed" | "unknown";
  sourceUrl?: string;
};

export type ConsensoMethodId = "FN_AGGREGATE_V1" | "SUPERMEDIA_SYNC" | "MANUAL";

export type LiveConsensoPayload = {
  s: number;
  sPct: number;
  method: ConsensoMethodId;
  reliabilityTier: "ALTA" | "MEDIA";
  asOf: string;
  sourceLabel: string;
  sourceUrl?: string;
  confidenceBandPp: [number, number];
  pollsUsed: Array<{
    institute: string;
    fieldEnd: string;
    fnPct: number;
    weight: number;
  }>;
  supermediaReference?: {
    pct: number;
    isoDate: string;
    caption: string;
  };
  aggregateReference?: {
    pct: number;
    pollCount: number;
    windowDays: number;
  };
};
```

---

## 2. `src/lib/engine/fnNationalAggregate.ts`

```typescript
import type { PollRelease } from "./pollTypes";

/** Finestra mobile (allineata a Supermedia YouTrend). */
export const AGGREGATE_WINDOW_DAYS = 14;

/** Decadimento recency: exp(-days / RECENCY_TAU). */
export const RECENCY_TAU_DAYS = 6;

const METHOD_TIER: Record<NonNullable<PollRelease["method"]>, number> = {
  CATI: 1.0,
  mixed: 0.92,
  CAWI: 0.88,
  unknown: 0.85,
};

export type AggregateOptions = {
  /** Data di riferimento (default: oggi UTC). */
  asOf?: Date;
  windowDays?: number;
  recencyTauDays?: number;
};

export type AggregateResult = {
  fnPct: number;
  s: number;
  pollsUsed: Array<{
    institute: string;
    fieldEnd: string;
    fnPct: number;
    weight: number;
  }>;
  confidenceBandPp: [number, number];
  windowDays: number;
};

function parseIsoDay(iso: string): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${iso}`);
  return d;
}

function daysBetween(older: Date, newer: Date): number {
  return (newer.getTime() - older.getTime()) / (86400 * 1000);
}

/** Un solo sondaggio per istituto: il più recente per fieldEnd. */
export function dedupeLatestPerInstitute(
  releases: PollRelease[],
): PollRelease[] {
  const byInst = new Map<string, PollRelease>();
  for (const r of releases) {
    const key = r.institute.trim().toLowerCase();
    const prev = byInst.get(key);
    if (!prev || r.fieldEnd >= prev.fieldEnd) byInst.set(key, r);
  }
  return [...byInst.values()];
}

export function filterReleasesInWindow(
  releases: PollRelease[],
  asOf: Date,
  windowDays: number,
): PollRelease[] {
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays);
  return releases.filter((r) => {
    const end = parseIsoDay(r.fieldEnd);
    return end >= cutoff && end <= asOf;
  });
}

function sampleWeight(n: number | undefined): number {
  if (n == null || n <= 0) return 0.85;
  return Math.min(1, Math.sqrt(n / 1500));
}

function pollWeight(r: PollRelease, asOf: Date, tau: number): number {
  const end = parseIsoDay(r.fieldEnd);
  const days = Math.max(0, daysBetween(end, asOf));
  const wRecency = Math.exp(-days / tau);
  const wSample = sampleWeight(r.sampleSize);
  const wMethod = METHOD_TIER[r.method ?? "unknown"];
  return wRecency * wSample * wMethod;
}

/**
 * Aggregato FN in-house: media ponderata (recency × campione × metodo).
 * Metodo documentato — non replica i pesi segreti per-istituto YouTrend.
 */
export function computeFnNationalAggregate(
  releases: PollRelease[],
  options: AggregateOptions = {},
): AggregateResult | null {
  const asOf = options.asOf ?? new Date();
  const windowDays = options.windowDays ?? AGGREGATE_WINDOW_DAYS;
  const tau = options.recencyTauDays ?? RECENCY_TAU_DAYS;

  const inWindow = filterReleasesInWindow(releases, asOf, windowDays);
  const deduped = dedupeLatestPerInstitute(inWindow);
  if (deduped.length === 0) return null;

  let sumW = 0;
  let sumWx = 0;
  const pollsUsed: AggregateResult["pollsUsed"] = [];
  const pcts: number[] = [];

  for (const r of deduped) {
    const w = pollWeight(r, asOf, tau);
    sumW += w;
    sumWx += w * r.fnPct;
    pcts.push(r.fnPct);
    pollsUsed.push({
      institute: r.institute,
      fieldEnd: r.fieldEnd,
      fnPct: r.fnPct,
      weight: Math.round(w * 1000) / 1000,
    });
  }

  if (sumW <= 0) return null;

  const fnPct = Math.round((sumWx / sumW) * 100) / 100;
  const mean = pcts.reduce((a, b) => a + b, 0) / pcts.length;
  const variance =
    pcts.length > 1
      ? pcts.reduce((acc, p) => acc + (p - mean) ** 2, 0) / (pcts.length - 1)
      : 0.25;
  const sd = Math.sqrt(variance);
  const halfBand = Math.max(0.15, Math.min(1.2, sd * 0.8));

  return {
    fnPct,
    s: fnPct / 100,
    pollsUsed: pollsUsed.sort((a, b) => b.weight - a.weight),
    confidenceBandPp: [
      Math.round((fnPct - halfBand) * 10) / 10,
      Math.round((fnPct + halfBand) * 10) / 10,
    ],
    windowDays,
  };
}
```

---

## 3. `src/lib/engine/supermediaFnSync.ts`

```typescript
import {
  FN_SUPERMEDIA_CONSENSO_SERIES,
  type FnSupermediaPollPoint,
} from "@/lib/fnSupermediaConsensoSeries";
import { OFFICIAL_S_SOURCE_LABEL, OFFICIAL_S_SOURCE_URL } from "./defaults";

export type SupermediaFnSnapshot = {
  pct: number;
  s: number;
  isoDate: string;
  caption: string;
  sourceLabel: string;
  sourceUrl: string;
};

/** Ultimo punto FN nella serie Supermedia curata / sincronizzata. */
export function latestSupermediaFnPoint(): SupermediaFnSnapshot | null {
  const series = FN_SUPERMEDIA_CONSENSO_SERIES;
  if (!series.length) return null;
  const last = series[series.length - 1] as FnSupermediaPollPoint;
  return {
    pct: last.pct,
    s: last.pct / 100,
    isoDate: last.isoDate,
    caption: last.caption,
    sourceLabel: OFFICIAL_S_SOURCE_LABEL,
    sourceUrl: OFFICIAL_S_SOURCE_URL,
  };
}

/** Serie completa per grafici e audit. */
export function supermediaFnHistory(): FnSupermediaPollPoint[] {
  return [...FN_SUPERMEDIA_CONSENSO_SERIES];
}
```

---

## 4. `src/lib/engine/liveConsensoService.ts`

```typescript
import { loadJson } from "./loadData";
import { computeFnNationalAggregate } from "./fnNationalAggregate";
import { latestSupermediaFnPoint } from "./supermediaFnSync";
import type { LiveConsensoPayload, PollRelease } from "./pollTypes";

type PollReleasesFile = { releases: PollRelease[] };

export type LiveConsensoMode = "aggregate" | "supermedia" | "auto";

function loadPollReleases(): PollRelease[] {
  try {
    const file = loadJson<PollReleasesFile>("poll_releases.json");
    return file.releases ?? [];
  } catch {
    return [];
  }
}

/**
 * Consenso nazionale live: aggregato FN e/o ultima Supermedia.
 * `auto`: preferisce aggregato se ≥2 poll in finestra, altrimenti Supermedia.
 */
export function buildLiveConsensoPayload(
  mode: LiveConsensoMode = "auto",
): LiveConsensoPayload {
  const asOf = new Date().toISOString();
  const supermedia = latestSupermediaFnPoint();
  const aggregate = computeFnNationalAggregate(loadPollReleases());

  let method: LiveConsensoPayload["method"] = "MANUAL";
  let s = supermedia?.s ?? 0.072;
  let sPct = supermedia?.pct ?? 7.2;
  let reliabilityTier: LiveConsensoPayload["reliabilityTier"] = "ALTA";
  let sourceLabel = supermedia?.sourceLabel ?? "Fallback piattaforma";
  let sourceUrl = supermedia?.sourceUrl;
  let confidenceBandPp: [number, number] = [sPct - 0.3, sPct + 0.3];
  let pollsUsed: LiveConsensoPayload["pollsUsed"] = [];

  const pickAggregate =
    mode === "aggregate" ||
    (mode === "auto" && aggregate != null && aggregate.pollsUsed.length >= 2);
  const pickSupermedia =
    mode === "supermedia" ||
    (mode === "auto" && !pickAggregate && supermedia != null);

  if (pickAggregate && aggregate) {
    method = "FN_AGGREGATE_V1";
    s = aggregate.s;
    sPct = aggregate.fnPct;
    reliabilityTier = "MEDIA";
    sourceLabel = "Aggregato FN v1 (sondaggi pubblici in finestra 14 gg)";
    sourceUrl = undefined;
    confidenceBandPp = aggregate.confidenceBandPp;
    pollsUsed = aggregate.pollsUsed;
  } else if (pickSupermedia && supermedia) {
    method = "SUPERMEDIA_SYNC";
    s = supermedia.s;
    sPct = supermedia.pct;
    reliabilityTier = "ALTA";
    sourceLabel = supermedia.sourceLabel;
    sourceUrl = supermedia.sourceUrl;
    confidenceBandPp = [sPct - 0.25, sPct + 0.25];
  }

  return {
    s,
    sPct,
    method,
    reliabilityTier,
    asOf,
    sourceLabel,
    sourceUrl,
    confidenceBandPp,
    pollsUsed,
    supermediaReference: supermedia
      ? {
          pct: supermedia.pct,
          isoDate: supermedia.isoDate,
          caption: supermedia.caption,
        }
      : undefined,
    aggregateReference: aggregate
      ? {
          pct: aggregate.fnPct,
          pollCount: aggregate.pollsUsed.length,
          windowDays: aggregate.windowDays,
        }
      : undefined,
  };
}
```

---

## 5. `src/app/api/consenso/live/route.ts`

```typescript
import {
  buildLiveConsensoPayload,
  type LiveConsensoMode,
} from "@/lib/engine/liveConsensoService";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseMode(raw: string | null): LiveConsensoMode {
  if (raw === "aggregate" || raw === "supermedia" || raw === "auto") return raw;
  return "auto";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = parseMode(searchParams.get("mode"));
  const payload = buildLiveConsensoPayload(mode);

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
```

---

## 6. `src/components/useLiveConsenso.ts`

```typescript
"use client";

import type { LiveConsensoPayload } from "@/lib/engine/pollTypes";
import { useCallback, useEffect, useState } from "react";

export function useLiveConsenso(options?: {
  enabled?: boolean;
  mode?: "auto" | "aggregate" | "supermedia";
  pollMs?: number;
}) {
  const enabled = options?.enabled ?? false;
  const mode = options?.mode ?? "auto";
  const pollMs = options?.pollMs ?? 3_600_000;

  const [data, setData] = useState<LiveConsensoPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/consenso/live?mode=${mode}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LiveConsensoPayload;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore consenso live");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(id);
  }, [enabled, pollMs, refresh]);

  return { data, loading, error, refresh };
}
```

---

## 7. `src/lib/engine/fnNationalAggregate.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import {
  computeFnNationalAggregate,
  dedupeLatestPerInstitute,
} from "./fnNationalAggregate";
import type { PollRelease } from "./pollTypes";

const base: PollRelease[] = [
  {
    id: "a1",
    institute: "SWG",
    fieldEnd: "2026-10-14",
    publishedAt: "2026-10-15",
    fnPct: 8.0,
    sampleSize: 3000,
    method: "mixed",
  },
  {
    id: "a2",
    institute: "SWG",
    fieldEnd: "2026-10-10",
    publishedAt: "2026-10-11",
    fnPct: 6.0,
    sampleSize: 3000,
    method: "mixed",
  },
  {
    id: "b1",
    institute: "Ipsos",
    fieldEnd: "2026-10-12",
    publishedAt: "2026-10-13",
    fnPct: 7.0,
    sampleSize: 2500,
    method: "CATI",
  },
];

describe("fnNationalAggregate", () => {
  it("dedupe tiene solo SWG più recente", () => {
    const d = dedupeLatestPerInstitute(base);
    expect(d).toHaveLength(2);
    expect(d.find((x) => x.institute === "SWG")?.fnPct).toBe(8.0);
  });

  it("calcola media ponderata in finestra", () => {
    const asOf = new Date("2026-10-16T12:00:00.000Z");
    const r = computeFnNationalAggregate(base, { asOf });
    expect(r).not.toBeNull();
    expect(r!.pollsUsed.length).toBe(2);
    expect(r!.fnPct).toBeGreaterThan(7);
    expect(r!.fnPct).toBeLessThan(8.5);
    expect(r!.s).toBeCloseTo(r!.fnPct / 100, 4);
  });
});
```

---

## 8. `data/poll_releases.json`

```json
{
  "releases": [
    {
      "id": "swg-2026-10-14",
      "institute": "SWG",
      "fieldEnd": "2026-10-14",
      "publishedAt": "2026-10-15",
      "fnPct": 7.4,
      "sampleSize": 3200,
      "method": "mixed",
      "sourceUrl": "https://www.youtrend.it/la-supermedia/"
    },
    {
      "id": "ipsos-2026-10-12",
      "institute": "Ipsos",
      "fieldEnd": "2026-10-12",
      "publishedAt": "2026-10-13",
      "fnPct": 7.0,
      "sampleSize": 2800,
      "method": "CATI",
      "sourceUrl": "https://www.youtrend.it/la-supermedia/"
    },
    {
      "id": "tecne-2026-10-10",
      "institute": "Tecnè",
      "fieldEnd": "2026-10-10",
      "publishedAt": "2026-10-11",
      "fnPct": 7.3,
      "sampleSize": 1500,
      "method": "CAWI",
      "sourceUrl": "https://www.youtrend.it/la-supermedia/"
    },
    {
      "id": "eumetra-2026-10-08",
      "institute": "Eumetra",
      "fieldEnd": "2026-10-08",
      "publishedAt": "2026-10-09",
      "fnPct": 6.9,
      "sampleSize": 2000,
      "method": "mixed",
      "sourceUrl": "https://www.youtrend.it/la-supermedia/"
    }
  ]
}
```

---

## 9. Integrazione `DashboardClient` (da aggiungere)

```typescript
import { useLiveConsenso } from "@/components/useLiveConsenso";

// Stato opzionale — dentro DashboardClient:
const [sLiveEnabled, setSLiveEnabled] = useState(false);
const { data: liveConsenso, refresh: refreshConsenso } = useLiveConsenso({
  enabled: sLiveEnabled,
  mode: "auto",
  pollMs: 3_600_000,
});

useEffect(() => {
  if (liveConsenso?.s != null && sLiveEnabled) {
    setS(liveConsenso.s);
  }
}, [liveConsenso?.s, sLiveEnabled]);
```

UI suggerita vicino al consenso nazionale:

- Toggle **«S live»**
- Badge `{liveConsenso?.reliabilityTier}` · `{liveConsenso?.method}`
- Tooltip con `pollsUsed` e link `sourceUrl`

---

## 10. Verifica

```bash
cd platform
npm run test -- --run src/lib/engine/fnNationalAggregate.test.ts
npm run dev
# altro terminale:
curl "http://localhost:3000/api/consenso/live?mode=auto"
```

Esempio risposta (schema):

```json
{
  "s": 0.071,
  "sPct": 7.1,
  "method": "FN_AGGREGATE_V1",
  "reliabilityTier": "MEDIA",
  "asOf": "2026-10-30T…",
  "sourceLabel": "Aggregato FN v1 (sondaggi pubblici in finestra 14 gg)",
  "confidenceBandPp": [6.9, 7.3],
  "pollsUsed": [ … ],
  "supermediaReference": { "pct": 7.2, "isoDate": "2026-10-15", … },
  "aggregateReference": { "pct": 7.1, "pollCount": 4, "windowDays": 14 }
}
```

---

## 11. Prossimi passi (non codificati qui)

1. **Cron Vercel** — append a `poll_releases.json` o tabella DB da parsing note Supermedia / RSS istituti.
2. **Scraper serie YouTrend** — aggiornare `FN_SUPERMEDIA_CONSENSO_SERIES` da Flourish/public CSV (partito «Futuro Nazionale» in tabella metodologia).
3. **Audit** — log in `audit_logs` quando S live modifica lo scenario rispetto a `OFFICIAL_S`.

---

*Futuro Nazionale · Piattaforma v3.2 · Ottobre 2026*
