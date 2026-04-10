/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from "react-native";
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
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

interface PendingStudent {
  id: string; first_name: string; last_name: string;
  matric_number: string; email: string; level: string;
  gender: string | null; created_at: string;
  department_id: string | null; dept_name?: string;
}

export default function AdminApprovals() {
  const router              = useRouter();
  const { user, signOut }   = useAuth();
  const { tenant, slug }    = useTenant();
  const { colors }          = useTheme();
  const { pagePadding }     = useResponsive();

  const [students,   setStudents]   = useState<PendingStudent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting,     setActing]     = useState<string | null>(null);

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
      .select("id, first_name, last_name, matric_number, email, level, gender, created_at, department_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (data) {
      const deptIds = [...new Set((data as any[]).map((s) => s.department_id).filter(Boolean))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length) {
        const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
        (depts || []).forEach((d: any) => { deptMap[d.id] = d.name; });
      }
      setStudents((data as any[]).map((s) => ({ ...s, dept_name: s.department_id ? deptMap[s.department_id] || "" : "" })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const approve = async (id: string) => {
    if (!db) return;
    setActing(id);
    await db.from("students").update({ status: "active" } as any).eq("id", id);
    setStudents((p) => p.filter((s) => s.id !== id));
    setActing(null);
  };

  const reject = async (id: string) => {
    if (!db) return;
    setActing(id);
    await db.from("students").update({ status: "rejected" } as any).eq("id", id);
    setStudents((p) => p.filter((s) => s.id !== id));
    setActing(null);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Student Approvals"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <View style={layout.rowBetween}>
          <View>
            <Text variant="heading" color="primary">Student Approvals</Text>
            <Text variant="caption" color="muted">Review and approve new registrations</Text>
          </View>
          {students.length > 0 && <Badge label={`${students.length} pending`} variant="amber" />}
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
            <Spinner size="lg" label="Loading pending students..." />
          </View>
        ) : students.length === 0 ? (
          <EmptyState
            icon="status-pending"
            title="No pending approvals"
            description="All student registrations have been reviewed."
          />
        ) : (
          students.map((s) => (
            <Card key={s.id}>
              <View style={layout.rowBetween}>
                <View style={[layout.row, { gap: spacing[3], flex: 1 }]}>
                  <View style={[styles.avatar, { backgroundColor: brand.goldAlpha15 }]}>
                    <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.black, color: brand.gold }}>
                      {s.first_name[0]}{s.last_name[0]}
                    </Text>
                  </View>
                  <View style={layout.fill}>
                    <Text variant="label" weight="bold" color="primary">{s.first_name} {s.last_name}</Text>
                    <Text variant="caption" color="muted">{s.matric_number} · {s.email}</Text>
                    {s.dept_name ? <Text variant="micro" color="muted">{s.dept_name} · {s.level} Level</Text> : null}
                    <Text variant="micro" color="muted">
                      Registered {new Date(s.created_at).toLocaleDateString("en-NG")}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[layout.row, { gap: spacing[3], marginTop: spacing[4] }]}>
                <TouchableOpacity
                  onPress={() => approve(s.id)}
                  disabled={acting === s.id}
                  activeOpacity={0.75}
                  style={[styles.actionBtn, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder, flex: 1 }]}
                >
                  <Icon name="ui-check" size="sm" color={colors.status.success} />
                  <Text style={{ color: colors.status.success, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                    {acting === s.id ? "Approving..." : "Approve"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => reject(s.id)}
                  disabled={acting === s.id}
                  activeOpacity={0.75}
                  style={[styles.actionBtn, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder, flex: 1 }]}
                >
                  <Icon name="ui-close" size="sm" color={colors.status.error} />
                  <Text style={{ color: colors.status.error, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Reject</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.full, alignItems: "center", justifyContent: "center",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[4],
    borderRadius: radius.lg, borderWidth: 1,
  },
});
