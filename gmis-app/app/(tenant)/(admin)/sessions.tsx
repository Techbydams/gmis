// ============================================================
// GMIS — Admin Academic Sessions & Semesters
// Route: /(tenant)/(admin)/sessions
//
// Features:
//   • Create / edit academic sessions (e.g. "2024/2025")
//   • Create / edit semesters within a session (1st, 2nd, 3rd)
//   • Open or close each semester for student registration
//   • Set semester start & end dates (auto-status update via system)
//   • Auto-advance students to next level when semester is closed
//   • Send an automated announcement to all students on update
//   • Detach session → advances all students by one level
//
// DB tables (tenant):
//   academic_sessions  { id, name, start_year, end_year, is_current, created_at }
//   semesters          { id, session_id, name, start_date, end_date,
//                        is_open, is_current, created_at }
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert, Switch, Platform,
  ActivityIndicator,
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
import { Spinner }         from "@/components/ui/Spinner";
import { EmptyState }      from "@/components/ui/EmptyState";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { formatDate }      from "@/lib/helpers";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface AcademicSession {
  id: string;
  name: string;
  start_year: number;
  end_year: number;
  is_current: boolean;
  created_at: string;
  semesters?: Semester[];
}

interface Semester {
  id: string;
  session_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_open: boolean;
  is_current: boolean;
  created_at: string;
}

const SEMESTER_NAMES = ["First Semester", "Second Semester", "Third Semester"];

const LEVEL_MAP: Record<string, string> = {
  "100": "200", "200": "300", "300": "400",
  "400": "500", "500": "600", "600": "Alumni",
};

// ── Add/Edit Session Sheet ─────────────────────────────────
interface SessionSheetProps {
  visible:    boolean;
  onClose:    () => void;
  onSave:     (d: { name: string; start_year: number; end_year: number; is_current: boolean }) => Promise<void>;
  editing?:   AcademicSession | null;
  colors:     any;
}

