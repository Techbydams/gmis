// ============================================================
// GMIS — Student Dashboard (Schema-verified)
//
// FIXES applied against confirmed tenant DB schema:
//  - students.profile_photo  (not avatar_url — doesn't exist)
//  - attendance_records.status (varchar) not is_present (bool)
//  - status === 'present' to count attendance
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useRouter }     from "expo-router";
import { useAuth }       from "@/context/AuthContext";
import { useTenant }     from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatGPA, getHonourClass, timeAgo, greeting } from "@/lib/helpers";
import { Text, Card, Badge, StatCard, Spinner } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Confirmed students columns ────────────────────────────
// id, supabase_uid, matric_number, application_no, email,
// email_verified, first_name, last_name, other_names,
// date_of_birth, gender, phone, address, state_of_origin,
// profile_photo, department_id, level, mode_of_entry,
// entry_session, current_session, gpa, cgpa, status,
// approved_at, id_card_printed, id_card_paid, parent_email,
// created_at, updated_at, parent_supabase_uid
// ─────────────────────────────────────────────────────────

interface Student {
  id:             string;
  first_name:     string;
  last_name:      string;
  matric_number:  string;
  level:          string;
  status:         string;
  gpa:            number;
  cgpa:           number;
  profile_photo:  string | null;  // confirmed column name
  department_id:  string | null;
  current_session: string | null;
}

interface ClassSlot {
  id: string; start_time: string; end_time: string; venue: string | null;
  courses: { course_code: string; course_name: string } | null;
}

interface Notification {
  id: string; title: string; message: string; type: string | null;
  is_read: boolean; created_at: string;
}

const QUICK_ACTIONS = [
  { label: "View my results",  icon: "nav-results"   as const, path: "/(tenant)/(student)/results"   },
  { label: "Pay school fees",  icon: "nav-payments"  as const, path: "/(tenant)/(student)/payments"  },
  { label: "Timetable",        icon: "nav-timetable" as const, path: "/(tenant)/(student)/timetable" },
  { label: "Register courses", icon: "nav-courses"   as const, path: "/(tenant)/(student)/courses"   },
  { label: "SUG elections",    icon: "nav-voting"    as const, path: "/(tenant)/(student)/voting"    },
  { label: "GPA calculator",   icon: "nav-gpa"       as const, path: "/(tenant)/(student)/gpa"       },
  { label: "Clearance",        icon: "nav-clearance" as const, path: "/(tenant)/(student)/clearance" },
  { label: "AI assistant",     icon: "nav-ai"        as const, path: "/(tenant)/(student)/ai"        },
] as const;

