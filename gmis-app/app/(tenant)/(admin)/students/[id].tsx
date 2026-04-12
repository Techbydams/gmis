// ============================================================
// GMIS — Admin Student Detail & Edit
// Route: /(tenant)/(admin)/students/[id]
//
// Features:
//   • Full student profile: photo, name, matric, dept, level, status
//   • Edit all details inline (BottomSheet form)
//   • View course registrations per semester
//   • View results summary
//   • Suspend / activate / delete student
//   • Force password reset on next login
//   • Change profile picture via expo-image-picker + Supabase storage
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Image, ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { formatDate, formatGPA, getInitials } from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  matric_number: string;
  email: string;
  phone: string | null;
  level: string;
  status: string;
  gpa: number;
  department_id: string | null;
  dept_name?: string;
  profile_picture_url: string | null;
  force_password_reset: boolean;
  date_of_birth: string | null;
  address: string | null;
  state_of_origin: string | null;
  gender: string | null;
  entry_year: string | null;
  supabase_uid: string | null;
}

interface CourseReg {
  id: string;
  course_code: string;
  course_name: string;
  credit_units: number;
  semester: string;
  session: string | null;
}

interface ResultRow {
  id: string;
  course_code: string;
  course_name: string;
  score: number;
  grade: string;
  credit_units: number;
  semester: string;
}

const STATUS_OPTIONS = ["active", "pending", "suspended", "graduated"];
const LEVEL_OPTIONS  = ["100", "200", "300", "400", "500", "600"];
const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];

// ── Edit Sheet ─────────────────────────────────────────────
interface EditSheetProps {
  visible:  boolean;
  onClose:  () => void;
  student:  StudentProfile;
  depts:    { id: string; name: string }[];
  onSave:   (patch: Partial<StudentProfile>) => Promise<void>;
  colors:   any;
}

