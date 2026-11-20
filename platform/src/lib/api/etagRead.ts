import type { PublishedStateRow } from "@/lib/db/publishedStateRepository";

export function publishedEtag(state: PublishedStateRow | null, fallback = '"fn-0"'): string {
  return state?.etag ?? fallback;
}

export function ifNoneMatchHit(req: Request, etag: string): boolean {
  const raw = req.headers.get("if-none-match");
  if (!raw) return false;
  return raw.split(",").some((part) => part.trim() === etag);
}

export function notModifiedResponse(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: {
      ETag: etag,
      "Cache-Control": "no-store",
    },
  });
}

export function jsonWithEtag<T>(body: T, etag: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("ETag", etag);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { status: init?.status ?? 200, headers });
}