"use client";

import type { Region } from "@/lib/engine/constants";
import type { SchedaMensileRiga } from "@/lib/engine/osservatorioTypes";
import type {
  FabbisognoIndicatore,
  GoogleTrendsSeries,
  OsservatorioEvento,
  PrioritaDichiarateRilevazione,
} from "@/lib/engine/osservatorioTypes";
import type { ScenarioResult } from "@/lib/engine/types";
import { pct } from "@/lib/format";

export function PrintOsservatorioReport({
  regione,
  scenario,
  scheda,
  indicatori,
  events,
  trendsSeries,
  priorita,
}: {
  regione: Region;
  scenario: ScenarioResult;
  scheda: SchedaMensileRiga[];
  indicatori: FabbisognoIndicatore[];
  events: OsservatorioEvento[];
  trendsSeries: GoogleTrendsSeries | null;
  priorita?: PrioritaDichiarateRilevazione;
}) {
  const row = scenario.righe.find((r) => r.regione === regione);
  const generated = new Date().toLocaleString("it-IT");

  return (
    <div id="osservatorio-print" className="nota-print hidden">
      <header className="nota-print-header">
        <h1>
          Osservatorio Integrato — Scheda Mensile Regionale &amp; Dossier
          (Ottobre 2026 – Maggio 2027)
        </h1>
        <p>
          Regione: <strong>{regione}</strong> · Estrazione: {generated}
        </p>
      </header>

      <section className="nota-print-box">
        <strong>Regola metodologica (Sez. 1 e 11)</strong>
        <ul>
          <li>
            <strong>Modulo A</strong> — consenso modellato (scenario territoriale);
            non sondaggio regionale validato; <code>predizione_validata: false</code>.
          </li>
          <li>
            <strong>Modulo B</strong> — indicatori di contesto e priorità dichiarate;
            medie territoriali ≠ comportamento elettorale individuale (no errore
            ecologico).
          </li>
          <li>
            <strong>Modulo C</strong> — attenzione mediatica (Trends/news) ed eventi;
            variazione temporale ≠ causalità (no fallacia post-hoc).
          </li>
        </ul>
      </section>

      <section>
        <h2>Scheda mensile integrata — {regione}</h2>
        <table className="nota-print-table">
          <thead>
            <tr>
              <th>Dimensione</th>
              <th>Indicatore / stato</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {scheda.map((r) => (
              <tr key={r.dimensione}>
                <td>{r.dimensione}</td>
                <td>{r.indicatoreStato}</td>
                <td>{r.nota}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Consegna 1 — Quadro aggiornato (Modulo A)</h2>
        <ul>
          <li>S nazionale (input): {pct(scenario.parametri.S)}</li>
          <li>
            Stima regione: {row ? pct(row.stima) : "n/d"} · Intervallo MC:{" "}
            {row ? `${pct(row.lo10)} – ${pct(row.hi90)}` : "n/d"}
          </li>
          <li>H iscritti: {scenario.metriche.H.iscritti.toFixed(4)}</li>
          <li>H scenario: {scenario.metriche.H.scenario.toFixed(4)}</li>
        </ul>
      </section>

      <section>
        <h2>Consegna 2 — Scheda fabbisogni pubblici (Modulo B)</h2>
        <table className="nota-print-table nota-print-table-full">
          <thead>
            <tr>
              <th>Tema</th>
              <th>Indicatore</th>
              <th>Fonte</th>
              <th>Periodo misurato</th>
              <th>Pubblicazione</th>
              <th>Natura</th>
            </tr>
          </thead>
          <tbody>
            {indicatori.map((i) => (
              <tr key={i.id}>
                <td>{i.tema}</td>
                <td>{i.indicatore ?? "—"}</td>
                <td>{i.metadati.fonte}</td>
                <td>{i.metadati.periodoMisurato}</td>
                <td>{i.metadati.dataPubblicazione}</td>
                <td>{i.metadati.naturaDato}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {priorita && (
          <p>
            Priorità dichiarate (aggregato): N={priorita.campioneN}, MR{" "}
            {priorita.mancataRispostaPct}%, ±{priorita.margineIncertezzaPct} pp —{" "}
            {priorita.periodoRilevazione}
          </p>
        )}
      </section>

      <section>
        <h2>Consegna 3 — Nota eventi (Modulo C)</h2>
        <table className="nota-print-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Titolo</th>
              <th>Finestre</th>
              <th>Sondaggi comparabili</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{e.data}</td>
                <td>{e.titolo}</td>
                <td>
                  ±{e.finestraPreGiorni}/{e.finestraPostGiorni} gg
                </td>
                <td>{e.sondaggioComparabile ?? "non_disponibile"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {trendsSeries && (
          <p>
            Google Trends: query «{trendsSeries.query}» ({trendsSeries.territory}),{" "}
            {trendsSeries.windowStart}–{trendsSeries.windowEnd}
            {trendsSeries.isDemo ? " [esempio didattico]" : ""} — indice relativo
            0–100, non voto.
          </p>
        )}
      </section>
    </div>
  );
}

export function exportOsservatorioPdf() {
  window.print();
}