function EditSheet({ visible, onClose, student, depts, onSave, colors }: EditSheetProps) {
  const [firstName,  setFirstName]  = useState(student.first_name);
  const [lastName,   setLastName]   = useState(student.last_name);
  const [email,      setEmail]      = useState(student.email);
  const [phone,      setPhone]      = useState(student.phone || "");
  const [matric,     setMatric]     = useState(student.matric_number);
  const [level,      setLevel]      = useState(student.level);
  const [status,     setStatus]     = useState(student.status);
  const [deptId,     setDeptId]     = useState(student.department_id || "");
  const [dob,        setDob]        = useState(student.date_of_birth?.substring(0, 10) || "");
  const [address,    setAddress]    = useState(student.address || "");
  const [stateOrig,  setStateOrig]  = useState(student.state_of_origin || "");
  const [gender,     setGender]     = useState(student.gender || "");
  const [forceReset, setForceReset] = useState(student.force_password_reset);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    if (visible) {
      setFirstName(student.first_name); setLastName(student.last_name);
      setEmail(student.email); setPhone(student.phone || "");
      setMatric(student.matric_number); setLevel(student.level);
      setStatus(student.status); setDeptId(student.department_id || "");
      setDob(student.date_of_birth?.substring(0, 10) || "");
      setAddress(student.address || ""); setStateOrig(student.state_of_origin || "");
      setGender(student.gender || ""); setForceReset(student.force_password_reset);
    }
  }, [visible, student]);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !matric.trim()) {
      Alert.alert("Required", "First name, last name, and matric number are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        first_name: firstName.trim(), last_name: lastName.trim(),
        email: email.trim(), phone: phone.trim() || null,
        matric_number: matric.trim(), level, status,
        department_id: deptId || null,
        date_of_birth: dob || null, address: address.trim() || null,
        state_of_origin: stateOrig.trim() || null, gender: gender || null,
        force_password_reset: forceReset,
      });
      onClose();
    } catch { Alert.alert("Error", "Failed to save changes."); }
    finally { setSaving(false); }
  };

  const F = ({ label, value, onChangeText, placeholder, keyboard }: any) => (
    <View style={{ marginBottom: spacing[3] }}>
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[1] }}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={colors.text.muted} keyboardType={keyboard || "default"}
      />
    </View>
  );

  const ChipGroup = ({ label, options, value, onChange }: any) => (
    <View style={{ marginBottom: spacing[3] }}>
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          {options.map((opt: any) => {
            const key   = typeof opt === "string" ? opt : opt.id;
            const lbl   = typeof opt === "string" ? opt : opt.name;
            const isAct = value === key;
            return (
              <TouchableOpacity
                key={key} onPress={() => onChange(key)} activeOpacity={0.75}
                style={[styles.chip, { backgroundColor: isAct ? brand.blue : colors.bg.hover, borderColor: isAct ? brand.blue : colors.border.DEFAULT }]}
              >
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: isAct ? "#fff" : colors.text.secondary }}>{lbl}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={700}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">Edit Student</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={[layout.row, { gap: spacing[3] }]}>
        <View style={{ flex: 1 }}><F label="FIRST NAME" value={firstName} onChangeText={setFirstName} placeholder="e.g. John" /></View>
        <View style={{ flex: 1 }}><F label="LAST NAME"  value={lastName}  onChangeText={setLastName}  placeholder="e.g. Doe" /></View>
      </View>
      <F label="MATRIC NUMBER" value={matric} onChangeText={setMatric} placeholder="e.g. MCS/2021/001" />
      <F label="EMAIL" value={email} onChangeText={setEmail} placeholder="student@school.edu.ng" keyboard="email-address" />
      <F label="PHONE" value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboard="phone-pad" />
      <F label="DATE OF BIRTH" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" />
      <F label="ADDRESS"       value={address}   onChangeText={setAddress}   placeholder="Home address" />
      <F label="STATE OF ORIGIN" value={stateOrig} onChangeText={setStateOrig} placeholder="e.g. Lagos" />

      <ChipGroup label="GENDER" options={GENDER_OPTIONS} value={gender} onChange={setGender} />
      <ChipGroup label="LEVEL"  options={LEVEL_OPTIONS}  value={level}  onChange={setLevel}  />
      <ChipGroup label="STATUS" options={STATUS_OPTIONS}  value={status} onChange={setStatus} />
      {depts.length > 0 && (
        <ChipGroup label="DEPARTMENT" options={[{ id: "", name: "None" }, ...depts]} value={deptId} onChange={setDeptId} />
      )}

      {/* Force password reset */}
      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginBottom: spacing[4] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Force password reset</Text>
          <Text variant="micro" color="muted">Student must change password on next login</Text>
        </View>
        <TouchableOpacity onPress={() => setForceReset((r) => !r)} activeOpacity={0.7}>
          <Icon name={forceReset ? "ui-check" : "ui-radio-off"} size="md" color={forceReset ? brand.blue : colors.text.muted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleSave} disabled={saving} activeOpacity={0.75}
        style={[styles.saveBtn, { backgroundColor: brand.blue }]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Save Changes</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function StudentDetail() {
  const router              = useRouter();
  const { id }              = useLocalSearchParams<{ id: string }>();
  const { user, signOut }   = useAuth();
  const { tenant, slug }    = useTenant();
  const { colors }          = useTheme();
  const { pagePadding }     = useResponsive();
  const { showToast }       = useToast();

  const [student,      setStudent]      = useState<StudentProfile | null>(null);
  const [depts,        setDepts]        = useState<{ id: string; name: string }[]>([]);
  const [courseRegs,   setCourseRegs]   = useState<CourseReg[]>([]);
  const [results,      setResults]      = useState<ResultRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editSheet,    setEditSheet]    = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [activeTab,    setActiveTab]    = useState<"info" | "courses" | "results">("info");

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && id) load(); }, [db, id]);

  const load = useCallback(async () => {
    if (!db || !id) return;
    setLoading(true);
    try {
      const [studentRes, deptsRes] = await Promise.allSettled([
        db.from("students").select("*").eq("id", id).maybeSingle(),
        db.from("departments").select("id, name").order("name"),
      ]);

      if (studentRes.status === "fulfilled" && studentRes.value.data) {
        const s = studentRes.value.data as any;
        if (deptsRes.status === "fulfilled") {
          const allDepts = (deptsRes.value.data || []) as any[];
          setDepts(allDepts);
          s.dept_name = allDepts.find((d: any) => d.id === s.department_id)?.name || "";
        }
        setStudent(s);
      }

      // Course registrations
      const { data: regData } = await db
        .from("semester_registrations")
        .select("id, course_id, semester, session")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (regData && regData.length > 0) {
        const courseIds = regData.map((r: any) => r.course_id).filter(Boolean);
        const { data: courses } = await db
          .from("courses")
          .select("id, course_code, course_name, credit_units")
          .in("id", courseIds);
        const courseMap: Record<string, any> = {};
        (courses || []).forEach((c: any) => { courseMap[c.id] = c; });
        setCourseRegs(regData.map((r: any) => ({
          id:           r.id,
          course_code:  courseMap[r.course_id]?.course_code  || "—",
          course_name:  courseMap[r.course_id]?.course_name  || "Unknown",
          credit_units: courseMap[r.course_id]?.credit_units || 0,
          semester:     r.semester,
          session:      r.session,
        })));
      }

      // Results
      const { data: resData } = await db
        .from("results")
        .select("id, course_id, score, grade, semester, credit_units")
        .eq("student_id", id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (resData && resData.length > 0) {
        const courseIds2 = resData.map((r: any) => r.course_id).filter(Boolean);
        const { data: courses2 } = await db.from("courses").select("id, course_code, course_name").in("id", courseIds2);
        const cmap: Record<string, any> = {};
        (courses2 || []).forEach((c: any) => { cmap[c.id] = c; });
        setResults(resData.map((r: any) => ({
          id:           r.id,
          course_code:  cmap[r.course_id]?.course_code || "—",
          course_name:  cmap[r.course_id]?.course_name || "Unknown",
          score:        r.score,
          grade:        r.grade,
          credit_units: r.credit_units,
          semester:     r.semester,
        })));
      }
    } catch {
      showToast({ message: "Failed to load student data.", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [db, id]);

  // ── Update student ──────────────────────────────────────
  const handleSave = async (patch: Partial<StudentProfile>) => {
    if (!db || !student) throw new Error("No DB");
    const { error } = await db.from("students").update(patch as any).eq("id", student.id);
    if (error) throw error;
    setStudent((prev) => prev ? { ...prev, ...patch } : prev);
    showToast({ message: "Student updated successfully.", variant: "success" });
  };

  // ── Profile picture ─────────────────────────────────────
  const changePicture = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Allow photo access to change profile picture."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0] || !db || !student) return;
    setUploadingPic(true);
    try {
      const uri      = result.assets[0].uri;
      const filename = `students/${slug}/${student.id}/avatar.jpg`;
      const resp     = await fetch(uri);
      const blob     = await resp.blob();
      const { error: upErr } = await (db as any).storage
        .from("profiles").upload(filename, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) { showToast({ message: "Upload failed. Using local preview.", variant: "warning" }); return; }
      const { data: urlData } = (db as any).storage.from("profiles").getPublicUrl(filename);
      const url = urlData?.publicUrl || uri;
      await db.from("students").update({ profile_picture_url: url } as any).eq("id", student.id);
      setStudent((prev) => prev ? { ...prev, profile_picture_url: url } : prev);
      showToast({ message: "Profile picture updated.", variant: "success" });
    } catch { showToast({ message: "Failed to upload picture.", variant: "error" }); }
    finally { setUploadingPic(false); }
  };

  // ── Status actions ──────────────────────────────────────
  const setStudentStatus = (newStatus: string) => {
    const label = newStatus === "suspended" ? "Suspend" : newStatus === "active" ? "Activate" : "Delete";
    const msg   = newStatus === "deleted"
      ? "This will permanently delete the student record. This cannot be undone."
      : `Set student status to "${newStatus}"?`;
    Alert.alert(`${label} Student`, msg, [
      { text: "Cancel", style: "cancel" },
      {
        text: label, style: newStatus === "deleted" ? "destructive" : "default",
        onPress: async () => {
          if (!db || !student) return;
          if (newStatus === "deleted") {
            await db.from("students").delete().eq("id", student.id);
            showToast({ message: "Student deleted.", variant: "info" });
            router.back();
          } else {
            await db.from("students").update({ status: newStatus } as any).eq("id", student.id);
            setStudent((prev) => prev ? { ...prev, status: newStatus } : prev);
            showToast({ message: `Student ${newStatus}.`, variant: "success" });
          }
        },
      },
    ]);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  if (loading) {
    return (
      <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Student Detail" onLogout={async () => { await signOut(); router.replace("/login"); }}>
        <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
          <Spinner size="lg" label="Loading student..." />
        </View>
      </AppShell>
    );
  }

  if (!student) {
    return (
      <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Student Detail" onLogout={async () => { await signOut(); router.replace("/login"); }}>
        <View style={[layout.fill, layout.centred, { backgroundColor: colors.bg.primary }]}>
          <Text variant="body" color="muted">Student not found.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: spacing[4] }}>
            <Text variant="label" color="link">← Back to students</Text>
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  const TABS = [
    { key: "info",    label: "Profile" },
    { key: "courses", label: `Courses (${courseRegs.length})` },
    { key: "results", label: `Results (${results.length})` },
  ] as const;

  return (
    <AppShell
      role="admin"
      user={adminUser}
      schoolName={tenant?.name || ""}
      pageTitle={`${student.first_name} ${student.last_name}`}
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ paddingBottom: spacing[20] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile hero */}
        <View style={[styles.hero, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Icon name="ui-back" size="md" color={colors.text.secondary} />
          </TouchableOpacity>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <TouchableOpacity onPress={changePicture} activeOpacity={0.8} disabled={uploadingPic}>
              {student.profile_picture_url ? (
                <Image source={{ uri: student.profile_picture_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: brand.blueAlpha15 }]}>
                  <Text style={{ fontSize: 32, fontWeight: fontWeight.black, color: brand.blue }}>
                    {getInitials(`${student.first_name} ${student.last_name}`)}
                  </Text>
                </View>
              )}
              <View style={[styles.cameraOverlay, { backgroundColor: brand.blue }]}>
                {uploadingPic
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Icon name="user-account" size="xs" color="#fff" />
                }
              </View>
            </TouchableOpacity>
          </View>

          {/* Name & meta */}
          <Text variant="title" weight="black" color="primary" align="center">
            {student.first_name} {student.last_name}
          </Text>
          <Text variant="body" color="muted" align="center">{student.matric_number}</Text>

          <View style={[layout.row, { gap: spacing[3], justifyContent: "center", marginTop: spacing[3] }]}>
            <Badge label={student.status} variant={student.status === "active" ? "green" : student.status === "pending" ? "amber" : "red"} />
            <Badge label={`${student.level} Level`} variant="blue" />
            {student.dept_name && <Badge label={student.dept_name} variant="gray" />}
          </View>

          {student.gpa > 0 && (
            <View style={[styles.gpaChip, { backgroundColor: brand.goldAlpha15, borderColor: brand.goldAlpha20, marginTop: spacing[3] }]}>
              <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: brand.goldDark }}>
                GPA: {formatGPA(student.gpa)}
              </Text>
            </View>
          )}

          {/* Action buttons */}
          <View style={[layout.row, { gap: spacing[3], marginTop: spacing[4], justifyContent: "center", flexWrap: "wrap" }]}>
            <TouchableOpacity onPress={() => setEditSheet(true)} activeOpacity={0.75} style={[styles.actionBtn, { backgroundColor: brand.blue }]}>
              <Icon name="ui-more" size="sm" color="#fff" />
              <Text style={{ color: "#fff", fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Edit</Text>
            </TouchableOpacity>
            {student.status === "active" ? (
              <TouchableOpacity onPress={() => setStudentStatus("suspended")} activeOpacity={0.75} style={[styles.actionBtn, { backgroundColor: colors.status?.warningBg || "#fef3c7", borderWidth: 1, borderColor: colors.status?.warningBorder || "#fde68a" }]}>
                <Icon name="status-warning" size="sm" color="#d97706" />
                <Text style={{ color: "#d97706", fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Suspend</Text>
              </TouchableOpacity>
            ) : student.status === "suspended" ? (
              <TouchableOpacity onPress={() => setStudentStatus("active")} activeOpacity={0.75} style={[styles.actionBtn, { backgroundColor: colors.status?.successBg || "#d1fae5", borderWidth: 1, borderColor: colors.status?.successBorder || "#6ee7b7" }]}>
                <Icon name="status-success" size="sm" color="#059669" />
                <Text style={{ color: "#059669", fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Activate</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setStudentStatus("deleted")} activeOpacity={0.75} style={[styles.actionBtn, { backgroundColor: colors.status?.errorBg || "#fee2e2", borderWidth: 1, borderColor: colors.status?.errorBorder || "#fca5a5" }]}>
              <Icon name="ui-close" size="sm" color="#dc2626" />
              <Text style={{ color: "#dc2626", fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
              style={[styles.tab, activeTab === tab.key && { borderBottomColor: brand.blue, borderBottomWidth: 2 }]}
            >
              <Text style={{ fontSize: fontSize.sm, fontWeight: activeTab === tab.key ? fontWeight.bold : fontWeight.medium, color: activeTab === tab.key ? brand.blue : colors.text.muted }}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ padding: pagePadding, gap: spacing[4] }}>
          {/* ── Profile tab ── */}
          {activeTab === "info" && (
            <>
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Personal Information</Text>
                <InfoRow label="Email"          value={student.email}            icon="nav-chat"     colors={colors} />
                <InfoRow label="Phone"          value={student.phone}            icon="nav-chat"     colors={colors} />
                <InfoRow label="Date of Birth"  value={student.date_of_birth ? formatDate(student.date_of_birth) : null} icon="academic-calendar" colors={colors} />
                <InfoRow label="Gender"         value={student.gender}           icon="user-student" colors={colors} />
                <InfoRow label="State of Origin" value={student.state_of_origin} icon="status-info"  colors={colors} />
                <InfoRow label="Address"        value={student.address}          icon="status-info"  colors={colors} last />
              </Card>
              <Card>
                <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[4] }}>Academic Information</Text>
                <InfoRow label="Department" value={student.dept_name}  icon="academic-dept"    colors={colors} />
                <InfoRow label="Level"      value={`${student.level} Level`} icon="academic-grade" colors={colors} />
                <InfoRow label="Entry Year" value={student.entry_year} icon="academic-calendar" colors={colors} />
                <InfoRow label="Status"     value={student.status}     icon="status-info"      colors={colors} />
                <InfoRow label="GPA"        value={student.gpa > 0 ? formatGPA(student.gpa) : "—"} icon="academic-gpa" colors={colors} last />
              </Card>
              {student.force_password_reset && (
                <View style={[styles.alertBanner, { backgroundColor: colors.status?.warningBg || "#fef3c7", borderColor: colors.status?.warningBorder || "#fde68a" }]}>
                  <Icon name="status-warning" size="sm" color="#d97706" />
                  <Text style={{ flex: 1, fontSize: fontSize.sm, color: "#d97706" }}>Force password reset is enabled. Student must change password on next login.</Text>
                </View>
              )}
            </>
          )}

          {/* ── Courses tab ── */}
          {activeTab === "courses" && (
            courseRegs.length === 0 ? (
              <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
                <Icon name="nav-courses" size="xl" color={colors.text.muted} />
                <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[3] }}>No course registrations found.</Text>
              </View>
            ) : (
              <Card>
                {courseRegs.map((cr, i) => (
                  <View key={cr.id} style={[styles.listRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < courseRegs.length - 1 ? 1 : 0 }]}>
                    <View style={[styles.courseCode, { backgroundColor: brand.blueAlpha10 }]}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>{cr.course_code}</Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{cr.course_name}</Text>
                      <Text variant="micro" color="muted">{cr.semester} · {cr.credit_units} units · {cr.session || "—"}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            )
          )}

          {/* ── Results tab ── */}
          {activeTab === "results" && (
            results.length === 0 ? (
              <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
                <Icon name="nav-results" size="xl" color={colors.text.muted} />
                <Text variant="body" color="muted" align="center" style={{ marginTop: spacing[3] }}>No results found.</Text>
              </View>
            ) : (
              <Card>
                {results.map((r, i) => (
                  <View key={r.id} style={[styles.listRow, { borderBottomColor: colors.border.subtle, borderBottomWidth: i < results.length - 1 ? 1 : 0 }]}>
                    <View style={[styles.courseCode, { backgroundColor: brand.blueAlpha10 }]}>
                      <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: brand.blue }}>{r.course_code}</Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{r.course_name}</Text>
                      <Text variant="micro" color="muted">{r.semester} · {r.credit_units} units</Text>
                    </View>
                    <View style={[styles.gradeChip, {
                      backgroundColor: r.grade === "A" ? brand.emeraldAlpha15 : r.grade?.startsWith("F") ? "rgba(239,68,68,0.12)" : brand.blueAlpha10,
                    }]}>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.black, color: r.grade === "A" ? brand.emerald : r.grade?.startsWith("F") ? "#ef4444" : brand.blue }}>
                        {r.grade || "—"}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text.primary, minWidth: 36, textAlign: "right" }}>
                      {r.score}
                    </Text>
                  </View>
                ))}
              </Card>
            )
          )}
        </View>
      </ScrollView>

      {/* Edit sheet */}
      {student && (
        <EditSheet
          visible={editSheet}
          onClose={() => setEditSheet(false)}
          student={student}
          depts={depts}
          onSave={handleSave}
          colors={colors}
        />
      )}
    </AppShell>
  );
}

// ── Helper component ───────────────────────────────────────
function InfoRow({ label, value, icon, colors, last }: { label: string; value?: string | null; icon: any; colors: any; last?: boolean }) {
  if (!value) return null;
  return (
    <View style={[layout.row, { gap: spacing[3], paddingVertical: spacing[3], borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border.subtle }]}>
      <Icon name={icon} size="sm" color={colors.text.muted} />
      <View style={layout.fill}>
        <Text variant="micro" color="muted">{label}</Text>
        <Text variant="label" weight="medium" color="primary">{value}</Text>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  hero:         { padding: spacing[6], alignItems: "center", borderBottomWidth: 1, gap: spacing[1] },
  backBtn:      { alignSelf: "flex-start", padding: spacing[2], marginBottom: spacing[2] },
  avatarWrap:   { position: "relative", marginBottom: spacing[4] },
  avatar:       { width: 96, height: 96, borderRadius: radius.full },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  cameraOverlay:  { position: "absolute", bottom: 0, right: 0, width: 28, height: 28, borderRadius: radius.full, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  gpaChip:      { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  actionBtn:    { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  tabs:         { flexDirection: "row", borderBottomWidth: 1 },
  tab:          { flex: 1, paddingVertical: spacing[3], alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  listRow:      { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingVertical: spacing[3] },
  courseCode:   { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md, minWidth: 64, alignItems: "center" },
  gradeChip:    { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.md, minWidth: 32, alignItems: "center" },
  alertBanner:  { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  input:        { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  chip:         { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  toggleRow:    { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  saveBtn:      { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
