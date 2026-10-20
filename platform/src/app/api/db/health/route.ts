import { isDatabaseConfigured, getSql } from "@/lib/db/neon";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return Response.json({
      ok: false,
      configured: false,
      message: "DATABASE_URL non impostato",
    });
  }
  try {
    const sql = getSql();
    await sql`SELECT 1 AS ok`;
    return Response.json({ ok: true, configured: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore connessione";
    return Response.json(
      { ok: false, configured: true, message },
      { status: 503 },
    );
  }
}