export default function StudentDashboard() {
  const router               = useRouter();
  const { user, signOut }    = useAuth();
  const { tenant, slug }     = useTenant();
  const { colors }           = useTheme();
  const { pagePadding }      = useResponsive();

  const [student,    setStudent]    = useState<Student | null>(null);
  const [deptName,   setDeptName]   = useState("");
  const [classes,    setClasses]    = useState<ClassSlot[]>([]);
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [stats,      setStats]      = useState({ courses: 0, paidFees: 0, totalFees: 0, attendance: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread,     setUnread]     = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      // Query only confirmed columns — no guessing
      const { data: s, error: sErr } = await db
        .from("students")
        .select("id, first_name, last_name, matric_number, level, status, gpa, cgpa, profile_photo, department_id, current_session")
        .eq("supabase_uid", user.id)
        .maybeSingle();

      if (sErr) {
        console.error("Student query error:", sErr);
        setError(`Profile load failed: ${sErr.message}`);
        return;
      }
      if (!s) {
        setError("Your student record was not found. Contact your admin.");
        return;
      }

      setStudent(s as Student);

      // Fetch department name separately (departments has faculty_id, not a nested faculties object)
      const sAny = s as any;
      if (sAny.department_id) {
        const { data: dept } = await db
          .from("departments")
          .select("name")
          .eq("id", sAny.department_id)
          .maybeSingle();
        if (dept) setDeptName((dept as any).name || "");
      }

      await Promise.allSettled([
        loadTodayClasses(sAny.id),
        loadNotifications(sAny.id),
        loadStats(sAny.id),
      ]);
    } catch (err: any) {
      setError(`Error: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTodayClasses = async (sid: string) => {
    if (!db) return;
    const days  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const today = days[new Date().getDay()];

    // Get course IDs the student is registered for
    const { data: regs } = await db
      .from("semester_registrations")
      .select("course_id")
      .eq("student_id", sid)
      .eq("status", "registered");

    if (!regs?.length) return;

    const { data } = await db
      .from("timetable")
      .select("id, start_time, end_time, venue, courses(course_code, course_name)")
      .in("course_id", regs.map((r: any) => r.course_id))
      .eq("day_of_week", today)
      .order("start_time");

    if (data) setClasses(data as ClassSlot[]);
  };

  const loadNotifications = async (sid: string) => {
    if (!db) return;
    // notifications.user_id — confirmed from schema
    const { data } = await db
      .from("notifications")
      .select("id, title, message, type, is_read, created_at")
      .or(`user_id.eq.${sid},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(6);

    if (data) {
      setNotifs(data as Notification[]);
      setUnread(data.filter((n: any) => !n.is_read).length);
    }
  };

  const loadStats = async (sid: string) => {
    if (!db) return;

    const [regsRes, paidRes, feeRes, attRes] = await Promise.allSettled([
      db.from("semester_registrations")
        .select("*", { count: "exact", head: true })
        .eq("student_id", sid).eq("status", "registered"),
      db.from("student_payments")
        .select("*", { count: "exact", head: true })
        .eq("student_id", sid).eq("status", "success"),
      db.from("fee_structure")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      // attendance_records.status is varchar — 'present' or 'absent'
      db.from("attendance_records")
        .select("status")
        .eq("student_id", sid),
    ]);

    const courses   = regsRes.status === "fulfilled" ? (regsRes.value.count ?? 0) : 0;
    const paidFees  = paidRes.status  === "fulfilled" ? (paidRes.value.count  ?? 0) : 0;
    const totalFees = feeRes.status   === "fulfilled" ? (feeRes.value.count   ?? 0) : 0;

    // Count attendance by status === 'present'
    let attendance = 0;
    if (attRes.status === "fulfilled" && attRes.value.data) {
      const records = attRes.value.data as any[];
      if (records.length > 0) {
        const presentCount = records.filter((r) =>
          (r.status || "").toLowerCase() === "present"
        ).length;
        attendance = Math.round((presentCount / records.length) * 100);
      }
    }

    setStats({ courses, paidFees, totalFees, attendance });
  };

  const markAllRead = async () => {
    if (!db) return;
    const unreadIds = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (!unreadIds.length) return;
    await db.from("notifications").update({ is_read: true } as any).in("id", unreadIds);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  // ── Status screens ─────────────────────────────────────
  if (!loading && student?.status === "pending") {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
        <Icon name="status-pending" size="3xl" color={colors.status.warning} />
        <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          Awaiting approval
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ maxWidth: 340, marginBottom: spacing[6] }}>
          Hi {student.first_name}, your registration is pending admin approval at{" "}
          <Text variant="body" weight="bold" color="primary">{tenant?.name}</Text>.
        </Text>
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/login"); }}
          style={styles.ghostBtn} activeOpacity={0.7}
        >
          <Text variant="label" color="secondary">Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!loading && student?.status === "suspended") {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
        <Icon name="status-locked" size="3xl" color={colors.status.error} filled />
        <Text variant="title" color="error" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          Account suspended
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ maxWidth: 340, marginBottom: spacing[6] }}>
          Contact the {tenant?.name} admin office for assistance.
        </Text>
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/login"); }}
          style={styles.ghostBtn} activeOpacity={0.7}
        >
          <Text variant="label" color="secondary">Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const firstName = student?.first_name || user?.email?.split("@")[0] || "Student";
  const lastName  = student?.last_name  || "";
  const fullName  = `${firstName} ${lastName}`.trim();

  const shellUser = {
    name:      fullName,
    role:      "student" as const,
    sub:       student?.matric_number,
    photoUrl:  student?.profile_photo ?? undefined,
  };

  if (loading) {
    return (
      <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Dashboard">
        <View style={[layout.fill, layout.centred]}>
          <Spinner size="lg" label="Loading dashboard..." />
        </View>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Dashboard">
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          <Icon name="status-error" size="3xl" color={colors.status.error} />
          <Text variant="subtitle" color="error" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
            Could not load dashboard
          </Text>
          <Text variant="caption" color="muted" align="center" style={{ marginBottom: spacing[5], maxWidth: 320 }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => load()} style={styles.ghostBtn} activeOpacity={0.7}>
            <Text variant="label" color="secondary">Try again</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell
      role="student"
      user={shellUser}
      schoolName={tenant?.name || ""}
      pageTitle="Dashboard"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={brand.blue}
          />
        }
      >
        {/* Greeting */}
        <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
          <View style={layout.fill}>
            <Text variant="heading" color="primary">
              {greeting()}, {firstName} 👋
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
              {student?.matric_number}
              {deptName ? ` · ${deptName}` : ""}
              {student?.level ? ` · ${student.level} Level` : ""}
              {tenant?.name ? ` · ${tenant.name}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tenant)/(student)/settings" as any)}
            style={[styles.settingsBtn, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}
            activeOpacity={0.7}
          >
            <Icon name="nav-settings" size="md" color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          <StatCard
            icon="academic-gpa" label="GPA" value={formatGPA(student?.gpa || 0)}
            sub={getHonourClass(student?.gpa || 0)}
            color={(student?.gpa || 0) >= 4.5 ? "success" : (student?.gpa || 0) >= 3.5 ? "info" : "warning"}
          />
          <StatCard icon="nav-courses" label="Courses" value={String(stats.courses)} sub="Registered" color="brand" />
          <StatCard
            icon="nav-payments" label="Fees" value={`${stats.paidFees}/${stats.totalFees}`} sub="Items paid"
            color={stats.paidFees === stats.totalFees && stats.totalFees > 0 ? "success" : "warning"}
          />
          <StatCard
            icon="nav-attendance" label="Attendance"
            value={stats.attendance > 0 ? `${stats.attendance}%` : "—"} sub="This semester"
            color={stats.attendance >= 75 ? "success" : stats.attendance >= 50 ? "warning" : "error"}
          />
        </View>

        {/* CGPA banner */}
        {(student?.cgpa || 0) > 0 && (
          <Card variant="brand">
            <View style={layout.rowBetween}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Icon name="academic-grade" size="md" color={brand.blue} />
                <Text variant="label" color="brand">
                  CGPA: <Text variant="label" weight="bold" color="brand">{formatGPA(student?.cgpa || 0)}</Text>
                  {" "}— {getHonourClass(student?.cgpa || 0)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tenant)/(student)/results" as any)}>
                <Text variant="caption" color="link">View results →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Quick actions + Today's classes */}
        <View style={[layout.rowWrap, { gap: spacing[4], alignItems: "flex-start" }]}>
          <Card style={styles.halfCard}>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>
              Quick actions
            </Text>
            {QUICK_ACTIONS.map(({ label, icon, path }) => (
              <TouchableOpacity
                key={path}
                onPress={() => router.push(path as any)}
                activeOpacity={0.75}
                style={[styles.actionRow, { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle }]}
              >
                <Icon name={icon} size="md" color={colors.text.secondary} />
                <Text variant="label" color="primary" style={layout.fill}>{label}</Text>
                <Icon name="ui-forward" size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            ))}
          </Card>

          <Card style={styles.halfCard}>
            <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
              <Text variant="label" weight="bold" color="primary">Today's classes</Text>
              <Text variant="caption" color="muted">
                {new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
              </Text>
            </View>
            {classes.length === 0 ? (
              <View style={[layout.centredH, { paddingVertical: spacing[5] }]}>
                <Icon name="nav-calendar" size="2xl" color={colors.text.muted} />
                <Text variant="caption" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                  No classes today 🎉
                </Text>
              </View>
            ) : (
              classes.map((c, i) => {
                const accent = [brand.blue, "#10b981", "#f59e0b", "#8b5cf6"][i % 4];
                return (
                  <View
                    key={c.id}
                    style={[styles.classRow, { borderLeftColor: accent, backgroundColor: accent + "15" }]}
                  >
                    <Text variant="label" weight="semibold" color="primary">
                      {c.courses?.course_code} — {c.courses?.course_name}
                    </Text>
                    <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
                      {c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}
                      {c.venue ? ` · ${c.venue}` : ""}
                    </Text>
                  </View>
                );
              })
            )}
          </Card>
        </View>

        {/* Notifications */}
        <Card>
          <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Text variant="label" weight="bold" color="primary">Notifications</Text>
              {unread > 0 && <Badge label={`${unread} new`} variant="red" size="sm" />}
            </View>
            {unread > 0 && (
              <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                <Text variant="caption" color="link">Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>
          {notifs.length === 0 ? (
            <View style={[layout.centredH, { paddingVertical: spacing[5] }]}>
              <Text variant="body" color="muted">No notifications yet.</Text>
            </View>
          ) : (
            notifs.map((n, i) => (
              <View
                key={n.id}
                style={[
                  styles.notifRow,
                  i < notifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                  { opacity: n.is_read ? 0.55 : 1 },
                ]}
              >
                <View style={[
                  styles.notifDot,
                  {
                    backgroundColor:
                      n.type === "result"  ? colors.status.success :
                      n.type === "payment" ? colors.status.warning :
                      n.type === "alert"   ? colors.status.error   :
                      colors.status.info,
                  },
                ]} />
                <View style={layout.fill}>
                  <Text variant="label" weight="semibold" color="primary">{n.title}</Text>
                  <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{n.message}</Text>
                </View>
                <Text variant="micro" color="muted" style={{ marginLeft: spacing[2] }}>
                  {timeAgo(n.created_at)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Text variant="micro" color="muted" align="center" style={{ marginBottom: spacing[4] }}>
          GMIS · A product of DAMS Technologies
        </Text>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  ghostBtn:   { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)" },
  settingsBtn:{ width: spacing[10], height: spacing[10], borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  halfCard:   { flex: 1, minWidth: 280 },
  actionRow:  { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[3], paddingVertical: spacing[2] + spacing[1], borderRadius: radius.md, borderWidth: 1, marginBottom: spacing[2] },
  classRow:   { borderLeftWidth: 3, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md, paddingLeft: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[2] },
  notifRow:   { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingVertical: spacing[3] },
  notifDot:   { width: spacing[2], height: spacing[2], borderRadius: radius.full, marginTop: spacing[1], flexShrink: 0 },
});
