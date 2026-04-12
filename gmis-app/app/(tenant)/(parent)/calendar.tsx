// ============================================================
// GMIS — Parent: Academic Calendar
// Route: /(tenant)/(parent)/calendar
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  event_type: string | null;
}

const EVENT_COLORS: Record<string, string> = {
  exam:       "#ef4444",
  holiday:    "#10b981",
  resumption: "#3b82f6",
  deadline:   "#f59e0b",
  default:    "#8b5cf6",
};

export default function ParentCalendar() {
  const { user }         = useAuth();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();
  const { pagePadding }  = useResponsive();

  const [events,  setEvents]  = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async () => {
    if (!db) return;
    const { data } = await db
      .from("academic_calendar")
      .select("id, title, description, start_date, end_date, event_type")
      .gte("start_date", new Date().toISOString().split("T")[0])
      .order("start_date");
    setEvents((data || []) as CalEvent[]);
    setLoading(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const isUpcoming = (e: CalEvent) => new Date(e.start_date) >= new Date();
  const isPast     = (e: CalEvent) => !isUpcoming(e);

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  return (
    <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Academic Calendar"
      onLogout={async () => {}}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : events.length === 0 ? (
          <EmptyState
            icon="nav-calendar"
            title="No upcoming events"
            description="Academic calendar events will appear here when published by the school."
          />
        ) : (
          <Card>
            {events.map((e, i) => {
              const color = EVENT_COLORS[e.event_type?.toLowerCase() || "default"] || EVENT_COLORS.default;
              return (
                <View key={e.id} style={[styles.eventRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < events.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{e.title}</Text>
                    {e.description && (
                      <Text variant="caption" color="secondary" style={{ marginTop: 2 }}>{e.description}</Text>
                    )}
                    <Text style={{ fontSize: fontSize.xs, color: color, marginTop: spacing[1], fontWeight: fontWeight.semibold }}>
                      {formatDate(e.start_date)}
                      {e.end_date && e.end_date !== e.start_date ? ` – ${formatDate(e.end_date)}` : ""}
                    </Text>
                  </View>
                  {e.event_type && (
                    <Badge
                      label={e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1)}
                      variant={e.event_type === "exam" ? "red" : e.event_type === "holiday" ? "green" : "blue"}
                      size="sm"
                    />
                  )}
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], paddingVertical: spacing[4] },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0 },
});
