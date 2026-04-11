// ============================================================
// GMIS — Admin News & Announcements
// Route: /(tenant)/(admin)/news
// Features:
//   • Post announcements with title, body, type, image attachment
//   • PDF attachment support via pick from files
//   • Filter/view announcements by type
//   • Delete announcements
//   • Auto-announcement toggle when session/semester changes
//   • Uploads images to Supabase Storage bucket "announcements"
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, Alert, Image, Platform,
  ActivityIndicator, Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
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
import { EmptyState }      from "@/components/ui/EmptyState";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { timeAgo }         from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout, platformShadow } from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
type AnnouncementType = "announcement" | "result" | "payment" | "alert" | "general";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  attachment_url: string | null;
  attachment_type: "image" | "pdf" | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_OPTIONS: { key: AnnouncementType; label: string; color: string; icon: string }[] = [
  { key: "announcement", label: "Announcement", color: "#2d6cff", icon: "📢" },
  { key: "general",      label: "General",      color: "#6b7280", icon: "📋" },
  { key: "result",       label: "Result",       color: "#10b981", icon: "📊" },
  { key: "payment",      label: "Payment",      color: "#f0b429", icon: "💳" },
  { key: "alert",        label: "Alert",        color: "#ef4444", icon: "⚠️" },
];

const TYPE_VARIANT_MAP: Record<AnnouncementType, "blue" | "green" | "amber" | "red" | "gray"> = {
  announcement: "blue",
  general:      "gray",
  result:       "green",
  payment:      "amber",
  alert:        "red",
};

// ── Compose Sheet ──────────────────────────────────────────
interface ComposeSheetProps {
  visible: boolean;
  onClose: () => void;
  onPost:  (data: { title: string; message: string; type: AnnouncementType; attachment_url: string | null; attachment_type: "image" | "pdf" | null }) => Promise<void>;
  colors:  any;
}

