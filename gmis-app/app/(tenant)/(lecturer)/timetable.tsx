// ============================================================
// GMIS — Lecturer Timetable
// Route: /(tenant)/(lecturer)/timetable
// Shows the lecturer's weekly class schedule
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { Text, Card, Spinner, EmptyState } from "@/components/ui";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  courses: { course_code: string; course_name: string } | null;
}

export default function LecturerTimetable() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [lecturer, setLecturer] = useState<any>(null);
  const [slots,    setSlots]    = useState<Slot[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [activeDay, setActiveDay] = useState(() => {
    const d = new Date().getDay(); // 0=Sun
    return d === 0 || d === 6 ? DAYS[0] : DAYS[d - 1];
  });

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  // Load only when screen is first focused (no reload on back-navigate)
  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: slots.length > 0 });

  const load = async () => {
    if (!db || !user) return;
    const { data: lec } = await db.from("lecturers").select("id, full_name, staff_id").eq("supabase_uid", user.id).maybeSingle();
    if (!lec) { setLoading(false); return; }
    setLecturer(lec);

    // Query directly by lecturer_id — avoids the two-step courses lookup
    const { data } = await db
      .from("timetable")
      .select("id, day_of_week, start_time, end_time, venue, courses(course_code, course_name)")
      .eq("lecturer_id", (lec as any).id)
      .order("start_time");
    setSlots((data || []) as unknown as Slot[]);
    setLoading(false);
  };

  const formatTime = (t: string) => {
    if (!t) return "";
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${m} ${ampm}`;
  };

  const todayName = DAYS[Math.max(0, new Date().getDay() - 1)] ?? DAYS[0];
  const daySlots  = slots.filter((s) => s.day_of_week === activeDay);
  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const };

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Timetable"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">My Timetable</Text>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : (
          <>
            {/* Day selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[layout.row, { gap: spacing[2] }]}>
                {DAYS.map((day, i) => {
                  const hasClass = slots.some((s) => s.day_of_week === day);
                  const isActive = activeDay === day;
                  const isToday  = day === todayName;
                  return (
                    <TouchableOpacity key={day} onPress={() => setActiveDay(day)} activeOpacity={0.75}
                      style={[styles.dayChip, {
                        backgroundColor: isActive ? brand.blue : colors.bg.card,
                        borderColor: isActive ? brand.blue : isToday ? brand.gold : colors.border.DEFAULT,
                        borderWidth: isToday && !isActive ? 2 : 1,
                      }]}>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: isToday ? fontWeight.black : fontWeight.semibold, color: isActive ? "#fff" : isToday ? brand.gold : colors.text.secondary }}>
                        {DAY_SHORT[i]}
                      </Text>
                      {isToday && !isActive && (
                        <Text style={{ fontSize: 9, color: brand.gold, fontWeight: fontWeight.bold }}>TODAY</Text>
                      )}
                      {hasClass && (
                        <View style={[styles.dot, { backgroundColor: isActive ? colors.bg.card : brand.blue }]} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {daySlots.length === 0 ? (
              <EmptyState
                icon="nav-timetable"
                title="No classes"
                description={`You have no classes scheduled for ${activeDay}.`}
              />
            ) : (
              <Card>
                {daySlots.map((slot, i) => (
                  <View key={slot.id} style={[styles.slotRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < daySlots.length - 1 ? 1 : 0 }]}>
                    {/* Time column */}
                    <View style={styles.timeCol}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>{formatTime(slot.start_time)}</Text>
                      <Text style={{ fontSize: fontSize["2xs"] + 1, color: colors.text.muted, marginTop: 2 }}>{formatTime(slot.end_time)}</Text>
                    </View>

                    {/* Divider */}
                    <View style={[styles.divider, { backgroundColor: brand.blueAlpha40 }]} />

                    {/* Content */}
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{slot.courses?.course_name || "Unknown"}</Text>
                      <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold, marginTop: 2 }}>
                        {slot.courses?.course_code}
                      </Text>
                      {slot.venue && (
                        <Text variant="micro" color="muted" style={{ marginTop: 2 }}>{slot.venue}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  dayChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1, alignItems: "center", gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  slotRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingVertical: spacing[4] },
  timeCol: { width: 56, alignItems: "flex-end" },
  divider: { width: 2, borderRadius: 1, alignSelf: "stretch", marginHorizontal: spacing[1] },
});
