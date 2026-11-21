/* Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â·
   GMIS Â· A product of DAMS Technologies Â· gmis.app
   Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· Â· */

import { useState, useMemo, useRef, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, Platform, TextInput,
} from "react-native";
import { useRouter }        from "expo-router";
import { useAuth }          from "@/context/AuthContext";
import { useTenant }        from "@/context/TenantContext";
import { getTenantClient }  from "@/lib/supabase";
import { useAutoLoad }      from "@/lib/useAutoLoad";
import { Text }             from "@/components/ui/Text";
import { Card }             from "@/components/ui/Card";
import { Badge }            from "@/components/ui/Badge";
import { Icon }             from "@/components/ui/Icon";
import { Button }           from "@/components/ui/Button";
import { EmptyState }       from "@/components/ui/EmptyState";
import { Spinner }          from "@/components/ui/Spinner";
import { AppShell }         from "@/components/layout";
import { useTheme }         from "@/context/ThemeContext";
import { useResponsive }    from "@/lib/responsive";
import { useToast }         from "@/components/ui/Toast";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }           from "@/styles/shared";

interface Course    { id: string; course_code: string; course_name: string }
interface Handout   { id: string; course_id: string; title: string; file_name: string; file_url: string; file_size: number; created_at: string }

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function LecturerHandouts() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();
  const { showToast }     = useToast();
  const fileInputRef      = useRef<HTMLInputElement>(null as any);

  const [lecturer,    setLecturer]    = useState<any>(null);
  const [courses,     setCourses]     = useState<Course[]>([]);
  const [handouts,    setHandouts]    = useState<Handout[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [uploading,   setUploading]   = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [showUpload,  setShowUpload]  = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCourse, setUploadCourse] = useState<string>("");
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number; webFile?: File } | null>(null);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: handouts.length > 0 });

  const load = useCallback(async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);

    const { data: lec } = await db.from("lecturers").select("id, full_name, staff_id").eq("supabase_uid", user.id).maybeSingle();
    if (lec) {
      setLecturer(lec);
      const [{ data: cData }, { data: hData }] = await Promise.all([
        db.from("courses").select("id, course_code, course_name").eq("lecturer_id", lec.id).order("course_code"),
        db.from("course_materials").select("id, course_id, title, file_name, file_url, file_size, created_at").eq("lecturer_id", lec.id).order("created_at", { ascending: false }),
      ]);
      if (cData) setCourses(cData as Course[]);
      if (hData) setHandouts(hData as Handout[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [db, user]);

  const handleFileChange = (e: any) => {
    const f: File = e.target?.files?.[0];
    if (!f) return;
    setPendingFile({ name: f.name, size: f.size, webFile: f });
  };

  const uploadHandout = async () => {
    if (!pendingFile || !uploadTitle.trim() || !uploadCourse || !db || !lecturer) return;
    setUploading(true);
    try {
      let fileUrl = "";
      if (Platform.OS === "web" && pendingFile.webFile) {
        const path = `handouts/${slug}/${uploadCourse}/${Date.now()}-${pendingFile.name}`;
        const { data, error } = await (db as any).storage.from("course-materials").upload(path, pendingFile.webFile, { upsert: false });
        if (error) throw new Error(error.message);
        const { data: urlData } = (db as any).storage.from("course-materials").getPublicUrl(data.path);
        fileUrl = urlData?.publicUrl || "";
      }

      const { error } = await db.from("course_materials").insert({
        course_id:   uploadCourse,
        lecturer_id: lecturer.id,
        title:       uploadTitle.trim(),
        file_name:   pendingFile.name,
        file_url:    fileUrl,
        file_size:   pendingFile.size,
      } as any);

      if (error) throw new Error(error.message);
      showToast({ message: "Handout uploaded successfully!", variant: "success" });
      setShowUpload(false);
      setUploadTitle("");
      setUploadCourse("");
      setPendingFile(null);
      load(true);
    } catch (err: any) {
      showToast({ message: err.message || "Upload failed", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const filtered = selectedCourse === "all"
    ? handouts
    : handouts.filter((h) => h.course_id === selectedCourse);

  const courseOf = (id: string) => courses.find((c) => c.id === id);

  const shellUser = {
    name: lecturer?.full_name || user?.email || "Lecturer",
    role: "lecturer" as const,
    sub:  lecturer?.staff_id,
  };

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Handouts"
      onLogout={async () => { await signOut(); router.replace("/(tenant)/login"); }}>

      {/* Hidden web file picker */}
      {Platform.OS === "web" && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
          style={{ display: "none" } as any}
          onChange={handleFileChange}
        />
      )}

      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
      >
        {/* Header row */}
        <View style={[layout.rowBetween, { alignItems: "flex-start" }]}>
          <View>
            <Text variant="heading" color="primary">Handouts</Text>
            <Text variant="caption" color="muted">Course materials for your students</Text>
          </View>
          {Platform.OS === "web" && (
            <Button label="+ Upload" variant="primary" size="sm" onPress={() => setShowUpload((v) => !v)} />
          )}
        </View>

        {/* Upload form */}
        {showUpload && (
          <Card style={{ gap: spacing[3] }}>
            <Text variant="label" weight="bold" color="primary">Upload handout</Text>

            {/* Course picker */}
            <View style={{ gap: spacing[1] }}>
              <Text variant="caption" color="secondary" weight="medium">Course *</Text>
              <View style={[layout.row, { flexWrap: "wrap", gap: spacing[2] }]}>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setUploadCourse(c.id)}
                    activeOpacity={0.75}
                    style={[styles.courseChip, { borderColor: uploadCourse === c.id ? brand.blue : colors.border.DEFAULT, backgroundColor: uploadCourse === c.id ? brand.blueAlpha10 : colors.bg.hover }]}
                  >
                    <Text style={{ fontSize: fontSize.xs, color: uploadCourse === c.id ? brand.blue : colors.text.secondary, fontWeight: uploadCourse === c.id ? fontWeight.bold : fontWeight.normal }}>
                      {c.course_code}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Title */}
            <View style={{ gap: spacing[1] }}>
              <Text variant="caption" color="secondary" weight="medium">Title *</Text>
              <TextInput
                value={uploadTitle}
                onChangeText={setUploadTitle}
                placeholder="e.g. Week 3 Lecture Notes"
                placeholderTextColor={colors.text.muted}
                style={[styles.input, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
              />
            </View>

            {/* File picker */}
            <TouchableOpacity
              onPress={() => { if (fileInputRef.current) fileInputRef.current.click(); }}
              activeOpacity={0.8}
              style={[styles.fileBox, { borderColor: pendingFile ? brand.blue : colors.border.DEFAULT, backgroundColor: pendingFile ? brand.blueAlpha10 : colors.bg.card }]}
            >
              {pendingFile ? (
                <View style={[layout.row, { gap: spacing[3] }]}>
                  <Icon name="content-file" size="lg" color={brand.blue} />
                  <View style={layout.fill}>
                    <Text variant="label" color="primary" weight="semibold" numberOfLines={1}>{pendingFile.name}</Text>
                    <Text variant="micro" color="muted">{fmtSize(pendingFile.size)}</Text>
                  </View>
                  <Icon name="status-success" size="sm" color={colors.status.success} filled />
                </View>
              ) : (
                <View style={[layout.row, { gap: spacing[3] }]}>
                  <Icon name="action-upload" size="lg" color={colors.text.muted} />
                  <View>
                    <Text variant="label" color="secondary">Tap to select file</Text>
                    <Text variant="micro" color="muted">PDF, DOC, PPT, JPG Â· max 20 MB</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            <View style={[layout.row, { gap: spacing[3] }]}>
              <Button label="Cancel" variant="ghost" size="sm" onPress={() => { setShowUpload(false); setPendingFile(null); setUploadTitle(""); setUploadCourse(""); }} />
              <Button
                label={uploading ? "Uploadingâ€¦" : "Upload"}
                variant="primary"
                size="sm"
                loading={uploading}
                onPress={uploadHandout}
                style={layout.fill}
              />
            </View>
          </Card>
        )}

        {/* Course filter tabs */}
        {courses.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[2] }}>
            <TouchableOpacity
              onPress={() => setSelectedCourse("all")}
              activeOpacity={0.75}
              style={[styles.filterTab, { borderColor: selectedCourse === "all" ? brand.blue : colors.border.DEFAULT, backgroundColor: selectedCourse === "all" ? brand.blueAlpha10 : colors.bg.card }]}
            >
              <Text style={{ fontSize: fontSize.sm, color: selectedCourse === "all" ? brand.blue : colors.text.secondary, fontWeight: selectedCourse === "all" ? fontWeight.semibold : fontWeight.normal }}>
                All ({handouts.length})
              </Text>
            </TouchableOpacity>
            {courses.map((c) => {
              const count   = handouts.filter((h) => h.course_id === c.id).length;
              const active  = selectedCourse === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCourse(c.id)}
                  activeOpacity={0.75}
                  style={[styles.filterTab, { borderColor: active ? brand.blue : colors.border.DEFAULT, backgroundColor: active ? brand.blueAlpha10 : colors.bg.card }]}
                >
                  <Text style={{ fontSize: fontSize.sm, color: active ? brand.blue : colors.text.secondary, fontWeight: active ? fontWeight.semibold : fontWeight.normal }}>
                    {c.course_code} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Content */}
        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
            <Spinner size="lg" label="Loading handouts..." />
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="nav-handouts"
            title="No handouts yet"
            description={selectedCourse === "all" ? "Upload course materials to share with your students." : "No handouts uploaded for this course yet."}
          />
        ) : (
          filtered.map((h) => {
            const course = courseOf(h.course_id);
            const date   = new Date(h.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
            const ext    = h.file_name.split(".").pop()?.toUpperCase() || "FILE";
            return (
              <TouchableOpacity
                key={h.id}
                activeOpacity={0.75}
                onPress={() => { if (h.file_url && Platform.OS === "web") window.open(h.file_url, "_blank"); }}
                style={[styles.handoutRow, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
              >
                <View style={[styles.extBox, { backgroundColor: brand.blueAlpha15 }]}>
                  <Text style={{ fontSize: fontSize["2xs"], fontWeight: fontWeight.black, color: brand.blue }}>{ext}</Text>
                </View>
                <View style={layout.fill}>
                  <Text variant="label" weight="semibold" color="primary" numberOfLines={1}>{h.title}</Text>
                  <Text variant="micro" color="muted" numberOfLines={1}>{h.file_name}</Text>
                  <View style={[layout.row, { gap: spacing[3], marginTop: spacing[1] }]}>
                    {course && <Badge label={course.course_code} variant="blue" size="sm" />}
                    <Text variant="micro" color="muted">{fmtSize(h.file_size)} Â· {date}</Text>
                  </View>
                </View>
                {h.file_url && Platform.OS === "web" && (
                  <Icon name="action-download" size="sm" color={colors.text.muted} />
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  filterTab:   { paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  courseChip:  { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.xl, borderWidth: 1 },
  handoutRow:  { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  extBox:      { width: 48, height: 48, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  fileBox:     { borderWidth: 1.5, borderRadius: radius.xl, borderStyle: "dashed", padding: spacing[4] },
  input:       { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing[4], height: 44, fontSize: fontSize.base },
});
