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
import { StatCard }        from "@/components/ui/StatCard";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function AdminResults() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [stats,      setStats]      = useState({ total: 0, published: 0, pending: 0 });
  const [courses,    setCourses]    = useState<any[]>([]);
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

    const [totalRes, pubRes, coursesRes] = await Promise.allSettled([
      db.from("results").select("*", { count: "exact", head: true }),
      db.from("results").select("*", { count: "exact", head: true }).eq("published", true),
      db.from("courses").select("id, course_code, course_name, level, semester").eq("is_active", true).order("course_code").limit(20),
    ]);

    const total     = totalRes.status === "fulfilled" ? (totalRes.value.count ?? 0) : 0;
    const published = pubRes.status   === "fulfilled" ? (pubRes.value.count   ?? 0) : 0;
    setStats({ total, published, pending: total - published });

    if (coursesRes.status === "fulfilled") setCourses(coursesRes.value.data || []);
    setLoading(false);
    setRefreshing(false);
  };

  const togglePublish = async (courseId: string, publish: boolean) => {
    if (!db) return;
    await db.from("results").update({ published: publish } as any).eq("course_id", courseId);
    load(true);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Results Management"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <Text variant="heading" color="primary">Results Management</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>Control result visibility per course</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
            <Spinner size="lg" label="Loading results data..." />
          </View>
        ) : (
          <>
            <View style={[layout.row, { gap: spacing[3] }]}>
              <StatCard icon="nav-results" label="Total results"   value={String(stats.total)}     color="brand" />
              <StatCard icon="ui-check"    label="Published"       value={String(stats.published)} color="success" />
            </View>
            <StatCard icon="status-pending" label="Pending release" value={String(stats.pending)} color={stats.pending > 0 ? "warning" : "success"} />

            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Results by course</Text>
              {courses.length === 0 ? (
                <Text variant="caption" color="muted" align="center" style={{ paddingVertical: spacing[4] }}>No courses found.</Text>
              ) : (
                courses.map((c, i) => (
                  <View key={c.id} style={[layout.rowBetween, styles.courseRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < courses.length - 1 ? 1 : 0 }]}>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{c.course_code}</Text>
                      <Text variant="micro" color="muted">{c.course_name} · {c.level} Level · {c.semester}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.75}
                      onPress={() => togglePublish(c.id, true)}
                      style={[styles.publishBtn, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}
                    >
                      <Icon name="ui-check" size="xs" color={colors.status.success} />
                      <Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.bold }}>Publish</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  courseRow:   { paddingVertical: spacing[3], gap: spacing[3] },
  publishBtn:  { flexDirection: "row", alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
});
