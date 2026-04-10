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
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function LecturerCourses() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [lecturer,   setLecturer]   = useState<any>(null);
  const [courses,    setCourses]    = useState<any[]>([]);
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

    const { data: lec } = await db.from("lecturers").select("id, full_name, staff_id").eq("supabase_uid", user.id).maybeSingle();
    if (lec) {
      setLecturer(lec);
      const { data } = await db
        .from("courses")
        .select("id, course_code, course_name, level, semester, credit_units, is_active")
        .eq("lecturer_id", (lec as any).id)
        .order("course_code");
      if (data) setCourses(data as any[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const shellUser = {
    name: lecturer?.full_name || user?.email || "Lecturer",
    role: "lecturer" as const,
    sub:  lecturer?.staff_id,
  };

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="My Courses"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">My Courses</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading courses..." /></View>
        ) : (
          <>
            <View style={[layout.row, { gap: spacing[3] }]}>
              <StatCard icon="nav-courses" label="Total courses" value={String(courses.length)} color="brand" />
              <StatCard icon="ui-check"    label="Active"        value={String(courses.filter((c) => c.is_active).length)} color="success" />
            </View>

            {courses.length === 0 ? (
              <EmptyState icon="nav-courses" title="No courses assigned" description="No courses have been assigned to you yet." />
            ) : (
              courses.map((c) => (
                <TouchableOpacity key={c.id} activeOpacity={0.75}
                  style={[styles.courseCard, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
                  <View style={[styles.codeBox, { backgroundColor: brand.blueAlpha15 }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: brand.blue }}>{c.course_code}</Text>
                  </View>
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{c.course_name}</Text>
                    <Text variant="micro" color="muted">{c.level} Level · {c.semester} Semester · {c.credit_units} units</Text>
                  </View>
                  <Badge label={c.is_active ? "Active" : "Inactive"} variant={c.is_active ? "green" : "neutral"} size="sm" />
                </TouchableOpacity>
              ))
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  courseCard: { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  codeBox:    { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg },
});
