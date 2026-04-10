// ============================================================
// GMIS — Student Payments
// Route: /(tenant)/(student)/payments
// Paystack web integration. Native = WebView (coming in APK build)
// Tables: fee_structure, student_payments, org_settings
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Platform } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatNaira, formatDate } from "@/lib/helpers";
import { Text, Card, Badge, Button, Spinner, StatCard } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface FeeItem {
  id: string; amount: number; session: string; is_active: boolean;
  paystack_subaccount?: string;
  fee_types: { id: string; name: string; description: string };
}
interface Payment {
  id: string; amount: number; status: string; reference: string;
  paid_at: string | null; created_at: string; fee_type_id: string;
  fee_types: { name: string };
}

export default function StudentPayments() {
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [studentId,   setStudentId]   = useState<string|null>(null);
  const [feeItems,    setFeeItems]    = useState<FeeItem[]>([]);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [paystackKey, setPaystackKey] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [paying,      setPaying]      = useState<string|null>(null);
  const [totals,      setTotals]      = useState({ total: 0, paid: 0, outstanding: 0 });
  const [toast,       setToast]       = useState<{ msg: string; type: "error"|"success" } | null>(null);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) loadAll(); }, [db, user]);

  const showToast = (msg: string, type: "error"|"success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: cfg } = await db.from("org_settings").select("paystack_public_key").maybeSingle();
      if ((cfg as any)?.paystack_public_key) setPaystackKey((cfg as any).paystack_public_key);

      const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
      if (!s) { setLoading(false); return; }
      setStudentId((s as any).id);

      const [feesRes, paidRes] = await Promise.all([
        db.from("fee_structure").select("*, fee_types(id, name, description)").eq("is_active", true),
        db.from("student_payments").select("*, fee_types(name)").eq("student_id", (s as any).id).order("created_at", { ascending: false }),
      ]);

      const fees = (feesRes.data || []) as FeeItem[];
      const paid = (paidRes.data || []) as Payment[];
      setFeeItems(fees);
      setPayments(paid);

      const totalAmt = fees.reduce((a, f) => a + f.amount, 0);
      const paidAmt  = paid.filter((p) => p.status === "success").reduce((a, p) => a + p.amount, 0);
      setTotals({ total: totalAmt, paid: paidAmt, outstanding: totalAmt - paidAmt });
    } finally { setLoading(false); setRefreshing(false); }
  };

  const isPaid = (feeTypeId: string) => payments.some((p) => p.status === "success" && p.fee_type_id === feeTypeId);

  // Web-only Paystack integration
  const pay = async (fee: FeeItem) => {
    if (Platform.OS !== "web") {
      showToast("Online payment via the app is coming soon. Please use the web portal to pay.");
      return;
    }
    if (!paystackKey) { showToast("Payment gateway not configured. Contact your admin."); return; }
    if (!studentId || !user) return;
    setPaying(fee.fee_types.id);

    const ref = `GMIS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await db!.from("student_payments").insert({ student_id: studentId, fee_type_id: fee.fee_types.id, amount: fee.amount, reference: ref, status: "pending", session: fee.session } as any);

    const loadPaystack = (cb: () => void) => {
      const existing = document.getElementById("paystack-script");
      if (existing) { cb(); return; }
      const s = document.createElement("script");
      s.id = "paystack-script"; s.src = "https://js.paystack.co/v1/inline.js";
      s.onload = cb; document.head.appendChild(s);
    };

    loadPaystack(() => {
      // @ts-ignore
      const handler = window.PaystackPop.setup({
        key: paystackKey, email: user!.email, amount: fee.amount * 100, ref, currency: "NGN",
        label: `${fee.fee_types.name} — ${tenant?.name}`,
        metadata: { custom_fields: [{ display_name: "Student ID", variable_name: "student_id", value: studentId }, { display_name: "Institution", variable_name: "school", value: tenant?.name }] },
        ...(fee.paystack_subaccount ? { subaccount: fee.paystack_subaccount } : {}),
        callback: async (res: { reference: string }) => {
          await db!.from("student_payments").update({ status: "success", paystack_ref: res.reference, paid_at: new Date().toISOString() } as any).eq("reference", ref);
          showToast(`${formatNaira(fee.amount)} payment successful!`, "success");
          setPaying(null); loadAll(true);
        },
        onClose: async () => {
          await db!.from("student_payments").update({ status: "failed" } as any).eq("reference", ref);
          showToast("Payment cancelled.");
          setPaying(null);
        },
      });
      handler.openIframe();
    });
  };

  const SC: Record<string, "green"|"amber"|"red"> = { success: "green", pending: "amber", failed: "red" };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Payments" onLogout={async () => signOut()}>
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
          <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">Fee Payments</Text>
          <Text variant="caption" color="muted">Secured by Paystack · Payments go directly to {tenant?.name}</Text>
        </View>

        {/* Summary stats */}
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          <StatCard icon="nav-payments" label="Total fees"   value={formatNaira(totals.total)}       color="primary" />
          <StatCard icon="status-success" label="Amount paid" value={formatNaira(totals.paid)}        color="success" />
          <StatCard icon="status-warning" label="Outstanding" value={formatNaira(totals.outstanding)} color={totals.outstanding > 0 ? "error" : "success"} />
        </View>

        {/* Paystack not configured warning */}
        {!paystackKey && !loading && (
          <Card variant="warning">
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="status-warning" size="md" color={colors.status.warning} />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.warning, lineHeight: 20 }}>
                Your school admin has not configured the payment gateway yet. Contact your registrar to enable online payments.
              </Text>
            </View>
          </Card>
        )}

        {/* Mobile notice */}
        {Platform.OS !== "web" && paystackKey && (
          <Card variant="info">
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="status-info" size="md" color={colors.status.info} filled />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.info, lineHeight: 20 }}>
                To make payments, please use the GMIS web portal at {slug}.gmis.app. In-app payment is coming in the next update.
              </Text>
            </View>
          </Card>
        )}

        {/* Fee structure */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[10] }]}><Spinner size="lg" /></View>
        ) : (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>
              Fee structure — {new Date().getFullYear()}/{new Date().getFullYear() + 1}
            </Text>
            {feeItems.length === 0 ? (
              <Text variant="caption" color="muted" align="center">No fee items configured yet. Check back later.</Text>
            ) : (
              feeItems.map((fee) => {
                const paid = isPaid(fee.fee_types?.id);
                const busy = paying === fee.fee_types?.id;
                return (
                  <View key={fee.id} style={[styles.feeRow, { borderBottomColor: colors.border.subtle }]}>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{fee.fee_types?.name}</Text>
                      {fee.fee_types?.description && <Text variant="caption" color="muted">{fee.fee_types.description}</Text>}
                    </View>
                    <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary, marginRight: spacing[3] }}>
                      {formatNaira(fee.amount)}
                    </Text>
                    {paid ? (
                      <Badge label="Paid" variant="green" dot />
                    ) : (
                      <Button label={busy ? "..." : "Pay now"} variant="primary" size="sm" loading={busy} disabled={!paystackKey} onPress={() => pay(fee)} />
                    )}
                  </View>
                );
              })
            )}
          </Card>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Payment history</Text>
            {payments.map((p) => (
              <View key={p.id} style={[styles.histRow, { borderBottomColor: colors.border.subtle }]}>
                <View style={layout.fill}>
                  <Text variant="label" color="primary">{p.fee_types?.name || "—"}</Text>
                  <Text variant="mono" color="muted">{p.reference}</Text>
                </View>
                <View style={{ alignItems: "flex-end" as any }}>
                  <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>{formatNaira(p.amount)}</Text>
                  <Badge label={p.status} variant={SC[p.status] || "gray"} size="sm" />
                </View>
              </View>
            ))}
          </Card>
        )}

        <Text variant="micro" color="muted" align="center">
          GMIS takes zero cut from student payments. All transactions go directly to {tenant?.name}.
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  toast:   { position: "absolute", top: spacing[12], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  feeRow:  { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], borderBottomWidth: 1 },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], borderBottomWidth: 1 },
});
