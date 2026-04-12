/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { timeAgo }         from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function AdminNotifications() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [notifs,     setNotifs]     = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    const { data } = await db
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (data) setNotifs(data as any[]);
    setLoading(false);
    setRefreshing(false);
  };

  const deleteNotif = async (id: string) => {
    if (!db) return;
    await db.from("notifications").delete().eq("id", id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const typeColor = (type: string | null) =>
    type === "result"  ? colors.status.success :
    type === "payment" ? colors.status.warning :
    type === "alert"   ? colors.status.error   :
    colors.status.info;

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Notifications"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <View style={layout.rowBetween}>
          <Text variant="heading" color="primary">Notifications</Text>
          <Badge label={`${notifs.length} total`} variant="blue" />
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading..." /></View>
        ) : notifs.length === 0 ? (
          <EmptyState icon="ui-bell" title="No notifications" description="Notifications sent to students appear here." />
        ) : (
          notifs.map((n) => (
            <View key={n.id} style={[styles.row, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
              <View style={[styles.dot, { backgroundColor: typeColor(n.type) }]} />
              <View style={layout.fill}>
                <Text variant="label" weight="semibold" color="primary">{n.title}</Text>
                <Text variant="caption" color="secondary">{n.message}</Text>
                <Text variant="micro" color="muted" style={{ marginTop: spacing[1] }}>{timeAgo(n.created_at)}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteNotif(n.id)} activeOpacity={0.7}
                style={{ padding: spacing[2] }}>
                <Icon name="ui-close" size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  dot: { width: spacing[2], height: spacing[2], borderRadius: 999, marginTop: spacing[1] + 2, flexShrink: 0 },
});
