/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Switch, Image, Alert, ActivityIndicator, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Icon }            from "@/components/ui/Icon";
import { Spinner }         from "@/components/ui/Spinner";
import { useToast }        from "@/components/ui/Toast";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";
import { getInitials }     from "@/lib/helpers";
import { useAutoLoad }     from "@/lib/useAutoLoad";

interface FeatureToggle { id: string; feature_key: string; is_enabled: boolean; }

export default function AdminSettings() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors, isDark, toggleTheme } = useTheme();
  const { pagePadding }    = useResponsive();

  const { showToast }     = useToast();
  const [features,        setFeatures]        = useState<FeatureToggle[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [adminRecord,     setAdminRecord]      = useState<any>(null);
  const [uploadingPic,    setUploadingPic]     = useState(false);
  const [paystackKey,     setPaystackKey]      = useState("");
  const [paystackSaving,  setPaystackSaving]   = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: !!adminRecord });

  const load = async () => {
    if (!db || !user) return;
    const [featRes, adminRes, settingsRes] = await Promise.all([
      db.from("org_feature_toggles").select("id, feature_key:features(key), is_enabled").limit(20),
      db.from("admin_users").select("id, full_name, email, role, profile_picture_url").eq("supabase_uid", user.id).maybeSingle(),
      db.from("org_settings").select("paystack_public_key").maybeSingle(),
    ]);
    if (featRes.data) setFeatures((featRes.data as any[]).map((d) => ({ id: d.id, feature_key: d.feature_key?.key || d.feature_key, is_enabled: d.is_enabled })));
    if (adminRes.data) setAdminRecord(adminRes.data);
    if (settingsRes.data) setPaystackKey((settingsRes.data as any)?.paystack_public_key || "");
    setLoading(false);
  };

  const savePaystackKey = async () => {
    if (!db) return;
    setPaystackSaving(true);
    try {
      const { error } = await db.from("org_settings")
        .update({ paystack_public_key: paystackKey.trim() } as any)
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      showToast({ message: "Paystack key saved.", variant: "success" });
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to save key.", variant: "error" });
    } finally { setPaystackSaving(false); }
  };

  const pickAndUploadProfilePicture = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo library access to upload a profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    if (!db || !adminRecord) return;
    setUploadingPic(true);
    try {
      const uri = result.assets[0].uri;
      const filename = `profiles/admins/${slug}/${adminRecord.id}.jpg`;
      const response = await fetch(uri);
      const blob     = await response.blob();
      const { error: upErr } = await (db as any).storage.from("avatars").upload(filename, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = (db as any).storage.from("avatars").getPublicUrl(filename);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not get public URL");
      await db.from("admin_users").update({ profile_picture_url: publicUrl } as any).eq("id", adminRecord.id);
      setAdminRecord((prev: any) => ({ ...prev, profile_picture_url: publicUrl }));
      showToast({ message: "Profile picture updated!", variant: "success" });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Please ensure the 'avatars' storage bucket exists.");
    } finally { setUploadingPic(false); }
  };

  const toggleFeature = async (id: string, enabled: boolean) => {
    if (!db) return;
    await db.from("org_feature_toggles").update({ is_enabled: enabled } as any).eq("id", id);
    setFeatures((prev) => prev.map((f) => f.id === id ? { ...f, is_enabled: enabled } : f));
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const SETTING_SECTIONS = [
    {
      title: "Appearance",
      items: [
        { label: "Dark mode", description: "Toggle dark/light theme", right: <Switch value={isDark} onValueChange={toggleTheme} trackColor={{ false: colors.border.DEFAULT, true: brand.blue }} thumbColor="#fff" /> },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "Sign out", description: "Sign out of admin portal", icon: "auth-logout" as const, danger: true, onPress: async () => { await signOut(); router.replace("/login"); } },
      ],
    },
  ];

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Settings"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">Settings</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>{tenant?.name}</Text>

        {/* Admin profile + picture */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>My Profile</Text>
          <View style={[layout.row, { gap: spacing[4], alignItems: "center" }]}>
            <TouchableOpacity onPress={pickAndUploadProfilePicture} activeOpacity={0.8} disabled={uploadingPic}>
              {uploadingPic ? (
                <View style={[styles.avatarLg, { backgroundColor: colors.bg.hover, alignItems: "center", justifyContent: "center" }]}>
                  <ActivityIndicator color={brand.blue} />
                </View>
              ) : adminRecord?.profile_picture_url ? (
                <Image source={{ uri: adminRecord.profile_picture_url }} style={styles.avatarLg} />
              ) : (
                <View style={[styles.avatarLg, { backgroundColor: brand.goldAlpha15, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: brand.gold }}>
                    {getInitials(adminRecord?.full_name || "A")}
                  </Text>
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: brand.blue }]}>
                <Icon name="action-camera" size="xs" color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={layout.fill}>
              <Text variant="label" weight="bold" color="primary">{adminRecord?.full_name || "Admin"}</Text>
              <Text variant="micro" color="muted">{adminRecord?.email || user?.email}</Text>
              <Text variant="micro" color="link" style={{ marginTop: spacing[1] }}>Tap photo to change</Text>
            </View>
          </View>
        </Card>

        {/* School info */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>School Information</Text>
          {[
            { label: "School name",  value: tenant?.name || "—" },
            { label: "Slug",         value: slug || "—" },
            { label: "Supabase URL", value: tenant?.supabase_url?.substring(0, 40) + "..." || "—" },
          ].map((row, i) => (
            <View key={row.label} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
              <Text variant="caption" color="muted">{row.label}</Text>
              <Text variant="caption" color="primary" weight="medium">{row.value}</Text>
            </View>
          ))}
        </Card>

        {/* Payment Gateway */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>Payment Gateway</Text>
          <Text variant="micro" color="muted" style={{ marginBottom: spacing[3] }}>
            Enter your Paystack public key to enable online fee payments for students.
          </Text>
          <View style={[layout.row, { gap: spacing[2], alignItems: "center", marginBottom: spacing[3] }]}>
            <View style={[styles.gatewayBadge, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha20 }]}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: brand.blue }}>PS</Text>
            </View>
            <Text variant="label" color="primary" weight="semibold">Paystack</Text>
            {paystackKey ? (
              <View style={{ marginLeft: "auto" }}>
                <View style={[styles.connectedBadge, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}>
                  <View style={[styles.connectedDot, { backgroundColor: colors.status.success }]} />
                  <Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.semibold }}>Connected</Text>
                </View>
              </View>
            ) : null}
          </View>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={paystackKey}
            onChangeText={setPaystackKey}
            placeholder="pk_live_... or pk_test_..."
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={false}
          />
          <Text variant="micro" color="muted" style={{ marginBottom: spacing[3] }}>
            Get your public key from paystack.com → Settings → API Keys. Never enter your secret key here.
          </Text>
          <TouchableOpacity
            onPress={savePaystackKey}
            disabled={paystackSaving}
            activeOpacity={0.75}
            style={[styles.saveKeyBtn, { backgroundColor: paystackSaving ? colors.bg.hover : brand.blue }]}
          >
            {paystackSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Save Key</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Feature toggles */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[6] }]}><Spinner size="sm" /></View>
        ) : features.length > 0 ? (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Feature Toggles</Text>
            {features.map((f, i) => (
              <View key={f.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: i < features.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                <Text variant="label" color="primary">{f.feature_key}</Text>
                <Switch
                  value={f.is_enabled}
                  onValueChange={(v) => toggleFeature(f.id, v)}
                  trackColor={{ false: colors.border.DEFAULT, true: brand.blue }}
                  thumbColor="#fff"
                />
              </View>
            ))}
          </Card>
        ) : null}

        {/* Settings sections */}
        {SETTING_SECTIONS.map((section) => (
          <Card key={section.title}>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>{section.title}</Text>
            {section.items.map((item: any, i) => (
              <TouchableOpacity
                key={item.label}
                onPress={item.onPress}
                activeOpacity={item.onPress ? 0.75 : 1}
                style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: i < section.items.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}
              >
                <View style={layout.fill}>
                  <Text variant="label" color={item.danger ? "error" : "primary"}>{item.label}</Text>
                  <Text variant="micro" color="muted">{item.description}</Text>
                </View>
                {item.right || (item.icon && <Icon name={item.icon} size="md" color={item.danger ? colors.status.error : colors.text.muted} />)}
              </TouchableOpacity>
            ))}
          </Card>
        ))}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  avatarLg:       { width: 72, height: 72, borderRadius: radius.full },
  editBadge:      { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  textInput:      { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] + spacing[1], fontSize: fontSize.sm, marginBottom: spacing[2] },
  saveKeyBtn:     { paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: "center" },
  gatewayBadge:   { width: 32, height: 32, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  connectedDot:   { width: 6, height: 6, borderRadius: 3 },
});
