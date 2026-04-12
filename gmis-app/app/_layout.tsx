// ============================================================
// GMIS — Root Layout
// SafeAreaProvider MUST wrap everything for mobile safe areas.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import "../global.css";
import { Stack }      from "expo-router";
import { StatusBar }  from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { TenantProvider }          from "@/context/TenantContext";
import { ToastProvider }           from "@/components/ui";
import { Analytics }               from "@vercel/analytics/react";

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar
        style={isDark ? "light" : "dark"}
        backgroundColor={isDark ? "#03071a" : "#f0f4ff"}
      />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <TenantProvider>
          <ToastProvider>
            <AppContent />
            <Analytics />
          </ToastProvider>
        </TenantProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