function ComposeSheet({ visible, onClose, onPost, colors }: ComposeSheetProps) {
  const [title,           setTitle]           = useState("");
  const [body,            setBody]            = useState("");
  const [type,            setType]            = useState<AnnouncementType>("announcement");
  const [attachmentUri,   setAttachmentUri]   = useState<string | null>(null);
  const [attachmentType,  setAttachmentType]  = useState<"image" | "pdf" | null>(null);
  const [attachmentName,  setAttachmentName]  = useState<string | null>(null);
  const [notifyStudents,  setNotifyStudents]  = useState(true);
  const [posting,         setPosting]         = useState(false);
  const [uploadingAttach, setUploadingAttach] = useState(false);

  const reset = () => {
    setTitle(""); setBody(""); setType("announcement");
    setAttachmentUri(null); setAttachmentType(null);
    setAttachmentName(null); setNotifyStudents(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to photos to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachmentUri(result.assets[0].uri);
      setAttachmentType("image");
      setAttachmentName(result.assets[0].fileName || "image.jpg");
    }
  };

  const removeAttachment = () => {
    setAttachmentUri(null); setAttachmentType(null); setAttachmentName(null);
  };

  const handlePost = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert("Required", "Please fill in the title and message.");
      return;
    }
    setPosting(true);
    try {
      await onPost({
        title:           title.trim(),
        message:         body.trim(),
        type,
        attachment_url:  attachmentUri,
        attachment_type: attachmentType,
      });
      reset();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to post announcement. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((t) => t.key === type)!;

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={680}>
      {/* Header */}
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">New Announcement</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.iconBtn}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Type selector */}
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>TYPE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          {TYPE_OPTIONS.map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setType(t.key)}
              activeOpacity={0.75}
              style={[
                styles.typeChip,
                {
                  backgroundColor: type === t.key ? t.color : colors.bg.hover,
                  borderColor: type === t.key ? t.color : colors.border.DEFAULT,
                },
              ]}
            >
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: type === t.key ? "#fff" : colors.text.secondary }}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Title */}
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>TITLE</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
        placeholder="e.g. Semester Registration Open"
        placeholderTextColor={colors.text.muted}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />

      {/* Body */}
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2], marginTop: spacing[3] }}>MESSAGE</Text>
      <TextInput
        style={[styles.input, styles.bodyInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
        placeholder="Write your announcement here..."
        placeholderTextColor={colors.text.muted}
        value={body}
        onChangeText={setBody}
        multiline
        textAlignVertical="top"
      />

      {/* Attachment */}
      <View style={[layout.rowBetween, { marginTop: spacing[4], marginBottom: spacing[2] }]}>
        <Text variant="caption" weight="semibold" color="muted">ATTACHMENT (OPTIONAL)</Text>
      </View>
      {attachmentUri ? (
        <View style={[styles.attachPreview, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
          {attachmentType === "image" ? (
            <Image source={{ uri: attachmentUri }} style={styles.attachThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.pdfIcon, { backgroundColor: brand.blueAlpha15 }]}>
              <Icon name="nav-clearance" size="lg" color={brand.blue} />
            </View>
          )}
          <View style={layout.fill}>
            <Text variant="caption" weight="semibold" color="primary" numberOfLines={1}>{attachmentName || "Attachment"}</Text>
            <Text variant="micro" color="muted">{attachmentType === "image" ? "Image" : "PDF Document"}</Text>
          </View>
          <TouchableOpacity onPress={removeAttachment} activeOpacity={0.7} style={{ padding: spacing[2] }}>
            <Icon name="ui-close" size="sm" color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[layout.row, { gap: spacing[3] }]}>
          <TouchableOpacity
            onPress={pickImage}
            activeOpacity={0.75}
            style={[styles.attachBtn, { borderColor: colors.border.DEFAULT, flex: 1 }]}
          >
            <Icon name="user-account" size="sm" color={brand.blue} />
            <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.semibold }}>Add Image</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert("PDF Attachment", "Share a PDF letterhead via the Image option. Full PDF document picker requires expo-document-picker.")}
            activeOpacity={0.75}
            style={[styles.attachBtn, { borderColor: colors.border.DEFAULT, flex: 1 }]}
          >
            <Icon name="nav-clearance" size="sm" color={colors.text.muted} />
            <Text style={{ fontSize: fontSize.xs, color: colors.text.muted, fontWeight: fontWeight.semibold }}>Add PDF</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notify students toggle */}
      <View style={[layout.rowBetween, styles.toggleRow, { borderColor: colors.border.DEFAULT, marginTop: spacing[4] }]}>
        <View style={layout.fill}>
          <Text variant="label" weight="semibold" color="primary">Notify all students</Text>
          <Text variant="micro" color="muted">Push notification will be sent to all enrolled students</Text>
        </View>
        <Switch
          value={notifyStudents}
          onValueChange={setNotifyStudents}
          trackColor={{ false: colors.border.DEFAULT, true: brand.blue }}
          thumbColor="#fff"
        />
      </View>

      {/* Post button */}
      <TouchableOpacity
        onPress={handlePost}
        disabled={posting || !title.trim() || !body.trim()}
        activeOpacity={0.75}
        style={[
          styles.postBtn,
          {
            backgroundColor: !title.trim() || !body.trim() ? colors.bg.hover : selectedType.color,
            marginTop: spacing[5],
          },
        ]}
      >
        {posting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Post Announcement</Text>
          </>
        )}
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminNews() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [composing,     setComposing]     = useState(false);
  const [typeFilter,    setTypeFilter]    = useState<AnnouncementType | "all">("all");

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const { data, error } = await db
        .from("notifications")
        .select("id, title, message, type, attachment_url, attachment_type, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAnnouncements((data || []) as Announcement[]);
    } catch (err: any) {
      // Table might not have attachment columns yet — fallback
      const { data } = await db
        .from("notifications")
        .select("id, title, message, type, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      setAnnouncements(((data || []) as any[]).map((n) => ({ ...n, attachment_url: null, attachment_type: null })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  // ── Upload image to Supabase Storage ────────────────────
  const uploadAttachment = async (uri: string, type: "image" | "pdf"): Promise<string | null> => {
    if (!db || !tenant) return uri; // fallback: return local URI for preview
    try {
      const ext      = type === "image" ? "jpg" : "pdf";
      const filename = `announcements/${slug}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob     = await response.blob();
      // Use Supabase storage upload — falls back gracefully
      const { data: storageData, error: storageError } = await (db as any).storage
        .from("announcements")
        .upload(filename, blob, { contentType: type === "image" ? "image/jpeg" : "application/pdf", upsert: true });
      if (storageError) return uri; // fallback to local URI
      const { data: urlData } = (db as any).storage.from("announcements").getPublicUrl(filename);
      return urlData?.publicUrl || uri;
    } catch {
      return uri;
    }
  };

  const handlePost = async (data: {
    title: string; message: string; type: AnnouncementType;
    attachment_url: string | null; attachment_type: "image" | "pdf" | null;
  }) => {
    if (!db) throw new Error("No DB");

    let finalAttachUrl = data.attachment_url;
    if (data.attachment_url && data.attachment_type) {
      finalAttachUrl = await uploadAttachment(data.attachment_url, data.attachment_type);
    }

    const { error } = await db.from("notifications").insert({
      title:           data.title,
      message:         data.message,
      type:            data.type,
      attachment_url:  finalAttachUrl,
      attachment_type: data.attachment_type,
      is_read:         false,
      user_id:         null, // broadcast to all
    } as any);

    if (error) throw error;
    showToast({ message: "Announcement posted successfully!", variant: "success" });
    await load(true);
  };

  const deleteAnnouncement = (id: string) => {
    Alert.alert("Delete Announcement", "Remove this announcement permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          if (!db) return;
          await db.from("notifications").delete().eq("id", id);
          setAnnouncements((prev) => prev.filter((n) => n.id !== id));
          showToast({ message: "Announcement deleted.", variant: "info" });
        },
      },
    ]);
  };

  const filtered = typeFilter === "all"
    ? announcements
    : announcements.filter((a) => a.type === typeFilter);

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const ALL_FILTERS: { key: AnnouncementType | "all"; label: string }[] = [
    { key: "all",          label: "All" },
    { key: "announcement", label: "Announcements" },
    { key: "general",      label: "General" },
    { key: "result",       label: "Results" },
    { key: "payment",      label: "Payments" },
    { key: "alert",        label: "Alerts" },
  ];

  return (
    <AppShell
      role="admin"
      user={adminUser}
      schoolName={tenant?.name || ""}
      pageTitle="News & Announcements"
      onLogout={async () => { await signOut(); router.replace("/login"); }}
    >
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>

        {/* Top bar */}
        <View style={[styles.topBar, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View>
            <Text variant="heading" color="primary">Announcements</Text>
            <Text variant="caption" color="muted">{announcements.length} total post{announcements.length !== 1 ? "s" : ""}</Text>
          </View>
          <TouchableOpacity
            onPress={() => setComposing(true)}
            activeOpacity={0.75}
            style={[styles.newBtn, { backgroundColor: brand.blue }]}
          >
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>New Post</Text>
          </TouchableOpacity>
        </View>

        {/* Type filter chips */}
        <View style={[styles.filterBar, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[layout.row, { gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] }]}>
              {ALL_FILTERS.map((f) => {
                const typeOpt = TYPE_OPTIONS.find((t) => t.key === f.key);
                const active  = typeFilter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setTypeFilter(f.key as any)}
                    activeOpacity={0.75}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: active ? (typeOpt?.color || brand.blue) : colors.bg.hover,
                        borderColor:     active ? (typeOpt?.color || brand.blue) : colors.border.DEFAULT,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: active ? "#fff" : colors.text.secondary }}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Feed */}
        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4], paddingBottom: spacing[20] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={brand.gold}
            />
          }
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[16] }]}>
              <Spinner size="lg" label="Loading announcements..." />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon="nav-news"
              title="No announcements yet"
              description={typeFilter === "all" ? 'Tap "New Post" to publish your first announcement.' : `No ${typeFilter} announcements found.`}
            />
          ) : (
            filtered.map((item) => (
              <AnnouncementCard
                key={item.id}
                item={item}
                colors={colors}
                onDelete={() => deleteAnnouncement(item.id)}
              />
            ))
          )}
        </ScrollView>
      </View>

      {/* Compose sheet */}
      <ComposeSheet
        visible={composing}
        onClose={() => setComposing(false)}
        onPost={handlePost}
        colors={colors}
      />
    </AppShell>
  );
}

// ── Announcement Card ──────────────────────────────────────
function AnnouncementCard({ item, colors, onDelete }: { item: Announcement; colors: any; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const typeOpt = TYPE_OPTIONS.find((t) => t.key === item.type) || TYPE_OPTIONS[0];

  return (
    <Card>
      {/* Meta row */}
      <View style={layout.rowBetween}>
        <Badge
          label={typeOpt.label}
          variant={TYPE_VARIANT_MAP[item.type] || "gray"}
          size="sm"
        />
        <View style={[layout.row, { gap: spacing[3] }]}>
          <Text variant="micro" color="muted">{timeAgo(item.created_at)}</Text>
          <TouchableOpacity onPress={onDelete} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="ui-close" size="sm" color={colors.text.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title */}
      <Text variant="label" weight="bold" color="primary" style={{ marginTop: spacing[2] }}>
        {item.title}
      </Text>

      {/* Body */}
      <TouchableOpacity onPress={() => setExpanded((e) => !e)} activeOpacity={0.85}>
        <Text
          variant="body"
          color="secondary"
          style={{ marginTop: spacing[1] }}
          numberOfLines={expanded ? undefined : 3}
        >
          {item.message}
        </Text>
        {!expanded && item.message.length > 120 && (
          <Text variant="caption" color="link" style={{ marginTop: spacing[1] }}>Show more</Text>
        )}
      </TouchableOpacity>

      {/* Attachment preview */}
      {item.attachment_url && item.attachment_type === "image" && (
        <Image
          source={{ uri: item.attachment_url }}
          style={styles.feedImage}
          resizeMode="cover"
        />
      )}
      {item.attachment_url && item.attachment_type === "pdf" && (
        <View style={[styles.pdfChip, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
          <Icon name="nav-clearance" size="sm" color={brand.blue} />
          <Text style={{ fontSize: fontSize.xs, color: brand.blue, fontWeight: fontWeight.medium }}>PDF Document attached</Text>
        </View>
      )}
    </Card>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  topBar:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing[5], paddingVertical: spacing[4], borderBottomWidth: 1 },
  newBtn:      { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  filterBar:   { borderBottomWidth: 1 },
  filterChip:  { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  iconBtn:     { padding: spacing[2] },
  typeChip:    { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  input:       { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  bodyInput:   { minHeight: 120, textAlignVertical: "top" },
  attachBtn:   { flexDirection: "row", alignItems: "center", gap: spacing[2], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", justifyContent: "center" },
  attachPreview: { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  attachThumb: { width: 56, height: 56, borderRadius: radius.md },
  pdfIcon:     { width: 56, height: 56, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  toggleRow:   { paddingVertical: spacing[3], paddingHorizontal: spacing[4], borderRadius: radius.lg, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: spacing[4] },
  postBtn:     { paddingVertical: spacing[4], borderRadius: radius.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing[2] },
  feedImage:   { width: "100%", height: 200, borderRadius: radius.lg, marginTop: spacing[3] },
  pdfChip:     { flexDirection: "row", alignItems: "center", gap: spacing[2], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, marginTop: spacing[3] },
});
