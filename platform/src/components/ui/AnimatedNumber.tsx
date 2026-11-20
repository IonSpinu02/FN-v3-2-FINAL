"use client";

import { useAnimatedNumber } from "@/lib/useAnimatedNumber";

type AnimatedNumberProps = {
  value: number;
  /** Cifre decimali (default 2). */
  decimals?: number;
  /** Prefisso / suffisso (es. `%`, ` pp`). */
  suffix?: string;
  prefix?: string;
  /** Usa virgola italiana. */
  it?: boolean;
  className?: string;
  durationMs?: number;
  signed?: boolean;
};

export function AnimatedNumber({
  value,
  decimals = 2,
  suffix = "",
  prefix = "",
  it = true,
  className = "",
  durationMs = 450,
  signed = false,
}: AnimatedNumberProps) {
  const display = useAnimatedNumber(value, durationMs);
  const sign = signed && display > 0 ? "+" : "";
  const body = it
    ? display.toFixed(decimals).replace(".", ",")
    : display.toFixed(decimals);
  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {sign}
      {body}
      {suffix}
    </span>
  );
}

export function AnimatedInt({
  value,
  className = "",
  durationMs = 450,
  locale = "it-IT",
}: {
  value: number;
  className?: string;
  durationMs?: number;
  locale?: string;
}) {
  const display = useAnimatedNumber(value, durationMs);
  return (
    <span className={`tabular-nums ${className}`}>
      {Math.round(display).toLocaleString(locale)}
    </span>
  );
}
