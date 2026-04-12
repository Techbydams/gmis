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

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Image,
  Animated, Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter }     from "expo-router";
import { useAuth }       from "@/context/AuthContext";
import { useTenant }     from "@/context/TenantContext";
import { useDrawer }     from "@/context/DrawerContext";
import { getTenantClient } from "@/lib/supabase";
import { formatGPA, getHonourClass, timeAgo, greeting } from "@/lib/helpers";
import { Text, Card, Badge, StatCard, SkeletonDashboard } from "@/components/ui";
import { useAutoLoad } from "@/lib/useAutoLoad";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

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

// ── Quick action animation types ──────────────────────────
// "slide"  → card-swipe translation  (Pay school fees)
// "wiggle" → rotation oscillation    (SUG elections megaphone)
// "spin"   → 360° clock rotation     (Timetable)
// "pulse"  → sequential scale depress (GPA calculator buttons)
// Each animation fires on press only — no continuous loops (no "vampire animations").
// When Lottie JSON assets are available, swap <Animated.View> for <LottieView> per tile.
type AnimType = "slide" | "wiggle" | "spin" | "pulse";

type QuickAction = { label: string; icon: IconName; path: string; animType?: AnimType };
const QUICK_ACTIONS: QuickAction[] = [
  { label: "View my results",  icon: "nav-results",   path: "/(tenant)/(student)/results"   },
  { label: "Pay school fees",  icon: "nav-payments",  path: "/(tenant)/(student)/payments",  animType: "slide"  },
  { label: "Timetable",        icon: "nav-timetable", path: "/(tenant)/(student)/timetable", animType: "spin"   },
  { label: "Register courses", icon: "nav-courses",   path: "/(tenant)/(student)/courses"   },
  { label: "SUG elections",    icon: "nav-voting",    path: "/(tenant)/(student)/voting",    animType: "wiggle" },
  { label: "GPA calculator",   icon: "nav-gpa",       path: "/(tenant)/(student)/gpa",       animType: "pulse"  },
  { label: "Clearance",        icon: "nav-clearance", path: "/(tenant)/(student)/clearance" },
  { label: "AI assistant",     icon: "nav-ai",        path: "/(tenant)/(student)/ai"        },
];