function SessionSheet({ visible, onClose, onSave, editing, colors }: SessionSheetProps) {
  const [startYear,  setStartYear]  = useState(editing?.start_year?.toString() || new Date().getFullYear().toString());
  const [endYear,    setEndYear]    = useState(editing?.end_year?.toString()   || (new Date().getFullYear() + 1).toString());
  const [isCurrent,  setIsCurrent]  = useState(editing?.is_current ?? true);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (visible) {
      setStartYear(editing?.start_year?.toString() || new Date().getFullYear().toString());
      setEndYear(editing?.end_year?.toString() || (new Date().getFullYear() + 1).toString());
      setIsCurrent(editing?.is_current ?? true);
    }
  }, [visible, editing]);

  const derivedName = `${startYear}/${endYear}`;

  const handleSave = async () => {
    const sy = parseInt(startYear, 10);
    const ey = parseInt(endYear, 10);
    if (isNaN(sy) || isNaN(ey) || ey <= sy) {
      Alert.alert("Invalid years", "End year must be greater than start year.");
      return;
    }
    setSaving(true);
    try { await onSave({ name: derivedName, start_year: sy, end_year: ey, is_current: isCurrent }); onClose(); }
    catch { Alert.alert("Error", "Could not save session. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={400}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">{editing ? "Edit Session" : "New Academic Session"}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>SESSION NAME</Text>
      <View style={[styles.yearRow, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
        <Text variant="body" weight="bold" color="primary" style={{ flex: 1 }}>{derivedName}</Text>
        <Badge label="Preview" variant="blue" size="sm" />
      </View>

      <View style={[layout.row, { gap: spacing[3], marginTop: spacing[4] }]}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>START YEAR</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={startYear}
            onChangeText={setStartYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="2024"
            placeholderTextColor={colors.text.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>END YEAR</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={endYear}
            onChangeText={setEndYear}
            keyboardType="number-pad"
            maxLength={4}
            placeholder="2025"
            placeholderTextColor={colors.text.muted}
          />
        </View>
      </View>

      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[4] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Set as current session</Text>
          <Text variant="micro" color="muted">Makes this the active academic session</Text>
        </View>
        <Switch value={isCurrent} onValueChange={setIsCurrent} trackColor={{ false: colors.border.DEFAULT, true: brand.blue }} thumbColor="#fff" />
      </View>

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.75}
        style={[styles.saveBtn, { backgroundColor: brand.blue, marginTop: spacing[5] }]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>{editing ? "Update Session" : "Create Session"}</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Add/Edit Semester Sheet ────────────────────────────────
interface SemesterSheetProps {
  visible:    boolean;
  onClose:    () => void;
  sessionId:  string;
  onSave:     (d: { session_id: string; name: string; start_date: string; end_date: string; is_open: boolean; is_current: boolean }) => Promise<void>;
  editing?:   Semester | null;
  colors:     any;
}

function SemesterSheet({ visible, onClose, sessionId, onSave, editing, colors }: SemesterSheetProps) {
  const [name,      setName]      = useState(editing?.name || SEMESTER_NAMES[0]);
  const [startDate, setStartDate] = useState(editing?.start_date?.substring(0, 10) || "");
  const [endDate,   setEndDate]   = useState(editing?.end_date?.substring(0, 10)   || "");
  const [isOpen,    setIsOpen]    = useState(editing?.is_open ?? false);
  const [isCurrent, setIsCurrent] = useState(editing?.is_current ?? true);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (visible) {
      setName(editing?.name || SEMESTER_NAMES[0]);
      setStartDate(editing?.start_date?.substring(0, 10) || "");
      setEndDate(editing?.end_date?.substring(0, 10) || "");
      setIsOpen(editing?.is_open ?? false);
      setIsCurrent(editing?.is_current ?? true);
    }
  }, [visible, editing]);

  const handleSave = async () => {
    if (!startDate || !endDate) {
      Alert.alert("Dates required", "Please set both start and end dates.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ session_id: sessionId, name, start_date: startDate, end_date: endDate, is_open: isOpen, is_current: isCurrent });
      onClose();
    } catch { Alert.alert("Error", "Could not save semester. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={560}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">{editing ? "Edit Semester" : "Add Semester"}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>SEMESTER</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          {SEMESTER_NAMES.map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setName(n)}
              activeOpacity={0.75}
              style={[styles.chip, { backgroundColor: name === n ? brand.blue : colors.bg.hover, borderColor: name === n ? brand.blue : colors.border.DEFAULT }]}
            >
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: name === n ? "#fff" : colors.text.secondary }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={[layout.row, { gap: spacing[3] }]}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>START DATE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={startDate} onChangeText={setStartDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.muted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>END DATE</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={endDate} onChangeText={setEndDate}
            placeholder="YYYY-MM-DD" placeholderTextColor={colors.text.muted}
          />
        </View>
      </View>

      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[3] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Open for registration</Text>
          <Text variant="micro" color="muted">Students can register courses when open</Text>
        </View>
        <Switch value={isOpen} onValueChange={setIsOpen} trackColor={{ false: colors.border.DEFAULT, true: brand.blue }} thumbColor="#fff" />
      </View>

      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[3] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Set as current semester</Text>
          <Text variant="micro" color="muted">Active semester shown to all users</Text>
        </View>
        <Switch value={isCurrent} onValueChange={setIsCurrent} trackColor={{ false: colors.border.DEFAULT, true: brand.blue }} thumbColor="#fff" />
      </View>

      <TouchableOpacity
        onPress={handleSave} disabled={saving} activeOpacity={0.75}
        style={[styles.saveBtn, { backgroundColor: brand.blue, marginTop: spacing[5] }]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>{editing ? "Update Semester" : "Add Semester"}</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminSessions() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();
  const { showToast }     = useToast();

  const [sessions,      setSessions]      = useState<AcademicSession[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [sessionSheet,  setSessionSheet]  = useState(false);
  const [semesterSheet, setSemesterSheet] = useState(false);
  const [editingSession, setEditingSession] = useState<AcademicSession | null>(null);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [activeSessId,  setActiveSessId]  = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState<Set<string>>(new Set());

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db) load(); }, [db], { hasData: sessions.length > 0 });

  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: sessData } = await db
        .from("academic_sessions")
        .select("id, name, start_year, end_year, is_current, created_at")
        .order("start_year", { ascending: false });

      if (!sessData) { setLoading(false); setRefreshing(false); return; }

      // Load semesters for each session
      const { data: semData } = await db
        .from("semesters")
        .select("id, session_id, name, start_date, end_date, is_open, is_current, created_at")
        .order("created_at");

      const semMap: Record<string, Semester[]> = {};
      (semData || []).forEach((s: any) => {
        if (!semMap[s.session_id]) semMap[s.session_id] = [];
        semMap[s.session_id].push(s);
      });

      const enriched = (sessData as AcademicSession[]).map((s) => ({ ...s, semesters: semMap[s.id] || [] }));
      setSessions(enriched);

      // Auto-expand current session
      const curr = enriched.find((s) => s.is_current);
      if (curr) setExpanded(new Set([curr.id]));
    } catch {
      showToast({ message: "Could not load sessions.", variant: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  // ── Save session ────────────────────────────────────────
  const saveSession = async (d: { name: string; start_year: number; end_year: number; is_current: boolean }) => {
    if (!db) throw new Error("No DB");
    if (d.is_current) {
      // Unset all others first
      const unsetId = editingSession?.id || "00000000-0000-0000-0000-000000000000";
      await db.from("academic_sessions").update({ is_current: false } as any).neq("id", unsetId);
    }
    if (editingSession) {
      const { error } = await db.from("academic_sessions").update(d as any).eq("id", editingSession.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("academic_sessions").insert(d as any);
      if (error) throw new Error(error.message);
    }
    // Sync org_settings so the whole app reflects the current session
    if (d.is_current) {
      await syncOrgSettings({ session: d.name });
    }
    showToast({ message: editingSession ? "Session updated." : "Session created.", variant: "success" });
    await sendAnnouncement(
      d.is_current ? `Academic Session ${d.name} is now active` : `Session ${d.name} updated`,
      `The academic session ${d.name} has been ${editingSession ? "updated" : "created"} by the administration.`,
      "announcement"
    );
    setEditingSession(null);
    await load(true);
  };

  // ── Save semester ───────────────────────────────────────
  const saveSemester = async (d: { session_id: string; name: string; start_date: string; end_date: string; is_open: boolean; is_current: boolean }) => {
    if (!db) throw new Error("No DB");
    if (d.is_current) {
      const unsetId = editingSemester?.id || "00000000-0000-0000-0000-000000000000";
      await db.from("semesters").update({ is_current: false } as any).neq("id", unsetId);
    }
    if (editingSemester) {
      const { error } = await db.from("semesters").update(d as any).eq("id", editingSemester.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("semesters").insert(d as any);
      if (error) throw new Error(error.message);
    }
    // Sync org_settings — drives course reg, results, fees across the whole app
    if (d.is_current) {
      const sess = sessions.find((s) => s.id === d.session_id);
      await syncOrgSettings({
        semester:         d.name,
        registrationOpen: d.is_open,
        ...(sess?.is_current ? { session: sess.name } : {}),
      });
    } else if (d.is_open) {
      await syncOrgSettings({ registrationOpen: true });
    }
    showToast({ message: editingSemester ? "Semester updated." : "Semester added.", variant: "success" });
    await sendAnnouncement(
      d.is_open ? `${d.name} Registration Now Open` : `${d.name} Updated`,
      d.is_open
        ? `Course registration for ${d.name} is now open. Log in to register your courses.`
        : `The ${d.name} schedule has been updated. Check the timetable for details.`,
      "announcement"
    );
    setEditingSemester(null);
    await load(true);
  };

  // ── Toggle semester open/close ──────────────────────────
  const toggleSemesterOpen = async (semester: Semester) => {
    if (!db) return;
    const newState = !semester.is_open;
    const { error } = await db.from("semesters").update({ is_open: newState } as any).eq("id", semester.id);
    if (error) { showToast({ message: `Failed: ${error.message}`, variant: "error" }); return; }

    // Always sync registration_open in org_settings
    // If this is the current semester, also sync semester name
    const orgPatch: Parameters<typeof syncOrgSettings>[0] = { registrationOpen: newState };
    if (semester.is_current) orgPatch.semester = semester.name;
    await syncOrgSettings(orgPatch);

    showToast({ message: newState ? "Semester opened for registration." : "Semester closed.", variant: "success" });
    await sendAnnouncement(
      newState ? `${semester.name} Registration Open` : `${semester.name} Registration Closed`,
      newState
        ? `Course registration for ${semester.name} is now open. Log in to register your courses before the deadline.`
        : `Course registration for ${semester.name} has been closed by the administration.`,
      "announcement"
    );
    await load(true);
  };

  // ── Auto-advance students ───────────────────────────────
  const advanceStudents = async (session: AcademicSession) => {
    Alert.alert(
      "Advance Students",
      `This will promote all active students to their next level.\n\n• 100L → 200L, 200L → 300L, etc.\n• Final-year students will be marked as alumni.\n\nThis action cannot be undone. Proceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Advance All Students",
          style: "destructive",
          onPress: async () => {
            if (!db) return;
            showToast({ message: "Advancing students...", variant: "info" });
            try {
              // Fetch all active students
              const { data: students } = await db
                .from("students")
                .select("id, level")
                .eq("status", "active");
              if (!students || students.length === 0) {
                showToast({ message: "No active students found.", variant: "warning" });
                return;
              }
              // Group by level and update
              const updates = (students as any[]).map((s) => ({
                id: s.id,
                level: LEVEL_MAP[s.level] || s.level,
                status: LEVEL_MAP[s.level] === "Alumni" ? "graduated" : "active",
              }));
              for (const u of updates) {
                await db.from("students").update({ level: u.level, status: u.status } as any).eq("id", u.id);
              }
              showToast({ message: `${updates.length} students advanced successfully!`, variant: "success" });
              await sendAnnouncement(
                "Academic Session Advancement",
                `All students have been advanced to their next level for the new academic session. Please verify your student portal for updated information.`,
                "announcement"
              );
              // Mark session as no longer current
              await db.from("academic_sessions").update({ is_current: false } as any).eq("id", session.id);
              await load(true);
            } catch {
              showToast({ message: "Failed to advance students.", variant: "error" });
            }
          },
        },
      ]
    );
  };

  // ── Delete session ──────────────────────────────────────
  const deleteSession = (session: AcademicSession) => {
    Alert.alert("Delete Session", `Delete session "${session.name}"? All linked semesters will also be deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (!db) return;
          await db.from("semesters").delete().eq("session_id", session.id);
          await db.from("academic_sessions").delete().eq("id", session.id);
          showToast({ message: "Session deleted.", variant: "info" });
          await load(true);
        },
      },
    ]);
  };

  // ── Sync org_settings ───────────────────────────────────
  // org_settings drives course registration, results, fees, etc.
  // Must be updated whenever the admin changes current session/semester.
  const syncOrgSettings = async (opts: {
    session?: string | null;
    semester?: string | null;
    registrationOpen?: boolean;
  }) => {
    if (!db) return;
    const patch: Record<string, any> = {};
    if (opts.session   !== undefined) patch.current_session   = opts.session;
    if (opts.semester  !== undefined) patch.current_semester  = opts.semester;
    if (opts.registrationOpen !== undefined) patch.registration_open = opts.registrationOpen;
    if (Object.keys(patch).length === 0) return;
    // org_settings has exactly one row — update without filter
    await db.from("org_settings").update(patch as any).neq("id", "00000000-0000-0000-0000-000000000000");
  };

  // ── Send announcement helper ────────────────────────────
  const sendAnnouncement = async (title: string, message: string, type: string) => {
    if (!db) return;
    await db.from("notifications").insert({ title, message, type, is_read: false, user_id: null } as any);
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell
      role="admin"
      user={adminUser}
      schoolName={tenant?.name || ""}
      pageTitle="Academic Sessions"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View>
            <Text variant="heading" color="primary">Academic Sessions</Text>
            <Text variant="caption" color="muted">Manage sessions, semesters & registration windows</Text>
          </View>
          <TouchableOpacity
            onPress={() => { setEditingSession(null); setSessionSheet(true); }}
            activeOpacity={0.75}
            style={[styles.addBtn, { backgroundColor: brand.blue }]}
          >
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>New Session</Text>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
          <Icon name="status-info" size="sm" color={brand.blue} />
          <Text variant="caption" color="primary" style={{ flex: 1 }}>
            Opening a semester for registration notifies all students automatically via announcement.
          </Text>
        </View>

        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[16] }]}>
              <Spinner size="lg" label="Loading sessions..." />
            </View>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="academic-calendar"
              title="No academic sessions"
              description='Tap "New Session" to create your first academic session.'
            />
          ) : (
            sessions.map((session) => {
              const isExp = expanded.has(session.id);
              return (
                <Card key={session.id} style={{ gap: 0 }}>
                  {/* Session header */}
                  <TouchableOpacity onPress={() => toggleExpand(session.id)} activeOpacity={0.85}>
                    <View style={[layout.rowBetween, { paddingBottom: isExp ? spacing[3] : 0 }]}>
                      <View style={[layout.row, { gap: spacing[3] }]}>
                        <View style={[styles.sessionIcon, { backgroundColor: session.is_current ? brand.blueAlpha15 : colors.bg.hover }]}>
                          <Icon name="academic-calendar" size="md" color={session.is_current ? brand.blue : colors.text.muted} />
                        </View>
                        <View>
                          <View style={[layout.row, { gap: spacing[2] }]}>
                            <Text variant="label" weight="bold" color="primary">{session.name}</Text>
                            {session.is_current && <Badge label="Current" variant="blue" size="sm" />}
                          </View>
                          <Text variant="micro" color="muted">{(session.semesters || []).length} semester{(session.semesters || []).length !== 1 ? "s" : ""}</Text>
                        </View>
                      </View>
                      <View style={[layout.row, { gap: spacing[2] }]}>
                        <TouchableOpacity
                          onPress={() => { setEditingSession(session); setSessionSheet(true); }}
                          activeOpacity={0.7} style={styles.iconBtn}
                        >
                          <Icon name="ui-more" size="sm" color={colors.text.muted} />
                        </TouchableOpacity>
                        <Icon name={isExp ? "ui-up" : "ui-down"} size="sm" color={colors.text.muted} />
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* Semesters */}
                  {isExp && (
                    <View style={[styles.semestersWrap, { borderTopColor: colors.border.subtle }]}>
                      {(session.semesters || []).length === 0 ? (
                        <Text variant="caption" color="muted" align="center" style={{ paddingVertical: spacing[4] }}>
                          No semesters yet.
                        </Text>
                      ) : (
                        (session.semesters || []).map((sem) => (
                          <View
                            key={sem.id}
                            style={[styles.semRow, { borderBottomColor: colors.border.subtle }]}
                          >
                            <View style={layout.fill}>
                              <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[1] }]}>
                                <Text variant="label" weight="semibold" color="primary">{sem.name}</Text>
                                {sem.is_current && <Badge label="Active" variant="blue" size="sm" />}
                                <Badge
                                  label={sem.is_open ? "Open" : "Closed"}
                                  variant={sem.is_open ? "green" : "red"}
                                  size="sm"
                                />
                              </View>
                              {(sem.start_date || sem.end_date) && (
                                <Text variant="micro" color="muted">
                                  {sem.start_date ? formatDate(sem.start_date) : "—"} → {sem.end_date ? formatDate(sem.end_date) : "—"}
                                </Text>
                              )}
                            </View>
                            <View style={[layout.row, { gap: spacing[2] }]}>
                              <TouchableOpacity
                                onPress={() => toggleSemesterOpen(sem)}
                                activeOpacity={0.75}
                                style={[styles.toggleSemBtn, { backgroundColor: sem.is_open ? colors.status?.errorBg || "#fee2e2" : brand.blueAlpha10, borderColor: sem.is_open ? colors.status?.errorBorder || "#fca5a5" : brand.blueAlpha30 }]}
                              >
                                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: sem.is_open ? "#dc2626" : brand.blue }}>
                                  {sem.is_open ? "Close" : "Open"}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => { setEditingSemester(sem); setActiveSessId(session.id); setSemesterSheet(true); }}
                                activeOpacity={0.7} style={styles.iconBtn}
                              >
                                <Icon name="ui-more" size="sm" color={colors.text.muted} />
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))
                      )}

                      {/* Add semester */}
                      <TouchableOpacity
                        onPress={() => { setEditingSemester(null); setActiveSessId(session.id); setSemesterSheet(true); }}
                        activeOpacity={0.75}
                        style={[styles.addSemBtn, { borderColor: colors.border.DEFAULT }]}
                      >
                        <Icon name="ui-add" size="sm" color={brand.blue} />
                        <Text style={{ fontSize: fontSize.sm, color: brand.blue, fontWeight: fontWeight.semibold }}>Add Semester</Text>
                      </TouchableOpacity>

                      {/* Advance students */}
                      <TouchableOpacity
                        onPress={() => advanceStudents(session)}
                        activeOpacity={0.75}
                        style={[styles.advanceBtn, { backgroundColor: brand.goldAlpha15, borderColor: brand.goldAlpha20 }]}
                      >
                        <Icon name="ui-forward" size="sm" color={brand.goldDark} />
                        <View style={layout.fill}>
                          <Text style={{ fontSize: fontSize.sm, color: brand.goldDark, fontWeight: fontWeight.bold }}>Advance Students</Text>
                          <Text style={{ fontSize: fontSize.xs, color: brand.gold }}>Promote all active students to next level</Text>
                        </View>
                      </TouchableOpacity>

                      {/* Delete session */}
                      <TouchableOpacity
                        onPress={() => deleteSession(session)}
                        activeOpacity={0.75}
                        style={[styles.deleteBtn, { borderColor: colors.status?.errorBorder || "#fca5a5" }]}
                      >
                        <Icon name="ui-close" size="sm" color="#dc2626" />
                        <Text style={{ fontSize: fontSize.sm, color: "#dc2626", fontWeight: fontWeight.semibold }}>Delete Session</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Session sheet */}
      <SessionSheet
        visible={sessionSheet}
        onClose={() => { setSessionSheet(false); setEditingSession(null); }}
        onSave={saveSession}
        editing={editingSession}
        colors={colors}
      />

      {/* Semester sheet */}
      {activeSessId && (
        <SemesterSheet
          visible={semesterSheet}
          onClose={() => { setSemesterSheet(false); setEditingSemester(null); }}
          sessionId={activeSessId}
          onSave={saveSemester}
          editing={editingSemester}
          colors={colors}
        />
      )}
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1 },
  addBtn:       { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  infoBanner:   { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1, borderTopWidth: 1 },
  sessionIcon:  { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  semestersWrap:{ borderTopWidth: 1, marginTop: spacing[3], paddingTop: spacing[3], gap: spacing[3] },
  semRow:       { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingBottom: spacing[3], borderBottomWidth: 1 },
  toggleSemBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  iconBtn:      { padding: spacing[2] },
  addSemBtn:    { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", justifyContent: "center" },
  advanceBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  deleteBtn:    { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, justifyContent: "center" },
  yearRow:      { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center" },
  input:        { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  chip:         { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  toggleRow:    { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  saveBtn:      { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
