import { describe, expect, it, vi } from "vitest";
import {
  buildRealtimeCompositeEtag,
  buildRealtimeVersionPayload,
  domainsWithVersionChange,
  type RealtimeVersionPayload,
} from "./versionEtag";
import type { PublishedStateLight } from "@/lib/db/publishedStateRepository";
import { GET } from "@/app/api/realtime/version/route";

vi.mock("@/lib/db/publishedStateRepository", () => ({
  listPublishedStatesLight: vi.fn(),
}));

import { listPublishedStatesLight } from "@/lib/db/publishedStateRepository";

const sampleRows = (): PublishedStateLight[] => [
  {
    domain: "consenso",
    version: 3,
    computationId: "hash-abc",
    updatedAt: 1_700_000_000_000,
  },
  {
    domain: "news",
    version: 10,
    computationId: "news-run",
    updatedAt: 1_700_000_100_000,
  },
  {
    domain: "supervision",
    version: 2,
    computationId: null,
    updatedAt: 0,
  },
  {
    domain: "locali",
    version: 5,
    computationId: "locali-42",
    updatedAt: 1_700_000_200_000,
  },
];

describe("buildRealtimeCompositeEtag", () => {
  it("è deterministico per lo stesso stato", () => {
    const rows = sampleRows();
    expect(buildRealtimeCompositeEtag(rows)).toBe(buildRealtimeCompositeEtag(rows));
  });

  it("cambia quando cambia una versione dominio", () => {
    const a = buildRealtimeCompositeEtag(sampleRows());
    const bumped = sampleRows().map((r) =>
      r.domain === "news" ? { ...r, version: r.version + 1 } : r,
    );
    const b = buildRealtimeCompositeEtag(bumped);
    expect(a).not.toBe(b);
  });
});

describe("domainsWithVersionChange", () => {
  it("rileva solo i domini con versione diversa", () => {
    const prev = { consenso: 3, news: 10, supervision: 2, locali: 5 };
    const next = { consenso: 3, news: 11, supervision: 2, locali: 5 };
    expect(domainsWithVersionChange(prev, next)).toEqual(["news"]);
  });

  it("al primo snapshot segnala i domini con versione > 0", () => {
    const next = { consenso: 1, news: 0, supervision: 0, locali: 0 };
    expect(domainsWithVersionChange(null, next)).toEqual(["consenso"]);
  });
});

describe("GET /api/realtime/version", () => {
  it("restituisce ETag e 304 con If-None-Match", async () => {
    vi.mocked(listPublishedStatesLight).mockResolvedValue(sampleRows());

    const req1 = new Request("http://localhost/api/realtime/version");
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    const etag = res1.headers.get("ETag");
    expect(etag).toBeTruthy();
    const body = (await res1.json()) as RealtimeVersionPayload;
    expect(body.domains.consenso.version).toBe(3);
    expect(body.compositeEtag).toBe(etag);

    const req2 = new Request("http://localhost/api/realtime/version", {
      headers: { "If-None-Match": etag! },
    });
    const res2 = await GET(req2);
    expect(res2.status).toBe(304);
    expect(res2.headers.get("ETag")).toBe(etag);
  });
});

describe("buildRealtimeVersionPayload", () => {
  it("espone payload compatto per dominio", () => {
    const payload = buildRealtimeVersionPayload(sampleRows());
    expect(payload.domains.locali.computationId).toBe("locali-42");
    expect(payload.domains.supervision.version).toBe(2);
  });
});