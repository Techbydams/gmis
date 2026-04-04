// ============================================================
// GMIS — Student Dashboard
// Route: /(tenant)/(student)/dashboard
// Real data from tenant DB. No hardcoded values.
// Tables: students, semester_registrations, timetable,
//         notifications, student_payments, fee_structure,
//         attendance_records
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatGPA, getHonourClass, timeAgo, greeting } from "@/lib/helpers";
import {
  Text, Card, Badge, Avatar, StatCard, Spinner, EmptyState,
} from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }     from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import {
  brand, spacing, radius, fontSize, fontWeight,
} from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface Student {
  id:            string;
  first_name:    string;
  last_name:     string;
  matric_number: string;
  level:         string;
  status:        string;
  gpa:           number;
  cgpa:          number;
  avatar_url?:   string | null;
  departments?:  { name: string };
}

interface ClassSlot {
  id:         string;
  start_time: string;
  end_time:   string;
  venue:      string | null;
  courses: { course_code: string; course_name: string };
}

interface Notification {
  id:         string;
  title:      string;
  message:    string;
  type:       string;
  is_read:    boolean;
  created_at: string;
}

// ── Quick actions config ───────────────────────────────────
const QUICK_ACTIONS = [
  { label: "View my results",   icon: "nav-results"   as const, path: "/(tenant)/(student)/results"    },
  { label: "Pay school fees",   icon: "nav-payments"  as const, path: "/(tenant)/(student)/payments",  badge: "Due",   badgeVariant: "red"   as const },
  { label: "Timetable",         icon: "nav-timetable" as const, path: "/(tenant)/(student)/timetable"  },
  { label: "Register courses",  icon: "nav-courses"   as const, path: "/(tenant)/(student)/courses"    },
  { label: "SUG elections",     icon: "nav-voting"    as const, path: "/(tenant)/(student)/voting",    badge: "Open",  badgeVariant: "green" as const },
  { label: "GPA calculator",    icon: "nav-gpa"       as const, path: "/(tenant)/(student)/gpa"        },
  { label: "Clearance",         icon: "nav-clearance" as const, path: "/(tenant)/(student)/clearance"  },
  { label: "AI assistant",      icon: "nav-ai"        as const, path: "/(tenant)/(student)/ai",        badge: "New",   badgeVariant: "indigo" as const },
] as const;

