// ============================================================
// GMIS — Lecturer Attendance (Manual + QR Generation)
// Route: /(tenant)/(lecturer)/attendance
//
// Tab 1 — Manual: mark attendance for enrolled students
// Tab 2 — QR Code: generate a time-limited QR for students to scan
//          Live attendance list updates in real-time via polling
//          while QR is active (refreshes every 8s).
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

let QRCode: any = null;
try { QRCode = require("react-native-qrcode-svg").default; } catch {}

type Tab = "manual" | "qr" | "history";

interface AttendedStudent {
  id: string;
  first_name: string;
  last_name: string;
  matric_number: string;
  marked_at?: string;
}

export default function LecturerAttendance() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [activeTab,  setActiveTab]  = useState<Tab>("manual");
  const [lecturer,   setLecturer]   = useState<any>(null);
  const [courses,    setCourses]    = useState<any[]>([]);
  // Manual tab
  const [selected,   setSelected]   = useState<string | null>(null);
  const [students,   setStudents]   = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  // QR tab
  const [qrCourse,   setQrCourse]   = useState<string | null>(null);
  const [activeQR,   setActiveQR]   = useState<any | null>(null);
  const [qrLoading,  setQrLoading]  = useState(false);
  const [qrPayload,  setQrPayload]  = useState<string>("");
  const [expiresIn,  setExpiresIn]  = useState<number>(0);
  // Live attendance from QR scans
  const [liveAttended,  setLiveAttended]  = useState<AttendedStudent[]>([]);
  const [liveTotal,     setLiveTotal]     = useState(0);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // History tab state
  const [historyCourse,  setHistoryCourse]  = useState<string | null>(null);
  const [historyData,    setHistoryData]    = useState<Record<string, { date: string; present: AttendedStudent[]; absent: number; total: number }[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedDates,  setExpandedDates]  = useState<Record<string, boolean>>({});

  const pollRef  = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: courses.length > 0 });

  // ── Countdown timer ──────────────────────────────────────
  useEffect(() => {
    if (!activeQR) { clearInterval(timerRef.current); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(activeQR.expires_at).getTime() - Date.now()) / 1000));
      setExpiresIn(diff);
      if (diff === 0) { setActiveQR(null); setQrPayload(""); clearInterval(timerRef.current); stopPolling(); }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [activeQR]);

  // ── Live polling for QR scans ────────────────────────────
  const startPolling = (courseId: string, classDate: string) => {
    stopPolling();
    fetchLiveAttendance(courseId, classDate);
    pollRef.current = setInterval(() => fetchLiveAttendance(courseId, classDate), 8000);
  };

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  useEffect(() => () => { stopPolling(); }, []);

  const fetchLiveAttendance = async (courseId: string, classDate: string) => {
    if (!db) return;
    setLiveRefreshing(true);
    const { data } = await db
      .from("attendance_records")
      .select("id, status, class_date, student_id, students(id, first_name, last_name, matric_number), created_at")
      .eq("course_id", courseId)
      .eq("class_date", classDate)
      .eq("status", "present")
      .order("created_at", { ascending: false });

    if (data) {
      const list: AttendedStudent[] = (data as any[]).map((r) => ({
        id:           r.students?.id || r.student_id,
        first_name:   r.students?.first_name || "",
        last_name:    r.students?.last_name || "",
        matric_number:r.students?.matric_number || "",
        marked_at:    r.created_at,
      })).filter((s) => s.first_name);
      setLiveAttended(list);
    }
    // Get total enrolled for the course
    const { count } = await db
      .from("semester_registrations")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "registered");
    setLiveTotal(count ?? 0);
    setLiveRefreshing(false);
  };

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

  const toggleAttendance = (id: string) =>
    setAttendance((prev) => ({ ...prev, [id]: prev[id] === "present" ? "absent" : "present" }));

  const saveAttendance = async () => {
    if (!db || !selected) return;
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    for (const s of students) {
      await db.from("attendance_records").upsert({
        student_id: s.id, course_id: selected, class_date: today,
        status: attendance[s.id] || "absent",
      } as any, { onConflict: "student_id,course_id,class_date" });
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const generateQR = async () => {
    if (!db || !qrCourse || !lecturer) return;
    setQrLoading(true); setActiveQR(null); setLiveAttended([]); stopPolling();
    const today     = new Date().toISOString().split("T")[0];
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await db.from("qr_codes").update({ is_active: false } as any)
      .eq("course_id", qrCourse).eq("class_date", today).eq("lecturer_id", lecturer.id);

    const { data: newQR, error } = await db.from("qr_codes")
      .insert({ course_id: qrCourse, lecturer_id: lecturer.id, class_date: today, expires_at: expiresAt, is_active: true, used_count: 0 } as any)
      .select().single();

    if (error || !newQR) {
      Alert.alert("Error", `Failed to generate QR code: ${error?.message}`);
      setQrLoading(false); return;
    }

    const qrAny = newQR as any;
    const payload = JSON.stringify({ qr_id: qrAny.id, course_id: qrCourse, class_date: today });
    setActiveQR(qrAny); setQrPayload(payload);
    setQrLoading(false);
    startPolling(qrCourse, today);
  };

  // ── History helpers ──────────────────────────────────────
  const loadHistory = async (courseId: string) => {
    if (!db) return;
    setHistoryLoading(true);
    const { data: records } = await db
      .from("attendance_records")
      .select("id, status, class_date, student_id, students(id, first_name, last_name, matric_number), created_at")
      .eq("course_id", courseId)
      .order("class_date", { ascending: false });

    const { count: totalEnrolled } = await db
      .from("semester_registrations")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("status", "registered");

    if (records) {
      const grouped: Record<string, { present: AttendedStudent[]; absentCount: number }> = {};
      (records as any[]).forEach((r) => {
        const date = r.class_date;
        if (!grouped[date]) grouped[date] = { present: [], absentCount: 0 };
        if (r.status === "present" && r.students?.first_name) {
          grouped[date].present.push({
            id: r.students.id, first_name: r.students.first_name,
            last_name: r.students.last_name, matric_number: r.students.matric_number,
            marked_at: r.created_at,
          });
        } else {
          grouped[date].absentCount += 1;
        }
      });
      const sorted = Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, { present, absentCount }]) => ({
          date, present, absent: absentCount,
          total: totalEnrolled ?? present.length + absentCount,
        }));
      setHistoryData((prev) => ({ ...prev, [courseId]: sorted }));
    }
    setHistoryLoading(false);
  };

  const toggleDate = (key: string) =>
    setExpandedDates((prev) => ({ ...prev, [key]: !prev[key] }));

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const deactivateQR = async () => {
    if (!db || !activeQR) return;
    await db.from("qr_codes").update({ is_active: false } as any).eq("id", activeQR.id);
    setActiveQR(null); setQrPayload(""); stopPolling();
  };

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

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
          {(["manual", "qr", "history"] as Tab[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} activeOpacity={0.75}
              style={[styles.tab, activeTab === t && { backgroundColor: brand.blue }]}>
              <Icon
                name={t === "manual" ? "ui-check" : t === "qr" ? "content-qr" : "nav-results"}
                size="sm"
                color={activeTab === t ? "#fff" : colors.text.secondary}
              />
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: activeTab === t ? "#fff" : colors.text.secondary }}>
                {t === "manual" ? "Manual" : t === "qr" ? "QR Code" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : courses.length === 0 ? (
          <EmptyState icon="nav-attendance" title="No courses assigned" description="No courses to take attendance for." />
        ) : activeTab === "history" ? (

          /* ══════════ HISTORY TAB ══════════ */
          <>
            <Text variant="label" weight="semibold" color="muted">Select course to view history</Text>
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              {courses.map((c) => (
                <TouchableOpacity key={c.id}
                  onPress={() => { setHistoryCourse(c.id); loadHistory(c.id); }}
                  activeOpacity={0.75}
                  style={[styles.courseChip, { backgroundColor: historyCourse === c.id ? brand.blue : colors.bg.card, borderColor: historyCourse === c.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: historyCourse === c.id ? "#fff" : colors.text.primary }}>{c.course_code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {historyCourse && (
              historyLoading ? (
                <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
              ) : !historyData[historyCourse] || historyData[historyCourse].length === 0 ? (
                <EmptyState icon="nav-attendance" title="No records yet" description="No attendance records found for this course." />
              ) : (
                historyData[historyCourse].map((session) => {
                  const pct = session.total > 0 ? Math.round((session.present.length / session.total) * 100) : 0;
                  const key = `${historyCourse}_${session.date}`;
                  const expanded = expandedDates[key];
                  return (
                    <Card key={session.date}>
                      <TouchableOpacity onPress={() => toggleDate(key)} activeOpacity={0.75}>
                        <View style={layout.rowBetween}>
                          <View>
                            <Text variant="label" weight="bold" color="primary">{fmtDate(session.date)}</Text>
                            <Text variant="micro" color="muted" style={{ marginTop: 2 }}>
                              {session.present.length} present · {session.absent} absent · {pct}%
                            </Text>
                          </View>
                          <View style={[layout.row, { gap: spacing[2], alignItems: "center" }]}>
                            <View style={[{ paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full }, { backgroundColor: colors.status.successBg }]}>
                              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.status.success }}>{session.present.length}/{session.total}</Text>
                            </View>
                            <Icon name={expanded ? "ui-up" : "ui-down"} size="sm" color={colors.text.muted} />
                          </View>
                        </View>
                      </TouchableOpacity>

                      {expanded && session.present.length > 0 && (
                        <View style={{ marginTop: spacing[3] }}>
                          <View style={[styles.progressBg, { backgroundColor: colors.bg.hover, marginBottom: spacing[3] }]}>
                            <View style={[styles.progressFill, { backgroundColor: brand.blue, width: `${pct}%` as any }]} />
                          </View>
                          {session.present.map((s, i) => (
                            <View key={s.id} style={[styles.liveRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < session.present.length - 1 ? 1 : 0 }]}>
                              <View style={[styles.check, { backgroundColor: colors.status.success }]}>
                                <Icon name="ui-check" size="xs" color="#fff" />
                              </View>
                              <View style={layout.fill}>
                                <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                                <Text variant="micro" color="muted">{s.matric_number}</Text>
                              </View>
                              {s.marked_at && (
                                <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{formatTime(s.marked_at)}</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </Card>
                  );
                })
              )
            )}
          </>

        ) : activeTab === "manual" ? (

          /* ══════════ MANUAL TAB ══════════ */
          <>
            <Text variant="label" weight="semibold" color="muted">Select course</Text>
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

          /* ══════════ QR TAB ══════════ */
          <>
            <Text variant="label" weight="semibold" color="muted">Select course to generate QR</Text>
            <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
              {courses.map((c) => (
                <TouchableOpacity key={c.id}
                  onPress={() => { setQrCourse(c.id); setActiveQR(null); setQrPayload(""); setLiveAttended([]); stopPolling(); }}
                  activeOpacity={0.75}
                  style={[styles.courseChip, { backgroundColor: qrCourse === c.id ? brand.blue : colors.bg.card, borderColor: qrCourse === c.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: qrCourse === c.id ? "#fff" : colors.text.primary }}>{c.course_code}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {qrCourse && (
              <>
                {/* QR generation card */}
                <Card>
                  <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>
                    {selectedCourse?.course_code} — {selectedCourse?.course_name}
                  </Text>
                  <Text variant="micro" color="muted" style={{ marginBottom: spacing[4] }}>
                    QR expires 30 minutes after generation. Students scan with the GMIS app.
                  </Text>

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

                      {/* ── Web/Manual Attendance Code ────────────────── */}
                      {/* 6-character short code derived from QR ID.
                          Students who cannot scan (web users) enter this code.
                          Synced with the same QR session → prevents double-marking. */}
                      <View style={[styles.codeBox, { backgroundColor: colors.bg.hover, borderColor: brand.blueAlpha30 }]}>
                        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: spacing[1], textTransform: "uppercase", letterSpacing: 1 }}>
                          Web / Manual Code
                        </Text>
                        <Text style={{ fontSize: 32, fontWeight: fontWeight.black, color: brand.blue, letterSpacing: 8, fontVariant: ["tabular-nums"] as any }}>
                          {activeQR.id.replace(/-/g, "").slice(0, 6).toUpperCase()}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: spacing[1], textAlign: "center" }}>
                          Students without a camera enter this code on the GMIS app or web portal
                        </Text>
                      </View>

                      {/* Timer */}
                      <View style={[styles.timerRow, { backgroundColor: expiresIn > 120 ? colors.status.successBg : colors.status.warningBg }]}>
                        <Icon name="nav-calendar" size="sm" color={expiresIn > 120 ? colors.status.success : colors.status.warning} />
                        <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: expiresIn > 120 ? colors.status.success : colors.status.warning }}>
                          Expires in {formatCountdown(expiresIn)}
                        </Text>
                      </View>

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
                      <TouchableOpacity onPress={generateQR} disabled={qrLoading} activeOpacity={0.8}
                        style={[styles.generateBtn, { backgroundColor: brand.blue }]}>
                        {qrLoading ? <Spinner size="sm" color="#fff" /> : (
                          <>
                            <Icon name="content-qr" size="sm" color="#fff" />
                            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Generate QR Code</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>

                {/* Live attendance list — shown while QR is active */}
                {activeQR && (
                  <Card>
                    <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                      <View style={[layout.row, { gap: spacing[2] }]}>
                        <Text variant="label" weight="bold" color="primary">
                          Live attendance
                        </Text>
                        {liveRefreshing && <Spinner size="sm" />}
                      </View>
                      <View style={[styles.liveCount, { backgroundColor: brand.blueAlpha15 }]}>
                        <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.black, color: brand.blue }}>
                          {liveAttended.length}
                        </Text>
                        <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>
                          /{liveTotal}
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar */}
                    <View style={[styles.progressBg, { backgroundColor: colors.bg.hover }]}>
                      <View style={[styles.progressFill, {
                        backgroundColor: brand.blue,
                        width: liveTotal > 0 ? `${Math.min(100, Math.round((liveAttended.length / liveTotal) * 100))}%` : "0%",
                      } as any]} />
                    </View>
                    <Text variant="micro" color="muted" style={{ marginBottom: spacing[3], marginTop: spacing[1] }}>
                      {liveTotal > 0 ? `${Math.round((liveAttended.length / liveTotal) * 100)}% scanned` : "Waiting for scans…"} · Updates every 8s
                    </Text>

                    {liveAttended.length === 0 ? (
                      <View style={[layout.centredH, { paddingVertical: spacing[4] }]}>
                        <Icon name="content-qr" size="2xl" color={colors.text.muted} />
                        <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                          Waiting for students to scan…
                        </Text>
                      </View>
                    ) : (
                      liveAttended.map((s, i) => (
                        <View key={s.id} style={[styles.liveRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < liveAttended.length - 1 ? 1 : 0 }]}>
                          <View style={[styles.check, { backgroundColor: colors.status.success }]}>
                            <Icon name="ui-check" size="xs" color="#fff" />
                          </View>
                          <View style={layout.fill}>
                            <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                            <Text variant="micro" color="muted">{s.matric_number}</Text>
                          </View>
                          {s.marked_at && (
                            <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{formatTime(s.marked_at)}</Text>
                          )}
                        </View>
                      ))
                    )}
                  </Card>
                )}
              </>
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
  liveRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  check: { width: spacing[6], height: spacing[6], borderRadius: radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  qrBox: { padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  qrPlaceholder: { width: 220, height: 220, borderRadius: radius.xl, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", padding: spacing[4] },
  generateBtn: { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[6], paddingVertical: spacing[3], borderRadius: radius.full },
  timerRow: { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full },
  deactivateBtn: { paddingHorizontal: spacing[5], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  codeBox: {
    alignItems: "center", paddingHorizontal: spacing[6], paddingVertical: spacing[4],
    borderRadius: radius["2xl"], borderWidth: 1.5, width: "100%" as any,
  },
  liveCount: { flexDirection: "row", alignItems: "baseline", gap: 2, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full },
  progressBg: { height: 6, borderRadius: radius.full, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: radius.full },
});
