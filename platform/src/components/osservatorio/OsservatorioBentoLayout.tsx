"use client";

import { OsservatorioCockpit } from "@/components/osservatorio/OsservatorioCockpit";
import { OsservatorioDataDrawer } from "@/components/osservatorio/OsservatorioDataDrawer";
import { OsservatorioMethodologyDrawer } from "@/components/osservatorio/OsservatorioMethodologyDrawer";
import type { Region } from "@/lib/engine/constants";
import type {
  FabbisogniRegione,
  GoogleTrendsSeries,
} from "@/lib/engine/osservatorioTypes";
import type { TerritoryScope } from "@/lib/engine/osservatorioTerritoryScope";
import type { ScenarioResult } from "@/lib/engine/types";
import type { TerritoryIssue, TerritoryIssueCategory } from "@/lib/engine/territoryIssuesTypes";
import type { RegionalGrowthForecast } from "@/lib/politicalModel";
import { useState } from "react";

export function OsservatorioBentoLayout({
  scenario,
  liveS,
  mainTerritory,
  setMainTerritory,
  regione,
  setRegione,
  regionalGrowthByRegion: _regionalGrowthByRegion,
  fabRegione: _fabRegione,
  activeTrendSeries: _activeTrendSeries,
  eventCount,
  dbConnected,
  onRegisterIssueEvent,
  onExportPdf,
  onPrioritaCsv,
  onTrendsCsv,
  onLoadDemoTrends,
  onAddEvent,
  onSavePriorita,
  onSaveCloud,
  focusCategory = null,
}: {
  scenario: ScenarioResult;
  liveS: number;
  mainTerritory: TerritoryScope;
  setMainTerritory: (t: TerritoryScope) => void;
  regione: Region;
  setRegione: (r: Region) => void;
  regionalGrowthByRegion: Record<string, RegionalGrowthForecast>;
  fabRegione: FabbisogniRegione | undefined;
  activeTrendSeries: GoogleTrendsSeries;
  eventCount: number;
  dbConnected: boolean;
  onRegisterIssueEvent: (issue: TerritoryIssue) => void;
  onExportPdf: () => void;
  onPrioritaCsv: (text: string) => void;
  onTrendsCsv: (text: string) => void;
  onLoadDemoTrends: () => void;
  onAddEvent: () => void;
  onSavePriorita: () => void;
  onSaveCloud: () => void;
  focusCategory?: TerritoryIssueCategory | null;
}) {
  void _regionalGrowthByRegion;
  void _fabRegione;
  void _activeTrendSeries;
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);

  return (
    <>
      <OsservatorioCockpit
        scenario={scenario}
        liveS={liveS}
        regione={regione}
        setRegione={setRegione}
        mainTerritory={mainTerritory}
        setMainTerritory={setMainTerritory}
        onRegisterIssueEvent={onRegisterIssueEvent}
        onOpenMethodology={() => setMethodologyOpen(true)}
        onOpenData={() => setDataOpen(true)}
        onExportPdf={onExportPdf}
        focusCategory={focusCategory}
      />

      <OsservatorioMethodologyDrawer
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        regione={regione}
      />
      <OsservatorioDataDrawer
        open={dataOpen}
        onClose={() => setDataOpen(false)}
        regione={regione}
        eventCount={eventCount}
        dbConnected={dbConnected}
        onPrioritaCsv={onPrioritaCsv}
        onTrendsCsv={onTrendsCsv}
        onLoadDemoTrends={onLoadDemoTrends}
        onAddEvent={onAddEvent}
        onSavePriorita={onSavePriorita}
        onSaveCloud={onSaveCloud}
      />
    </>
  );
}
