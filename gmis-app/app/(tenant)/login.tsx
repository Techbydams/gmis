// ============================================================
// GMIS — School Login (FIXED for mobile)
//
// FIXES:
//  1. SafeAreaView with edges=["top","bottom"]
//  2. ScrollView with justifyContent:"center" so content
//     is always vertically centred when shorter than screen
//  3. Proper hitSlop on all touch targets
//  4. KeyboardAvoidingView offset for iOS
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
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter }  from "expo-router";
import { useAuth }    from "@/context/AuthContext";
import { useTenant }  from "@/context/TenantContext";
import { isValidEmail } from "@/lib/helpers";
import { Text, Input, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme }     from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type LoginRole = "student" | "lecturer" | "parent";

const ROLES: { id: LoginRole; label: string }[] = [
  { id: "student",  label: "Student"  },
  { id: "lecturer", label: "Lecturer" },
  { id: "parent",   label: "Parent"   },
];

export default function SchoolLogin() {
  const router                       = useRouter();
  const { signIn, signInWithMatric } = useAuth();
  const { tenant, slug }             = useTenant();
  const { colors }                   = useTheme();
  const { pagePadding }              = useResponsive();

  const [role,     setRole]     = useState<LoginRole>("student");
  const [id_,      setId]       = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errId,    setErrId]    = useState("");
  const [errPass,  setErrPass]  = useState("");
  const [toast,    setToast]    = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000); };

  const validate = (): boolean => {
    let ok = true;
    if (!id_.trim()) { setErrId(role === "student" ? "Enter matric number or email" : "Enter email"); ok = false; }
    if (!password)   { setErrPass("Password is required"); ok = false; }
    else if (password.length < 6) { setErrPass("Password too short"); ok = false; }
    return ok;
  };

  const handleLogin = async () => {
    setErrId(""); setErrPass("");
    if (!validate()) return;
    setLoading(true);
    try {
      let error: string | null = null;
      if (role === "student") {
        const input = id_.trim();
        const result = isValidEmail(input) ? await signIn(input, password) : await signInWithMatric(input, password);
        error = result.error;
      } else {
        error = (await signIn(id_.trim(), password)).error;
      }
      if (error) { showToast(error); }
      // Redirect handled by AuthGate in _layout
    } catch { showToast("Something went wrong. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>

        {/* Toast */}
        {toast && (
          <View style={[styles.toast, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}>
            <Icon name="status-error" size="sm" color={colors.status.error} />
            <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.error, marginLeft: spacing[2] }}>{toast}</Text>
          </View>
        )}

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: pagePadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inner}>

            {/* School banner */}
            <View style={styles.schoolBanner}>
              <View style={styles.schoolLogo}>
                {tenant?.logo_url ? (
                  <Image source={{ uri: tenant.logo_url }} style={{ width: "100%", height: "100%", borderRadius: radius.md }} />
                ) : (
                  <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.sm, color: "#fff" }}>
                    {(tenant?.name || slug || "G").slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={layout.fill}>
                <Text style={{ fontWeight: fontWeight.extrabold, color: "#fff", fontSize: fontSize.base }} numberOfLines={1}>
                  {tenant?.name || `${slug}.gmis.app`}
                </Text>
                <View style={[layout.row, { gap: spacing[1], marginTop: 2 }]}>
                  <View style={styles.activeDot} />
                  <Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.55)" }} numberOfLines={1}>
                    {slug}.gmis.app · Powered by GMIS
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => router.push("/find-school" as any)} activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.4)" }}>← Change</Text>
              </TouchableOpacity>
            </View>

            {/* Login card */}
            <Card padding="none" style={styles.card}>
              <Text variant="title" color="primary" align="center" style={{ marginBottom: spacing[1] }}>Welcome back</Text>
              <Text variant="caption" color="secondary" align="center" style={{ marginBottom: spacing[5] }}>
                Sign in to your {tenant?.name || "school"} portal
              </Text>

              {/* Role tabs */}
              <View style={[styles.roleTabs, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => { setRole(r.id); setErrId(""); setId(""); }}
                    activeOpacity={0.75}
                    style={[styles.roleTab, role === r.id && { backgroundColor: brand.blue }]}
                  >
                    <Icon name={r.id === "student" ? "user-student" : r.id === "lecturer" ? "user-lecturer" : "user-parent"} size="xs"
                      color={role === r.id ? "#fff" : colors.text.muted} filled={role === r.id} />
                    <Text style={{ fontSize: fontSize.sm, fontWeight: role === r.id ? fontWeight.bold : fontWeight.normal, color: role === r.id ? "#fff" : colors.text.muted, marginLeft: spacing[1] }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Parent banner */}
              {role === "parent" && (
                <View style={[styles.infoBanner, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
                  <Icon name="user-parent" size="sm" color={colors.status.info} />
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                    Sign in with the email linked to your ward's profile.
                  </Text>
                </View>
              )}

              {/* Identifier */}
              <Input
                label={role === "student" ? "Matric number or email" : "Email address"}
                value={id_}
                onChangeText={(v) => { setId(v); setErrId(""); }}
                onSubmitEditing={handleLogin}
                placeholder={role === "student" ? "e.g. 24EF021030058 or email" : "your@email.com"}
                autoCapitalize="none"
                keyboardType={role !== "student" ? "email-address" : "default"}
                iconLeft={role === "student" ? "user-student" : "nav-chat"}
                error={errId}
              />

              {/* Password */}
              <View style={{ marginBottom: spacing[3] }}>
                <View style={[layout.rowBetween, { marginBottom: spacing[1] }]}>
                  <Text variant="caption" color="secondary" weight="medium">Password</Text>
                  <TouchableOpacity onPress={() => router.push("/forgot-password" as any)} activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.text.link }}>Forgot?</Text>
                  </TouchableOpacity>
                </View>
                <Input
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrPass(""); }}
                  onSubmitEditing={handleLogin}
                  placeholder="Enter your password"
                  secureTextEntry={!showPass}
                  iconLeft="auth-password"
                  iconRight={showPass ? "auth-eye-off" : "auth-eye"}
                  onPressRight={() => setShowPass((v) => !v)}
                  error={errPass}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>

              {/* Remember me */}
              <TouchableOpacity
                onPress={() => setRemember((v) => !v)}
                style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <View style={[styles.checkbox, { backgroundColor: remember ? brand.blue : "transparent", borderColor: remember ? brand.blue : colors.border.strong }]}>
                  {remember && <Icon name="ui-check" size="xs" color="#fff" />}
                </View>
                <Text variant="caption" color="secondary">Remember me on this device</Text>
              </TouchableOpacity>

              {/* Submit */}
              <Button
                label={loading ? "Signing in..." : `Sign in as ${ROLES.find((r) => r.id === role)?.label}`}
                variant="primary" size="lg" full loading={loading} onPress={handleLogin}
              />

              {/* Divider */}
              <View style={[layout.row, { marginVertical: spacing[4], gap: spacing[3] }]}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border.DEFAULT }} />
                <Text variant="caption" color="muted">or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border.DEFAULT }} />
              </View>

              {/* New student */}
              <View style={layout.centredH}>
                <Text variant="caption" color="secondary">
                  New student?{" "}
                  <Text variant="caption" color="link" weight="bold" onPress={() => router.push("/signup" as any)}>Create account</Text>
                </Text>
              </View>

              {/* Security note */}
              <View style={[styles.secNote, { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle }]}>
                <Icon name="status-locked" size="sm" color={colors.text.muted} />
                <Text style={{ flex: 1, fontSize: fontSize["2xs"], color: colors.text.muted, marginLeft: spacing[2], lineHeight: 16 }}>
                  This portal is exclusively for{" "}
                  <Text style={{ fontSize: fontSize["2xs"], color: colors.text.secondary, fontWeight: fontWeight.semibold }}>
                    {tenant?.name || slug}
                  </Text>
                  .{" "}
                  <Text style={{ fontSize: fontSize["2xs"], color: colors.text.link }} onPress={() => router.push("/find-school" as any)}>
                    Wrong school?
                  </Text>
                </Text>
              </View>
            </Card>

            {/* Admin link */}
            <TouchableOpacity onPress={() => router.push("/admin-login" as any)} style={{ marginTop: spacing[4], alignItems: "center" }} activeOpacity={0.7}>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                Administrator?{" "}
                <Text style={{ fontSize: fontSize.sm, color: colors.text.link }}>Admin portal →</Text>
              </Text>
            </TouchableOpacity>

            {/* Footer */}
            <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, textAlign: "center", marginTop: spacing[4], marginBottom: spacing[4] }}>
              Powered by{" "}
              <Text style={{ fontSize: fontSize["2xs"], color: brand.gold, fontWeight: fontWeight.bold }}>GMIS</Text>
              {" "}· A product of DAMS Technologies
            </Text>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:       1,
    justifyContent: "center",   // centres on tall screens
    paddingVertical: spacing[5],
  },
  inner: {
    width:     "100%",
    maxWidth:  440,
    alignSelf: "center",
  },
  toast: {
    position: "absolute", top: spacing[3], left: spacing[4], right: spacing[4], zIndex: 100,
    flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1,
  },
  schoolBanner: {
    flexDirection: "row", alignItems: "center", gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    marginBottom: spacing[3], borderRadius: radius.xl,
    backgroundColor: "#1a3a8f",
  },
  schoolLogo: {
    width: sizes.brandIconSize + spacing[1], height: sizes.brandIconSize + spacing[1],
    borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden",
  },
  activeDot: { width: spacing[1] + 1, height: spacing[1] + 1, borderRadius: radius.full, backgroundColor: "#4ade80" },
  card:   { paddingHorizontal: spacing[5], paddingVertical: spacing[5] },
  roleTabs: { flexDirection: "row", borderRadius: radius.lg, borderWidth: 1, padding: spacing[1], marginBottom: spacing[4], gap: spacing[1] },
  roleTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: spacing[2] + spacing[1], borderRadius: radius.md, gap: spacing[1] },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[2] + spacing[1], borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing[4] },
  checkbox: { width: spacing[4], height: spacing[4], borderRadius: radius.xs, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  secNote: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, marginTop: spacing[4] },
});
