// ============================================================
// GMIS — GPA Calculator
// Route: /(tenant)/(student)/gpa
// Pure computation — no DB calls. Grades are not saved.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { formatGPA, getHonourClass } from "@/lib/helpers";
import { GRADE_POINTS } from "@/lib/grading";
import { Text, Card, Input, Button } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { SelectModal } from "@/components/ui";
import { AppShell } from "@/components/layout";
import { useTheme }    from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface CourseRow { id: number; code: string; units: string; grade: string }

const UNIT_OPTIONS   = ["1","2","3","4","6"].map((u) => ({ label: `${u} units`, value: u }));
const GRADE_OPTIONS  = Object.keys(GRADE_POINTS).map((g) => ({ label: `${g} (${GRADE_POINTS[g]}.0 pts)`, value: g }));
const GRADE_RANGES   = { A:"70–100", B:"60–69", C:"50–59", D:"45–49", E:"40–44", F:"0–39" };

const DEFAULT_COURSES: CourseRow[] = [
  { id: 1, code: "CSC301", units: "3", grade: "A" },
  { id: 2, code: "CSC303", units: "3", grade: "B" },
  { id: 3, code: "CSC305", units: "3", grade: "A" },
  { id: 4, code: "MTH301", units: "2", grade: "C" },
  { id: 5, code: "CSC307", units: "3", grade: "A" },
];

let nextId = 6;

