// ============================================================
// GMIS — Platform Layout
// Guards the platform admin section.
// Uses the masterSupabase client directly (not tenant).
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useEffect }       from "react";
import { Slot, useRouter } from "expo-router";
import { View }            from "react-native";
import { Spinner }         from "@/components/ui";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { masterSupabase }  from "@/lib/supabase";
import { useTheme }        from "@/context/ThemeContext";

function PlatformAuthGate() {
  const { user, loading } = useAuth();
  const router            = useRouter();
  const { colors }        = useTheme();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/(platform)/login");
      return;
    }

    if (user.role !== "platform_admin") {
      // Not authorised — boot to root
      router.replace("/");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg.primary,
        }}
      >
        <Spinner size="lg" label="Authenticating..." />
      </View>
    );
  }

  return <Slot />;
}

export default function PlatformLayout() {
  return (
    <AuthProvider tenantClient={masterSupabase}>
      <PlatformAuthGate />
    </AuthProvider>
  );
}