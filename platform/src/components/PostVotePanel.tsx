"use client";

import { evaluatePostVoteWithPoll } from "@/lib/engine/historyAndEval";
import { DEFAULT_POLL_CONFIG } from "@/lib/engine/regionalPoll";
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
  const [result, setResult] = useState<ReturnType<
    typeof evaluatePostVoteWithPoll
  > | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
          try {
            setErr(null);
            setResult(
              evaluatePostVoteWithPoll(snapshot, text, DEFAULT_POLL_CONFIG),
            );
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Errore");
            setResult(null);
          }
        }}
      />

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
              label="Copertura forbice sond."
              value={`${((result.validazione_predittiva.copertura_forbice_sondaggio ?? 0) * 100).toFixed(0)}%`}
            />
            <Kpi
              label="RMSE scenario"
              value={result.validazione_predittiva.rmse_punti_scenario.toFixed(3)}
            />
            <Kpi
              label="S osservato"
              value={pct(result.validazione_predittiva.s_observato)}
            />
          </KpiGrid>
          <p className="text-xs text-fn-text-muted">
            {result.validazione_predittiva.avvertenza}
          </p>
          <div className="fn-table-wrap">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Regione</th>
                  <th>Stima ex ante</th>
                  <th>Voto osservato</th>
                  <th>Errore (pp)</th>
                  <th>Sens. pesi</th>
                  <th>Forbice sond.</th>
                </tr>
              </thead>
              <tbody>
                {result.righe.map((r) => (
                  <tr key={r.regione}>
                    <td>{r.regione}</td>
                    <td className="font-mono">{pct(r.stima)}</td>
                    <td className="font-mono">
                      {r.voto_osservato != null ? pct(r.voto_osservato) : "—"}
                    </td>
                    <td className="font-mono">
                      {r.errore_punti != null
                        ? r.errore_punti.toFixed(2)
                        : "—"}
                    </td>
                    <td>{r.in_sensibilita_pesi ? "Sì" : "No"}</td>
                    <td>{r.in_forbice_sondaggio ? "Sì" : "No"}</td>
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
