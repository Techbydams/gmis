// ============================================================
// GMIS — Student Profile
// Route: /(tenant)/(student)/profile
// Allows student to view & edit profile info, upload photo
// Photo stored as base64 data URI in students.profile_photo
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Image,
  Alert, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text, Spinner, Badge } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme } from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Top bar ─────────────────────────────────────────────────
function TopBar({ onBack, onSave, saving }: { onBack: () => void; onSave: () => void; saving: boolean }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, {
      backgroundColor: colors.bg.card,
      borderBottomColor: colors.border.DEFAULT,
      paddingTop: insets.top + spacing[2],
    }]}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={colors.text.secondary} />
      </TouchableOpacity>
      <View style={layout.fill}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>
          My Profile
        </Text>
      </View>
      <TouchableOpacity onPress={onSave} disabled={saving} activeOpacity={0.7}>
        {saving ? (
          <Spinner size="sm" />
        ) : (
          <Text style={{ fontSize: fontSize.sm, color: brand.blue, fontWeight: fontWeight.semibold }}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ── Field row ────────────────────────────────────────────────
function FieldRow({
  label, value, editable, onChangeText, placeholder, colors, keyboardType,
}: {
  label: string; value: string; editable?: boolean;
  onChangeText?: (t: string) => void; placeholder?: string;
  colors: any; keyboardType?: any;
}) {
  return (
    <View style={[styles.fieldRow, { borderBottomColor: colors.border.subtle }]}>
      <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </Text>
      {editable ? (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || ""}
          placeholderTextColor={colors.text.muted}
          keyboardType={keyboardType || "default"}
          style={{
            fontSize: fontSize.sm,
            color: colors.text.primary,
            paddingVertical: spacing[1],
            borderBottomWidth: 1,
            borderBottomColor: brand.blue + "50",
          }}
        />
      ) : (
        <Text style={{ fontSize: fontSize.sm, color: value ? colors.text.primary : colors.text.muted }}>
          {value || "—"}
        </Text>
      )}
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────
export default function StudentProfile() {
  const router           = useRouter();
  const { user }         = useAuth();
  const { tenant, slug } = useTenant();
  const { colors }       = useTheme();

  const [student,   setStudent]   = useState<any>(null);
  const [deptName,  setDeptName]  = useState("");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [uploading, setUploading] = useState(false);

  // Editable fields
  const [phone,   setPhone]   = useState("");
  const [address, setAddress] = useState("");

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useEffect(() => { if (db && user) load(); }, [db, user]);

  const load = async () => {
    if (!db || !user) return;
    const { data: s } = await db
      .from("students")
      .select(`
        id, first_name, last_name, other_names, matric_number, email,
        phone, address, gender, date_of_birth, state_of_origin,
        level, mode_of_entry, entry_session, current_session,
        gpa, cgpa, status, profile_photo, department_id
      `)
      .eq("supabase_uid", user.id)
      .maybeSingle();

    if (s) {
      setStudent(s);
      setPhone((s as any).phone || "");
      setAddress((s as any).address || "");

      if ((s as any).department_id) {
        const { data: dept } = await db.from("departments").select("name").eq("id", (s as any).department_id).maybeSingle();
        if (dept) setDeptName((dept as any).name);
      }
    }
    setLoading(false);
  };

  const pickAndUploadPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo access to upload a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { Alert.alert("Error", "Could not read image data."); return; }

    setUploading(true);
    try {
      const ext = asset.uri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : "image/jpeg";
      const dataUri = `data:${mime};base64,${asset.base64}`;

      if (!db || !student) return;
      const { error } = await db
        .from("students")
        .update({ profile_photo: dataUri } as any)
        .eq("id", student.id);

      if (error) { Alert.alert("Upload failed", error.message); return; }
      setStudent((prev: any) => ({ ...prev, profile_photo: dataUri }));
      Alert.alert("Success", "Profile photo updated!");
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!db || !student) return;
    setSaving(true);
    const { error } = await db
      .from("students")
      .update({ phone, address } as any)
      .eq("id", student.id);

    setSaving(false);
    if (error) { Alert.alert("Save failed", error.message); return; }
    Alert.alert("Saved", "Profile updated successfully.");
    setStudent((prev: any) => ({ ...prev, phone, address }));
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""}>
      <TopBar onBack={() => router.back()} onSave={saveProfile} saving={saving} />

      {loading ? (
        <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
      ) : (
        <KeyboardAvoidingView
          style={layout.fill}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={[layout.fill, { backgroundColor: colors.bg.primary }]}
            contentContainerStyle={{ paddingBottom: spacing[16] }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ── Avatar section ─── */}
            <View style={[styles.avatarSection, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
              <TouchableOpacity onPress={pickAndUploadPhoto} activeOpacity={0.8} disabled={uploading}>
                <View style={styles.avatarWrap}>
                  {student?.profile_photo ? (
                    <Image source={{ uri: student.profile_photo }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: brand.blueAlpha15, alignItems: "center", justifyContent: "center" }]}>
                      <Text style={{ fontSize: 36, fontWeight: fontWeight.black, color: brand.blue }}>
                        {(student?.first_name || "?")[0]}{(student?.last_name || "")[0]}
                      </Text>
                    </View>
                  )}
                  {/* Camera badge */}
                  <View style={[styles.cameraBadge, { backgroundColor: brand.blue }]}>
                    {uploading ? (
                      <Spinner size="sm" color="#fff" />
                    ) : (
                      <Icon name="action-camera" size="xs" color="#fff" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary, marginTop: spacing[3] }}>
                {student?.first_name} {student?.other_names ? student.other_names + " " : ""}{student?.last_name}
              </Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }}>
                {student?.matric_number}
              </Text>
              <View style={{ marginTop: spacing[2] }}>
                <Badge
                  label={student?.status?.charAt(0).toUpperCase() + (student?.status?.slice(1) || "")}
                  variant={student?.status === "active" ? "green" : "amber"}
                  size="sm"
                />
              </View>
            </View>

            {/* ── Academic info ─── */}
            <View style={[styles.section, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
              <Text style={sectionTitle(colors)}>Academic Information</Text>
              <FieldRow label="Department"      value={deptName}              colors={colors} />
              <FieldRow label="Level"           value={student?.level ? `${student.level} Level` : ""}  colors={colors} />
              <FieldRow label="Mode of Entry"   value={student?.mode_of_entry || ""} colors={colors} />
              <FieldRow label="Entry Session"   value={student?.entry_session || ""} colors={colors} />
              <FieldRow label="Current Session" value={student?.current_session || ""} colors={colors} />
              <FieldRow label="GPA"             value={student?.gpa ? student.gpa.toFixed(2) : "—"} colors={colors} />
              <FieldRow label="CGPA"            value={student?.cgpa ? student.cgpa.toFixed(2) : "—"} colors={colors} />
            </View>

            {/* ── Personal info ─── */}
            <View style={[styles.section, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
              <Text style={sectionTitle(colors)}>Personal Information</Text>
              <FieldRow label="Email"           value={student?.email || ""}         colors={colors} />
              <FieldRow label="Gender"          value={student?.gender || ""}        colors={colors} />
              <FieldRow label="Date of Birth"   value={student?.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-GB") : ""} colors={colors} />
              <FieldRow label="State of Origin" value={student?.state_of_origin || ""} colors={colors} />
            </View>

            {/* ── Editable fields ─── */}
            <View style={[styles.section, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
              <Text style={sectionTitle(colors)}>Contact Details</Text>
              <FieldRow
                label="Phone number" value={phone}
                editable onChangeText={setPhone}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                colors={colors}
              />
              <FieldRow
                label="Address" value={address}
                editable onChangeText={setAddress}
                placeholder="Enter home address"
                colors={colors}
              />
            </View>

            <Text variant="micro" color="muted" align="center" style={{ margin: spacing[4] }}>
              GMIS · DAMS Technologies
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </AppShell>
  );
}

function sectionTitle(colors: any) {
  return {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold as any,
    color: colors.text.muted as string,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: spacing[3],
  };
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, gap: spacing[3],
  },
  avatarSection: {
    alignItems: "center", paddingVertical: spacing[6],
    paddingHorizontal: spacing[4], borderBottomWidth: 1, marginBottom: spacing[3],
  },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
  },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  section: {
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[4],
  },
  fieldRow: {
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
