// ============================================================
// GMIS — Parent Portal Dashboard
// Route: /(tenant)/(parent)/dashboard
// Parent sees all wards linked to their supabase_uid
// (students.parent_supabase_uid = auth user's id)
// Tables: students, results, student_payments, attendance_records
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatGPA, getHonourClass, formatNaira } from "@/lib/helpers";
import { Text, Card, Badge, Spinner } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Ward {
  id:            string;
  first_name:    string;
  last_name:     string;
  matric_number: string;
  level:         string;
  status:        string;
  gpa:           number;
  cgpa:          number;
  department_id: string | null;
  dept_name?:    string;
}

export default function ParentDashboard() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [wards,      setWards]      = useState<Ward[]>([]);
  const [activeWard, setActiveWard] = useState<Ward | null>(null);
  const [wardStats,  setWardStats]  = useState<Record<string, { paid: number; total: number; attendance: number }>>({});
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);

    try {
      // Find all wards linked to this parent via parent_supabase_uid
      const { data: wardsData } = await db
        .from("students")
        .select("id, first_name, last_name, matric_number, level, status, gpa, cgpa, department_id")
        .eq("parent_supabase_uid", user.id);

      if (!wardsData?.length) {
        setLoading(false);
        return;
      }

      // Fetch dept names for all wards
      const deptIds = [...new Set(wardsData.map((w: any) => w.department_id).filter(Boolean))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length) {
        const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
        (depts || []).forEach((d: any) => { deptMap[d.id] = d.name; });
      }

      const wardList: Ward[] = wardsData.map((w: any) => ({
        ...w,
        dept_name: w.department_id ? deptMap[w.department_id] || "" : "",
      }));

      setWards(wardList);
      setActiveWard(wardList[0]);

      // Load stats for each ward
      for (const ward of wardList) {
        const [paidRes, feeRes, attRes] = await Promise.allSettled([
          db.from("student_payments").select("*", { count: "exact", head: true }).eq("student_id", ward.id).eq("status", "success"),
          db.from("fee_structure").select("*", { count: "exact", head: true }).eq("is_active", true),
          db.from("attendance_records").select("status").eq("student_id", ward.id),
        ]);

        const paid  = paidRes.status === "fulfilled" ? (paidRes.value.count ?? 0) : 0;
        const total = feeRes.status  === "fulfilled" ? (feeRes.value.count  ?? 0) : 0;
        let attendance = 0;
        if (attRes.status === "fulfilled" && attRes.value.data) {
          const records = attRes.value.data as any[];
          if (records.length > 0) {
            attendance = Math.round((records.filter((r) => (r.status || "").toLowerCase() === "present").length / records.length) * 100);
          }
        }
        setWardStats((prev) => ({ ...prev, [ward.id]: { paid, total, attendance } }));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  if (loading) {
    return (
      <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Parent Portal">
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" label="Loading..." /></View>
      </AppShell>
    );
  }

  if (wards.length === 0) {
    return (
      <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Parent Portal">
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          <Icon name="user-parent" size="3xl" color={colors.text.muted} />
          <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>No wards found</Text>
          <Text variant="body" color="secondary" align="center" style={{ maxWidth: 320 }}>
            No students are linked to your account. Ask your ward to include your email during registration.
          </Text>
        </View>
      </AppShell>
    );
  }

  const ws = activeWard ? wardStats[activeWard.id] : null;

  return (
    <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Parent Portal"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Parent Dashboard</Text>
        <Text variant="caption" color="muted">{tenant?.name} · {wards.length} ward{wards.length > 1 ? "s" : ""} linked</Text>

        {/* Ward selector — if multiple wards */}
        {wards.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[layout.row, { gap: spacing[3] }]}>
              {wards.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => setActiveWard(w)}
                  activeOpacity={0.75}
                  style={[
                    styles.wardTab,
                    {
                      backgroundColor: activeWard?.id === w.id ? brand.blueAlpha15 : colors.bg.card,
                      borderColor:     activeWard?.id === w.id ? brand.blue : colors.border.DEFAULT,
                    },
                  ]}
                >
                  <Text style={{ fontSize: fontSize.sm, fontWeight: activeWard?.id === w.id ? fontWeight.bold : fontWeight.normal, color: activeWard?.id === w.id ? brand.blue : colors.text.secondary }}>
                    {w.first_name} {w.last_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Active ward info */}
        {activeWard && (
          <>
            <Card>
              <View style={[layout.row, { gap: spacing[3] }]}>
                <View style={[styles.wardAvatar, { backgroundColor: brand.blueAlpha15 }]}>
                  <Text style={{ fontSize: fontSize.xl, fontWeight: fontWeight.black, color: brand.blue }}>
                    {activeWard.first_name[0]}{activeWard.last_name[0]}
                  </Text>
                </View>
                <View style={layout.fill}>
                  <Text variant="subtitle" weight="bold" color="primary">{activeWard.first_name} {activeWard.last_name}</Text>
                  <Text variant="caption" color="muted">{activeWard.matric_number}</Text>
                  {activeWard.dept_name && <Text variant="caption" color="muted">{activeWard.dept_name} · {activeWard.level} Level</Text>}
                  <Badge
                    label={activeWard.status.charAt(0).toUpperCase() + activeWard.status.slice(1)}
                    variant={activeWard.status === "active" ? "green" : "amber"}
                    size="sm"
                    style={{ marginTop: spacing[1] }}
                  />
                </View>
              </View>
            </Card>

            {/* Ward stats */}
            <View style={[layout.rowWrap, { gap: spacing[3] }]}>
              <Card style={[layout.fill, { alignItems: "center", padding: spacing[4] }]}>
                <Text variant="micro" color="muted" style={{ textTransform: "uppercase", letterSpacing: 1 }}>GPA</Text>
                <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: brand.blue, marginTop: spacing[1] }}>
                  {formatGPA(activeWard.gpa)}
                </Text>
                <Text variant="micro" color="muted">{getHonourClass(activeWard.gpa)}</Text>
              </Card>
              <Card style={[layout.fill, { alignItems: "center", padding: spacing[4] }]}>
                <Text variant="micro" color="muted" style={{ textTransform: "uppercase", letterSpacing: 1 }}>Fees</Text>
                <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: ws?.paid === ws?.total && (ws?.total ?? 0) > 0 ? colors.status.success : colors.status.warning, marginTop: spacing[1] }}>
                  {ws ? `${ws.paid}/${ws.total}` : "—"}
                </Text>
                <Text variant="micro" color="muted">Items paid</Text>
              </Card>
              <Card style={[layout.fill, { alignItems: "center", padding: spacing[4] }]}>
                <Text variant="micro" color="muted" style={{ textTransform: "uppercase", letterSpacing: 1 }}>Attendance</Text>
                <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: (ws?.attendance ?? 0) >= 75 ? colors.status.success : colors.status.warning, marginTop: spacing[1] }}>
                  {ws?.attendance ? `${ws.attendance}%` : "—"}
                </Text>
                <Text variant="micro" color="muted">This semester</Text>
              </Card>
            </View>

            {/* Quick links */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>View details</Text>
              {[
                { label: "View results",     icon: "nav-results"    as const, path: `/(tenant)/(parent)/results?ward=${activeWard.id}`    },
                { label: "Payment history",  icon: "nav-payments"   as const, path: `/(tenant)/(parent)/payments?ward=${activeWard.id}`   },
                { label: "Attendance record",icon: "nav-attendance" as const, path: `/(tenant)/(parent)/attendance?ward=${activeWard.id}` },
                { label: "Academic calendar",icon: "nav-calendar"   as const, path: "/(tenant)/(parent)/calendar"                         },
              ].map(({ label, icon, path }) => (
                <TouchableOpacity
                  key={label}
                  onPress={() => router.push(path as any)}
                  activeOpacity={0.75}
                  style={[styles.linkRow, { borderBottomColor: colors.border.subtle }]}
                >
                  <Icon name={icon} size="md" color={colors.text.secondary} />
                  <Text variant="label" color="primary" style={layout.fill}>{label}</Text>
                  <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                </TouchableOpacity>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  wardTab:   { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  wardAvatar:{ width: spacing[14], height: spacing[14], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  linkRow:   { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: 1 },
});
