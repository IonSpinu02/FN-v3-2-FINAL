"use client";

import { useEffect, useRef, useState } from "react";

/** Larghezza reale del contenitore: i grafici la usano come viewBox per riempire la scheda a grandezza naturale. */
export function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}
