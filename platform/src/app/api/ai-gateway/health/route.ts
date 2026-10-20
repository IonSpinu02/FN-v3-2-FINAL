import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key || key.trim().length === 0) {
    return Response.json({
      configured: false,
      ok: false,
      message: "AI_GATEWAY_API_KEY non impostata",
    });
  }

  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return Response.json({
        configured: true,
        ok: false,
        message: `Gateway risposta HTTP ${res.status}`,
      });
    }
    const data = (await res.json()) as { data?: unknown[] };
    const count = Array.isArray(data.data) ? data.data.length : 0;
    return Response.json({
      configured: true,
      ok: true,
      modelsListed: count,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore rete";
    return Response.json({
      configured: true,
      ok: false,
      message,
    });
  }
}
