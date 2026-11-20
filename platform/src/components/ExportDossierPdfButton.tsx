"use client";

import { useState } from "react";
import type {
  ForecastBacktestV4,
  ForecastHorizonKey,
  ForecastNetworkDelta,
  ForecastScenarioId,
  ForecastV4Input,
  ForecastV4Result,
} from "@/lib/engine/forecastEngineV4";
import type { ForecastBriefing } from "@/lib/ai/strategistAgent";
import { readConsensusTarget } from "@/lib/engine/consensusTargetPlan";
import { getActiveStrategicRoute } from "@/lib/state/activeStrategicRoute";

type Props = {
  v4: ForecastV4Result;
  v4Input: ForecastV4Input;
  networkDelta?: ForecastNetworkDelta;
  newsHeadlines?: string[];
  scenarioMode?: ForecastScenarioId;
  horizonKey?: ForecastHorizonKey;
  excludedEntityIds?: string[];
  briefing?: ForecastBriefing | null;
  backtest?: ForecastBacktestV4 | null;
  className?: string;
  label?: string;
  /** `fab` = angolo scenario; default = stile report/topbar. */
  variant?: "default" | "fab";
};

function PdfIcon({ busy }: { busy: boolean }) {
  if (busy) {
    return (
      <span
        aria-hidden
        className="fn-export-dossier-icon is-busy"
      />
    );
  }
  return (
    <svg
      aria-hidden
      className="fn-export-dossier-icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M8 2.5v7.2M8 9.7 5.4 7.1M8 9.7l2.6-2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11.2v1.3c0 .6.5 1.1 1.1 1.1h7.8c.6 0 1.1-.5 1.1-1.1v-1.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ExportDossierPdfButton({
  v4,
  v4Input,
  networkDelta,
  newsHeadlines = [],
  scenarioMode = "base",
  horizonKey = "d180",
  excludedEntityIds = [],
  briefing = null,
  backtest = null,
  className,
  label = "Esporta Dossier PDF",
  variant = "default",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/export/dossier-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          v4,
          v4Input,
          networkDelta,
          newsHeadlines,
          scenarioMode,
          horizonKey,
          excludedEntityIds,
          briefing,
          backtest,
          ...(() => {
            const stored = readConsensusTarget();
            const route = getActiveStrategicRoute();
            return {
              ...(stored
                ? { consensusTarget: { targetPct: stored.targetPct, horizon: stored.horizon } }
                : {}),
              ...(route ? { activeStrategicRoute: route } : {}),
            };
          })(),
        }),
      });
      if (!res.ok) {
        let msg = "Esportazione PDF non riuscita.";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/i.exec(cd);
      const filename = match?.[1] ?? "Dossier_Strategico_FN.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore esportazione PDF.");
    } finally {
      setBusy(false);
    }
  }

  if (variant === "fab") {
    return (
      <span className="fn-export-dossier-wrap">
        <button
          type="button"
          className={["fn-export-dossier-btn", busy ? "is-busy" : "", className]
            .filter(Boolean)
            .join(" ")}
          disabled={busy}
          onClick={() => void onExport()}
          aria-busy={busy}
          title={
            busy
              ? "Generazione PDF in corso…"
              : "Esporta Dossier Strategico in PDF"
          }
        >
          <span className="fn-export-dossier-glyph" aria-hidden>
            <PdfIcon busy={busy} />
          </span>
          <span className="fn-export-dossier-copy">
            <span className="fn-export-dossier-label">
              {busy ? "Generazione PDF in corso…" : label}
            </span>
          </span>
        </button>
        {error ? (
          <span className="fn-export-dossier-error" role="alert">
            {error}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button
        type="button"
        className={className ?? "forecast-strategist-open"}
        disabled={busy}
        onClick={() => void onExport()}
        aria-busy={busy}
        title={
          busy
            ? "Generazione PDF in corso…"
            : "Esporta Dossier Strategico in PDF"
        }
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
            />
            Generazione PDF in corso…
          </span>
        ) : (
          `↓ ${label.replace(/^↓\s*/, "")}`
        )}
      </button>
      {error ? (
        <span className="text-[11px] text-rose-400" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
