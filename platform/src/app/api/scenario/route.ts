import {
  unauthorizedResponse,
  requireSession,
} from "@/lib/api/requireSession";
import {
  clampNSim,
  clampS,
  validateFlussiIpsos,
  type ScenarioPostBody,
} from "@/lib/api/scenarioRequest";
import { calculate, type CalculateOverrides } from "@/lib/engine/calculate";
import { loadJson } from "@/lib/engine/loadData";
import {
  computeRegionalPoll,
  DEFAULT_POLL_CONFIG,
  type RegionalPollConfig,
} from "@/lib/engine/regionalPoll";
import type { Region } from "@/lib/engine/constants";
import type { EuRegion, FnConfig } from "@/lib/engine/types";

export const instant = false;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await req.json()) as ScenarioPostBody;
    const cfg = loadJson<FnConfig>("config_v3_2.json");
    const eu = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json").D;

    const overrides: CalculateOverrides = {};
    if (body.S !== undefined) {
      overrides.S = clampS(body.S);
    }
    if (body.pesi !== undefined) {
      overrides.pesi = body.pesi;
    }
    if (body.flussi_ipsos !== undefined) {
      validateFlussiIpsos(body.flussi_ipsos);
      overrides.flussi_ipsos = body.flussi_ipsos;
    }
    if (body.istituzioniDelta !== undefined) {
      overrides.istituzioniDelta = body.istituzioniDelta;
    }

    const rawNSim = body.nSim ?? cfg.monte_carlo.simulazioni;
    const nSim = clampNSim(rawNSim, cfg.monte_carlo.simulazioni);

    const result = calculate(cfg, eu, nSim, overrides);

    if (body.includePoll) {
      const pollConfig: RegionalPollConfig = {
        ...DEFAULT_POLL_CONFIG,
        ...(body.pollConfig as Partial<RegionalPollConfig> | undefined),
      };
      const poll = computeRegionalPoll(result, pollConfig);
      return Response.json({ scenario: result, poll, pollConfig });
    }

    return Response.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore calcolo";
    return Response.json({ error: msg }, { status: 400 });
  }
}
