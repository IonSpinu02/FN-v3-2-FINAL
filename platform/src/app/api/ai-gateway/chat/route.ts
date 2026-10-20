import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  aiGatewayConfigured,
  defaultGatewayModel,
  generateViaGateway,
} from "@/lib/ai/gateway";

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  if (!aiGatewayConfigured()) {
    return Response.json(
      {
        ok: false,
        configured: false,
        error: "AI_GATEWAY_API_KEY non impostata in .env.local / Vercel",
      },
      { status: 503 },
    );
  }

  let body: { prompt?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON non valido" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "prompt obbligatorio" }, { status: 400 });
  }

  if (prompt.length > 8000) {
    return Response.json({ error: "prompt troppo lungo" }, { status: 400 });
  }

  try {
    const text = await generateViaGateway(prompt, body.model);
    return Response.json({
      ok: true,
      model: body.model ?? defaultGatewayModel(),
      text,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Errore Gateway";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
