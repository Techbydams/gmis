// ============================================================
// GMIS — Organisation Admin Dashboard
// Route: /(tenant)/(admin)/dashboard
// Real data: admin_users, students, lecturers, courses,
//            semester_registrations, results, fee_structure
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { useDrawer } from "@/context/DrawerContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, StatCard, Badge, SkeletonDashboard } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

const ADMIN_ACTIONS = [
  { label: "Student Approvals",  icon: "nav-approvals"   as const, path: "/(tenant)/(admin)/approvals",       color: "#f0b429" },
  { label: "Manage Students",    icon: "nav-students"    as const, path: "/(tenant)/(admin)/students",        color: "#2d6cff" },
  { label: "Academic Setup",     icon: "academic-grade"  as const, path: "/(tenant)/(admin)/academic",        color: "#4f3ef8" },
  { label: "Sessions & Semesters", icon: "academic-calendar" as const, path: "/(tenant)/(admin)/sessions",   color: "#10b981" },
  { label: "Results",            icon: "nav-results"     as const, path: "/(tenant)/(admin)/results",         color: "#2d6cff" },
  { label: "Grading System",     icon: "academic-gpa"    as const, path: "/(tenant)/(admin)/grading",         color: "#a855f7" },
  { label: "Fee Structure",      icon: "nav-fees"        as const, path: "/(tenant)/(admin)/fees",            color: "#10b981" },
  { label: "Payment Gateway",    icon: "nav-payments"    as const, path: "/(tenant)/(admin)/payment-gateway", color: "#f97316" },
  { label: "Bulk Import",        icon: "nav-academic"    as const, path: "/(tenant)/(admin)/bulk-import",     color: "#06b6d4" },
  { label: "Timetable",          icon: "nav-timetable"   as const, path: "/(tenant)/(admin)/timetable",       color: "#6b7280" },
  { label: "Announcements",      icon: "nav-news"        as const, path: "/(tenant)/(admin)/news",            color: "#ef4444" },
  { label: "SUG Elections",      icon: "nav-voting"      as const, path: "/(tenant)/(admin)/elections",       color: "#f0b429" },
  { label: "Notifications",      icon: "ui-bell"         as const, path: "/(tenant)/(admin)/notifications",   color: "#2d6cff" },
  { label: "Settings",           icon: "nav-settings"    as const, path: "/(tenant)/(admin)/settings",        color: "#6b7280" },
] as const;

