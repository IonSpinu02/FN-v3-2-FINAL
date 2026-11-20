import { sha256Hex } from "@/lib/engine/sha256Canonical";
import type { PublishedDomain } from "@/lib/db/publishedStateRepository";
import type { PublishedStateLight } from "@/lib/db/publishedStateRepository";

export type RealtimeDomainPayload = {
  version: number;
  computationId: string | null;
  updatedAt: string;
};

export type RealtimeVersionPayload = {
  domains: Record<PublishedDomain, RealtimeDomainPayload>;
  compositeEtag: string;
};

export function buildRealtimeCompositeEtag(rows: PublishedStateLight[]): string {
  const canonical = [...rows]
    .sort((a, b) => a.domain.localeCompare(b.domain))
    .map(
      (r) =>
        `${r.domain}|${r.version}|${r.computationId ?? ""}|${r.updatedAt}`,
    )
    .join(";");
  const digest = sha256Hex(canonical).slice(0, 16);
  return `"fn-rt-${digest}"`;
}

export function buildRealtimeVersionPayload(
  rows: PublishedStateLight[],
): RealtimeVersionPayload {
  const compositeEtag = buildRealtimeCompositeEtag(rows);
  const domains = {} as Record<PublishedDomain, RealtimeDomainPayload>;
  for (const row of rows) {
    domains[row.domain] = {
      version: row.version,
      computationId: row.computationId,
      updatedAt:
        row.updatedAt > 0
          ? new Date(row.updatedAt).toISOString()
          : new Date(0).toISOString(),
    };
  }
  return { domains, compositeEtag };
}

export function domainsWithVersionChange(
  prev: Record<PublishedDomain, number> | null,
  next: Record<PublishedDomain, number>,
): PublishedDomain[] {
  const changed: PublishedDomain[] = [];
  const keys = Object.keys(next) as PublishedDomain[];
  for (const k of keys) {
    const n = next[k] ?? 0;
    const p = prev?.[k] ?? 0;
    if (n !== p) changed.push(k);
  }
  return changed;
}