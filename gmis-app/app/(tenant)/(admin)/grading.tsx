// ============================================================
// GMIS — Admin Grading System Configuration
// Route: /(tenant)/(admin)/grading
//
// Features:
//   • Define custom grade ranges per school (A: 70-100, B: 60-69…)
//   • Set letter grade, score range, grade point
//   • Live preview: enter score → see auto-computed grade
//   • Default Nigerian 5-point system pre-loaded
//   • Save to grading_system table in tenant DB
//   • Edit / delete / reorder grades
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }        from "@/components/ui/Toast";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { Spinner }         from "@/components/ui/Spinner";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface GradingRule {
  id?: string;
  grade: string;
  min_score: number;
  max_score: number;
  grade_point: number;
  remark: string;
}

// ── Default Nigerian grading system ───────────────────────
const NIGERIAN_DEFAULT: Omit<GradingRule, "id">[] = [
  { grade: "A",  min_score: 70, max_score: 100, grade_point: 5.0, remark: "Excellent" },
  { grade: "B",  min_score: 60, max_score: 69,  grade_point: 4.0, remark: "Very Good" },
  { grade: "C",  min_score: 50, max_score: 59,  grade_point: 3.0, remark: "Good" },
  { grade: "D",  min_score: 45, max_score: 49,  grade_point: 2.0, remark: "Pass" },
  { grade: "E",  min_score: 40, max_score: 44,  grade_point: 1.0, remark: "Marginal Pass" },
  { grade: "F",  min_score: 0,  max_score: 39,  grade_point: 0.0, remark: "Fail" },
];

const GRADE_COLORS: Record<string, string> = {
  A: "#10b981", B: "#2d6cff", C: "#f0b429", D: "#f97316", E: "#f59e0b", F: "#ef4444",
};

