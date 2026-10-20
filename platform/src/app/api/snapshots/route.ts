import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  clampNSim,
  clampS,
  validateFlussiIpsos,
} from "@/lib/api/scenarioRequest";
import { listRecentAuditLogs } from "@/lib/db/auditLog";
import { isDbConfigured } from "@/lib/db/client";
import {
  ensureOfficialSnapshotSeed,
  frozenSnapshotFromFile,
  insertSnapshot,
  listSnapshots,
  type SnapshotRecord,
} from "@/lib/db/snapshotsRepository";
import { calculate, type CalculateOverrides } from "@/lib/engine/calculate";
import type { SnapshotParams } from "@/lib/engine/snapshotDiff";
import { loadJson } from "@/lib/engine/loadData";
import type { Region } from "@/lib/engine/constants";
import type { EuRegion, FnConfig, ScenarioResult } from "@/lib/engine/types";

function mergeSnapshots(
  dbList: SnapshotRecord[],
  dbConnected: boolean,
): SnapshotRecord[] {
  const fileFrozen = frozenSnapshotFromFile();
  const byHash = new Map<string, SnapshotRecord>();
  for (const s of dbList) byHash.set(s.sha256Hash, s);
  if (!byHash.has(fileFrozen.sha256Hash)) {
    byHash.set(fileFrozen.sha256Hash, fileFrozen);
  }
  return [...byHash.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const actor = session.user.email ?? "unknown";
  if (isDbConfigured()) {
    await ensureOfficialSnapshotSeed(actor);
  }

  const { dbConnected, snapshots: fromDb } = await listSnapshots();
  const auditLogs = dbConnected ? await listRecentAuditLogs(40) : [];

  return Response.json({
    dbConnected: isDbConfigured() && dbConnected,
    snapshots: mergeSnapshots(fromDb, dbConnected),
    auditLogs: auditLogs.map((r) => ({
      id: r.id,
      action: r.action,
      actorEmail: r.actorEmail,
      summary: r.summary,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

type PostBody = {
  name: string;
  notes?: string;
  params: SnapshotParams;
  scenario?: ScenarioResult;
};

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  let body: PostBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return Response.json({ error: "name obbligatorio" }, { status: 400 });
  }
  if (!body.params?.pesi || body.params.S === undefined) {
    return Response.json({ error: "params incompleti" }, { status: 400 });
  }

  const cfg = loadJson<FnConfig>("config_v3_2.json");
  const eu = loadJson<{ D: Record<Region, EuRegion> }>("eu2024.json").D;

  const overrides: CalculateOverrides = {
    S: clampS(body.params.S),
    pesi: body.params.pesi,
  };
  if (body.params.flussi_ipsos) {
    validateFlussiIpsos(body.params.flussi_ipsos);
    overrides.flussi_ipsos = body.params.flussi_ipsos;
  }
  if (body.params.istituzioniDelta) {
    overrides.istituzioniDelta =
      body.params.istituzioniDelta as CalculateOverrides["istituzioniDelta"];
  }
  const nSim = clampNSim(20000, cfg.monte_carlo.simulazioni);
  const scenarioData = calculate(cfg, eu, nSim, overrides);

  const actor = session.user.email ?? "unknown";

  if (!isDbConfigured()) {
    return Response.json({
      dbConnected: false,
      snapshot: null,
      scenario: scenarioData,
      message: "DB non configurato — salvare lato client (localStorage)",
    });
  }

  const saved = await insertSnapshot({
    name: body.name.trim(),
    notes: body.notes,
    params: body.params,
    scenarioData,
    createdBy: actor,
  });

  if (!saved) {
    return Response.json({
      dbConnected: false,
      snapshot: null,
      scenario: scenarioData,
      message: "Salvataggio DB fallito — usare fallback locale",
    });
  }

  return Response.json({
    dbConnected: true,
    snapshot: saved,
    scenario: scenarioData,
  });
}
