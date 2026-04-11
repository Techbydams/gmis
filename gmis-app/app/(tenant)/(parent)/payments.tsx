// ============================================================
// GMIS — Parent: Ward's Payment Status
// Route: /(tenant)/(parent)/payments?ward=<student_id>
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatNaira }     from "@/lib/helpers";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

export default function ParentPayments() {
  const { ward }         = useLocalSearchParams<{ ward: string }>();
  const { user }         = useAuth();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [student,  setStudent]  = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [fees,     setFees]     = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && ward) load(); }, [db, ward]);

  const load = async () => {
    if (!db || !ward) return;

    const [sRes, pRes, fRes] = await Promise.allSettled([
      db.from("students").select("first_name, last_name, matric_number, level").eq("id", ward).maybeSingle(),
      db.from("student_payments").select("id, amount, status, payment_reference, paid_at, fee_structure(name, amount)")
        .eq("student_id", ward).order("paid_at", { ascending: false }),
      db.from("fee_structure").select("id, name, amount, is_active").eq("is_active", true),
    ]);

    if (sRes.status === "fulfilled" && sRes.value.data) setStudent(sRes.value.data);
    if (pRes.status === "fulfilled") setPayments(pRes.value.data || []);
    if (fRes.status === "fulfilled") setFees(fRes.value.data || []);
    setLoading(false);
  };

  const totalFees   = fees.reduce((a: number, f: any) => a + (f.amount || 0), 0);
  const paidAmount  = payments.filter((p) => p.status === "success").reduce((a: number, p: any) => a + (p.amount || 0), 0);
  const paidCount   = payments.filter((p) => p.status === "success").length;
  const allPaid     = fees.length > 0 && paidCount >= fees.length;

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  return (
    <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Fee Status"
      onLogout={async () => {}}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : (
          <>
            {/* Summary */}
            {student && (
              <Card>
                <Text variant="subtitle" weight="bold" color="primary">{student.first_name} {student.last_name}</Text>
                <Text variant="caption" color="muted">{student.matric_number} · {student.level} Level</Text>
                <View style={[layout.row, { gap: spacing[4], marginTop: spacing[3], flexWrap: "wrap" }]}>
                  <View>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.black, color: allPaid ? colors.status.success : colors.status.warning }}>
                      {formatNaira(paidAmount)}
                    </Text>
                    <Text variant="micro" color="muted">Paid</Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text.primary }}>
                      {formatNaira(totalFees)}
                    </Text>
                    <Text variant="micro" color="muted">Total fees</Text>
                  </View>
                  <View>
                    <Badge
                      label={allPaid ? "Fully Paid" : `${paidCount}/${fees.length} items`}
                      variant={allPaid ? "green" : "amber"}
                    />
                  </View>
                </View>
              </Card>
            )}

            {/* Fee items */}
            {fees.length > 0 && (
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Fee Items</Text>
                {fees.map((fee: any, i: number) => {
                  const paid = payments.some((p) => {
                    const feeStruct = p.fee_structure as any;
                    return feeStruct?.name === fee.name && p.status === "success";
                  });
                  return (
                    <View key={fee.id} style={[styles.feeRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < fees.length - 1 ? 1 : 0 }]}>
                      <View style={[styles.statusDot, { backgroundColor: paid ? colors.status.success : colors.border.DEFAULT }]}>
                        {paid && <Icon name="ui-check" size="xs" color="#fff" />}
                      </View>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary">{fee.name}</Text>
                        <Text variant="micro" color="muted">{formatNaira(fee.amount)}</Text>
                      </View>
                      <Badge label={paid ? "Paid" : "Unpaid"} variant={paid ? "green" : "red"} size="sm" />
                    </View>
                  );
                })}
              </Card>
            )}

            {/* Payment history */}
            {payments.length === 0 ? (
              <EmptyState icon="nav-payments" title="No payments yet" description="No payment records found for your ward." />
            ) : (
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Payment History</Text>
                {payments.map((p: any, i: number) => {
                  const isSuccess = p.status === "success";
                  return (
                    <View key={p.id} style={[styles.payRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < payments.length - 1 ? 1 : 0 }]}>
                      <View style={[styles.payIcon, { backgroundColor: isSuccess ? colors.status.successBg : colors.status.warningBg }]}>
                        <Icon name="nav-payments" size="sm" color={isSuccess ? colors.status.success : colors.status.warning} />
                      </View>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary">
                          {(p.fee_structure as any)?.name || "Payment"}
                        </Text>
                        <Text variant="micro" color="muted">
                          {p.payment_reference || ""}
                          {p.paid_at ? ` · ${new Date(p.paid_at).toLocaleDateString("en-GB")}` : ""}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: isSuccess ? colors.status.success : colors.text.secondary }}>
                          {formatNaira(p.amount)}
                        </Text>
                        <Badge label={p.status} variant={isSuccess ? "green" : "amber"} size="sm" />
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  feeRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  statusDot: { width: spacing[6], height: spacing[6], borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  payRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  payIcon: { width: spacing[10], height: spacing[10], borderRadius: radius.lg, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
