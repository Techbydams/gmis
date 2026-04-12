// ============================================================
// GMIS — Platform-Aware App Router
//
// WEB (gmis.app — no subdomain):  → Landing page
// WEB (estam.gmis.app — subdomain): → /(tenant)/login
// WEB (localhost — dev):           → /find-school
// NATIVE (iOS/Android):            → /(onboarding) or /(tenant)/login
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Spinner }   from "@/components/ui";
import { useTheme }  from "@/context/ThemeContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantSlug } from "@/lib/helpers";
import { layout }    from "@/styles/shared";

const STORED_SLUG_KEY = "gmis:org_slug";

export default function AppRouter() {
  const router         = useRouter();
  const { colors }     = useTheme();
  const { slug, loading } = useTenant();

  useEffect(() => {
    if (loading) return;
    route();
  }, [loading, slug]);

  const route = async () => {

    // ── NATIVE (iOS / Android) ─────────────────────────────
    if (Platform.OS !== "web") {
      try {
        const stored = await AsyncStorage.getItem(STORED_SLUG_KEY);
        if (stored) {
          // Returning user — go straight to login (tenant already loaded)
          router.replace("/(tenant)/login");
        } else {
          // First time — go through onboarding
          router.replace("/(onboarding)");
        }
      } catch {
        router.replace("/(onboarding)");
      }
      return;
    }

    // ── WEB ────────────────────────────────────────────────
    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const subdomain   = getTenantSlug(); // reads subdomain from window.location

    if (isLocalhost) {
      // Local dev — no subdomains available
      // If a slug was already set (came from find-school), go to tenant
      if (slug) {
        router.replace("/(tenant)/login");
      } else {
        router.replace("/find-school");
      }
      return;
    }

    if (subdomain) {
      // Production: estam.gmis.app → school portal
      // TenantContext already loaded the school from the subdomain
      router.replace("/(tenant)/login");
      return;
    }

    // Production: gmis.app (no subdomain) → public landing page
    router.replace("/(landing)");
  };

  return (
    <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
      <Spinner size="lg" label="Starting GMIS..." />
    </View>
  );
}
