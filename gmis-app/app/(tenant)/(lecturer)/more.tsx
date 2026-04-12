// ============================================================
// GMIS — Lecturer More Menu
// Route: /(tenant)/(lecturer)/more
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter }     from "expo-router";
import { useAuth }       from "@/context/AuthContext";
import { useTenant }     from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }      from "@/components/ui/Toast";
import { useAutoLoad }   from "@/lib/useAutoLoad";
import { Text }          from "@/components/ui/Text";
import { Card }          from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell }      from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }        from "@/styles/shared";
import { getInitials }   from "@/lib/helpers";

const MORE_ITEMS: { label: string; icon: IconName; href: string; description: string }[] = [
  { label: "My Courses",    icon: "nav-courses",    href: "/(tenant)/(lecturer)/courses",    description: "View your assigned courses"         },
  { label: "Upload Results",icon: "action-upload",  href: "/(tenant)/(lecturer)/results",    description: "Enter and submit student grades"    },
  { label: "QR Attendance", icon: "nav-attendance", href: "/(tenant)/(lecturer)/attendance", description: "Take attendance manually or by QR"  },
  { label: "Student List",  icon: "nav-students",   href: "/(tenant)/(lecturer)/students",   description: "View enrolled students"             },
  { label: "Timetable",     icon: "nav-timetable",  href: "/(tenant)/(lecturer)/timetable",  description: "View your teaching schedule"        },
];

export default function LecturerMore() {
  const router              = useRouter();
  const { user, signOut }   = useAuth();
  const { tenant, slug }    = useTenant();
  const { colors }          = useTheme();
  const { showToast }       = useToast();

  const [lecturer,     setLecturer]     = useState<any>(null);
  const [uploadingPic, setUploadingPic] = useState(false);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useAutoLoad(() => { if (db && user) loadProfile(); }, [db, user], { hasData: !!lecturer });

  const loadProfile = async () => {
    if (!db || !user) return;
    const { data } = await db
      .from("lecturers")
      .select("id, full_name, email, staff_id, profile_picture_url")
      .eq("supabase_uid", user.id)
      .maybeSingle();
    if (data) setLecturer(data);
  };

  const pickAndUploadProfilePicture = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to upload a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (result.canceled || !result.assets[0] || !db || !lecturer) return;
    setUploadingPic(true);
    try {
      const uri      = result.assets[0].uri;
      const filename = `profiles/lecturers/${slug}/${lecturer.id}.jpg`;
      const response = await fetch(uri);
      const blob     = await response.blob();
      const { error: upErr } = await (db as any).storage
        .from("avatars").upload(filename, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = (db as any).storage.from("avatars").getPublicUrl(filename);
      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) throw new Error("Could not get public URL");
      await db.from("lecturers").update({ profile_picture_url: publicUrl } as any).eq("id", lecturer.id);
      setLecturer((prev: any) => ({ ...prev, profile_picture_url: publicUrl }));
      showToast({ message: "Profile picture updated!", variant: "success" });
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "Ensure the 'avatars' storage bucket exists in Supabase.");
    } finally {
      setUploadingPic(false);
    }
  };

  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const };

  return (
    <AppShell
      role="lecturer"
      user={shellUser}
      schoolName={tenant?.name || ""}
      pageTitle="More"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="heading" color="primary" style={{ marginBottom: spacing[1] }}>More</Text>
        <Text variant="caption" color="muted" style={{ marginBottom: spacing[4] }}>All features at your fingertips</Text>

        {/* Profile card */}
        <Card style={{ marginBottom: spacing[1] }}>
          <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>My Profile</Text>
          <View style={[layout.row, { gap: spacing[4], alignItems: "center" }]}>
            <TouchableOpacity onPress={pickAndUploadProfilePicture} activeOpacity={0.8} disabled={uploadingPic}>
              {uploadingPic ? (
                <View style={[styles.avatarLg, { backgroundColor: colors.bg.hover, alignItems: "center", justifyContent: "center" }]}>
                  <ActivityIndicator color={brand.blue} />
                </View>
              ) : lecturer?.profile_picture_url ? (
                <Image source={{ uri: lecturer.profile_picture_url }} style={styles.avatarLg} />
              ) : (
                <View style={[styles.avatarLg, { backgroundColor: brand.blueAlpha15, alignItems: "center", justifyContent: "center" }]}>
                  <Text style={{ fontSize: fontSize["2xl"], fontWeight: fontWeight.black, color: brand.blue }}>
                    {getInitials(lecturer?.full_name || "L")}
                  </Text>
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: brand.blue }]}>
                <Icon name="action-camera" size="xs" color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={layout.fill}>
              <Text variant="label" weight="bold" color="primary">{lecturer?.full_name || "Lecturer"}</Text>
              <Text variant="micro" color="muted">{lecturer?.staff_id ? `Staff ID: ${lecturer.staff_id}` : lecturer?.email || user?.email}</Text>
              <Text variant="micro" color="link" style={{ marginTop: spacing[1] }}>Tap photo to change</Text>
            </View>
          </View>
        </Card>

        {MORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.href}
            onPress={() => router.push(item.href as any)}
            activeOpacity={0.75}
            style={[styles.row, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
          >
            <View style={[styles.iconBox, { backgroundColor: brand.blueAlpha10 }]}>
              <Icon name={item.icon} size="md" color={brand.blue} />
            </View>
            <View style={layout.fill}>
              <Text variant="label" weight="semibold" color="primary">{item.label}</Text>
              <Text variant="caption" color="muted">{item.description}</Text>
            </View>
            <Icon name="ui-forward" size="sm" color={colors.text.muted} />
          </TouchableOpacity>
        ))}

        {/* Logout */}
        <TouchableOpacity
          onPress={async () => { await signOut(); router.replace("/login"); }}
          activeOpacity={0.75}
          style={[styles.row, { backgroundColor: colors.status.errorBg, borderColor: colors.status.errorBorder, marginTop: spacing[4] }]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.status.errorBg }]}>
            <Icon name="auth-logout" size="md" color={colors.status.error} />
          </View>
          <Text variant="label" weight="semibold" color="error">Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content:    { padding: spacing[5], gap: spacing[3] },
  row:        { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  iconBox:    { width: spacing[10], height: spacing[10], borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  avatarLg:   { width: 72, height: 72, borderRadius: radius.full },
  editBadge:  { position: "absolute", bottom: 0, right: 0, width: 22, height: 22, borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
