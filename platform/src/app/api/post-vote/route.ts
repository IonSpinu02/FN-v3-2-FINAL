import { requireSession, unauthorizedResponse } from "@/lib/api/requireSession";
import { evaluatePostVoteWithPoll } from "@/lib/engine/historyAndEval";
import { DEFAULT_POLL_CONFIG } from "@/lib/engine/regionalPollShared";
import type { ScenarioResult } from "@/lib/engine/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: { snapshot?: ScenarioResult; csvContent?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  if (!body.snapshot || typeof body.csvContent !== "string") {
    return Response.json(
      { error: "snapshot e csvContent obbligatori" },
      { status: 400 },
    );
  }

  try {
    const result = evaluatePostVoteWithPoll(
      body.snapshot,
      body.csvContent,
      DEFAULT_POLL_CONFIG,
    );
    return Response.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore valutazione";
    return Response.json({ error: message }, { status: 400 });
  }
}
