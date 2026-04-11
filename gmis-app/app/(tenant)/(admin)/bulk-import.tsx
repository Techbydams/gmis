// ============================================================
// GMIS — Admin Bulk Import
// Route: /(tenant)/(admin)/bulk-import
//
// Features:
//   • Import: Students, Lecturers, Departments, Courses
//   • Download CSV template per type (shows correct column headers)
//   • Paste or type CSV data directly (no file picker needed)
//   • Preview parsed rows before committing
//   • Batch insert with progress indicator
//   • Error reporting per row
//   • Students: force_password_reset = true on import
//   • Courses: is_general flag for multi-department courses
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
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
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Template definitions ───────────────────────────────────
type ImportType = "students" | "lecturers" | "departments" | "courses";

interface Template {
  key: ImportType;
  label: string;
  icon: any;
  color: string;
  columns: string[];
  exampleRow: string[];
  notes: string[];
}

const TEMPLATES: Template[] = [
  {
    key:     "students",
    label:   "Students",
    icon:    "user-student",
    color:   brand.blue,
    columns: ["first_name", "last_name", "matric_number", "email", "phone", "level", "gender", "department_code"],
    exampleRow: ["John", "Doe", "MCS/2021/001", "john@school.edu.ng", "08012345678", "200", "Male", "CSC"],
    notes: [
      "department_code must match an existing department code.",
      "level must be 100, 200, 300, 400, 500, or 600.",
      "Passwords will be set to matric number — student must change on first login.",
      "gender: Male | Female | Other (optional).",
    ],
  },
  {
    key:     "lecturers",
    label:   "Lecturers",
    icon:    "user-lecturer",
    color:   brand.indigo,
    columns: ["full_name", "email", "phone", "qualification", "department_code"],
    exampleRow: ["Dr. Jane Smith", "j.smith@school.edu.ng", "08087654321", "Ph.D Computer Science", "CSC"],
    notes: [
      "department_code must match an existing department code.",
      "Lecturers will receive a setup email to create their password.",
    ],
  },
  {
    key:     "departments",
    label:   "Departments",
    icon:    "academic-dept",
    color:   brand.emerald,
    columns: ["name", "code", "faculty_code"],
    exampleRow: ["Computer Science", "CSC", "SCI"],
    notes: [
      "faculty_code must match an existing faculty code.",
      "code must be unique across departments.",
    ],
  },
  {
    key:     "courses",
    label:   "Courses",
    icon:    "academic-course",
    color:   brand.gold,
    columns: ["course_code", "course_name", "credit_units", "level", "semester", "department_code", "is_general"],
    exampleRow: ["CSC 201", "Data Structures", "3", "200", "First Semester", "CSC", "false"],
    notes: [
      "is_general: true = shared across departments, false = department-specific.",
      "semester: First Semester | Second Semester | Third Semester.",
      "level: 100, 200, 300, 400, 500, or 600.",
      "department_code: leave blank for general courses.",
    ],
  },
];

// ── CSV helpers ────────────────────────────────────────────
function parseCSV(text: string, columns: string[]): { rows: Record<string, string>[]; errors: string[] } {
  const lines  = text.trim().split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  const rows:   Record<string, string>[] = [];

  // Skip header if present
  let startIdx = 0;
  if (lines[0]?.toLowerCase().includes(columns[0].toLowerCase())) startIdx = 1;

  for (let i = startIdx; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < columns.length) {
      errors.push(`Row ${i + 1}: expected ${columns.length} columns, got ${parts.length}.`);
      continue;
    }
    const row: Record<string, string> = {};
    columns.forEach((col, j) => { row[col] = parts[j] || ""; });
    rows.push(row);
  }
  return { rows, errors };
}

