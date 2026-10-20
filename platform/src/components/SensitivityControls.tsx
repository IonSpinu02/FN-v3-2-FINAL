"use client";

import {
  FLUSSI_PRESETS,
  OFFICIAL_FLUSSI,
  OFFICIAL_PESI,
  OFFICIAL_S,
  type FlussiIpsos,
  WEIGHT_PRESETS,
} from "@/lib/engine/defaults";
import type { FnConfig } from "@/lib/engine/types";
import { Btn, Panel, PanelTitle, StatusDot } from "@/components/ui/FnUi";

export type WeightUi = {
  flussi: number;
  pref: number;
  isc: number;
  ist: number;
};

export function uiFromPesi(p: FnConfig["pesi"]): WeightUi {
  return {
    flussi: Math.round(p.flussi * 1000) / 10,
    pref: Math.round(p.pref * 1000) / 10,
    isc: Math.round(p.isc * 1000) / 10,
    ist: Math.round(p.ist * 1000) / 10,
  };
}

export function pesiFromUi(u: WeightUi): FnConfig["pesi"] {
  const sum = u.flussi + u.pref + u.isc + u.ist;
  if (sum <= 0) return { ...OFFICIAL_PESI };
  return {
    flussi: u.flussi / sum,
    pref: u.pref / sum,
    isc: u.isc / sum,
    ist: u.ist / sum,
  };
}

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

export function SensitivityControls({
  S,
  weights,
  flussiIpsos,
  onSChange,
  onWeightsChange,
  onFlussiChange,
  onReset,
  mcLoading,
}: {
  S: number;
  weights: WeightUi;
  flussiIpsos: FlussiIpsos;
  onSChange: (s: number) => void;
  onWeightsChange: (w: WeightUi) => void;
  onFlussiChange: (f: FlussiIpsos) => void;
  onReset: () => void;
  mcLoading: boolean;
}) {
  const normalized = pesiFromUi(weights);
  const sumUi = weights.flussi + weights.pref + weights.isc + weights.ist;
  const altriPct = Math.max(
    0,
    100 - (flussiIpsos.FdI + flussiIpsos.Lega + flussiIpsos.ast) * 100,
  );

  return (
    <Panel className="p-5">
      <PanelTitle
        action={
          <div className="flex items-center gap-2">
            {mcLoading && (
              <>
                <StatusDot active />
                <span className="text-xs text-fn-accent">Monte Carlo…</span>
              </>
            )}
            <Btn variant="secondary" className="text-xs" onClick={onReset}>
              Ripristina v3.2
            </Btn>
          </div>
        }
      >
        Sensibilità live
      </PanelTitle>

      <label className="mb-5 block">
        <span className="text-sm text-fn-text-muted">
          Quota S (nazionale):{" "}
          <span className="font-mono font-medium text-fn-text">
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
          className="fn-range mt-2"
        />
      </label>

      <p className="mb-3 text-xs leading-relaxed text-fn-text-muted">
        Pesi UI (somma {sumUi.toFixed(1)}%) → normalizzati: flussi{" "}
        {(normalized.flussi * 100).toFixed(1)}%, pref{" "}
        {(normalized.pref * 100).toFixed(1)}%, isc{" "}
        {(normalized.isc * 100).toFixed(1)}%, ist{" "}
        {(normalized.ist * 100).toFixed(1)}%
      </p>

      {(
        [
          ["flussi", "Flussi"],
          ["pref", "Preferenze"],
          ["isc", "Iscritti"],
          ["ist", "Istituzioni"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="mb-3 block text-sm">
          <span className="text-fn-text-muted">
            {label}:{" "}
            <span className="font-mono text-fn-text">
              {weights[key].toFixed(1)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={weights[key]}
            onChange={(e) =>
              onWeightsChange({
                ...weights,
                [key]: Number(e.target.value),
              })
            }
            className="fn-range mt-1"
          />
        </label>
      ))}

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(WEIGHT_PRESETS).map(([name, p]) => (
          <Btn
            key={name}
            variant="secondary"
            className="text-xs"
            onClick={() => onWeightsChange(uiFromPesi(p))}
          >
            {name}
          </Btn>
        ))}
      </div>

      <div className="mt-6 border-t border-fn-border-subtle pt-5">
        <p className="fn-label mb-1">Provenienza Flussi (FdI / Lega / Astensione)</p>
        <p className="mb-3 text-xs text-fn-text-muted">
          Flussi mercato 2026 (Ipsos) — residuo Altri:{" "}
          <span className="font-mono font-medium text-fn-text">
            {altriPct.toFixed(1)}%
          </span>
        </p>
        {(
          [
            ["FdI", "FdI"],
            ["Lega", "Lega"],
            ["ast", "Astensione"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="mb-3 block text-sm">
            <span className="text-fn-text-muted">
              {label}:{" "}
              <span className="font-mono text-fn-text">
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
              className="fn-range mt-1"
            />
          </label>
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(FLUSSI_PRESETS).map(([name, f]) => (
            <Btn
              key={name}
              variant="secondary"
              className="text-xs"
              onClick={() => onFlussiChange({ ...f })}
            >
              {name}
            </Btn>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-fn-text-muted">
        Golden: S={(OFFICIAL_S * 100).toFixed(1)}%, pesi 35/25/25/15, flussi
        Ipsos 31/25/36.
      </p>
    </Panel>
  );
}
