"use client";

import { computeIstituzioniDelta } from "@/lib/engine/localInstitutions";
import type {
  IstituzioniDeltaSummary,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";
import type { CalculateOverrides } from "@/lib/engine/calculate";
import type { FnConfig } from "@/lib/engine/types";
import { useCallback, useEffect, useState } from "react";
import { LocaliDeltaBanner } from "./LocaliDeltaBanner";
import { LocaliRegistryTable } from "./LocaliRegistryTable";
import { NewsReviewPanel } from "./NewsReviewPanel";

export function LocaliPanel({
  configSnapshot,
  applyToScenario,
  onApplyToScenarioChange,
  onDeltaChange,
}: {
  configSnapshot: FnConfig;
  applyToScenario: boolean;
  onApplyToScenarioChange: (v: boolean) => void;
  onDeltaChange: (
    delta: CalculateOverrides["istituzioniDelta"] | undefined,
    summary: IstituzioniDeltaSummary | null,
  ) => void;
}) {
  const [entries, setEntries] = useState<LocalRegistryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      .then((data: { registry?: { entries: LocalRegistryEntry[] } }) => {
        const list = data.registry?.entries ?? [];
        setEntries(list);
        recompute(list);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [recompute]);

  function handleEntriesChange(list: LocalRegistryEntry[]) {
    setEntries(list);
    recompute(list);
  }

  if (!loaded) {
    return <p className="text-sm text-fn-text-muted">Caricamento registro…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="fn-alert text-xs">
        Registro comuni e news RSS: aggiornamenti manuali o da coda revisione.
        Rollup su conteggi istituzionali FN per regione — scenario descrittivo,{" "}
        <strong>predizione_validata: false</strong>.
      </p>
      <LocaliDeltaBanner
        applyToScenario={applyToScenario}
        onApplyChange={onApplyToScenarioChange}
        summary={summary}
        istituzioniDelta={delta}
      />
      <NewsReviewPanel entries={entries} onApplyToRegistry={handleEntriesChange} />
      <LocaliRegistryTable entries={entries} onChange={handleEntriesChange} />
    </div>
  );
}
