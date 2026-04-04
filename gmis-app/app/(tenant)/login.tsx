// ============================================================
// GMIS — School Login
// Route: /(tenant)/login
// Handles: Student (matric/email), Lecturer, Parent login
// Admin login is SEPARATE at /(tenant)/admin-login
// Faithful port of the Vite SchoolLogin.tsx
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { isValidEmail } from "@/lib/helpers";
import {
  Text, Input, Button, Card, Spinner,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight, sizes,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Role config ────────────────────────────────────────────
type LoginRole = "student" | "lecturer" | "parent";

const ROLES: { id: LoginRole; label: string; hint: string }[] = [
  { id: "student",  label: "Student",  hint: "Matric number or email" },
  { id: "lecturer", label: "Lecturer", hint: "Email address"          },
  { id: "parent",   label: "Parent",   hint: "Email address"          },
];

interface FormState {
  identifier: string;
  password:   string;
  remember:   boolean;
}

interface FormErrors {
  identifier?: string;
  password?:   string;
}

// ── Component ──────────────────────────────────────────────
export default function SchoolLogin() {
  const router                           = useRouter();
  const { signIn, signInWithMatric }     = useAuth();
  const { tenant, slug }                 = useTenant();
  const { colors, isDark }               = useTheme();

  const [role,     setRole]     = useState<LoginRole>("student");
  const [form,     setForm]     = useState<FormState>({ identifier: "", password: "", remember: false });
  const [errors,   setErrors]   = useState<FormErrors>({});
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const activeRole = ROLES.find((r) => r.id === role)!;

  // ── Toast helper ─────────────────────────────────────
  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Validation ────────────────────────────────────────
  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.identifier.trim()) {
      e.identifier = role === "student"
        ? "Enter your matric number or email"
        : "Enter your email address";
    }
    if (!form.password) {
      e.password = "Password is required";
    } else if (form.password.length < 6) {
      e.password = "Password must be at least 6 characters";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      let error: string | null = null;

      if (role === "student") {
        const input = form.identifier.trim();
        if (isValidEmail(input)) {
          const result = await signIn(input, form.password);
          error = result.error;
        } else {
          const result = await signInWithMatric(input, form.password);
          error = result.error;
        }
      } else {
        // Lecturer + Parent both use email
        const result = await signIn(form.identifier.trim(), form.password);
        error = result.error;
      }

      if (error) {
        if (error.includes("Invalid login credentials") || error.includes("Incorrect")) {
          showToast("Incorrect credentials. Please check and try again.");
        } else if (error.includes("Email not confirmed")) {
          showToast("Please verify your email first. Check your inbox.");
        } else if (error.includes("not found")) {
          showToast("Matric number not found. Contact your registrar.");
        } else {
          showToast(error);
        }
        setLoading(false);
        return;
      }

      showToast("Welcome back!", "success");
      // Role-based redirect handled by the tenant layout auth gate

    } catch {
      showToast("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Background decorations — web only */}
      <View style={[styles.orbTR, { opacity: isDark ? 1 : 0.5 }]} />
      <View style={[styles.orbBL, { opacity: isDark ? 1 : 0.4 }]} />
      <View style={[styles.grid,  { opacity: isDark ? 0.03 : 0.04 }]} />

      {/* Toast */}
      {toast && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: toast.type === "error"
                ? colors.status.errorBg
                : colors.status.successBg,
              borderColor: toast.type === "error"
                ? colors.status.errorBorder
                : colors.status.successBorder,
            },
          ]}
        >
          <Icon
            name={toast.type === "error" ? "status-error" : "status-success"}
            size="sm"
            color={toast.type === "error" ? colors.status.error : colors.status.success}
          />
          <Text
            style={{
              flex:       1,
              fontSize:   fontSize.sm,
              color:      toast.type === "error" ? colors.status.error : colors.status.success,
              marginLeft: spacing[2],
            }}
          >
            {toast.msg}
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scroll, layout.centredH]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* School branding banner */}
          <View style={styles.schoolBanner}>
            <View style={styles.schoolLogo}>
              {tenant?.logo_url ? (
                <Image
                  source={{ uri: tenant.logo_url }}
                  style={{ width: "100%", height: "100%", borderRadius: radius.md }}
                />
              ) : (
                <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.black, color: "#fff" }}>
                  {(tenant?.name || slug || "G").slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>

            <View style={layout.fill}>
              <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.extrabold, color: "#fff" }}>
                {tenant?.name || `${slug}.gmis.app`}
              </Text>
              <View style={[layout.row, { gap: spacing[1] + 1, marginTop: 2 }]}>
                <View style={styles.activeDot} />
                <Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.55)" }}>
                  {slug}.gmis.app · Powered by GMIS
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={() => router.push("/find-school")} activeOpacity={0.7}>
              <Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.4)" }}>
                ← Change
              </Text>
            </TouchableOpacity>
          </View>

          {/* Login card */}
          <Card style={styles.card} padding="none">
            {/* Header */}
            <View style={[layout.centredH, { marginBottom: spacing[6] }]}>
              <Text variant="title" color="primary" align="center">Welcome back</Text>
              <Text variant="caption" color="secondary" align="center" style={{ marginTop: spacing[1] }}>
                Sign in to your {tenant?.name || "school"} portal
              </Text>
            </View>

            {/* Role tabs — Student / Lecturer / Parent */}
            <View style={[styles.roleTabs, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => {
                    setRole(r.id);
                    setErrors({});
                    setForm((p) => ({ ...p, identifier: "" }));
                  }}
                  activeOpacity={0.75}
                  style={[
                    styles.roleTab,
                    role === r.id && styles.roleTabActive,
                  ]}
                >
                  <Icon
                    name={
                      r.id === "student"  ? "user-student"  :
                      r.id === "lecturer" ? "user-lecturer" : "user-parent"
                    }
                    size="xs"
                    color={role === r.id ? "#fff" : colors.text.muted}
                    filled={role === r.id}
                  />
                  <Text
                    style={{
                      fontSize:   fontSize.sm,
                      fontWeight: role === r.id ? fontWeight.bold : fontWeight.normal,
                      color:      role === r.id ? "#fff" : colors.text.muted,
                      marginLeft: spacing[1],
                    }}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Parent info banner */}
            {role === "parent" && (
              <View
                style={[
                  styles.infoBanner,
                  { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder },
                ]}
              >
                <Icon name="user-parent" size="sm" color={colors.status.info} />
                <Text
                  style={{
                    flex:       1,
                    fontSize:   fontSize.sm,
                    color:      colors.status.info,
                    marginLeft: spacing[2],
                    lineHeight: 20,
                  }}
                >
                  Sign in with the email linked to your ward's profile by the school admin.
                </Text>
              </View>
            )}

            {/* Identifier field */}
            <Input
              label={role === "student" ? "Matric number or email" : "Email address"}
              value={form.identifier}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, identifier: v }));
                setErrors((p) => ({ ...p, identifier: undefined }));
              }}
              onSubmitEditing={handleLogin}
              placeholder={role === "student" ? "e.g. 24EF021030058 or email" : "your@email.com"}
              autoCapitalize="none"
              keyboardType={role !== "student" ? "email-address" : "default"}
              iconLeft={role === "student" ? "user-student" : "nav-chat"}
              error={errors.identifier}
            />

            {/* Password field */}
            <View style={{ marginBottom: spacing[3] }}>
              <View style={[layout.rowBetween, { marginBottom: spacing[1] }]}>
                <Text variant="caption" color="secondary" weight="medium">Password</Text>
                <TouchableOpacity onPress={() => router.push("/(tenant)/forgot-password")} activeOpacity={0.7}>
                  <Text style={{ fontSize: fontSize.sm, color: colors.text.link }}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <Input
                value={form.password}
                onChangeText={(v) => {
                  setForm((p) => ({ ...p, password: v }));
                  setErrors((p) => ({ ...p, password: undefined }));
                }}
                onSubmitEditing={handleLogin}
                placeholder="Enter your password"
                secureTextEntry={!showPass}
                autoComplete="password"
                iconLeft="auth-password"
                iconRight={showPass ? "auth-eye-off" : "auth-eye"}
                onPressRight={() => setShowPass((v) => !v)}
                error={errors.password}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>

            {/* Remember me */}
            <TouchableOpacity
              onPress={() => setForm((p) => ({ ...p, remember: !p.remember }))}
              style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: form.remember ? brand.blue : "transparent",
                    borderColor:     form.remember ? brand.blue : colors.border.strong,
                  },
                ]}
              >
                {form.remember && <Icon name="ui-check" size="xs" color="#fff" />}
              </View>
              <Text variant="caption" color="secondary">Remember me on this device</Text>
            </TouchableOpacity>

            {/* Submit */}
            <Button
              label={loading ? "Signing in..." : `Sign in as ${activeRole.label}`}
              variant="primary"
              size="lg"
              full
              loading={loading}
              onPress={handleLogin}
            />

            {/* Divider */}
            <View style={[layout.row, { marginVertical: spacing[4], gap: spacing[3] }]}>
              <View style={[{ flex: 1, height: 1, backgroundColor: colors.border.DEFAULT }]} />
              <Text variant="caption" color="muted">or</Text>
              <View style={[{ flex: 1, height: 1, backgroundColor: colors.border.DEFAULT }]} />
            </View>

            {/* New student */}
            <View style={[layout.centredH, { marginBottom: spacing[4] }]}>
              <Text variant="caption" color="secondary">
                New student?{" "}
                <Text
                  variant="caption"
                  color="link"
                  weight="bold"
                  onPress={() => router.push("/(tenant)/signup")}
                >
                  Create account
                </Text>
              </Text>
            </View>

            {/* Security note */}
            <View
              style={[
                styles.securityNote,
                { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle },
              ]}
            >
              <Icon name="status-locked" size="sm" color={colors.text.muted} />
              <Text
                style={{
                  flex:       1,
                  fontSize:   fontSize["2xs"],
                  color:      colors.text.muted,
                  marginLeft: spacing[2],
                  lineHeight: 16,
                }}
              >
                This portal is exclusively for{" "}
                <Text style={{ fontSize: fontSize["2xs"], color: colors.text.secondary, fontWeight: fontWeight.semibold }}>
                  {tenant?.name || slug}
                </Text>
                . Wrong school?{" "}
                <Text
                  style={{ fontSize: fontSize["2xs"], color: colors.text.link }}
                  onPress={() => router.push("/find-school")}
                >
                  Go back
                </Text>
              </Text>
            </View>
          </Card>

          {/* Admin link */}
          <TouchableOpacity
            onPress={() => router.push("/(tenant)/admin-login")}
            style={{ marginTop: spacing[4] }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, textAlign: "center" }}>
              Administrator?{" "}
              <Text style={{ fontSize: fontSize.sm, color: colors.text.link }}>Admin portal →</Text>
            </Text>
          </TouchableOpacity>

          {/* DAMS credit */}
          <Text
            style={{
              fontSize:   fontSize["2xs"],
              color:      colors.text.muted,
              textAlign:  "center",
              marginTop:  spacing[4],
            }}
          >
            Powered by{" "}
            <Text style={{ fontSize: fontSize["2xs"], color: brand.gold, fontWeight: fontWeight.bold }}>
              GMIS
            </Text>
            {" "}· A product of DAMS Technologies
          </Text>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   spacing[8],
    paddingHorizontal: spacing[5],
  },
  inner: {
    width:    "100%",
    maxWidth: 440,
  },
  orbTR: {
    position:     "absolute",
    width:        600,
    height:       600,
    borderRadius: 300,
    top:          -200,
    right:        -150,
    backgroundColor: brand.blueAlpha5,
  },
  orbBL: {
    position:     "absolute",
    width:        400,
    height:       400,
    borderRadius: 200,
    bottom:       -100,
    left:         -80,
    backgroundColor: brand.indigoAlpha5,
  },
  grid: {
    position:        "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    // Grid pattern — web only
  },
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
  schoolBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4] + spacing[1],  // 20
    paddingVertical:   spacing[3] + spacing[1],  // 16
    marginBottom:      spacing[3],
    borderRadius:      radius.xl,
    backgroundColor:   "#1a3a8f",
  },
  schoolLogo: {
    width:           sizes.brandIconSize + spacing[1],  // 44
    height:          sizes.brandIconSize + spacing[1],
    borderRadius:    radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    overflow:        "hidden",
  },
  activeDot: {
    width:        spacing[1] + 1,  // 5
    height:       spacing[1] + 1,
    borderRadius: radius.full,
    backgroundColor: "#4ade80",
  },
  card: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[6],
  },
  roleTabs: {
    flexDirection:  "row",
    borderRadius:   radius.lg,
    borderWidth:    1,
    padding:        spacing[1],
    marginBottom:   spacing[4],
    gap:            spacing[1],
  },
  roleTab: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    justifyContent:  "center",
    paddingVertical: spacing[2] + spacing[1],  // 12
    borderRadius:    radius.md,
    gap:             spacing[1],
  },
  roleTabActive: {
    backgroundColor: brand.blue,
  },
  infoBanner: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[4],
  },
  checkbox: {
    width:        spacing[4],
    height:       spacing[4],
    borderRadius: radius.xs,
    borderWidth:  1.5,
    alignItems:   "center",
    justifyContent: "center",
  },
  securityNote: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
});
