// ============================================================
// GMIS — Admin Approvals
// Route: /(tenant)/(admin)/approvals
// Tabs: Student Registrations | Course Edit Requests
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { useToast }        from "@/components/ui/Toast";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

interface PendingStudent {
  id: string; first_name: string; last_name: string;
  matric_number: string; email: string; level: string;
  gender: string | null; created_at: string;
  department_id: string | null; dept_name?: string;
}

interface CourseEditRequest {
  id: string; request_type: string; reason: string | null;
  status: string; session: string | null; semester: string | null; created_at: string;
  student_name: string; matric_number: string;
  old_course_code: string; old_course_name: string;
  new_course_code?: string; new_course_name?: string;
}

type Tab = "students" | "course-edits";

export default function AdminApprovals() {
  const router              = useRouter();
  const { user, signOut }   = useAuth();
  const { tenant, slug }    = useTenant();
  const { colors }          = useTheme();
  const { pagePadding }     = useResponsive();
  const { showToast }       = useToast();

  const [activeTab,    setActiveTab]    = useState<Tab>("students");
  const [students,     setStudents]     = useState<PendingStudent[]>([]);
  const [editRequests, setEditRequests] = useState<CourseEditRequest[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [acting,       setActing]       = useState<string | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db) load(); }, [db], { hasData: students.length > 0 || editRequests.length > 0 });

  const load = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);

    const [studRes, editRes] = await Promise.all([
      db.from("students")
        .select("id, first_name, last_name, matric_number, email, level, gender, created_at, department_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      db.from("course_edit_requests")
        .select(`id, request_type, reason, status, session, semester, created_at,
          students(first_name, last_name, matric_number),
          old_course:courses!old_course_id(course_code, course_name),
          new_course:courses!new_course_id(course_code, course_name)`)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    // Process students
    if (studRes.data) {
      const deptIds = [...new Set((studRes.data as any[]).map((s) => s.department_id).filter(Boolean))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length) {
        const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
        (depts || []).forEach((d: any) => { deptMap[d.id] = d.name; });
      }
      setStudents((studRes.data as any[]).map((s) => ({ ...s, dept_name: s.department_id ? deptMap[s.department_id] || "" : "" })));
    }

    // Process edit requests
    if (editRes.data) {
      setEditRequests((editRes.data as any[]).map((r) => ({
        id:             r.id,
        request_type:   r.request_type,
        reason:         r.reason,
        status:         r.status,
        session:        r.session,
        semester:       r.semester,
        created_at:     r.created_at,
        student_name:   r.students ? `${(r.students as any).first_name} ${(r.students as any).last_name}` : "Unknown",
        matric_number:  r.students ? (r.students as any).matric_number : "—",
        old_course_code: r.old_course ? (r.old_course as any).course_code : "—",
        old_course_name: r.old_course ? (r.old_course as any).course_name : "—",
        new_course_code: r.new_course ? (r.new_course as any).course_code : undefined,
        new_course_name: r.new_course ? (r.new_course as any).course_name : undefined,
      })));
    }

    setLoading(false);
    setRefreshing(false);
  };

  // ── Student approval actions ─────────────────────────────
  const approveStudent = async (id: string) => {
    if (!db) return;
    setActing(id);
    const { error } = await db.from("students").update({ status: "active" } as any).eq("id", id);
    if (error) { showToast({ message: "Failed to approve.", variant: "error" }); }
    else       { showToast({ message: "Student approved!", variant: "success" }); setStudents((p) => p.filter((s) => s.id !== id)); }
    setActing(null);
  };

  const rejectStudent = async (id: string) => {
    if (!db) return;
    setActing(id);
    const { error } = await db.from("students").update({ status: "rejected" } as any).eq("id", id);
    if (error) { showToast({ message: "Failed to reject.", variant: "error" }); }
    else       { showToast({ message: "Student rejected.", variant: "info" }); setStudents((p) => p.filter((s) => s.id !== id)); }
    setActing(null);
  };

  // ── Course edit request actions ──────────────────────────
  const approveEditRequest = async (req: CourseEditRequest) => {
    if (!db) return;
    setActing(req.id);
    try {
      // If it's a drop request and we have registration_id, delete the registration
      const { error } = await db.from("course_edit_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() } as any)
        .eq("id", req.id);
      if (error) throw error;
      // If drop — remove the actual registration
      if (req.request_type === "drop" || req.request_type === "add") {
        // For drop: remove semester_registration by old_course_id + student
        // We'll look up by student + course from the request
        const { data: studRec } = await db.from("students")
          .select("id").eq("matric_number", req.matric_number).maybeSingle();
        if (studRec && req.old_course_code) {
          const { data: courseRec } = await db.from("courses")
            .select("id").eq("course_code", req.old_course_code).maybeSingle();
          if (courseRec) {
            await db.from("semester_registrations")
              .delete()
              .eq("student_id", (studRec as any).id)
              .eq("course_id", (courseRec as any).id)
              .eq("session", req.session || "");
          }
        }
      }
      showToast({ message: "Edit request approved.", variant: "success" });
      setEditRequests((p) => p.filter((r) => r.id !== req.id));
    } catch (err: any) {
      showToast({ message: err?.message || "Failed to approve.", variant: "error" });
    } finally { setActing(null); }
  };

  const rejectEditRequest = async (id: string) => {
    if (!db) return;
    setActing(id);
    const { error } = await db.from("course_edit_requests")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { showToast({ message: "Failed to reject.", variant: "error" }); }
    else       { showToast({ message: "Request rejected.", variant: "info" }); setEditRequests((p) => p.filter((r) => r.id !== id)); }
    setActing(null);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Approvals"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <View style={layout.rowBetween}>
          <View>
            <Text variant="heading" color="primary">Approvals</Text>
            <Text variant="caption" color="muted">Review pending requests</Text>
          </View>
          <View style={[layout.row, { gap: spacing[2] }]}>
            {students.length > 0     && <Badge label={`${students.length} students`} variant="amber" />}
            {editRequests.length > 0 && <Badge label={`${editRequests.length} edits`} variant="blue" />}
          </View>
        </View>

        {/* Tabs */}
        <View style={[layout.row, { gap: spacing[2] }]}>
          {(["students", "course-edits"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.75}
              style={[styles.tab, {
                backgroundColor: activeTab === tab ? brand.gold : colors.bg.hover,
                borderColor:     activeTab === tab ? brand.gold : colors.border.DEFAULT,
              }]}
            >
              <Text style={{ fontSize: fontSize.sm, fontWeight: activeTab === tab ? fontWeight.bold : fontWeight.normal, color: activeTab === tab ? "#fff" : colors.text.secondary }}>
                {tab === "students" ? "Students" : "Course Edits"}
              </Text>
              {tab === "students" && students.length > 0 && (
                <View style={[styles.badge, { backgroundColor: activeTab === tab ? "rgba(255,255,255,0.3)" : brand.goldAlpha15 }]}>
                  <Text style={{ fontSize: fontSize["2xs"], color: activeTab === tab ? "#fff" : brand.gold, fontWeight: fontWeight.bold }}>{students.length}</Text>
                </View>
              )}
              {tab === "course-edits" && editRequests.length > 0 && (
                <View style={[styles.badge, { backgroundColor: activeTab === tab ? "rgba(255,255,255,0.3)" : brand.blueAlpha10 }]}>
                  <Text style={{ fontSize: fontSize["2xs"], color: activeTab === tab ? "#fff" : brand.blue, fontWeight: fontWeight.bold }}>{editRequests.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
            <Spinner size="lg" label="Loading approvals..." />
          </View>
        ) : activeTab === "students" ? (
          students.length === 0 ? (
            <EmptyState icon="status-pending" title="No pending approvals" description="All student registrations have been reviewed." />
          ) : (
            students.map((s) => (
              <Card key={s.id}>
                <View style={layout.rowBetween}>
                  <View style={[layout.row, { gap: spacing[3], flex: 1 }]}>
                    <View style={[styles.avatar, { backgroundColor: brand.goldAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.black, color: brand.gold }}>
                        {s.first_name[0]}{s.last_name[0]}
                      </Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="label" weight="bold" color="primary">{s.first_name} {s.last_name}</Text>
                      <Text variant="caption" color="muted">{s.matric_number} · {s.email}</Text>
                      {s.dept_name ? <Text variant="micro" color="muted">{s.dept_name} · {s.level} Level</Text> : null}
                      <Text variant="micro" color="muted">Registered {new Date(s.created_at).toLocaleDateString("en-NG")}</Text>
                    </View>
                  </View>
                </View>
                <View style={[layout.row, { gap: spacing[3], marginTop: spacing[4] }]}>
                  <TouchableOpacity
                    onPress={() => approveStudent(s.id)}
                    disabled={acting === s.id}
                    activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder, flex: 1 }]}
                  >
                    <Icon name="ui-check" size="sm" color={colors.status.success} />
                    <Text style={{ color: colors.status.success, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                      {acting === s.id ? "Approving..." : "Approve"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectStudent(s.id)}
                    disabled={acting === s.id}
                    activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder, flex: 1 }]}
                  >
                    <Icon name="ui-close" size="sm" color={colors.status.error} />
                    <Text style={{ color: colors.status.error, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )
        ) : (
          editRequests.length === 0 ? (
            <EmptyState icon="nav-courses" title="No pending course edits" description="All course edit requests have been reviewed." />
          ) : (
            editRequests.map((req) => (
              <Card key={req.id}>
                <View style={[layout.rowBetween, { marginBottom: spacing[2] }]}>
                  <View style={layout.fill}>
                    <Text variant="label" weight="bold" color="primary">{req.student_name}</Text>
                    <Text variant="micro" color="muted">{req.matric_number}</Text>
                  </View>
                  <Badge
                    label={req.request_type}
                    variant={req.request_type === "drop" ? "red" : req.request_type === "add" ? "green" : "blue"}
                    size="sm"
                  />
                </View>

                {/* Course info */}
                <View style={[styles.courseBox, { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle }]}>
                  <View style={[layout.row, { gap: spacing[2], marginBottom: req.new_course_code ? spacing[2] : 0 }]}>
                    <Icon name="nav-courses" size="xs" color={colors.text.muted} />
                    <View style={layout.fill}>
                      <Text variant="micro" color="muted">Current course</Text>
                      <Text variant="caption" weight="semibold" color="primary">{req.old_course_code} — {req.old_course_name}</Text>
                    </View>
                  </View>
                  {req.new_course_code && (
                    <View style={[layout.row, { gap: spacing[2] }]}>
                      <Icon name="ui-forward" size="xs" color={colors.status.success} />
                      <View style={layout.fill}>
                        <Text variant="micro" color="muted">Swap to</Text>
                        <Text variant="caption" weight="semibold" color="success">{req.new_course_code} — {req.new_course_name}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {req.reason ? (
                  <View style={{ marginTop: spacing[2] }}>
                    <Text variant="micro" color="muted">Reason:</Text>
                    <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{req.reason}</Text>
                  </View>
                ) : null}

                <View style={[layout.row, { gap: spacing[2], marginTop: spacing[3] }]}>
                  <Text variant="micro" color="muted" style={layout.fill}>
                    {req.session}{req.semester ? ` · ${req.semester}` : ""} · {new Date(req.created_at).toLocaleDateString("en-NG")}
                  </Text>
                </View>

                <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3] }]}>
                  <TouchableOpacity
                    onPress={() => approveEditRequest(req)}
                    disabled={acting === req.id}
                    activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder, flex: 1 }]}
                  >
                    <Icon name="ui-check" size="sm" color={colors.status.success} />
                    <Text style={{ color: colors.status.success, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>
                      {acting === req.id ? "Processing..." : "Approve"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => rejectEditRequest(req.id)}
                    disabled={acting === req.id}
                    activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder, flex: 1 }]}
                  >
                    <Icon name="ui-close" size="sm" color={colors.status.error} />
                    <Text style={{ color: colors.status.error, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  tab:       { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1 },
  badge:     { paddingHorizontal: spacing[2], paddingVertical: 1, borderRadius: radius.full, minWidth: 18, alignItems: "center" },
  avatar:    { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2], paddingVertical: spacing[2], paddingHorizontal: spacing[4], borderRadius: radius.lg, borderWidth: 1 },
  courseBox: { borderRadius: radius.md, borderWidth: 1, padding: spacing[3], marginTop: spacing[2] },
});
