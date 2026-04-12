// ============================================================
// GMIS — Student Clearance
// Route: /(tenant)/(student)/clearance
// Table: clearance_items
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatDate } from "@/lib/helpers";
import { Text, Card, Badge, Spinner } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface ClearanceItem {
  id: string; department: string; status: string;
  cleared_by: string | null; notes: string | null;
  session: string; updated_at: string;
}

const DEPARTMENTS: { key: string; label: string; icon: IconName; desc: string }[] = [
  { key: "library",  label: "Library",    icon: "nav-courses",   desc: "Return all borrowed books and clear outstanding fines" },
  { key: "fees",     label: "Fees",       icon: "nav-payments",  desc: "All semester fees must be fully paid and confirmed" },
  { key: "hostel",   label: "Hostel",     icon: "nav-home",      desc: "Return your room key and clear all hostel charges" },
  { key: "lab",      label: "Laboratory", icon: "nav-ai",        desc: "Return all laboratory equipment and clear outstanding fees" },
  { key: "sports",   label: "Sports",     icon: "content-trophy",desc: "Return sports equipment and clear all dues" },
];

export default function Clearance() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [items,     setItems]     = useState<ClearanceItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [session,   setSession]   = useState("2024/2025");

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user, session]);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
      if (!s) { setLoading(false); return; }
      const { data } = await db.from("clearance_items").select("*").eq("student_id", (s as any).id).eq("session", session);
      setItems((data || []) as ClearanceItem[]);
    } finally { setLoading(false); setRefreshing(false); }
  };

  const getStatus = (dept: string) => items.find((i) => i.department === dept);
  const cleared   = DEPARTMENTS.filter((d) => getStatus(d.key)?.status === "cleared").length;
  const allClear  = cleared === DEPARTMENTS.length;
  const pct       = Math.round((cleared / DEPARTMENTS.length) * 100);

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Clearance" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        <View>
          <Text variant="heading" color="primary">End-of-year clearance</Text>
          <Text variant="caption" color="muted">Complete all items before the semester ends.</Text>
        </View>

        {/* Progress card */}
        <Card variant={allClear ? "success" : "default"}>
          <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3], marginBottom: spacing[4] }]}>
            <View>
              <Text style={{ fontSize: fontSize["4xl"], fontWeight: fontWeight.black, color: allClear ? colors.status.success : colors.text.primary, lineHeight: fontSize["4xl"] }}>
                {cleared}/{DEPARTMENTS.length}
              </Text>
              <Text variant="caption" color={allClear ? "success" : "secondary"}>
                {allClear ? "All clearances complete! You are fully cleared." : "Clearance items completed"}
              </Text>
            </View>
            <Badge
              label={allClear ? "Fully Cleared" : `${pct}% Done`}
              variant={allClear ? "green" : "amber"}
              size="md"
              dot={!allClear}
            />
          </View>
          {/* Progress bar */}
          <View style={[styles.progressTrack, { backgroundColor: colors.bg.hover }]}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: allClear ? colors.status.success : brand.blue }]} />
          </View>
        </Card>

        {/* Items */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[10] }]}><Spinner size="lg" /></View>
        ) : (
          <Card>
            {DEPARTMENTS.map((dept, i) => {
              const item       = getStatus(dept.key);
              const isCleared  = item?.status === "cleared";
              const isRejected = item?.status === "rejected";
              const statusVariant = isCleared ? "green" : isRejected ? "red" : "amber";
              const statusLabel   = isCleared ? "Cleared" : isRejected ? "Rejected" : "Pending";

              return (
                <View
                  key={dept.key}
                  style={[
                    styles.deptRow,
                    i < DEPARTMENTS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                  ]}
                >
                  <View
                    style={[
                      styles.deptIcon,
                      {
                        backgroundColor: isCleared ? colors.status.successBg : isRejected ? colors.status.errorBg : colors.bg.hover,
                        borderColor: isCleared ? colors.status.successBorder : isRejected ? colors.status.errorBorder : colors.border.DEFAULT,
                      },
                    ]}
                  >
                    <Icon name={dept.icon} size="lg" color={isCleared ? colors.status.success : isRejected ? colors.status.error : colors.text.muted} />
                  </View>

                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{dept.label}</Text>
                    <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{dept.desc}</Text>
                    {item?.notes && (
                      <Text variant="caption" color="warning" style={{ marginTop: spacing[1] }}>Note: {item.notes}</Text>
                    )}
                    {isCleared && item?.cleared_by && (
                      <Text variant="micro" color="success" style={{ marginTop: spacing[1] }}>
                        Cleared by {item.cleared_by} · {formatDate(item.updated_at)}
                      </Text>
                    )}
                  </View>

                  <Badge label={statusLabel} variant={statusVariant} size="sm" />
                </View>
              );
            })}
          </Card>
        )}

        {/* Info */}
        <Card variant="info">
          <View style={[layout.row, { gap: spacing[2] }]}>
            <Icon name="status-info" size="sm" color={colors.status.info} filled />
            <Text style={{ flex: 1, fontSize: fontSize.sm, color: colors.status.info, lineHeight: 20 }}>
              Clearance items are marked by the respective departments. Contact the relevant office if your status is incorrect.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  progressTrack:{ height: spacing[2] + spacing[1], borderRadius: radius.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.full },
  deptRow:      { flexDirection: "row", alignItems: "center", gap: spacing[4], paddingVertical: spacing[4] },
  deptIcon:     { width: spacing[12] + spacing[1], height: spacing[12] + spacing[1], borderRadius: radius.xl, alignItems: "center", justifyContent: "center", flexShrink: 0, borderWidth: 1 },
});
