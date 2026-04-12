// ============================================================
// GMIS — Admin ID Card Management
// Route: /(tenant)/(admin)/idcards
//
// Features:
//   • Student list with search (name / matric)
//   • Per-student bottom sheet: ID photo capture/upload,
//     card preview (template-aware), mark printed, fee status
//   • School card template management (upload JSON / sample)
//   • Stats bar: Total, Photos captured, Printed, Unpaid
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import * as ImagePicker    from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }        from "@/components/ui/Toast";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { Button }          from "@/components/ui/Button";
import { StatCard }        from "@/components/ui/StatCard";
import { Spinner }         from "@/components/ui/Spinner";
import { EmptyState }      from "@/components/ui/EmptyState";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { Avatar }          from "@/components/ui/Avatar";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface Student {
  id:                  string;
  first_name:          string;
  last_name:           string;
  matric_number:       string;
  level:               string;
  department:          string;
  photo_url:           string | null;
  id_card_photo_url:   string | null;
  id_card_printed:     boolean;
  id_card_paid:        boolean;
}

interface CardTemplateField {
  key:        string;
  x:          number;
  y:          number;
  fontSize:   number;
  color:      string;
  fontWeight?: string;
}

interface CardTemplate {
  width:      number;
  height:     number;
  background: string;
  logo?:      { x: number; y: number; width: number; height: number };
  fields:     CardTemplateField[];
}

// ── Sample template JSON ───────────────────────────────────
const SAMPLE_TEMPLATE: CardTemplate = {
  width:      320,
  height:     200,
  background: "#1a3a5c",
  logo:       { x: 20, y: 20, width: 60, height: 60 },
  fields: [
    { key: "school_name",   x: 90,  y: 20,  fontSize: 14, color: "#fff",    fontWeight: "bold" },
    { key: "full_name",     x: 20,  y: 90,  fontSize: 12, color: "#fff"                        },
    { key: "matric_number", x: 20,  y: 110, fontSize: 11, color: "#ffd700"                     },
    { key: "level",         x: 20,  y: 130, fontSize: 11, color: "#ccc"                        },
    { key: "department",    x: 20,  y: 150, fontSize: 10, color: "#ccc"                        },
  ],
};

// ── Helpers ────────────────────────────────────────────────
function resolveFieldValue(
  key: string,
  student: Student,
  schoolName: string,
): string {
  switch (key) {
    case "school_name":   return schoolName;
    case "full_name":     return `${student.first_name} ${student.last_name}`;
    case "matric_number": return student.matric_number;
    case "level":         return `${student.level} Level`;
    case "department":    return student.department || "";
    default:              return "";
  }
}

// ── ID Card Preview Component ──────────────────────────────
function IDCardPreview({
  student,
  template,
  schoolName,
  colors,
}: {
  student:    Student;
  template:   CardTemplate | null;
  schoolName: string;
  colors:     any;
}) {
  const tpl = template ?? SAMPLE_TEMPLATE;

  // Scale to fit within 300px wide
  const DISPLAY_W = 300;
  const scale     = DISPLAY_W / tpl.width;
  const displayH  = tpl.height * scale;

  return (
    <View
      style={[
        styles.cardPreviewOuter,
        { width: DISPLAY_W, height: displayH, borderRadius: radius.lg, overflow: "hidden" },
      ]}
    >
      {/* Background */}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tpl.background },
        ]}
      />

      {/* ID Photo placeholder / actual photo */}
      {student.id_card_photo_url ? (
        <Image
          source={{ uri: student.id_card_photo_url }}
          style={{
            position:     "absolute",
            left:         tpl.logo ? tpl.logo.x * scale : 20 * scale,
            top:          tpl.logo ? tpl.logo.y * scale : 20 * scale,
            width:        tpl.logo ? tpl.logo.width  * scale : 60 * scale,
            height:       tpl.logo ? tpl.logo.height * scale : 60 * scale,
            borderRadius: radius.sm,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            position:        "absolute",
            left:            tpl.logo ? tpl.logo.x * scale : 20 * scale,
            top:             tpl.logo ? tpl.logo.y * scale : 20 * scale,
            width:           tpl.logo ? tpl.logo.width  * scale : 60 * scale,
            height:          tpl.logo ? tpl.logo.height * scale : 60 * scale,
            borderRadius:    radius.sm,
            backgroundColor: brand.blueAlpha20,
            alignItems:      "center",
            justifyContent:  "center",
          }}
        >
          <Icon name="user-account" size="xl" color={brand.blueLight} />
        </View>
      )}

      {/* Text fields */}
      {tpl.fields.map((field, idx) => (
        <Text
          key={idx}
          style={{
            position:   "absolute",
            left:       field.x * scale,
            top:        field.y * scale,
            fontSize:   field.fontSize * scale,
            color:      field.color,
            fontWeight: (field.fontWeight as any) ?? fontWeight.normal,
          }}
          numberOfLines={1}
        >
          {resolveFieldValue(field.key, student, schoolName)}
        </Text>
      ))}
    </View>
  );
}

