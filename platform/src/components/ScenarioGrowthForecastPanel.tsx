"use client";

import { useRealtimeDomain } from "@/components/realtime/RealtimeSyncProvider";
import {
  computePartyGrowthForecast,
  type GrowthRegimeId,
} from "@/lib/engine/partyGrowthForecast";
import {
  forecastInputFromProjection,
  REGIME_SENSITIVITY,
  type GrowthEvidence,
  type ProjectMonthsInput,
} from "@/lib/engine/growthTrajectory";
import {
  computeForecastV4,
  forecastHorizon,
  forecastRegionsFromScenario,
  recommendForecastAction,
  type ForecastActionRecommendation,
  type ForecastV4Result,
  type ForecastHorizonKey,
  type ForecastNetworkDelta,
} from "@/lib/engine/forecastEngineV4";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import { formatDecimalIt, formatPpSignedIt } from "@/lib/formatIt";
import { formatCompactVotes } from "@/lib/formatApproximateVotes";
import { useSimulatedEntries } from "@/lib/simulatedEntriesStore";
import { REGIONS, type Region } from "@/lib/engine/constants";
import {
  buildScenarioRegionalV4Map,
  type ScenarioRegionalV4View,
} from "@/lib/scenarioRegionalV4";
import { useEffect, useMemo, useRef, useState } from "react";
import { GrowthForecastReport } from "@/components/GrowthForecastReport";
import { ForecastSidebarCompact } from "@/components/ForecastOperationalBlocks";
import { ExportDossierPdfButton } from "@/components/ExportDossierPdfButton";

const SIDEBAR_SCROLL =
  "[scrollbar-width:thin] [scrollbar-color:#1E293B_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full";

export { SIDEBAR_SCROLL };

