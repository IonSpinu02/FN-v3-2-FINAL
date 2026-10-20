"use client";

import { EntropyAndCalibrationChart } from "@/components/charts/AnalyticalChartsSuite";
import { REGIONS } from "@/lib/engine/constants";
import {
  evaluatePostVoteWithPoll,
  type PostVoteResultExtended,
} from "@/lib/engine/historyAndEval";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { Btn, Kpi, KpiGrid } from "@/components/ui/FnUi";
import { useState } from "react";
import { CsvDropzone } from "./CsvDropzone";

type SnapshotOption = { id: string; label: string; scenario: ScenarioResult };

export function PostVotePanel({
  baselineOptions,
  defaultBaselineId,
}: {
  baselineOptions: SnapshotOption[];
  defaultBaselineId: string;
}) {
  const [baselineId, setBaselineId] = useState(defaultBaselineId);
  const snapshot =
    baselineOptions.find((o) => o.id === baselineId)?.scenario ??
    baselineOptions[0]!.scenario;

  const [result, setResult] = useState<PostVoteResultExtended | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function runEval(csvContent: string) {
    setPending(true);
    setErr(null);
    try {
      const res = await fetch("/api/post-vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot, csvContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setResult(data as PostVoteResultExtended);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore");
      setResult(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="fn-alert text-xs">
        Modulo A — validazione ex post vs baseline snapshot. Non confondere con
        Modulo C (eventi): una variazione temporale non prova causalità.
        Comparabilità esito FN con simbolo proprio, 20 regioni.
      </p>

      <label className="flex flex-wrap items-center gap-2 text-sm">
        Baseline snapshot
        <select
          className="rounded border border-fn-border-subtle px-2 py-1"
          value={baselineId}
          onChange={(e) => {
            setBaselineId(e.target.value);
            setResult(null);
          }}
        >
          {baselineOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <a
        href="/templates/esiti_futuri_TEMPLATE.csv"
        download
        className="fn-btn fn-btn-secondary w-fit"
      >
        Scarica template esiti
      </a>

      <CsvDropzone
        label="CSV esiti (regione, voti_validi, voti_fn) — 20 righe"
        onText={(text) => {
          void runEval(text);
        }}
      />

      <Btn
        variant="secondary"
        className="w-fit font-mono text-[10px]"
        onClick={() => {
          const lines = REGIONS.map((r, i) => {
            const row = snapshot.righe.find((x) => x.regione === r)!;
            const valid = Math.max(
              100000,
              Math.round(row.elettori_ricostruiti * 0.48),
            );
            const noise = ((i * 17) % 7) * 0.0004 - 0.001;
            const share = Math.min(
              0.14,
              Math.max(0.02, row.stima + noise),
            );
            const fn = Math.round(valid * share);
            return `${r},${valid},${fn}`;
          });
          const csv = "regione,voti_validi,voti_fn\n" + lines.join("\n");
          try {
            setPending(true);
            setErr(null);
            const data = evaluatePostVoteWithPoll(snapshot, csv);
            setResult(data);
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Errore simulazione");
            setResult(null);
          } finally {
            setPending(false);
          }
        }}
      >
        CARICA DATI DI SIMULAZIONE TEST POST-VOTO
      </Btn>

      <EntropyAndCalibrationChart mode="parity" postVote={result} />

      {pending && (
        <p className="text-sm text-fn-text-muted">Calcolo validazione…</p>
      )}

      {err && (
        <p className="text-sm text-fn-danger" role="alert">
          {err}
        </p>
      )}

      {result && (
        <>
          <KpiGrid>
            <Kpi
              label="MAE scenario (pp)"
              value={result.validazione_predittiva.mae_punti_scenario.toFixed(3)}
            />
            <Kpi
              label="MAE benchmark (pp)"
              value={result.validazione_predittiva.mae_punti_benchmark.toFixed(3)}
            />
            <Kpi
              label="Skill vs benchmark"
              value={
                result.validazione_predittiva.skill_vs_benchmark != null
                  ? result.validazione_predittiva.skill_vs_benchmark.toFixed(4)
                  : "n/d"
              }
            />
            <Kpi
              label="Copertura lo10–hi90"
              value={`${(result.validazione_predittiva.copertura_regioni_sensibilita * 100).toFixed(0)}%`}
            />
            <Kpi
              label="Copertura forbice sondaggio"
              value={
                result.validazione_predittiva.copertura_forbice_sondaggio != null
                  ? `${(result.validazione_predittiva.copertura_forbice_sondaggio * 100).toFixed(0)}%`
                  : "n/d"
              }
            />
          </KpiGrid>

          <div className="overflow-x-auto">
            <table className="fn-table w-full text-sm">
              <thead>
                <tr>
                  <th>Regione</th>
                  <th>Voto oss.</th>
                  <th>Stima</th>
                  <th>Benchmark</th>
                  <th>In forbice sond.</th>
                  <th>In sens. pesi</th>
                </tr>
              </thead>
              <tbody>
                {result.righe.map((row) => (
                  <tr key={row.regione}>
                    <td>{row.regione}</td>
                    <td>
                      {row.voto_osservato != null
                        ? pct(row.voto_osservato)
                        : "—"}
                    </td>
                    <td>{pct(row.stima)}</td>
                    <td>{pct(row.benchmark)}</td>
                    <td>{row.in_forbice_sondaggio ? "Sì" : "No"}</td>
                    <td>{row.in_sensibilita_pesi ? "Sì" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