// ── Component ──────────────────────────────────────────────
export default function StudentDashboard() {
  const router                      = useRouter();
  const { user, signOut }           = useAuth();
  const { tenant, slug }            = useTenant();
  const { colors, isDark }          = useTheme();
  const { pagePadding, gridCols }   = useResponsive();

  const [student,    setStudent]    = useState<Student | null>(null);
  const [classes,    setClasses]    = useState<ClassSlot[]>([]);
  const [notifs,     setNotifs]     = useState<Notification[]>([]);
  const [stats,      setStats]      = useState({ courses: 0, paidFees: 0, totalFees: 0, attendance: 0 });
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread,     setUnread]     = useState(0);
  const [error,      setError]      = useState<string | null>(null);

  // Memoize tenant client — mirrors the Vite fix
  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  // ── Load all data ──────────────────────────────────────
  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    setError(null);

    try {
      // Using maybeSingle() — won't crash if no row found
      const { data: s, error: sErr } = await db
        .from("students")
        .select("id, first_name, last_name, matric_number, level, status, gpa, cgpa, avatar_url, departments(name)")
        .eq("supabase_uid", user.id)
        .maybeSingle();

      if (sErr) {
        setError("Could not load your profile. Please refresh the page.");
        return;
      }
      if (!s) {
        setError("Your student record was not found. Contact your admin.");
        return;
      }

      setStudent(s as Student);

      // Load everything else in parallel
      await Promise.allSettled([
        loadClasses((s as any).id),
        loadNotifs((s as any).id),
        loadStats((s as any).id),
      ]);
    } catch (err) {
      console.error("Dashboard load error:", err);
      setError("Something went wrong loading your dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadClasses = async (sid: string) => {
    if (!db) return;
    const days  = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    const today = days[new Date().getDay()];

    const { data: regs } = await db
      .from("semester_registrations")
      .select("course_id")
      .eq("student_id", sid)
      .eq("status", "registered");

    if (!regs || regs.length === 0) return;

    const courseIds = regs.map((r: any) => r.course_id);
    const { data } = await db
      .from("timetable")
      .select("*, courses(course_code, course_name)")
      .in("course_id", courseIds)
      .eq("day_of_week", today)
      .order("start_time");

    if (data) setClasses(data as ClassSlot[]);
  };

  const loadNotifs = async (sid: string) => {
    if (!db) return;
    const { data } = await db
      .from("notifications")
      .select("*")
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

    const [regsRes, paymentsRes, feeRes, attendRes] = await Promise.allSettled([
      db.from("semester_registrations")
        .select("*", { count: "exact", head: true })
        .eq("student_id", sid).eq("status", "registered"),
      db.from("student_payments")
        .select("*", { count: "exact", head: true })
        .eq("student_id", sid).eq("status", "success"),
      db.from("fee_structure")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true),
      db.from("attendance_records")
        .select("is_present")
        .eq("student_id", sid),
    ]);

    const courses   = regsRes.status    === "fulfilled" ? (regsRes.value.count    ?? 0) : 0;
    const paidFees  = paymentsRes.status === "fulfilled" ? (paymentsRes.value.count ?? 0) : 0;
    const totalFees = feeRes.status      === "fulfilled" ? (feeRes.value.count      ?? 0) : 0;

    let attendance = 0;
    if (attendRes.status === "fulfilled" && attendRes.value.data) {
      const records = attendRes.value.data as any[];
      if (records.length > 0) {
        const present = records.filter((r) => r.is_present).length;
        attendance = Math.round((present / records.length) * 100);
      }
    }

    setStats({ courses, paidFees, totalFees, attendance });
  };

  const markRead = async () => {
    if (!db) return;
    const ids = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await db.from("notifications").update({ is_read: true } as any).in("id", ids);
    setNotifs((p) => p.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  // ── Loading ────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell role="student" user={{ name: "Loading...", role: "student" }} schoolName={tenant?.name || ""}>
        <View style={[layout.fill, layout.centred]}>
          <Spinner size="lg" label="Loading your dashboard..." />
        </View>
      </AppShell>
    );
  }

  // ── Error ──────────────────────────────────────────────
  if (error) {
    return (
      <AppShell role="student" user={{ name: user?.email || "", role: "student" }} schoolName={tenant?.name || ""}>
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          <Icon name="status-error" size="3xl" color={colors.status.error} />
          <Text variant="subtitle" color="error" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
            {error}
          </Text>
          <TouchableOpacity onPress={() => load()} activeOpacity={0.7} style={styles.retryBtn}>
            <Text variant="label" color="secondary">Try again</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  // ── Pending approval ───────────────────────────────────
  if (student?.status === "pending") {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
        <Icon name="status-pending" size="3xl" color={colors.status.warning} />
        <Text variant="title" color="primary" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          Awaiting approval
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ maxWidth: 360, marginBottom: spacing[6] }}>
          Hi {student.first_name}, your registration is pending admin approval at{" "}
          <Text variant="body" weight="bold" color="primary">{tenant?.name}</Text>.
          You'll be emailed once activated.
        </Text>
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/(tenant)/login"); }}
          activeOpacity={0.7}
          style={styles.retryBtn}
        >
          <Text variant="label" color="secondary">Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Suspended ──────────────────────────────────────────
  if (student?.status === "suspended") {
    return (
      <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary, padding: spacing[6] }]}>
        <Icon name="status-locked" size="3xl" color={colors.status.error} filled />
        <Text variant="title" color="error" align="center" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          Account suspended
        </Text>
        <Text variant="body" color="secondary" align="center" style={{ maxWidth: 360, marginBottom: spacing[6] }}>
          Your account has been suspended. Contact the {tenant?.name} admin office for assistance.
        </Text>
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/(tenant)/login"); }}
          activeOpacity={0.7}
          style={styles.retryBtn}
        >
          <Text variant="label" color="secondary">Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main dashboard ─────────────────────────────────────
  const firstName = student?.first_name || user?.email?.split("@")[0] || "Student";
  const lastName  = student?.last_name  || "";
  const fullName  = `${firstName} ${lastName}`.trim();
  const dept      = (student as any)?.departments?.name || "";

  const gpaColor = (student?.gpa || 0) >= 4.5 ? colors.status.success
    : (student?.gpa || 0) >= 3.5 ? colors.status.info
    : colors.status.warning;

  const attendanceColor = stats.attendance >= 75 ? colors.status.success
    : stats.attendance >= 50 ? colors.status.warning
    : colors.status.error;

  const shellUser = {
    name:     fullName,
    role:     "student" as const,
    sub:      student?.matric_number,
    avatarUrl: student?.avatar_url,
  };

  return (
    <AppShell
      role="student"
      user={shellUser}
      schoolName={tenant?.name || ""}
      pageTitle="Dashboard"
      onLogout={async () => { await signOut(); router.replace("/(tenant)/login"); }}
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

        {/* ── Greeting header ── */}
        <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
          <View style={layout.fill}>
            <Text variant="heading" color="primary">
              {greeting()}, {firstName} 👋
            </Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
              {student?.matric_number}
              {dept ? ` · ${dept}` : ""}
              {student?.level ? ` · ${student.level} Level` : ""}
              {tenant?.name ? ` · ${tenant.name}` : ""}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tenant)/(student)/settings")}
            activeOpacity={0.7}
            style={[styles.settingsBtn, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}
          >
            <Icon name="nav-settings" size="md" color={colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── Stats row ── */}
        <View style={[layout.rowWrap, { gap: spacing[3] }]}>
          <StatCard
            icon="academic-gpa"
            label="GPA"
            value={formatGPA(student?.gpa || 0)}
            sub={getHonourClass(student?.gpa || 0)}
            color={
              (student?.gpa || 0) >= 4.5 ? "success" :
              (student?.gpa || 0) >= 3.5 ? "info"    : "warning"
            }
          />
          <StatCard
            icon="nav-courses"
            label="Courses"
            value={String(stats.courses)}
            sub="This semester"
            color="brand"
          />
          <StatCard
            icon="nav-payments"
            label="Fees"
            value={`${stats.paidFees}/${stats.totalFees}`}
            sub="Items cleared"
            color={stats.paidFees === stats.totalFees && stats.totalFees > 0 ? "success" : "warning"}
          />
          <StatCard
            icon="nav-attendance"
            label="Attendance"
            value={stats.attendance > 0 ? `${stats.attendance}%` : "—"}
            sub="This semester"
            color={stats.attendance >= 75 ? "success" : stats.attendance >= 50 ? "warning" : "error"}
          />
        </View>

        {/* CGPA banner */}
        {(student?.cgpa || 0) > 0 && (
          <Card variant="brand">
            <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Icon name="academic-grade" size="md" color={brand.blue} />
                <Text variant="label" color="brand">
                  CGPA: <Text variant="label" weight="bold" color="brand">{formatGPA(student?.cgpa || 0)}</Text>
                  {" "}—{" "}
                  <Text variant="label" color="brand">{getHonourClass(student?.cgpa || 0)}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/(tenant)/(student)/results")} activeOpacity={0.7}>
                <Text variant="caption" color="link">View results →</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── Two column grid ── */}
        <View style={[layout.rowWrap, { gap: spacing[4], alignItems: "flex-start" }]}>

          {/* Quick actions */}
          <Card style={styles.halfCard}>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>
              Quick actions
            </Text>
            {QUICK_ACTIONS.map(({ label, icon, path, badge, badgeVariant }) => (
              <TouchableOpacity
                key={path}
                onPress={() => router.push(path as any)}
                activeOpacity={0.75}
                style={[
                  styles.actionRow,
                  { backgroundColor: colors.bg.hover, borderColor: colors.border.subtle },
                ]}
              >
                <Icon name={icon} size="md" color={colors.text.secondary} />
                <Text variant="label" color="primary" style={layout.fill}>{label}</Text>
                {badge ? (
                  <Badge label={badge} variant={badgeVariant} size="sm" />
                ) : (
                  <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                )}
              </TouchableOpacity>
            ))}
          </Card>

          {/* Today's classes */}
          <Card style={styles.halfCard}>
            <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
              <Text variant="label" weight="bold" color="primary">Today's classes</Text>
              <Text variant="caption" color="muted">
                {new Date().toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}
              </Text>
            </View>

            {classes.length === 0 ? (
              <View style={[layout.centredH, { paddingVertical: spacing[6] }]}>
                <Icon name="nav-calendar" size="2xl" color={colors.text.muted} />
                <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                  No classes today!
                </Text>
                <Text variant="caption" color="muted" align="center">
                  Enjoy your free time, {firstName}.
                </Text>
              </View>
            ) : (
              classes.map((c, i) => {
                const accent = [brand.blue, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444"][i % 5];
                return (
                  <View
                    key={c.id}
                    style={[
                      styles.classRow,
                      { borderLeftColor: accent, backgroundColor: accent + "15" },
                    ]}
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

        {/* ── Notifications ── */}
        <Card>
          <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Text variant="label" weight="bold" color="primary">Notifications</Text>
              {unread > 0 && <Badge label={`${unread} new`} variant="red" size="sm" dot />}
            </View>
            {unread > 0 && (
              <TouchableOpacity onPress={markRead} activeOpacity={0.7}>
                <Text variant="caption" color="link">Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {notifs.length === 0 ? (
            <View style={[layout.centredH, { paddingVertical: spacing[6] }]}>
              <Icon name="ui-bell" size="2xl" color={colors.text.muted} />
              <Text variant="body" color="muted" style={{ marginTop: spacing[2] }}>
                No notifications yet.
              </Text>
            </View>
          ) : (
            notifs.map((n, i) => {
              const dotColor: Record<string, string> = {
                result: colors.status.success, payment: colors.status.warning,
                info:   colors.status.info,    alert:   colors.status.error,
                success: colors.status.success,
              };
              return (
                <View
                  key={n.id}
                  style={[
                    styles.notifRow,
                    i < notifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                    { opacity: n.is_read ? 0.55 : 1 },
                  ]}
                >
                  <View style={[styles.notifDot, { backgroundColor: dotColor[n.type] || colors.status.info }]} />
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{n.title}</Text>
                    <Text variant="caption" color="secondary" style={{ marginTop: 2, lineHeight: 18 }}>
                      {n.message}
                    </Text>
                  </View>
                  <Text variant="micro" color="muted" style={{ marginLeft: spacing[2] }}>
                    {timeAgo(n.created_at)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>

        {/* Footer */}
        <Text
          variant="micro"
          color="muted"
          align="center"
          style={{ marginTop: spacing[2], marginBottom: spacing[4] }}
        >
          GMIS · A product of DAMS Technologies
        </Text>

      </ScrollView>
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  retryBtn: {
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.lg,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.12)",
    backgroundColor:   "rgba(255,255,255,0.05)",
  },
  settingsBtn: {
    width:        spacing[10],   // 40
    height:       spacing[10],
    borderRadius: radius.full,
    borderWidth:  1,
    alignItems:   "center",
    justifyContent: "center",
  },
  halfCard: {
    flex:     1,
    minWidth: 280,
  },
  actionRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2] + spacing[1],
    borderRadius:      radius.md,
    borderWidth:       1,
    marginBottom:      spacing[1] + spacing[1],
  },
  classRow: {
    borderLeftWidth:         3,
    borderTopRightRadius:    radius.md,
    borderBottomRightRadius: radius.md,
    paddingLeft:             spacing[3],
    paddingVertical:         spacing[2],
    marginBottom:            spacing[2],
  },
  notifRow: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    gap:            spacing[3],
    paddingVertical: spacing[3],
  },
  notifDot: {
    width:        spacing[2],   // 8
    height:       spacing[2],
    borderRadius: radius.full,
    marginTop:    spacing[1],
    flexShrink:   0,
  },
});
