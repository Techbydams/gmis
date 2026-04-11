// ============================================================
// GMIS — Admin Results Management
// Route: /(tenant)/(admin)/results
//
// Features:
//   • Filter by session, semester, department, level, course, student
//   • Publish / unpublish results per course
//   • Lock / unlock course results (after lecturer submission)
//   • Admin can edit, add, or delete individual result entries
//   • Lecturer's results auto-lock on submission; admin unlocks
//   • View results in table form with calculated grade
//   • Search by course code or name
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert, ActivityIndicator,
} from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }        from "@/components/ui/Toast";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { StatCard }        from "@/components/ui/StatCard";
import { Spinner }         from "@/components/ui/Spinner";
import { EmptyState }      from "@/components/ui/EmptyState";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface CourseResult {
  id: string;
  course_code: string;
  course_name: string;
  level: string;
  semester: string;
  department_id: string | null;
  dept_name?: string;
  session: string | null;
  published: boolean;
  is_locked: boolean;
  result_count: number;
}

interface ResultEntry {
  id: string;
  student_id: string;
  student_name: string;
  matric_number: string;
  score: number;
  grade: string;
  credit_units: number;
  is_locked: boolean;
  published: boolean;
}

interface FilterState {
  session:    string;
  semester:   string;
  dept:       string;
  level:      string;
  search:     string;
}

interface GradingRule {
  min_score: number;
  max_score: number;
  grade: string;
  grade_point: number;
}

function computeGrade(score: number, grading: GradingRule[]): string {
  const sorted = [...grading].sort((a, b) => b.min_score - a.min_score);
  return sorted.find((g) => score >= g.min_score && score <= g.max_score)?.grade || "F";
}

