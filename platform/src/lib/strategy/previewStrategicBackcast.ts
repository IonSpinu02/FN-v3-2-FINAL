import type { FlussiIpsos } from "@/lib/engine/defaults";
import type { Region } from "@/lib/engine/constants";
import type { HorizonDays, StrategicBackcastResult } from "@/lib/engine/strategicBackcastEngine";
import type { ScenarioResult } from "@/lib/engine/types";
import { runObiettivoStrategicBackcast } from "@/lib/strategy/strategicObiettivoContext";

/** Preview sincrona del backcast (<5ms tipici) per animare il cinema durante l'attesa AI. */
export function previewStrategicBackcast(
  scenario: ScenarioResult,
  flussiIpsos: FlussiIpsos,
  targetPct: number,
  horizonDays: HorizonDays,
  poll: readonly { regione: Region; piHat: number }[] = [],
): StrategicBackcastResult {
  return runObiettivoStrategicBackcast(scenario, flussiIpsos, poll, targetPct, horizonDays).plan;
}
