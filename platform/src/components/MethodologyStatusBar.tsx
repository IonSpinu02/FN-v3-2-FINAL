"use client";

import { Btn } from "@/components/ui/FnUi";
import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MethodologyStatusBar({
  compact = false,
  hudPill = false,
}: {
  compact?: boolean;
  hudPill?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const detailsButton = (
    <button
      type="button"
      className={
        compact
          ? "shrink-0 text-[11px] font-medium text-amber-200/90 underline-offset-2 hover:underline"
          : "fn-method-link shrink-0"
      }
      onClick={() => setOpen(true)}
    >
      Metodologia ↗
    </button>
  );

  return (
    <>
      {hudPill ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-amber-500/25 bg-[#070D19]/80 px-4 py-2 text-[11px] text-amber-100/90 shadow-lg backdrop-blur-xl transition-colors hover:border-amber-400/40"
        >
          Scenario descrittivo · 7,2% input ·{" "}
          <span className="font-semibold text-amber-200">Metodologia ↗</span>
        </button>
      ) : compact ? (
        <div
          className="flex h-8 items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100/90"
          role="status"
          aria-label="Avvertenze metodologiche"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden />
            <p className="truncate">Scenario descrittivo · input 7,2%</p>
          </div>
          {detailsButton}
        </div>
      ) : (
        <div
          className="fn-method-bar"
          role="status"
          aria-label="Avvertenze metodologiche"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-xs text-amber-100/90">
            Scenario descrittivo (
            <span className="font-mono tabular-nums">predizione_validata: false</span>
            ) · input demoscopico 7,2%
          </p>
          {detailsButton}
        </div>
      )}

      {open && (
        <div
          className="fn-modal-scrim screen-only"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dialogRef}
            className="fn-bento fn-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="method-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="method-title" className="fn-display text-lg font-semibold">
                Metodologia
              </h2>
              <button
                type="button"
                className="fn-icon-btn"
                aria-label="Chiudi"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-fn-text-muted">
              <p>
                <strong className="text-fn-text">Osservatorio integrato</strong>{" "}
                — scenario territoriale, fabbisogni BesT/AGENAS, eventi e Google Trends
                (0–100). Input consenso nazionale: 7,2% (ottobre 2026,{" "}
                <a
                  href="https://www.youtrend.it/la-supermedia/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-fn-accent underline"
                >
                  Supermedia YouTrend/AGI
                </a>
                ).
              </p>
              <p>
                Confronti benchmark FdI+Lega 2024 e simulazioni Monte Carlo sono strumenti
                di esplorazione interna.
              </p>
              <p className="text-xs">
                Uso interno · accesso riservato al team di scenario.
              </p>
            </div>
            <Btn variant="primary" className="mt-6" onClick={() => setOpen(false)}>
              Ho compreso
            </Btn>
          </div>
        </div>
      )}
    </>
  );
}
