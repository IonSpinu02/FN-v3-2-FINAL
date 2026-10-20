"use client";

import type {
  ConfidenceLevel,
  RegionalPollConfig,
  SampleMode,
} from "@/lib/engine/regionalPoll";
import { DEFAULT_POLL_CONFIG } from "@/lib/engine/regionalPoll";
import { Panel, PanelTitle } from "@/components/ui/FnUi";

export function RegionalPollControls({
  config,
  onChange,
}: {
  config: RegionalPollConfig;
  onChange: (c: RegionalPollConfig) => void;
}) {
  return (
    <Panel muted className="border-fn-accent/20 bg-fn-accent-soft/30 p-5">
      <PanelTitle>Simulatore sondaggio regionale</PanelTitle>
      <p className="mb-4 text-xs leading-relaxed text-fn-text-muted">
        Margine e probabilità soglia sono{" "}
        <strong>simulazioni interne</strong>, non rilevazioni di istituto esterno.
      </p>

      <label className="mb-4 block text-sm">
        <span className="fn-label mb-1 block">Campione N<sub>r</sub></span>
        <select
          className="fn-input"
          value={config.sampleMode}
          onChange={(e) =>
            onChange({
              ...config,
              sampleMode: e.target.value as SampleMode,
            })
          }
        >
          <option value="fixed600">Minimo 600 / regione</option>
          <option value="fixed1000">Fisso 1.000 / regione</option>
          <option value="fixed2000">Booster 2.000 / regione</option>
          <option value="proportional">Proporzionale (min 600)</option>
        </select>
      </label>

      <label className="mb-4 block text-sm">
        <span className="text-fn-text-muted">
          Soglia sbarramento:{" "}
          <span className="font-mono">{config.thresholdPct.toFixed(1)}%</span>
        </span>
        <input
          type="range"
          min={1}
          max={10}
          step={0.5}
          value={config.thresholdPct}
          onChange={(e) =>
            onChange({ ...config, thresholdPct: Number(e.target.value) })
          }
          className="fn-range mt-2"
        />
      </label>

      <label className="mb-4 block text-sm">
        <span className="text-fn-text-muted">
          Δ affluenza vs EU 2024: {config.turnoutDeltaPct > 0 ? "+" : ""}
          {config.turnoutDeltaPct.toFixed(1)} pp
        </span>
        <input
          type="range"
          min={-15}
          max={15}
          step={0.5}
          value={config.turnoutDeltaPct}
          onChange={(e) =>
            onChange({
              ...config,
              turnoutDeltaPct: Number(e.target.value),
            })
          }
          className="fn-range mt-2"
        />
      </label>

      <label className="mb-2 block text-sm">
        <span className="fn-label mb-1 block">Livello di confidenza</span>
        <select
          className="fn-input"
          value={config.confidenceLevel}
          onChange={(e) =>
            onChange({
              ...config,
              confidenceLevel: Number(e.target.value) as ConfidenceLevel,
            })
          }
        >
          <option value={0.9}>90%</option>
          <option value={0.95}>95%</option>
          <option value={0.99}>99%</option>
        </select>
      </label>

      <p className="text-xs text-fn-text-muted">
        Deff={DEFAULT_POLL_CONFIG.designEffect} ·{" "}
        {config.pollDraws.toLocaleString("it-IT")} estrazioni (sem.{" "}
        {config.pollSeed})
      </p>
    </Panel>
  );
}
