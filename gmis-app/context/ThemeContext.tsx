// ============================================================
// GMIS — Theme Context
// Wraps NativeWind's color scheme system with AsyncStorage
// persistence so the user's choice survives app restarts.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useColorScheme } from "nativewind";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light } from "@/theme/tokens";

type ThemeMode = "dark" | "light";

const STORAGE_KEY = "gmis:theme";

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

  // ── On mount: restore saved preference or use device setting ─
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") {
        setColorScheme(saved);
      } else {
        // No saved preference → follow device setting, default light
        const deviceScheme = Appearance.getColorScheme();
        const initial: ThemeMode = deviceScheme === "dark" ? "dark" : "light";
        setColorScheme(initial);
        // Don't persist — let it auto-follow device until user manually picks
      }
    });
  }, []);

  const isDark  = colorScheme !== "light";
  const theme   = isDark ? "dark" : "light";
  const colors  = isDark ? dark : light;

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = isDark ? "light" : "dark";
    setColorScheme(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, [isDark, setColorScheme]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setColorScheme(mode);
      AsyncStorage.setItem(STORAGE_KEY, mode);
    },
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
