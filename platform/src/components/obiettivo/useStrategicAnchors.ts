"use client";

import { useMemo } from "react";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { ForecastV4Result } from "@/lib/engine/forecastEngineV4";
import { NATIONAL_VALID_BALLOTS } from "@/lib/engine/strategicCommandBrief";
import type { HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import { roundTenth } from "@/components/obiettivo/useStrategicPlan";
import { buildBackcastRegions } from "@/lib/engine/buildBackcastRegions";
import { buildStrategicV4Forecast } from "@/lib/strategy/strategicObiettivoContext";

export type V4Band = { passive: number; offensive: number };

function horizonKey(days: HorizonDays): "d30" | "d90" | "d180" {
  if (days <= 30) return "d30";
  if (days <= 90) return "d90";
  return "d180";
}

/** Banda passivo–offensiva V4 per l'orizzonte scelto. A 360g estende linearmente l'ancora a 180g. */
export function v4BandForHorizon(v4: ForecastV4Result, horizonDays: HorizonDays): V4Band {
  const key = horizonKey(horizonDays);
  const passive = v4.scenarios.passivo.horizons.find((row) => row.key === key)?.centralPct ?? v4.startPct;
  const offensive = v4.scenarios.offensiva.horizons.find((row) => row.key === key)?.centralPct ?? v4.startPct;
  if (horizonDays !== 360) return { passive, offensive };
  const scale = 360 / 180;
  return {
    passive: v4.startPct + (passive - v4.startPct) * scale,
    offensive: v4.startPct + (offensive - v4.startPct) * scale,
  };
}

/** Ancoraggi leggeri per la scheda d'ingresso: baseline V4 allineata a Scenario / Consenso nazionale. */
export function useStrategicAnchors(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  poll: readonly RegionPollResult[] = [],
) {
  const pack = useMemo(() => buildBackcastRegions(scenario, poll), [scenario, poll]);
  const v4 = useMemo(
    () => buildStrategicV4Forecast(scenario, flussiIpsos, poll),
    [scenario, flussiIpsos, poll],
  );
  const floor = roundTenth(v4.startPct);
  const ballots = scenario.parametri.validi2024 || NATIONAL_VALID_BALLOTS;
  const band180 = v4BandForHorizon(v4, 180);
  return {
    floor,
    ballots,
    pack,
    v4,
    currentPct: v4.startPct,
    v4Passive: band180.passive,
    v4Offensive: band180.offensive,
    bandFor: (horizonDays: HorizonDays) => v4BandForHorizon(v4, horizonDays),
  };
}
