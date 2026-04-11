// ============================================================
// GMIS — Lecturer Dashboard
// Route: /(tenant)/(lecturer)/dashboard
// Tables: lecturers, courses, semester_registrations, results
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
import { Text, Card, StatCard, Badge, Spinner } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";
import { greeting } from "@/lib/helpers";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

const LECTURER_ACTIONS = [
  { label: "My courses",        icon: "nav-courses"    as const, path: "/(tenant)/(lecturer)/courses"     },
  { label: "Upload results",    icon: "action-upload"  as const, path: "/(tenant)/(lecturer)/results"     },
  { label: "QR Attendance",     icon: "nav-attendance" as const, path: "/(tenant)/(lecturer)/attendance"  },
  { label: "Student list",      icon: "nav-students"   as const, path: "/(tenant)/(lecturer)/students"    },
  { label: "Timetable",         icon: "nav-timetable"  as const, path: "/(tenant)/(lecturer)/timetable"   },
] as const;

export default function LecturerDashboard() {
  const { openDrawer } = useDrawer();
  const insets         = useSafeAreaInsets();
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors, isDark } = useTheme();
  const GMIS_LOGO          = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;
  const { pagePadding }    = useResponsive();

  const [lecturer,  setLecturer]  = useState<any>(null);
  const [courses,   setCourses]   = useState<any[]>([]);
  const [stats,     setStats]     = useState({ courses: 0, students: 0, pendingResults: 0 });
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);

    try {
      // Get lecturer profile — confirmed columns from schema
      const { data: lec } = await db
        .from("lecturers")
        .select("id, full_name, email, staff_id, department_id, specialization")
        .eq("supabase_uid", user.id)
        .maybeSingle();

      if (!lec) return;
      setLecturer(lec);
      const lecAny = lec as any;

      // Get courses assigned to this lecturer
      const { data: courseData } = await db
        .from("courses")
        .select("id, course_code, course_name, level, semester, credit_units")
        .eq("lecturer_id", lecAny.id)
        .eq("is_active", true)
        .order("course_code");

      const courseList = courseData || [];
      setCourses(courseList);

      // Count total enrolled students across all courses
      let studentCount = 0;
      if (courseList.length > 0) {
        const { count } = await db
          .from("semester_registrations")
          .select("*", { count: "exact", head: true })
          .in("course_id", courseList.map((c: any) => c.id))
          .eq("status", "registered");
        studentCount = count ?? 0;
      }

      setStats({ courses: courseList.length, students: studentCount, pendingResults: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const shellUser = {
    name: lecturer?.full_name || user?.email || "Lecturer",
    role: "lecturer" as const,
    sub:  lecturer?.staff_id || undefined,
  };

  if (loading) {
    return (
      <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Dashboard">
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" label="Loading..." /></View>
      </AppShell>
    );
  }

  const firstName = lecturer?.full_name?.split(" ")[0] || "Lecturer";

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""}
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      {/* Native top bar */}
      <View style={[{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:spacing[4], paddingBottom:spacing[3], borderBottomWidth:1, backgroundColor:colors.bg.card, borderBottomColor:colors.border.DEFAULT, paddingTop:insets.top + spacing[2] }]}>
        <TouchableOpacity onPress={openDrawer} activeOpacity={0.7} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Icon name="ui-menu" size="md" color={colors.text.secondary} />
        </TouchableOpacity>
        <Image source={GMIS_LOGO} style={{ width:80, height:28 }} resizeMode="contain" />
        <View style={{ width: spacing[10] }} />
      </View>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">{greeting()}, {firstName} 👋</Text>
        <Text variant="caption" color="muted">{tenant?.name} · Lecturer Portal</Text>

        {/* Stats */}
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          <StatCard icon="nav-courses"  label="My courses"       value={String(stats.courses)}  color="brand" />
          <StatCard icon="user-student" label="Total students"   value={String(stats.students)} color="info" />
        </View>

        {/* My courses */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>My courses this semester</Text>
          {courses.length === 0 ? (
            <View style={[layout.centredH, { paddingVertical: spacing[5] }]}>
              <Icon name="nav-courses" size="2xl" color={colors.text.muted} />
              <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[2] }}>No courses assigned yet.</Text>
            </View>
          ) : (
            courses.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => router.push(`/(tenant)/(lecturer)/course-detail?id=${c.id}` as any)}
                activeOpacity={0.75}
                style={[styles.courseRow, { borderBottomWidth: i < courses.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}
              >
                <View style={[styles.courseCode, { backgroundColor: brand.blueAlpha15 }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>{c.course_code}</Text>
                </View>
                <View style={layout.fill}>
                  <Text variant="label" weight="semibold" color="primary">{c.course_name}</Text>
                  <Text variant="micro" color="muted">{c.level} Level · {c.semester} · {c.credit_units} units</Text>
                </View>
                <Icon name="ui-forward" size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            ))
          )}
        </Card>

        {/* Quick actions */}
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          {LECTURER_ACTIONS.map(({ label, icon, path }) => (
            <TouchableOpacity
              key={path}
              onPress={() => router.push(path as any)}
              activeOpacity={0.75}
              style={[styles.actionCard, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
            >
              <Icon name={icon} size="lg" color={brand.blue} />
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.text.primary, marginTop: spacing[2], textAlign: "center" }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text variant="micro" color="muted" align="center" style={{ marginBottom: spacing[4] }}>
          GMIS Lecturer Portal · DAMS Technologies
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  courseRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  courseCode: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.lg },
  actionCard: { flex: 1, minWidth: 80, aspectRatio: 1, borderRadius: radius.xl, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: spacing[3] },
});
