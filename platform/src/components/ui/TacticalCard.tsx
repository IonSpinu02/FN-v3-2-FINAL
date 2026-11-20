"use client";

import type { CSSProperties, MouseEvent, ReactNode } from "react";

type TacticalCardProps = {
  children: ReactNode;
  className?: string;
  /** Spotlight cursore (CSS vars, zero re-render). */
  spotlight?: boolean;
  brackets?: boolean;
  as?: "div" | "section" | "aside";
};

function onSpotlightMove(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
  el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
}

export function TacticalCard({
  children,
  className = "",
  spotlight = true,
  brackets = true,
  as: Tag = "div",
}: TacticalCardProps) {
  return (
    <Tag
      className={`glass-panel tactical-card group/card relative overflow-hidden ${
        brackets ? "hud-brackets" : ""
      } ${spotlight ? "tactical-spotlight" : ""} ${className}`}
      onMouseMove={spotlight ? onSpotlightMove : undefined}
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "40%",
        } as CSSProperties
      }
    >
      {children}
    </Tag>
  );
}