// ── Add/Edit Grade Sheet ───────────────────────────────────
function GradeSheet({ visible, onClose, editing, onSave, colors }: {
  visible: boolean; onClose: () => void; editing: GradingRule | null;
  onSave: (rule: Omit<GradingRule, "id">) => Promise<void>; colors: any;
}) {
  const [grade,      setGrade]      = useState(editing?.grade || "");
  const [minScore,   setMinScore]   = useState(editing?.min_score.toString() || "");
  const [maxScore,   setMaxScore]   = useState(editing?.max_score.toString() || "");
  const [gradePoint, setGradePoint] = useState(editing?.grade_point.toString() || "");
  const [remark,     setRemark]     = useState(editing?.remark || "");
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (visible) {
      setGrade(editing?.grade || ""); setMinScore(editing?.min_score.toString() || "");
      setMaxScore(editing?.max_score.toString() || ""); setGradePoint(editing?.grade_point.toString() || "");
      setRemark(editing?.remark || "");
    }
  }, [visible, editing]);

  const handleSave = async () => {
    const min = parseFloat(minScore);
    const max = parseFloat(maxScore);
    const gp  = parseFloat(gradePoint);
    if (!grade.trim()) { Alert.alert("Required", "Grade letter is required."); return; }
    if (isNaN(min) || isNaN(max) || min > max) { Alert.alert("Invalid range", "Min score must be less than max score."); return; }
    if (isNaN(gp) || gp < 0 || gp > 5) { Alert.alert("Invalid grade point", "Grade point must be 0–5."); return; }
    setSaving(true);
    try {
      await onSave({ grade: grade.trim().toUpperCase(), min_score: min, max_score: max, grade_point: gp, remark: remark.trim() });
      onClose();
    } catch { Alert.alert("Error", "Failed to save grade."); }
    finally { setSaving(false); }
  };

  const F = ({ label, value, onChangeText, placeholder, keyboard }: any) => (
    <View style={{ marginBottom: spacing[3] }}>
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.text.muted} keyboardType={keyboard || "default"}
      />
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} snapHeight={540}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">{editing ? "Edit Grade" : "Add Grade"}</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>
      <F label="GRADE LETTER (e.g. A, B+, C)" value={grade}      onChangeText={setGrade}      placeholder="A" />
      <View style={[layout.row, { gap: spacing[3] }]}>
        <View style={{ flex: 1 }}><F label="MIN SCORE" value={minScore}   onChangeText={setMinScore}   placeholder="70" keyboard="decimal-pad" /></View>
        <View style={{ flex: 1 }}><F label="MAX SCORE" value={maxScore}   onChangeText={setMaxScore}   placeholder="100" keyboard="decimal-pad" /></View>
      </View>
      <F label="GRADE POINT (0.0 – 5.0)"    value={gradePoint} onChangeText={setGradePoint} placeholder="5.0" keyboard="decimal-pad" />
      <F label="REMARK (e.g. Excellent)"    value={remark}     onChangeText={setRemark}     placeholder="Excellent" />
      <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.75} style={[styles.saveBtn, { backgroundColor: brand.blue, marginTop: spacing[2] }]}>
        {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>{editing ? "Update Grade" : "Add Grade"}</Text>}
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminGrading() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [rules,      setRules]      = useState<GradingRule[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [sheet,      setSheet]      = useState(false);
  const [editing,    setEditing]    = useState<GradingRule | null>(null);
  const [previewScore, setPreviewScore] = useState("");

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    const { data } = await db
      .from("grading_system")
      .select("id, grade, min_score, max_score, grade_point, remark")
      .order("min_score", { ascending: false });
    setRules((data || []) as GradingRule[]);
    setLoading(false);
  }, [db]);

  const handleSave = async (rule: Omit<GradingRule, "id">) => {
    if (!db) throw new Error("No DB");
    if (editing?.id) {
      await db.from("grading_system").update(rule as any).eq("id", editing.id);
    } else {
      await db.from("grading_system").insert(rule as any);
    }
    showToast({ message: editing ? "Grade updated." : "Grade added.", variant: "success" });
    setEditing(null);
    await load();
  };

  const deleteRule = (rule: GradingRule) => {
    Alert.alert("Delete Grade", `Remove grade "${rule.grade}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!db || !rule.id) return;
        await db.from("grading_system").delete().eq("id", rule.id);
        showToast({ message: "Grade removed.", variant: "info" });
        await load();
      }},
    ]);
  };

  const loadDefault = () => {
    Alert.alert("Load Default System", "Replace current grading with the standard Nigerian 5-point grading system?", [
      { text: "Cancel", style: "cancel" },
      { text: "Load Default", onPress: async () => {
        if (!db) return;
        setSaving(true);
        try {
          await db.from("grading_system").delete().neq("id", "");
          await db.from("grading_system").insert(NIGERIAN_DEFAULT as any[]);
          showToast({ message: "Default Nigerian grading system loaded!", variant: "success" });
          await load();
        } catch { showToast({ message: "Failed to load default.", variant: "error" }); }
        finally { setSaving(false); }
      }},
    ]);
  };

  // Preview calculation
  const previewGrade = useMemo(() => {
    const s = parseFloat(previewScore);
    if (isNaN(s)) return null;
    const sorted = [...rules].sort((a, b) => b.min_score - a.min_score);
    return sorted.find((r) => s >= r.min_score && s <= r.max_score) || null;
  }, [previewScore, rules]);

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Grading System"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={layout.rowBetween}>
          <View>
            <Text variant="heading" color="primary">Grading System</Text>
            <Text variant="caption" color="muted">Customise grade ranges & points for your institution</Text>
          </View>
          <TouchableOpacity onPress={() => { setEditing(null); setSheet(true); }} activeOpacity={0.75}
            style={[styles.addBtn, { backgroundColor: brand.blue }]}>
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Add Grade</Text>
          </TouchableOpacity>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
          <Icon name="status-info" size="sm" color={brand.blue} />
          <Text variant="caption" color="primary" style={{ flex: 1 }}>
            The system uses this grading table to automatically assign grades when results are submitted or edited.
          </Text>
        </View>

        {/* Load default button */}
        {rules.length === 0 && !loading && (
          <TouchableOpacity onPress={loadDefault} disabled={saving} activeOpacity={0.75}
            style={[styles.defaultBtn, { backgroundColor: brand.goldAlpha15, borderColor: brand.goldAlpha20 }]}>
            {saving
              ? <ActivityIndicator color={brand.goldDark} size="small" />
              : <>
                  <Icon name="academic-grade" size="sm" color={brand.goldDark} />
                  <Text style={{ color: brand.goldDark, fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Load Nigerian Default Grading System</Text>
                </>
            }
          </TouchableOpacity>
        )}
        {rules.length > 0 && (
          <TouchableOpacity onPress={loadDefault} disabled={saving} activeOpacity={0.75}
            style={[styles.outlineBtn, { borderColor: colors.border.DEFAULT }]}>
            <Icon name="academic-grade" size="sm" color={colors.text.secondary} />
            <Text style={{ color: colors.text.secondary, fontWeight: fontWeight.medium, fontSize: fontSize.sm }}>Reset to Nigerian Default</Text>
          </TouchableOpacity>
        )}

        {/* Grade table */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading grading system..." /></View>
        ) : rules.length === 0 ? (
          <Card>
            <Text variant="body" color="muted" align="center" style={{ paddingVertical: spacing[6] }}>
              No grading rules defined. Add grades above or load the default Nigerian system.
            </Text>
          </Card>
        ) : (
          <Card>
            {/* Table header */}
            <View style={[styles.tableHeader, { backgroundColor: colors.bg.hover }]}>
              <Text style={[styles.colGrade,  { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>GRADE</Text>
              <Text style={[styles.colRange,  { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>SCORE RANGE</Text>
              <Text style={[styles.colPoint,  { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>GRADE POINT</Text>
              <Text style={[styles.colRemark, { color: colors.text.muted, fontSize: fontSize.xs, fontWeight: fontWeight.bold }]}>REMARK</Text>
              <View style={styles.colAction} />
            </View>
            {rules.map((rule, i) => (
              <View key={rule.id || i} style={[styles.tableRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < rules.length - 1 ? 1 : 0 }]}>
                <View style={styles.colGrade}>
                  <View style={[styles.gradeTag, { backgroundColor: GRADE_COLORS[rule.grade] ? `${GRADE_COLORS[rule.grade]}20` : brand.blueAlpha10 }]}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.black, color: GRADE_COLORS[rule.grade] || brand.blue }}>{rule.grade}</Text>
                  </View>
                </View>
                <Text style={[styles.colRange, { color: colors.text.primary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }]}>
                  {rule.min_score} – {rule.max_score}
                </Text>
                <Text style={[styles.colPoint, { color: brand.blue, fontSize: fontSize.sm, fontWeight: fontWeight.bold }]}>
                  {rule.grade_point.toFixed(1)}
                </Text>
                <Text style={[styles.colRemark, { color: colors.text.muted, fontSize: fontSize.xs }]} numberOfLines={1}>
                  {rule.remark}
                </Text>
                <View style={[styles.colAction, { flexDirection: "row", gap: spacing[1] }]}>
                  <TouchableOpacity onPress={() => { setEditing(rule); setSheet(true); }} activeOpacity={0.7} style={{ padding: spacing[2] }}>
                    <Icon name="ui-more" size="sm" color={brand.blue} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRule(rule)} activeOpacity={0.7} style={{ padding: spacing[2] }}>
                    <Icon name="ui-close" size="sm" color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Score preview calculator */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Grade Calculator Preview</Text>
          <Text variant="caption" color="muted" style={{ marginBottom: spacing[3] }}>Enter a score to see the auto-computed grade:</Text>
          <View style={[layout.row, { gap: spacing[3], alignItems: "center" }]}>
            <TextInput
              style={[styles.previewInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT, flex: 1 }]}
              value={previewScore}
              onChangeText={setPreviewScore}
              keyboardType="decimal-pad"
              placeholder="e.g. 72.5"
              placeholderTextColor={colors.text.muted}
              maxLength={5}
            />
            {previewGrade ? (
              <View style={[styles.previewResult, { backgroundColor: (GRADE_COLORS[previewGrade.grade] ? `${GRADE_COLORS[previewGrade.grade]}20` : brand.blueAlpha10) }]}>
                <Text style={{ fontSize: 28, fontWeight: fontWeight.black, color: GRADE_COLORS[previewGrade.grade] || brand.blue }}>{previewGrade.grade}</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{previewGrade.grade_point.toFixed(1)} pts</Text>
                <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }}>{previewGrade.remark}</Text>
              </View>
            ) : previewScore ? (
              <View style={[styles.previewResult, { backgroundColor: "rgba(239,68,68,0.10)" }]}>
                <Text style={{ fontSize: 28, fontWeight: fontWeight.black, color: "#ef4444" }}>?</Text>
                <Text style={{ fontSize: fontSize.xs, color: "#ef4444" }}>No match</Text>
              </View>
            ) : null}
          </View>
        </Card>
      </ScrollView>

      <GradeSheet visible={sheet} onClose={() => { setSheet(false); setEditing(null); }} editing={editing} onSave={handleSave} colors={colors} />
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  addBtn:       { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  infoBanner:   { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  defaultBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1, justifyContent: "center" },
  outlineBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, justifyContent: "center" },
  tableHeader:  { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, marginBottom: spacing[2] },
  tableRow:     { flexDirection: "row", alignItems: "center", paddingVertical: spacing[3] },
  colGrade:     { width: 52, alignItems: "flex-start" },
  colRange:     { width: 90 },
  colPoint:     { width: 60 },
  colRemark:    { flex: 1 },
  colAction:    { width: 60, alignItems: "flex-end" },
  gradeTag:     { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md, minWidth: 36, alignItems: "center" },
  input:        { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  saveBtn:      { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
  previewInput: { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.lg },
  previewResult:{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: "center", minWidth: 80 },
});
