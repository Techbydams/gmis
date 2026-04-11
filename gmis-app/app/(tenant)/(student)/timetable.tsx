// ============================================================
// GMIS — Student Timetable
// Route: /(tenant)/(student)/timetable
// Tables: timetable, exam_timetable, org_settings
// Live status: NOW / UP NEXT / ENDED — updates every 30s
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useRef } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { scheduleClassReminder, cancelClassReminder } from "@/lib/notifications";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

type Day = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday";
const DAYS: Day[] = ["monday","tuesday","wednesday","thursday","friday","saturday"];
const DAY_LABELS = { monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat" };

interface TTEntry {
  id: string; day_of_week: Day; start_time: string; end_time: string; venue: string | null;
  courses?: { course_code: string; course_name: string; credit_units: number; lecturers?: { full_name: string } };
}

export default function StudentTimetable() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [timetable,  setTimetable]  = useState<TTEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDay,  setActiveDay]  = useState<Day>(
    (["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date().getDay()] as Day) || "monday"
  );
  const [now, setNow] = useState(new Date());
  const timerRef = useRef<any>(null);
  // Map of timetable entry id → scheduled notification id (persisted in AsyncStorage)
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const STORAGE_KEY = "gmis:timetable_reminders";

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  // Load persisted reminder map from storage
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setReminders(JSON.parse(raw)); } catch { /* corrupt — ignore */ }
      }
    });
  }, []);

  // Update "now" every 30s for live status
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timerRef.current);
  }, []);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: s } = await db.from("students").select("id, department_id, level").eq("supabase_uid", user.id).maybeSingle();
      if (!s) { setLoading(false); return; }

      const { data: regs } = await db.from("semester_registrations").select("course_id").eq("student_id", (s as any).id).eq("status", "registered");
      const courseIds = (regs || []).map((r: any) => r.course_id);

      let query = db.from("timetable").select("*, courses(course_code, course_name, credit_units, lecturers(full_name))");
      if (courseIds.length > 0) query = query.in("course_id", courseIds);
      else query = query.eq("department_id", (s as any).department_id);

      const { data } = await query.order("start_time");
      setTimetable((data || []) as TTEntry[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  // ── Reminder toggle ───────────────────────────────────
  const toggleReminder = async (entry: TTEntry) => {
    // Web: notifications aren't supported the same way
    if (Platform.OS === "web") {
      Alert.alert("Not available", "Class reminders require the mobile app.");
      return;
    }

    const existingId = reminders[entry.id];

    if (existingId) {
      // Cancel existing reminder
      await cancelClassReminder(existingId);
      const next = { ...reminders };
      delete next[entry.id];
      setReminders(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      Alert.alert("Reminder removed", `No longer reminding you about ${entry.courses?.course_code}.`);
    } else {
      // Schedule new reminder 10 minutes before class
      const notifId = await scheduleClassReminder({
        entryId:    entry.id,
        courseCode: entry.courses?.course_code || "Class",
        courseName: entry.courses?.course_name || "",
        venue:      entry.venue,
        dayOfWeek:  entry.day_of_week,
        startTime:  entry.start_time,
        minutesBefore: 10,
      });

      if (!notifId) {
        Alert.alert(
          "Reminder not set",
          "Could not schedule reminder. Make sure notification permission is granted in Settings.",
        );
        return;
      }

      const next = { ...reminders, [entry.id]: notifId };
      setReminders(next);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      // Figure out next occurrence for user feedback
      const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
      const targetDay = days.indexOf(entry.day_of_week);
      const today     = new Date().getDay();
      let   daysAhead = targetDay - today;
      if (daysAhead < 0) daysAhead += 7;
      const when = daysAhead === 0 ? "today" : daysAhead === 1 ? "tomorrow" : entry.day_of_week;

      Alert.alert(
        "Reminder set",
        `You'll be notified 10 minutes before ${entry.courses?.course_code} ${when} at ${entry.start_time.slice(0,5)}.`,
      );
    }
  };

  const dayEntries = timetable.filter((e) => e.day_of_week === activeDay);

  // Live class status
  const getStatus = (entry: TTEntry) => {
    const toMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const cur  = now.getHours() * 60 + now.getMinutes();
    const day  = DAYS[now.getDay() - 1] || "monday";
    if (activeDay !== day) return null;
    const start = toMins(entry.start_time);
    const end   = toMins(entry.end_time);
    if (cur >= start && cur < end) return "NOW";
    if (cur < start && start - cur <= 30) return "UP NEXT";
    if (cur >= end) return "ENDED";
    return null;
  };

  const CLASS_COLORS = [brand.blue, "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  if (loading) return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Timetable">
      <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
    </AppShell>
  );

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Timetable" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Timetable</Text>

        {/* Day tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[layout.row, { gap: spacing[2] }]}>
            {DAYS.map((day) => {
              const isToday = day === (DAYS[new Date().getDay() - 1] || "monday");
              const isActive = day === activeDay;
              return (
                <TouchableOpacity key={day} onPress={() => setActiveDay(day)} activeOpacity={0.75}
                  style={[styles.dayTab, { backgroundColor: isActive ? brand.blue : colors.bg.hover, borderColor: isActive ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: isActive ? fontWeight.bold : fontWeight.normal, color: isActive ? "#fff" : colors.text.secondary }}>
                    {DAY_LABELS[day]}
                  </Text>
                  {isToday && <View style={[styles.todayDot, { backgroundColor: isActive ? "#fff" : brand.blue }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Classes */}
        {dayEntries.length === 0 ? (
          <EmptyState icon="nav-calendar" title="No classes" description={`No classes on ${activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}.`} />
        ) : (
          dayEntries.map((entry, i) => {
            const status      = getStatus(entry);
            const accent      = CLASS_COLORS[i % CLASS_COLORS.length];
            const hasReminder = !!reminders[entry.id];
            return (
              <View key={entry.id} style={[styles.classCard, { borderLeftColor: accent, backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
                <View style={[layout.rowBetween, { marginBottom: spacing[1] }]}>
                  <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary, flex: 1, marginRight: spacing[2] }} numberOfLines={1}>
                    {entry.courses?.course_code} — {entry.courses?.course_name}
                  </Text>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    {status === "NOW"     && <Badge label="NOW"     variant="green" dot />}
                    {status === "UP NEXT" && <Badge label="Up Next" variant="amber" />}
                    {status === "ENDED"   && <Badge label="Ended"   variant="gray"  />}
                    {/* Bell reminder button — mobile only */}
                    {Platform.OS !== "web" && (
                      <TouchableOpacity
                        onPress={() => toggleReminder(entry)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.bellBtn, {
                          backgroundColor: hasReminder ? brand.blueAlpha15 : colors.bg.hover,
                          borderColor:     hasReminder ? brand.blueAlpha30 : colors.border.DEFAULT,
                        }]}
                      >
                        <Icon
                          name={hasReminder ? "ui-bell" : "ui-bell"}
                          size="sm"
                          color={hasReminder ? brand.blue : colors.text.muted}
                          filled={hasReminder}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary }}>
                  {entry.start_time?.slice(0,5)} – {entry.end_time?.slice(0,5)}
                  {entry.venue ? ` · ${entry.venue}` : ""}
                  {(entry.courses as any)?.lecturers?.full_name ? ` · ${(entry.courses as any).lecturers.full_name}` : ""}
                </Text>
                {hasReminder && (
                  <Text style={{ fontSize: fontSize.xs, color: brand.blue, marginTop: spacing[1] }}>
                    Reminder set · 10 min before
                  </Text>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  dayTab:   { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1, position: "relative" as any },
  todayDot: { position: "absolute", bottom: spacing[1], right: spacing[1], width: spacing[1] + 1, height: spacing[1] + 1, borderRadius: radius.full },
  classCard:{ borderLeftWidth: 4, borderRadius: radius.lg, borderWidth: 1, padding: spacing[4] },
  bellBtn:  { width: 32, height: 32, borderRadius: radius.full, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
