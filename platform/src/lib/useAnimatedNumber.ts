"use client";

import { useEffect, useRef, useState } from "react";

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Smooth numeric transition for live KPIs (requestAnimationFrame, easeOutQuart). */
export function useAnimatedNumber(targetValue: number, duration = 420): number {
  const [display, setDisplay] = useState(targetValue);
  const fromRef = useRef(targetValue);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!Number.isFinite(targetValue)) return;
    if (Math.abs(targetValue - fromRef.current) < 1e-9) {
      setDisplay(targetValue);
      return;
    }

    const from = fromRef.current;
    startRef.current = null;

    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutQuart(t);
      setDisplay(from + (targetValue - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = targetValue;
        setDisplay(targetValue);
      }
    };

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [targetValue, duration]);

  useEffect(() => {
    fromRef.current = display;
  }, [display]);

  return display;
}
