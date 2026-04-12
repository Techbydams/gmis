// ============================================================
// GMIS — Admin Students List
// Route: /(tenant)/(admin)/students
//
// Features:
//   • Search by name, matric, email
//   • Filter by status and level
//   • Tap any student → full detail & edit page
//   • Add single student (force password reset on first login)
//   • Bulk import button → bulk-import screen
//   • Show profile picture if available
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo, useCallback } from "react";
import {
  View, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, Image, ActivityIndicator,
} from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useToast }        from "@/components/ui/Toast";
import { Text }            from "@/components/ui/Text";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { BottomSheet }     from "@/components/ui/BottomSheet";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { getInitials }     from "@/lib/helpers";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

// ── Types ──────────────────────────────────────────────────
interface Student {
  id: string; first_name: string; last_name: string;
  matric_number: string; email: string; level: string; status: string;
  gpa: number; department_id: string | null; dept_name?: string;
  profile_picture_url?: string | null;
}

type StatusFilter = "all" | "active" | "pending" | "suspended";

// ── Add Student Sheet ──────────────────────────────────────
function AddStudentSheet({ visible, onClose, depts, onSave, colors }: {
  visible: boolean; onClose: () => void;
  depts: { id: string; name: string }[];
  onSave: (data: any) => Promise<void>; colors: any;
}) {
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [matric,     setMatric]     = useState("");
  const [email,      setEmail]      = useState("");
  const [phone,      setPhone]      = useState("");
  const [level,      setLevel]      = useState("100");
  const [deptId,     setDeptId]     = useState("");
  const [saving,     setSaving]     = useState(false);

  const reset = () => { setFirstName(""); setLastName(""); setMatric(""); setEmail(""); setPhone(""); setLevel("100"); setDeptId(""); };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim() || !matric.trim() || !email.trim()) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        first_name: firstName.trim(), last_name: lastName.trim(),
        matric_number: matric.trim(), email: email.trim(),
        phone: phone.trim() || null, level,
        department_id: deptId || null,
        status: "pending", gpa: 0, force_password_reset: true,
      });
      reset(); onClose();
    } catch { } finally { setSaving(false); }
  };

  const LEVELS = ["100", "200", "300", "400", "500", "600"];

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

  return (
    <BottomSheet visible={visible} onClose={onClose} scrollable snapHeight={660}>
      <View style={[layout.rowBetween, { marginBottom: spacing[5] }]}>
        <Text variant="subtitle" weight="bold" color="primary">Add Student</Text>
        <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ padding: spacing[2] }}>
          <Icon name="ui-close" size="md" color={colors.text.muted} />
        </TouchableOpacity>
      </View>

      <View style={[styles.forceResetBanner, { backgroundColor: brand.blueAlpha10, borderColor: brand.blueAlpha30 }]}>
        <Icon name="auth-password" size="sm" color={brand.blue} />
        <Text variant="caption" color="primary" style={{ flex: 1 }}>
          Password will default to the matric number. Student must change it on first login.
        </Text>
      </View>

      <View style={[layout.row, { gap: spacing[3], marginTop: spacing[3] }]}>
        <View style={{ flex: 1 }}><F label="FIRST NAME *" value={firstName} onChangeText={setFirstName} placeholder="John" /></View>
        <View style={{ flex: 1 }}><F label="LAST NAME *"  value={lastName}  onChangeText={setLastName}  placeholder="Doe" /></View>
      </View>
      <F label="MATRIC NUMBER *" value={matric} onChangeText={setMatric} placeholder="MCS/2021/001" />
      <F label="EMAIL *" value={email} onChangeText={setEmail} placeholder="student@school.edu.ng" keyboard="email-address" />
      <F label="PHONE"   value={phone} onChangeText={setPhone} placeholder="+234 800 000 0000" keyboard="phone-pad" />

      {/* Level */}
      <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>LEVEL</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[3] }}>
        <View style={[layout.row, { gap: spacing[2] }]}>
          {LEVELS.map((l) => (
            <TouchableOpacity key={l} onPress={() => setLevel(l)} activeOpacity={0.75}
              style={[styles.chip, { backgroundColor: level === l ? brand.blue : colors.bg.hover, borderColor: level === l ? brand.blue : colors.border.DEFAULT }]}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: level === l ? "#fff" : colors.text.secondary }}>{l}L</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Department */}
      {depts.length > 0 && (
        <>
          <Text variant="caption" weight="semibold" color="muted" style={{ marginBottom: spacing[2] }}>DEPARTMENT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing[4] }}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              {[{ id: "", name: "None" }, ...depts].map((d) => (
                <TouchableOpacity key={d.id} onPress={() => setDeptId(d.id)} activeOpacity={0.75}
                  style={[styles.chip, { backgroundColor: deptId === d.id ? brand.blue : colors.bg.hover, borderColor: deptId === d.id ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: deptId === d.id ? "#fff" : colors.text.secondary }}>{d.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <TouchableOpacity
        onPress={handleSave}
        disabled={saving || !firstName.trim() || !matric.trim() || !email.trim()}
        activeOpacity={0.75}
        style={[styles.saveBtn, { backgroundColor: !firstName.trim() || !matric.trim() || !email.trim() ? colors.bg.hover : brand.blue }]}
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.md }}>Add Student</Text>
        }
      </TouchableOpacity>
    </BottomSheet>
  );
}

