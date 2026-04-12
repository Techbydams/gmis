// ============================================================
// GMIS — Student Course Registration Form
// Route: /(tenant)/(student)/course-form
// Generates a printable HTML course registration form
// Tables: students, semester_registrations, courses, org_settings
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Platform, RefreshControl } from "react-native";
import { useRouter }     from "expo-router";
import { useAuth }       from "@/context/AuthContext";
import { useTenant }     from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad }   from "@/lib/useAutoLoad";
import { Text, Card, Badge, Button, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { useToast }      from "@/components/ui/Toast";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Student {
  id: string; first_name: string; last_name: string; matric_number: string;
  level: string; mode_of_entry: string; entry_session: string;
  departments?: { name: string } | null;
}
interface RegisteredCourse {
  id: string; course_id: string; status: string;
  courses: { course_code: string; course_name: string; credit_units: number; level: string; semester: string };
}

export default function CourseForm() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();
  const { showToast }     = useToast();

  const [student,    setStudent]    = useState<Student | null>(null);
  const [courses,    setCourses]    = useState<RegisteredCourse[]>([]);
  const [session,    setSession]    = useState("");
  const [semester,   setSemester]   = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: !!student });

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const [sRes, settingsRes] = await Promise.all([
        db.from("students")
          .select("id, first_name, last_name, matric_number, level, mode_of_entry, entry_session, departments(name)")
          .eq("supabase_uid", user.id)
          .maybeSingle(),
        db.from("org_settings").select("current_session, current_semester").maybeSingle(),
      ]);
      if (!sRes.data) { setLoading(false); return; }
      const s = sRes.data as any;
      setStudent(s);
      const sess = (settingsRes.data as any)?.current_session || "";
      const sem  = (settingsRes.data as any)?.current_semester || "";
      setSession(sess);
      setSemester(sem);

      const { data: regs } = await db
        .from("semester_registrations")
        .select("id, course_id, status, courses(course_code, course_name, credit_units, level, semester)")
        .eq("student_id", s.id)
        .eq("session", sess || "")
        .eq("status", "registered");

      setCourses((regs || []) as unknown as RegisteredCourse[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const totalUnits = courses.reduce((s, c) => s + (c.courses?.credit_units || 0), 0);

  const printForm = () => {
    if (!student) return;
    const rows = courses.map((c) =>
      `<tr>
        <td>${c.courses?.course_code || ""}</td>
        <td>${c.courses?.course_name || ""}</td>
        <td style="text-align:center">${c.courses?.credit_units || 0}</td>
        <td>${c.courses?.level || ""}</td>
        <td style="text-align:center">_______________</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Course Registration Form - ${student.matric_number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; color: #1e293b; font-size: 13px; }
  .header { text-align: center; border-bottom: 3px double #2d6cff; padding-bottom: 16px; margin-bottom: 20px; }
  .school { font-size: 18px; font-weight: 900; text-transform: uppercase; }
  .title { font-size: 14px; font-weight: 700; color: #2d6cff; margin-top: 4px; }
  .session { font-size: 12px; color: #64748b; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .info-item { border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-weight: 700; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #1e3a8a; color: white; padding: 8px; text-align: left; font-size: 12px; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .total-row td { font-weight: 700; background: #eff6ff; border-top: 2px solid #93c5fd; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sig { border-top: 1px solid #1e293b; padding-top: 6px; text-align: center; font-size: 11px; color: #64748b; }
  .stamp { border: 2px dashed #cbd5e1; border-radius: 8px; height: 60px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 11px; margin-bottom: 20px; }
  .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  @media print { button { display: none !important; } body { padding: 0; } }
</style></head><body>
<div class="header">
  <div class="school">${tenant?.name || slug}</div>
  <div class="title">COURSE REGISTRATION FORM</div>
  <div class="session">${session} Academic Session · ${semester} Semester</div>
</div>

<div class="info-grid">
  <div class="info-item"><div class="info-label">Student Name</div><div class="info-value">${student.last_name} ${student.first_name}</div></div>
  <div class="info-item"><div class="info-label">Matric Number</div><div class="info-value">${student.matric_number}</div></div>
  <div class="info-item"><div class="info-label">Level</div><div class="info-value">${student.level} Level</div></div>
  <div class="info-item"><div class="info-label">Department</div><div class="info-value">${(student.departments as any)?.name || "—"}</div></div>
  <div class="info-item"><div class="info-label">Mode of Entry</div><div class="info-value">${student.mode_of_entry || "—"}</div></div>
  <div class="info-item"><div class="info-label">Entry Session</div><div class="info-value">${student.entry_session || "—"}</div></div>
</div>

<table>
  <thead><tr><th>Code</th><th>Course Title</th><th style="text-align:center">Units</th><th>Level</th><th style="text-align:center">Lecturer Sign.</th></tr></thead>
  <tbody>
    ${rows}
    <tr class="total-row"><td colspan="2"><strong>Total</strong></td><td style="text-align:center"><strong>${totalUnits}</strong></td><td colspan="2"></td></tr>
  </tbody>
</table>

<div class="stamp">OFFICE STAMP</div>

<div class="signatures">
  <div class="sig">Student's Signature<br><br>Date: ___________</div>
  <div class="sig">Adviser's Signature<br><br>Date: ___________</div>
  <div class="sig">HOD's Signature<br><br>Date: ___________</div>
</div>

<div class="footer">
  Generated by GMIS · ${new Date().toLocaleDateString("en-GB")} · This form is valid for the ${session} academic session.
</div>

<button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 28px;background:#2d6cff;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer">Print / Save as PDF</button>
</body></html>`;

    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } else {
      showToast({ message: "Visit the web portal to print your course form.", variant: "info" });
    }
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Course Form"
      onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">Course Registration Form</Text>
          {(session || semester) && (
            <Text variant="caption" color="muted">
              {[session, semester ? `${semester} Semester` : ""].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : !student ? (
          <EmptyState icon="user-student" title="Profile not found" description="Your student record could not be loaded." />
        ) : (
          <>
            {/* Student info card */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Student Information</Text>
              {[
                { label: "Name",       value: `${student.last_name} ${student.first_name}` },
                { label: "Matric",     value: student.matric_number },
                { label: "Level",      value: `${student.level} Level` },
                { label: "Department", value: (student.departments as any)?.name || "—" },
              ].map((r, i, arr) => (
                <View key={r.label} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                  <Text variant="caption" color="muted">{r.label}</Text>
                  <Text variant="caption" color="primary" weight="semibold">{r.value}</Text>
                </View>
              ))}
            </Card>

            {/* Registered courses */}
            {courses.length === 0 ? (
              <EmptyState icon="nav-courses" title="No courses registered"
                description={`No courses registered for ${session || "this session"}.`} />
            ) : (
              <Card>
                <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                  <Text variant="label" weight="bold" color="primary">Registered Courses</Text>
                  <Badge label={`${totalUnits} units`} variant="blue" />
                </View>
                {courses.map((c, i) => (
                  <View key={c.id} style={[layout.rowBetween, { paddingVertical: spacing[3], borderBottomWidth: i < courses.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle, flexWrap: "wrap", gap: spacing[2] }]}>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{c.courses?.course_code}</Text>
                      <Text variant="caption" color="secondary">{c.courses?.course_name}</Text>
                    </View>
                    <Badge label={`${c.courses?.credit_units}u`} variant="gray" size="sm" />
                  </View>
                ))}
              </Card>
            )}

            {/* Print button */}
            {courses.length > 0 && (
              <Button
                label="Print / Download Form"
                variant="primary"
                size="lg"
                full
                onPress={printForm}
                iconLeft="action-print"
              />
            )}

            {/* Info */}
            <View style={[styles.infoNote, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
              <Icon name="status-info" size="sm" color={colors.status.info} />
              <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                Submit the printed form to your department office for signing and stamping. Keep a copy for your records.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  infoNote: { flexDirection: "row", alignItems: "flex-start", padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
});
