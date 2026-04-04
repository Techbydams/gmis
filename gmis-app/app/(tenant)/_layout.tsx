// ============================================================
// GMIS — Tenant Layout
// Provides AuthProvider for all /(tenant)/* routes.
//
// Auth gate logic:
//   loading          → spinner
//   no user          → /(tenant)/login
//   user + role      → role dashboard (if on login/signup pages)
//   otherwise        → render the route (Slot)
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect }            from "react";
import { Slot, useRouter, usePathname } from "expo-router";
import { View }                 from "react-native";
import { Spinner }              from "@/components/ui";
import { useTenant }            from "@/context/TenantContext";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { useTheme }             from "@/context/ThemeContext";
import { layout }               from "@/styles/shared";

// ── Public routes — no auth needed ────────────────────────
const PUBLIC_ROUTES = [
  "/(tenant)/login",
  "/(tenant)/admin-login",
  "/(tenant)/signup",
  "/(tenant)/setup",
  "/(tenant)/forgot-password",
  "/(tenant)/pending",
];

// ── Inner gate — has access to AuthContext ─────────────────
function AuthGate() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const pathname          = usePathname();
  const { colors }        = useTheme();

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_ROUTES.some((r) =>
      pathname === r || pathname.startsWith(r + "?")
    );

    if (!user) {
      // Not logged in and on a protected route → go to login
      if (!isPublic) {
        router.replace("/(tenant)/login");
      }
      return;
    }

    // Already logged in and on a public page → go to dashboard
    if (isPublic) {
      switch (user.role) {
        case "student":
          router.replace("/(tenant)/(student)/dashboard");
          break;
        case "lecturer":
          router.replace("/(tenant)/(lecturer)/dashboard");
          break;
        case "admin":
          router.replace("/(tenant)/(admin)/dashboard");
          break;
        case "parent":
          router.replace("/(tenant)/(parent)/dashboard");
          break;
        default:
          router.replace("/(tenant)/login");
      }
    }
    // On a protected route and logged in → stay (Slot renders the page)
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Loading..." />
      </View>
    );
  }

  return <Slot />;
}

// ── Outer layout — provides AuthContext ───────────────────
export default function TenantLayout() {
  const { tenantClient, loading, slug, error } = useTenant();
  const router   = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading && (!slug || error)) {
      router.replace("/find-school");
    }
  }, [loading, slug, error]);

  if (loading || !tenantClient) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Connecting to school portal..." />
      </View>
    );
  }

  return (
    <AuthProvider tenantClient={tenantClient}>
      <AuthGate />
    </AuthProvider>
  );
}
