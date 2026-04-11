// ============================================================
// GMIS — Parent: Ward's Attendance Record
// Route: /(tenant)/(parent)/attendance?ward=<student_id>
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface AttendRecord {
  id: string;
  class_date: string;
  status: string;
  courses: { course_code: string; course_name: string } | null;
}

export default function ParentAttendance() {
  const { ward }         = useLocalSearchParams<{ ward: string }>();
  const { user }         = useAuth();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [student,   setStudent]   = useState<any>(null);
  const [records,   setRecords]   = useState<AttendRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [activeCourse, setActiveCourse] = useState<string>("all");

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && ward) load(); }, [db, ward]);

  const load = async () => {
    if (!db || !ward) return;
    const [sRes, aRes] = await Promise.allSettled([
      db.from("students").select("first_name, last_name, matric_number, level").eq("id", ward).maybeSingle(),
      db.from("attendance_records")
        .select("id, class_date, status, courses(course_code, course_name)")
        .eq("student_id", ward)
        .order("class_date", { ascending: false }),
    ]);
    if (sRes.status === "fulfilled" && sRes.value.data) setStudent(sRes.value.data);
    if (aRes.status === "fulfilled") setRecords((aRes.value.data || []) as unknown as AttendRecord[]);
    setLoading(false);
  };

  const courses = ["all", ...new Set(records.map((r) => r.courses?.course_code || "").filter(Boolean))];
  const filtered = activeCourse === "all" ? records : records.filter((r) => r.courses?.course_code === activeCourse);

  const presentCount = filtered.filter((r) => r.status === "present").length;
  const rate = filtered.length > 0 ? Math.round((presentCount / filtered.length) * 100) : 0;

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  return (
    <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Attendance"
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
            {student && (
              <Card>
                <Text variant="subtitle" weight="bold" color="primary">{student.first_name} {student.last_name}</Text>
                <Text variant="caption" color="muted">{student.matric_number} · {student.level} Level</Text>
                <View style={[layout.row, { gap: spacing[4], marginTop: spacing[3] }]}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: rate >= 75 ? colors.status.success : colors.status.warning }}>
                      {rate}%
                    </Text>
                    <Text variant="micro" color="muted">Attendance rate</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                      {presentCount}/{filtered.length}
                    </Text>
                    <Text variant="micro" color="muted">Classes attended</Text>
                  </View>
                </View>
                {rate < 75 && (
                  <View style={[styles.warning, { backgroundColor: colors.status.warningBg, borderColor: colors.status.warningBorder }]}>
                    <Text style={{ color: colors.status.warning, fontSize: fontSize.xs, fontWeight: fontWeight.semibold }}>
                      ⚠ Attendance below 75% threshold
                    </Text>
                  </View>
                )}
              </Card>
            )}

            {/* Course filter */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                {courses.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setActiveCourse(c)} activeOpacity={0.75}
                    style={[styles.chip, { backgroundColor: activeCourse === c ? brand.blue : colors.bg.card, borderColor: activeCourse === c ? brand.blue : colors.border.DEFAULT }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: activeCourse === c ? "#fff" : colors.text.secondary }}>
                      {c === "all" ? "All Courses" : c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {filtered.length === 0 ? (
              <EmptyState icon="nav-attendance" title="No records" description="No attendance records found." />
            ) : (
              <Card>
                {filtered.map((r, i) => {
                  const isPresent = r.status === "present";
                  return (
                    <View key={r.id} style={[styles.row, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < filtered.length - 1 ? 1 : 0 }]}>
                      <View style={{ flex: 1 }}>
                        <Text variant="label" weight="semibold" color="primary">
                          {r.courses?.course_code} — {r.courses?.course_name}
                        </Text>
                        <Text variant="micro" color="muted">
                          {new Date(r.class_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </Text>
                      </View>
                      <Badge label={isPresent ? "Present" : "Absent"} variant={isPresent ? "green" : "red"} size="sm" />
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
  chip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  warning: { marginTop: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
});