export default function GPACalculator() {
  const { user, signOut } = useAuth();
  const { tenant }        = useTenant();
  const { colors, isDark } = useTheme();
  const { pagePadding }   = useResponsive();

  const [courses, setCourses] = useState<CourseRow[]>(DEFAULT_COURSES);
  const [cgpa,    setCgpa]    = useState("");

  const totalUnits  = courses.reduce((s, c) => s + (parseFloat(c.units) || 0), 0);
  const totalPoints = courses.reduce((s, c) => s + (GRADE_POINTS[c.grade] || 0) * (parseFloat(c.units) || 0), 0);
  const gpa         = totalUnits > 0 ? totalPoints / totalUnits : 0;
  const honour      = getHonourClass(gpa);
  const gpaColor    = gpa >= 4.5 ? colors.status.success : gpa >= 3.5 ? colors.status.info : gpa >= 2.5 ? colors.status.warning : colors.status.error;

  const projectedCGPA = () => {
    const c = parseFloat(cgpa);
    if (!c || c < 0 || c > 5) return null;
    return ((c + gpa) / 2).toFixed(2);
  };

  const addCourse   = () => setCourses((p) => [...p, { id: nextId++, code: "", units: "3", grade: "B" }]);
  const removeCourse= (id: number) => { if (courses.length > 1) setCourses((p) => p.filter((c) => c.id !== id)); };
  const update      = (id: number, field: keyof CourseRow, val: string) => setCourses((p) => p.map((c) => c.id === id ? { ...c, [field]: val } : c));
  const reset       = () => { setCourses(DEFAULT_COURSES); setCgpa(""); };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="GPA Calculator" onLogout={async () => signOut()}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text variant="heading" color="primary">GPA Calculator</Text>
          <Text variant="caption" color="muted">Simulate your GPA. Grades are not saved.</Text>
        </View>

        {/* GPA display + grade scale + CGPA projection */}
        <View style={[layout.rowWrap, { gap: spacing[4], alignItems: "flex-start" }]}>

          {/* GPA result */}
          <Card variant="brand" style={{ flex: 1, minWidth: 200, alignItems: "center" as any, paddingVertical: spacing[8] }}>
            <Text variant="micro" color="muted" style={{ textTransform: "uppercase" as any, letterSpacing: 1.5, marginBottom: spacing[2] }}>Calculated GPA</Text>
            <Text style={{ fontSize: fontSize["6xl"], fontWeight: fontWeight.black, color: gpaColor, lineHeight: fontSize["6xl"] }}>
              {formatGPA(gpa)}
            </Text>
            <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: gpaColor, marginTop: spacing[2] }}>{honour}</Text>
            <Text variant="caption" color="muted" style={{ marginTop: spacing[1] }}>{totalUnits} credit units</Text>
          </Card>

          {/* Grade scale */}
          <Card style={{ flex: 1, minWidth: 180 }}>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Grade scale</Text>
            {Object.entries(GRADE_POINTS).map(([g, pts]) => (
              <View key={g} style={[layout.rowBetween, { paddingVertical: spacing[1], borderBottomWidth: 1, borderBottomColor: colors.border.subtle }]}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text.primary, width: spacing[4] }}>{g}</Text>
                <Text variant="caption" color="secondary">{pts}.0 pts</Text>
                <Text variant="caption" color="muted">{GRADE_RANGES[g as keyof typeof GRADE_RANGES]}</Text>
              </View>
            ))}
          </Card>

          {/* CGPA projection */}
          <Card style={{ flex: 1, minWidth: 200 }}>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[1] }}>Projected CGPA</Text>
            <Text variant="caption" color="muted" style={{ marginBottom: spacing[3] }}>Enter your current CGPA to estimate after this semester</Text>
            <Input
              label="Current CGPA"
              value={cgpa}
              onChangeText={setCgpa}
              placeholder="e.g. 3.85"
              keyboardType="decimal-pad"
              containerStyle={{ marginBottom: spacing[3] }}
            />
            {projectedCGPA() && (
              <Card variant="success" padding="sm">
                <Text variant="micro" color="muted" align="center" style={{ marginBottom: spacing[1] }}>Estimated new CGPA</Text>
                <Text style={{ fontSize: fontSize["3xl"], fontWeight: fontWeight.black, color: colors.status.success, textAlign: "center" as any }}>
                  {projectedCGPA()}
                </Text>
                <Text variant="caption" color="success" align="center">{getHonourClass(parseFloat(projectedCGPA()!))}</Text>
              </Card>
            )}
          </Card>
        </View>

        {/* Course list */}
        <Card>
          <View style={[layout.rowBetween, { marginBottom: spacing[4] }]}>
            <Text variant="label" weight="bold" color="primary">Your courses</Text>
            <View style={[layout.row, { gap: spacing[2] }]}>
              <Button label="Reset" variant="secondary" size="sm" onPress={reset} />
              <Button label="+ Add course" variant="primary" size="sm" onPress={addCourse} />
            </View>
          </View>

          {/* Header row */}
          <View style={[layout.row, { gap: spacing[2], marginBottom: spacing[2] }]}>
            {["Course code", "Units", "Grade", ""].map((h, i) => (
              <Text key={i} style={{ flex: i === 0 ? 2 : i === 3 ? 0 : 1, fontSize: fontSize["2xs"], fontWeight: fontWeight.bold, color: colors.text.muted, textTransform: "uppercase" as any, letterSpacing: 0.5 }}>{h}</Text>
            ))}
          </View>

          {courses.map((c) => (
            <View key={c.id} style={[layout.row, { gap: spacing[2], marginBottom: spacing[2], alignItems: "flex-start" }]}>
              <View style={{ flex: 2 }}>
                <Input
                  value={c.code}
                  onChangeText={(v) => update(c.id, "code", v.toUpperCase())}
                  placeholder="CSC301"
                  autoCapitalize="characters"
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectModal
                  placeholder="Units"
                  value={c.units}
                  options={UNIT_OPTIONS}
                  onChange={(v) => update(c.id, "units", v)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SelectModal
                  placeholder="Grade"
                  value={c.grade}
                  options={GRADE_OPTIONS}
                  onChange={(v) => update(c.id, "grade", v)}
                />
              </View>
              <TouchableOpacity
                onPress={() => removeCourse(c.id)}
                activeOpacity={0.7}
                style={[styles.removeBtn, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder }]}
              >
                <Icon name="ui-close" size="xs" color={colors.status.error} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Summary row */}
          <View style={[layout.row, { paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.DEFAULT, gap: spacing[2] }]}>
            <Text style={{ flex: 2, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text.primary }}>Total / GPA</Text>
            <Text style={{ flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.status.info, textAlign: "center" as any }}>{totalUnits}u</Text>
            <Text style={{ flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.black, color: gpaColor, textAlign: "center" as any }}>{formatGPA(gpa)}</Text>
            <View style={{ width: spacing[6] + spacing[4] }} />
          </View>
        </Card>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  removeBtn: { width: spacing[6] + spacing[4], height: spacing[12], borderRadius: radius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
