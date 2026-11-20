"use client";

import { useMemo } from "react";
import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { RegionPollResult } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";
import type { HorizonDays } from "@/lib/engine/strategicBackcastEngine";
import { buildStrategicCommandBrief } from "@/lib/engine/strategicCommandBrief";
import { buildOperationalRoadmap } from "@/lib/engine/operationalRoadmapBuilder";
import { runObiettivoStrategicBackcast } from "@/lib/strategy/strategicObiettivoContext";

export function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

export function useStrategicPlan(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  target: number,
  horizon: HorizonDays,
  poll: readonly RegionPollResult[] = [],
) {
  const bundle = useMemo(
    () => runObiettivoStrategicBackcast(scenario, flussiIpsos, poll, target, horizon),
    [scenario, flussiIpsos, poll, target, horizon],
  );
  const { pack, forecast: v4, floor, safeTarget, ballots, plan: result } = bundle;
  const brief = useMemo(() => buildStrategicCommandBrief(result, ballots), [result, ballots]);
  const roadmap = useMemo(() => buildOperationalRoadmap(result, horizon), [result, horizon]);
  const sigmaDailyPp = v4.diagnostics.sigmaDailyPp;
  return { floor, safeTarget, ballots, result, brief, roadmap, pack, sigmaDailyPp };
}
