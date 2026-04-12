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
import { formatNaira, timeAgo } from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function AdminPaystack() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [payments,   setPayments]   = useState<any[]>([]);
  const [stats,      setStats]      = useState({ total: 0, success: 0, failed: 0, revenue: 0 });
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
      .from("student_payments")
      .select("id, amount, status, reference, created_at, students(first_name, last_name, matric_number)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      const list = data as any[];
      setPayments(list);
      const success = list.filter((p) => p.status === "success");
      const failed  = list.filter((p) => p.status === "failed").length;
      const revenue = success.reduce((sum, p) => sum + (p.amount || 0), 0);
      setStats({ total: list.length, success: success.length, failed, revenue });
    }
    setLoading(false);
    setRefreshing(false);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const statusVariant = (s: string) =>
    s === "success" ? "green" : s === "failed" ? "red" : "amber";

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Paystack Gateway"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <Text variant="heading" color="primary">Payment Gateway</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>All Paystack transactions</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading payments..." /></View>
        ) : (
          <>
            <StatCard icon="nav-payments" label="Total revenue"   value={formatNaira(stats.revenue)} color="success" />
            <View style={[layout.row, { gap: spacing[3] }]}>
              <StatCard icon="ui-check"       label="Successful" value={String(stats.success)} color="success" />
              <StatCard icon="status-error"   label="Failed"     value={String(stats.failed)}  color={stats.failed > 0 ? "error" : "success"} />
            </View>

            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Recent transactions</Text>
              {payments.length === 0 ? (
                <Text variant="caption" color="muted" align="center" style={{ paddingVertical: spacing[4] }}>No payments yet.</Text>
              ) : (
                payments.map((p, i) => {
                  const student = (p as any).students;
                  return (
                    <View key={p.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomColor: colors.border.subtle, borderBottomWidth: i < payments.length - 1 ? 1 : 0 }]}>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary">
                          {student ? `${student.first_name} ${student.last_name}` : "Unknown student"}
                        </Text>
                        <Text variant="micro" color="muted">
                          {student?.matric_number ? `${student.matric_number} · ` : ""}{p.reference}
                        </Text>
                        <Text variant="micro" color="muted">{timeAgo(p.created_at)}</Text>
                      </View>
                      <View style={[layout.col, { alignItems: "flex-end", gap: spacing[1] }]}>
                        <Text variant="label" weight="bold" color="primary">{formatNaira(p.amount)}</Text>
                        <Badge label={p.status} variant={statusVariant(p.status)} size="sm" />
                      </View>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({});
