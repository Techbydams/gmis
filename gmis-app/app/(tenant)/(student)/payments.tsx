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
import { View, ScrollView, StyleSheet, RefreshControl, Platform } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatNaira, formatDate } from "@/lib/helpers";
import { Text, Card, Badge, Button, StatCard, SkeletonDashboard, useToast } from "@/components/ui";
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
  const { showToast } = useToast();

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) loadAll(); }, [db, user]);

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
      showToast({ message: "Online payment via the app is coming soon. Please use the web portal to pay.", variant: "info" });
      return;
    }
    if (!paystackKey) { showToast({ message: "Payment gateway not configured. Contact your admin.", variant: "warning" }); return; }
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
          showToast({ message: `${formatNaira(fee.amount)} payment successful!`, variant: "success" });
          setPaying(null); loadAll(true);
        },
        onClose: async () => {
          await db!.from("student_payments").update({ status: "failed" } as any).eq("reference", ref);
          showToast({ message: "Payment cancelled.", variant: "warning" });
          setPaying(null);
        },
      });
      handler.openIframe();
    });
  };

  const SC: Record<string, "green"|"amber"|"red"> = { success: "green", pending: "amber", failed: "red" };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  if (loading) {
    return (
      <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Payments">
        <SkeletonDashboard />
      </AppShell>
    );
  }

  // Payment progress (0–100%)
  const progress = totals.total > 0 ? Math.min(100, (totals.paid / totals.total) * 100) : 0;
  const hasOutstanding = totals.outstanding > 0;

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Payments" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={brand.blue} />}
      >

        {/* ── Outstanding balance hero ─────────────────────── */}
        {totals.total > 0 && (
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: hasOutstanding ? colors.status.errorBg  : colors.status.successBg,
                borderColor:     hasOutstanding ? colors.status.errorBorder : colors.status.successBorder,
              },
            ]}
          >
            {/* Left accent bar */}
            <View
              style={[
                styles.heroAccent,
                { backgroundColor: hasOutstanding ? colors.status.error : colors.status.success },
              ]}
            />
            <View style={[layout.fill, { paddingLeft: spacing[4] }]}>
              <Text style={{ fontSize: fontSize.sm, color: hasOutstanding ? colors.status.error : colors.status.success, fontWeight: fontWeight.semibold }}>
                {hasOutstanding ? "Outstanding balance" : "All fees cleared"}
              </Text>
              <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: colors.text.primary, marginTop: spacing[1] }}>
                {formatNaira(hasOutstanding ? totals.outstanding : totals.paid)}
              </Text>
              {/* Progress bar */}
              {totals.total > 0 && (
                <View style={[styles.progressTrack, { backgroundColor: colors.border.DEFAULT, marginTop: spacing[3] }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width:           `${progress}%` as any,
                        backgroundColor: hasOutstanding ? colors.status.success : colors.status.success,
                      },
                    ]}
                  />
                </View>
              )}
              <View style={[layout.rowBetween, { marginTop: spacing[1] }]}>
                <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted }}>
                  Paid {formatNaira(totals.paid)} of {formatNaira(totals.total)}
                </Text>
                <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, fontWeight: fontWeight.semibold }}>
                  {Math.round(progress)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Notices ──────────────────────────────────────── */}
        {!paystackKey && (
          <Card variant="warning">
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="status-warning" size="md" color={colors.status.warning} />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.warning, lineHeight: 20 }}>
                Payment gateway not configured. Contact your registrar.
              </Text>
            </View>
          </Card>
        )}
        {Platform.OS !== "web" && paystackKey && (
          <Card variant="info">
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="status-info" size="md" color={colors.status.info} />
              <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.info, lineHeight: 20 }}>
                Visit <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold }}>{slug}.gmis.app</Text> to pay online. In-app payments coming soon.
              </Text>
            </View>
          </Card>
        )}

        {/* ── Fee structure ─────────────────────────────────── */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>
            Fee structure — {new Date().getFullYear()}/{new Date().getFullYear() + 1}
          </Text>
          {feeItems.length === 0 ? (
            <Text variant="caption" color="muted" align="center">No fee items configured yet.</Text>
          ) : (
            feeItems.map((fee, idx) => {
              const paid = isPaid(fee.fee_types?.id);
              const busy = paying === fee.fee_types?.id;
              return (
                <View
                  key={fee.id}
                  style={[
                    styles.feeRow,
                    { borderBottomColor: colors.border.subtle },
                    idx === feeItems.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{fee.fee_types?.name}</Text>
                    {fee.fee_types?.description && (
                      <Text variant="caption" color="muted">{fee.fee_types.description}</Text>
                    )}
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

        {/* ── Payment history ───────────────────────────────── */}
        {payments.length > 0 && (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Payment history</Text>
            {payments.map((p, idx) => (
              <View
                key={p.id}
                style={[
                  styles.histRow,
                  { borderBottomColor: colors.border.subtle },
                  idx === payments.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={layout.fill}>
                  <Text variant="label" color="primary">{p.fee_types?.name || "—"}</Text>
                  <Text variant="mono" color="muted" style={{ fontSize: fontSize["2xs"] }}>{p.reference}</Text>
                </View>
                <View style={{ alignItems: "flex-end" as any }}>
                  <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>
                    {formatNaira(p.amount)}
                  </Text>
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
  heroCard: {
    flexDirection:    "row",
    borderRadius:     radius.xl,
    borderWidth:      1,
    paddingVertical:  spacing[4],
    paddingRight:     spacing[4],
    overflow:         "hidden",
  },
  heroAccent: {
    width: spacing[1],
    borderRadius: radius.xs,
  },
  progressTrack: {
    height:       spacing[1] + 2,
    borderRadius: radius.full,
    overflow:     "hidden",
  },
  progressFill: {
    height:       "100%",
    borderRadius: radius.full,
  },
  feeRow:  { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], borderBottomWidth: 1 },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3], borderBottomWidth: 1 },
});
