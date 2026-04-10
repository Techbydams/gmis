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

export default function AdminIDCards() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [students,   setStudents]   = useState<any[]>([]);
  const [stats,      setStats]      = useState({ printed: 0, unpaid: 0, total: 0 });
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
      .from("students")
      .select("id, first_name, last_name, matric_number, level, id_card_printed, id_card_paid")
      .eq("status", "active")
      .order("first_name");

    if (data) {
      setStudents(data as any[]);
      const printed = (data as any[]).filter((s) => s.id_card_printed).length;
      const unpaid  = (data as any[]).filter((s) => !s.id_card_paid).length;
      setStats({ printed, unpaid, total: data.length });
    }
    setLoading(false);
    setRefreshing(false);
  };

  const markPrinted = async (id: string) => {
    if (!db) return;
    await db.from("students").update({ id_card_printed: true } as any).eq("id", id);
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, id_card_printed: true } : s));
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="ID Cards"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <Text variant="heading" color="primary">ID Card Management</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading..." /></View>
        ) : (
          <>
            <View style={[layout.row, { gap: spacing[3] }]}>
              <StatCard icon="nav-idcards"  label="Printed"       value={String(stats.printed)}              color="success" />
              <StatCard icon="nav-payments" label="Unpaid"        value={String(stats.unpaid)}               color={stats.unpaid > 0 ? "warning" : "success"} />
            </View>
            <StatCard icon="user-student" label="Active students" value={String(stats.total)} color="brand" />

            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Students</Text>
              {students.map((s, i) => (
                <View key={s.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomColor: colors.border.subtle, borderBottomWidth: i < students.length - 1 ? 1 : 0 }]}>
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                    <Text variant="micro" color="muted">{s.matric_number} · {s.level} Level</Text>
                  </View>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    <Badge label={s.id_card_paid ? "Paid" : "Unpaid"} variant={s.id_card_paid ? "green" : "amber"} size="sm" />
                    {!s.id_card_printed ? (
                      <TouchableOpacity onPress={() => markPrinted(s.id)} activeOpacity={0.75}
                        style={[styles.btn, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
                        <Text style={{ fontSize: fontSize.xs, color: colors.status.info, fontWeight: fontWeight.bold }}>Mark printed</Text>
                      </TouchableOpacity>
                    ) : (
                      <Badge label="Printed" variant="green" size="sm" />
                    )}
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  btn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
});