function buildInsertRow(type: ImportType, row: Record<string, string>, deptMap: Record<string, string>, facultyMap: Record<string, string>): any {
  switch (type) {
    case "students":
      return {
        first_name: row.first_name, last_name: row.last_name,
        matric_number: row.matric_number, email: row.email,
        phone: row.phone || null, level: row.level, gender: row.gender || null,
        department_id: row.department_code ? deptMap[row.department_code.toUpperCase()] || null : null,
        status: "pending", force_password_reset: true, gpa: 0,
      };
    case "lecturers":
      return {
        full_name: row.full_name, email: row.email, phone: row.phone || null,
        qualification: row.qualification || null,
        department_id: row.department_code ? deptMap[row.department_code.toUpperCase()] || null : null,
        is_active: true,
      };
    case "departments":
      return {
        name: row.name, code: row.code.toUpperCase(),
        faculty_id: row.faculty_code ? facultyMap[row.faculty_code.toUpperCase()] || null : null,
        is_active: true,
      };
    case "courses":
      return {
        course_code: row.course_code, course_name: row.course_name,
        credit_units: parseInt(row.credit_units, 10) || 3,
        level: row.level, semester: row.semester,
        department_id: row.department_code && row.is_general !== "true" ? deptMap[row.department_code.toUpperCase()] || null : null,
        is_general: row.is_general === "true",
        is_active: true, is_elective: false,
      };
    default: return {};
  }
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminBulkImport() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [activeType,   setActiveType]   = useState<ImportType>("students");
  const [csvText,      setCsvText]      = useState("");
  const [parsed,       setParsed]       = useState<{ rows: Record<string, string>[]; errors: string[] } | null>(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  const template = TEMPLATES.find((t) => t.key === activeType)!;

  // ── Generate CSV template text ──────────────────────────
  const templateText = [
    template.columns.join(","),
    template.exampleRow.join(","),
  ].join("\n");

  // ── Parse CSV ──────────────────────────────────────────
  const handleParse = () => {
    if (!csvText.trim()) {
      Alert.alert("Empty", "Paste your CSV data first.");
      return;
    }
    const result = parseCSV(csvText, template.columns);
    setParsed(result);
    setImportResult(null);
  };

  // ── Import ──────────────────────────────────────────────
  const handleImport = async () => {
    if (!parsed || parsed.rows.length === 0 || !db) return;

    Alert.alert(
      "Confirm Import",
      `Import ${parsed.rows.length} ${template.label.toLowerCase()}? This will add them to the database.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Import", onPress: async () => {
          setImporting(true);
          let success = 0;
          const errors: string[] = [];

          try {
            // Load dept & faculty maps
            const [deptsRes, facultiesRes] = await Promise.allSettled([
              db.from("departments").select("id, code"),
              db.from("faculties").select("id, code"),
            ]);
            const deptMap: Record<string, string> = {};
            const facultyMap: Record<string, string> = {};
            if (deptsRes.status === "fulfilled") (deptsRes.value.data || []).forEach((d: any) => { deptMap[d.code] = d.id; });
            if (facultiesRes.status === "fulfilled") (facultiesRes.value.data || []).forEach((f: any) => { facultyMap[f.code] = f.id; });

            // Insert in batches of 20
            const BATCH = 20;
            const rows = parsed.rows;
            for (let i = 0; i < rows.length; i += BATCH) {
              const batch = rows.slice(i, i + BATCH);
              const insertRows = batch.map((row) => buildInsertRow(activeType, row, deptMap, facultyMap));
              const { error } = await db.from(activeType === "students" ? "students" : activeType === "lecturers" ? "lecturers" : activeType === "departments" ? "departments" : "courses")
                .insert(insertRows);
              if (error) {
                errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
              } else {
                success += batch.length;
              }
            }
          } catch (err: any) {
            errors.push(err.message || "Unknown error");
          }

          setImportResult({ success, failed: parsed.rows.length - success, errors });
          setImporting(false);
          if (success > 0) {
            showToast({ message: `${success} ${template.label.toLowerCase()} imported!`, variant: "success" });
            setCsvText(""); setParsed(null);
          }
        }},
      ]
    );
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Bulk Import"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary">Bulk Import</Text>
        <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>Add multiple records at once using CSV data</Text>

        {/* Type selector */}
        <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => { setActiveType(t.key); setCsvText(""); setParsed(null); setImportResult(null); }}
              activeOpacity={0.75}
              style={[styles.typeBtn, {
                backgroundColor: activeType === t.key ? t.color : colors.bg.card,
                borderColor:     activeType === t.key ? t.color : colors.border.DEFAULT,
              }]}
            >
              <Icon name={t.icon} size="sm" color={activeType === t.key ? "#fff" : colors.text.secondary} />
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: activeType === t.key ? "#fff" : colors.text.secondary }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Template card */}
        <Card>
          <View style={layout.rowBetween}>
            <Text variant="label" weight="bold" color="primary">CSV Template — {template.label}</Text>
            <Badge label="Copy template" variant="blue" size="sm" />
          </View>

          {/* Template preview */}
          <View style={[styles.templateBox, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT, marginTop: spacing[3] }]}>
            <Text style={{ fontSize: fontSize.xs, fontFamily: "monospace", color: brand.blue, lineHeight: 20 }}>
              {template.columns.join(",")}
            </Text>
            <Text style={{ fontSize: fontSize.xs, fontFamily: "monospace", color: colors.text.muted, lineHeight: 20, marginTop: 4 }}>
              {template.exampleRow.join(",")}
            </Text>
          </View>

          {/* Notes */}
          <View style={{ marginTop: spacing[3], gap: spacing[2] }}>
            {template.notes.map((note, i) => (
              <View key={i} style={[layout.row, { gap: spacing[2], alignItems: "flex-start" }]}>
                <Icon name="status-info" size="xs" color={colors.text.muted} />
                <Text variant="micro" color="muted" style={{ flex: 1 }}>{note}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Paste CSV */}
        <Card>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Paste CSV Data</Text>
          <TextInput
            style={[styles.csvInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
            value={csvText}
            onChangeText={setCsvText}
            placeholder={`${template.columns.join(",")}\n${template.exampleRow.join(",")}`}
            placeholderTextColor={colors.text.muted}
            multiline
            textAlignVertical="top"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3] }]}>
            <TouchableOpacity
              onPress={() => { setCsvText(""); setParsed(null); setImportResult(null); }}
              activeOpacity={0.75}
              style={[styles.clearBtn, { borderColor: colors.border.DEFAULT, flex: 1 }]}
            >
              <Text style={{ color: colors.text.secondary, fontWeight: fontWeight.medium, fontSize: fontSize.sm }}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleParse}
              activeOpacity={0.75}
              style={[styles.parseBtn, { backgroundColor: template.color, flex: 2 }]}
            >
              <Icon name="ui-check" size="sm" color="#fff" />
              <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>Preview Data</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Preview */}
        {parsed && (
          <Card>
            <View style={layout.rowBetween}>
              <Text variant="label" weight="bold" color="primary">Preview</Text>
              <View style={[layout.row, { gap: spacing[2] }]}>
                <Badge label={`${parsed.rows.length} rows`} variant="blue" size="sm" />
                {parsed.errors.length > 0 && <Badge label={`${parsed.errors.length} errors`} variant="red" size="sm" />}
              </View>
            </View>

            {/* Parse errors */}
            {parsed.errors.length > 0 && (
              <View style={[styles.errorBox, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", marginTop: spacing[3] }]}>
                <Text variant="caption" weight="semibold" color="primary" style={{ marginBottom: spacing[2] }}>Parse Errors</Text>
                {parsed.errors.map((e, i) => (
                  <Text key={i} variant="micro" style={{ color: "#ef4444" }}>{e}</Text>
                ))}
              </View>
            )}

            {/* Preview table */}
            {parsed.rows.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator style={{ marginTop: spacing[3] }}>
                <View>
                  {/* Header */}
                  <View style={[layout.row, { gap: 0 }]}>
                    {template.columns.map((col) => (
                      <View key={col} style={[styles.tableCell, { backgroundColor: colors.bg.hover, minWidth: 100 }]}>
                        <Text style={{ fontSize: 10, fontWeight: fontWeight.bold, color: colors.text.muted, textTransform: "uppercase" }} numberOfLines={1}>{col}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Rows (show max 5 for preview) */}
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <View key={i} style={[layout.row, { gap: 0, borderTopWidth: 1, borderTopColor: colors.border.subtle }]}>
                      {template.columns.map((col) => (
                        <View key={col} style={[styles.tableCell, { minWidth: 100 }]}>
                          <Text style={{ fontSize: fontSize.xs, color: colors.text.primary }} numberOfLines={1}>{row[col] || "—"}</Text>
                        </View>
                      ))}
                    </View>
                  ))}
                  {parsed.rows.length > 5 && (
                    <Text variant="micro" color="muted" style={{ marginTop: spacing[2] }}>
                      + {parsed.rows.length - 5} more rows
                    </Text>
                  )}
                </View>
              </ScrollView>
            )}

            {/* Import button */}
            {parsed.rows.length > 0 && (
              <TouchableOpacity
                onPress={handleImport}
                disabled={importing}
                activeOpacity={0.75}
                style={[styles.importBtn, { backgroundColor: template.color, marginTop: spacing[4] }]}
              >
                {importing
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Importing...</Text></>
                  : <><Icon name="ui-add" size="sm" color="#fff" /><Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Import {parsed.rows.length} {template.label}</Text></>
                }
              </TouchableOpacity>
            )}
          </Card>
        )}

        {/* Result */}
        {importResult && (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>Import Result</Text>
            <View style={[layout.row, { gap: spacing[3] }]}>
              <View style={[styles.resultStat, { backgroundColor: brand.emeraldAlpha15 }]}>
                <Text style={{ fontSize: 24, fontWeight: fontWeight.black, color: brand.emerald }}>{importResult.success}</Text>
                <Text style={{ fontSize: fontSize.xs, color: brand.emerald }}>Imported</Text>
              </View>
              {importResult.failed > 0 && (
                <View style={[styles.resultStat, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                  <Text style={{ fontSize: 24, fontWeight: fontWeight.black, color: "#ef4444" }}>{importResult.failed}</Text>
                  <Text style={{ fontSize: fontSize.xs, color: "#ef4444" }}>Failed</Text>
                </View>
              )}
            </View>
            {importResult.errors.length > 0 && (
              <View style={[styles.errorBox, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)", marginTop: spacing[3] }]}>
                {importResult.errors.map((e, i) => (
                  <Text key={i} variant="micro" style={{ color: "#ef4444" }}>{e}</Text>
                ))}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  typeBtn:     { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  templateBox: { padding: spacing[4], borderRadius: radius.lg, borderWidth: 1 },
  csvInput:    { padding: spacing[4], borderRadius: radius.lg, borderWidth: 1, minHeight: 160, fontSize: fontSize.xs, fontFamily: "monospace", textAlignVertical: "top" },
  clearBtn:    { paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, alignItems: "center" },
  parseBtn:    { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.lg, justifyContent: "center" },
  importBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingVertical: spacing[4], borderRadius: radius.xl, justifyContent: "center" },
  tableCell:   { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  errorBox:    { padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, gap: spacing[1] },
  resultStat:  { flex: 1, padding: spacing[4], borderRadius: radius.xl, alignItems: "center", gap: spacing[1] },
});
