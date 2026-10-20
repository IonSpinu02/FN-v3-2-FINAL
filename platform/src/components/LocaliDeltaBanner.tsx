"use client";

import type { IstituzioniDeltaSummary } from "@/lib/engine/localiTypes";
import type { CalculateOverrides } from "@/lib/engine/calculate";

export function LocaliDeltaBanner({
  applyToScenario,
  onApplyChange,
  summary,
  istituzioniDelta,
}: {
  applyToScenario: boolean;
  onApplyChange: (v: boolean) => void;
  summary: IstituzioniDeltaSummary | null;
  istituzioniDelta: CalculateOverrides["istituzioniDelta"] | undefined;
}) {
  const hasDelta = summary?.hasChanges && istituzioniDelta;

  return (
    <div className="fn-panel-muted p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="fn-label">Rollup istituzionale (registro → config)</p>
          <p className="text-sm text-fn-text-muted">
            {hasDelta
              ? "Il registro comuni produce delta rispetto a config_v3_2. Attiva per ricalcolare lo scenario."
              : "Registro allineato al config: nessun delta istituzionale."}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={applyToScenario}
            disabled={!hasDelta}
            onChange={(e) => onApplyChange(e.target.checked)}
            className="h-4 w-4 accent-[var(--fn-accent)]"
          />
          Applica allo scenario
        </label>
      </div>
      {hasDelta && applyToScenario && (
        <ul className="mt-3 max-h-32 overflow-y-auto text-xs font-mono text-fn-text-muted">
          {Object.entries(istituzioniDelta ?? {}).map(([regione, row]) => (
            <li key={regione}>
              {regione}:{" "}
              {Object.entries(row ?? {})
                .map(([k, v]) => `${k}${v! >= 0 ? "+" : ""}${v}`)
                .join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