// ── Main Screen ────────────────────────────────────────────
export default function AdminStudents() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();
  const { showToast }      = useToast();

  const [students,    setStudents]    = useState<Student[]>([]);
  const [depts,       setDepts]       = useState<{ id: string; name: string }[]>([]);
  const [search,      setSearch]      = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [addSheet,    setAddSheet]    = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db) load(); }, [db], { hasData: students.length > 0 });

  const load = useCallback(async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    try {
      const [studentsRes, deptsRes] = await Promise.allSettled([
        db.from("students").select("id, first_name, last_name, matric_number, email, level, status, gpa, department_id, profile_picture_url").order("first_name"),
        db.from("departments").select("id, name").order("name"),
      ]);

      if (deptsRes.status === "fulfilled") setDepts((deptsRes.value.data || []) as any[]);

      if (studentsRes.status === "fulfilled" && studentsRes.value.data) {
        const allDepts = deptsRes.status === "fulfilled" ? (deptsRes.value.data || []) as any[] : [];
        const deptMap: Record<string, string> = {};
        allDepts.forEach((d: any) => { deptMap[d.id] = d.name; });
        setStudents((studentsRes.value.data as any[]).map((s) => ({
          ...s,
          dept_name: s.department_id ? deptMap[s.department_id] || "" : "",
        })));
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, [db]);

  const handleAddStudent = async (data: any) => {
    if (!db) throw new Error("No DB");
    const { error } = await db.from("students").insert(data);
    if (error) throw error;
    showToast({ message: "Student added. They must change password on first login.", variant: "success" });
    await load(true);
  };

  const filtered = students.filter((s) => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${s.first_name} ${s.last_name} ${s.matric_number} ${s.email}`.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (levelFilter !== "all" && s.level !== levelFilter) return false;
    return true;
  });

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "active", label: "Active" },
    { key: "pending", label: "Pending" }, { key: "suspended", label: "Suspended" },
  ];
  const LEVEL_FILTERS = ["all", "100", "200", "300", "400", "500", "600"];

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Students"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>

        {/* Search + action bar */}
        <View style={[styles.searchWrap, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
            <Icon name="ui-search" size="md" color={colors.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: fontSize.md, color: colors.text.primary }}
              placeholder="Search name, matric, email..."
              placeholderTextColor={colors.text.muted}
              value={search} onChangeText={setSearch}
            />
            {search ? <TouchableOpacity onPress={() => setSearch("")}><Icon name="ui-close" size="sm" color={colors.text.muted} /></TouchableOpacity> : null}
          </View>
          <View style={[layout.row, { gap: spacing[2] }]}>
            <TouchableOpacity
              onPress={() => setAddSheet(true)}
              activeOpacity={0.75}
              style={[styles.iconActionBtn, { backgroundColor: brand.blue }]}
            >
              <Icon name="ui-add" size="sm" color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tenant)/(admin)/bulk-import" as any)}
              activeOpacity={0.75}
              style={[styles.iconActionBtn, { backgroundColor: colors.bg.hover, borderColor: colors.border.DEFAULT, borderWidth: 1 }]}
            >
              <Icon name="nav-academic" size="sm" color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[{ backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT, borderBottomWidth: 1 }]}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingVertical: spacing[3], gap: spacing[2] }}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity key={f.key} onPress={() => setStatusFilter(f.key)} activeOpacity={0.75}
              style={[styles.filterChip, { backgroundColor: statusFilter === f.key ? brand.blue : colors.bg.hover, borderColor: statusFilter === f.key ? brand.blue : colors.border.DEFAULT }]}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: statusFilter === f.key ? "#fff" : colors.text.secondary }}>{f.label}</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.divider, { backgroundColor: colors.border.DEFAULT }]} />
          {LEVEL_FILTERS.map((l) => (
            <TouchableOpacity key={l} onPress={() => setLevelFilter(l)} activeOpacity={0.75}
              style={[styles.filterChip, { backgroundColor: levelFilter === l ? brand.indigo : colors.bg.hover, borderColor: levelFilter === l ? brand.indigo : colors.border.DEFAULT }]}>
              <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: levelFilter === l ? "#fff" : colors.text.secondary }}>{l === "all" ? "All Levels" : `${l}L`}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Student list */}
        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[3], paddingBottom: spacing[20] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[16] }]}><Spinner size="lg" label="Loading students..." /></View>
          ) : filtered.length === 0 ? (
            <EmptyState icon="user-student" title="No students found"
              description={search ? `No results for "${search}"` : "No students match the selected filter."} />
          ) : (
            <>
              {filtered.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  activeOpacity={0.75}
                  onPress={() => router.push(`/(tenant)/(admin)/students/${s.id}` as any)}
                  style={[styles.studentRow, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}
                >
                  {/* Avatar */}
                  {s.profile_picture_url ? (
                    <Image source={{ uri: s.profile_picture_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: brand.goldAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.black, color: brand.gold }}>
                        {getInitials(`${s.first_name} ${s.last_name}`)}
                      </Text>
                    </View>
                  )}
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                    <Text variant="micro" color="muted">{s.matric_number} · {s.dept_name || "No dept"} · {s.level}L</Text>
                  </View>
                  <View style={[layout.row, { gap: spacing[2] }]}>
                    <Badge
                      label={s.status}
                      variant={s.status === "active" ? "green" : s.status === "pending" ? "amber" : "red"}
                      size="sm"
                    />
                    <Icon name="ui-forward" size="sm" color={colors.text.muted} />
                  </View>
                </TouchableOpacity>
              ))}
              <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[2] }}>
                {filtered.length} student{filtered.length !== 1 ? "s" : ""} shown
              </Text>
            </>
          )}
        </ScrollView>
      </View>

      {/* Add student sheet */}
      <AddStudentSheet
        visible={addSheet}
        onClose={() => setAddSheet(false)}
        depts={depts}
        onSave={handleAddStudent}
        colors={colors}
      />
    </AppShell>
  );
}

// ── Styles ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  searchWrap:     { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[4], borderBottomWidth: 1 },
  searchBar:      { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1, flex: 1 },
  iconActionBtn:  { width: 40, height: 40, borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
  filterChip:     { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  divider:        { width: 1, marginHorizontal: spacing[1] },
  studentRow:     { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  avatar:         { width: 44, height: 44, borderRadius: radius.full },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  forceResetBanner: { flexDirection: "row", alignItems: "flex-start", gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1 },
  input:          { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md },
  chip:           { paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.full, borderWidth: 1 },
  saveBtn:        { paddingVertical: spacing[4], borderRadius: radius.xl, alignItems: "center", justifyContent: "center" },
});
