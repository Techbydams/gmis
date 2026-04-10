/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Icon }            from "@/components/ui/Icon";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

interface FeatureToggle { id: string; feature_key: string; is_enabled: boolean; }

export default function AdminSettings() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors, isDark, toggleTheme } = useTheme();
  const { pagePadding }    = useResponsive();

  const [features,  setFeatures]  = useState<FeatureToggle[]>([]);
  const [loading,   setLoading]   = useState(true);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async () => {
    if (!db) return;
    const { data } = await db
      .from("org_feature_toggles")
      .select("id, feature_key:features(key), is_enabled")
      .limit(20);
    if (data) setFeatures((data as any[]).map((d) => ({ id: d.id, feature_key: d.feature_key?.key || d.feature_key, is_enabled: d.is_enabled })));
    setLoading(false);
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

const styles = StyleSheet.create({});
