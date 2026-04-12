// ============================================================
// GMIS — Academic Calendar
// Route: /(tenant)/(student)/calendar
// Table: academic_calendar
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useTenant } from "@/context/TenantContext";
import { useAuth }   from "@/context/AuthContext";
import { getTenantClient } from "@/lib/supabase";
import { formatDate } from "@/lib/helpers";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface CalEvent {
  id: string; title: string; description: string | null;
  event_date: string; end_date: string | null;
  event_type: string; session: string;
}

type EventType = "exam"|"registration"|"holiday"|"deadline"|"resumption"|"lecture"|"graduation"|"orientation"|"other";

const EVENT_CONFIG: Record<string, { icon: IconName; color: string; label: string }> = {
  exam:         { icon: "academic-exam",     color: "#f87171", label: "Exam"         },
  registration: { icon: "action-edit",       color: "#60a5fa", label: "Registration" },
  holiday:      { icon: "content-star",      color: "#4ade80", label: "Holiday"      },
  deadline:     { icon: "status-warning",    color: "#fbbf24", label: "Deadline"     },
  resumption:   { icon: "nav-home",          color: "#a855f7", label: "Resumption"   },
  lecture:      { icon: "nav-courses",       color: brand.blue, label: "Lecture"     },
  graduation:   { icon: "academic-grade",    color: brand.gold, label: "Graduation"  },
  orientation:  { icon: "user-student",      color: "#10b981", label: "Orientation"  },
  other:        { icon: "nav-calendar",      color: "#7a8bbf", label: "Event"        },
};

export default function CalendarPage() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [events,     setEvents]     = useState<CalEvent[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter,     setFilter]     = useState<string>("all");

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data } = await db
        .from("academic_calendar")
        .select("*")
        .eq("is_published", true)
        .gte("event_date", new Date(Date.now() - 30 * 86400_000).toISOString().split("T")[0])
        .order("event_date", { ascending: true });
      setEvents((data || []) as CalEvent[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const today      = new Date().toISOString().split("T")[0];
  const upcoming   = events.filter((e) => e.event_date >= today);
  const past       = events.filter((e) => e.event_date < today);
  const displayed  = filter === "all" ? upcoming : upcoming.filter((e) => e.event_type === filter);

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Calendar" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <Text variant="heading" color="primary">Academic Calendar</Text>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[layout.row, { gap: spacing[2] }]}>
            {["all", ...Object.keys(EVENT_CONFIG)].map((type) => (
              <TouchableOpacity key={type} onPress={() => setFilter(type)} activeOpacity={0.75}>
                <Badge
                  label={type === "all" ? "All" : EVENT_CONFIG[type]?.label || type}
                  variant={filter === type ? "blue" : "gray"}
                  size="md"
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : displayed.length === 0 ? (
          <EmptyState icon="nav-calendar" title="No upcoming events" description="Academic events will appear here once published by your school." />
        ) : (
          displayed.map((ev) => {
            const cfg   = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG.other;
            const isToday = ev.event_date === today;
            const isSoon  = !isToday && ev.event_date <= new Date(Date.now() + 7 * 86400_000).toISOString().split("T")[0];
            return (
              <Card key={ev.id} variant={isToday ? "warning" : "default"}>
                <View style={[layout.row, { gap: spacing[3] }]}>
                  <View style={[styles.evIcon, { backgroundColor: cfg.color + "18", borderColor: cfg.color + "30" }]}>
                    <Icon name={cfg.icon} size="lg" color={cfg.color} />
                  </View>
                  <View style={layout.fill}>
                    <View style={[layout.rowBetween, { marginBottom: spacing[1] }]}>
                      <Text variant="label" weight="bold" color="primary" style={layout.fill}>{ev.title}</Text>
                      {isToday && <Badge label="TODAY" variant="amber" size="sm" dot />}
                      {isSoon && !isToday && <Badge label="Soon" variant="blue" size="sm" />}
                    </View>
                    {ev.description && (
                      <Text variant="caption" color="secondary" style={{ marginBottom: spacing[1] }}>{ev.description}</Text>
                    )}
                    <View style={[layout.row, { gap: spacing[3] }]}>
                      <Badge label={cfg.label} variant="gray" size="sm" />
                      <Text variant="micro" color="muted">
                        {formatDate(ev.event_date)}
                        {ev.end_date && ev.end_date !== ev.event_date ? ` → ${formatDate(ev.end_date)}` : ""}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            );
          })
        )}

        {/* Past events */}
        {past.length > 0 && (
          <View>
            <Text variant="label" color="muted" style={{ marginBottom: spacing[2] }}>Past events</Text>
            {past.slice(-3).reverse().map((ev) => {
              const cfg = EVENT_CONFIG[ev.event_type] || EVENT_CONFIG.other;
              return (
                <Card key={ev.id} padding="sm" style={{ marginBottom: spacing[2], opacity: 0.6 }}>
                  <View style={[layout.row, { gap: spacing[3] }]}>
                    <Icon name={cfg.icon} size="md" color={colors.text.muted} />
                    <View style={layout.fill}>
                      <Text variant="caption" color="secondary">{ev.title}</Text>
                      <Text variant="micro" color="muted">{formatDate(ev.event_date)}</Text>
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  evIcon: { width: spacing[12], height: spacing[12], borderRadius: radius.xl, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1 },
});
