/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect } from "react";
import { Slot, useRouter } from "expo-router";
import { View, Platform } from "react-native";
import { Spinner } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { getTenantSlug } from "@/lib/helpers";
import { layout } from "@/styles/shared";

// ── Platform admin is ONLY accessible from gmis.app (no subdomain) ──
// If a user on estam.gmis.app tries to reach /(platform)/*,
// redirect them to their institution login instead.
export default function PlatformLayout() {
  const router     = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const hostname  = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    if (isLocalhost) return; // Dev — allow access

    const subdomain = getTenantSlug();
    if (subdomain) {
      // Institution subdomain — no platform admin access
      router.replace("/(tenant)/login");
    }
  }, []);

  // On web with a subdomain, redirect happens in useEffect above.
  // On native or gmis.app — render normally.
  if (Platform.OS === "web") {
    const hostname  = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const subdomain   = typeof window !== "undefined" ? getTenantSlug() : null;
    if (!isLocalhost && subdomain) {
      return (
        <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
          <Spinner size="lg" label="Redirecting..." />
        </View>
      );
    }
  }

  return <Slot />;
}
