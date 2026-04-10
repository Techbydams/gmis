// ============================================================
// GMIS — Tenant Layout  (FIXED — full role-based routing)
// Route: /(tenant)/_layout.tsx
//
// WHAT WAS BROKEN:
//   AuthGate only checked `if (!user) → /login`.
//   After login every user just got <Slot /> with no redirect.
//   Lecturers, admins and parents were stuck with no dashboard.
//
// HOW IT'S FIXED:
//   Uses useSegments() — the correct Expo Router API.
//   usePathname() strips group names so "(student)" becomes "".
//   useSegments() keeps them: ["(tenant)", "(student)", "dashboard"]
//   This lets us:
//     1. Detect public paths  (login, signup, setup, admin-login)
//     2. Redirect after login → correct role dashboard
//     3. Block cross-role access (student can't reach /(admin)/*)
//
// ROLE → DASHBOARD MAP:
//   student  → /(tenant)/(student)/dashboard
//   admin    → /(tenant)/(admin)/dashboard
//   lecturer → /(tenant)/(lecturer)/dashboard
//   parent   → /(tenant)/(parent)/dashboard
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect }                   from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { View }                         from "react-native";
import { Spinner }                      from "@/components/ui";
import { Text }                         from "@/components/ui/Text";
import { useTenant }                    from "@/context/TenantContext";
import { AuthProvider, useAuth }        from "@/context/AuthContext";
import { useTheme }                     from "@/context/ThemeContext";
import { layout }                       from "@/styles/shared";
import { spacing }                      from "@/theme/tokens";

// ── Constants ──────────────────────────────────────────────
// Pages inside /(tenant)/ that don't require auth
const PUBLIC_SEGMENTS = new Set(["login", "admin-login", "signup", "setup"]);

// Where each role goes after login
const ROLE_DASHBOARDS: Record<string, string> = {
  student:  "/(tenant)/(student)/dashboard",
  admin:    "/(tenant)/(admin)/dashboard",
  lecturer: "/(tenant)/(lecturer)/dashboard",
  parent:   "/(tenant)/(parent)/dashboard",
};

// The route group each role belongs to
// Used to block cross-role navigation
const ROLE_GROUPS: Record<string, string> = {
  student:  "(student)",
  admin:    "(admin)",
  lecturer: "(lecturer)",
  parent:   "(parent)",
};

// ── Auth Gate (inner — has AuthContext) ────────────────────
function AuthGate() {
  const { user, loading }  = useAuth();
  const router             = useRouter();
  const segments           = useSegments();
  const { colors }         = useTheme();

  useEffect(() => {
    if (loading) return;

    // segments looks like: ["(tenant)", "login"]
    //                  or: ["(tenant)", "(student)", "dashboard"]
    //                  or: ["(tenant)", "(admin)", "academic"]
    const afterTenant = segments[1] as string | undefined;

    // Is the user on a public page (login, signup, etc.)?
    const onPublicPage = !afterTenant || PUBLIC_SEGMENTS.has(afterTenant);

    // ── NOT logged in ──────────────────────────────────────
    if (!user) {
      if (!onPublicPage) {
        // Protected page with no session → send to login
        router.replace("/(tenant)/login");
      }
      // On public page with no session → just show it
      return;
    }

    // ── LOGGED IN on a public/login page ──────────────────
    // e.g. user is already signed in but hits /login again
    if (onPublicPage) {
      const dashboard = ROLE_DASHBOARDS[user.role] ?? ROLE_DASHBOARDS.student;
      router.replace(dashboard as any);
      return;
    }

    // ── CROSS-ROLE GUARD ──────────────────────────────────
    // afterTenant is now a group like "(student)", "(admin)", etc.
    // If it doesn't match this user's expected group, kick them out.
    const expectedGroup = ROLE_GROUPS[user.role];
    if (
      expectedGroup &&
      afterTenant &&
      afterTenant.startsWith("(") &&          // it's a role group, not a page name
      afterTenant !== expectedGroup
    ) {
      // e.g. student trying to access /(admin)/* → redirect to student dashboard
      const dashboard = ROLE_DASHBOARDS[user.role] ?? ROLE_DASHBOARDS.student;
      router.replace(dashboard as any);
      return;
    }

    // All good — user is authenticated, on the right section
  }, [user, loading, segments]);

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Loading..." />
      </View>
    );
  }

  // ── Not logged in on a public page (e.g. /login itself) ─
  // Render the page — it will handle its own UI
  if (!user) {
    return <Slot />;
  }

  // ── Logged in → render requested page ─────────────────
  return <Slot />;
}

// ── Tenant Layout (outer — provides AuthContext) ──────────
export default function TenantLayout() {
  const { tenantClient, loading, slug, error } = useTenant();
  const router   = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    if (!loading && (!slug || error)) {
      // No tenant context → send to institution search
      router.replace("/find-school");
    }
  }, [loading, slug, error]);

  // Waiting for tenant resolution
  if (loading || !tenantClient) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Connecting to school portal..." />
      </View>
    );
  }

  // Tenant found → wrap with AuthProvider then gate
  return (
    <AuthProvider tenantClient={tenantClient}>
      <AuthGate />
    </AuthProvider>
  );
}
