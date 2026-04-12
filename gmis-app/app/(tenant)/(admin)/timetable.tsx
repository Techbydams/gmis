// ============================================================
// GMIS — Admin Timetable Management
// Route: /(tenant)/(admin)/timetable
// Tables: timetable, courses, departments
// Confirmed columns: id, course_id, lecturer_id, day_of_week,
//   start_time, end_time, venue, session, semester, created_at
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Button, Spinner } from "@/components/ui";
import { SelectModal, type SelectOption } from "@/components/ui/SelectModal";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { useAutoLoad }    from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type Day = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday";

interface TTEntry {
  id: string; course_id: string; lecturer_id: string | null;
  day_of_week: Day; start_time: string; end_time: string;
  venue: string | null; session: string | null; semester: string | null;
}
interface Course { id: string; course_code: string; course_name: string; level: string; department_id: string; lecturer_id: string | null }
interface Dept   { id: string; name: string }
interface Lecturer { id: string; full_name: string }

// Parsed CSV row before resolution
interface BulkRow {
  course_code: string;
  day: string;
  start_time: string;
  end_time: string;
  venue: string;
  session: string;
  semester: string;
  // resolved
  course_id?: string;
  error?: string;
}

const DAYS: Day[] = ["monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_LABELS: Record<Day, string> = { monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat" };

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

const CSV_SAMPLE = `course_code,day,start_time,end_time,venue,session,semester
CSC301,monday,08:00,10:00,LT1,2024/2025,first
CSC302,tuesday,10:00,12:00,Lab2,2024/2025,first`;

/** Parse raw CSV text into BulkRow objects, resolve course_codes to IDs */
function parseCsv(raw: string, courses: Course[]): BulkRow[] {
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  // skip header line if present
  const dataLines = lines[0].toLowerCase().startsWith("course_code") ? lines.slice(1) : lines;
  const courseMap: Record<string, Course> = {};
  courses.forEach((c) => { courseMap[c.course_code.toLowerCase()] = c; });

  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const [course_code = "", day = "", start_time = "", end_time = "", venue = "", session = "", semester = ""] = cols;
    const row: BulkRow = { course_code, day: day.toLowerCase(), start_time, end_time, venue, session, semester: semester.toLowerCase() };
    const matched = courseMap[course_code.toLowerCase()];
    if (!course_code) {
      row.error = "Missing course_code";
    } else if (!matched) {
      row.error = `Course "${course_code}" not found`;
    } else {
      row.course_id = matched.id;
    }
    return row;
  });
}

