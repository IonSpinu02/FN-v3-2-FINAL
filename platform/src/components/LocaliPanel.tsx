"use client";

import { computeIstituzioniDelta } from "@/lib/engine/localInstitutions";
import type {
  IstituzioniDeltaSummary,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";
import type { CalculateOverrides } from "@/lib/engine/calculate";
import type { FnConfig } from "@/lib/engine/types";
import type { CaricaLocale } from "@/lib/engine/localiTypes";
import {
  clearRegistryBrowser,
  loadRegistryFromBrowser,
  saveRegistryToBrowser,
} from "@/lib/engine/localiStorage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, Segmented } from "@/components/ui/FnUi";
import {
  InstitutionalRadixChart,
  type InstitutionalRadixRow,
} from "@/components/charts/AnalyticalChartsSuite";
import { LocaliDeltaBanner } from "./LocaliDeltaBanner";
import { LocaliRegistryTable } from "./LocaliRegistryTable";
import { NewsReviewPanel } from "./NewsReviewPanel";

function cleanComuneLabel(name: string): string {
  return name
    .replace(/^Esempio\s+/i, "")
    .replace(/\s*\(esempio\)\s*$/i, "")
    .trim();
}

function normalizeRegistryEntries(
  list: LocalRegistryEntry[],
): LocalRegistryEntry[] {
  return list.map((e) => ({
    ...e,
    comune: cleanComuneLabel(e.comune),
  }));
}

const CARGO_KEYS: CaricaLocale[] = ["dep", "creg", "sind", "com"];

function mergeInstitutionalRadixRows(
  config: FnConfig,
  entries: LocalRegistryEntry[],
): InstitutionalRadixRow[] {
  const byRegion = new Map<
    string,
    { dep: number; creg: number; sind: number; com: number }
  >();
  const pres = config.presenze_istituzionali;
  for (const carica of CARGO_KEYS) {
    const map = pres[carica] ?? {};
    for (const [region, count] of Object.entries(map)) {
      const cur = byRegion.get(region) ?? {
        dep: 0,
        creg: 0,
        sind: 0,
        com: 0,
      };
      cur[carica] += count;
      byRegion.set(region, cur);
    }
  }
  for (const e of entries) {
    const cur = byRegion.get(e.regione) ?? {
      dep: 0,
      creg: 0,
      sind: 0,
      com: 0,
    };
    cur[e.carica] += 1;
    byRegion.set(e.regione, cur);
  }
  return [...byRegion.entries()]
    .map(([region, counts]) => ({ region, ...counts }))
    .sort(
      (a, b) =>
        b.dep + b.creg + b.sind + b.com - (a.dep + a.creg + a.sind + a.com),
    );
}

function sumConsDepFromRows(rows: InstitutionalRadixRow[]): number {
  return rows.reduce((acc, r) => acc + r.dep + r.creg, 0);
}

export function LocaliPanel({
  configSnapshot,
  applyToScenario,
  onApplyToScenarioChange,
  onDeltaChange,
  newsOnly = false,
}: {
  configSnapshot: FnConfig;
  applyToScenario: boolean;
  onApplyToScenarioChange: (v: boolean) => void;
  onDeltaChange: (
    delta: CalculateOverrides["istituzioniDelta"] | undefined,
    summary: IstituzioniDeltaSummary | null,
  ) => void;
  /** Tab dashboard 04: solo rassegna stampa (registro istituzionale nascosto). */
  newsOnly?: boolean;
}) {
  const [entries, setEntries] = useState<LocalRegistryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [browserSaved, setBrowserSaved] = useState(false);
  const [cloudSaved, setCloudSaved] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [cloudMeta, setCloudMeta] = useState<{
    updatedAt: string | null;
    updatedBy: string | null;
  }>({ updatedAt: null, updatedBy: null });
  const [serverSeed, setServerSeed] = useState<LocalRegistryEntry[]>([]);
  const [eventsSeed, setEventsSeed] = useState<
    import("@/lib/engine/localiTypes").LocalApprovedEvent[]
  >([]);
  const [view, setView] = useState<"registry" | "news">(
    newsOnly ? "news" : "registry",
  );
  const [summary, setSummary] = useState<IstituzioniDeltaSummary | null>(null);
  const [delta, setDelta] = useState<
    CalculateOverrides["istituzioniDelta"] | undefined
  >();

  const recompute = useCallback(
    (list: LocalRegistryEntry[]) => {
      const { istituzioniDelta, summary: s } = computeIstituzioniDelta(
        configSnapshot,
        list,
      );
      setSummary(s);
      setDelta(istituzioniDelta);
      onDeltaChange(istituzioniDelta, s);
    },
    [configSnapshot, onDeltaChange],
  );

  useEffect(() => {
    fetch("/api/locali/registry")
      .then((r) => r.json())
      .then(
        (data: {
          registry?: { entries: LocalRegistryEntry[] };
          events?: { events: import("@/lib/engine/localiTypes").LocalApprovedEvent[] };
          source?: string;
          dbConnected?: boolean;
          updatedAt?: string | null;
          updatedBy?: string | null;
        }) => {
          const list = normalizeRegistryEntries(data.registry?.entries ?? []);
          setServerSeed(list);
          setEventsSeed(data.events?.events ?? []);
          const cached = loadRegistryFromBrowser();
          const useList = normalizeRegistryEntries(
            cached?.length ? cached : list,
          );
          setEntries(useList);
          setBrowserSaved(Boolean(cached?.length));
          setDbConnected(Boolean(data.dbConnected));
          setCloudSaved(data.source === "db" || data.source === "seed");
          setCloudMeta({
            updatedAt: data.updatedAt ?? null,
            updatedBy: data.updatedBy ?? null,
          });
          recompute(useList);
          setLoaded(true);
        },
      )
      .catch(() => setLoaded(true));
  }, [recompute]);

  function persistToCloud(
    list: LocalRegistryEntry[],
    opts?: { manual?: boolean },
  ) {
    void fetch("/api/locali/registry", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: list,
        events: eventsSeed,
        summary: opts?.manual
          ? `Salvataggio manuale registro (${list.length} voci)`
          : undefined,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (data.ok) {
          setCloudSaved(true);
          setCloudMeta({
            updatedAt: new Date().toISOString(),
            updatedBy: "interno@fn",
          });
        }
      })
      .catch(() => {});
  }

  function handleEntriesChange(list: LocalRegistryEntry[]) {
    setEntries(list);
    saveRegistryToBrowser(list);
    setBrowserSaved(true);
    persistToCloud(list);
    recompute(list);
  }

  function restoreServerSeed() {
    clearRegistryBrowser();
    setBrowserSaved(false);
    setEntries(serverSeed);
    recompute(serverSeed);
  }

  const radixRows = useMemo(
    (): InstitutionalRadixRow[] =>
      mergeInstitutionalRadixRows(configSnapshot, entries),
    [configSnapshot, entries],
  );

  const kpiTerritoriali = entries.length;
  const kpiSindCom = entries.filter(
    (e) => e.carica === "sind" || e.carica === "com",
  ).length;
  const kpiConsDep = sumConsDepFromRows(radixRows);
  const kpiDelta =
    summary?.hasChanges && delta
      ? `Delta attivo (${Object.keys(summary.byRegion).length} reg.)`
      : "Allineato (0)";

  if (!loaded) {
    return (
      <p className="text-sm text-fn-text-muted">
        {newsOnly ? "Caricamento rassegna stampa…" : "Caricamento registro…"}
      </p>
    );
  }

  const showRegistry = !newsOnly && view === "registry";
  const showNews = newsOnly || view === "news";

  return (
    <div className="flex flex-col gap-5 pb-32">
      {!newsOnly ? (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            {
              value: "registry",
              label: "01 · Registro & Delta Istituzionale",
            },
            {
              value: "news",
              label: "02 · Rassegna Stampa & Scanner 3D (Typeflow)",
            },
          ]}
        />
      ) : null}
      {showRegistry && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["01 // RECORD TERRITORIALI ATTIVI", kpiTerritoriali],
                ["02 // SINDACI & COMUNI PRESIDIATI", kpiSindCom],
                ["03 // CONSIGLIERI & DEPUTATI", kpiConsDep],
                ["04 // DELTA SCENARIO ATTIVO", kpiDelta],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-[#1B2436] bg-[#080C14] p-3"
              >
                <p className="font-mono text-[9px] text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-lg text-emerald-300 tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <InstitutionalRadixChart rows={radixRows} />
        </>
      )}
      {showRegistry ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {browserSaved && (
              <span className="fn-badge fn-badge-cloud">
                Salvato nel browser
              </span>
            )}
            {dbConnected && cloudSaved && (
              <span className="rounded-md bg-sky-50 px-2 py-1 text-sky-900">
                Sincronizzato su Cloud DB (Neon)
                {cloudMeta.updatedAt && (
                  <>
                    {" "}
                    · {new Date(cloudMeta.updatedAt).toLocaleString("it-IT")}
                    {cloudMeta.updatedBy ? ` · ${cloudMeta.updatedBy}` : ""}
                  </>
                )}
              </span>
            )}
            {dbConnected && (
              <Btn
                variant="secondary"
                className="text-xs"
                onClick={() => persistToCloud(entries, { manual: true })}
              >
                Salva Registro su Cloud DB
              </Btn>
            )}
          </div>
          <LocaliDeltaBanner
            applyToScenario={applyToScenario}
            onApplyChange={onApplyToScenarioChange}
            summary={summary}
            istituzioniDelta={delta}
          />
          <LocaliRegistryTable
            entries={entries}
            onChange={handleEntriesChange}
            onRestoreSeed={restoreServerSeed}
          />
        </>
      ) : null}
      {showNews && (
        <NewsReviewPanel entries={entries} onApplyToRegistry={handleEntriesChange} />
      )}
    </div>
  );
}
