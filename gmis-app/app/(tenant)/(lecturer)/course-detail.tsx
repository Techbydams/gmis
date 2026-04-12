// ============================================================
// GMIS — Lecturer Course Detail
// Route: /(tenant)/(lecturer)/course-detail?id=<course_id>
// Shows enrolled students + quick links for this course
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function CourseDetail() {
  const router             = useRouter();
  const { id }             = useLocalSearchParams<{ id: string }>();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [course,   setCourse]   = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && id) load(); }, [db, id]);

  const load = async () => {
    if (!db || !id) return;
    const { data: c } = await db
      .from("courses")
      .select("id, course_code, course_name, level, semester, credit_units, description")
      .eq("id", id)
      .maybeSingle();
    if (c) setCourse(c);

    const { data: regs } = await db
      .from("semester_registrations")
      .select("student_id, students(id, first_name, last_name, matric_number, level)")
      .eq("course_id", id)
      .eq("status", "registered");

    if (regs) {
      setStudents((regs as any[]).map((r) => r.students).filter(Boolean));
    }
    setLoading(false);
  };

  const shellUser = { name: user?.email || "Lecturer", role: "lecturer" as const };

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Course Detail"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : !course ? (
          <EmptyState icon="nav-courses" title="Course not found" description="This course could not be loaded." />
        ) : (
          <>
            {/* Course info */}
            <Card>
              <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                <View style={[styles.codeBox, { backgroundColor: brand.blueAlpha15 }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>{course.course_code}</Text>
                </View>
                <View style={layout.fill}>
                  <Text variant="subtitle" weight="bold" color="primary">{course.course_name}</Text>
                  <Text variant="caption" color="muted">{course.level} Level · {course.semester} · {course.credit_units} units</Text>
                </View>
              </View>
              {course.description && (
                <Text variant="body" color="secondary">{course.description}</Text>
              )}
            </Card>

            {/* Enrolled students */}
            <Text variant="label" weight="bold" color="primary">{students.length} Enrolled Student{students.length !== 1 ? "s" : ""}</Text>

            {students.length === 0 ? (
              <EmptyState icon="nav-students" title="No enrolled students" description="No students have registered for this course yet." />
            ) : (
              <Card>
                {students.map((s, i) => (
                  <View key={s.id} style={[styles.studentRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < students.length - 1 ? 1 : 0 }]}>
                    <View style={[styles.avatar, { backgroundColor: brand.blueAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: brand.blue }}>
                        {s.first_name[0]}{s.last_name[0]}
                      </Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                      <Text variant="micro" color="muted">{s.matric_number}</Text>
                    </View>
                    <Badge label={`${s.level} Level`} variant="blue" size="sm" />
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  codeBox: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.lg, alignSelf: "flex-start" },
  studentRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  avatar: { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