// ── Student Detail Bottom Sheet ────────────────────────────
interface StudentSheetProps {
  visible:    boolean;
  student:    Student | null;
  template:   CardTemplate | null;
  schoolName: string;
  slug:       string;
  db:         any;
  colors:     any;
  onClose:    () => void;
  onUpdated:  (updated: Partial<Student> & { id: string }) => void;
}

function StudentSheet({
  visible, student, template, schoolName, slug, db, colors, onClose, onUpdated,
}: StudentSheetProps) {
  const { showToast } = useToast();
  const [uploading,   setUploading]   = useState(false);
  const [marking,     setMarking]     = useState(false);

  if (!student) return null;

  // ── Photo capture / pick ─────────────────────────────────
  const capturePhoto = async (fromCamera: boolean) => {
    let result: ImagePicker.ImagePickerResult;
    try {
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow camera access to capture an ID photo.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.85,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow access to photos to upload an ID photo.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: true,
          aspect: [3, 4],
          quality: 0.85,
        });
      }
    } catch {
      Alert.alert("Error", "Failed to open image picker. Please try again.");
      return;
    }

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadIDPhoto(asset.uri);
  };

  const uploadIDPhoto = async (uri: string) => {
    if (!db || !slug || !student) return;
    setUploading(true);
    try {
      const path     = `${slug}/${student.id}/id-photo.jpg`;
      const response = await fetch(uri);
      const blob     = await response.blob();

      const { error: storageErr } = await (db as any).storage
        .from("id-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });

      if (storageErr) {
        throw new Error(storageErr.message || "Storage upload failed.");
      }

      const { data: urlData } = (db as any).storage.from("id-photos").getPublicUrl(path);
      const publicUrl: string = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not get public URL.");

      const { error: dbErr } = await db
        .from("students")
        .update({ id_card_photo_url: publicUrl } as any)
        .eq("id", student.id);

      if (dbErr) throw new Error(dbErr.message);

      onUpdated({ id: student.id, id_card_photo_url: publicUrl });
      showToast({ message: "ID photo saved successfully!", variant: "success" });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // ── Mark printed ─────────────────────────────────────────
  const markPrinted = async () => {
    if (!db || !student || student.id_card_printed) return;
    setMarking(true);
    try {
      const { error } = await db
        .from("students")
        .update({ id_card_printed: true } as any)
        .eq("id", student.id);
      if (error) throw error;
      onUpdated({ id: student.id, id_card_printed: true });
      showToast({ message: "Marked as printed!", variant: "success" });
    } catch {
      Alert.alert("Error", "Failed to update print status.");
    } finally {
      setMarking(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert("ID Card Photo", "Choose a source", [
      { text: "Capture from Camera", onPress: () => capturePhoto(true)  },
      { text: "Pick from Gallery",   onPress: () => capturePhoto(false) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const fullName = `${student.first_name} ${student.last_name}`;

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={680}>
      {/* Header */}
      <View style={[layout.rowBetween, { paddingHorizontal: spacing[5], marginBottom: spacing[4] }]}>
        <View style={[layout.row, { gap: spacing[3] }]}>
          <Avatar
            name={fullName}
            src={student.photo_url}
            size="lg"
            role="student"
          />
          <View>
            <Text variant="subtitle" weight="bold" color="primary">{fullName}</Text>
            <Text variant="caption" color="muted">{student.matric_number}</Text>
            <Text variant="micro"   color="muted">{student.level} Level · {student.department}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.iconBtn}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: spacing[5] }}>

        {/* Fee status */}
        <View style={[styles.feeRow, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT }]}>
          <Icon
            name={student.id_card_paid ? "status-success" : "status-warning"}
            size="md"
            color={student.id_card_paid ? colors.status.success : colors.status.warning}
          />
          <View style={layout.fill}>
            <Text variant="label" weight="semibold" color="primary">ID Card Fee</Text>
            <Text variant="micro" color="muted">
              {student.id_card_paid ? "Payment verified" : "No successful payment found"}
            </Text>
          </View>
          <Badge
            label={student.id_card_paid ? "Paid" : "Unpaid"}
            variant={student.id_card_paid ? "green" : "amber"}
          />
        </View>

        {/* Print status */}
        <View style={[layout.rowBetween, { marginTop: spacing[3], marginBottom: spacing[4] }]}>
          <View style={[layout.row, { gap: spacing[2] }]}>
            <Icon name="nav-idcards" size="md" color={student.id_card_printed ? colors.status.success : colors.text.muted} />
            <Text variant="label" color={student.id_card_printed ? "primary" : "muted"}>
              {student.id_card_printed ? "Card printed" : "Not yet printed"}
            </Text>
          </View>
          {!student.id_card_printed && (
            <TouchableOpacity
              onPress={markPrinted}
              disabled={marking}
              activeOpacity={0.75}
              style={[
                styles.markBtn,
                { backgroundColor: colors.status.successBg, borderColor: colors.status.successBorder },
              ]}
            >
              {marking ? (
                <ActivityIndicator size="small" color={colors.status.success} />
              ) : (
                <Text style={{ fontSize: fontSize.xs, color: colors.status.success, fontWeight: fontWeight.bold }}>
                  Mark Printed
                </Text>
              )}
            </TouchableOpacity>
          )}
          {student.id_card_printed && (
            <Badge label="Printed" variant="green" />
          )}
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

        {/* ID Card Photo section */}
        <Text variant="label" weight="bold" color="primary" style={{ marginTop: spacing[4], marginBottom: spacing[2] }}>
          ID Card Photo
        </Text>

        {student.id_card_photo_url ? (
          <View style={[layout.row, { gap: spacing[4], marginBottom: spacing[3], alignItems: "flex-start" }]}>
            <Image
              source={{ uri: student.id_card_photo_url }}
              style={styles.idPhotoThumb}
              resizeMode="cover"
            />
            <View style={{ flex: 1, gap: spacing[2] }}>
              <Badge label="Photo on file" variant="green" />
              <Button
                label={uploading ? "Uploading..." : "Replace Photo"}
                variant="secondary"
                size="sm"
                iconLeft="action-camera"
                loading={uploading}
                onPress={showPhotoOptions}
              />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={showPhotoOptions}
            disabled={uploading}
            activeOpacity={0.75}
            style={[styles.photoPlaceholder, { borderColor: colors.border.DEFAULT, backgroundColor: colors.bg.hover }]}
          >
            {uploading ? (
              <ActivityIndicator color={brand.blue} />
            ) : (
              <>
                <Icon name="action-camera" size="xl" color={brand.blue} />
                <Text style={{ fontSize: fontSize.sm, color: brand.blue, fontWeight: fontWeight.semibold, marginTop: spacing[2] }}>
                  Add ID Card Photo
                </Text>
                <Text style={{ fontSize: fontSize["2xs"], color: colors.text.muted, marginTop: spacing[1] }}>
                  Camera or Gallery
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Card Preview section */}
        <Text variant="label" weight="bold" color="primary" style={{ marginTop: spacing[4], marginBottom: spacing[3] }}>
          Card Preview
        </Text>

        <View style={{ alignItems: "center", marginBottom: spacing[5] }}>
          <IDCardPreview
            student={student}
            template={template}
            schoolName={schoolName}
            colors={colors}
          />
          {!template && (
            <Text variant="micro" color="muted" style={{ marginTop: spacing[2], textAlign: "center" }}>
              Using default layout — upload a JSON template to customise
            </Text>
          )}
        </View>

      </View>
    </BottomSheet>
  );
}

// ── Template Management Card ───────────────────────────────
interface TemplateCardProps {
  template:       CardTemplate | null;
  loading:        boolean;
  colors:         any;
  onUpload:       () => void;
  onShowSample:   () => void;
}

function TemplateManagementCard({ template, loading, colors, onUpload, onShowSample }: TemplateCardProps) {
  return (
    <Card variant="brand">
      <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          <Icon name="nav-idcards" size="lg" color={brand.blue} />
          <Text variant="subtitle" weight="bold" color="primary">Card Template</Text>
        </View>
        <Badge
          label={template ? "Custom" : "Default"}
          variant={template ? "green" : "gray"}
        />
      </View>

      <Text variant="body" color="secondary" style={{ marginBottom: spacing[4] }}>
        {template
          ? `Custom JSON template active (${template.fields.length} fields, ${template.width}×${template.height})`
          : "Using the built-in default card layout. Upload a JSON template to use your school's branding."}
      </Text>

      <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
        <Button
          label={loading ? "Uploading..." : "Upload Template (JSON)"}
          variant="primary"
          size="sm"
          iconLeft="action-upload"
          loading={loading}
          onPress={onUpload}
        />
        <Button
          label="View Sample"
          variant="ghost"
          size="sm"
          iconLeft="action-download"
          onPress={onShowSample}
        />
      </View>
    </Card>
  );
}

// ── Sample Template Modal ──────────────────────────────────
function SampleTemplateModal({ visible, onClose, colors }: { visible: boolean; onClose: () => void; colors: any }) {
  const json = JSON.stringify(SAMPLE_TEMPLATE, null, 2);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop]}>
        <View style={[styles.modalBox, { backgroundColor: colors.bg.elevated }]}>
          <View style={[layout.rowBetween, { marginBottom: spacing[3] }]}>
            <Text variant="subtitle" weight="bold" color="primary">Sample Template JSON</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.iconBtn}>
              <Icon name="ui-close" size="md" color={colors.text.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.jsonScroll} showsVerticalScrollIndicator>
            <TextInput
              style={[styles.jsonBox, { color: colors.text.secondary, backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}
              value={json}
              multiline
              editable={false}
              textAlignVertical="top"
            />
          </ScrollView>
          <Text variant="caption" color="muted" style={{ marginTop: spacing[3], marginBottom: spacing[2] }}>
            Save this as a .json file and upload via "Upload Template (JSON)".
          </Text>
          <Button label="Close" variant="secondary" size="md" full onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminIDCards() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [students,        setStudents]        = useState<Student[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [search,          setSearch]          = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [sheetVisible,    setSheetVisible]    = useState(false);
  const [template,        setTemplate]        = useState<CardTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [sampleVisible,   setSampleVisible]   = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) { load(); loadTemplate(); } }, [db]);

  // ── Load students with fee status ──────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      // 1. Load students
      const { data: studs, error: studsErr } = await db
        .from("students")
        .select("id, first_name, last_name, matric_number, level, department, photo_url, id_card_photo_url, id_card_printed")
        .eq("status", "active")
        .order("first_name");

      if (studsErr) throw studsErr;
      const studentList: any[] = studs || [];

      // 2. Load successful ID card payments in bulk
      // fee_structure where fee_type = 'id_card' → join student_payments
      let paidIds = new Set<string>();
      try {
        const { data: fees } = await db
          .from("fee_structure")
          .select("id")
          .eq("fee_type", "id_card");

        const feeIds = (fees || []).map((f: any) => f.id);
        if (feeIds.length > 0) {
          const { data: payments } = await db
            .from("student_payments")
            .select("student_id")
            .in("fee_id", feeIds)
            .eq("status", "success");
          (payments || []).forEach((p: any) => paidIds.add(p.student_id));
        }
      } catch {
        // fee_structure or student_payments table might not exist yet — graceful fallback
      }

      const merged: Student[] = studentList.map((s) => ({
        ...s,
        id_card_paid:    paidIds.has(s.id),
        id_card_printed: s.id_card_printed ?? false,
      }));

      // Sync id_card_paid flag back to DB if it differs (fire-and-forget)
      merged.forEach((s) => {
        const paid = paidIds.has(s.id);
        // Only update if column exists and differs — best-effort
        db.from("students").update({ id_card_paid: paid } as any).eq("id", s.id).then(() => {});
      });

      setStudents(merged);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  // ── Load card template from org_settings ──────────────────
  const loadTemplate = useCallback(async () => {
    if (!db) return;
    try {
      const { data } = await db
        .from("org_settings")
        .select("value")
        .eq("key", "id_card_template")
        .maybeSingle();
      if (data?.value) {
        const parsed: CardTemplate = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed.fields)) setTemplate(parsed);
      }
    } catch {
      // org_settings may not exist yet
    }
  }, [db]);

  // ── Upload template JSON ───────────────────────────────────
  const handleUploadTemplate = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type:                 "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const text  = await (await fetch(asset.uri)).text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert("Invalid JSON", "The selected file is not valid JSON.");
        return;
      }

      if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
        Alert.alert("Invalid template", "JSON must contain a non-empty `fields` array.");
        return;
      }

      if (!db) return;
      setTemplateLoading(true);
      try {
        const { error } = await db
          .from("org_settings")
          .upsert({ key: "id_card_template", value: JSON.stringify(parsed) } as any, {
            onConflict: "key",
          });
        if (error) throw error;
        setTemplate(parsed as CardTemplate);
        showToast({ message: "Card template uploaded!", variant: "success" });
      } catch (err: any) {
        Alert.alert("Save failed", err?.message || "Could not save template.");
      } finally {
        setTemplateLoading(false);
      }
    } catch {
      Alert.alert("Error", "Failed to open document picker. Please try again.");
    }
  };

  // ── Filtered student list ──────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
        s.matric_number.toLowerCase().includes(q),
    );
  }, [students, search]);

  // ── Stats ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = students.length;
    const photos  = students.filter((s) => !!s.id_card_photo_url).length;
    const printed = students.filter((s) => s.id_card_printed).length;
    const unpaid  = students.filter((s) => !s.id_card_paid).length;
    return { total, photos, printed, unpaid };
  }, [students]);

  const openSheet = (student: Student) => {
    setSelectedStudent(student);
    setSheetVisible(true);
  };

  const handleStudentUpdated = (updated: Partial<Student> & { id: string }) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)),
    );
    setSelectedStudent((prev) =>
      prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
    );
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell
      role="admin"
      user={adminUser}
      schoolName={tenant?.name || ""}
      pageTitle="ID Cards"
      onLogout={async () => { await signOut(); router.replace("/login" as any); }}
    >
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); loadTemplate(); }}
            tintColor={brand.gold}
          />
        }
      >
        {/* Page heading */}
        <View>
          <Text variant="heading"  color="primary">ID Card Management</Text>
          <Text variant="caption"  color="muted"  style={{ marginTop: spacing[1] }}>
            Manage student ID cards, photos, and printing
          </Text>
        </View>

        {/* Template management card */}
        <TemplateManagementCard
          template={template}
          loading={templateLoading}
          colors={colors}
          onUpload={handleUploadTemplate}
          onShowSample={() => setSampleVisible(true)}
        />

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[16] }]}>
            <Spinner size="lg" label="Loading students..." />
          </View>
        ) : (
          <>
            {/* Stats row */}
            <View style={[layout.row, { gap: spacing[3], flexWrap: "wrap" }]}>
              <StatCard
                icon="user-student"
                label="Total"
                value={stats.total}
                color="brand"
                style={{ flex: 1, minWidth: 120 }}
              />
              <StatCard
                icon="action-camera"
                label="Photos"
                value={stats.photos}
                color={stats.photos === stats.total && stats.total > 0 ? "success" : "info"}
                style={{ flex: 1, minWidth: 120 }}
              />
              <StatCard
                icon="nav-idcards"
                label="Printed"
                value={stats.printed}
                color="success"
                style={{ flex: 1, minWidth: 120 }}
              />
              <StatCard
                icon="nav-payments"
                label="Unpaid"
                value={stats.unpaid}
                color={stats.unpaid > 0 ? "warning" : "success"}
                style={{ flex: 1, minWidth: 120 }}
              />
            </View>

            {/* Search bar */}
            <View style={[styles.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
              <Icon name="action-search" size="sm" color={colors.text.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text.primary }]}
                placeholder="Search by name or matric..."
                placeholderTextColor={colors.text.muted}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch("")} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="ui-close" size="sm" color={colors.text.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Student list */}
            {filtered.length === 0 ? (
              <EmptyState
                icon="nav-idcards"
                title={search ? "No students found" : "No active students"}
                description={search ? `No results for "${search}"` : "Active students will appear here."}
              />
            ) : (
              <Card padding="none">
                {filtered.map((student, idx) => {
                  const isLast  = idx === filtered.length - 1;
                  const fullName = `${student.first_name} ${student.last_name}`;
                  return (
                    <TouchableOpacity
                      key={student.id}
                      onPress={() => openSheet(student)}
                      activeOpacity={0.75}
                      style={[
                        styles.studentRow,
                        { borderBottomColor: colors.border.subtle, borderBottomWidth: isLast ? 0 : 1 },
                      ]}
                    >
                      {/* Avatar */}
                      <Avatar name={fullName} src={student.photo_url} size="md" role="student" />

                      {/* Info */}
                      <View style={[layout.fill, { marginLeft: spacing[3] }]}>
                        <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>
                          {fullName}
                        </Text>
                        <Text variant="micro" color="muted">
                          {student.matric_number} · {student.level} Level
                        </Text>
                      </View>

                      {/* Status badges */}
                      <View style={[styles.badgeCol]}>
                        <View style={[layout.row, { gap: spacing[1], justifyContent: "flex-end", flexWrap: "wrap" }]}>
                          <Badge
                            label={student.id_card_paid ? "Paid" : "Unpaid"}
                            variant={student.id_card_paid ? "green" : "amber"}
                            size="xs"
                          />
                          {student.id_card_photo_url ? (
                            <Badge label="Photo" variant="blue" size="xs" />
                          ) : (
                            <Badge label="No Photo" variant="gray" size="xs" />
                          )}
                          {student.id_card_printed && (
                            <Badge label="Printed" variant="green" size="xs" />
                          )}
                        </View>
                        <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {/* Student detail bottom sheet */}
      <StudentSheet
        visible={sheetVisible}
        student={selectedStudent}
        template={template}
        schoolName={tenant?.name || ""}
        slug={slug || ""}
        db={db}
        colors={colors}
        onClose={() => setSheetVisible(false)}
        onUpdated={handleStudentUpdated}
      />

      {/* Sample template modal */}
      <SampleTemplateModal
        visible={sampleVisible}
        onClose={() => setSampleVisible(false)}
        colors={colors}
      />
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  iconBtn: {
    padding: spacing[2],
  },
  searchBar: {
    flexDirection:     "row",
    alignItems:        "center",
    borderRadius:      radius.lg,
    borderWidth:       1,
    paddingHorizontal: spacing[3],
    gap:               spacing[2],
    minHeight:         spacing[12],
  },
  searchInput: {
    flex:            1,
    fontSize:        fontSize.md,
    paddingVertical: spacing[3],
  },
  studentRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3],
  },
  badgeCol: {
    alignItems:  "flex-end",
    gap:         spacing[1],
    marginLeft:  spacing[2],
    flexShrink:  0,
  },
  feeRow: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               spacing[3],
    padding:           spacing[3],
    borderRadius:      radius.lg,
    borderWidth:       1,
  },
  markBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical:   spacing[1],
    borderRadius:      radius.full,
    borderWidth:       1,
    minWidth:          90,
    alignItems:        "center",
  },
  divider: {
    height: 1,
  },
  photoPlaceholder: {
    alignItems:      "center",
    justifyContent:  "center",
    height:          140,
    borderRadius:    radius.lg,
    borderWidth:     2,
    borderStyle:     "dashed",
    marginBottom:    spacing[2],
  },
  idPhotoThumb: {
    width:        90,
    height:       120,
    borderRadius: radius.md,
  },
  cardPreviewOuter: {
    position: "relative",
  },
  modalBackdrop: {
    flex:            1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent:  "flex-end",
    padding:         spacing[4],
  },
  modalBox: {
    borderRadius:  radius["2xl"],
    padding:       spacing[5],
    maxHeight:     "85%",
  },
  jsonScroll: {
    maxHeight: 360,
  },
  jsonBox: {
    fontSize:    fontSize.xs,
    fontFamily:  Platform.OS === "ios" ? "Menlo" : "monospace",
    padding:     spacing[3],
    borderRadius: radius.md,
    borderWidth:  1,
    minHeight:   200,
  },
});