// ── Animated quick-action tile ─────────────────────────────
// Each animated tile fires its motion on press and then idles.
// Non-animated tiles render a plain icon (no wasted CPU).
function AnimatedActionTile({
  label, icon, path, animType, colors,
}: { label: string; icon: IconName; path: string; animType?: AnimType; colors: any }) {
  const router = useRouter();
  const anim   = useRef(new Animated.Value(0)).current;

  const play = () => {
    if (!animType) return;
    anim.setValue(0);
    switch (animType) {
      case "slide":
        // Card-swipe: shoots right then snaps back
        Animated.sequence([
          Animated.timing(anim, { toValue: 1,  duration: 160, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: -0.4, duration: 80, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0,  duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start();
        break;
      case "wiggle":
        // Megaphone vibrate: rapid left–right oscillation, decaying
        Animated.sequence([
          Animated.timing(anim, { toValue:  1,    duration: 60, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -1,    duration: 70, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  0.65, duration: 55, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -0.65, duration: 55, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  0.3,  duration: 45, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  0,    duration: 45, easing: Easing.linear, useNativeDriver: true }),
        ]).start();
        break;
      case "spin":
        // Clock hands: full 360° turn, ease-in-out
        Animated.timing(anim, {
          toValue: 1, duration: 420, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }).start(() => anim.setValue(0));
        break;
      case "pulse":
        // Calculator key depress: compress then spring back
        Animated.sequence([
          Animated.timing(anim, { toValue: -1, duration: 90,  easing: Easing.in(Easing.ease),  useNativeDriver: true }),
          Animated.timing(anim, { toValue:  1, duration: 130, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: -0.4, duration: 70, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(anim, { toValue:  0, duration: 80,  easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]).start();
        break;
    }
  };

  const iconTransform = (() => {
    if (!animType) return undefined;
    switch (animType) {
      case "slide":
        return { transform: [{ translateX: anim.interpolate({ inputRange: [-0.4, 0, 1], outputRange: [-3, 0, 9] }) }] };
      case "wiggle":
        return { transform: [{ rotate: anim.interpolate({ inputRange: [-1, 0, 1], outputRange: ["-14deg", "0deg", "14deg"] }) }] };
      case "spin":
        return { transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] };
      case "pulse":
        return { transform: [{ scale: anim.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.78, 1, 1.14] }) }] };
    }
  })();

  return (
    <TouchableOpacity
      onPress={() => { play(); router.push(path as any); }}
      activeOpacity={0.75}
      style={[styles.actionTile, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: brand.blueAlpha10 }]}>
        {animType ? (
          <Animated.View style={iconTransform}>
            <Icon name={icon} size="md" color={brand.blue} />
          </Animated.View>
        ) : (
          <Icon name={icon} size="md" color={brand.blue} />
        )}
      </View>
      <Text variant="micro" color="secondary" align="center" numberOfLines={2} style={{ marginTop: spacing[2] }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function StudentDashboard() {
  const router               = useRouter();
  const { user, signOut }    = useAuth();
  const { tenant, slug }     = useTenant();
  const { colors, isDark, toggleTheme } = useTheme();
  const { pagePadding }      = useResponsive();
  const { openDrawer }       = useDrawer();
  const insets               = useSafeAreaInsets();

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

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: !!student });

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

    if (data) setClasses(data as unknown as ClassSlot[]);
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
        <ScrollView
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          showsVerticalScrollIndicator={false}
        >
          <SkeletonDashboard />
        </ScrollView>
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

  // Find the next upcoming class today
  const now        = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextClass  = classes.find((c) => {
    const [h, m] = (c.start_time || "00:00").split(":").map(Number);
    return h * 60 + m > nowMinutes;
  }) ?? classes[0] ?? null;

  return (
    <AppShell
      role="student"
      user={shellUser}
      schoolName={tenant?.name || ""}
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      {/* Native mobile top bar — [avatar] [greeting+info] · · · [QR][bell] */}
      <View style={[styles.nativeTopBar, {
        backgroundColor:   colors.bg.card,
        borderBottomColor: colors.border.DEFAULT,
        paddingTop:        insets.top + spacing[2],
      }]}>
        {/* Avatar — taps to profile page */}
        <TouchableOpacity
          onPress={() => router.push("/(tenant)/(student)/profile" as any)}
          activeOpacity={0.8}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {student?.profile_photo ? (
            <Image source={{ uri: student.profile_photo }} style={styles.topAvatar} />
          ) : (
            <View style={[styles.topAvatar, { backgroundColor: brand.blueAlpha10, alignItems: "center", justifyContent: "center" }]}>
              <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: brand.blue }}>
                {firstName.charAt(0)}{lastName.charAt(0)}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Greeting + student info */}
        <View style={{ flex: 1, paddingHorizontal: spacing[2] }}>
          <Text numberOfLines={1} style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text.primary }}>
            {greeting()}, {firstName}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: 1 }}>
            {[student?.matric_number, deptName || null, student?.level ? `${student.level}L` : null]
              .filter(Boolean).join(" · ")}
          </Text>
        </View>

        {/* Theme toggle · QR scanner · Notification bell */}
        <View style={[layout.row, { gap: spacing[1] }]}>
          <TouchableOpacity
            onPress={toggleTheme}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.topIconBtn}
          >
            <Icon name={isDark ? "ui-sun" : "ui-moon"} size="md" color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(tenant)/(student)/qr-attendance" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.topIconBtn}
          >
            <Icon name="content-qr" size="md" color={colors.text.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(tenant)/(student)/notifications" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.topIconBtn}
          >
            <View>
              <Icon name="ui-bell" size="md" color={unread > 0 ? brand.blue : colors.text.secondary} />
              {unread > 0 && (
                <View style={[styles.bellBadge, { backgroundColor: colors.status.error }]}>
                  <Text style={{ fontSize: 9, fontWeight: fontWeight.black, color: "#fff", lineHeight: 12 }}>
                    {unread > 9 ? "9+" : unread}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, paddingBottom: spacing[12], gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor={brand.blue}
          />
        }
      >
        {/* ── Next class hero card ───────────────────────── */}
        <TouchableOpacity
          onPress={() => router.push("/(tenant)/(student)/timetable" as any)}
          activeOpacity={0.85}
        >
          <View style={[styles.heroCard, { backgroundColor: colors.bg.card, borderColor: colors.border.brand }]}>
            {/* Accent left bar */}
            <View style={[styles.heroAccent, { backgroundColor: brand.blue }]} />
            <View style={styles.heroContent}>
              <Text variant="micro" color="muted" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                {nextClass ? "Next class today" : "Today's schedule"}
              </Text>
              {nextClass ? (
                <>
                  <Text variant="title" color="primary" style={{ marginTop: spacing[1] }} numberOfLines={1}>
                    {nextClass.courses?.course_code} — {nextClass.courses?.course_name}
                  </Text>
                  <View style={[layout.row, { gap: spacing[3], marginTop: spacing[2] }]}>
                    <View style={[layout.row, { gap: spacing[1] }]}>
                      <Icon name="nav-timetable" size="sm" color={brand.blue} />
                      <Text variant="caption" color="link">
                        {nextClass.start_time?.slice(0, 5)} – {nextClass.end_time?.slice(0, 5)}
                      </Text>
                    </View>
                    {nextClass.venue && (
                      <View style={[layout.row, { gap: spacing[1] }]}>
                        <Icon name="nav-academic" size="sm" color={colors.text.muted} />
                        <Text variant="caption" color="muted">{nextClass.venue}</Text>
                      </View>
                    )}
                  </View>
                  {classes.length > 1 && (
                    <Text variant="micro" color="muted" style={{ marginTop: spacing[2] }}>
                      +{classes.length - 1} more class{classes.length - 1 > 1 ? "es" : ""} today
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text variant="title" color="primary" style={{ marginTop: spacing[1] }}>
                    No classes today
                  </Text>
                  <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>
                    {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })}
                  </Text>
                  {/* Pill button — plan ahead for tomorrow */}
                  <View style={[styles.timetableBtn, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
                    <Icon name="nav-timetable" size="xs" color={brand.blue} />
                    <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold }}>
                      View full timetable
                    </Text>
                    <Icon name="ui-forward" size="xs" color={brand.blue} />
                  </View>
                </>
              )}
            </View>
            <Icon name="ui-forward" size="md" color={colors.text.muted} />
          </View>
        </TouchableOpacity>

        {/* ── Primary stats — GPA + Attendance ─────────── */}
        <View style={[layout.row, { gap: spacing[3] }]}>
          <StatCard
            icon="academic-gpa"
            label="GPA"
            value={formatGPA(student?.gpa || 0)}
            sub={getHonourClass(student?.gpa || 0)}
            color={(student?.gpa || 0) >= 4.5 ? "success" : (student?.gpa || 0) >= 3.5 ? "info" : "warning"}
          />
          <StatCard
            icon="nav-attendance"
            label="Attendance"
            value={stats.attendance > 0 ? `${stats.attendance}%` : "—"}
            sub="This semester"
            color={stats.attendance >= 75 ? "success" : stats.attendance >= 50 ? "warning" : "error"}
          />
        </View>

        {/* ── Secondary stats — Courses + Fees ─────────── */}
        <View style={[layout.row, { gap: spacing[3] }]}>
          <StatCard
            icon="nav-courses"
            label="Courses"
            value={String(stats.courses)}
            sub="Registered"
            color="brand"
          />
          <StatCard
            icon="nav-payments"
            label="Fees"
            value={`${stats.paidFees}/${stats.totalFees}`}
            sub="Items paid"
            color={stats.paidFees === stats.totalFees && stats.totalFees > 0 ? "success" : "warning"}
          />
        </View>

        {/* ── CGPA banner ────────────────────────────────── */}
        {(student?.cgpa || 0) > 0 && (
          <TouchableOpacity
            onPress={() => router.push("/(tenant)/(student)/results" as any)}
            activeOpacity={0.8}
          >
            <Card variant="brand">
              <View style={layout.rowBetween}>
                <View style={[layout.row, { gap: spacing[2] }]}>
                  <Icon name="academic-grade" size="md" color={brand.blue} />
                  <Text variant="label" color="brand">
                    CGPA:{" "}
                    <Text variant="label" weight="extrabold" color="brand">
                      {formatGPA(student?.cgpa || 0)}
                    </Text>
                    {" "}— {getHonourClass(student?.cgpa || 0)}
                  </Text>
                </View>
                <Icon name="ui-forward" size="sm" color={brand.blue} />
              </View>
            </Card>
          </TouchableOpacity>
        )}

        {/* ── Quick actions grid ─────────────────────────── */}
        <View>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>
            Quick actions
          </Text>
          <View style={[layout.rowWrap, { gap: spacing[3] }]}>
            {QUICK_ACTIONS.map(({ label, icon, path, animType }) => (
              <AnimatedActionTile
                key={path}
                label={label}
                icon={icon}
                path={path}
                animType={animType}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* ── Notifications ──────────────────────────────── */}
        <Card>
          <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Icon name="ui-bell" size="md" color={colors.text.primary} />
              <Text variant="label" weight="bold" color="primary">Notifications</Text>
              {unread > 0 && <Badge label={`${unread}`} variant="red" size="xs" />}
            </View>
            {unread > 0 && (
              <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
                <Text variant="caption" color="link">Mark read</Text>
              </TouchableOpacity>
            )}
          </View>

          {notifs.length === 0 ? (
            <View style={[layout.centredH, { paddingVertical: spacing[5] }]}>
              <Text variant="caption" color="muted">No notifications yet.</Text>
            </View>
          ) : (
            notifs.map((n, i) => {
              const dotColor =
                n.type === "result"  ? colors.status.success :
                n.type === "payment" ? colors.status.warning :
                n.type === "alert"   ? colors.status.error   :
                colors.status.info;
              return (
                <View
                  key={n.id}
                  style={[
                    styles.notifRow,
                    i < notifs.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                    !n.is_read && { backgroundColor: brand.blueAlpha5, marginHorizontal: -spacing[4], paddingHorizontal: spacing[4] },
                  ]}
                >
                  <View style={[styles.notifDot, { backgroundColor: dotColor }]} />
                  <View style={layout.fill}>
                    <Text variant="label" weight={n.is_read ? "normal" : "semibold"} color="primary">
                      {n.title}
                    </Text>
                    <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{n.message}</Text>
                  </View>
                  <Text variant="micro" color="muted" style={{ marginLeft: spacing[2], flexShrink: 0 }}>
                    {timeAgo(n.created_at)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  ghostBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)",
  },
  settingsBtn: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.full, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  // Native top bar
  nativeTopBar: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
    gap:               spacing[2],
  },
  topAvatar: {
    width:        40,
    height:       40,
    borderRadius: radius.full,
    flexShrink:   0,
  },
  topIconBtn: {
    width:          40,
    height:         40,
    alignItems:     "center",
    justifyContent: "center",
    borderRadius:   radius.full,
  },
  bellBadge: {
    position:       "absolute",
    top:            -4,
    right:          -4,
    minWidth:       16,
    height:         16,
    borderRadius:   radius.full,
    alignItems:     "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  // Hero next-class card
  heroCard: {
    flexDirection: "row", alignItems: "center",
    borderRadius: radius.lg, borderWidth: 1,
    overflow: "hidden",
    paddingRight: spacing[4],
  },
  heroAccent: {
    width: spacing[1],
    alignSelf: "stretch",
    minHeight: 72,
  },
  heroContent: {
    flex: 1,
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[4],
  },
  // "View full timetable" pill button inside the no-classes hero card
  timetableBtn: {
    flexDirection:   "row",
    alignItems:      "center",
    alignSelf:       "flex-start",
    gap:             spacing[1],
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[2],
    borderRadius:    radius.full,
    borderWidth:     1,
    marginTop:       spacing[3],
  },
  // Quick action tile
  actionTile: {
    width: "30%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: spacing[4],
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    minWidth: 90,
    maxWidth: 120,
  },
  actionIcon: {
    width: spacing[10], height: spacing[10],
    borderRadius: radius.lg,
    alignItems: "center", justifyContent: "center",
  },
  // Notification row
  notifRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: spacing[3], paddingVertical: spacing[3],
  },
  notifDot: {
    width: spacing[2], height: spacing[2],
    borderRadius: radius.full,
    marginTop: spacing[1] + 2,
    flexShrink: 0,
  },
});