export function ScenarioGrowthForecastPanel({
  scenario,
  poll,
  flussiIpsos,
  regime,
  focusRegion,
  onRegionalV4Map,
  curveRequest = 0,
  onEvidence,
  onRecommendation,
  onForecast,
  pollsLoading = false,
}: {
  scenario: ScenarioResult;
  poll: RegionPollResult[];
  flussiIpsos: FlussiIpsos;
  regime: GrowthRegimeId;
  onRegimeChange: (r: GrowthRegimeId) => void;
  focusRegion?: string | null;
  onRegionalV4Map?: (payload: {
    map: Record<string, ScenarioRegionalV4View>;
    asOf: Date;
  }) => void;
  /** Incremento: apre il report sull'orizzonte a 30 giorni. */
  curveRequest?: number;
  onEvidence?: (evidence: GrowthEvidence) => void;
  onRecommendation?: (recommendation: ForecastActionRecommendation) => void;
  onForecast?: (forecast: ForecastV4Result) => void;
  /** Finché i sondaggi live non sono risolti, non mostrare % cablate. */
  pollsLoading?: boolean;
}) {
  const totVoti = scenario.righe.reduce((s, r) => s + r.voti_di_scenario, 0);
  const [previewKey, setPreviewKey] = useState<ForecastHorizonKey>("d180");
  const [reportOpen, setReportOpen] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [remoteEvidence, setRemoteEvidence] = useState<GrowthEvidence | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [asOf, setAsOf] = useState(() => new Date());
  const [networkDelta, setNetworkDelta] = useState<ForecastNetworkDelta>({
    comitati: 0,
    tesserati: 0,
  });
  const simulatedProfiles = useSimulatedEntries();
  const onEvidenceRef = useRef(onEvidence);
  const [handledCurveRequest, setHandledCurveRequest] = useState(0);
  if (curveRequest !== handledCurveRequest) {
    setHandledCurveRequest(curveRequest);
    if (curveRequest) {
      setPreviewKey("d180");
      setReportOpen(true);
    }
  }

  useEffect(() => {
    onEvidenceRef.current = onEvidence;
  }, [onEvidence]);

  useEffect(() => {
    const sPct=(scenario.parametri.S*100).toFixed(2);
    const controller=new AbortController();
    let inFlight=false, lastAttempt=0;
    const refresh=async(force=false)=>{
      if(inFlight || (!force && Date.now()-lastAttempt<60000)) return;
      inFlight=true;lastAttempt=Date.now();setRefreshing(true);
      try {
        const res=await fetch(`/api/forecast/growth?sPct=${sPct}&regime=organica`,{signal:controller.signal,cache:"no-store"});
        if(!res.ok)throw new Error("Aggiornamento dati non disponibile");
        const data=await res.json() as {asOf?:string;narrative?:string|null;evidence?:GrowthEvidence};
        if(controller.signal.aborted||!data.evidence)return;
        setNarrative(data.narrative??null);
        setRemoteEvidence((prev) => {
          const next = data.evidence!;
          if (
            prev &&
            prev.slopePpPerMonth === next.slopePpPerMonth &&
            prev.newsScore === next.newsScore &&
            prev.bipMatches === next.bipMatches &&
            JSON.stringify(prev.newsHeadlines) === JSON.stringify(next.newsHeadlines)
          ) {
            return prev;
          }
          return next;
        });
        // Solo giorno UTC: evita ricomputi V4 / computationId a ogni fetch con timestamp diverso.
        const timestamp = data.asOf ? new Date(data.asOf) : new Date();
        const dayKey = timestamp.toISOString().slice(0, 10);
        setAsOf((prev) =>
          prev.toISOString().slice(0, 10) === dayKey ? prev : timestamp,
        );
        onEvidenceRef.current?.(data.evidence);
        setRefreshError(null);
        setSyncedAt(
          timestamp.toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      }catch {if(!controller.signal.aborted)setRefreshError("Aggiornamento non riuscito: restano visibili gli ultimi dati disponibili.");}
      finally {inFlight=false;if(!controller.signal.aborted)setRefreshing(false);}
    };
    refreshRef.current=()=>{void refresh(true);};
    const timer=window.setTimeout(()=>void refresh(),350);
    return ()=>{window.clearTimeout(timer);refreshRef.current=()=>{};controller.abort();};
  }, [scenario.parametri.S, regime]);

  useRealtimeDomain("consenso", () => {
    refreshRef.current();
  });

  const regions = useMemo(
    () => forecastRegionsFromScenario(scenario.righe, poll),
    [scenario.righe, poll],
  );

  const forecast = useMemo(
    () =>
      computePartyGrowthForecast({
        startS: scenario.parametri.S,
        totVoti,
        regime: "organica",
        flussi: flussiIpsos,
        rows: scenario.righe,
        poll,
        evidence: remoteEvidence ?? undefined,
        regions,
        comitati: scenario.parametri.comitati,
        profiles: simulatedProfiles,
        networkDelta,
        asOf,
      }),
    [scenario, totVoti, flussiIpsos, poll, remoteEvidence, regions, simulatedProfiles, networkDelta, asOf],
  );

  const projectionInput: Omit<ProjectMonthsInput, "months" | "mayMonths"> = useMemo(
    () => ({
      startPct: scenario.parametri.S * 100,
      evidence: forecast.evidence,
      sensitivity: REGIME_SENSITIVITY.organica,
      asOf,
      flussi: flussiIpsos,
      regions,
      comitati: scenario.parametri.comitati,
      networkDelta,
      profiles: simulatedProfiles,
    }),
    [
      scenario.parametri.S,
      scenario.parametri.comitati,
      forecast.evidence,
      asOf,
      flussiIpsos,
      regions,
      networkDelta,
      simulatedProfiles,
    ],
  );

  const v4Input = useMemo(
    () => forecastInputFromProjection(projectionInput, asOf),
    [projectionInput, asOf],
  );
  const v4 = useMemo(() => computeForecastV4(v4Input), [v4Input]);
  const recommendation = useMemo(() => recommendForecastAction(v4), [v4]);
  useEffect(() => {
    onRecommendation?.(recommendation);
  }, [onRecommendation, recommendation]);
  useEffect(() => {
    onForecast?.(v4);
  }, [onForecast, v4]);

  const regionalV4Map = useMemo(
    () => buildScenarioRegionalV4Map(v4Input, v4, scenario.righe, asOf),
    [v4Input, v4, scenario.righe, asOf],
  );

  useEffect(() => {
    onRegionalV4Map?.({ map: regionalV4Map, asOf });
  }, [onRegionalV4Map, regionalV4Map, asOf]);

  const h30 = forecastHorizon(v4, "base", "d30");
  const h90 = forecastHorizon(v4, "base", "d90");
  const h180 = forecastHorizon(v4, "base", "d180");
  const off180 = forecastHorizon(v4, "offensiva", "d180");
  const focusV4 = focusRegion ? regionalV4Map[focusRegion] : undefined;

  if (pollsLoading) {
    return (
      <div className="forecast-widget p-4" aria-busy="true">
        <header className="forecast-widget-header">
          <p className="forecast-eyebrow">PREVISIONE CONSENSO</p>
        </header>
        <p className="forecast-sidebar-lead text-slate-400">
          Caricamento sondaggi… <strong>—%</strong>
        </p>
        <p className="forecast-widget-footnote">
          I numeri di consenso e proiezione appaiono solo a dato risolto (niente
          valori cablati provvisori).
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="forecast-widget p-4">
        <header className="forecast-widget-header">
          <p className="forecast-eyebrow">PREVISIONE CONSENSO</p>
        </header>
        <div className="forecast-widget-body">
          <ForecastSidebarCompact
            startPct={v4.startPct}
            h30={h30}
            h90={h90}
            h180={h180}
            off180={off180}
            onOpen={() => setReportOpen(true)}
          />
          {focusV4 && v4.startPct > 0 ? (
            <p className="forecast-regional-note">
              Focus {focusV4.regione}: {formatDecimalIt(focusV4.startPct, 2)}% →{" "}
              {formatDecimalIt(focusV4.mag27BasePct, 2)}% ({formatPpSignedIt(focusV4.deltaPp, 2)} ·{" "}
              {formatCompactVotes(focusV4.addedVotes)} · sat.{" "}
              {Math.round(focusV4.reachSaturation * 100)}%) · bacini e saturazione regionale (stima)
            </p>
          ) : null}
        </div>
        {refreshError && (
          <p className="forecast-widget-footnote" role="status">
            {refreshError}
          </p>
        )}
        {!reportOpen ? (
          <div className="mt-3 w-full [&_.fn-export-dossier-btn]:w-full [&_.fn-export-dossier-btn]:justify-center [&_.fn-export-dossier-wrap]:w-full">
            <ExportDossierPdfButton
              v4={v4}
              v4Input={v4Input}
              networkDelta={networkDelta}
              newsHeadlines={forecast.evidence.newsHeadlines ?? []}
              scenarioMode="base"
              horizonKey={previewKey}
              variant="fab"
              label="Esporta Dossier PDF"
              className="h-9 w-full justify-center rounded-lg border border-[var(--border-default)] bg-[var(--surface-2)] text-[12px] font-medium text-[var(--ink-primary)] hover:bg-[var(--surface-hover)]"
            />
          </div>
        ) : null}
      </div>
      <GrowthForecastReport
        onRefreshData={() => refreshRef.current()}
        refreshing={refreshing}
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        forecast={forecast}
        narrative={narrative}
        syncedAt={syncedAt}
        initialHorizon={previewKey}
        projectionInput={projectionInput}
        v4Input={v4Input}
        v4={v4}
        networkDelta={networkDelta}
        onNetworkDeltaChange={setNetworkDelta}
        simulatedProfiles={simulatedProfiles.length}
        initialSelectedRegion={
          focusRegion && REGIONS.includes(focusRegion as Region)
            ? (focusRegion as Region)
            : null
        }
      />
    </>
  );
}
