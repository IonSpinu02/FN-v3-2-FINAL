import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { computeIstituzioniDelta } from "@/lib/engine/localInstitutions";
import { loadJson } from "@/lib/engine/loadData";
import type { LocalRegistryEntry } from "@/lib/engine/localiTypes";
import type { FnConfig } from "@/lib/engine/types";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  try {
    const body = (await req.json()) as { entries: LocalRegistryEntry[] };
    if (!Array.isArray(body.entries)) {
      return Response.json({ error: "entries richiesto" }, { status: 400 });
    }
    const cfg = loadJson<FnConfig>("config_v3_2.json");
    const { istituzioniDelta, summary } = computeIstituzioniDelta(
      cfg,
      body.entries,
    );
    return Response.json({ istituzioniDelta: istituzioniDelta ?? {}, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Errore compute-delta";
    return Response.json({ error: msg }, { status: 400 });
  }
}
