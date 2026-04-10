// ============================================================
// GMIS — Admin Academic Setup
// Route: /(tenant)/(admin)/academic
// Full CRUD: Faculties → Departments → Courses → Lecturers
// All data fetched from confirmed tenant DB schema.
// No nested PostgREST joins that require undeclared FKs.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { isValidEmail }    from "@/lib/helpers";
import { Text, Card, Badge, Button, Spinner } from "@/components/ui";
import { SelectModal, type SelectOption } from "@/components/ui/SelectModal";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types — all columns confirmed from schema ─────────────
interface Faculty    { id: string; name: string; code: string; is_active: boolean }
interface Department { id: string; name: string; code: string; faculty_id: string; is_active: boolean }
interface Course {
  id: string; course_code: string; course_name: string; credit_units: number;
  level: string; semester: string; is_active: boolean; is_elective: boolean;
  department_id: string; lecturer_id: string | null;
  session: string | null;
}
interface Lecturer   { id: string; full_name: string; email: string; staff_id: string | null; department_id: string | null; is_active: boolean }

type Tab = "faculties" | "departments" | "courses" | "lecturers";

// ── Component ──────────────────────────────────────────────
export default function AdminAcademicSetup() {
  const router           = useRouter();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [tab,        setTab]        = useState<Tab>("faculties");
  const [faculties,  setFaculties]  = useState<Faculty[]>([]);
  const [departments,setDepartments]= useState<Department[]>([]);
  const [courses,    setCourses]    = useState<Course[]>([]);
  const [lecturers,  setLecturers]  = useState<Lecturer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving,     setSaving]     = useState(false);

  // Form visibility
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);

  // Generic form state
  const [form, setForm] = useState<Record<string, any>>({});
  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // Filters for courses
  const [filterDept,  setFilterDept]  = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) loadAll(); }, [db]);

  // ── Load ──────────────────────────────────────────────
  const loadAll = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    await Promise.all([loadFaculties(), loadDepartments(), loadCourses(), loadLecturers()]);
    setLoading(false);
    setRefreshing(false);
  };

  const loadFaculties   = async () => { if (!db) return; const { data } = await db.from("faculties").select("id, name, code, is_active").order("name"); if (data) setFaculties(data as Faculty[]); };
  const loadDepartments = async () => { if (!db) return; const { data } = await db.from("departments").select("id, name, code, faculty_id, is_active").order("name"); if (data) setDepartments(data as Department[]); };
  const loadCourses     = async () => { if (!db) return; const { data } = await db.from("courses").select("id, course_code, course_name, credit_units, level, semester, is_active, is_elective, department_id, lecturer_id, session").order("course_code"); if (data) setCourses(data as Course[]); };
  const loadLecturers   = async () => { if (!db) return; const { data } = await db.from("lecturers").select("id, full_name, email, staff_id, department_id, is_active").order("full_name"); if (data) setLecturers(data as Lecturer[]); };

  // ── Helper lookups ───────────────────────────────────
  const facultyName  = (id: string) => faculties.find((f) => f.id === id)?.name || "—";
  const deptName     = (id: string) => departments.find((d) => d.id === id)?.name || "—";
  const lecturerName = (id: string | null) => id ? (lecturers.find((l) => l.id === id)?.full_name || "—") : "Unassigned";

  // ── Faculties CRUD ────────────────────────────────────
  const openFacultyForm = (f?: Faculty) => {
    setForm(f ? { name: f.name, code: f.code } : { name: "", code: "" });
    setEditId(f?.id || null);
    setShowForm(true);
  };

  const saveFaculty = async () => {
    if (!form.name?.trim() || !form.code?.trim()) { Alert.alert("Error", "Name and code are required"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), is_active: true };
    const { error } = editId
      ? await db!.from("faculties").update(payload as any).eq("id", editId)
      : await db!.from("faculties").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowForm(false); setEditId(null);
    loadFaculties();
  };

  const deleteFaculty = (id: string, name: string) => {
    Alert.alert("Delete Faculty", `Delete "${name}"? This may affect departments under it.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await db!.from("faculties").delete().eq("id", id); loadFaculties(); } },
    ]);
  };

  // ── Departments CRUD ──────────────────────────────────
  const openDeptForm = (d?: Department) => {
    setForm(d ? { name: d.name, code: d.code, faculty_id: d.faculty_id } : { name: "", code: "", faculty_id: "" });
    setEditId(d?.id || null);
    setShowForm(true);
  };

  const saveDept = async () => {
    if (!form.name?.trim() || !form.code?.trim() || !form.faculty_id) { Alert.alert("Error", "All fields required"); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase(), faculty_id: form.faculty_id, is_active: true };
    const { error } = editId
      ? await db!.from("departments").update(payload as any).eq("id", editId)
      : await db!.from("departments").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowForm(false); setEditId(null);
    loadDepartments();
  };

  const deleteDept = (id: string, name: string) => {
    Alert.alert("Delete Department", `Delete "${name}"? Students and courses under it will be affected.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await db!.from("departments").delete().eq("id", id); loadDepartments(); } },
    ]);
  };

  // ── Courses CRUD ──────────────────────────────────────
  const openCourseForm = (c?: Course) => {
    setForm(c ? {
      course_code: c.course_code, course_name: c.course_name,
      credit_units: String(c.credit_units), level: c.level,
      semester: c.semester, department_id: c.department_id,
      lecturer_id: c.lecturer_id || "", is_elective: c.is_elective,
    } : { course_code: "", course_name: "", credit_units: "3", level: "100", semester: "first", department_id: "", lecturer_id: "", is_elective: false });
    setEditId(c?.id || null);
    setShowForm(true);
  };

  const saveCourse = async () => {
    if (!form.course_code?.trim() || !form.course_name?.trim() || !form.department_id) {
      Alert.alert("Error", "Code, name and department are required"); return;
    }
    setSaving(true);
    const payload = {
      course_code:   form.course_code.trim().toUpperCase(),
      course_name:   form.course_name.trim(),
      credit_units:  parseInt(form.credit_units) || 3,
      level:         form.level,
      semester:      form.semester,
      department_id: form.department_id,
      lecturer_id:   form.lecturer_id || null,
      is_elective:   form.is_elective || false,
      is_active:     true,
    };
    const { error } = editId
      ? await db!.from("courses").update(payload as any).eq("id", editId)
      : await db!.from("courses").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowForm(false); setEditId(null);
    loadCourses();
  };

  const assignLecturer = async (courseId: string, lecturerId: string) => {
    await db!.from("courses").update({ lecturer_id: lecturerId || null } as any).eq("id", courseId);
    loadCourses();
  };

  const deleteCourse = (id: string, code: string) => {
    Alert.alert("Delete Course", `Delete "${code}"? All registrations and results will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await db!.from("courses").delete().eq("id", id); loadCourses(); } },
    ]);
  };

  // ── Lecturers CRUD ────────────────────────────────────
  const openLecturerForm = (l?: Lecturer) => {
    setForm(l ? { full_name: l.full_name, email: l.email, staff_id: l.staff_id || "", department_id: l.department_id || "" }
              : { full_name: "", email: "", staff_id: "", department_id: "" });
    setEditId(l?.id || null);
    setShowForm(true);
  };

  const saveLecturer = async () => {
    if (!form.full_name?.trim() || !form.email?.trim()) { Alert.alert("Error", "Name and email are required"); return; }
    if (!isValidEmail(form.email)) { Alert.alert("Error", "Enter a valid email"); return; }
    setSaving(true);
    const payload = {
      full_name:     form.full_name.trim(),
      email:         form.email.trim().toLowerCase(),
      staff_id:      form.staff_id?.trim() || null,
      department_id: form.department_id || null,
      is_active:     true,
    };
    const { error } = editId
      ? await db!.from("lecturers").update(payload as any).eq("id", editId)
      : await db!.from("lecturers").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowForm(false); setEditId(null);
    loadLecturers();
  };

  const deleteLecturer = (id: string, name: string) => {
    Alert.alert("Remove Lecturer", `Remove "${name}"? Their courses will become unassigned.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await db!.from("courses").update({ lecturer_id: null } as any).eq("lecturer_id", id);
        await db!.from("lecturers").delete().eq("id", id);
        loadAll(true);
      }},
    ]);
  };

  // ── Filtered courses ──────────────────────────────────
  const filteredCourses = courses.filter((c) =>
    (!filterDept  || c.department_id === filterDept) &&
    (!filterLevel || c.level === filterLevel) &&
    (!searchQuery || c.course_code.toLowerCase().includes(searchQuery.toLowerCase()) || c.course_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // ── Select options ────────────────────────────────────
  const facultyOptions: SelectOption[]  = faculties.map((f) => ({ label: f.name, value: f.id }));
  const deptOptions: SelectOption[]     = departments.map((d) => ({ label: d.name, value: d.id }));
  const lecturerOptions: SelectOption[] = [{ label: "Unassigned", value: "" }, ...lecturers.filter((l) => l.is_active).map((l) => ({ label: l.full_name, value: l.id }))];
  const levelOptions: SelectOption[]    = ["100","200","300","400","500","600"].map((l) => ({ label: `${l} Level`, value: l }));
  const semOptions: SelectOption[]      = [{ label: "First Semester", value: "first" }, { label: "Second Semester", value: "second" }];
  const unitOptions: SelectOption[]     = ["1","2","3","4","6"].map((u) => ({ label: `${u} units`, value: u }));

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "faculties",   label: "Faculties",   count: faculties.length   },
    { id: "departments", label: "Departments", count: departments.length },
    { id: "courses",     label: "Courses",     count: courses.length     },
    { id: "lecturers",   label: "Lecturers",   count: lecturers.length   },
  ];

  const shellUser = { name: "Admin", role: "admin" as const };

  if (loading) {
    return (
      <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Academic Setup">
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" label="Loading academic data..." /></View>
      </AppShell>
    );
  }

  // ── Form card component ───────────────────────────────
  const FormCard = ({ title, onSave, onCancel }: { title: string; onSave: () => void; onCancel: () => void }) => (
    <Card variant="brand" style={{ marginBottom: spacing[4] }}>
      <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>{title}</Text>

      {/* ── Faculty form ── */}
      {tab === "faculties" && (
        <>
          <FormInput label="Faculty name *" value={form.name || ""} onChange={(v) => setF("name", v)} placeholder="e.g. Faculty of Science and Technology" colors={colors} />
          <FormInput label="Faculty code *" value={form.code || ""} onChange={(v) => setF("code", v.toUpperCase())} placeholder="e.g. FST" colors={colors} />
        </>
      )}

      {/* ── Department form ── */}
      {tab === "departments" && (
        <>
          <FormInput label="Department name *" value={form.name || ""} onChange={(v) => setF("name", v)} placeholder="e.g. Computer Science" colors={colors} />
          <FormInput label="Department code *" value={form.code || ""} onChange={(v) => setF("code", v.toUpperCase())} placeholder="e.g. CSC" colors={colors} />
          <SelectModal label="Faculty *" placeholder="Select faculty" value={form.faculty_id || ""} options={facultyOptions} onChange={(v) => setF("faculty_id", v)} />
        </>
      )}

      {/* ── Course form ── */}
      {tab === "courses" && (
        <>
          <FormInput label="Course code *" value={form.course_code || ""} onChange={(v) => setF("course_code", v.toUpperCase())} placeholder="e.g. CSC301" colors={colors} />
          <FormInput label="Course name *" value={form.course_name || ""} onChange={(v) => setF("course_name", v)} placeholder="e.g. Data Structures and Algorithms" colors={colors} />
          <View style={[layout.row, { gap: spacing[3] }]}>
            <View style={layout.fill}><SelectModal label="Level *" placeholder="Select" value={form.level || "100"} options={levelOptions} onChange={(v) => setF("level", v)} /></View>
            <View style={layout.fill}><SelectModal label="Semester" placeholder="Select" value={form.semester || "first"} options={semOptions} onChange={(v) => setF("semester", v)} /></View>
            <View style={layout.fill}><SelectModal label="Units" placeholder="Select" value={form.credit_units || "3"} options={unitOptions} onChange={(v) => setF("credit_units", v)} /></View>
          </View>
          <SelectModal label="Department *" placeholder="Select department" value={form.department_id || ""} options={deptOptions} onChange={(v) => setF("department_id", v)} />
          <SelectModal label="Assign lecturer" placeholder="Unassigned" value={form.lecturer_id || ""} options={lecturerOptions} onChange={(v) => setF("lecturer_id", v)} />
          <TouchableOpacity onPress={() => setF("is_elective", !form.is_elective)} style={[layout.row, { gap: spacing[2], marginBottom: spacing[4] }]} activeOpacity={0.7}>
            <View style={[{ width: spacing[5], height: spacing[5], borderRadius: radius.sm, borderWidth: 2, alignItems: "center", justifyContent: "center", borderColor: form.is_elective ? brand.blue : colors.border.strong, backgroundColor: form.is_elective ? brand.blue : "transparent" }]}>
              {form.is_elective && <Icon name="ui-check" size="xs" color="#fff" />}
            </View>
            <Text variant="caption" color="secondary">Elective course</Text>
          </TouchableOpacity>
        </>
      )}

      {/* ── Lecturer form ── */}
      {tab === "lecturers" && (
        <>
          <FormInput label="Full name *"     value={form.full_name || ""}    onChange={(v) => setF("full_name", v)}    placeholder="Dr. Adebayo Okon"         colors={colors} />
          <FormInput label="Email address *" value={form.email || ""}         onChange={(v) => setF("email", v)}         placeholder="lecturer@school.edu.ng"   keyboardType="email-address" autoCapitalize="none" colors={colors} />
          <FormInput label="Staff ID"        value={form.staff_id || ""}      onChange={(v) => setF("staff_id", v)}      placeholder="e.g. STAFF/2019/001"      colors={colors} />
          <SelectModal label="Department" placeholder="Select department" value={form.department_id || ""} options={[{ label: "No department", value: "" }, ...deptOptions]} onChange={(v) => setF("department_id", v)} />
          {!editId && (
            <Card variant="info">
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Icon name="status-info" size="sm" color={colors.status.info} />
                <Text style={{ flex: 1, fontSize: fontSize.xs, color: colors.status.info, lineHeight: 18 }}>
                  The lecturer will activate their account via the setup page using their email address.
                </Text>
              </View>
            </Card>
          )}
        </>
      )}

      <View style={[layout.row, { gap: spacing[3], marginTop: spacing[2] }]}>
        <Button label={saving ? "Saving..." : editId ? `Update` : `Create`} variant="primary" size="md" loading={saving} onPress={onSave} />
        <Button label="Cancel" variant="secondary" size="md" onPress={onCancel} />
      </View>
    </Card>
  );

  const saveMap: Record<Tab, () => void> = { faculties: saveFaculty, departments: saveDept, courses: saveCourse, lecturers: saveLecturer };

  return (
    <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Academic Setup"
      showBack onBack={() => router.back()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Academic Structure</Text>
        <Text variant="caption" color="muted">Manage faculties, departments, courses and lecturers.</Text>

        {/* Stats */}
        <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
          {TABS.map(({ id, label, count }) => (
            <Card key={id} style={[layout.fill, { minWidth: 80, alignItems: "center" }]}>
              <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: tab === id ? brand.blue : colors.text.primary }}>{count}</Text>
              <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
            </Card>
          ))}
        </View>

        {/* Tab selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[layout.row, { gap: spacing[2] }]}>
            {TABS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                onPress={() => { setTab(id); setShowForm(false); setEditId(null); }}
                activeOpacity={0.75}
                style={[styles.tab, { backgroundColor: tab === id ? brand.blue : colors.bg.card, borderColor: tab === id ? brand.blue : colors.border.DEFAULT }]}
              >
                <Text style={{ fontSize: fontSize.sm, fontWeight: tab === id ? fontWeight.bold : fontWeight.normal, color: tab === id ? "#fff" : colors.text.secondary }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Add button */}
        {!showForm && (
          <Button
            label={`+ Add ${tab.slice(0, -1)}`}
            variant="primary"
            size="md"
            onPress={() => {
              if      (tab === "faculties")   openFacultyForm();
              else if (tab === "departments") openDeptForm();
              else if (tab === "courses")     openCourseForm();
              else                            openLecturerForm();
            }}
          />
        )}

        {/* Form */}
        {showForm && (
          <FormCard
            title={editId ? `Edit ${tab.slice(0, -1)}` : `Add ${tab.slice(0, -1)}`}
            onSave={saveMap[tab]}
            onCancel={() => { setShowForm(false); setEditId(null); }}
          />
        )}

        {/* Course filters */}
        {tab === "courses" && (
          <View style={{ gap: spacing[3] }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search code or course name..."
              placeholderTextColor={colors.text.muted}
              style={[styles.searchInput, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT, color: colors.text.primary }]}
            />
            <View style={[layout.row, { gap: spacing[3] }]}>
              <View style={layout.fill}>
                <SelectModal placeholder="All departments" value={filterDept} options={[{ label: "All departments", value: "" }, ...deptOptions]} onChange={setFilterDept} />
              </View>
              <View style={layout.fill}>
                <SelectModal placeholder="All levels" value={filterLevel} options={[{ label: "All levels", value: "" }, ...levelOptions]} onChange={setFilterLevel} />
              </View>
            </View>
            <Text variant="caption" color="muted">{filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} found</Text>
          </View>
        )}

        {/* Data tables */}
        <Card>
          {/* ── Faculties ── */}
          {tab === "faculties" && (
            faculties.length === 0 ? <EmptyState text="No faculties yet. Add your first faculty above." icon="academic-grade" /> :
            faculties.map((f, i) => (
              <ItemRow
                key={f.id}
                isLast={i === faculties.length - 1}
                colors={colors}
                left={<>
                  <Text variant="label" weight="semibold" color="primary">{f.name}</Text>
                  <View style={[layout.row, { gap: spacing[2], marginTop: 2 }]}>
                    <Text style={styles.mono}>{f.code}</Text>
                    <Text variant="micro" color="muted">{departments.filter((d) => d.faculty_id === f.id).length} depts</Text>
                    <StatusDot active={f.is_active} />
                  </View>
                </>}
                onEdit={() => { openFacultyForm(f); setEditId(f.id); }}
                onDelete={() => deleteFaculty(f.id, f.name)}
              />
            ))
          )}

          {/* ── Departments ── */}
          {tab === "departments" && (
            departments.length === 0 ? <EmptyState text="No departments. Add faculties first." icon="academic-grade" /> :
            departments.map((d, i) => (
              <ItemRow
                key={d.id}
                isLast={i === departments.length - 1}
                colors={colors}
                left={<>
                  <Text variant="label" weight="semibold" color="primary">{d.name}</Text>
                  <View style={[layout.row, { gap: spacing[2], marginTop: 2 }]}>
                    <Text style={styles.mono}>{d.code}</Text>
                    <Text variant="micro" color="muted">{facultyName(d.faculty_id)}</Text>
                    <Text variant="micro" color="muted">{courses.filter((c) => c.department_id === d.id).length} courses</Text>
                    <StatusDot active={d.is_active} />
                  </View>
                </>}
                onEdit={() => { openDeptForm(d); setEditId(d.id); }}
                onDelete={() => deleteDept(d.id, d.name)}
              />
            ))
          )}

          {/* ── Courses ── */}
          {tab === "courses" && (
            filteredCourses.length === 0 ? <EmptyState text="No courses match your filters." icon="nav-courses" /> :
            filteredCourses.map((c, i) => (
              <View key={c.id} style={[styles.itemRow, { borderBottomWidth: i < filteredCourses.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                <View style={layout.fill}>
                  <View style={[layout.row, { gap: spacing[2], marginBottom: 2 }]}>
                    <Text style={styles.mono}>{c.course_code}</Text>
                    <Badge label={c.is_elective ? "Elective" : "Core"} variant={c.is_elective ? "indigo" : "brand"} size="xs" />
                  </View>
                  <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{c.course_name}</Text>
                  <Text variant="micro" color="muted">{c.level} · {c.semester} · {c.credit_units} units · {deptName(c.department_id)}</Text>
                  {/* Inline lecturer selector */}
                  <SelectModal
                    placeholder="Assign lecturer"
                    value={c.lecturer_id || ""}
                    options={lecturerOptions}
                    onChange={(v) => assignLecturer(c.id, v)}
                  />
                </View>
                <View style={[layout.row, { gap: spacing[2] }]}>
                  <TouchableOpacity onPress={() => { openCourseForm(c); setEditId(c.id); }} activeOpacity={0.7} style={styles.actionBtn}>
                    <Icon name="action-edit" size="sm" color={colors.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteCourse(c.id, c.course_code)} activeOpacity={0.7} style={[styles.actionBtn, { backgroundColor: colors.status.errorBg }]}>
                    <Icon name="action-delete" size="sm" color={colors.status.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* ── Lecturers ── */}
          {tab === "lecturers" && (
            lecturers.length === 0 ? <EmptyState text="No lecturers added yet." icon="user-lecturer" /> :
            lecturers.map((l, i) => (
              <ItemRow
                key={l.id}
                isLast={i === lecturers.length - 1}
                colors={colors}
                left={<>
                  <Text variant="label" weight="semibold" color="primary">{l.full_name}</Text>
                  <View style={[layout.row, { gap: spacing[2], marginTop: 2 }]}>
                    <Text variant="micro" color="muted">{l.email}</Text>
                    {l.staff_id && <Text variant="micro" color="muted">{l.staff_id}</Text>}
                    <Text variant="micro" color="muted">{courses.filter((c) => c.lecturer_id === l.id).length} courses</Text>
                    <StatusDot active={l.is_active} />
                  </View>
                  {l.department_id && <Text variant="micro" color="muted">{deptName(l.department_id)}</Text>}
                </>}
                onEdit={() => { openLecturerForm(l); setEditId(l.id); }}
                onDelete={() => deleteLecturer(l.id, l.full_name)}
              />
            ))
          )}
        </Card>

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </AppShell>
  );
}

// ── Small reusable components ──────────────────────────────
function FormInput({ label, value, onChange, placeholder, keyboardType, autoCapitalize, colors }: any) {
  return (
    <View style={{ marginBottom: spacing[3] }}>
      <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.text.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize || "words"}
        style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], color: colors.text.primary, fontSize: fontSize.md }}
      />
    </View>
  );
}

function ItemRow({ left, onEdit, onDelete, isLast, colors }: { left: React.ReactNode; onEdit: () => void; onDelete: () => void; isLast: boolean; colors: any }) {
  return (
    <View style={[styles.itemRow, { borderBottomWidth: isLast ? 0 : 1, borderBottomColor: colors.border.subtle }]}>
      <View style={layout.fill}>{left}</View>
      <View style={[layout.row, { gap: spacing[2] }]}>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={styles.actionBtn}>
          <Icon name="action-edit" size="sm" color={colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} activeOpacity={0.7} style={[styles.actionBtn, { backgroundColor: colors.status.errorBg }]}>
          <Icon name="action-delete" size="sm" color={colors.status.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <View style={[layout.row, { gap: 4 }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: active ? "#4ade80" : "#f87171" }} />
      <Text style={{ fontSize: fontSize["2xs"], color: active ? "#4ade80" : "#f87171", fontWeight: fontWeight.semibold }}>
        {active ? "Active" : "Off"}
      </Text>
    </View>
  );
}

function EmptyState({ text, icon }: { text: string; icon: string }) {
  return (
    <View style={[layout.centredH, { paddingVertical: spacing[8] }]}>
      <Icon name={icon as any} size="2xl" color="rgba(100,120,160,0.4)" />
      <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[3], maxWidth: 280 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tab:         { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  searchInput: { borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing[4], paddingVertical: spacing[3], fontSize: fontSize.md },
  itemRow:     { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingVertical: spacing[3] },
  actionBtn:   { width: spacing[8], height: spacing[8], borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  mono:        { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue, fontFamily: "monospace" },
});
