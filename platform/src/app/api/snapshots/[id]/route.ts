import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import { isDbConfigured } from "@/lib/db/client";
import { deleteSnapshot } from "@/lib/db/snapshotsRepository";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { id } = await ctx.params;
  if (id.startsWith("file-")) {
    return Response.json(
      { ok: false, error: "Snapshot file di seed non eliminabile" },
      { status: 400 },
    );
  }

  if (!isDbConfigured()) {
    return Response.json({
      ok: false,
      dbConnected: false,
      error: "DB non configurato",
    });
  }

  const actor = session.user.email ?? "unknown";
  const result = await deleteSnapshot(id, actor);
  if (!result.ok) {
    return Response.json(
      { ok: false, dbConnected: true, error: result.error },
      { status: result.error?.includes("baseline") ? 403 : 404 },
    );
  }

  return Response.json({ ok: true, dbConnected: true });
}
