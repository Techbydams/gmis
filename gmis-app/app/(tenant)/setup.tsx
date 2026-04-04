// ============================================================
// GMIS — Account Setup
// Route: /(tenant)/setup?role=admin|lecturer|parent
//
// Three flows (identical logic to Vite version):
//  admin:    sign up → verify in admin_users → update supabase_uid
//  lecturer: find record by email → sign up → update supabase_uid
//  parent:   find students by parent_email → sign up → update parent_supabase_uid
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { isValidPassword } from "@/lib/helpers";
import {
  Text, Input, Button, Card, Spinner,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { useTheme } from "@/context/ThemeContext";
import {
  brand, spacing, radius, fontSize, fontWeight, sizes,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

type SetupRole = "admin" | "lecturer" | "parent";

const ROLE_CONFIG: Record<SetupRole, { title: string; subtitle: string; hint: string; icon: "user-admin" | "user-lecturer" | "user-parent" }> = {
  admin: {
    title:    "Set up your admin account",
    subtitle: "Set your password to activate your GMIS admin account.",
    hint:     "Once set up, sign in at the admin login page.",
    icon:     "user-admin",
  },
  lecturer: {
    title:    "Activate your lecturer account",
    subtitle: "Enter the email your admin registered for you, then set your password.",
    hint:     "Enter the exact email your admin used when adding you. You can correct your display name above.",
    icon:     "user-lecturer",
  },
  parent: {
    title:    "Set up your parent account",
    subtitle: "Enter the email you used during your child's registration, then set your password.",
    hint:     "Enter the exact email you provided during your child's school registration. Once set up, sign in at the login page.",
    icon:     "user-parent",
  },
};

export default function SetupAccount() {
  const router                         = useRouter();
  const { role: roleParam }            = useLocalSearchParams<{ role?: string }>();
  const { tenant, slug, loading: tenantLoading } = useTenant();
  const { colors }                     = useTheme();

  const role = (roleParam as SetupRole) || null;

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [fullName, setFullName] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errors,   setErrors]   = useState<Record<string, string>>({});
  const [toast,    setToast]    = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const showToast = (msg: string, type: "error" | "success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  // ── Validation ────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim())                   e.email    = "Email is required";
    if (!fullName.trim())                e.fullName = "Full name is required";
    if (!password)                       e.password = "Password is required";
    else if (!isValidPassword(password)) e.password = "Password must be at least 8 characters";
    if (password !== confirm)            e.confirm  = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Setup handler — mirrors Vite version exactly ──────
  const handleSetup = async () => {
    if (!validate() || !tenant) return;
    setLoading(true);

    const db         = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
    const cleanEmail = email.trim().toLowerCase();

    try {

      // ── LECTURER flow ──────────────────────────────
      if (role === "lecturer") {
        // Step 1: Check lecturer exists (admin must add them first)
        const { data: lecturer, error: lookupError } = await db
          .from("lecturers")
          .select("id, full_name, supabase_uid")
          .eq("email", cleanEmail)
          .eq("is_active", true)
          .maybeSingle();

        if (lookupError || !lecturer) {
          showToast("Your email is not registered as a lecturer. Ask your admin to add you first.");
          setLoading(false);
          return;
        }

        const lecAny = lecturer as any;
        if (lecAny.supabase_uid) {
          showToast("This lecturer account is already activated. Use the login page.");
          setLoading(false);
          return;
        }

        // Step 2: Create Supabase auth account
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    cleanEmail,
          password,
          options:  { data: { full_name: fullName.trim(), role: "lecturer" } },
        });

        if (signUpError) {
          showToast(signUpError.message);
          setLoading(false);
          return;
        }

        // Step 3: Link auth UID to lecturers table
        if (authData?.user?.id) {
          await db.from("lecturers").update({
            supabase_uid: authData.user.id,
            full_name:    fullName.trim(),
          } as any).eq("id", (lecturer as any).id);
        }

        showToast("Account activated! You can now sign in.", "success");
        setTimeout(() => router.replace("/(tenant)/login"), 1500);
        return;
      }

      // ── ADMIN flow ─────────────────────────────────
      if (role === "admin") {
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    cleanEmail,
          password,
          options:  { data: { full_name: fullName.trim(), role: "admin" } },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered")) {
            // Account exists — try signing in with the new password
            const { error: signInError } = await db.auth.signInWithPassword({
              email:    cleanEmail,
              password,
            });
            if (signInError) {
              showToast("Could not set up account. Please contact DAMS Tech support.");
              setLoading(false);
              return;
            }
          } else {
            showToast(signUpError.message);
            setLoading(false);
            return;
          }
        }

        // Verify email is in admin_users table
        const { data: adminRecord } = await db
          .from("admin_users")
          .select("id")
          .eq("email", cleanEmail)
          .maybeSingle();

        const adminAny = adminRecord as any;
        if (!adminAny) {
          showToast("Your email is not registered as an admin for this institution. Contact DAMS Tech.");
          await db.auth.signOut();
          setLoading(false);
          return;
        }

        // Update supabase_uid on admin_users
        const { data: { user } } = await db.auth.getUser();
        if (user) {
          await db.from("admin_users")
            .update({ supabase_uid: user.id } as any)
            .eq("id", (adminRecord as any).id);
        }

        showToast("Admin account activated!", "success");
        setTimeout(() => router.replace("/(tenant)/(admin)/dashboard"), 1500);
        return;
      }

      // ── PARENT flow ────────────────────────────────
      if (role === "parent") {
        // Step 1: Find active students linked to this parent email
        const { data: children, error: lookupErr } = await db
          .from("students")
          .select("id, first_name, last_name")
          .eq("parent_email", cleanEmail)
          .eq("status", "active");

        if (lookupErr || !children || children.length === 0) {
          showToast("No active students found with this parent email. Contact your child's school admin.");
          setLoading(false);
          return;
        }

        // Step 2: Create Supabase auth account
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    cleanEmail,
          password,
          options:  { data: { full_name: fullName.trim(), role: "parent" } },
        });

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes("already registered")) {
            showToast("An account with this email already exists. Please use the login page.");
          } else {
            showToast(signUpError.message);
          }
          setLoading(false);
          return;
        }

        // Step 3: Link parent_supabase_uid on all matching student records
        if (authData?.user?.id) {
          await db
            .from("students")
            .update({ parent_supabase_uid: authData.user.id } as any)
            .eq("parent_email", cleanEmail);
        }

        const childCount = children.length;
        const firstName  = (children[0] as any).first_name;
        showToast(
          `Account activated! You can monitor ${childCount > 1 ? `${childCount} children` : firstName}.`,
          "success"
        );
        setTimeout(() => router.replace("/(tenant)/login"), 1500);
        return;
      }

      // Unknown role
      showToast("Invalid setup link. Please contact your administrator.");

    } catch (err) {
      console.error("Setup error:", err);
      showToast("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Tenant loading ────────────────────────────────────
  if (tenantLoading) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
        <Spinner size="lg" label="Loading..." />
      </View>
    );
  }

  // ── Invalid role ──────────────────────────────────────
  if (!role || !["admin", "lecturer", "parent"].includes(role)) {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, paddingHorizontal: spacing[6] }]}>
        <Icon name="content-link" size="3xl" color={colors.text.muted} />
        <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          Invalid setup link
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ marginBottom: spacing[5], maxWidth: 320 }}>
          This setup link is invalid or has expired. Please contact your administrator.
        </Text>
        <Button label="← Back to login" variant="secondary" size="md" onPress={() => router.push("/(tenant)/login")} />
      </View>
    );
  }

  const config = ROLE_CONFIG[role];

  // ── Main render ───────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[layout.fill, { backgroundColor: colors.bg.primary }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Toast */}
      {toast && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg,
              borderColor:     toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder,
            },
          ]}
        >
          <Icon
            name={toast.type === "error" ? "status-error" : "status-success"}
            size="sm"
            color={toast.type === "error" ? colors.status.error : colors.status.success}
          />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>
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

          {/* School banner */}
          {tenant && (
            <View style={styles.schoolBanner}>
              <View style={styles.schoolLogo}>
                <Text style={{ fontWeight: fontWeight.black, fontSize: fontSize.sm, color: "#fff" }}>
                  {(tenant.name || slug || "G").slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={layout.fill}>
                <Text style={{ fontWeight: fontWeight.bold, color: "#fff", fontSize: fontSize.base }}>
                  {tenant.name}
                </Text>
                <Text style={{ fontSize: fontSize.xs, color: "rgba(255,255,255,0.5)" }}>
                  {slug}.gmis.app
                </Text>
              </View>
            </View>
          )}

          {/* Header */}
          <View style={[layout.centredH, { marginBottom: spacing[6] }]}>
            <View style={[styles.roleIcon, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
              <Icon name={config.icon} size="2xl" color={brand.blue} />
            </View>
            <Text variant="title" color="primary" align="center" style={{ marginBottom: spacing[2] }}>
              {config.title}
            </Text>
            <Text variant="body" color="secondary" align="center" style={{ maxWidth: 360 }}>
              {config.subtitle}
            </Text>
          </View>

          {/* Form card */}
          <Card padding="none" style={styles.card}>

            {/* Full name */}
            <Input
              label="Full name *"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Dr. Jane Smith"
              iconLeft="user-account"
              error={errors.fullName}
            />

            {/* Email */}
            <Input
              label="Email address *"
              value={email}
              onChangeText={setEmail}
              placeholder="you@institution.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              iconLeft="nav-chat"
              error={errors.email}
            />

            {/* Password */}
            <Input
              label="Create password *"
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              secureTextEntry={!showPass}
              autoComplete="new-password"
              iconLeft="auth-password"
              iconRight={showPass ? "auth-eye-off" : "auth-eye"}
              onPressRight={() => setShowPass((v) => !v)}
              error={errors.password}
            />

            {/* Confirm */}
            <Input
              label="Confirm password *"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              secureTextEntry={!showConf}
              autoComplete="new-password"
              iconLeft="auth-password"
              iconRight={showConf ? "auth-eye-off" : "auth-eye"}
              onPressRight={() => setShowConf((v) => !v)}
              error={errors.confirm}
            />

            {/* Info hint */}
            <View style={[styles.infoBanner, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
              <Icon name="status-info" size="sm" color={colors.status.info} filled />
              <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                {config.hint}
              </Text>
            </View>

            {/* Submit */}
            <Button
              label={loading ? "Activating..." : `Activate ${role} account`}
              variant="primary"
              size="lg"
              full
              loading={loading}
              onPress={handleSetup}
            />
          </Card>

          {/* Already set up */}
          <View style={[layout.row, { justifyContent: "center", marginTop: spacing[4] }]}>
            <Text variant="caption" color="muted">
              Already set up?{" "}
              <Text variant="caption" color="link" weight="bold" onPress={() => router.push("/(tenant)/login")}>
                Sign in →
              </Text>
            </Text>
          </View>

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
    maxWidth: 480,
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
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
    marginBottom:      spacing[5],
    borderRadius:      radius.xl,
    backgroundColor:   "#1a3a8f",
  },
  schoolLogo: {
    width:           sizes.brandIconSize,
    height:          sizes.brandIconSize,
    borderRadius:    radius.md,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems:      "center",
    justifyContent:  "center",
    flexShrink:      0,
  },
  roleIcon: {
    width:        sizes.iconCircle,     // 88
    height:       sizes.iconCircle,
    borderRadius: sizes.iconCircle / 2,
    alignItems:   "center",
    justifyContent: "center",
    borderWidth:  1,
    marginBottom: spacing[4],
  },
  card: {
    paddingHorizontal: spacing[6],
    paddingVertical:   spacing[6],
  },
  infoBanner: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.lg,
    borderWidth:       1,
    marginBottom:      spacing[5],
  },
});
