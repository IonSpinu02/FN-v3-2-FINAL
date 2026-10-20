"use client";

import type { CalculateOverrides } from "@/lib/engine/calculate";
import {
  isOfficialParams,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import type {
  RegionPollResult,
  RegionalPollConfig,
} from "@/lib/engine/regionalPollShared";
import type { FnConfig, ScenarioResult } from "@/lib/engine/types";
import { pct, pp } from "@/lib/format";

const TESSERE_LABEL: Record<RegionPollResult["statoTesseramento"], string> = {
  equilibrato: "Equilibrato",
  da_strutturare: "Aprire sedi",
  anomalia_tessere: "Verifica conversione",
};

export function PrintNotaReport({
  scenario,
  S,
  pesi,
  flussiIpsos,
  istituzioniDelta,
  poll,
  pollConfig,
}: {
  scenario: ScenarioResult;
  S: number;
  pesi: FnConfig["pesi"];
  flussiIpsos: FlussiIpsos;
  istituzioniDelta?: CalculateOverrides["istituzioniDelta"];
  poll: RegionPollResult[];
  pollConfig: RegionalPollConfig;
}) {
  const official = isOfficialParams(S, pesi, flussiIpsos, istituzioniDelta);
  const pollMap = Object.fromEntries(poll.map((p) => [p.regione, p]));
  const gap =
    scenario.parametri.iscritti_totali_dichiarati -
    scenario.parametri.iscritti_attribuiti;
  const generated = new Date().toLocaleString("it-IT");

  const sampleLabel = {
    fixed600: "600/regione",
    fixed1000: "1.000/regione",
    fixed2000: "2.000/regione",
    proportional: "proporzionale (min 600)",
  }[pollConfig.sampleMode];

  return (
    <div id="nota-dirigenza-print" className="nota-print hidden">
      <header className="nota-print-header">
        <h1>
          Futuro Nazionale — Nota Demoscopica &amp; Scenario Dirigenza v3.2
        </h1>
        <p>
          Generato: {generated} ·{" "}
          {official
            ? "Scenario Ufficiale v3.2 (golden)"
            : "Simulazione personalizzata (NON ufficiale)"}
        </p>
        <p>
          Sondaggio simulato: campione {sampleLabel}, IC{" "}
          {(pollConfig.confidenceLevel * 100).toFixed(0)}%, soglia{" "}
          {pollConfig.thresholdPct.toFixed(1)}%, Δ affluenza{" "}
          {pollConfig.turnoutDeltaPct.toFixed(1)} pp, Deff=
          {pollConfig.designEffect}
        </p>
      </header>

      <section className="nota-print-box">
        <strong>Qualificazione metodologica</strong>
        <ul>
          <li>
            <code>predizione_validata: false</code> — scenario descrittivo; la
            forbice ±MoE è una simulazione campionaria interna, non un sondaggio
            pubblicato da istituto esterno.
          </li>
          <li>
            Confronto benchmark FdI+Lega 2024: diagnostico, non errore
            predittivo.
          </li>
          <li>
            Osservatorio integrato (A/B/C): fabbisogni pubblici e attenzione
            (news/Trends) non dimostrano preferenze elettorali né causalità di
            singoli eventi.
          </li>
          <li>
            Gap iscritti: {gap.toLocaleString("it-IT")} (dichiarati vs
            regionalizzati).
          </li>
          <li>
            lo10–hi90: sensibilità perturbazione pesi (Monte Carlo), distinta
            dalla forbice demoscopica simulata.
          </li>
        </ul>
      </section>

      <section>
        <h2>Riepilogo nazionale</h2>
        <table className="nota-print-table">
          <tbody>
            <tr>
              <td>S (input)</td>
              <td>{pct(scenario.parametri.S)}</td>
            </tr>
            <tr>
              <td>Pesi (fl/pref/isc/ist)</td>
              <td>
                {(pesi.flussi * 100).toFixed(0)}/
                {(pesi.pref * 100).toFixed(0)}/
                {(pesi.isc * 100).toFixed(0)}/
                {(pesi.ist * 100).toFixed(0)}
              </td>
            </tr>
            <tr>
              <td>Flussi Ipsos (FdI/Lega/ast)</td>
              <td>
                {(flussiIpsos.FdI * 100).toFixed(1)}% /{" "}
                {(flussiIpsos.Lega * 100).toFixed(1)}% /{" "}
                {(flussiIpsos.ast * 100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td>Delta istituzionale attivo</td>
              <td>
                {istituzioniDelta
                  ? `${Object.keys(istituzioniDelta).length} regioni con Δ`
                  : "Nessuno (golden config)"}
              </td>
            </tr>
            <tr>
              <td>Voti scenario</td>
              <td>
                {scenario.righe
                  .reduce((s, r) => s + r.voti_di_scenario, 0)
                  .toLocaleString("it-IT", { maximumFractionDigits: 0 })}
              </td>
            </tr>
            <tr>
              <td>H scenario / iscritti</td>
              <td>
                {scenario.metriche.H.scenario.toFixed(4)} /{" "}
                {scenario.metriche.H.iscritti.toFixed(4)}
              </td>
            </tr>
            <tr>
              <td>Diff. media vs benchmark</td>
              <td>
                {pp(
                  scenario.metriche
                    .differenza_media_ponderata_scenario_benchmark_punti,
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>20 regioni — sondaggio simulato</h2>
        <table className="nota-print-table nota-print-table-full">
          <thead>
            <tr>
              <th>Regione</th>
              <th>Stima %</th>
              <th>± MoE</th>
              <th>lo10–hi90</th>
              <th>P(≥ soglia)</th>
              <th>Margine soglia (voti)</th>
              <th>Salute tessere</th>
              <th>Voti att.</th>
              <th>Iscr.</th>
            </tr>
          </thead>
          <tbody>
            {scenario.righe.map((r) => {
              const p = pollMap[r.regione];
              return (
                <tr key={r.regione}>
                  <td>{r.regione}</td>
                  <td>{p ? pct(p.piHat) : pct(r.stima)}</td>
                  <td>
                    {p
                      ? `${pct(p.icLow, 2)} – ${pct(p.icHigh, 2)}`
                      : "—"}
                  </td>
                  <td>
                    {pct(r.lo10, 2)} – {pct(r.hi90, 2)}
                  </td>
                  <td>
                    {p ? `${(p.probAboveThreshold * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td>
                    {p
                      ? p.margineVotiSoglia.toLocaleString("it-IT")
                      : "—"}
                  </td>
                  <td>
                    {p ? TESSERE_LABEL[p.statoTesseramento] : "—"}
                  </td>
                  <td>
                    {p
                      ? Math.round(p.votiAttesi).toLocaleString("it-IT")
                      : Math.round(r.voti_di_scenario).toLocaleString("it-IT")}
                  </td>
                  <td>{r.iscritti.toLocaleString("it-IT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function exportNotaPdf() {
  window.print();
}
