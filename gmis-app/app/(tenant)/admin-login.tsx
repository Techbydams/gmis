// ============================================================
// GMIS — Admin Login
// Route: /(tenant)/admin-login
// For school administrators only.
// Gold accent theme — deliberately distinct from student login.
// Ported from Vite AdminLogin.tsx
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import {
  Text, Input, Button, Card,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight, sizes,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

export default function AdminLogin() {
  const router              = useRouter();
  const { signIn, user, loading: authLoading } = useAuth();
  const { tenant, slug }    = useTenant();
  const { colors, isDark }  = useTheme();
  const GMIS_LOGO           = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errEmail, setErrEmail] = useState("");
  const [errPass,  setErrPass]  = useState("");
  const [attempts, setAttempts] = useState(0);
  const [toast,    setToast]    = useState<string | null>(null);

  // Already logged in as admin → redirect
  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      router.replace("/(tenant)/(admin)/dashboard");
    }
  }, [user, authLoading]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const validate = (): boolean => {
    let ok = true;
    if (!email.trim()) {
      setErrEmail("Email is required"); ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrEmail("Enter a valid email address"); ok = false;
    }
    if (!password) {
      setErrPass("Password is required"); ok = false;
    } else if (password.length < 6) {
      setErrPass("Password too short"); ok = false;
    }
    return ok;
  };

  const handleLogin = async () => {
    setErrEmail(""); setErrPass("");
    if (!validate()) return;
    setLoading(true);

    try {
      const { error } = await signIn(email.trim().toLowerCase(), password);

      if (error) {
        setAttempts((a) => a + 1);
        if (error.includes("Incorrect") || error.includes("Invalid")) {
          showToast("Wrong credentials. This portal is for administrators only.");
        } else {
          showToast(error);
        }
        setLoading(false);
        return;
      }

      showToast("Access granted");
      // Redirect handled by useEffect once user.role resolves

    } catch {
      showToast("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: "#010a18" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Gold glow */}
      <View style={styles.glow} />

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}>
          <Icon name="status-warning" size="sm" color={colors.status.warning} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.error, marginLeft: spacing[2] }}>
            {toast}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, layout.centredH]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Header */}
          <View style={[layout.centredH, { marginBottom: spacing[6] }]}>
            {/* Gold emblem */}
            <View style={styles.emblem}>
              <View style={styles.emblemInner}>
                <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize["2xl"], color: "#fff", letterSpacing: -1 }}>
                  G
                </Text>
              </View>
            </View>
            <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.xl, color: "#e8eeff", marginBottom: spacing[1] }}>
              Administration Access
            </Text>
            <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, letterSpacing: 0.5 }}>
              {tenant?.name?.toUpperCase() || slug?.toUpperCase()} · RESTRICTED PORTAL
            </Text>
          </View>

          {/* Warning banner */}
          <View style={[styles.warningBanner, { backgroundColor: brand.goldAlpha10, borderColor: brand.goldAlpha20 }]}>
            <Icon name="status-warning" size="sm" color={brand.gold} />
            <Text style={{ flex: 1, fontSize: fontSize.xs, color: brand.gold, marginLeft: spacing[2], lineHeight: 18 }}>
              This page is for <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.gold }}>school administrators only</Text>.
              Unauthorised access attempts are logged.
            </Text>
          </View>

          {/* Login card */}
          <Card padding="none" style={styles.card}>
            {/* School strip */}
            <View style={[styles.schoolStrip, { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle }]}>
              <View style={[styles.stripDot, { backgroundColor: brand.gold }]} />
              <Text style={{ fontFamily: "monospace", fontSize: fontSize.xs, color: colors.text.secondary, letterSpacing: 0.5 }}>
                {slug}.gmis.app
              </Text>
              <View style={layout.fill} />
              <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                Admin
              </Text>
            </View>

            {/* Email */}
            <Input
              label="Administrator email"
              value={email}
              onChangeText={(v) => { setEmail(v); setErrEmail(""); }}
              onSubmitEditing={handleLogin}
              placeholder="admin@institution.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              iconLeft="nav-chat"
              error={errEmail}
            />

            {/* Password */}
            <Input
              label="Password"
              value={password}
              onChangeText={(v) => { setPassword(v); setErrPass(""); }}
              onSubmitEditing={handleLogin}
              placeholder="••••••••••••"
              secureTextEntry={!showPass}
              autoComplete="password"
              iconLeft="auth-password"
              iconRight={showPass ? "auth-eye-off" : "auth-eye"}
              onPressRight={() => setShowPass((v) => !v)}
              error={errPass}
            />

            {/* Multiple attempts warning */}
            {attempts >= 3 && (
              <View style={[styles.attemptsWarn, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}>
                <Text style={{ fontSize: fontSize.xs, color: colors.status.error }}>
                  Multiple failed attempts detected. Ensure you are using the correct admin credentials.
                </Text>
              </View>
            )}

            {/* Submit */}
            <Button
              label={loading ? "Authenticating..." : "Access Admin Portal"}
              variant="gold"
              size="lg"
              full
              loading={loading}
              onPress={handleLogin}
            />

            {/* First-time setup */}
            <TouchableOpacity
              onPress={() => router.push("/(tenant)/setup?role=admin")}
              style={{ marginTop: spacing[4], alignItems: "center" }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                First-time setup →
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Back link */}
          <TouchableOpacity
            onPress={() => router.push("/(tenant)/login")}
            style={{ marginTop: spacing[5], alignItems: "center" }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
              ← Back to student / lecturer portal
            </Text>
          </TouchableOpacity>

          {/* GMIS logo + DAMS credit */}
          <View style={{ alignItems: "center", marginTop: spacing[4], gap: spacing[2] }}>
            <Image source={GMIS_LOGO} style={{ width: 80, height: 28 }} resizeMode="contain" />
            <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, textAlign: "center" }}>
              DAMS Technologies · {new Date().getFullYear()}
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   spacing[8],
    paddingHorizontal: spacing[5],
  },
  inner: {
    width:    "100%",
    maxWidth: 420,
  },
  glow: {
    position:     "absolute",
    width:        700,
    height:       700,
    borderRadius: 350,
    top:          "50%",
    left:         "50%",
    marginTop:    -350,
    marginLeft:   -350,
    backgroundColor: brand.goldAlpha10,
    pointerEvents: "none",
  } as any,
  toast: {
    position:          "absolute",
    top:               spacing[12],
    left:              spacing[4],
    right:             spacing[4],
    zIndex:            100,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
  emblem: {
    width:           sizes.iconCircle - spacing[6],  // 64
    height:          sizes.iconCircle - spacing[6],
    borderRadius:    (sizes.iconCircle - spacing[6]) / 2,
    backgroundColor: brand.goldAlpha15,
    borderWidth:     1,
    borderColor:     brand.goldAlpha20,
    alignItems:      "center",
    justifyContent:  "center",
    marginBottom:    spacing[3],
  },
  emblemInner: {
    width:           sizes.brandIconSize + spacing[1],  // 44
    height:          sizes.brandIconSize + spacing[1],
    borderRadius:    (sizes.brandIconSize + spacing[1]) / 2,
    backgroundColor: "#1a3a8f",
    alignItems:      "center",
    justifyContent:  "center",
  },
  warningBanner: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[4],
  },
  card: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[6],
    borderColor:       brand.goldAlpha15,
  },
  schoolStrip: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:      radius.md,
    borderWidth:       1,
    marginBottom:      spacing[5],
    gap:               spacing[2],
  },
  stripDot: {
    width:        spacing[1] + 2,  // 6
    height:       spacing[1] + 2,
    borderRadius: radius.full,
    flexShrink:   0,
  },
  attemptsWarn: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[4],
  },
});
