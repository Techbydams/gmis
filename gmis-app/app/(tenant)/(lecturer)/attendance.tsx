// ============================================================
// GMIS — Lecturer Attendance (Manual + QR Generation)
// Route: /(tenant)/(lecturer)/attendance
//
// Tab 1 — Manual: mark attendance for enrolled students
// Tab 2 — QR Code: generate a time-limited QR for students to scan
// QR payload: { qr_id, course_id, class_date }
// Stored in qr_codes table; students scan via qr-attendance route
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Alert } from "react-native";
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

// QR SVG — graceful fallback if library not available
let QRCode: any = null;
try { QRCode = require("react-native-qrcode-svg").default; } catch {}

type Tab = "manual" | "qr";

export default function LecturerAttendance() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [activeTab,  setActiveTab]  = useState<Tab>("manual");
  const [lecturer,   setLecturer]   = useState<any>(null);
  const [courses,    setCourses]    = useState<any[]>([]);
  const [selected,   setSelected]   = useState<string | null>(null);
  const [students,   setStudents]   = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  // QR tab state
  const [qrCourse,    setQrCourse]    = useState<string | null>(null);
  const [activeQR,    setActiveQR]    = useState<any | null>(null);
  const [qrLoading,   setQrLoading]   = useState(false);
  const [qrPayload,   setQrPayload]   = useState<string>("");
  const [expiresIn,   setExpiresIn]   = useState<number>(0);   // seconds remaining

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  // Countdown timer for active QR
  useEffect(() => {
    if (!activeQR) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(activeQR.expires_at).getTime() - Date.now()) / 1000));
      setExpiresIn(diff);
      if (diff === 0) setActiveQR(null);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeQR]);

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
        class_date: today,
        status: attendance[s.id] || "absent",
      } as any, { onConflict: "student_id,course_id,class_date" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const generateQR = async () => {
    if (!db || !qrCourse || !lecturer) return;
    setQrLoading(true);
    setActiveQR(null);

    const today       = new Date().toISOString().split("T")[0];
    const expiresAt   = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Deactivate previous QR for this course today
    await db.from("qr_codes")
      .update({ is_active: false } as any)
      .eq("course_id", qrCourse)
      .eq("class_date", today)
      .eq("lecturer_id", lecturer.id);

    // Insert new QR
    const { data: newQR, error } = await db
      .from("qr_codes")
      .insert({
        course_id:   qrCourse,
        lecturer_id: lecturer.id,
        class_date:  today,
        expires_at:  expiresAt,
        is_active:   true,
        used_count:  0,
      } as any)
      .select()
      .single();

    if (error || !newQR) {
      Alert.alert("Error", `Failed to generate QR code: ${error?.message || "unknown error"}`);
      setQrLoading(false);
      return;
    }

    const qrAny = newQR as any;
    const payload = JSON.stringify({
      qr_id:      qrAny.id,
      course_id:  qrCourse,
      class_date: today,
    });

    setActiveQR(qrAny);
    setQrPayload(payload);
    setQrLoading(false);
  };

  const deactivateQR = async () => {
    if (!db || !activeQR) return;
    await db.from("qr_codes").update({ is_active: false } as any).eq("id", activeQR.id);
    setActiveQR(null);
    setQrPayload("");
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const, sub: lecturer?.staff_id };
  const presentCount = Object.values(attendance).filter((v) => v === "present").length;
  const selectedCourse = courses.find((c) => c.id === (activeTab === "manual" ? selected : qrCourse));

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

        {/* Tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
          {(["manual", "qr"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => setActiveTab(t)}
              activeOpacity={0.75}
              style={[styles.tab, activeTab === t && { backgroundColor: brand.blue }]}
            >
              <Icon name={t === "manual" ? "ui-check" : "content-qr"} size="sm" color={activeTab === t ? "#fff" : colors.text.secondary} />
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: activeTab === t ? "#fff" : colors.text.secondary }}>
                {t === "manual" ? "Manual" : "QR Code"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : courses.length === 0 ? (
          <EmptyState icon="nav-attendance" title="No courses assigned" description="No courses to take attendance for." />
        ) : activeTab === "manual" ? (
          /* ── MANUAL TAB ── */
          <>
            <Text variant="label" weight="semibold" color="muted">Select course</Text>
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              {courses.map((c) => (
                <TouchableOpacity key={c.id}
                  onPress={() => { setSelected(c.id); loadStudents(c.id); }}
                  activeOpacity={0.75}
                  style={[styles.courseChip, { backgroundColor: selected === c.id ? brand.blue : colors.bg.card, borderColor: selected === c.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: selected === c.id ? "#fff" : colors.text.primary }}>{c.course_code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selected && students.length > 0 && (
              <Card>
                <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                  <Text variant="label" weight="bold" color="primary">{presentCount}/{students.length} present</Text>
                  <TouchableOpacity onPress={saveAttendance} disabled={saving} activeOpacity={0.75}
                    style={[styles.saveBtn, { backgroundColor: saved ? colors.status.successBg : brand.blue }]}>
                    <Text style={{ color: saved ? colors.status.success : "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                      {saving ? "Saving…" : saved ? "Saved ✓" : "Submit"}
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
            {selected && students.length === 0 && (
              <EmptyState icon="nav-students" title="No enrolled students" description="No students are registered for this course." />
            )}
          </>
        ) : (
          /* ── QR TAB ── */
          <>
            <Text variant="label" weight="semibold" color="muted">Select course to generate QR</Text>
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              {courses.map((c) => (
                <TouchableOpacity key={c.id}
                  onPress={() => { setQrCourse(c.id); setActiveQR(null); setQrPayload(""); }}
                  activeOpacity={0.75}
                  style={[styles.courseChip, { backgroundColor: qrCourse === c.id ? brand.blue : colors.bg.card, borderColor: qrCourse === c.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: qrCourse === c.id ? "#fff" : colors.text.primary }}>{c.course_code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {qrCourse && (
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>
                  {selectedCourse?.course_code} — {selectedCourse?.course_name}
                </Text>
                <Text variant="micro" color="muted" style={{ marginBottom: spacing[4] }}>
                  QR code expires 30 minutes after generation. Students must be present to scan.
                </Text>

                {/* QR Display */}
                {activeQR && qrPayload ? (
                  <View style={{ alignItems: "center", gap: spacing[4] }}>
                    {/* QR code */}
                    <View style={[styles.qrBox, { backgroundColor: "#fff", borderColor: colors.border.DEFAULT }]}>
                      {QRCode ? (
                        <QRCode value={qrPayload} size={200} />
                      ) : (
                        <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
                          <Icon name="content-qr" size="3xl" color={colors.text.muted} />
                          <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                            Install react-native-qrcode-svg to display QR
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Timer */}
                    <View style={[styles.timerRow, { backgroundColor: expiresIn > 120 ? colors.status.successBg : colors.status.warningBg }]}>
                      <Icon name="nav-calendar" size="sm" color={expiresIn > 120 ? colors.status.success : colors.status.warning} />
                      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: expiresIn > 120 ? colors.status.success : colors.status.warning }}>
                        Expires in {formatCountdown(expiresIn)}
                      </Text>
                    </View>

                    <Text variant="micro" color="muted" align="center">
                      Scanned by {activeQR.used_count || 0} student{(activeQR.used_count || 0) !== 1 ? "s" : ""}
                    </Text>

                    {/* Deactivate */}
                    <TouchableOpacity onPress={deactivateQR} activeOpacity={0.75}
                      style={[styles.deactivateBtn, { borderColor: colors.status.errorBorder }]}>
                      <Text style={{ color: colors.status.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Deactivate QR</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ alignItems: "center", gap: spacing[4] }}>
                    <View style={[styles.qrPlaceholder, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
                      <Icon name="content-qr" size="3xl" color={colors.text.muted} />
                      <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                        Tap Generate to create a QR code for students to scan
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={generateQR}
                      disabled={qrLoading}
                      activeOpacity={0.8}
                      style={[styles.generateBtn, { backgroundColor: brand.blue }]}
                    >
                      {qrLoading ? (
                        <Spinner size="sm" color="#fff" />
                      ) : (
                        <>
                          <Icon name="content-qr" size="sm" color="#fff" />
                          <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                            Generate QR Code
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
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
  tabBar: { flexDirection: "row", borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2], paddingVertical: spacing[3] },
  courseChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  saveBtn: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  studentRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[2], borderRadius: radius.lg },
  check: { width: spacing[6], height: spacing[6], borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  qrBox: { padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  qrPlaceholder: {
    width: 220, height: 220, borderRadius: radius.xl, borderWidth: 2,
    borderStyle: "dashed", alignItems: "center", justifyContent: "center",
    padding: spacing[4],
  },
  generateBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing[2],
    paddingHorizontal: spacing[6], paddingVertical: spacing[3],
    borderRadius: radius.full,
  },
  timerRow: {
    flexDirection: "row", alignItems: "center", gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.full,
  },
  deactivateBtn: {
    paddingHorizontal: spacing[5], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1,
  },
});
