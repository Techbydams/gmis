// ============================================================
// GMIS — Platform Admin Login
// Route: /(platform)/login
// Uses MASTER Supabase Auth (not tenant auth).
// After login, checks platform_admins.supabase_uid matches.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";   // master Supabase client
import { isValidEmail } from "@/lib/helpers";
import { Text, Input, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout, platformShadow } from "@/styles/shared";

export default function PlatformLogin() {
  const router     = useRouter();
  const { colors } = useTheme();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !isValidEmail(email)) { setError("Enter a valid email address"); return; }
    if (!password)                              { setError("Password is required"); return; }

    setLoading(true);
    try {
      // 1 — Sign in via master Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        setError("Invalid email or password.");
        return;
      }

      // 2 — Verify this UID is a platform admin
      const { data: admin, error: adminError } = await supabase
        .from("platform_admins")
        .select("id, full_name, is_active")
        .eq("supabase_uid", authData.user!.id)
        .maybeSingle();

      if (adminError || !admin) {
        await supabase.auth.signOut();
        setError("This account is not a GMIS platform admin.");
        return;
      }

      if (!(admin as any).is_active) {
        await supabase.auth.signOut();
        setError("This admin account has been deactivated.");
        return;
      }

      // 3 — Update last_login
      await supabase
        .from("platform_admins")
        .update({ last_login: new Date().toISOString() } as any)
        .eq("id", (admin as any).id);

      // 4 — Navigate to platform dashboard
      router.replace("/(platform)/dashboard");
    } catch (err: any) {
      setError(`Login failed: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: "#03071a" }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, layout.centredH]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Logo */}
          <View style={[layout.centredH, { marginBottom: spacing[8] }]}>
            <View style={styles.logo}>
              <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: "#fff" }}>G</Text>
            </View>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["3xl"], color: "#e8eeff", marginTop: spacing[3] }}>
              GMIS
            </Text>
            <Text style={{ fontSize: fontSize.sm, color: "#7a8bbf", marginTop: spacing[1] }}>
              Platform Admin · DAMS Technologies
            </Text>
          </View>

          <Card padding="none" style={styles.card}>
            <Text variant="title" color="primary" align="center" style={{ marginBottom: spacing[1] }}>
              Admin sign in
            </Text>
            <Text variant="caption" color="muted" align="center" style={{ marginBottom: spacing[6] }}>
              DAMS Technologies master control panel
            </Text>

            <Input
              label="Email address"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(""); }}
              onSubmitEditing={handleLogin}
              placeholder="admin@damstech.com"
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft="nav-chat"
            />

            <Input
              label="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); setError(""); }}
              onSubmitEditing={handleLogin}
              placeholder="Enter your password"
              secureTextEntry={!showPass}
              iconLeft="auth-password"
              iconRight={showPass ? "auth-eye-off" : "auth-eye"}
              onPressRight={() => setShowPass((v) => !v)}
            />

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}>
                <Icon name="status-error" size="sm" color={colors.status.error} />
                <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.error, marginLeft: spacing[2] }}>{error}</Text>
              </View>
            ) : null}

            <Button
              label={loading ? "Signing in..." : "Sign in to Admin Panel"}
              variant="primary"
              size="lg"
              full
              loading={loading}
              onPress={handleLogin}
              style={{ marginTop: error ? spacing[3] : 0 }}
            />
          </Card>

          <TouchableOpacity
            onPress={() => router.push("/(landing)")}
            style={{ marginTop: spacing[5], alignItems: "center" }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: fontSize.sm, color: "#7a8bbf" }}>← Back to GMIS</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingVertical: spacing[10], paddingHorizontal: spacing[5] },
  inner:  { width: "100%", maxWidth: 400, alignSelf: "center" },
  logo: {
    width:           spacing[16],
    height:          spacing[16],
    borderRadius:    spacing[4],
    backgroundColor: brand.blue,
    alignItems:      "center",
    justifyContent:  "center",
    ...platformShadow(brand.blue, 8, 20, 0.4, 12),
  },
  card: { paddingHorizontal: spacing[5], paddingVertical: spacing[5] },
  errorBox: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[3],
  },
});
