import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  loadOsservatorioFromDb,
  saveOsservatorioToDb,
} from "@/lib/db/osservatorioRepository";
import { isDbConfigured } from "@/lib/db/client";
import { loadJson } from "@/lib/engine/loadData";
import type {
  FabbisogniCatalogFile,
  OsservatorioCloudPayload,
  OsservatorioEventsFile,
} from "@/lib/engine/osservatorioTypes";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const fabbisogni = loadJson<FabbisogniCatalogFile>("fabbisogni_catalog.json");
  const fileEvents = loadJson<OsservatorioEventsFile>("osservatorio_events.json");

  const fromDb = await loadOsservatorioFromDb();
  if (fromDb) {
    return Response.json({
      meta: {
        titolo: "Osservatorio integrato",
        periodo: "ottobre 2026 – maggio 2027",
        documento: "Guida metodologica (Osservatorio.docx, 20-10-2026)",
      },
      fabbisogni,
      cloud: fromDb.payload,
      dbConnected: true,
      source: fromDb.source,
      updatedAt: fromDb.updatedAt,
      updatedBy: fromDb.updatedBy,
      consegneMensili: consegne(),
      limiti: limiti(),
    });
  }

  return Response.json({
    meta: {
      titolo: "Osservatorio integrato",
      periodo: "ottobre 2026 – maggio 2027",
      documento: "Guida metodologica (Osservatorio.docx, 20-10-2026)",
    },
    fabbisogni,
    cloud: {
      events: fileEvents.events,
      trendsSeries: [],
      prioritaDichiarate: {},
      monthlyNotes: {},
    } satisfies OsservatorioCloudPayload,
    dbConnected: isDbConfigured(),
    source: "seed",
    updatedAt: null,
    updatedBy: null,
    consegneMensili: consegne(),
    limiti: limiti(),
  });
}

function consegne() {
  return [
    "Quadro sondaggi/scenari e scostamenti con incertezza",
    "Scheda fabbisogni pubblici con fonti e lacune",
    "Nota eventi: cronologia, attenzione, opinioni se disponibili",
  ];
}

function limiti() {
  return [
    "Un sondaggio nazionale non misura da solo le quote regionali",
    "I pesi del modello territoriale sono ipotesi iniziali",
    "L'entropia descrive concentrazione, non entità del consenso",
    "I fabbisogni non identificano preferenze politiche",
    "Google Trends non misura gradimento né voti",
    "Variazione temporale ≠ causalità dell'evento",
  ];
}

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: {
    cloud?: OsservatorioCloudPayload;
    summary?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  if (!body.cloud?.events || !Array.isArray(body.cloud.events)) {
    return Response.json({ error: "cloud.events obbligatorio" }, { status: 400 });
  }

  const actor = session.user.email ?? "unknown";

  if (!isDbConfigured()) {
    return Response.json({
      ok: false,
      dbConnected: false,
      message: "DATABASE_URL assente — stato salvato solo in localStorage",
    });
  }

  const payload: OsservatorioCloudPayload = {
    events: body.cloud.events,
    trendsSeries: body.cloud.trendsSeries ?? [],
    prioritaDichiarate: body.cloud.prioritaDichiarate ?? {},
    monthlyNotes: body.cloud.monthlyNotes ?? {},
  };

  const saved = await saveOsservatorioToDb(payload, actor, body.summary);
  if (!saved) {
    return Response.json({
      ok: false,
      dbConnected: false,
      error: "Salvataggio fallito (npm run db:push?)",
    });
  }

  return Response.json({ ok: true, dbConnected: true });
}
