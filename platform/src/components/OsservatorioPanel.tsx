"use client";

import type { Region } from "@/lib/engine/constants";
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
import { OsservatorioOnePageDossier } from "@/components/OsservatorioOnePageDossier";
import {
  exportOsservatorioPdf,
  PrintOsservatorioReport,
} from "./PrintOsservatorioReport";
import { useCallback, useEffect, useMemo, useState } from "react";

type DashboardTab = "scenario" | "quadro" | "osservatorio" | "locali" | "audit";

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

export function OsservatorioPanel({
  scenario,
  baselineScenario,
  liveS,
  onRestoreBaselineS,
  onOpenTab: _onOpenTab,
}: {
  scenario: ScenarioResult;
  baselineScenario: ScenarioResult;
  liveS: number;
  onRestoreBaselineS: () => void;
  onOpenTab: (tab: DashboardTab) => void;
}) {
  void _onOpenTab;
  const [fabbisogni, setFabbisogni] = useState<FabbisogniCatalogFile | null>(
    null,
  );
  const [cloud, setCloud] = useState<OsservatorioCloudPayload>(emptyCloud());
  const [mainTerritory, setMainTerritory] = useState<TerritoryScope>(
    TERRITORY_NAZIONALE,
  );
  const [regione, setRegione] = useState<Region>("Lazio");
  const [activeTrendId, setActiveTrendId] = useState<string | null>(null);
  const [trendsNote, setTrendsNote] = useState("");
  const [dataDrawerOpen, setDataDrawerOpen] = useState(false);
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
        updatedBy: "interno@fn",
        source: "db",
      });
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

  return (
    <>
      <OsservatorioOnePageDossier
        scenario={scenario}
        baselineScenario={baselineScenario}
        liveS={liveS}
        onRestoreBaselineS={onRestoreBaselineS}
        mainTerritory={mainTerritory}
        setMainTerritory={setMainTerritory}
        regione={regione}
        setRegione={setRegione}
        fabbisogni={fabbisogni}
        fabRegione={fabRegione}
        events={events}
        activeTrendSeries={activeTrendSeries}
        prioritaRegione={prioritaRegione}
        monthlyNote={monthlyNote}
        setMonthlyNote={setMonthlyNote}
        dataDrawerOpen={dataDrawerOpen}
        setDataDrawerOpen={setDataDrawerOpen}
        cloud={cloud}
        dbConnected={dbConnected}
        cloudMeta={cloudMeta}
        onSaveCloud={() => void saveToCloudDb()}
        onExportPdf={() => exportOsservatorioPdf()}
        onPrioritaCsv={onPrioritaCsv}
        onTrendsCsv={onTrendsCsv}
        onLoadDemoTrends={loadDemoTrends}
        onAddEvent={addDraftEvent}
        onSavePriorita={savePrioritaManuale}
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
    </>
  );
}
