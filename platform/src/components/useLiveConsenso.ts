"use client";

import { RealtimeSyncContext } from "@/components/realtime/RealtimeSyncProvider";
import type { LiveConsensoPayload } from "@/lib/engine/pollTypes";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function useLiveConsenso(options?: {
  enabled?: boolean;
  mode?: "auto" | "aggregate" | "supermedia";
  /** @deprecated il polling è gestito da RealtimeSyncProvider */
  pollMs?: number;
  pollVisibleMs?: number;
  pollHiddenMs?: number;
}) {
  const enabled = options?.enabled ?? false;
  const mode = options?.mode ?? "auto";
  const sync = useContext(RealtimeSyncContext);

  const [data, setData] = useState<LiveConsensoPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/consenso/live?mode=${mode}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as LiveConsensoPayload;
      if (controller.signal.aborted) return;
      setData(json);
    } catch (e) {
      if (isAbortError(e) || controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Errore consenso live");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      return;
    }
    queueMicrotask(() => void refresh());
  }, [enabled, mode, refresh]);

  useEffect(() => {
    if (!enabled || !sync) return;
    return sync.subscribe("consenso", () => void refresh());
  }, [enabled, sync, refresh]);

  return { data, loading, error, refresh };
}