// ============================================================
// GMIS — Student Results
// Route: /(tenant)/(student)/results
// Tables: results (joined with courses)
// Grading: CA/40 + Exam/60 = Total/100
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { calcGPA, formatGPA, getHonourClass, gradeColor } from "@/lib/grading";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }     from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Result {
  id: string; ca_score: number; exam_score: number;
  grade: string; grade_point: number; published: boolean;
  session: string; semester: string;
  courses: { course_code: string; course_name: string; credit_units: number };
}

const GRADE_RANGES: Record<string, string> = {
  A:"70–100", B:"60–69", C:"50–59", D:"45–49", E:"40–44", F:"0–39"
};

export default function StudentResults() {
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors, isDark } = useTheme();
  const { pagePadding }    = useResponsive();
  const [results,    setResults]    = useState<Result[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [activeTab,  setActiveTab]  = useState("");

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
      if (!s) { setError("Student record not found."); return; }

      const { data, error: rErr } = await db
        .from("results")
        .select("id, ca_score, exam_score, grade, grade_point, published, session, semester, courses(course_code, course_name, credit_units)")
        .eq("student_id", (s as any).id)
        .eq("published", true)
        .order("session", { ascending: false });

      if (rErr) { setError("Could not load results."); return; }
      const r = (data || []) as Result[];
      setResults(r);
      // Default to first tab
      const groups = groupResults(r);
      if (groups.length > 0 && !activeTab) setActiveTab(groups[0].key);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  };

  // Group by session + semester
  const groupResults = (r: Result[]) => {
    const map = new Map<string, Result[]>();
    r.forEach((res) => {
      const key = `${res.session} · ${res.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(res);
    });
    return Array.from(map.entries()).map(([key, rows]) => ({ key, rows }));
  };

  const groups     = useMemo(() => groupResults(results), [results]);
  const activeRows = groups.find((g) => g.key === activeTab)?.rows || [];

  // CGPA across all published results
  const allRows = results.map((r) => ({ credit_units: r.courses?.credit_units || 0, grade: r.grade }));
  const cgpa    = calcGPA(allRows);

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  if (loading) return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Results">
      <View style={[layout.fill, layout.centred]}><Spinner size="lg" label="Loading results..." /></View>
    </AppShell>
  );

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="My Results" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        {/* Header */}
        <View>
          <Text variant="heading" color="primary">Academic Results</Text>
          <Text variant="caption" color="muted">CA (40) + Exam (60) = Total (100)</Text>
        </View>

        {/* CGPA banner */}
        {cgpa > 0 && (
          <Card variant="brand">
            <View style={[layout.rowBetween, { flexWrap: "wrap", gap: spacing[3] }]}>
              <View>
                <Text variant="caption" color="secondary">Cumulative GPA</Text>
                <Text style={{ fontSize: fontSize["4xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                  {formatGPA(cgpa)}
                </Text>
                <Text variant="caption" color="brand">{getHonourClass(cgpa)}</Text>
              </View>
              <View>
                <Text variant="caption" color="muted" align="right">Scale</Text>
                <Text variant="title" weight="bold" color="primary" align="right">5.0</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Grade scale reference */}
        <Card padding="sm">
          <View style={[layout.row, { flexWrap: "wrap", gap: spacing[3] }]}>
            {Object.entries(GRADE_RANGES).map(([g, range]) => (
              <View key={g} style={[layout.row, { gap: spacing[1] }]}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: gradeColor(g, isDark) }}>{g}</Text>
                <Text variant="micro" color="muted">({range})</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Semester tabs */}
        {groups.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              {groups.map(({ key }) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setActiveTab(key)}
                  activeOpacity={0.75}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: activeTab === key ? brand.blue : colors.bg.hover,
                      borderColor:     activeTab === key ? brand.blue : colors.border.DEFAULT,
                    },
                  ]}
                >
                  <Text style={{ fontSize: fontSize.sm, fontWeight: activeTab === key ? fontWeight.bold : fontWeight.normal, color: activeTab === key ? "#fff" : colors.text.secondary }}>
                    {key}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Results table */}
        {error ? (
          <Card variant="error"><Text color="error">{error}</Text></Card>
        ) : results.length === 0 ? (
          <EmptyState icon="nav-results" title="No results published" description="Results appear once your lecturer uploads them and admin releases them." />
        ) : activeRows.length > 0 ? (
          <Card>
            {/* Semester GPA */}
            <View style={[layout.rowBetween, { marginBottom: spacing[4] }]}>
              <Text variant="label" weight="bold" color="primary">{activeTab}</Text>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Text variant="caption" color="muted">Semester GPA:</Text>
                <Text variant="label" weight="bold" color="brand">
                  {formatGPA(calcGPA(activeRows.map(r => ({ credit_units: r.courses?.credit_units || 0, grade: r.grade }))))}
                </Text>
              </View>
            </View>

            {/* Table header */}
            <View style={[styles.tableRow, { borderBottomColor: colors.border.DEFAULT }]}>
              {["Course", "CA", "Exam", "Total", "Grade", "Units", "Points"].map((h) => (
                <Text key={h} style={[styles.th, { color: colors.text.muted }]}>{h}</Text>
              ))}
            </View>

            {/* Rows */}
            {activeRows.map((r, i) => {
              const total = (r.ca_score || 0) + (r.exam_score || 0);
              const gc    = gradeColor(r.grade, isDark);
              return (
                <View
                  key={r.id}
                  style={[
                    styles.tableRow,
                    i < activeRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                  ]}
                >
                  <View style={styles.courseCell}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary }}>{r.courses?.course_code}</Text>
                    <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted }} numberOfLines={1}>{r.courses?.course_name}</Text>
                  </View>
                  <Text style={[styles.td, { color: colors.text.secondary }]}>{r.ca_score ?? "—"}</Text>
                  <Text style={[styles.td, { color: colors.text.secondary }]}>{r.exam_score ?? "—"}</Text>
                  <Text style={[styles.td, { color: colors.text.primary, fontWeight: fontWeight.bold }]}>{total}</Text>
                  <Text style={[styles.td, { color: gc, fontWeight: fontWeight.black }]}>{r.grade}</Text>
                  <Text style={[styles.td, { color: colors.text.secondary }]}>{r.courses?.credit_units}</Text>
                  <Text style={[styles.td, { color: colors.text.secondary }]}>{r.grade_point?.toFixed(1)}</Text>
                </View>
              );
            })}

            {/* Total row */}
            <View style={[styles.tableRow, { borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, paddingTop: spacing[2] }]}>
              <Text style={{ flex: 3, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text.primary }}>Total</Text>
              <Text style={[styles.td]} />
              <Text style={[styles.td]} />
              <Text style={[styles.td]} />
              <Text style={[styles.td]} />
              <Text style={[styles.td, { color: brand.blue, fontWeight: fontWeight.bold }]}>
                {activeRows.reduce((s, r) => s + (r.courses?.credit_units || 0), 0)}
              </Text>
              <Text style={[styles.td]} />
            </View>
          </Card>
        ) : null}

      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  tab:        { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.lg, borderWidth: 1 },
  tableRow:   { flexDirection: "row", alignItems: "center", paddingVertical: spacing[2], gap: spacing[1] },
  th:         { flex: 1, fontSize: fontSize["2xs"], fontWeight: fontWeight.bold, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  td:         { flex: 1, fontSize: fontSize.sm, textAlign: "center" as any },
  courseCell: { flex: 3 },
});
