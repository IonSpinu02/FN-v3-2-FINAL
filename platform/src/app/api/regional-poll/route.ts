import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  computeRegionalPoll,
  DEFAULT_POLL_CONFIG,
  type RegionalPollConfig,
} from "@/lib/engine/regionalPoll";
import type { ScenarioResult } from "@/lib/engine/types";

export const instant = false;

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) {
    return unauthorizedResponse();
  }

  try {
    const body = (await req.json()) as {
      scenario: ScenarioResult;
      config?: Partial<RegionalPollConfig>;
    };
    if (!body.scenario?.righe?.length) {
      return Response.json({ error: "Scenario non valido" }, { status: 400 });
    }
    const config: RegionalPollConfig = {
      ...DEFAULT_POLL_CONFIG,
      ...body.config,
    };
    const poll = computeRegionalPoll(body.scenario, config);
    return Response.json({ poll, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore sondaggio regionale";
    return Response.json({ error: msg }, { status: 400 });
  }
}
