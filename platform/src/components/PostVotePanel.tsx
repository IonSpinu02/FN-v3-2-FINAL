"use client";

import type { PostVoteResultExtended } from "@/lib/engine/historyAndEval";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";
import { Kpi, KpiGrid } from "@/components/ui/FnUi";
import { useState } from "react";
import { CsvDropzone } from "./CsvDropzone";

export function PostVotePanel({
  snapshot,
}: {
  snapshot: ScenarioResult;
}) {
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
        Valutazione ex post vs snapshot <strong>18/10/2026</strong> congelato.
        Verificare comparabilità esito (FN con simbolo proprio).
      </p>

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
