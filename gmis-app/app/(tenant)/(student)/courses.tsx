// ============================================================
// GMIS — Course Registration
// Route: /(tenant)/(student)/courses
// Tables: courses, semester_registrations, org_settings
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Button, Input, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Course {
  id: string; course_code: string; course_name: string;
  credit_units: number; level: string; semester: string;
  departments?: { name: string }; lecturers?: { full_name: string };
}
interface Registration { id: string; course_id: string; status: string; }

export default function CourseRegistration() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [studentId,      setStudentId]      = useState<string | null>(null);
  const [courses,        setCourses]        = useState<Course[]>([]);
  const [registrations,  setRegistrations]  = useState<Registration[]>([]);
  const [regOpen,        setRegOpen]        = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [actionId,       setActionId]       = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filterLevel,    setFilterLevel]    = useState("");
  const [toast,          setToast]          = useState<{ msg: string; type: "error"|"success" } | null>(null);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const showToast = (msg: string, type: "error"|"success" = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      // Get student + org settings in parallel
      const [sRes, settingsRes] = await Promise.all([
        db.from("students").select("id, level").eq("supabase_uid", user.id).maybeSingle(),
        db.from("org_settings").select("registration_open, current_session, current_semester").maybeSingle(),
      ]);

      if (!sRes.data) { setLoading(false); return; }
      const s = sRes.data as any;
      setStudentId(s.id);

      const settings = settingsRes.data as any;
      setRegOpen(settings?.registration_open || false);

      // Load all active courses + student's registrations
      const [coursesRes, regsRes] = await Promise.all([
        db.from("courses")
          .select("id, course_code, course_name, credit_units, level, semester, departments(name), lecturers(full_name)")
          .eq("is_active", true)
          .order("course_code"),
        db.from("semester_registrations")
          .select("id, course_id, status")
          .eq("student_id", s.id)
          .eq("session", settings?.current_session || "2024/2025"),
      ]);

      setCourses((coursesRes.data || []) as Course[]);
      setRegistrations((regsRes.data || []) as Registration[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const register = async (courseId: string) => {
    if (!db || !studentId) return;
    setActionId(courseId);
    try {
      const { error } = await db.from("semester_registrations").insert({ student_id: studentId, course_id: courseId, status: "registered" } as any);
      if (error) { showToast("Registration failed. Please try again."); return; }
      showToast("Course registered!", "success");
      await load(true);
    } finally { setActionId(null); }
  };

  const drop = async (regId: string, courseId: string) => {
    if (!db) return;
    setActionId(courseId);
    try {
      const { error } = await db.from("semester_registrations").delete().eq("id", regId);
      if (error) { showToast("Could not drop course."); return; }
      showToast("Course dropped.", "success");
      await load(true);
    } finally { setActionId(null); }
  };

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
      {toast && (
        <View style={[styles.toast, { backgroundColor: toast.type === "error" ? colors.status.errorBg : colors.status.successBg, borderColor: toast.type === "error" ? colors.status.errorBorder : colors.status.successBorder }]}>
          <Icon name={toast.type === "error" ? "status-error" : "status-success"} size="sm" color={toast.type === "error" ? colors.status.error : colors.status.success} />
          <Text style={{ flex: 1, fontSize: fontSize.sm, color: toast.type === "error" ? colors.status.error : colors.status.success, marginLeft: spacing[2] }}>{toast.msg}</Text>
        </View>
      )}

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
                    {regOpen && (
                      <Button label={actionId === c.id ? "..." : "Drop"} variant="danger" size="xs" loading={actionId === c.id} onPress={() => drop(reg.id, c.id)} />
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
  toast:      { position: "absolute", top: spacing[12], left: spacing[4], right: spacing[4], zIndex: 100, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  filterChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1] + spacing[1], borderRadius: radius.lg, borderWidth: 1 },
});
