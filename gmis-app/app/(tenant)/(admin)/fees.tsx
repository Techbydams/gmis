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
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { formatNaira }     from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

interface FeeItem {
  id: string; name: string; amount: number; level: string | null;
  session: string | null; semester: string | null; is_active: boolean;
}

export default function AdminFees() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [fees,       setFees]       = useState<FeeItem[]>([]);
  const [stats,      setStats]      = useState({ totalCollected: 0, pendingPayments: 0 });
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

    const [feesRes, paidRes, pendingRes] = await Promise.allSettled([
      db.from("fee_structure").select("id, name, amount, level, session, semester, is_active").order("name"),
      db.from("student_payments").select("amount").eq("status", "success"),
      db.from("student_payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    if (feesRes.status === "fulfilled") setFees((feesRes.value.data || []) as FeeItem[]);
    const collected = paidRes.status === "fulfilled" ? (paidRes.value.data || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0) : 0;
    const pending   = pendingRes.status === "fulfilled" ? (pendingRes.value.count ?? 0) : 0;
    setStats({ totalCollected: collected, pendingPayments: pending });

    setLoading(false);
    setRefreshing(false);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Fee Structure"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <Text variant="heading" color="primary">Fee Structure</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading fees..." /></View>
        ) : (
          <>
            <View style={[layout.row, { gap: spacing[3] }]}>
              <StatCard icon="nav-payments" label="Total collected" value={formatNaira(stats.totalCollected)} color="success" />
              <StatCard icon="status-pending" label="Pending"       value={String(stats.pendingPayments)}     color={stats.pendingPayments > 0 ? "warning" : "success"} />
            </View>

            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Fee items ({fees.length})</Text>
              {fees.length === 0 ? (
                <EmptyState icon="nav-payments" title="No fee items" description="No fee structure has been set up yet." />
              ) : (
                fees.map((f, i) => (
                  <View key={f.id} style={[layout.rowBetween, styles.feeRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < fees.length - 1 ? 1 : 0 }]}>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{f.name}</Text>
                      <Text variant="micro" color="muted">
                        {f.level ? `${f.level} Level` : "All levels"}
                        {f.session ? ` · ${f.session}` : ""}
                        {f.semester ? ` · ${f.semester}` : ""}
                      </Text>
                    </View>
                    <View style={[layout.row, { gap: spacing[2] }]}>
                      <Text variant="label" weight="bold" color="primary">{formatNaira(f.amount)}</Text>
                      <Badge label={f.is_active ? "Active" : "Inactive"} variant={f.is_active ? "green" : "neutral"} size="sm" />
                    </View>
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
  feeRow: { paddingVertical: spacing[3], gap: spacing[3] },
});
