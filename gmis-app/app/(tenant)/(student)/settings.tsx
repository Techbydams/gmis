// ============================================================
// GMIS — Student Settings
// Route: /(tenant)/(student)/settings
// Tabs: Profile, Security, Appearance, Account
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { useTheme }  from "@/context/ThemeContext";
import { getTenantClient } from "@/lib/supabase";
import { isValidPassword } from "@/lib/helpers";
import { Text, Card, Input, Button, Avatar, Badge, Spinner } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type Tab = "profile" | "security" | "appearance" | "account";

interface StudentProfile {
  id: string; first_name: string; last_name: string;
  phone: string; matric_number: string; level: string;
  departments?: { name: string };
}

export default function Settings() {
  const router               = useRouter();
  const { user, signOut }    = useAuth();
  const { tenant, slug }     = useTenant();
  const { colors, isDark, toggleTheme } = useTheme();
  const { pagePadding }      = useResponsive();

  const [tab,      setTab]      = useState<Tab>("profile");
  const [profile,  setProfile]  = useState<StudentProfile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState<{ msg: string; type: "error"|"success" } | null>(null);

  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [phone,     setPhone]     = useState("");

  // Security fields
  const [newPass,   setNewPass]   = useState("");
  const [confPass,  setConfPass]  = useState("");
  const [passErr,   setPassErr]   = useState("");

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const showToast = (msg: string, type: "error"|"success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    if (!db || !user) return;
    try {
      const { data: s } = await db.from("students").select("id, first_name, last_name, phone, matric_number, level, departments(name)").eq("supabase_uid", user.id).maybeSingle();
      if (s) {
        const p = s as StudentProfile;
        setProfile(p);
        setFirstName(p.first_name || "");
        setLastName(p.last_name || "");
        setPhone(p.phone || "");
      }
    } finally { setLoading(false); }
  };

  const saveProfile = async () => {
    if (!db || !profile) return;
    setSaving(true);
    try {
      const { error } = await db.from("students").update({ first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() } as any).eq("id", profile.id);
      if (error) showToast("Could not save changes.");
      else showToast("Profile updated!", "success");
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    setPassErr("");
    if (!isValidPassword(newPass)) { setPassErr("Password must be at least 8 characters"); return; }
    if (newPass !== confPass) { setPassErr("Passwords do not match"); return; }
    if (!db) return;
    setSaving(true);
    try {
      const { error } = await db.auth.updateUser({ password: newPass });
      if (error) showToast("Could not update password.");
      else { showToast("Password updated!", "success"); setNewPass(""); setConfPass(""); }
    } finally { setSaving(false); }
  };

  const TABS: { id: Tab; label: string; icon: "user-account"|"auth-password"|"ui-theme"|"nav-settings" }[] = [
    { id: "profile",    label: "Profile",    icon: "user-account"  },
    { id: "security",   label: "Security",   icon: "auth-password" },
    { id: "appearance", label: "Appearance", icon: "ui-theme"      },
    { id: "account",    label: "Account",    icon: "nav-settings"  },
  ];

  const shellUser = { name: `${firstName} ${lastName}`.trim() || user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Settings" showBack onLogout={async () => signOut()}>
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
          <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

      <ScrollView style={[layout.fill, { backgroundColor: colors.bg.primary }]} contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}>
        <Text variant="heading" color="primary">Settings</Text>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[layout.row, { gap: spacing[2] }]}>
            {TABS.map(({ id, label, icon }) => (
              <TouchableOpacity key={id} onPress={() => setTab(id)} activeOpacity={0.75}
                style={[styles.tabBtn, { backgroundColor: tab === id ? brand.blue : colors.bg.hover, borderColor: tab === id ? brand.blue : colors.border.DEFAULT }]}>
                <Icon name={icon} size="sm" color={tab === id ? "#fff" : colors.text.secondary} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: tab === id ? fontWeight.bold : fontWeight.normal, color: tab === id ? "#fff" : colors.text.secondary, marginLeft: spacing[1] }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {loading ? <View style={[layout.centred, { paddingVertical: spacing[10] }]}><Spinner size="lg" /></View> : (

          <>
            {/* Profile tab */}
            {tab === "profile" && (
              <Card>
                <View style={[layout.centredH, { marginBottom: spacing[5] }]}>
                  <Avatar name={`${firstName} ${lastName}`} size="xl" role="student" />
                  <Text variant="title" color="primary" style={{ marginTop: spacing[3] }}>{firstName} {lastName}</Text>
                  <Text variant="mono" color="muted">{profile?.matric_number}</Text>
                  <Badge label={(profile as any)?.departments?.name || "Student"} variant="blue" size="sm" style={{ marginTop: spacing[2] }} />
                </View>
                <View style={[layout.row, { gap: spacing[3], alignItems: "flex-start" }]}>
                  <View style={layout.fill}><Input label="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" /></View>
                  <View style={layout.fill}><Input label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" /></View>
                </View>
                <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboardType="phone-pad" iconLeft="nav-chat" />
                <Button label={saving ? "Saving..." : "Save changes"} variant="primary" size="md" full loading={saving} onPress={saveProfile} />
              </Card>
            )}

            {/* Security tab */}
            {tab === "security" && (
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Change password</Text>
                <Input label="New password" value={newPass} onChangeText={setNewPass} placeholder="Min. 8 characters" secureTextEntry iconLeft="auth-password" />
                <Input label="Confirm new password" value={confPass} onChangeText={setConfPass} placeholder="Repeat password" secureTextEntry iconLeft="auth-password" error={passErr} />
                <Button label={saving ? "Updating..." : "Update password"} variant="primary" size="md" full loading={saving} onPress={changePassword} />
              </Card>
            )}

            {/* Appearance tab */}
            {tab === "appearance" && (
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Theme</Text>
                <TouchableOpacity onPress={toggleTheme} activeOpacity={0.75}
                  style={[layout.rowBetween, styles.themeRow, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
                  <View style={[layout.row, { gap: spacing[3] }]}>
                    <Icon name={isDark ? "ui-moon" : "ui-sun"} size="lg" color={isDark ? brand.blue : brand.gold} />
                    <View>
                      <Text variant="label" weight="semibold" color="primary">{isDark ? "Dark mode" : "Light mode"}</Text>
                      <Text variant="caption" color="muted">Tap to switch themes</Text>
                    </View>
                  </View>
                  <Badge label={isDark ? "Dark" : "Light"} variant={isDark ? "blue" : "amber"} />
                </TouchableOpacity>
              </Card>
            )}

            {/* Account tab */}
            {tab === "account" && (
              <View style={{ gap: spacing[4] }}>
                <Card>
                  <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Account info</Text>
                  {[["Email", user?.email || "—"], ["Matric number", profile?.matric_number || "—"], ["Level", profile?.level ? `${profile.level} Level` : "—"], ["School", tenant?.name || "—"]].map(([label, value]) => (
                    <View key={label} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
                      <Text variant="caption" color="muted">{label}</Text>
                      <Text variant="label" color="primary">{value}</Text>
                    </View>
                  ))}
                </Card>
                <Card variant="error">
                  <Text variant="label" weight="bold" color="error" style={{ marginBottom: spacing[2] }}>Danger zone</Text>
                  <Text variant="caption" color="secondary" style={{ marginBottom: spacing[4] }}>Sign out of your account on this device.</Text>
                  <Button label="Sign out" variant="danger" size="md" iconLeft="auth-logout" onPress={async () => { await signOut(); router.replace("/(tenant)/login"); }} />
                </Card>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  toast:    { position: "absolute", top: spacing[12], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  tabBtn:   { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1 },
  themeRow: { padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
});
