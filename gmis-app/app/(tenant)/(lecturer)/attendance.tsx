/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
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

export default function LecturerAttendance() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [lecturer,   setLecturer]   = useState<any>(null);
  const [courses,    setCourses]    = useState<any[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [students,   setStudents]   = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

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
      const { data } = await db.from("courses").select("id, course_code, course_name").eq("lecturer_id", (lec as any).id).eq("is_active", true).order("course_code");
      if (data) setCourses(data as any[]);
    }
    setLoading(false);
  };

  const loadStudents = async (courseId: string) => {
    if (!db) return;
    const { data: regs } = await db
      .from("semester_registrations")
      .select("student_id, students(id, first_name, last_name, matric_number)")
      .eq("course_id", courseId).eq("status", "registered");

    if (regs) {
      const list = (regs as any[]).map((r) => r.students).filter(Boolean);
      setStudents(list);
      // Default all to present
      const init: Record<string, "present" | "absent"> = {};
      list.forEach((s: any) => { init[s.id] = "present"; });
      setAttendance(init);
    }
  };

  const toggleAttendance = (id: string) => {
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === "present" ? "absent" : "present" }));
  };

  const saveAttendance = async () => {
    if (!db || !selected) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    for (const s of students) {
      await db.from("attendance_records").upsert({
        student_id: s.id,
        course_id: selected,
        date: today,
        status: attendance[s.id] || "absent",
      } as any, { onConflict: "student_id,course_id,date" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const, sub: lecturer?.staff_id };
  const presentCount = Object.values(attendance).filter((v) => v === "present").length;

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Attendance"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">Attendance</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>
          {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : courses.length === 0 ? (
          <EmptyState icon="nav-attendance" title="No courses assigned" description="No courses to take attendance for." />
        ) : (
          <>
            {/* Course selector */}
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              {courses.map((c) => (
                <TouchableOpacity key={c.id} onPress={() => { setSelected(c.id); loadStudents(c.id); }} activeOpacity={0.75}
                  style={[styles.courseChip, { backgroundColor: selected === c.id ? brand.blue : colors.bg.card, borderColor: selected === c.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: selected === c.id ? "#fff" : colors.text.primary }}>{c.course_code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selected && students.length > 0 && (
              <Card>
                <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                  <Text variant="label" weight="bold" color="primary">
                    {presentCount}/{students.length} present
                  </Text>
                  <TouchableOpacity onPress={saveAttendance} disabled={saving} activeOpacity={0.75}
                    style={[styles.saveBtn, { backgroundColor: saved ? colors.status.successBg : brand.blue }]}>
                    <Text style={{ color: saved ? colors.status.success : "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                      {saving ? "Saving..." : saved ? "Saved!" : "Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {students.map((s, i) => {
                  const present = attendance[s.id] === "present";
                  return (
                    <TouchableOpacity key={s.id} onPress={() => toggleAttendance(s.id)} activeOpacity={0.75}
                      style={[styles.studentRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < students.length - 1 ? 1 : 0, backgroundColor: present ? colors.status.successBg : "transparent" }]}>
                      <View style={[styles.check, { backgroundColor: present ? colors.status.success : colors.border.DEFAULT }]}>
                        {present && <Icon name="ui-check" size="xs" color="#fff" />}
                      </View>
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                        <Text variant="micro" color="muted">{s.matric_number}</Text>
                      </View>
                      <Badge label={present ? "Present" : "Absent"} variant={present ? "green" : "red"} size="sm" />
                    </TouchableOpacity>
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
  courseChip:  { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  saveBtn:     { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  studentRow:  { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[2], borderRadius: radius.lg },
  check:       { width: spacing[6], height: spacing[6], borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
