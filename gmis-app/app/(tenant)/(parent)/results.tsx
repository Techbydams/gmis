// ============================================================
// GMIS — Parent: Ward's Results
// Route: /(tenant)/(parent)/results?ward=<student_id>
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { formatGPA, getHonourClass } from "@/lib/helpers";
import { Text, Card, Badge, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Result {
  id: string;
  score: number | null;
  grade: string | null;
  grade_point: number | null;
  semester: string;
  session: string;
  courses: { course_code: string; course_name: string; credit_units: number } | null;
}

export default function ParentResults() {
  const router                    = useRouter();
  const { ward }                  = useLocalSearchParams<{ ward: string }>();
  const { user }                  = useAuth();
  const { tenant, slug }          = useTenant();
  const { colors }                = useTheme();
  const { pagePadding }           = useResponsive();

  const [student,    setStudent]   = useState<any>(null);
  const [results,    setResults]   = useState<Result[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [activeTerm, setActiveTerm]= useState<string>("");

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && ward) load(); }, [db, ward]);

  const load = async () => {
    if (!db || !ward) return;
    const { data: s } = await db
      .from("students")
      .select("first_name, last_name, matric_number, gpa, cgpa, level")
      .eq("id", ward)
      .maybeSingle();
    if (s) setStudent(s);

    const { data } = await db
      .from("results")
      .select("id, score, grade, grade_point, semester, session, courses(course_code, course_name, credit_units)")
      .eq("student_id", ward)
      .eq("is_published", true)
      .order("session", { ascending: false })
      .order("semester");

    const list = (data || []) as unknown as Result[];
    setResults(list);

    const terms = [...new Set(list.map((r) => `${r.session} · ${r.semester}`))];
    if (terms[0]) setActiveTerm(terms[0]);
    setLoading(false);
  };

  const terms = [...new Set(results.map((r) => `${r.session} · ${r.semester}`))];
  const filtered = results.filter((r) => `${r.session} · ${r.semester}` === activeTerm);

  const totalUnits = filtered.reduce((a, r) => a + (r.courses?.credit_units || 0), 0);
  const earnedPts  = filtered.reduce((a, r) => a + ((r.grade_point ?? 0) * (r.courses?.credit_units || 0)), 0);
  const semGPA     = totalUnits > 0 ? earnedPts / totalUnits : 0;

  const shellUser = { name: user?.email || "Parent", role: "parent" as const };

  return (
    <AppShell role="parent" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Results"
      onLogout={async () => {}}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" /></View>
        ) : (
          <>
            {/* Ward info */}
            {student && (
              <Card>
                <Text variant="subtitle" weight="bold" color="primary">{student.first_name} {student.last_name}</Text>
                <Text variant="caption" color="muted">{student.matric_number} · {student.level} Level</Text>
                <View style={[layout.row, { gap: spacing[4], marginTop: spacing[3] }]}>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                      {formatGPA(student.gpa)}
                    </Text>
                    <Text variant="micro" color="muted">GPA</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                      {formatGPA(student.cgpa)}
                    </Text>
                    <Text variant="micro" color="muted">CGPA</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text.primary }}>
                      {getHonourClass(student.cgpa)}
                    </Text>
                    <Text variant="micro" color="muted">Class</Text>
                  </View>
                </View>
              </Card>
            )}

            {results.length === 0 ? (
              <EmptyState icon="nav-results" title="No results yet" description="No published results available for your ward." />
            ) : (
              <>
                {/* Term selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    {terms.map((t) => (
                      <TouchableOpacity key={t} onPress={() => setActiveTerm(t)} activeOpacity={0.75}
                        style={[styles.termChip, { backgroundColor: activeTerm === t ? brand.blue : colors.bg.card, borderColor: activeTerm === t ? brand.blue : colors.border.DEFAULT }]}>
                        <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: activeTerm === t ? "#fff" : colors.text.secondary }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Semester GPA */}
                <View style={[layout.rowBetween, { backgroundColor: brand.blueAlpha15, padding: spacing[3], borderRadius: radius.xl }]}>
                  <Text style={{ fontSize: fontSize.sm, color: brand.blue, fontWeight: fontWeight.semibold }}>Semester GPA</Text>
                  <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.black, color: brand.blue }}>{semGPA.toFixed(2)}</Text>
                </View>

                {/* Results list */}
                <Card>
                  {filtered.map((r, i) => {
                    const gradeColor = (r.grade_point ?? 0) >= 4 ? colors.status.success
                      : (r.grade_point ?? 0) >= 2 ? colors.status.warning
                      : colors.status.error;
                    return (
                      <View key={r.id} style={[styles.resultRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < filtered.length - 1 ? 1 : 0 }]}>
                        <View style={[styles.gradeBox, { backgroundColor: gradeColor + "18" }]}>
                          <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: gradeColor }}>{r.grade || "—"}</Text>
                        </View>
                        <View style={layout.fill}>
                          <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{r.courses?.course_name || "Unknown"}</Text>
                          <Text variant="micro" color="muted">{r.courses?.course_code} · {r.courses?.credit_units} units</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: gradeColor }}>{r.score ?? "—"}</Text>
                          <Text variant="micro" color="muted">GP {r.grade_point ?? "—"}</Text>
                        </View>
                      </View>
                    );
                  })}
                </Card>
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  termChip: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  gradeBox: { width: spacing[10], height: spacing[10], borderRadius: radius.lg, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
