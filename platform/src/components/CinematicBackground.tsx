"use client";

/** Sfondo scenografico Awwwards-style: mesh animata + griglia (solo CSS, rispetta reduced-motion). */
export function CinematicBackground() {
  return (
    <div className="fn-cinematic-bg" aria-hidden>
      <div className="fn-orb fn-orb-a" />
      <div className="fn-orb fn-orb-b" />
      <div className="fn-orb fn-orb-c" />
      <div className="fn-grid-overlay" />
      <div className="fn-vignette" />
    </div>
  );
}