export default function AdminDashboard() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors, isDark } = useTheme();
  const GMIS_LOGO          = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;
  const { pagePadding }    = useResponsive();
  const { openDrawer }     = useDrawer();
  const insets             = useSafeAreaInsets();

  const [adminUser,  setAdminUser]  = useState<any>(null);
  const [stats,      setStats]      = useState({ students: 0, pending: 0, lecturers: 0, courses: 0, unpaidCount: 0 });
  const [pendingList, setPendingList] = useState<any[]>([]);
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
      // Get admin record
      const { data: admin } = await db
        .from("admin_users")
        .select("id, full_name, role, email")
        .eq("supabase_uid", user.id)
        .maybeSingle();
      if (admin) setAdminUser(admin);

      // Parallel stats
      const [studentsRes, pendingRes, lecturersRes, coursesRes] = await Promise.allSettled([
        db.from("students").select("*", { count: "exact", head: true }).eq("status", "active"),
        db.from("students").select("id, first_name, last_name, matric_number, email, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(5),
        db.from("lecturers").select("*", { count: "exact", head: true }).eq("is_active", true),
        db.from("courses").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);

      const studentCount  = studentsRes.status  === "fulfilled" ? (studentsRes.value.count  ?? 0) : 0;
      const lecturerCount = lecturersRes.status === "fulfilled" ? (lecturersRes.value.count ?? 0) : 0;
      const courseCount   = coursesRes.status   === "fulfilled" ? (coursesRes.value.count   ?? 0) : 0;
      const pending       = pendingRes.status   === "fulfilled" ? (pendingRes.value.data     || []) : [];

      setStats({ students: studentCount, pending: pending.length, lecturers: lecturerCount, courses: courseCount, unpaidCount: 0 });
      setPendingList(pending);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const approveStudent = async (id: string) => {
    if (!db) return;
    await db.from("students").update({ status: "active" } as any).eq("id", id);
    setPendingList((p) => p.filter((s) => s.id !== id));
    setStats((p) => ({ ...p, students: p.students + 1, pending: p.pending - 1 }));
  };

  const shellUser = {
    name:  adminUser?.full_name || user?.email || "Admin",
    role:  "admin" as const,
    sub:   adminUser?.role || "Admin",
  };

  if (loading) {
    return (
      <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Dashboard">
        <SkeletonDashboard />
      </AppShell>
    );
  }

  return (
    <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""}
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      {/* Native top bar */}
      <View style={[{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:spacing[4], paddingBottom:spacing[3], borderBottomWidth:1, backgroundColor:colors.bg.card, borderBottomColor:colors.border.DEFAULT, paddingTop:insets.top + spacing[2] }]}>
        <TouchableOpacity onPress={openDrawer} activeOpacity={0.7} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Icon name="ui-menu" size="md" color={colors.text.secondary} />
        </TouchableOpacity>
        <Image source={GMIS_LOGO} style={{ width:80, height:28 }} resizeMode="contain" />
        <TouchableOpacity onPress={() => router.push("/(tenant)/(admin)/settings" as any)} activeOpacity={0.7} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Icon name="nav-settings" size="md" color={colors.text.secondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        {/* Greeting */}
        <Text variant="heading" color="primary">
          Welcome, {adminUser?.full_name?.split(" ")[0] || "Admin"}
        </Text>
        <Text variant="caption" color="muted">{tenant?.name} · Admin Portal</Text>

        {/* Stats — 2×2 grid */}
        <View style={[layout.row, { gap: spacing[3] }]}>
          <StatCard icon="user-student"   label="Active students"  value={String(stats.students)}  color="brand"   style={{ flex: 1 }} />
          <StatCard icon="status-pending" label="Pending approval" value={String(stats.pending)}   color={stats.pending > 0 ? "warning" : "success"} style={{ flex: 1 }} />
        </View>
        <View style={[layout.row, { gap: spacing[3] }]}>
          <StatCard icon="user-lecturer"  label="Lecturers"        value={String(stats.lecturers)} color="info"    style={{ flex: 1 }} />
          <StatCard icon="nav-courses"    label="Active courses"   value={String(stats.courses)}   color="success" style={{ flex: 1 }} />
        </View>

        {/* Pending approvals */}
        {pendingList.length > 0 && (
          <Card>
            <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Text variant="label" weight="bold" color="primary">Pending approvals</Text>
                <Badge label={String(pendingList.length)} variant="amber" size="sm" />
              </View>
              <TouchableOpacity onPress={() => router.push("/(tenant)/(admin)/approvals" as any)} activeOpacity={0.7}>
                <Text variant="caption" color="link">View all →</Text>
              </TouchableOpacity>
            </View>
            {pendingList.map((s, i) => (
              <View key={s.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: i < pendingList.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                <View style={layout.fill}>
                  <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                  <Text variant="micro" color="muted">{s.matric_number} · {s.email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => approveStudent(s.id)}
                  activeOpacity={0.75}
                  style={[styles.approveBtn, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder }]}
                >
                  <Icon name="ui-check" size="xs" color={colors.status.success} />
                  <Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.bold }}>Approve</Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Quick actions grid */}
        <Text variant="label" weight="bold" color="primary">Admin actions</Text>
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          {ADMIN_ACTIONS.map(({ label, icon, path, color }) => (
            <TouchableOpacity
              key={path}
              onPress={() => router.push(path as any)}
              activeOpacity={0.75}
              style={[styles.actionTile, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: `${color}18` }]}>
                <Icon name={icon} size="md" color={color} />
              </View>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.text.primary, textAlign: "center" }}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text variant="micro" color="muted" align="center" style={{ marginBottom: spacing[4] }}>
          GMIS Admin · A product of DAMS Technologies
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  approveBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing[1],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1],
    borderRadius: radius.full, borderWidth: 1,
  },
  actionTile: {
    width: "30%", minWidth: 100,
    borderRadius: radius.xl, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
    padding: spacing[3], gap: spacing[2],
  },
  actionIcon: {
    width:          spacing[10],
    height:         spacing[10],
    borderRadius:   radius.lg,
    alignItems:     "center",
    justifyContent: "center",
  },
});
