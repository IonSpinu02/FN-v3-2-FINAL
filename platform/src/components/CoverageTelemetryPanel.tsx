"use client";

import { useEffect, useState } from "react";
import type { CoverageManifest } from "@/lib/engine/coverageManifest";
import { LEDGER_FILE_BADGE } from "@/lib/db/ledgerLabels";

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
  } catch {
    return iso;
  }
}

type CronStatus = {
  cronConfigured: boolean;
  lastAutonomousRunAt: string | null;
  storage: "postgres" | "file" | null;
};

export function CoverageTelemetryPanel({
  newsConsidered = 0,
  newsDetected,
  windowStart,
  windowEnd,
  calendarSource,
  calendarUsedFallback,
  busy = false,
}: {
  newsConsidered?: number;
  newsDetected?: number;
  windowStart?: string | null;
  windowEnd?: string | null;
  calendarSource?: "official-calendar" | "local-catalog";
  calendarUsedFallback?: boolean;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manifest, setManifest] = useState<CoverageManifest | null>(null);
  const [cron, setCron] = useState<CronStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const qs = new URLSearchParams({
      newsConsidered: String(newsConsidered),
      newsDetected: String(newsDetected ?? newsConsidered),
    });
    if (windowStart) qs.set("windowStart", windowStart);
    if (windowEnd) qs.set("windowEnd", windowEnd);
    void Promise.all([
      fetch(`/api/coverage/manifest?${qs}`, { signal: controller.signal }).then(
        async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return (await res.json()) as {
            ok?: boolean;
            manifest?: CoverageManifest;
            cronConfigured?: boolean;
            lastAutonomousRunAt?: string | null;
          };
        },
      ),
      fetch(`/api/ledger/ingestion?limit=5`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as {
            storage?: "postgres" | "file";
            rows?: Array<{ checkedAt: string; triggerType: string }>;
            cronConfigured?: boolean;
          };
        })
        .catch(() => null),
    ])
      .then(([manifestRes, ingestionRes]) => {
        if (!manifestRes.manifest) throw new Error("Manifest assente");
        setManifest(manifestRes.manifest);
        const cronRuns = (ingestionRes?.rows ?? []).filter(
          (r) => r.triggerType === "cron",
        );
        setCron({
          cronConfigured: Boolean(
            manifestRes.cronConfigured ?? ingestionRes?.cronConfigured,
          ),
          lastAutonomousRunAt: cronRuns[0]?.checkedAt ?? null,
          storage: ingestionRes?.storage ?? manifestRes.manifest.storage,
        });
        setError(null);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Telemetria non disponibile");
      });
    return () => controller.abort();
  }, [open, newsConsidered, newsDetected, windowStart, windowEnd]);

  const fallback =
    calendarUsedFallback ??
    (calendarSource === "local-catalog" ? true : undefined) ??
    manifest?.calendar.usedFallback ??
    false;

  const recentCron =
    cron?.lastAutonomousRunAt &&
    Date.now() - Date.parse(cron.lastAutonomousRunAt) < 2 * 60 * 60 * 1000;

  return (
    <span className="coverage-telemetry">
      <button
        type="button"
        className="coverage-telemetry-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={`coverage-dot ${busy ? "is-busy" : fallback ? "is-fallback" : "is-ok"}`}
          aria-hidden
        />
        <span className="coverage-telemetry-label">Telemetria & copertura fonti</span>
      </button>
      {open ? (
        <div className="coverage-telemetry-popover" role="dialog" aria-label="Copertura fonti">
          <header>
            <strong>Pannello telemetria & copertura</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi">
              ×
            </button>
          </header>
          {error ? <p className="coverage-error">{error}</p> : null}
          <ul className="coverage-status-triad" aria-label="Stato monitoraggio">
            <li>
              <strong>1. Cron configurato</strong>
              <span>
                {cron?.cronConfigured
                  ? "CRON_SECRET presente (fail-closed attivo)"
                  : "Secret assente o non rilevato — monitoraggio autonomo non dichiarato attivo"}
              </span>
            </li>
            <li>
              <strong>2. Ultima esecuzione server autonoma</strong>
              <span>
                {cron?.lastAutonomousRunAt
                  ? fmt(cron.lastAutonomousRunAt)
                  : "Nessuna esecuzione cron verificata nel ledger"}
                {!recentCron
                  ? " — non dichiarare «sorveglianza 24/7» senza run recenti"
                  : ""}
              </span>
            </li>
            <li>
              <strong>3. Copertura effettiva per fonte</strong>
              <span>Vedi elenco sotto (fetched / accepted / rejected / fallback).</span>
            </li>
          </ul>
          {manifest ? (
            <>
              <p className="coverage-storage">
                Storage ledger:{" "}
                <strong>
                  {cron?.storage === "file" || manifest.storage === "file"
                    ? LEDGER_FILE_BADGE
                    : "PostgreSQL"}
                </strong>
              </p>
              <p className="coverage-note">{manifest.news.note}</p>
              <p className="coverage-note">
                {manifest.calendar.note}
                {manifest.calendar.usedFallback ? (
                  <>
                    {" "}
                    <em>(usedFallback: true)</em>
                  </>
                ) : null}
              </p>
              <ul className="coverage-source-list">
                {manifest.sources.map((s) => (
                  <li key={s.sourceKey}>
                    <strong>{s.label}</strong>
                    <span>Ultimo controllo: {fmt(s.lastCheckedAt)}</span>
                    <span>Ultimo contenuto nuovo: {fmt(s.lastNewItemAt)}</span>
                    <span>Ultimo ricalcolo: {fmt(s.lastRecalcAt)}</span>
                    <span>Metodo previsione aggiornato</span>
                    <span>
                      Stato: {s.status}
                      {s.usedFallback
                        ? ` · fallback${s.fallbackLabel ? `: ${s.fallbackLabel}` : ""}`
                        : ""}
                    </span>
                    <span>
                      Acquisiti {s.itemsAccepted}/{s.itemsFetched} (respinti{" "}
                      {s.itemsRejected})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : !error ? (
            <p>Caricamento manifesto di copertura…</p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
