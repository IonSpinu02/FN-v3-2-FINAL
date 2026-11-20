# Design System Master File — Futuro Nazionale v3.2

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Futuro Nazionale  
**Updated:** 2026-11-05  
**Category:** Analytics / Operational Intelligence Dashboard  
**Design Dials:** Motion 8/10 (Complex) | Density 7/10 (Standard)

---

## Dual-Theme System

Il prodotto espone un selettore **Light / Dark** (`ThemeProvider`, chiave `localStorage`: `fn-ui-theme-v1`) che sincronizza la classe `dark` | `light` su `<html>`.

| Mode | Token `--bg` | Ruolo |
|------|--------------|--------|
| **Dark · Tattico** (default) | `#04070d` | Cockpit operativo, superfici vetro scure, accenti smeraldo `#34d399` e ciano `#22d3ee` |
| **Light · Istituzionale** | `#F1F5F9` | Lettura Bloomberg / Financial Times: superfici bianche, bordi `#cbd5e1`, testo `#0f172a` |

### Dark Tactical (`:root`, `html.dark`)

| Role | Hex / value | CSS Variable |
|------|-------------|--------------|
| Background | `#04070d` | `--bg`, `--fn-bg` |
| Surface (glass) | `rgb(15 23 42 / 72%)` | `--surface`, `--fn-surface` |
| Surface strong | `rgb(11 16 27 / 0.92)` | `--surface-strong` |
| Border | `rgb(148 163 184 / 22%)` | `--border`, `--fn-border` |
| Text | `#f1f5f9` | `--text`, `--fn-text` |
| Muted | `#94a3b8` | `--muted`, `--fn-text-muted` |
| Accent emerald | `#34d399` | `--accent-emerald` |
| Accent cyan | `#22d3ee` | `--accent-cyan` |
| Accent CTA | `#22c55e` | `--fn-accent` |

### Light Institutional (`html.light`)

| Role | Hex / value | CSS Variable |
|------|-------------|--------------|
| Background | `#F1F5F9` | `--bg`, `--fn-bg` |
| Surface | `rgba(255, 255, 255, 0.94)` | `--surface`, `--fn-surface` |
| Surface strong | `#ffffff` | `--surface-strong`, `--fn-surface-elevated` |
| Border | `#cbd5e1` | `--border`, `--fn-border` |
| Text | `#0f172a` | `--text`, `--fn-text` |
| Muted | `#475569` | `--muted`, `--fn-text-muted` |
| Accent emerald (AAA) | `#047857` | `--accent-emerald`, `--fn-accent` |
| Accent cyan (AAA) | `#0369a1` | `--accent-cyan` |
| Soft multi-level shadow | `0 1px 2px / 0 8px 24px / 0 2px 10px -3px` slate | `--fn-shadow` |

**Zero-rewrite:** in `src/app/globals.css`, il blocco `html.light` rimappa le utility Tailwind hard-coded dark (`.bg-zinc-950*`, `.text-white`, `.border-white/*`, accenti `emerald/cyan/amber/rose/violet`) verso token istituzionali con contrasto WCAG AAA, senza riscrivere i 60+ componenti.

**UI control:** `<ThemeToggleButton />` in topbar (`StageTopHud`) — label `Dark · Tattico` / `Light · Istituzionale`.

---

## Typography (font reali del progetto)

Caricati via `next/font/google` in `src/app/layout.tsx`:

| Role | Family | CSS variable | Tailwind / usage |
|------|--------|--------------|------------------|
| Body / UI | **Inter** | `--font-inter` | `--font-sans`, `font-sans` |
| Display / headings | **Plus Jakarta Sans** | `--font-heading` | `--font-display`, heading chrome |
| Mono / telemetry | **JetBrains Mono** | `--font-mono` | `--font-mono`, KPI, ticker, map badges |
| Editorial accent (landing) | DM Serif Display | `--font-dm-serif-display` | showcase only |

**Mood:** institutional, tactical, precise — no Fira / Inter-as-default-stack storytelling; i font di produzione sono Inter + Plus Jakarta Sans + JetBrains Mono.

---

## Spacing Variables

*Density: 7/10 — Standard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Dark | Light |
|-------|------|-------|
| Surface | hairline + deep drop | soft multi-level slate |
| `--fn-shadow` | `0 0 0 1px rgb(255 255 255 / 6%), 0 24px 48px rgb(0 0 0 / 45%)` | `0 1px 2px / 0 8px 24px / 0 2px 10px -3px` slate |

---

## Component Specs

### Theme toggle

- Pill control, Lucide `Sun` / `Moon`
- Persistenza `fn-ui-theme-v1`
- Default SSR-safe: `dark` su `<html className="dark" suppressHydrationWarning>`

### Navigation (shell)

1. `01 · Scenario` — mappa tattica  
2. `02 · Osservatorio`  
3. `03 · Rassegna stampa`  
4. `04 · Audit & Post-Voto` — Snapshot SHA-256 · Calibrazione  

### Daily Order Bar

Barra operativa sopra la mappa: 3 regioni prioritarie, tema/azione B.I.P., cautela tattica (`DailyOrderBar` + `buildDailyOrder`).

### Map (Italy SVG)

- Dark: oceano `#0b1220 → #1e293b`, stroke idle `#060A12`  
- Light: oceano `#f8fafc → #eef2f6 → #e2e8f0`, stroke idle `#94a3b8`, glow `#047857`  
- Semaforo Verde/Giallo/Rosso e scala d’intensità invariati

---

## Style Guidelines

**Style:** Tactical Institutional Dashboard  

**Keywords:** dual-theme, glass / paper surfaces, regional map HUD, KPI mono, operational priority bar, SHA-256 audit

**Best For:** Internal campaign intelligence, scenario territorial modeling, post-vote calibration

### Motion

- Page / tab fade ~300ms (`framer-motion`), respect `prefers-reduced-motion`
- Map opacity / selection ~180ms
- Live ticker continuous; pause under reduced motion via CSS

---

## Anti-Patterns (Do NOT Use)

- ❌ Riscrivere a mano le classi di tutti i componenti per il light mode (usare rimappatura `html.light`)
- ❌ Toccare formule in `calculate.ts` / `pythonDistributions.ts`
- ❌ Alterare `requireSession.ts` / chiudere l’accesso aperto
- ❌ Emoji come icone — Lucide / SVG
- ❌ Testo low-contrast in light (target AAA sui token rimappati)
- ❌ Overlay WIP su Audit (sezione operativa sbloccata)

---

## Pre-Delivery Checklist

- [ ] Theme toggle persiste e sincronizza `<html>.dark|light`
- [ ] Light remapping: contrasto AAA su testi e accenti
- [ ] ItalyMap confini leggibili in light
- [ ] Nav 04 Audit raggiungibile (`/app/audit`, no redirect)
- [ ] DailyOrderBar montata sulla vista mappa
- [ ] `npm run test` e `npm run build` verdi
- [ ] Font: Inter / Plus Jakarta Sans / JetBrains Mono
