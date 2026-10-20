import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { loadLocaliFromDb, saveLocaliToDb } from "@/lib/db/localiRepository";
import { isDbConfigured } from "@/lib/db/client";
import { loadJson } from "@/lib/engine/loadData";
import type {
  LocalApprovedEvent,
  LocaliEventsFile,
  LocaliRegistryFile,
  LocalRegistryEntry,
} from "@/lib/engine/localiTypes";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const fileRegistry = loadJson<LocaliRegistryFile>("locali_registry.json");
  const fileEvents = loadJson<LocaliEventsFile>("locali_events.json");

  const fromDb = await loadLocaliFromDb();
  if (fromDb) {
    return Response.json({
      registry: { version: 1 as const, entries: fromDb.registry },
      events: { version: 1 as const, events: fromDb.events },
      source: fromDb.source === "db" ? "db" : "seed",
      updatedAt: fromDb.updatedAt,
      updatedBy: fromDb.updatedBy,
      dbConnected: true,
    });
  }

  return Response.json({
    registry: fileRegistry,
    events: fileEvents,
    source: "file",
    updatedAt: null,
    updatedBy: null,
    dbConnected: isDbConfigured(),
  });
}

async function saveRegistry(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: {
    entries?: LocalRegistryEntry[];
    registry?: LocalRegistryEntry[];
    events?: LocalApprovedEvent[];
    summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  const entries = body.entries ?? body.registry;
  if (!Array.isArray(entries)) {
    return Response.json({ error: "entries obbligatorio" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  if (!isDbConfigured()) {
    return Response.json({
      ok: false,
      dbConnected: false,
      error: "DATABASE_URL non configurato — usa export JSON / localStorage",
    });
  }

  const actor = session.user.email ?? "unknown";
  const saved = await saveLocaliToDb(
    entries,
    events,
    actor,
    body.summary,
  );
  if (!saved) {
    return Response.json({
      ok: false,
      dbConnected: false,
      error: "Salvataggio fallito (eseguire npm run db:push?)",
    });
  }

  return Response.json({ ok: true, dbConnected: true });
}

export async function PUT(req: Request) {
  return saveRegistry(req);
}

export async function POST(req: Request) {
  return saveRegistry(req);
}
