"use client";

import {
  FLUSSI_PRESETS,
  WEIGHT_PRESETS,
  type FlussiIpsos,
} from "@/lib/engine/defaults";
import type { RegionalPollConfig } from "@/lib/engine/regionalPollShared";
import {
  pesiFromUi,
  uiFromPesi,
  type WeightUi,
} from "@/components/SensitivityControls";
import { Btn, StatusDot } from "@/components/ui/FnUi";
import { useState } from "react";

type DockTab = "pesi" | "flussi" | "sondaggio";

function clampFlussiField(
  flussi: FlussiIpsos,
  key: keyof FlussiIpsos,
  pct: number,
): FlussiIpsos {
  const v = Math.max(0, Math.min(1, pct / 100));
  const next = { ...flussi, [key]: v };
  const sum = next.FdI + next.Lega + next.ast;
  if (sum <= 1 + 1e-9) return next;
  const scale = (1 - v) / (sum - v);
  if (key !== "FdI") next.FdI *= scale;
  if (key !== "Lega") next.Lega *= scale;
  if (key !== "ast") next.ast *= scale;
  return next;
}

export function QuickControlDock({
  S,
  weights,
  flussiIpsos,
  pollConfig,
  mcLoading,
  onSChange,
  onWeightsChange,
  onFlussiChange,
  onPollConfigChange,
  onReset,
}: {
  S: number;
  weights: WeightUi;
  flussiIpsos: FlussiIpsos;
  pollConfig: RegionalPollConfig;
  mcLoading: boolean;
  onSChange: (s: number) => void;
  onWeightsChange: (w: WeightUi) => void;
  onFlussiChange: (f: FlussiIpsos) => void;
  onPollConfigChange: (c: RegionalPollConfig) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<DockTab>("pesi");
  const normalized = pesiFromUi(weights);

  return (
    <div className="fn-bento fn-quick-dock">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="fn-label">Quick control</p>
        <div className="flex items-center gap-2">
          {mcLoading && (
            <>
              <StatusDot active />
              <span className="font-mono text-[10px] tabular-nums text-emerald-400">
                MC…
              </span>
            </>
          )}
          <Btn variant="ghost" className="text-[10px]" onClick={onReset}>
            Reset v3.2
          </Btn>
        </div>
      </div>
      <div className="fn-dock-tabs" role="tablist">
        {(
          [
            ["pesi", "S & Pesi"],
            ["flussi", "Flussi 2026"],
            ["sondaggio", "Sondaggio"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`fn-dock-tab ${tab === id ? "fn-dock-tab-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-[140px]">
        {tab === "pesi" && (
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="text-fn-text-muted">
                Quota S{" "}
                <span className="font-mono tabular-nums text-fn-text">
                  {(S * 100).toFixed(1)}%
                </span>
              </span>
              <input
                type="range"
                min={1}
                max={20}
                step={0.1}
                value={S * 100}
                onChange={(e) => onSChange(Number(e.target.value) / 100)}
                className="fn-range mt-1"
              />
            </label>
            {(
              [
                ["flussi", "Flussi"],
                ["pref", "Pref."],
                ["isc", "Isc."],
                ["ist", "Ist."],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs">
                <span className="text-fn-text-muted">
                  {label}{" "}
                  <span className="font-mono tabular-nums">{weights[key].toFixed(0)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={weights[key]}
                  onChange={(e) =>
                    onWeightsChange({ ...weights, [key]: Number(e.target.value) })
                  }
                  className="fn-range mt-0.5"
                />
              </label>
            ))}
            <p className="font-mono text-[10px] tabular-nums text-fn-text-muted">
              Norm: {(normalized.flussi * 100).toFixed(0)}/
              {(normalized.pref * 100).toFixed(0)}/
              {(normalized.isc * 100).toFixed(0)}/
              {(normalized.ist * 100).toFixed(0)}
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(WEIGHT_PRESETS).slice(0, 2).map(([name, p]) => (
                <Btn
                  key={name}
                  variant="secondary"
                  className="px-2 py-1 text-[10px]"
                  onClick={() => onWeightsChange(uiFromPesi(p))}
                >
                  {name.includes("Default") ? "Default" : "Uguali"}
                </Btn>
              ))}
            </div>
          </div>
        )}

        {tab === "flussi" && (
          <div className="space-y-2">
            {(
              [
                ["FdI", "FdI"],
                ["Lega", "Lega"],
                ["ast", "Ast."],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-xs">
                <span className="text-fn-text-muted">
                  {label}{" "}
                  <span className="font-mono tabular-nums">
                    {(flussiIpsos[key] * 100).toFixed(1)}%
                  </span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={flussiIpsos[key] * 100}
                  onChange={(e) =>
                    onFlussiChange(
                      clampFlussiField(flussiIpsos, key, Number(e.target.value)),
                    )
                  }
                  className="fn-range mt-0.5"
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-1">
              {Object.entries(FLUSSI_PRESETS).map(([name, f]) => (
                <Btn
                  key={name}
                  variant="secondary"
                  className="px-2 py-1 text-[10px]"
                  onClick={() => onFlussiChange({ ...f })}
                >
                  {name.includes("Ex-Lega") ? "Ex-Lega Nord" : name.slice(0, 12)}
                </Btn>
              ))}
            </div>
          </div>
        )}

        {tab === "sondaggio" && (
          <div className="space-y-2 text-xs">
            <label className="block">
              <span className="fn-label mb-1 block">Campione</span>
              <select
                className="fn-input py-1 text-xs"
                value={pollConfig.sampleMode}
                onChange={(e) =>
                  onPollConfigChange({
                    ...pollConfig,
                    sampleMode: e.target.value as RegionalPollConfig["sampleMode"],
                  })
                }
              >
                <option value="fixed600">Min 600 / reg.</option>
                <option value="fixed1000">1.000 / reg.</option>
                <option value="fixed2000">2.000 / reg.</option>
                <option value="proportional">Proporzionale</option>
              </select>
            </label>
            <label className="block">
              <span className="text-fn-text-muted">
                Soglia{" "}
                <span className="font-mono tabular-nums">
                  {pollConfig.thresholdPct.toFixed(1)}%
                </span>
              </span>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={pollConfig.thresholdPct}
                onChange={(e) =>
                  onPollConfigChange({
                    ...pollConfig,
                    thresholdPct: Number(e.target.value),
                  })
                }
                className="fn-range mt-0.5"
              />
            </label>
            <label className="block">
              <span className="text-fn-text-muted">
                Δ affluenza{" "}
                <span className="font-mono tabular-nums">
                  {pollConfig.turnoutDeltaPct > 0 ? "+" : ""}
                  {pollConfig.turnoutDeltaPct.toFixed(1)} pp
                </span>
              </span>
              <input
                type="range"
                min={-15}
                max={15}
                step={0.5}
                value={pollConfig.turnoutDeltaPct}
                onChange={(e) =>
                  onPollConfigChange({
                    ...pollConfig,
                    turnoutDeltaPct: Number(e.target.value),
                  })
                }
                className="fn-range mt-0.5"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
