// ============================================================
// GMIS — Forgot Password
// Route: /(tenant)/forgot-password
// Supports: student (matric or email), lecturer, parent, admin
// Uses Supabase auth.resetPasswordForEmail via tenant client
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
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

import { useRouter, useLocalSearchParams } from "expo-router";
import { useTenant }  from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Input, Button, Card } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight, sizes } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type ResetRole = "student" | "lecturer" | "parent" | "admin";

const ROLES: { id: ResetRole; label: string; icon: string }[] = [
  { id: "student",  label: "Student",  icon: "user-student"  },
  { id: "lecturer", label: "Lecturer", icon: "user-lecturer" },
  { id: "parent",   label: "Parent",   icon: "user-parent"   },
  { id: "admin",    label: "Admin",    icon: "user-admin"    },
];

type Step = "form" | "sent";

export default function ForgotPassword() {
  const router              = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const { tenant, slug }    = useTenant();
  const { colors, isDark }  = useTheme();
  const GMIS_LOGO           = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;

  const initialRole: ResetRole =
    (["student", "lecturer", "parent", "admin"].includes(roleParam || "") ? roleParam as ResetRole : "student");

  const [role,     setRole]     = useState<ResetRole>(initialRole);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState<Step>("form");
  const [errInput, setErrInput] = useState("");
  const [sentTo,   setSentTo]   = useState("");

  const db = useMemo(
    () => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
    [tenant, slug]
  );

  const isStudentMatric = (v: string) =>
    role === "student" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const validate = (): boolean => {
    const v = input.trim();
    if (!v) {
      setErrInput(role === "student" ? "Enter your matric number or email" : "Enter your email address");
      return false;
    }
    // If not student or student using email, validate email format
    if (role !== "student" || !isStudentMatric(v)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        setErrInput("Enter a valid email address");
        return false;
      }
    }
    return true;
  };

  const handleReset = async () => {
    setErrInput("");
    if (!validate() || !db) return;
    setLoading(true);

    try {
      let email = input.trim().toLowerCase();

      // For students entering matric number, resolve their email first
      if (isStudentMatric(input)) {
        const { data } = await db
          .from("students")
          .select("email")
          .ilike("matric_number", email)
          .maybeSingle();

        if (!data?.email) {
          setErrInput("Matric number not found. Try your email address instead.");
          setLoading(false);
          return;
        }
        email = data.email;
      }

      // Trigger Supabase password reset — sends email to the address
      const { error } = await (db as any).auth.resetPasswordForEmail(email, {
        redirectTo: `https://${slug}.gmis.app/reset-password`,
      });

      if (error) {
        // Supabase doesn't reveal if email exists (security), but surface real errors
        if (!error.message?.toLowerCase().includes("not found")) {
          setErrInput(error.message || "Could not send reset email. Please try again.");
          setLoading(false);
          return;
        }
      }

      // Always show success (avoids email enumeration)
      setSentTo(email);
      setStep("sent");
    } catch {
      setErrInput("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const roleConfig = ROLES.find((r) => r.id === role)!;

  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>

          {/* Back */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[layout.row, { gap: spacing[2], marginBottom: spacing[5] }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="ui-back" size="sm" color={colors.text.secondary} />
            <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>Back to sign in</Text>
          </TouchableOpacity>

          {/* Institution banner */}
          {tenant && (
            <View style={[styles.schoolBanner, { backgroundColor: brand.blue }]}>
              <View style={styles.schoolLogo}>
                {tenant.logo_url ? (
                  <Image source={{ uri: tenant.logo_url }} style={{ width: "100%", height: "100%", borderRadius: radius.md }} resizeMode="cover" />
                ) : (
                  <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.sm, color: "#fff" }}>
                    {(tenant.name || slug || "G").slice(0, 2).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={layout.fill}>
                <Text style={{ fontWeight: fontWeight.extrabold, color: "#fff", fontSize: fontSize.base }} numberOfLines={1}>
                  {tenant.name || `${slug}.gmis.app`}
                </Text>
                <Text style={{ fontSize: fontSize["2xs"], color: "rgba(255,255,255,0.55)" }}>
                  Password reset portal
                </Text>
              </View>
            </View>
          )}

          {step === "form" ? (
            <Card padding="none" style={styles.card}>
              {/* Title */}
              <View style={[layout.centredH, { marginBottom: spacing[5] }]}>
                <View style={[styles.iconCircle, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
                  <Icon name="auth-password" size="md" color={brand.blue} />
                </View>
                <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[3] }}>Reset password</Text>
                <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing[1] }}>
                  We'll send a reset link to your registered email address.
                </Text>
              </View>

              {/* Role selector */}
              <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[2] }}>I am a…</Text>
              <View style={[styles.rolePills, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => { setRole(r.id); setInput(""); setErrInput(""); }}
                    activeOpacity={0.8}
                    style={[
                      styles.rolePill,
                      role === r.id && { backgroundColor: brand.blue },
                    ]}
                  >
                    <Text style={{
                      fontSize:   fontSize.sm,
                      fontWeight: role === r.id ? fontWeight.bold : fontWeight.normal,
                      color:      role === r.id ? "#fff" : colors.text.secondary,
                    }}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Input */}
              <View style={{ marginTop: spacing[4] }}>
                <Input
                  label={role === "student" ? "Matric number or email" : "Email address"}
                  value={input}
                  onChangeText={(v) => { setInput(v); setErrInput(""); }}
                  onSubmitEditing={handleReset}
                  placeholder={
                    role === "student"
                      ? "e.g. 24EF021030058 or email"
                      : "your@email.com"
                  }
                  autoCapitalize="none"
                  keyboardType={role === "student" ? "default" : "email-address"}
                  iconLeft={role === "student" ? "user-student" : "nav-chat"}
                  error={errInput}
                />
              </View>

              {/* Info note */}
              <View style={[styles.infoNote, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
                <Icon name="status-info" size="sm" color={colors.status.info} />
                <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                  {role === "student"
                    ? "A reset link will be sent to the email address registered with your student profile."
                    : "Check your inbox (and spam folder) after submitting."}
                </Text>
              </View>

              {/* Submit */}
              <Button
                label={loading ? "Sending..." : "Send reset link"}
                variant="primary"
                size="lg"
                full
                loading={loading}
                onPress={handleReset}
                style={{ marginTop: spacing[4] }}
              />
            </Card>
          ) : (
            /* ── Sent state ─────────────────────────── */
            <Card padding="none" style={styles.card}>
              <View style={layout.centredH}>
                <View style={[styles.iconCircle, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
                  <Icon name="status-success" size="lg" color={colors.status.success} />
                </View>
                <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[4] }}>
                  Check your email
                </Text>
                <Text variant="caption" color="secondary" align="center" style={{ marginTop: spacing[2], marginBottom: spacing[4] }}>
                  We sent a password reset link to
                </Text>
                <View style={[styles.emailPill, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
                  <Icon name="nav-chat" size="sm" color={colors.text.secondary} />
                  <Text style={{ fontSize: fontSize.sm, color: colors.text.primary, fontWeight: fontWeight.semibold, marginLeft: spacing[2] }}>
                    {sentTo}
                  </Text>
                </View>

                <View style={[styles.infoNote, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder, marginTop: spacing[4], width: "100%" }]}>
                  <Icon name="status-info" size="sm" color={colors.status.info} />
                  <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                    The link expires in 1 hour. If you don't see the email, check your spam folder.
                  </Text>
                </View>

                <Button
                  label="Back to sign in"
                  variant="secondary"
                  size="md"
                  full
                  onPress={() => router.back()}
                  style={{ marginTop: spacing[5] }}
                />

                <TouchableOpacity
                  onPress={() => { setStep("form"); setInput(""); setSentTo(""); }}
                  style={{ marginTop: spacing[3] }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: fontSize.sm, color: colors.text.link }}>
                    Try a different email
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* GMIS footer */}
          <View style={{ alignItems: "center", marginTop: spacing[6], gap: spacing[2] }}>
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
    justifyContent:    "center",
  },
  inner: {
    width:    "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  schoolBanner: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    marginBottom:      spacing[3],
    borderRadius:      radius.xl,
  },
  schoolLogo: {
    width:           sizes.brandIconSize + spacing[1],
    height:          sizes.brandIconSize + spacing[1],
    borderRadius:    radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
    overflow:        "hidden",
  },
  card: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[6],
  },
  iconCircle: {
    width:           64,
    height:          64,
    borderRadius:    32,
    borderWidth:     1,
    alignItems:      "center",
    justifyContent:  "center",
  },
  rolePills: {
    flexDirection:  "row",
    borderRadius:   radius.lg,
    borderWidth:    1,
    padding:        spacing[1],
    gap:            spacing[1],
    flexWrap:       "wrap",
  },
  rolePill: {
    flex:            1,
    minWidth:        60,
    alignItems:      "center",
    paddingVertical: spacing[2],
    borderRadius:    radius.md,
  },
  infoNote: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginTop:         spacing[3],
  },
  emailPill: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.full,
    borderWidth:       1,
  },
});
