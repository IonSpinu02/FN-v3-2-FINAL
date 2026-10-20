import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { loadLocaliFromDb, saveLocaliToDb } from "@/lib/db/localiRepository";
import { isDatabaseConfigured } from "@/lib/db/neon";
import { loadJson } from "@/lib/engine/loadData";
import type {
  LocalApprovedEvent,
  LocaliEventsFile,
  LocaliRegistryFile,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";

export const instant = false;

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const fileRegistry = loadJson<LocaliRegistryFile>("locali_registry.json");
  const fileEvents = loadJson<LocaliEventsFile>("locali_events.json");

  const fromDb = await loadLocaliFromDb();
  const registry =
    fromDb && fromDb.registry.length > 0
      ? { version: 1 as const, entries: fromDb.registry }
      : fileRegistry;
  const events =
    fromDb && fromDb.events.length > 0
      ? { version: 1 as const, events: fromDb.events }
      : fileEvents;

  return Response.json({
    registry,
    events,
    persistence: {
      database: isDatabaseConfigured(),
      source: fromDb && fromDb.registry.length > 0 ? "neon" : "file",
      updatedAt: fromDb?.updatedAt ?? null,
    },
  });
}

export async function PUT(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "DATABASE_URL non configurato su questo deploy" },
      { status: 503 },
    );
  }

  let body: {
    entries?: LocalRegistryEntry[];
    events?: LocalApprovedEvent[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  const entries = body.entries;
  if (!Array.isArray(entries)) {
    return Response.json({ error: "entries obbligatorio" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  const saved = await saveLocaliToDb(entries, events);
  if (!saved) {
    return Response.json(
      { error: "Salvataggio fallito (tabella fn_locali_state presente?)" },
      { status: 503 },
    );
  }

  return Response.json({ ok: true });
}
