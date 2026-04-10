/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { Spinner }         from "@/components/ui/Spinner";
import { EmptyState }      from "@/components/ui/EmptyState";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function LecturerResults() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [lecturer,    setLecturer]    = useState<any>(null);
  const [courses,     setCourses]     = useState<any[]>([]);
  const [selected,    setSelected]    = useState<string | null>(null);
  const [students,    setStudents]    = useState<any[]>([]);
  const [scores,      setScores]      = useState<Record<string, { ca: string; exam: string }>>({});
  const [loading,     setLoading]     = useState(true);
  const [loadingStud, setLoadingStud] = useState(false);
  const [saving,      setSaving]      = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async () => {
    if (!db || !user) return;
    const { data: lec } = await db.from("lecturers").select("id, full_name, staff_id").eq("supabase_uid", user.id).maybeSingle();
    if (lec) {
      setLecturer(lec);
      const { data } = await db.from("courses").select("id, course_code, course_name, level, semester").eq("lecturer_id", (lec as any).id).eq("is_active", true).order("course_code");
      if (data) setCourses(data as any[]);
    }
    setLoading(false);
  };

  const loadStudents = async (courseId: string) => {
    if (!db) return;
    setLoadingStud(true);
    const { data: regs } = await db
      .from("semester_registrations")
      .select("student_id, students(id, first_name, last_name, matric_number)")
      .eq("course_id", courseId).eq("status", "registered");

    if (regs) {
      const list = (regs as any[]).map((r) => r.students).filter(Boolean);
      setStudents(list);
      // Pre-load existing scores
      const { data: existingResults } = await db.from("results").select("student_id, ca_score, exam_score").eq("course_id", courseId);
      const map: Record<string, { ca: string; exam: string }> = {};
      (existingResults || []).forEach((r: any) => { map[r.student_id] = { ca: String(r.ca_score ?? ""), exam: String(r.exam_score ?? "") }; });
      setScores(map);
    }
    setLoadingStud(false);
  };

  const selectCourse = (id: string) => { setSelected(id); loadStudents(id); };

  const saveScores = async () => {
    if (!db || !selected) return;
    setSaving(true);
    const course = courses.find((c) => c.id === selected);
    for (const s of students) {
      const sc = scores[s.id];
      if (!sc) continue;
      const ca   = parseFloat(sc.ca)   || 0;
      const exam = parseFloat(sc.exam) || 0;
      const total = ca + exam;
      const gp = total >= 70 ? 5 : total >= 60 ? 4 : total >= 50 ? 3 : total >= 45 ? 2 : total >= 40 ? 1 : 0;
      const grade = total >= 70 ? "A" : total >= 60 ? "B" : total >= 50 ? "C" : total >= 45 ? "D" : total >= 40 ? "E" : "F";

      await db.from("results").upsert({
        student_id: s.id,
        course_id: selected,
        ca_score: ca, exam_score: exam,
        grade, grade_point: gp, published: false,
        session: course?.current_session || null,
        semester: course?.semester || null,
      } as any, { onConflict: "student_id,course_id" });
    }
    setSaving(false);
  };

  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const, sub: lecturer?.staff_id };
  const selectedCourse = courses.find((c) => c.id === selected);

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Grade Entry"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">Grade Entry</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>Select a course to enter CA/Exam scores</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : courses.length === 0 ? (
          <EmptyState icon="nav-courses" title="No courses assigned" description="No courses have been assigned to you." />
        ) : (
          <>
            {/* Course picker */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Select course</Text>
              {courses.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => selectCourse(c.id)} activeOpacity={0.75}
                  style={[styles.courseRow, { backgroundColor: selected === c.id ? brand.blueAlpha10 : "transparent", borderRadius: radius.lg }]}>
                  <View style={[styles.code, { backgroundColor: brand.blueAlpha15 }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: brand.blue }}>{c.course_code}</Text>
                  </View>
                  <Text variant="label" weight={selected === c.id ? "semibold" : "normal"} color={selected === c.id ? "brand" : "primary"} style={layout.fill}>{c.course_name}</Text>
                  {selected === c.id && <Icon name="ui-check" size="sm" color={brand.blue} />}
                </TouchableOpacity>
              ))}
            </Card>

            {/* Score entry table */}
            {selected && (
              <Card>
                <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                  <Text variant="label" weight="bold" color="primary">
                    {selectedCourse?.course_code} — Scores
                  </Text>
                  <TouchableOpacity onPress={saveScores} disabled={saving} activeOpacity={0.75}
                    style={[styles.saveBtn, { backgroundColor: brand.blue }]}>
                    <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>{saving ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                </View>

                {/* Header */}
                <View style={[layout.row, styles.tableHeader]}>
                  <Text variant="micro" color="muted" style={{ flex: 1 }}>Student</Text>
                  <Text variant="micro" color="muted" style={styles.scoreCol}>CA /40</Text>
                  <Text variant="micro" color="muted" style={styles.scoreCol}>Exam /60</Text>
                  <Text variant="micro" color="muted" style={styles.scoreCol}>Total</Text>
                </View>

                {loadingStud ? (
                  <View style={[layout.centred, { paddingVertical: spacing[6] }]}><Spinner size="sm" /></View>
                ) : students.length === 0 ? (
                  <Text variant="caption" color="muted" align="center" style={{ paddingVertical: spacing[4] }}>No students enrolled.</Text>
                ) : (
                  students.map((s, i) => {
                    const sc    = scores[s.id] || { ca: "", exam: "" };
                    const ca    = parseFloat(sc.ca) || 0;
                    const exam  = parseFloat(sc.exam) || 0;
                    const total = ca + exam;
                    return (
                      <View key={s.id} style={[layout.row, styles.tableRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < students.length - 1 ? 1 : 0 }]}>
                        <View style={{ flex: 1 }}>
                          <Text variant="caption" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                          <Text variant="micro" color="muted">{s.matric_number}</Text>
                        </View>
                        <TextInput
                          style={[styles.scoreInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
                          value={sc.ca}
                          onChangeText={(v) => setScores((p) => ({ ...p, [s.id]: { ...p[s.id] || { ca: "", exam: "" }, ca: v } }))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                          maxLength={3}
                        />
                        <TextInput
                          style={[styles.scoreInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
                          value={sc.exam}
                          onChangeText={(v) => setScores((p) => ({ ...p, [s.id]: { ...p[s.id] || { ca: "", exam: "" }, exam: v } }))}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.text.muted}
                          maxLength={3}
                        />
                        <Text variant="label" weight="bold" color={total >= 50 ? "success" : "error"} style={styles.scoreCol}>
                          {(sc.ca || sc.exam) ? total : "—"}
                        </Text>
                      </View>
                    );
                  })
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  courseRow:   { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[2], paddingHorizontal: spacing[2] },
  code:        { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.md },
  saveBtn:     { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  tableHeader: { paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  tableRow:    { paddingVertical: spacing[2] },
  scoreCol:    { width: 60, textAlign: "center" },
  scoreInput:  { width: 52, height: 34, borderRadius: radius.sm, borderWidth: 1, textAlign: "center", fontSize: fontSize.sm },
});