// ── Edit Result Sheet ──────────────────────────────────────
function EditResultSheet({ visible, onClose, entry, onSave, colors, grading }: {
  visible: boolean; onClose: () => void; entry: ResultEntry | null;
  onSave: (id: string, patch: { score: number; grade: string }) => Promise<void>;
  colors: any; grading: GradingRule[];
}) {
  const [score,  setScore]  = useState(entry?.score.toString() || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) setScore(entry?.score.toString() || ""); }, [visible, entry]);

  const parsedScore    = parseFloat(score);
  const computedGrade  = !isNaN(parsedScore) && grading.length > 0 ? computeGrade(parsedScore, grading) : entry?.grade || "—";

  const handleSave = async () => {
    const s = parseFloat(score);
    if (isNaN(s) || s < 0 || s > 100) { Alert.alert("Invalid score", "Score must be 0–100."); return; }
    if (!entry) return;
    setSaving(true);
    try { await onSave(entry.id, { score: s, grade: computedGrade }); onClose(); }
    catch { Alert.alert("Error", "Failed to save result."); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={380}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">Edit Result</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>
      {entry && (
        <View style={[styles.studentChip, { backgroundColor: colors.bg.hover, marginBottom: spacing[4] }]}>
          <Text variant="label" weight="semibold" color="primary">{entry.student_name}</Text>
          <Text variant="micro" color="muted">{entry.matric_number}</Text>
        </View>
      )}
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>SCORE (0 – 100)</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT, fontSize: 28, textAlign: "center", fontWeight: fontWeight.black }]}
        value={score} onChangeText={setScore} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.text.muted} maxLength={5}
      />
      <View style={[styles.gradePreview, { backgroundColor: brand.blueAlpha10, marginTop: spacing[3] }]}>
        <Text variant="caption" color="muted">Computed grade</Text>
        <Text style={{ fontSize: 32, fontWeight: fontWeight.black, color: brand.blue }}>{computedGrade}</Text>
      </View>
      <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.75} style={[styles.saveBtn, { backgroundColor: brand.blue, marginTop: spacing[5] }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Save Result</Text>}
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Course Results Sheet ───────────────────────────────────
function CourseResultsSheet({ visible, onClose, course, db, grading, onRefresh, colors, showToast }: {
  visible: boolean; onClose: () => void; course: CourseResult | null;
  db: any; grading: GradingRule[]; onRefresh: () => void; colors: any; showToast: (c: any) => void;
}) {
  const [entries,   setEntries]   = useState<ResultEntry[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [editEntry, setEditEntry] = useState<ResultEntry | null>(null);
  const [editSheet, setEditSheet] = useState(false);

  useEffect(() => { if (visible && course && db) loadEntries(); }, [visible, course]);

  const loadEntries = async () => {
    if (!course || !db) return;
    setLoading(true);
    try {
      const { data: resData } = await db
        .from("results")
        .select("id, student_id, score, grade, credit_units, is_locked, published")
        .eq("course_id", course.id)
        .order("score", { ascending: false });
      if (!resData || resData.length === 0) { setEntries([]); return; }
      const studentIds = resData.map((r: any) => r.student_id).filter(Boolean);
      const { data: stuData } = await db.from("students").select("id, first_name, last_name, matric_number").in("id", studentIds);
      const stuMap: Record<string, any> = {};
      (stuData || []).forEach((s: any) => { stuMap[s.id] = s; });
      setEntries(resData.map((r: any) => ({
        id: r.id, student_id: r.student_id,
        student_name: stuMap[r.student_id] ? `${stuMap[r.student_id].first_name} ${stuMap[r.student_id].last_name}` : "Unknown",
        matric_number: stuMap[r.student_id]?.matric_number || "—",
        score: r.score, grade: r.grade, credit_units: r.credit_units, is_locked: r.is_locked, published: r.published,
      })));
    } finally { setLoading(false); }
  };

  const handleSaveResult = async (id: string, patch: { score: number; grade: string }) => {
    if (!db) throw new Error("No DB");
    await db.from("results").update(patch as any).eq("id", id);
    await loadEntries(); onRefresh();
    showToast({ message: "Result updated.", variant: "success" });
  };

  const deleteEntry = (entry: ResultEntry) => {
    Alert.alert("Delete Result", `Delete result for ${entry.student_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!db) return;
        await db.from("results").delete().eq("id", entry.id);
        await loadEntries(); onRefresh();
        showToast({ message: "Result deleted.", variant: "info" });
      }},
    ]);
  };

  if (!course) return null;

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={640}>
      <View style={[layout.rowBetween, { marginBottom: spacing[4] }]}>
        <View style={layout.fill}>
          <Text variant="subtitle" weight="bold" color="primary" numberOfLines={1}>{course.course_code}</Text>
          <Text variant="caption" color="muted" numberOfLines={1}>{course.course_name}</Text>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>
      <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[4] }]}>
        <Badge label={course.published ? "Published" : "Draft"} variant={course.published ? "green" : "amber"} size="sm" />
        <Badge label={course.is_locked ? "Locked" : "Unlocked"} variant={course.is_locked ? "red" : "gray"} size="sm" />
        <Badge label={`${entries.length} entries`} variant="blue" size="sm" />
      </View>
      {loading ? (
        <View style={[layout.centred, { paddingVertical: spacing[8] }]}><Spinner size="md" label="Loading..." /></View>
      ) : entries.length === 0 ? (
        <View style={[layout.centred, { paddingVertical: spacing[8] }]}>
          <Text variant="body" color="muted" align="center">No results entered for this course.</Text>
        </View>
      ) : (
        <>
          <View style={[styles.tableHeader, { backgroundColor: colors.bg.hover }]}>
            <Text style={[styles.colMatric, { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>MATRIC</Text>
            <Text style={[styles.colName,   { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>NAME</Text>
            <Text style={[styles.colScore,  { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: "center" }]}>SCORE</Text>
            <Text style={[styles.colGrade,  { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textAlign: "center" }]}>GRADE</Text>
            <View style={styles.colActions} />
          </View>
          {entries.map((entry, i) => (
            <View key={entry.id} style={[styles.tableRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < entries.length - 1 ? 1 : 0 }]}>
              <Text style={[styles.colMatric, { color: colors.text.muted, fontSize: fontSize.xs }]} numberOfLines={1}>{entry.matric_number}</Text>
              <Text style={[styles.colName,   { color: colors.text.primary, fontSize: fontSize.xs, fontWeight: fontWeight.medium }]} numberOfLines={1}>{entry.student_name}</Text>
              <Text style={[styles.colScore,  { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: "center" }]}>{entry.score}</Text>
              <View style={[styles.colGrade, { alignItems: "center" }]}>
                <View style={[styles.gradeTag, { backgroundColor: entry.grade === "A" ? brand.emeraldAlpha15 : entry.grade?.startsWith("F") ? "rgba(239,68,68,0.12)" : brand.blueAlpha10 }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: entry.grade === "A" ? brand.emerald : entry.grade?.startsWith("F") ? "#ef4444" : brand.blue }}>{entry.grade || "—"}</Text>
                </View>
              </View>
              <View style={[styles.colActions, { flexDirection: "row", gap: spacing[1] }]}>
                {!course.is_locked && (
                  <TouchableOpacity onPress={() => { setEditEntry(entry); setEditSheet(true); }} activeOpacity={0.7} style={styles.iconBtn}>
                    <Icon name="ui-more" size="xs" color={brand.blue} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => deleteEntry(entry)} activeOpacity={0.7} style={styles.iconBtn}>
                  <Icon name="ui-close" size="xs" color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}
      <EditResultSheet
        visible={editSheet} onClose={() => setEditSheet(false)}
        entry={editEntry} onSave={handleSaveResult} colors={colors} grading={grading}
      />
    </BottomSheet>
  );
}

// ── Filter chip ────────────────────────────────────────────
function FilterChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: any }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}
      style={[styles.filterChip, { backgroundColor: active ? brand.blue : colors.bg.hover, borderColor: active ? brand.blue : colors.border.DEFAULT }]}>
      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminResults() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [courses,        setCourses]        = useState<CourseResult[]>([]);
  const [sessions,       setSessions]       = useState<string[]>([]);
  const [depts,          setDepts]          = useState<{ id: string; name: string }[]>([]);
  const [grading,        setGrading]        = useState<GradingRule[]>([]);
  const [stats,          setStats]          = useState({ total: 0, published: 0, locked: 0 });
  const [filters,        setFilters]        = useState<FilterState>({ session: "", semester: "", dept: "", level: "", search: "" });
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<CourseResult | null>(null);
  const [courseSheet,    setCourseSheet]    = useState(false);
  const [bulkLoading,    setBulkLoading]    = useState<string | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const [coursesRes, deptsRes, gradingRes] = await Promise.allSettled([
        db.from("courses").select("id, course_code, course_name, level, semester, department_id, session, published, is_locked").eq("is_active", true).order("course_code"),
        db.from("departments").select("id, name").order("name"),
        db.from("grading_system").select("min_score, max_score, grade, grade_point").order("min_score", { ascending: false }),
      ]);

      let allCourses: CourseResult[] = [];
      if (coursesRes.status === "fulfilled" && coursesRes.value.data) {
        const raw = coursesRes.value.data as any[];
        const deptMap: Record<string, string> = {};
        if (deptsRes.status === "fulfilled") {
          (deptsRes.value.data || []).forEach((d: any) => { deptMap[d.id] = d.name; });
          setDepts((deptsRes.value.data || []) as any[]);
        }
        const { data: counts } = await db.from("results").select("course_id");
        const countMap: Record<string, number> = {};
        (counts || []).forEach((r: any) => { countMap[r.course_id] = (countMap[r.course_id] || 0) + 1; });
        allCourses = raw.map((c) => ({
          id: c.id, course_code: c.course_code, course_name: c.course_name,
          level: c.level, semester: c.semester, department_id: c.department_id,
          dept_name: c.department_id ? deptMap[c.department_id] || "General" : "General",
          session: c.session, published: c.published ?? false, is_locked: c.is_locked ?? false,
          result_count: countMap[c.id] || 0,
        }));
        setCourses(allCourses);
        setSessions([...new Set(raw.map((c) => c.session).filter(Boolean))]);
      }
      if (gradingRes.status === "fulfilled") setGrading((gradingRes.value.data || []) as GradingRule[]);
      setStats({ total: allCourses.length, published: allCourses.filter((c) => c.published).length, locked: allCourses.filter((c) => c.is_locked).length });
    } finally { setLoading(false); setRefreshing(false); }
  }, [db]);

  const togglePublish = async (course: CourseResult) => {
    if (!db) return;
    setBulkLoading(course.id);
    const newState = !course.published;
    await db.from("courses").update({ published: newState } as any).eq("id", course.id);
    await db.from("results").update({ published: newState } as any).eq("course_id", course.id);
    setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, published: newState } : c));
    setStats((s) => ({ ...s, published: s.published + (newState ? 1 : -1) }));
    showToast({ message: newState ? "Results published!" : "Results unpublished.", variant: newState ? "success" : "info" });
    setBulkLoading(null);
  };

  const toggleLock = async (course: CourseResult) => {
    if (!db) return;
    setBulkLoading(course.id + "L");
    const newState = !course.is_locked;
    await db.from("courses").update({ is_locked: newState } as any).eq("id", course.id);
    await db.from("results").update({ is_locked: newState } as any).eq("course_id", course.id);
    setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, is_locked: newState } : c));
    setStats((s) => ({ ...s, locked: s.locked + (newState ? 1 : -1) }));
    showToast({ message: newState ? "Results locked." : "Results unlocked.", variant: "info" });
    setBulkLoading(null);
  };

  const filtered = courses.filter((c) => {
    if (filters.session  && c.session       !== filters.session)  return false;
    if (filters.semester && c.semester      !== filters.semester) return false;
    if (filters.dept     && c.department_id !== filters.dept)     return false;
    if (filters.level    && c.level         !== filters.level)    return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.course_code.toLowerCase().includes(q) && !c.course_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const setFilter = (key: keyof FilterState, val: string) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === val ? "" : val }));

  const SEMESTERS = ["First Semester", "Second Semester", "Third Semester"];
  const LEVELS    = ["100", "200", "300", "400", "500", "600"];

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Results Management"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>

        <View style={[styles.searchWrap, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
            <Icon name="ui-search" size="md" color={colors.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: fontSize.md, color: colors.text.primary }}
              placeholder="Search course code or name..." placeholderTextColor={colors.text.muted}
              value={filters.search} onChangeText={(v) => setFilters((p) => ({ ...p, search: v }))}
            />
            {filters.search ? (
              <TouchableOpacity onPress={() => setFilters((p) => ({ ...p, search: "" }))}>
                <Icon name="ui-close" size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={[styles.filterScroll, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] }}>
          {sessions.map((s) => <FilterChip key={s}  label={s} active={filters.session === s} onPress={() => setFilter("session", s)} colors={colors} />)}
          {SEMESTERS.map((s) => <FilterChip key={s}  label={s.replace(" Semester", "")} active={filters.semester === s} onPress={() => setFilter("semester", s)} colors={colors} />)}
          {LEVELS.map((l)    => <FilterChip key={l}  label={`${l}L`} active={filters.level === l} onPress={() => setFilter("level", l)} colors={colors} />)}
          {depts.map((d)     => <FilterChip key={d.id} label={d.name} active={filters.dept === d.id} onPress={() => setFilter("dept", d.id)} colors={colors} />)}
        </ScrollView>

        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
        >
          <View style={[layout.row, { gap: spacing[3] }]}>
            <StatCard icon="nav-results"   label="Courses"   value={String(stats.total)}     color="brand"   style={{ flex: 1 }} />
            <StatCard icon="ui-check"      label="Published" value={String(stats.published)} color="success" style={{ flex: 1 }} />
            <StatCard icon="status-locked" label="Locked"    value={String(stats.locked)}    color="warning" style={{ flex: 1 }} />
          </View>

          {(filters.session || filters.semester || filters.dept || filters.level) && (
            <View style={[layout.rowBetween, styles.activeFilters, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
              <Text variant="caption" color="primary">Showing {filtered.length} of {courses.length} courses</Text>
              <TouchableOpacity onPress={() => setFilters({ session: "", semester: "", dept: "", level: "", search: "" })} activeOpacity={0.7}>
                <Text variant="caption" color="link">Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[16] }]}><Spinner size="lg" label="Loading results data..." /></View>
          ) : filtered.length === 0 ? (
            <EmptyState icon="nav-results" title="No courses found" description="Adjust your filters or add courses in Academic Setup." />
          ) : (
            filtered.map((course) => (
              <Card key={course.id}>
                <View style={layout.rowBetween}>
                  <View style={layout.fill}>
                    <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[1] }]}>
                      <Text variant="label" weight="bold" color="primary">{course.course_code}</Text>
                      {course.is_locked && <Badge label="Locked" variant="red" size="sm" />}
                      {course.published && <Badge label="Published" variant="green" size="sm" />}
                    </View>
                    <Text variant="caption" color="secondary" numberOfLines={1}>{course.course_name}</Text>
                    <Text variant="micro" color="muted" style={{ marginTop: spacing[1] }}>
                      {course.dept_name} · {course.level}L · {course.semester}{course.session ? ` · ${course.session}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.countBadge, { backgroundColor: brand.blueAlpha10 }]}>
                    <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: brand.blue }}>{course.result_count}</Text>
                    <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>entries</Text>
                  </View>
                </View>
                <View style={[layout.row, { gap: spacing[2], marginTop: spacing[4], flexWrap: "wrap" }]}>
                  <TouchableOpacity onPress={() => { setSelectedCourse(course); setCourseSheet(true); }} activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
                    <Icon name="nav-results" size="sm" color={brand.blue} />
                    <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold }}>View Entries</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => togglePublish(course)} disabled={bulkLoading === course.id} activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: course.published ? "rgba(239,68,68,0.10)" : brand.emeraldAlpha15, borderColor: course.published ? "rgba(239,68,68,0.30)" : "rgba(16,185,129,0.30)" }]}>
                    {bulkLoading === course.id
                      ? <ActivityIndicator size="small" color={course.published ? "#ef4444" : brand.emerald} />
                      : <>
                          <Icon name={course.published ? "status-error" : "status-success"} size="sm" color={course.published ? "#ef4444" : brand.emerald} />
                          <Text style={{ fontSize: fontSize.xs, color: course.published ? "#ef4444" : brand.emerald, fontWeight: fontWeight.semibold }}>{course.published ? "Unpublish" : "Publish"}</Text>
                        </>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleLock(course)} disabled={bulkLoading === course.id + "L"} activeOpacity={0.75}
                    style={[styles.actionBtn, { backgroundColor: course.is_locked ? brand.goldAlpha15 : "rgba(239,68,68,0.10)", borderColor: course.is_locked ? brand.goldAlpha20 : "rgba(239,68,68,0.25)" }]}>
                    {bulkLoading === course.id + "L"
                      ? <ActivityIndicator size="small" color={brand.gold} />
                      : <>
                          <Icon name={course.is_locked ? "status-unlocked" : "status-locked"} size="sm" color={course.is_locked ? brand.goldDark : "#ef4444"} />
                          <Text style={{ fontSize: fontSize.xs, color: course.is_locked ? brand.goldDark : "#ef4444", fontWeight: fontWeight.semibold }}>{course.is_locked ? "Unlock" : "Lock"}</Text>
                        </>
                    }
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>

      <CourseResultsSheet
        visible={courseSheet} onClose={() => { setCourseSheet(false); setSelectedCourse(null); }}
        course={selectedCourse} db={db} grading={grading} onRefresh={() => load(true)} colors={colors} showToast={showToast}
      />
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  searchWrap:    { padding: spacing[4], borderBottomWidth: 1 },
  searchBar:     { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  filterScroll:  { borderBottomWidth: 1, maxHeight: 56 },
  filterChip:    { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  activeFilters: { padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  countBadge:    { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, alignItems: "center", minWidth: 52 },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1 },
  tableHeader:   { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, marginBottom: spacing[2] },
  tableRow:      { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3] },
  colMatric:     { width: 80 },
  colName:       { flex: 1 },
  colScore:      { width: 44 },
  colGrade:      { width: 40 },
  colActions:    { width: 52, justifyContent: "flex-end" },
  gradeTag:      { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm },
  iconBtn:       { padding: spacing[2] },
  studentChip:   { padding: spacing[3], borderRadius: radius.lg },
  input:         { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  gradePreview:  { padding: spacing[4], borderRadius: radius.xl, alignItems: "center" },
  saveBtn:       { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
