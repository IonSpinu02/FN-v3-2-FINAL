"use client";

import { parseHistory } from "@/lib/engine/parseHistory";
import type { ScenarioResult } from "@/lib/engine/types";
import { Btn } from "@/components/ui/FnUi";
import { useState } from "react";
import { CsvDropzone } from "./CsvDropzone";

export function HistoryPanel({
  snapshot,
}: {
  snapshot: ScenarioResult;
}) {
  const [rows, setRows] = useState<
    ReturnType<typeof parseHistory> | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <DisclaimerInline />
      <div className="flex flex-wrap gap-3">
        <a
          href="/templates/storico_iscritti_TEMPLATE.csv"
          download
          className="fn-btn fn-btn-secondary"
        >
          Scarica template CSV
        </a>
        <Btn
          variant="secondary"
          onClick={() => {
            fetch("/templates/storico_iscritti_TEMPLATE.csv")
              .then((r) => r.text())
              .then((t) => {
                try {
                  setErr(null);
                  setRows(parseHistory(t, snapshot));
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Errore");
                }
              });
          }}
        >
          Carica esempio (template)
        </Btn>
      </div>

      <CsvDropzone
        label="CSV storico iscritti (mese, regione, iscritti)"
        onText={(text) => {
          try {
            setErr(null);
            setRows(parseHistory(text, snapshot));
          } catch (e) {
            setErr(e instanceof Error ? e.message : "Errore parsing");
            setRows(null);
          }
        }}
      />

      {err && (
        <p className="text-sm text-fn-danger" role="alert">
          {err}
        </p>
      )}

      {rows && (
        <div className="fn-table-wrap">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Mese</th>
                <th>Stato</th>
                <th>H iscritti</th>
                <th>ΔH</th>
                <th>JS vs prec.</th>
                <th>H scenario cond.</th>
                <th>Iscritti reg.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.mese}>
                  <td className="font-mono">{r.mese}</td>
                  <td>{r.stato}</td>
                  <td className="font-mono">
                    {r.H != null ? r.H.toFixed(6) : "—"}
                  </td>
                  <td className="font-mono">
                    {r.delta_H != null ? r.delta_H.toFixed(6) : "—"}
                  </td>
                  <td className="font-mono">
                    {r.JS_precedente_nats != null
                      ? r.JS_precedente_nats.toFixed(6)
                      : "—"}
                  </td>
                  <td className="font-mono">
                    {r.H_scenario_condizionato != null
                      ? r.H_scenario_condizionato.toFixed(6)
                      : "—"}
                  </td>
                  <td className="font-mono">
                    {r.iscritti_regionalizzati?.toLocaleString("it-IT") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-fn-text-muted">
        H scenario condizionato: snapshot 18/10/2026; aggiornata solo la
        componente iscritti sui mesi completi (20 regioni).
      </p>
    </div>
  );
}

function DisclaimerInline() {
  return (
    <p className="fn-alert text-xs">
      Monitoraggio organizzativo — non prova crescita del consenso elettorale.
    </p>
  );
}
