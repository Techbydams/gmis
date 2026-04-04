// ============================================================
// GMIS — Theme Context
// Wraps NativeWind's color scheme system with persistence.
// Use useTheme() anywhere in the app to get/set the theme.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useColorScheme } from "nativewind";
import { dark, light } from "@/theme/tokens";

type ThemeMode = "dark" | "light";

// The full colour set available to any component
export type ThemeColors = typeof dark | typeof light;

interface ThemeContextValue {
  theme:        ThemeMode;
  isDark:       boolean;
  colors:       ThemeColors;
  toggleTheme:  () => void;
  setTheme:     (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { colorScheme, setColorScheme } = useColorScheme();

  const isDark  = colorScheme !== "light";
  const theme   = isDark ? "dark" : "light";
  const colors  = isDark ? dark : light;

  const toggleTheme = useCallback(() => {
    setColorScheme(isDark ? "light" : "dark");
  }, [isDark, setColorScheme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => { setColorScheme(mode); },
    [setColorScheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────

/** Returns the current theme mode, toggle function, and full colour set */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Shorthand — returns only the colour set for the current theme */
export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}