"use client";

import { useRealtimeSync } from "@/components/realtime/RealtimeSyncProvider";
import { REGIONS, type Region } from "@/lib/engine/constants";
import { buildDemoTrendsSeries } from "@/lib/engine/demoTrendsSeries";
import {
  isRegionScope,
  TERRITORY_NAZIONALE,
  type TerritoryScope,
} from "@/lib/engine/osservatorioTerritoryScope";
import { buildMonthlyScheda } from "@/lib/engine/monthlyScheda";
import {
  loadOsservatorioLocal,
  saveOsservatorioLocal,
} from "@/lib/engine/osservatorioStorage";
import type {
  FabbisogniCatalogFile,
  FabbisogniRegione,
  GoogleTrendsSeries,
  OsservatorioCloudPayload,
  OsservatorioEvento,
  PrioritaDichiarateRilevazione,
} from "@/lib/engine/osservatorioTypes";
import { parseGoogleTrendsCsv } from "@/lib/engine/parseGoogleTrendsCsv";
import { parsePrioritaSurveyCsv } from "@/lib/engine/parsePrioritaSurveyCsv";
import type { ScenarioResult } from "@/lib/engine/types";
import { compareTrendSeries } from "@/lib/engine/eventStudyProtocol";
import { saveCampaignIntervention } from "@/lib/engine/campaignIntervention";
import { OsservatorioBentoLayout } from "@/components/osservatorio/OsservatorioBentoLayout";
import type { TerritoryIssue, TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import { categoryLabel } from "@/lib/engine/territoryIssuesTypes";
import {
  exportOsservatorioPdf,
  PrintOsservatorioReport,
} from "./PrintOsservatorioReport";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type {
  FlussiMatrixId,
  RegionalGrowthForecast,
} from "@/lib/politicalModel";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardTab = "scenario" | "osservatorio" | "locali";

function emptyCloud(): OsservatorioCloudPayload {
  return {
    events: [],
    trendsSeries: [],
    prioritaDichiarate: {},
    monthlyNotes: {},
  };
}

const SEED_EVENT_DATE_PATCH: Record<string, string> = {
  "caso-vannacci-corona-draft": "2026-09-26",
  "caso-agricoltori-contestazione-draft": "2026-10-09",
};

function normalizeOsservatorioEvents(
  events: OsservatorioEvento[],
): OsservatorioEvento[] {
  return events.map((e) => {
    const patch = SEED_EVENT_DATE_PATCH[e.id];
    if (!patch) return e;
    if (e.data.startsWith("2026-01") || e.data.startsWith("2026-02")) {
      return { ...e, data: patch };
    }
    return e;
  });
}

const ORDER_THEMES = ["SANITA", "TRASPORTI", "LAVORO", "SICUREZZA", "COSTO_VITA", "TERRITORIO"] as const;

export function OsservatorioPanel({
  scenario,
  baselineScenario: _baselineScenario,
  liveS,
  flussiIpsos: _flussiIpsos,
  flussiMatrixId: _flussiMatrixId,
  onSelectFlussiMatrix: _onSelectFlussiMatrix,
  regionalGrowthByRegion,
  onRestoreBaselineS: _onRestoreBaselineS,
  onOpenTab: _onOpenTab,
  dossierRegion,
  dossierCategory,
}: {
  scenario: ScenarioResult;
  baselineScenario: ScenarioResult;
  liveS: number;
  flussiIpsos: FlussiIpsos;
  flussiMatrixId: FlussiMatrixId;
  onSelectFlussiMatrix: (id: FlussiMatrixId) => void;
  regionalGrowthByRegion: Record<string, RegionalGrowthForecast>;
  onRestoreBaselineS: () => void;
  onOpenTab: (tab: DashboardTab) => void;
  dossierRegion?: string | null;
  dossierCategory?: string | null;
}) {
  const { requestDomainRefresh } = useRealtimeSync();
  void _onOpenTab;
  void _baselineScenario;
  void _onRestoreBaselineS;
  void _flussiIpsos;
  void _flussiMatrixId;
  void _onSelectFlussiMatrix;
  const [fabbisogni, setFabbisogni] = useState<FabbisogniCatalogFile | null>(
    null,
  );
  const [cloud, setCloud] = useState<OsservatorioCloudPayload>(emptyCloud());
  const dossierIsRegion = REGIONS.includes(dossierRegion as Region);
  const [mainTerritory, setMainTerritory] = useState<TerritoryScope>(
    dossierIsRegion ? (dossierRegion as Region) : TERRITORY_NAZIONALE,
  );
  const [regione, setRegione] = useState<Region>(
    dossierIsRegion ? (dossierRegion as Region) : "Veneto",
  );
  const [orderCategory, setOrderCategory] = useState<TerritoryIssueCategory | null>(null);

  useEffect(() => {
    if (!REGIONS.includes(dossierRegion as Region)) return;
    const next = dossierRegion as Region;
    setRegione(next);
    setMainTerritory(next);
  }, [dossierRegion]);
  const [activeTrendId, setActiveTrendId] = useState<string | null>(null);
  const [trendsNote, setTrendsNote] = useState("");
  const [dbConnected, setDbConnected] = useState(false);
  const [cloudMeta, setCloudMeta] = useState<{
    updatedAt: string | null;
    updatedBy: string | null;
    source: string;
  }>({ updatedAt: null, updatedBy: null, source: "seed" });
  const [prioritaForm, setPrioritaForm] = useState<
    Partial<PrioritaDichiarateRilevazione>
  >({
    campioneN: 800,
    metodoSelezione: "CAS stratificato per territorio",
    mancataRispostaPct: 12,
    margineIncertezzaPct: 3.5,
    periodoRilevazione: "",
  });

  const mergeCloud = useCallback(
    (server: OsservatorioCloudPayload, local: OsservatorioCloudPayload | null) => {
      const base = { ...server };
      if (!local) return base;
      const events = normalizeOsservatorioEvents([...base.events]);
      for (const e of local.events) {
        if (!events.some((x) => x.id === e.id)) {
          const norm = normalizeOsservatorioEvents([e])[0];
          if (norm) events.push(norm);
        }
      }
      return {
        events: normalizeOsservatorioEvents(events),
        trendsSeries: local.trendsSeries.length
          ? local.trendsSeries
          : base.trendsSeries,
        prioritaDichiarate: {
          ...base.prioritaDichiarate,
          ...local.prioritaDichiarate,
        },
        monthlyNotes: { ...base.monthlyNotes, ...local.monthlyNotes },
      };
    },
    [],
  );

  useEffect(() => {
    void fetch("/api/osservatorio")
      .then((r) => r.json())
      .then(
        (data: {
          fabbisogni?: FabbisogniCatalogFile;
          cloud?: OsservatorioCloudPayload;
          dbConnected?: boolean;
          source?: string;
          updatedAt?: string | null;
          updatedBy?: string | null;
        }) => {
          if (data.fabbisogni) setFabbisogni(data.fabbisogni);
          const local = loadOsservatorioLocal();
          const merged = mergeCloud(data.cloud ?? emptyCloud(), local);
          setCloud(merged);
          setDbConnected(Boolean(data.dbConnected));
          setCloudMeta({
            updatedAt: data.updatedAt ?? null,
            updatedBy: data.updatedBy ?? null,
            source: data.source ?? "seed",
          });
          if (merged.trendsSeries[0]) {
            setActiveTrendId(merged.trendsSeries[0]!.id);
          }
        },
      )
      .catch(() => {});
  }, [mergeCloud]);

  const events = cloud.events;
  const activeTrend =
    cloud.trendsSeries.find((s) => s.id === activeTrendId) ??
    cloud.trendsSeries[0] ??
    null;

  useEffect(() => {
    if (isRegionScope(mainTerritory)) setRegione(mainTerritory);
  }, [mainTerritory]);

  const prioritaRegione = cloud.prioritaDichiarate[regione];
  const monthlyNote = cloud.monthlyNotes[regione];

  const fabRegione: FabbisogniRegione | undefined =
    fabbisogni?.regions[regione];

  const activeTrendSeries = useMemo(() => {
    if (activeTrend?.points.length) return activeTrend;
    return buildDemoTrendsSeries();
  }, [activeTrend]);

  const scheda = useMemo(
    () =>
      buildMonthlyScheda(
        regione,
        scenario,
        fabRegione,
        events,
        trendsNote ||
          (activeTrendSeries ? `Serie «${activeTrendSeries.query}»` : ""),
        prioritaRegione,
        monthlyNote,
      ),
    [
      regione,
      scenario,
      fabRegione,
      events,
      trendsNote,
      activeTrendSeries,
      prioritaRegione,
      monthlyNote,
    ],
  );

  const persistCloud = useCallback((next: OsservatorioCloudPayload) => {
    setCloud(next);
    saveOsservatorioLocal(next);
  }, []);

  async function saveToCloudDb() {
    persistCloud(cloud);
    const res = await fetch("/api/osservatorio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cloud,
        summary: `Salvataggio Osservatorio (${cloud.events.length} eventi)`,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setDbConnected(true);
      setCloudMeta({
        updatedAt: new Date().toISOString(),
        updatedBy: data.updatedBy ?? "dashboard",
        source: "db",
      });
      void requestDomainRefresh("news");
    }
  }

  function addDraftEvent() {
    const id = crypto.randomUUID();
    const nuovo: OsservatorioEvento = {
      id,
      titolo: "Nuovo episodio (compilare)",
      data: new Date().toISOString().slice(0, 10),
      tema: "da classificare",
      livello: "attenzione",
      fontePrimaria: "",
      finestraPreGiorni: 14,
      finestraPostGiorni: 14,
      finestraExtraGiorni: [3, 7, 30],
      statoVerifica: "draft",
      sondaggioComparabile: "non_disponibile",
      notaMetodologica:
        "Verificare fonte primaria; annotare eventi concorrenti; no inferenza automatica sul voto.",
    };
    persistCloud({ ...cloud, events: [nuovo, ...events] });
  }

  function applyTrendsSeries(series: GoogleTrendsSeries) {
    const list = [
      series,
      ...cloud.trendsSeries.filter((s) => s.id !== series.id),
    ];
    persistCloud({ ...cloud, trendsSeries: list });
    setActiveTrendId(series.id);
    analyzeTrends(series);
  }

  function analyzeTrends(series: GoogleTrendsSeries) {
    const pts = series.points;
    if (pts.length < 4) return;
    const mid = Math.floor(pts.length / 2);
    const cmp = compareTrendSeries(
      pts.slice(0, mid).map((p) => p.value),
      pts.slice(mid).map((p) => p.value),
    );
    setTrendsNote(
      `${pts.length} punti · media pre ${cmp.mediaPre.toFixed(1)} → post ${cmp.mediaPost.toFixed(1)} (0–100 relativo)`,
    );
  }

  function onTrendsCsv(text: string) {
    const pts = parseGoogleTrendsCsv(text);
    if (pts.length < 4) {
      setTrendsNote("CSV non valido o troppo corto");
      return;
    }
    const series: GoogleTrendsSeries = {
      id: crypto.randomUUID(),
      query: "import-csv",
      queryType: "term",
      territory: "Italia",
      windowStart: pts[0]!.date,
      windowEnd: pts[pts.length - 1]!.date,
      extractedAt: new Date().toISOString(),
      points: pts,
    };
    applyTrendsSeries(series);
  }

  function loadDemoTrends() {
    applyTrendsSeries(buildDemoTrendsSeries());
  }

  function savePrioritaManuale() {
    if (!prioritaForm.campioneN || prioritaForm.campioneN <= 0) return;
    const rec: PrioritaDichiarateRilevazione = {
      regione,
      campioneN: prioritaForm.campioneN,
      metodoSelezione: prioritaForm.metodoSelezione ?? "",
      mancataRispostaPct: prioritaForm.mancataRispostaPct ?? 0,
      margineIncertezzaPct: prioritaForm.margineIncertezzaPct ?? 0,
      periodoRilevazione: prioritaForm.periodoRilevazione ?? "",
      q1_problemiTerritorio: prioritaForm.q1_problemiTerritorio,
      q2_difficoltaPersonali: prioritaForm.q2_difficoltaPersonali,
      q3_soddisfazioneServizi: prioritaForm.q3_soddisfazioneServizi,
      q4_urgenzaSoluzioni: prioritaForm.q4_urgenzaSoluzioni,
      q5_intenzioneVotoFacoltativa: prioritaForm.q5_intenzioneVotoFacoltativa,
    };
    persistCloud({
      ...cloud,
      prioritaDichiarate: { ...cloud.prioritaDichiarate, [regione]: rec },
    });
  }

  function onPrioritaCsv(text: string) {
    const rows = parsePrioritaSurveyCsv(text);
    if (!rows.length) return;
    const next = { ...cloud.prioritaDichiarate };
    for (const r of rows) next[r.regione] = r;
    persistCloud({ ...cloud, prioritaDichiarate: next });
  }

  function setMonthlyNote(v: string) {
    persistCloud({
      ...cloud,
      monthlyNotes: { ...cloud.monthlyNotes, [regione]: v },
    });
  }

  const registerIssueAsEvent = useCallback(
    (issue: TerritoryIssue) => {
      const targetRegion =
        issue.regione === "NAZIONALE" ? regione : issue.regione;
      const nuovo: OsservatorioEvento = {
        id: crypto.randomUUID(),
        titolo: issue.titoloProblema,
        data: new Date().toISOString().slice(0, 10),
        tema: categoryLabel(issue.categoria),
        livello: "attenzione",
        fontePrimaria: issue.sourceUrl,
        finestraPreGiorni: 14,
        finestraPostGiorni: 14,
        finestraExtraGiorni: [3, 7, 30],
        statoVerifica: "draft",
        sondaggioComparabile: "non_disponibile",
        regione: targetRegion,
        notaMetodologica: `Radar B.I.P.-driven · ${issue.bipSolutionBadge ?? "Cap. programma"}. ${issue.provinciaComune}. ${issue.azionePoliticaConsigliata.cosaDire.slice(0, 200)}`,
      };
      persistCloud({ ...cloud, events: [nuovo, ...events] });
      saveCampaignIntervention({
        region: targetRegion,
        tema: categoryLabel(issue.categoria),
        frase: issue.azionePoliticaConsigliata.cosaDire.slice(0, 240),
        date: nuovo.data,
        consensusPct: liveS * 100,
      });
    },
    [cloud, events, persistCloud, regione, liveS],
  );

  void cloudMeta;

  return (
    <div className="pb-32">
      <OsservatorioBentoLayout
        scenario={scenario}
        liveS={liveS}
        mainTerritory={mainTerritory}
        setMainTerritory={setMainTerritory}
        regione={regione}
        setRegione={setRegione}
        regionalGrowthByRegion={regionalGrowthByRegion}
        fabRegione={fabRegione}
        activeTrendSeries={activeTrendSeries}
        eventCount={events.length}
        dbConnected={dbConnected}
        onRegisterIssueEvent={registerIssueAsEvent}
        onExportPdf={() => exportOsservatorioPdf()}
        onPrioritaCsv={onPrioritaCsv}
        onTrendsCsv={onTrendsCsv}
        onLoadDemoTrends={loadDemoTrends}
        onAddEvent={addDraftEvent}
        onSavePriorita={savePrioritaManuale}
        onSaveCloud={() => void saveToCloudDb()}
        focusCategory={
          dossierCategory &&
          (ORDER_THEMES as readonly string[]).includes(dossierCategory)
            ? (dossierCategory as TerritoryIssueCategory)
            : orderCategory
        }
      />

      <PrintOsservatorioReport
        regione={regione}
        scenario={scenario}
        scheda={scheda}
        indicatori={fabRegione?.indicatori ?? []}
        events={events.filter((e) => !e.regione || e.regione === regione)}
        trendsSeries={activeTrend}
        priorita={prioritaRegione}
      />
    </div>
  );
}
