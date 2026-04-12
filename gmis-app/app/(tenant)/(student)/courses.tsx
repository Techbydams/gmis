// ============================================================
// GMIS — Course Registration
// Route: /(tenant)/(student)/courses
// Tables: courses, semester_registrations, org_settings
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad } from "@/lib/useAutoLoad";
import { Text, Card, Badge, Button, Input, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { useToast }    from "@/components/ui/Toast";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Course {
  id: string; course_code: string; course_name: string;
  credit_units: number; level: string; semester: string;
  departments?: { name: string }; lecturers?: { full_name: string };
  is_general?: boolean;
}
interface Registration { id: string; course_id: string; status: string; }
interface EditRequest  { id: string; registration_id: string | null; old_course_id: string | null; status: string; }
interface OrgSettings {
  registration_open: boolean;
  current_session: string | null;
  current_semester: string | null;
}

export default function CourseRegistration() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [studentId,      setStudentId]      = useState<string | null>(null);
  const [studentLevel,   setStudentLevel]   = useState<string>("");
  const [studentDeptId,  setStudentDeptId]  = useState<string | null>(null);
  const [courses,        setCourses]        = useState<Course[]>([]);
  const [registrations,  setRegistrations]  = useState<Registration[]>([]);
  const [regOpen,        setRegOpen]        = useState(false);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [currentSemester,setCurrentSemester]= useState<string | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [actionId,       setActionId]       = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterLevel,    setFilterLevel]    = useState("");
  const [editRequests,   setEditRequests]   = useState<EditRequest[]>([]);
  // Edit-request modal
  const [editModal,      setEditModal]      = useState(false);
  const [editCourse,     setEditCourse]     = useState<(Course & { regId: string }) | null>(null);
  const [editReason,     setEditReason]     = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);
  const { showToast } = useToast();

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: courses.length > 0 });

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      // Get student + org settings in parallel
      const [sRes, settingsRes] = await Promise.all([
        db.from("students").select("id, level, department_id").eq("supabase_uid", user.id).maybeSingle(),
        db.from("org_settings").select("registration_open, current_session, current_semester").maybeSingle(),
      ]);

      if (!sRes.data) { setLoading(false); return; }
      const s = sRes.data as any;
      setStudentId(s.id);
      setStudentLevel(s.level || "");
      setStudentDeptId(s.department_id || null);

      const settings = settingsRes.data as any;
      const session  = settings?.current_session  || null;
      const semester = settings?.current_semester || null;
      setRegOpen(settings?.registration_open || false);
      setCurrentSession(session);
      setCurrentSemester(semester);

      // Load courses: student's own department + general courses (is_general=true)
      // Filter by current semester if set
      let coursesQuery = db.from("courses")
        .select("id, course_code, course_name, credit_units, level, semester, is_general, department_id, departments(id, name), lecturers(full_name)")
        .eq("is_active", true)
        .order("level").order("course_code");

      // Apply semester filter — match both "first" and "First Semester" style values
      if (semester) {
        const semLower = semester.toLowerCase().replace(" semester", "");
        coursesQuery = (coursesQuery as any).ilike("semester", `%${semLower}%`);
      }

      const [coursesRes, regsRes] = await Promise.all([
        coursesQuery,
        db.from("semester_registrations")
          .select("id, course_id, status")
          .eq("student_id", s.id)
          .eq("session", session || ""),
      ]);

      // Filter by student's level + department (or general courses)
      const allCourses = ((coursesRes.data || []) as unknown as (Course & { department_id?: string })[]);
      const filteredByDept = s.department_id
        ? allCourses.filter((c) => {
            // Show: general courses, courses with no dept, or courses matching student's department UUID
            return c.is_general || !c.department_id || c.department_id === s.department_id;
          })
        : allCourses;

      setCourses(filteredByDept);
      setRegistrations((regsRes.data || []) as Registration[]);

      // Load pending edit requests for this student+session
      const { data: editReqs } = await db
        .from("course_edit_requests")
        .select("id, registration_id, old_course_id, status")
        .eq("student_id", s.id)
        .eq("session", session || "")
        .eq("status", "pending");
      setEditRequests((editReqs || []) as EditRequest[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const register = async (courseId: string) => {
    if (!db || !studentId) return;
    setActionId(courseId);
    try {
      const { error } = await db.from("semester_registrations").insert({
        student_id: studentId,
        course_id:  courseId,
        status:     "registered",
        session:    currentSession || null,
        semester:   currentSemester || null,
      } as any);
      if (error) { showToast({ message: "Registration failed. Please try again.", variant: "error" }); return; }
      showToast({ message: "Course registered!", variant: "success" });
      await load(true);
    } finally { setActionId(null); }
  };

  const drop = async (regId: string, courseId: string) => {
    if (!db) return;
    setActionId(courseId);
    try {
      const { error } = await db.from("semester_registrations").delete().eq("id", regId);
      if (error) { showToast({ message: "Could not drop course.", variant: "error" }); return; }
      showToast({ message: "Course dropped.", variant: "success" });
      await load(true);
    } finally { setActionId(null); }
  };

  const submitEditRequest = async () => {
    if (!db || !studentId || !editCourse) return;
    if (!editReason.trim()) { showToast({ message: "Please provide a reason for your request.", variant: "warning" }); return; }
    setEditSubmitting(true);
    try {
      const { error } = await db.from("course_edit_requests").insert({
        student_id:      studentId,
        registration_id: editCourse.regId || null,
        old_course_id:   editCourse.id,
        request_type:    "drop",
        reason:          editReason.trim(),
        status:          "pending",
        session:         currentSession || null,
        semester:        currentSemester || null,
      } as any);
      if (error) throw error;
      showToast({ message: "Edit request submitted. Await admin approval.", variant: "success" });
      setEditModal(false);
      setEditReason("");
      setEditCourse(null);
      await load(true);
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to submit request.", variant: "error" });
    } finally { setEditSubmitting(false); }
  };

  const hasPendingRequest = (courseId: string) =>
    editRequests.some((r) => r.old_course_id === courseId);

  const isRegistered   = (id: string) => registrations.find((r) => r.course_id === id);
  const registered     = courses.filter((c) => isRegistered(c.id));
  const totalUnits     = registered.reduce((s, c) => s + c.credit_units, 0);
  const levels         = [...new Set(courses.map((c) => c.level))].sort();

  const filtered = courses.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.course_code.toLowerCase().includes(q) || c.course_name.toLowerCase().includes(q);
    const matchLevel  = !filterLevel || c.level === filterLevel;
    return matchSearch && matchLevel;
  });

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Course Registration" onLogout={async () => signOut()}>
      {/* Course Edit Request Modal */}
      <Modal visible={editModal} transparent animationType="fade" onRequestClose={() => setEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
            <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
              <Text variant="label" weight="bold" color="primary">Request Course Edit</Text>
              <TouchableOpacity onPress={() => { setEditModal(false); setEditReason(""); }} activeOpacity={0.75}>
                <Icon name="ui-close" size="md" color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            {editCourse && (
              <View style={[styles.coursePreview, { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle }]}>
                <Text variant="label" weight="semibold" color="primary">{editCourse.course_code}</Text>
                <Text variant="caption" color="secondary" numberOfLines={2}>{editCourse.course_name}</Text>
              </View>
            )}
            <Text variant="micro" color="muted" style={{ marginBottom: spacing[2] }}>
              Provide a reason for requesting to drop or edit this course. Your request will be reviewed by admin.
            </Text>
            <TextInput
              style={[styles.reasonInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
              value={editReason}
              onChangeText={setEditReason}
              placeholder="Reason for edit request..."
              placeholderTextColor={colors.text.muted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3] }]}>
              <TouchableOpacity
                onPress={() => { setEditModal(false); setEditReason(""); }}
                activeOpacity={0.75}
                style={[styles.modalBtn, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT, flex: 1 }]}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitEditRequest}
                disabled={editSubmitting}
                activeOpacity={0.75}
                style={[styles.modalBtn, { backgroundColor: brand.blue, flex: 1 }]}
              >
                {editSubmitting ? (
                  <Spinner size="sm" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Submit Request</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">Course Registration</Text>
          <Text variant="caption" color={regOpen ? "success" : "error"}>
            {regOpen ? "Registration is open" : "Registration is currently closed"}
          </Text>
          {(currentSession || currentSemester) && (
            <Text variant="micro" color="muted" style={{ marginTop: 2 }}>
              {[currentSession, currentSemester ? `${currentSemester} Semester` : ""].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>

        {/* Summary */}
        <Card variant={totalUnits > 0 ? "brand" : "default"}>
          <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
            <View>
              <Text variant="caption" color="secondary">Registered courses</Text>
              <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: brand.blue }}>{registered.length}</Text>
            </View>
            <View>
              <Text variant="caption" color="secondary">Total units</Text>
              <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: totalUnits >= 15 ? colors.status.success : colors.status.warning }}>{totalUnits}</Text>
            </View>
            <Badge label={regOpen ? "Open" : "Closed"} variant={regOpen ? "green" : "red"} dot size="md" />
          </View>
        </Card>

        {/* My registered courses */}
        {registered.length > 0 && (
          <View>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[2] }}>My registered courses</Text>
            {registered.map((c) => {
              const reg = isRegistered(c.id)!;
              return (
                <Card key={c.id} style={{ marginBottom: spacing[2] }} padding="sm">
                  <View style={[layout.rowBetween]}>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{c.course_code} — {c.course_name}</Text>
                      <Text variant="micro" color="muted">{c.credit_units} units · {c.semester} · {(c.lecturers as any)?.full_name || "TBA"}</Text>
                    </View>
                    {regOpen ? (
                      <Button label={actionId === c.id ? "..." : "Drop"} variant="danger" size="xs" loading={actionId === c.id} onPress={() => drop(reg.id, c.id)} />
                    ) : hasPendingRequest(c.id) ? (
                      <Badge label="Requested" variant="amber" dot size="sm" />
                    ) : (
                      <TouchableOpacity
                        onPress={() => { setEditCourse({ ...c, regId: reg.id }); setEditModal(true); }}
                        activeOpacity={0.75}
                        style={[styles.editReqBtn, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}
                      >
                        <Icon name="action-edit" size="xs" color={colors.text.muted} />
                        <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>Request Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Search + filter */}
        {!loading && (
          <View style={{ gap: spacing[2] }}>
            <Input value={search} onChangeText={setSearch} placeholder="Search courses..." iconLeft="action-search" containerStyle={{ marginBottom: 0 }} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <TouchableOpacity onPress={() => setFilterLevel("")} style={[styles.filterChip, { backgroundColor: !filterLevel ? brand.blue : colors.bg.hover, borderColor: !filterLevel ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, color: !filterLevel ? "#fff" : colors.text.secondary }}>All levels</Text>
                </TouchableOpacity>
                {levels.map((l) => (
                  <TouchableOpacity key={l} onPress={() => setFilterLevel(l === filterLevel ? "" : l)} style={[styles.filterChip, { backgroundColor: filterLevel === l ? brand.blue : colors.bg.hover, borderColor: filterLevel === l ? brand.blue : colors.border.DEFAULT }]}>
                    <Text style={{ fontSize: fontSize.sm, color: filterLevel === l ? "#fff" : colors.text.secondary }}>{l} Level</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* All courses */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[10] }]}><Spinner size="lg" /></View>
        ) : filtered.length === 0 ? (
          <EmptyState icon="nav-courses" title="No courses found" description="Try a different search or level filter." />
        ) : (
          filtered.map((c) => {
            const reg = isRegistered(c.id);
            return (
              <Card key={c.id} style={{ marginBottom: spacing[2] }}>
                <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[2] }]}>
                  <View style={layout.fill}>
                    <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap", marginBottom: spacing[1] }]}>
                      <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>{c.course_code}</Text>
                      <Badge label={`${c.credit_units}u`} variant="gray" size="sm" />
                      <Badge label={c.level} variant="blue" size="sm" />
                      <Badge label={c.semester} variant="indigo" size="sm" />
                    </View>
                    <Text variant="caption" color="secondary">{c.course_name}</Text>
                    {(c.lecturers as any)?.full_name && <Text variant="micro" color="muted">{(c.lecturers as any).full_name}</Text>}
                  </View>
                  {reg ? (
                    <Badge label="Registered" variant="green" dot />
                  ) : regOpen ? (
                    <Button label={actionId === c.id ? "..." : "Register"} variant="primary" size="sm" loading={actionId === c.id} onPress={() => register(c.id)} />
                  ) : null}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  filterChip:   { paddingHorizontal: spacing[3], paddingVertical: spacing[1] + spacing[1], borderRadius: radius.lg, borderWidth: 1 },
  editReqBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[1], paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md, borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing[5] },
  modalBox:     { width: "100%", maxWidth: 420, borderRadius: radius["2xl"], borderWidth: 1, padding: spacing[5] },
  coursePreview:{ padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, marginBottom: spacing[3] },
  reasonInput:  { borderWidth: 1, borderRadius: radius.md, padding: spacing[3], fontSize: fontSize.sm, minHeight: 80, marginBottom: spacing[1] },
  modalBtn:     { paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
});
