// ============================================================
// GMIS — Student Academic Transcript
// Route: /(tenant)/(student)/transcript
// Generates a printable HTML academic transcript
// Tables: students, results, courses, org_settings
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, StyleSheet, Platform, RefreshControl } from "react-native";
import { useAuth }       from "@/context/AuthContext";
import { useTenant }     from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad }   from "@/lib/useAutoLoad";
import { calcGPA, calcCGPA, formatGPA, getHonourClass } from "@/lib/grading";
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
  faculties?: { name: string } | null;
}
interface Result {
  id: string; ca_score: number; exam_score: number;
  grade: string; grade_point: number; published: boolean;
  session: string; semester: string;
  courses: { course_code: string; course_name: string; credit_units: number };
}
interface SemesterGroup {
  key: string; session: string; semester: string;
  rows: Result[];
  gpa: number; units: number; points: number;
}

export default function Transcript() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();
  const { showToast }     = useToast();

  const [student,    setStudent]    = useState<Student | null>(null);
  const [results,    setResults]    = useState<Result[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: !!student });

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: s } = await db
        .from("students")
        .select("id, first_name, last_name, matric_number, level, mode_of_entry, entry_session, departments(name), faculties(name)")
        .eq("supabase_uid", user.id)
        .maybeSingle();
      if (!s) { setLoading(false); return; }
      setStudent(s as any);

      const { data: res } = await db
        .from("results")
        .select("id, ca_score, exam_score, grade, grade_point, published, session, semester, courses(course_code, course_name, credit_units)")
        .eq("student_id", (s as any).id)
        .eq("published", true)
        .order("session", { ascending: true })
        .order("semester", { ascending: true });

      setResults((res || []) as unknown as Result[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  // Group results by session + semester
  const groups = useMemo((): SemesterGroup[] => {
    const map = new Map<string, Result[]>();
    results.forEach((r) => {
      const key = `${r.session}||${r.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).map(([key, rows]) => {
      const [session, semester] = key.split("||");
      const gradeRows = rows.map((r) => ({ credit_units: r.courses?.credit_units || 0, grade: r.grade }));
      const units  = gradeRows.reduce((s, r) => s + r.credit_units, 0);
      const gpa    = calcGPA(gradeRows);
      const points = gradeRows.reduce((s, r) => s + (r.credit_units * (r.grade === "A" ? 5 : r.grade === "B" ? 4 : r.grade === "C" ? 3 : r.grade === "D" ? 2 : r.grade === "E" ? 1 : 0)), 0);
      return { key, session, semester, rows, gpa, units, points };
    });
  }, [results]);

  const allGradeRows = results.map((r) => ({ credit_units: r.courses?.credit_units || 0, grade: r.grade }));
  const cgpa         = calcCGPA(allGradeRows);
  const totalUnits   = allGradeRows.reduce((s, r) => s + r.credit_units, 0);

  const printTranscript = () => {
    if (!student) return;

    const semesterSections = groups.map((g) => {
      const rows = g.rows.map((r) => {
        const total = (r.ca_score || 0) + (r.exam_score || 0);
        return `<tr>
          <td>${r.courses?.course_code || ""}</td>
          <td>${r.courses?.course_name || ""}</td>
          <td style="text-align:center">${r.courses?.credit_units || 0}</td>
          <td style="text-align:center">${r.ca_score ?? "—"}</td>
          <td style="text-align:center">${r.exam_score ?? "—"}</td>
          <td style="text-align:center;font-weight:700">${total}</td>
          <td style="text-align:center;font-weight:900;color:${r.grade === "A" ? "#16a34a" : r.grade === "B" ? "#2563eb" : r.grade === "C" ? "#b45309" : r.grade === "D" || r.grade === "E" ? "#c2410c" : "#dc2626"}">${r.grade}</td>
          <td style="text-align:center">${r.grade_point?.toFixed(1) ?? "—"}</td>
        </tr>`;
      }).join("");

      return `
        <div class="sem-header">
          <span class="sem-title">${g.session} · ${g.semester} Semester</span>
          <span class="sem-gpa">GPA: <strong>${formatGPA(g.gpa)}</strong></span>
        </div>
        <table>
          <thead>
            <tr><th>Code</th><th>Course Title</th><th>Units</th><th>CA</th><th>Exam</th><th>Total</th><th>Grade</th><th>Points</th></tr>
          </thead>
          <tbody>
            ${rows}
            <tr class="sem-total">
              <td colspan="2"><strong>Semester Total</strong></td>
              <td style="text-align:center"><strong>${g.units}</strong></td>
              <td colspan="3"></td>
              <td colspan="2" style="text-align:center"><strong>GPA: ${formatGPA(g.gpa)}</strong></td>
            </tr>
          </tbody>
        </table>
      `;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Academic Transcript - ${student.matric_number}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; max-width: 740px; margin: 0 auto; padding: 20px; color: #1e293b; font-size: 12px; }
  .header { text-align: center; border-bottom: 3px double #1e3a8a; padding-bottom: 16px; margin-bottom: 20px; }
  .school { font-size: 18px; font-weight: 900; text-transform: uppercase; }
  .title { font-size: 14px; font-weight: 700; color: #1e3a8a; margin-top: 4px; letter-spacing: 1px; }
  .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 20px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; }
  .info-item { display: flex; gap: 8px; align-items: baseline; }
  .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; min-width: 80px; }
  .info-value { font-weight: 700; font-size: 12px; }
  .sem-header { display: flex; justify-content: space-between; align-items: center; background: #1e3a8a; color: white; padding: 6px 10px; border-radius: 4px 4px 0 0; margin-top: 16px; }
  .sem-title { font-weight: 700; font-size: 11px; }
  .sem-gpa { font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { background: #334155; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .sem-total td { font-weight: 700; background: #eff6ff !important; border-top: 2px solid #93c5fd; }
  .cgpa-box { margin-top: 24px; padding: 16px 20px; background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); color: white; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; }
  .cgpa-label { font-size: 11px; opacity: 0.8; }
  .cgpa-val { font-size: 32px; font-weight: 900; }
  .cgpa-class { font-size: 13px; font-weight: 700; margin-top: 2px; }
  .cgpa-stats { text-align: right; font-size: 11px; opacity: 0.85; line-height: 1.8; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 32px; }
  .sig { border-top: 1px solid #1e293b; padding-top: 6px; text-align: center; font-size: 10px; color: #64748b; }
  .footer { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .watermark { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 4px; }
  @media print { button { display: none !important; } body { padding: 0; } }
</style></head><body>

<div class="header">
  <div class="school">${tenant?.name || slug}</div>
  <div class="title">OFFICIAL ACADEMIC TRANSCRIPT</div>
  <div class="subtitle">This document is an official record of academic performance</div>
</div>

<div class="info-grid">
  <div class="info-item"><span class="info-label">Student Name</span><span class="info-value">${student.last_name} ${student.first_name}</span></div>
  <div class="info-item"><span class="info-label">Matric No.</span><span class="info-value">${student.matric_number}</span></div>
  <div class="info-item"><span class="info-label">Department</span><span class="info-value">${(student.departments as any)?.name || "—"}</span></div>
  <div class="info-item"><span class="info-label">Current Level</span><span class="info-value">${student.level} Level</span></div>
  <div class="info-item"><span class="info-label">Mode of Entry</span><span class="info-value">${student.mode_of_entry || "—"}</span></div>
  <div class="info-item"><span class="info-label">Entry Session</span><span class="info-value">${student.entry_session || "—"}</span></div>
</div>

${semesterSections}

<div class="cgpa-box">
  <div>
    <div class="cgpa-label">Cumulative Grade Point Average</div>
    <div class="cgpa-val">${formatGPA(cgpa)}<span style="font-size:16px;opacity:0.7"> / 5.00</span></div>
    <div class="cgpa-class">${getHonourClass(cgpa)}</div>
  </div>
  <div class="cgpa-stats">
    <div>Total Credit Units: <strong>${totalUnits}</strong></div>
    <div>Semesters Completed: <strong>${groups.length}</strong></div>
    <div>Courses Passed: <strong>${results.filter(r => r.grade !== "F").length}</strong></div>
  </div>
</div>

<div class="signatures">
  <div class="sig">Student's Signature<br><br>Date: ___________</div>
  <div class="sig">Registrar's Signature<br><br>Date: ___________</div>
  <div class="sig">Official Stamp</div>
</div>

<div class="footer">
  This transcript is computer-generated and is valid only when officially signed and stamped.<br>
  Generated by GMIS · ${new Date().toLocaleDateString("en-GB")} · ${tenant?.name || slug}
</div>

<button onclick="window.print()" style="display:block;margin:24px auto;padding:10px 28px;background:#1e3a8a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer">
  Print / Save as PDF
</button>
</body></html>`;

    if (Platform.OS === "web") {
      const win = window.open("", "_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } else {
      showToast({ message: "Visit the web portal to print your transcript.", variant: "info" });
    }
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Transcript"
      onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">Academic Transcript</Text>
          <Text variant="caption" color="muted">Full record of published results</Text>
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : !student ? (
          <EmptyState icon="user-student" title="Profile not found" description="Your student record could not be loaded." />
        ) : (
          <>
            {/* Student info */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Student Information</Text>
              {[
                { label: "Name",         value: `${student.last_name} ${student.first_name}` },
                { label: "Matric No.",   value: student.matric_number },
                { label: "Level",        value: `${student.level} Level` },
                { label: "Department",   value: (student.departments as any)?.name || "—" },
                { label: "Mode",         value: student.mode_of_entry || "—" },
                { label: "Entry Session",value: student.entry_session || "—" },
              ].map((r, i, arr) => (
                <View key={r.label} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                  <Text variant="caption" color="muted">{r.label}</Text>
                  <Text variant="caption" color="primary" weight="semibold">{r.value}</Text>
                </View>
              ))}
            </Card>

            {/* CGPA summary */}
            {results.length > 0 && (
              <Card variant="brand">
                <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
                  <View>
                    <Text variant="caption" color="secondary">Cumulative GPA</Text>
                    <Text style={{ fontSize: fontSize["4xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                      {formatGPA(cgpa)}
                    </Text>
                    <Text variant="caption" color="brand">{getHonourClass(cgpa)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text variant="micro" color="muted">Total units</Text>
                    <Text variant="title" weight="bold" color="primary">{totalUnits}</Text>
                    <Text variant="micro" color="muted" style={{ marginTop: spacing[1] }}>{groups.length} semester{groups.length !== 1 ? "s" : ""}</Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Semester results */}
            {results.length === 0 ? (
              <EmptyState icon="nav-results" title="No results yet" description="Published results will appear here once released by admin." />
            ) : (
              groups.map((g) => (
                <Card key={g.key}>
                  <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                    <View>
                      <Text variant="label" weight="bold" color="primary">{g.session}</Text>
                      <Text variant="micro" color="muted">{g.semester} Semester</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Badge label={`GPA: ${formatGPA(g.gpa)}`} variant="blue" size="sm" />
                      <Text variant="micro" color="muted" style={{ marginTop: spacing[1] }}>{g.units} units</Text>
                    </View>
                  </View>

                  {g.rows.map((r, i) => {
                    const total = (r.ca_score || 0) + (r.exam_score || 0);
                    const gradeVariant = r.grade === "A" ? "green" : r.grade === "B" ? "blue" : r.grade === "C" ? "yellow" : r.grade === "F" ? "red" : "gray";
                    return (
                      <View key={r.id} style={[layout.rowBetween, { paddingVertical: spacing[2], borderBottomWidth: i < g.rows.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle, flexWrap: "wrap", gap: spacing[2] }]}>
                        <View style={layout.fill}>
                          <Text variant="label" weight="semibold" color="primary">{r.courses?.course_code}</Text>
                          <Text variant="caption" color="secondary" numberOfLines={1}>{r.courses?.course_name}</Text>
                        </View>
                        <View style={[layout.row, { gap: spacing[2] }]}>
                          <Text variant="micro" color="muted">{total}/100</Text>
                          <Badge label={r.grade} variant={gradeVariant as any} size="sm" />
                          <Text variant="micro" color="muted">{r.courses?.credit_units}u</Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              ))
            )}

            {/* Print button */}
            {results.length > 0 && (
              <Button
                label="Print / Download Transcript"
                variant="primary"
                size="lg"
                full
                onPress={printTranscript}
                iconLeft="action-print"
              />
            )}

            {/* Info note */}
            <View style={[styles.infoNote, { backgroundColor: colors.status.infoBg, borderColor: colors.status.infoBorder }]}>
              <Icon name="status-info" size="sm" color={colors.status.info} />
              <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, marginLeft: spacing[2], lineHeight: 18 }}>
                This transcript shows only published results. Unpublished results are not included. Have it signed and stamped by the Registrar to make it official.
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
