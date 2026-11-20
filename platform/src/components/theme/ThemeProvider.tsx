"use client";

import { Moon, Sun } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type FnUiTheme = "dark" | "light";

const STORAGE_KEY = "fn-ui-theme-v1";

type ThemeContextValue = {
  theme: FnUiTheme;
  setTheme: (theme: FnUiTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeClass(theme: FnUiTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.dataset.theme = theme;
}

function readStoredTheme(): FnUiTheme {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    /* ignore */
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<FnUiTheme>("dark");

  useEffect(() => {
    const initial = readStoredTheme();
    setThemeState(initial);
    applyThemeClass(initial);
  }, []);

  const setTheme = useCallback((next: FnUiTheme) => {
    setThemeState(next);
    applyThemeClass(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme deve essere usato dentro <ThemeProvider>");
  }
  return ctx;
}

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "Dark · Tattico" : "Light · Istituzionale"}
      aria-label="Cambia tema"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold transition ${
        isLight
          ? "border-slate-300 bg-white text-slate-800 shadow-sm hover:border-slate-400"
          : "border-white/15 bg-black/35 text-slate-200 hover:border-emerald-500/40 hover:bg-white/10"
      } ${className}`}
    >
      {isLight ? (
        <Sun className="h-3.5 w-3.5 text-amber-600" aria-hidden />
      ) : (
        <Moon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
      )}
      <span className="hidden sm:inline">
        {isLight ? "Light · Istituzionale" : "Dark · Tattico"}
      </span>
    </button>
  );
}
