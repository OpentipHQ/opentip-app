"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { cn } from "cn";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    return () => root.classList.remove("dark");
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        id="opentip-theme-root"
        suppressHydrationWarning
        className={cn(
          "min-h-screen bg-background text-foreground",
          resolvedTheme === "dark" && "dark",
        )}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
