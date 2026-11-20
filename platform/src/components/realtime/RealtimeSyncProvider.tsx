"use client";

import type { PublishedDomain } from "@/lib/db/publishedStateRepository";
import {
  domainsWithVersionChange,
  type RealtimeVersionPayload,
} from "@/lib/realtime/versionEtag";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

const POLL_MS = 15_000;

type DomainListener = () => void;

type RealtimeSyncContextValue = {
  subscribe: (domain: PublishedDomain, listener: DomainListener) => () => void;
  requestDomainRefresh: (domain: PublishedDomain) => Promise<void>;
  getDomainVersion: (domain: PublishedDomain) => number;
};

export const RealtimeSyncContext = createContext<RealtimeSyncContextValue | null>(
  null,
);

function emptyVersions(): Record<PublishedDomain, number> {
  return { consenso: 0, news: 0, supervision: 0, locali: 0 };
}

export function RealtimeSyncProvider({ children }: { children: ReactNode }) {
  const etagRef = useRef<string | null>(null);
  const versionsRef = useRef<Record<PublishedDomain, number>>(emptyVersions());
  const inflightRef = useRef<Promise<void> | null>(null);
  const pausedRef = useRef(false);
  const listenersRef = useRef(
    new Map<PublishedDomain, Set<DomainListener>>(),
  );

  const emitDomain = useCallback((domain: PublishedDomain) => {
    const set = listenersRef.current.get(domain);
    if (!set) return;
    for (const fn of set) fn();
  }, []);

  const applyPayload = useCallback(
    (payload: RealtimeVersionPayload) => {
      const next = emptyVersions();
      for (const key of Object.keys(payload.domains) as PublishedDomain[]) {
        next[key] = payload.domains[key]?.version ?? 0;
      }
      const changed = domainsWithVersionChange(versionsRef.current, next);
      versionsRef.current = next;
      etagRef.current = payload.compositeEtag;
      for (const domain of changed) emitDomain(domain);
    },
    [emitDomain],
  );

  const poll = useCallback(async (immediate = false) => {
    if (pausedRef.current && !immediate) return;
    if (inflightRef.current) {
      await inflightRef.current;
      if (!immediate) return;
    }

    const task = (async () => {
      const headers: HeadersInit = {};
      if (etagRef.current) headers["If-None-Match"] = etagRef.current;
      try {
        const res = await fetch("/api/realtime/version", {
          cache: "no-store",
          headers,
        });
        if (res.status === 304) return;
        if (!res.ok) return;
        const headerEtag = res.headers.get("etag");
        const body = (await res.json()) as RealtimeVersionPayload;
        if (headerEtag) body.compositeEtag = headerEtag;
        applyPayload(body);
      } catch {
        /* rete / provider opzionale */
      } finally {
        inflightRef.current = null;
      }
    })();

    inflightRef.current = task;
    await task;
  }, [applyPayload]);

  const requestDomainRefresh = useCallback(
    async (domain: PublishedDomain) => {
      await poll(true);
      emitDomain(domain);
    },
    [poll, emitDomain],
  );

  const subscribe = useCallback(
    (domain: PublishedDomain, listener: DomainListener) => {
      let set = listenersRef.current.get(domain);
      if (!set) {
        set = new Set();
        listenersRef.current.set(domain, set);
      }
      set.add(listener);
      return () => {
        set!.delete(listener);
      };
    },
    [],
  );

  const getDomainVersion = useCallback((domain: PublishedDomain) => {
    return versionsRef.current[domain] ?? 0;
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) clearInterval(interval);
      void poll(true);
      interval = setInterval(() => void poll(), POLL_MS);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    pausedRef.current =
      typeof document !== "undefined" &&
      document.visibilityState === "hidden";
    if (!pausedRef.current) startPolling();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        pausedRef.current = true;
        stopPolling();
        return;
      }
      pausedRef.current = false;
      startPolling();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  const value = useMemo(
    () => ({ subscribe, requestDomainRefresh, getDomainVersion }),
    [subscribe, requestDomainRefresh, getDomainVersion],
  );

  return (
    <RealtimeSyncContext.Provider value={value}>
      {children}
    </RealtimeSyncContext.Provider>
  );
}

export function useRealtimeSync() {
  const ctx = useContext(RealtimeSyncContext);
  if (!ctx) {
    throw new Error("useRealtimeSync richiede RealtimeSyncProvider");
  }
  return ctx;
}

/** Invalida il callback quando la versione pubblicata del dominio cambia (polling coordinato). */
export function useRealtimeDomain(
  domain: PublishedDomain,
  onInvalidate: () => void,
) {
  const { subscribe, requestDomainRefresh } = useRealtimeSync();

  useEffect(() => subscribe(domain, onInvalidate), [domain, onInvalidate, subscribe]);

  return useMemo(
    () => ({ requestDomainRefresh: () => requestDomainRefresh(domain) }),
    [domain, requestDomainRefresh],
  );
}