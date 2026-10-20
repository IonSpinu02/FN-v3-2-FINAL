"use client";

import {
  computeSnapshotDiff,
  type SnapshotDiffResult,
} from "@/lib/engine/snapshotDiff";
import {
  deleteLocalSnapshot,
  downloadSnapshotJson,
  loadLocalSnapshots,
  saveLocalSnapshot,
  type LocalSnapshotRecord,
} from "@/lib/engine/snapshotStorage";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { SnapshotDivergingDeltaChart } from "@/components/charts/AnalyticalChartsSuite";
import {
  buildBenchmark2024ChartRegions,
  buildStressTestChartRegions,
  isSnapshotDiffFlat,
  type ChartCompareMode,
} from "@/components/snapshotChartCompare";
import { Btn, Panel } from "@/components/ui/FnUi";
import { useCallback, useEffect, useMemo, useState } from "react";

type ApiSnapshot = LocalSnapshotRecord;

type AuditRow = {
  id: number;
  action: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
};

const LIVE_ID = "__live__";

export function SnapshotsAuditPanel({
  liveScenario,
  onLoadScenario,
  baselineScenario,
  onBaselineChange,
  focus = "all",
}: {
  liveScenario: ScenarioResult;
  onLoadScenario: (s: ScenarioResult, params?: ApiSnapshot["params"]) => void;
  baselineScenario: ScenarioResult;
  onBaselineChange: (s: ScenarioResult, label: string) => void;
  focus?: "all" | "snapshots" | "audit";
}) {
  const [dbConnected, setDbConnected] = useState(false);
  const [snapshots, setSnapshots] = useState<ApiSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [baseId, setBaseId] = useState<string>("");
  const [targetId, setTargetId] = useState<string>(LIVE_ID);
  const [diff, setDiff] = useState<SnapshotDiffResult | null>(null);
  const [chartCompare, setChartCompare] = useState<ChartCompareMode>("benchmark2024");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void fetch("/api/snapshots")
      .then((r) => r.json())
      .then(
        (data: {
          dbConnected?: boolean;
          snapshots?: ApiSnapshot[];
          auditLogs?: AuditRow[];
        }) => {
          setDbConnected(Boolean(data.dbConnected));
          const remote = data.snapshots ?? [];
          const local = loadLocalSnapshots();
          const merged = [...remote];
          for (const l of local) {
            if (!merged.some((m) => m.id === l.id)) merged.push(l);
          }
          merged.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setSnapshots(merged);
          setAuditLogs(data.auditLogs ?? []);
          if (!baseId && merged[0]) setBaseId(merged[0].id);
        },
      )
      .catch(() => {});
  }, [baseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const options = useMemo(() => {
    const opts = snapshots.map((s) => ({
      id: s.id,
      label: s.name,
      scenario: s.scenarioData,
    }));
    opts.unshift({
      id: LIVE_ID,
      label: "Scenario corrente (live)",
      scenario: liveScenario,
    });
    return opts;
  }, [snapshots, liveScenario]);

  useEffect(() => {
    const base = options.find((o) => o.id === baseId)?.scenario;
    const target = options.find((o) => o.id === targetId)?.scenario;
    if (base && target) setDiff(computeSnapshotDiff(base, target));
    else setDiff(null);
  }, [baseId, targetId, options]);

  const snapshotFlat = useMemo(() => isSnapshotDiffFlat(diff), [diff]);

  useEffect(() => {
    if (snapshotFlat && chartCompare === "snapshot") {
      setChartCompare("benchmark2024");
    }
  }, [snapshotFlat, chartCompare]);

  const chartRegions = useMemo(() => {
    const base = options.find((o) => o.id === baseId)?.scenario ?? baselineScenario;
    if (chartCompare === "benchmark2024") {
      return buildBenchmark2024ChartRegions(base);
    }
    if (chartCompare === "stress") {
      return buildStressTestChartRegions(base);
    }
    return diff?.regions ?? [];
  }, [chartCompare, baseId, options, baselineScenario, diff]);

  const chartSubtitle = useMemo(() => {
    if (chartCompare === "benchmark2024") {
      return "Snapshot vs benchmark 2024 · Δ stima pp per regione";
    }
    if (chartCompare === "stress") {
      return "Stress test S 8,20% vs 7,20% · Δ stima pp per regione";
    }
    return "Delta stima pp · Delta voti (base vs target selezionati)";
  }, [chartCompare]);

  async function handleDelete(id: string) {
    if (id.startsWith("file-")) return;
    const localOnly = loadLocalSnapshots().some((s) => s.id === id);
    if (localOnly && !dbConnected) {
      deleteLocalSnapshot(id);
      refresh();
      return;
    }
    const res = await fetch(`/api/snapshots/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      deleteLocalSnapshot(id);
      refresh();
    } else {
      setMsg(data.error ?? "Eliminazione fallita");
    }
  }

  function copyHash(hash: string) {
    void navigator.clipboard.writeText(hash);
    setMsg("Hash SHA-256 copiato");
  }

  return (
    <div className="flex flex-col gap-6">
      {msg && (
        <p className="text-sm text-fn-text-muted" role="status">
          {msg}
        </p>
      )}

      {(focus === "all" || focus === "snapshots") && (
      <>
      <Panel className="p-4">
        <h2 className="fn-label mb-3">Elenco snapshot</h2>
        <div className="fn-table-wrap">
          <table className="fn-table text-sm">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Data</th>
                <th>Autore</th>
                <th>S</th>
                <th>SHA-256</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name}
                    {s.isOfficialBaseline && (
                      <span className="fn-badge fn-badge-warn ml-1 px-1 text-[10px]">
                        baseline
                      </span>
                    )}
                  </td>
                  <td>{new Date(s.createdAt).toLocaleString("it-IT")}</td>
                  <td>{s.createdBy}</td>
                  <td>{pct(s.params.S)}</td>
                  <td className="font-mono text-xs">
                    {s.sha256Hash.slice(0, 12)}…
                    <Btn
                      variant="secondary"
                      className="ml-1 text-[10px] px-1 py-0"
                      onClick={() => copyHash(s.sha256Hash)}
                    >
                      Copia
                    </Btn>
                  </td>
                  <td className="flex flex-wrap gap-1">
                    <Btn
                      variant="secondary"
                      className="text-xs"
                      onClick={() => onLoadScenario(s.scenarioData, s.params)}
                    >
                      Carica
                    </Btn>
                    <Btn
                      variant="secondary"
                      className="text-xs"
                      onClick={() =>
                        onBaselineChange(s.scenarioData, s.name)
                      }
                    >
                      Baseline
                    </Btn>
                    <Btn
                      variant="secondary"
                      className="text-xs"
                      onClick={() => downloadSnapshotJson(s)}
                    >
                      JSON
                    </Btn>
                    {!s.isOfficialBaseline && (
                      <Btn
                        variant="secondary"
                        className="text-xs text-fn-danger"
                        onClick={() => void handleDelete(s.id)}
                      >
                        Elimina
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <h2 className="fn-label mb-3">Comparatore scenari</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-xs">
            Base
            <select
              className="ml-2 rounded border border-fn-border-subtle px-2 py-1"
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Target
            <select
              className="ml-2 rounded border border-fn-border-subtle px-2 py-1"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              ["benchmark2024", "CONFRONTA CON BENCHMARK 2024 (Δ pp)"],
              ["stress", "SIMULA STRESS TEST +1,0 pp (8,20% vs 7,20%)"],
              ["snapshot", "SNAPSHOT BASE vs SCENARIO LIVE"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setChartCompare(mode)}
              disabled={mode === "snapshot" && snapshotFlat}
              className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] ${
                chartCompare === mode
                  ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-300"
                  : "border-[#1B2436] text-slate-500 hover:text-slate-300 disabled:opacity-40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {(diff || chartCompare !== "snapshot") && (
          <>
            <SnapshotDivergingDeltaChart
              regions={chartRegions}
              subtitle={chartSubtitle}
            />
            {diff && (
            <p className="mb-2 text-xs text-fn-text-muted">
              ΔS {diff.deltaS.toFixed(2)} pp · Δ voti{" "}
              {diff.deltaVotiTotali.toLocaleString("it-IT")} · ΔH scenario{" "}
              {diff.deltaHScenario.toFixed(4)}
            </p>
            )}
            <div className="fn-table-wrap max-h-96 overflow-auto">
              <table className="fn-table text-xs">
                <thead>
                  <tr>
                    <th>Regione</th>
                    <th>Δ Stima pp</th>
                    <th>Δ Voti</th>
                    <th>Δ m</th>
                    <th>Δ f</th>
                  </tr>
                </thead>
                <tbody>
                  {(chartCompare === "snapshot" && diff ? diff.regions : chartRegions).map((r) => (
                    <tr key={r.regione}>
                      <td>{r.regione}</td>
                      <td>{r.deltaStimaPp.toFixed(2)}</td>
                      <td>{r.deltaVoti.toLocaleString("it-IT")}</td>
                      <td>{r.deltaIndiceIstituzionale.toFixed(4)}</td>
                      <td>{r.deltaIndiceFlussi.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
      </>
      )}

      {(focus === "all" || focus === "audit") && (
      <Panel className="p-4">
        <h2 className="fn-label mb-3">Audit trail</h2>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-fn-text-muted">
            Nessun evento cloud (DB non connesso o nessuna operazione).
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auditLogs.map((a) => (
              <li key={a.id} className="border-b border-fn-border-subtle pb-2">
                <span className="text-fn-text-muted">
                  {new Date(a.createdAt).toLocaleString("it-IT")}
                </span>{" "}
                · <strong>{a.action}</strong> · {a.actorEmail}
                <br />
                {a.summary}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      )}

      <p className="text-xs text-fn-text-muted">
        Baseline attiva per confronti:{" "}
        <strong>{baselineScenario.metadati.data}</strong>
      </p>
    </div>
  );
}

export type FreezeSnapshotInput = {
  name: string;
  notes?: string;
  params: ApiSnapshot["params"];
  scenario: ScenarioResult;
  createdBy: string;
};

export async function freezeSnapshotToCloud(
  input: FreezeSnapshotInput,
): Promise<{ dbConnected: boolean; record?: LocalSnapshotRecord }> {
  const res = await fetch("/api/snapshots", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      notes: input.notes,
      params: input.params,
      scenario: input.scenario,
    }),
  });
  const data = await res.json();
  const record = saveLocalSnapshot({
    name: input.name,
    notes: input.notes,
    params: input.params,
    scenarioData: data.scenario ?? input.scenario,
    createdBy: input.createdBy,
    isOfficialBaseline: false,
  });
  if (data.snapshot) {
    return { dbConnected: true, record: data.snapshot };
  }
  downloadSnapshotJson(record);
  return { dbConnected: false, record };
}
