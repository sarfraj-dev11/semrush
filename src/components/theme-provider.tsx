"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  themes: string[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "system",
  setTheme: () => {},
  resolvedTheme: "dark",
  themes: ["light", "dark", "system"],
});

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: {
  children: ReactNode;
  attribute?: string;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    try {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const applyTheme = useCallback((targetTheme: Theme, sysTheme: "light" | "dark") => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const isDark = targetTheme === "dark" || (targetTheme === "system" && sysTheme === "dark");
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch (err) {
        console.error("❌ [ThemeProvider] Failed to save theme preference:", err);
      }
      applyTheme(newTheme, systemTheme);
    },
    [applyTheme, storageKey, systemTheme]
  );

  // Listen for system theme changes
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => {
      const newSysTheme = e.matches ? "dark" : "light";
      setSystemTheme(newSysTheme);
      if (theme === "system") {
        applyTheme("system", newSysTheme);
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme, applyTheme]);

  // Listen for storage changes across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const newTheme = e.newValue as Theme;
        setThemeState(newTheme);
        applyTheme(newTheme, systemTheme);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [applyTheme, storageKey, systemTheme]);

  // Synchronize on mount
  useEffect(() => {
    applyTheme(theme, systemTheme);
  }, [theme, systemTheme, applyTheme]);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        resolvedTheme,
        themes: ["light", "dark", "system"],
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
