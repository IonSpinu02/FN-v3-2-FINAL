import {
  requireSession,
  unauthorizedResponse,
} from "@/lib/api/requireSession";
import {
  fetchArticleReadableText,
  isPublicHttpUrl,
} from "@/lib/engine/fetchArticleReader";

export const maxDuration = 30;

export async function GET(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url")?.trim() ?? "";
  if (!url || !isPublicHttpUrl(url)) {
    return Response.json({ error: "URL non valido" }, { status: 400 });
  }

  try {
    const data = await fetchArticleReadableText(url);
    if (!data.body) {
      return Response.json(
        { error: "Contenuto non estraibile", sourceUrl: url },
        { status: 422 },
      );
    }
    return Response.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch fallito";
    return Response.json({ error: msg, sourceUrl: url }, { status: 502 });
  }
}