export default function AdminTimetable() {
  const router           = useRouter();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [entries,    setEntries]    = useState<TTEntry[]>([]);
  const [courses,    setCourses]    = useState<Course[]>([]);
  const [depts,      setDepts]      = useState<Dept[]>([]);
  const [lecturers,  setLecturers]  = useState<Lecturer[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [activeDay,  setActiveDay]  = useState<Day>(DAYS[new Date().getDay() - 1] ?? "monday");
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState("");

  // Entry mode: "single" | "bulk"
  const [entryMode, setEntryMode] = useState<"single" | "bulk">("single");

  // Bulk import state
  const [csvText,       setCsvText]       = useState("");
  const [bulkRows,      setBulkRows]      = useState<BulkRow[]>([]);
  const [bulkParsed,    setBulkParsed]    = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult,    setBulkResult]    = useState<{ imported: number; skipped: number } | null>(null);

  const [form, setForm] = useState({
    course_id: "", day_of_week: activeDay as string, start_time: "08:00",
    end_time: "10:00", venue: "", session: "", semester: "first",
  });
  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db) loadAll(); }, [db], { hasData: entries.length > 0 });

  const loadAll = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);

    const [ttRes, crsRes, deptRes, lecRes] = await Promise.allSettled([
      db.from("timetable").select("id, course_id, lecturer_id, day_of_week, start_time, end_time, venue, session, semester").order("day_of_week").order("start_time"),
      db.from("courses").select("id, course_code, course_name, level, department_id, lecturer_id").eq("is_active", true).order("course_code"),
      db.from("departments").select("id, name").eq("is_active", true).order("name"),
      db.from("lecturers").select("id, full_name").eq("is_active", true).order("full_name"),
    ]);

    if (ttRes.status  === "fulfilled" && ttRes.value.data)  setEntries(ttRes.value.data as TTEntry[]);
    if (crsRes.status === "fulfilled" && crsRes.value.data) setCourses(crsRes.value.data as Course[]);
    if (deptRes.status=== "fulfilled" && deptRes.value.data)setDepts(deptRes.value.data as Dept[]);
    if (lecRes.status === "fulfilled" && lecRes.value.data) setLecturers(lecRes.value.data as Lecturer[]);

    setLoading(false);
    setRefreshing(false);
  };

  const openForm = (entry?: TTEntry) => {
    setForm(entry ? {
      course_id: entry.course_id, day_of_week: entry.day_of_week,
      start_time: entry.start_time, end_time: entry.end_time,
      venue: entry.venue || "", session: entry.session || "",
      semester: entry.semester || "first",
    } : { course_id: "", day_of_week: activeDay, start_time: "08:00", end_time: "10:00", venue: "", session: "", semester: "first" });
    setEditId(entry?.id || null);
    setShowForm(true);
  };

  const save = async () => {
    if (!form.course_id || !form.start_time || !form.end_time) {
      Alert.alert("Error", "Course, start time, and end time are required"); return;
    }
    setSaving(true);
    const payload = {
      course_id:   form.course_id,
      day_of_week: form.day_of_week,
      start_time:  form.start_time,
      end_time:    form.end_time,
      venue:       form.venue || null,
      session:     form.session || null,
      semester:    form.semester,
      lecturer_id: courses.find((c) => c.id === form.course_id)?.lecturer_id || null,
    };
    const { error } = editId
      ? await db!.from("timetable").update(payload as any).eq("id", editId)
      : await db!.from("timetable").insert(payload as any);
    setSaving(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setShowForm(false); setEditId(null);
    loadAll(true);
  };

  const deleteEntry = (id: string) => {
    Alert.alert("Delete slot", "Remove this timetable entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await db!.from("timetable").delete().eq("id", id); loadAll(true); } },
    ]);
  };

  // ── Bulk import handlers ───────────────────────────────────
  const handleParsePreview = () => {
    if (!csvText.trim()) { Alert.alert("Empty", "Paste CSV data first."); return; }
    const rows = parseCsv(csvText, courses);
    setBulkRows(rows);
    setBulkParsed(true);
    setBulkResult(null);
  };

  const handleBulkImport = async () => {
    if (!db) return;
    const valid = bulkRows.filter((r) => !r.error && r.course_id);
    if (valid.length === 0) { Alert.alert("Nothing to import", "No valid rows to import."); return; }
    setBulkImporting(true);
    let imported = 0;
    let skipped  = bulkRows.length - valid.length;
    try {
      const payloads = valid.map((r) => ({
        course_id:   r.course_id!,
        day_of_week: r.day as Day,
        start_time:  r.start_time,
        end_time:    r.end_time,
        venue:       r.venue || null,
        session:     r.session || null,
        semester:    r.semester || "first",
        lecturer_id: courses.find((c) => c.id === r.course_id)?.lecturer_id || null,
      }));
      const { error } = await db.from("timetable").insert(payloads as any);
      if (error) { Alert.alert("Import error", error.message); return; }
      imported = valid.length;
      setBulkResult({ imported, skipped });
      setCsvText("");
      setBulkRows([]);
      setBulkParsed(false);
      loadAll(true);
    } finally {
      setBulkImporting(false);
    }
  };

  const resetBulk = () => {
    setCsvText("");
    setBulkRows([]);
    setBulkParsed(false);
    setBulkResult(null);
  };

  const courseName = (id: string) => {
    const c = courses.find((c) => c.id === id);
    return c ? `${c.course_code} — ${c.course_name}` : "—";
  };
  const deptName = (id: string) => depts.find((d) => d.id === id)?.name || "";

  const dayEntries = entries.filter((e) => {
    const matchDay  = e.day_of_week === activeDay;
    const matchDept = !filterDept || courses.find((c) => c.id === e.course_id)?.department_id === filterDept;
    return matchDay && matchDept;
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const courseOptions: SelectOption[]  = courses.map((c) => ({ label: `${c.course_code} — ${c.course_name}`, value: c.id }));
  const dayOptions: SelectOption[]     = DAYS.map((d) => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d }));
  const deptOptions: SelectOption[]    = depts.map((d) => ({ label: d.name, value: d.id }));
  const semOptions: SelectOption[]     = [{ label: "First Semester", value: "first" }, { label: "Second Semester", value: "second" }];

  const dayCounts = DAYS.reduce((acc, d) => ({ ...acc, [d]: entries.filter((e) => e.day_of_week === d).length }), {} as Record<Day, number>);

  const validBulkCount   = bulkRows.filter((r) => !r.error).length;
  const invalidBulkCount = bulkRows.filter((r) => !!r.error).length;

  const shellUser = { name: "Admin", role: "admin" as const };

  if (loading) {
    return (
      <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Timetable">
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
      </AppShell>
    );
  }

  return (
    <AppShell role="admin" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Timetable Management"
      showBack onBack={() => router.back()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Timetable</Text>
        <Text variant="caption" color="muted">{entries.length} total slots across the week</Text>

        {/* Entry Mode Toggle */}
        <View style={[styles.modeToggleWrap, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { setEntryMode("single"); setShowForm(false); }}
            style={[styles.modeBtn, entryMode === "single" && { backgroundColor: brand.blue }]}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: entryMode === "single" ? "#fff" : colors.text.secondary }}>
              Single Entry
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => { setEntryMode("bulk"); setShowForm(false); }}
            style={[styles.modeBtn, entryMode === "bulk" && { backgroundColor: brand.blue }]}
          >
            <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: entryMode === "bulk" ? "#fff" : colors.text.secondary }}>
              Bulk Import
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── SINGLE ENTRY MODE ─────────────────────────────── */}
        {entryMode === "single" && (
          <>
            {/* Day tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                {DAYS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setActiveDay(d)}
                    activeOpacity={0.75}
                    style={[styles.dayTab, { backgroundColor: activeDay === d ? brand.blue : colors.bg.card, borderColor: activeDay === d ? brand.blue : colors.border.DEFAULT }]}
                  >
                    <Text style={{ fontSize: fontSize.sm, fontWeight: activeDay === d ? fontWeight.bold : fontWeight.normal, color: activeDay === d ? "#fff" : colors.text.secondary }}>
                      {DAY_LABELS[d]}
                    </Text>
                    {dayCounts[d] > 0 && (
                      <Badge label={String(dayCounts[d])} variant={activeDay === d ? "gray" : "brand"} size="xs" style={{ marginLeft: spacing[1] }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Filters + add button */}
            <View style={[layout.row, { gap: spacing[3], alignItems: "flex-end" }]}>
              <View style={layout.fill}>
                <SelectModal
                  placeholder="All departments"
                  value={filterDept}
                  options={[{ label: "All departments", value: "" }, ...deptOptions]}
                  onChange={setFilterDept}
                />
              </View>
              <Button label="+ Add slot" variant="primary" size="md" onPress={() => openForm()} />
            </View>

            {/* Single entry form */}
            {showForm && (
              <Card variant="brand">
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>
                  {editId ? "Edit timetable slot" : "Add new slot"}
                </Text>
                <SelectModal label="Course *"   placeholder="Select course" value={form.course_id} options={courseOptions} onChange={(v) => setF("course_id", v)} />
                <SelectModal label="Day *"      placeholder="Select day"    value={form.day_of_week} options={dayOptions}   onChange={(v) => setF("day_of_week", v)} />
                <SelectModal label="Semester"   placeholder="Select"        value={form.semester}    options={semOptions}   onChange={(v) => setF("semester", v)} />

                <View style={[layout.row, { gap: spacing[3] }]}>
                  <View style={layout.fill}>
                    <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>Start time</Text>
                    <TextInput value={form.start_time} onChangeText={(v) => setF("start_time", v)} placeholder="08:00" placeholderTextColor={colors.text.muted}
                      style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md }} />
                  </View>
                  <View style={layout.fill}>
                    <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1] }}>End time</Text>
                    <TextInput value={form.end_time} onChangeText={(v) => setF("end_time", v)} placeholder="10:00" placeholderTextColor={colors.text.muted}
                      style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md }} />
                  </View>
                </View>

                <Text variant="caption" color="secondary" weight="medium" style={{ marginBottom: spacing[1], marginTop: spacing[3] }}>Venue</Text>
                <TextInput value={form.venue} onChangeText={(v) => setF("venue", v)} placeholder="e.g. LT1, Room 204" placeholderTextColor={colors.text.muted}
                  style={{ backgroundColor: colors.bg.input, borderWidth: 1, borderColor: colors.border.DEFAULT, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], color: colors.text.primary, fontSize: fontSize.md, marginBottom: spacing[4] }} />

                <View style={[layout.row, { gap: spacing[3] }]}>
                  <Button label={saving ? "Saving..." : editId ? "Update" : "Add slot"} variant="primary" size="md" loading={saving} onPress={save} />
                  <Button label="Cancel" variant="secondary" size="md" onPress={() => { setShowForm(false); setEditId(null); }} />
                </View>
              </Card>
            )}

            {/* Day entries */}
            <Text variant="label" weight="bold" color="primary">
              {activeDay.charAt(0).toUpperCase() + activeDay.slice(1)} — {dayEntries.length} class{dayEntries.length !== 1 ? "es" : ""}
            </Text>

            {dayEntries.length === 0 ? (
              <Card>
                <View style={[layout.centredH, { paddingVertical: spacing[6] }]}>
                  <Icon name="nav-timetable" size="2xl" color={colors.text.muted} />
                  <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                    No classes on {activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}.
                  </Text>
                </View>
              </Card>
            ) : (
              <Card>
                {dayEntries.map((e, i) => {
                  const course = courses.find((c) => c.id === e.course_id);
                  const accent = [brand.blue, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"][i % 5];
                  return (
                    <View key={e.id} style={[styles.entryRow, { borderBottomWidth: i < dayEntries.length - 1 ? 1 : 0, borderBottomColor: colors.border.subtle }]}>
                      <View style={[styles.entryAccent, { backgroundColor: accent }]} />
                      <View style={layout.fill}>
                        <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>
                          {course?.course_code} — {course?.course_name}
                        </Text>
                        <View style={[layout.row, { gap: spacing[2], marginTop: 2, flexWrap: "wrap" }]}>
                          <Text style={styles.timeBadge}>{fmtTime(e.start_time)} – {fmtTime(e.end_time)}</Text>
                          {e.venue && <Text variant="micro" color="muted">{e.venue}</Text>}
                          {course && <Text variant="micro" color="muted">{course.level} Level</Text>}
                          {course?.department_id && <Text variant="micro" color="muted">{deptName(course.department_id)}</Text>}
                        </View>
                      </View>
                      <View style={[layout.row, { gap: spacing[2] }]}>
                        <TouchableOpacity onPress={() => openForm(e)} activeOpacity={0.7} style={styles.actionBtn}>
                          <Icon name="action-edit" size="sm" color={colors.text.secondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => deleteEntry(e.id)} activeOpacity={0.7} style={[styles.actionBtn, { backgroundColor: colors.status.errorBg }]}>
                          <Icon name="action-delete" size="sm" color={colors.status.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* ── BULK IMPORT MODE ──────────────────────────────── */}
        {entryMode === "bulk" && (
          <>
            {/* Import result banner */}
            {bulkResult && (
              <Card>
                <View style={[layout.row, { gap: spacing[3], alignItems: "center" }]}>
                  <Icon name="status-success" size="lg" color={brand.emerald} />
                  <View style={layout.fill}>
                    <Text variant="label" weight="bold" color="primary">Import complete</Text>
                    <Text variant="caption" color="muted">
                      {bulkResult.imported} imported, {bulkResult.skipped} skipped (unknown courses)
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setBulkResult(null)} activeOpacity={0.7} style={{ padding: spacing[2] }}>
                    <Icon name="ui-close" size="sm" color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
              </Card>
            )}

            {/* CSV format reference */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[2] }}>
                Expected CSV Format
              </Text>
              <Text variant="caption" color="muted" style={{ marginBottom: spacing[3] }}>
                Each row must match an active course code. Day must be lowercase (monday, tuesday…). Semester: first or second.
              </Text>
              <View style={[styles.codeBlock, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
                <Text style={{ fontFamily: "monospace", fontSize: fontSize.xs, color: colors.text.secondary, lineHeight: 20 }}>
                  {CSV_SAMPLE}
                </Text>
              </View>
            </Card>

            {/* CSV text input */}
            <Card>
              <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[2] }}>
                Paste CSV Data
              </Text>
              <TextInput
                value={csvText}
                onChangeText={(v) => { setCsvText(v); setBulkParsed(false); setBulkRows([]); setBulkResult(null); }}
                placeholder={"course_code,day,start_time,end_time,venue,session,semester\nCSC301,monday,08:00,10:00,LT1,2024/2025,first"}
                placeholderTextColor={colors.text.muted}
                multiline
                textAlignVertical="top"
                style={[styles.csvInput, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT, color: colors.text.primary }]}
              />
              <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3] }]}>
                <Button label="Parse & Preview" variant="primary" size="md" onPress={handleParsePreview} />
                {csvText.length > 0 && (
                  <Button label="Clear" variant="secondary" size="md" onPress={resetBulk} />
                )}
              </View>
            </Card>

            {/* Preview table */}
            {bulkParsed && bulkRows.length > 0 && (
              <Card>
                <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
                  <Text variant="label" weight="bold" color="primary">Preview</Text>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    {validBulkCount > 0   && <Badge label={`${validBulkCount} valid`}   variant="green" size="sm" />}
                    {invalidBulkCount > 0 && <Badge label={`${invalidBulkCount} errors`} variant="red"   size="sm" />}
                  </View>
                </View>

                {bulkRows.map((row, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bulkRow,
                      {
                        borderBottomWidth: i < bulkRows.length - 1 ? 1 : 0,
                        borderBottomColor: colors.border.subtle,
                        backgroundColor: row.error ? colors.status.errorBg : "transparent",
                      },
                    ]}
                  >
                    <View style={layout.fill}>
                      <View style={[layout.row, { gap: spacing[2], flexWrap: "wrap" }]}>
                        <Text variant="label" weight="semibold" color={row.error ? "error" : "primary"}>{row.course_code}</Text>
                        <Text variant="caption" color="muted">{row.day}</Text>
                        <Text variant="caption" color="muted">{row.start_time}–{row.end_time}</Text>
                        {row.venue ? <Text variant="caption" color="muted">{row.venue}</Text> : null}
                      </View>
                      {row.error && (
                        <View style={[layout.row, { gap: spacing[1], marginTop: 2 }]}>
                          <Icon name="status-error" size="xs" color={colors.status.error} />
                          <Text style={{ fontSize: fontSize.xs, color: colors.status.error }}>{row.error}</Text>
                        </View>
                      )}
                    </View>
                    {!row.error && (
                      <Icon name="status-success" size="sm" color={brand.emerald} />
                    )}
                    {row.error && (
                      <Badge label="error" variant="red" size="xs" />
                    )}
                  </View>
                ))}

                {validBulkCount > 0 && (
                  <View style={{ marginTop: spacing[4] }}>
                    <Button
                      label={bulkImporting ? "Importing..." : `Import ${validBulkCount} entr${validBulkCount === 1 ? "y" : "ies"}`}
                      variant="primary"
                      size="md"
                      loading={bulkImporting}
                      onPress={handleBulkImport}
                    />
                  </View>
                )}
              </Card>
            )}

            {bulkParsed && bulkRows.length === 0 && (
              <Card>
                <Text variant="body" color="muted" align="center" style={{ paddingVertical: spacing[4] }}>
                  No data rows found. Make sure your CSV has at least one data row below the header.
                </Text>
              </Card>
            )}
          </>
        )}

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  modeToggleWrap: { flexDirection: "row", borderRadius: radius.xl, borderWidth: 1, padding: 3, alignSelf: "flex-start" },
  modeBtn:        { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg },
  dayTab:         { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  entryRow:       { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  entryAccent:    { width: 4, height: 40, borderRadius: 2, flexShrink: 0 },
  timeBadge:      { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue, backgroundColor: brand.blueAlpha10, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  actionBtn:      { width: spacing[8], height: spacing[8], borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  codeBlock:      { padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  csvInput:       { minHeight: 140, padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.xs, lineHeight: 20 },
  bulkRow:        { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
});
