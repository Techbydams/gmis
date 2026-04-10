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

import { useState, useEffect, useMemo } from "react";
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

const DAYS: Day[] = ["monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_LABELS: Record<Day, string> = { monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat" };

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
};

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

  const [form, setForm] = useState({
    course_id: "", day_of_week: activeDay as string, start_time: "08:00",
    end_time: "10:00", venue: "", session: "", semester: "first",
  });
  const setF = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) loadAll(); }, [db]);

  const loadAll = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);

    // Fetch timetable + related data
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

  const courseName = (id: string) => {
    const c = courses.find((c) => c.id === id);
    return c ? `${c.course_code} — ${c.course_name}` : "—";
  };
  const deptName = (id: string) => depts.find((d) => d.id === id)?.name || "";

  // Filtered entries for the active day
  const dayEntries = entries.filter((e) => {
    const matchDay  = e.day_of_week === activeDay;
    const matchDept = !filterDept || courses.find((c) => c.id === e.course_id)?.department_id === filterDept;
    return matchDay && matchDept;
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Select options
  const courseOptions: SelectOption[]  = courses.map((c) => ({ label: `${c.course_code} — ${c.course_name}`, value: c.id }));
  const dayOptions: SelectOption[]     = DAYS.map((d) => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: d }));
  const deptOptions: SelectOption[]    = depts.map((d) => ({ label: d.name, value: d.id }));
  const semOptions: SelectOption[]     = [{ label: "First Semester", value: "first" }, { label: "Second Semester", value: "second" }];

  // Entry count per day for badges
  const dayCounts = DAYS.reduce((acc, d) => ({ ...acc, [d]: entries.filter((e) => e.day_of_week === d).length }), {} as Record<Day, number>);

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

        {/* Form */}
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

        <View style={{ height: spacing[8] }} />
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  dayTab:     { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  entryRow:   { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  entryAccent:{ width: 4, height: 40, borderRadius: 2, flexShrink: 0 },
  timeBadge:  { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue, backgroundColor: brand.blueAlpha10, paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  actionBtn:  { width: spacing[8], height: spacing[8], borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
});
