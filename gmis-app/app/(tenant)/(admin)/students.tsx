/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

interface Student {
  id: string; first_name: string; last_name: string;
  matric_number: string; email: string; level: string; status: string;
  gpa: number; department_id: string | null; dept_name?: string;
}

export default function AdminStudents() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [students,   setStudents]   = useState<Student[]>([]);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<"all" | "active" | "pending" | "suspended">("all");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    const { data } = await db
      .from("students")
      .select("id, first_name, last_name, matric_number, email, level, status, gpa, department_id")
      .order("first_name");

    if (data) {
      const deptIds = [...new Set((data as any[]).map((s) => s.department_id).filter(Boolean))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length) {
        const { data: depts } = await db.from("departments").select("id, name").in("id", deptIds);
        (depts || []).forEach((d: any) => { deptMap[d.id] = d.name; });
      }
      setStudents((data as any[]).map((s) => ({ ...s, dept_name: s.department_id ? deptMap[s.department_id] || "" : "" })));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const filtered = students.filter((s) => {
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.matric_number}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || s.status === filter;
    return matchSearch && matchFilter;
  });

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: "all",       label: "All" },
    { key: "active",    label: "Active" },
    { key: "pending",   label: "Pending" },
    { key: "suspended", label: "Suspended" },
  ];

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="Students"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>
        {/* Search bar */}
        <View style={[styles.searchWrap, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
            <Icon name="ui-search" size="md" color={colors.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: fontSize.md, color: colors.text.primary }}
              placeholder="Search by name or matric no."
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[layout.row, { gap: spacing[2] }]}>
              {FILTERS.map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setFilter(f.key)} activeOpacity={0.75}
                  style={[styles.filterChip, { backgroundColor: filter === f.key ? brand.blue : colors.bg.hover, borderColor: filter === f.key ? brand.blue : colors.border.DEFAULT }]}>
                  <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: filter === f.key ? "#fff" : colors.text.secondary }}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[3] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[12] }]}>
              <Spinner size="lg" label="Loading students..." />
            </View>
          ) : filtered.length === 0 ? (
            <EmptyState icon="user-student" title="No students found" description={search ? `No results for "${search}"` : "No students match the selected filter."} />
          ) : (
            filtered.map((s) => (
              <TouchableOpacity key={s.id} activeOpacity={0.75}
                style={[styles.studentRow, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
                <View style={[styles.avatar, { backgroundColor: brand.goldAlpha15 }]}>
                  <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: brand.gold }}>{s.first_name[0]}{s.last_name[0]}</Text>
                </View>
                <View style={layout.fill}>
                  <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                  <Text variant="micro" color="muted">{s.matric_number} · {s.dept_name || "No dept"} · {s.level} Level</Text>
                </View>
                <Badge
                  label={s.status}
                  variant={s.status === "active" ? "green" : s.status === "pending" ? "amber" : "red"}
                  size="sm"
                />
              </TouchableOpacity>
            ))
          )}
          <Text variant="micro" color="muted" align="center" style={{ marginTop: spacing[2] }}>
            {filtered.length} student{filtered.length !== 1 ? "s" : ""} shown
          </Text>
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: spacing[4], gap: spacing[3], borderBottomWidth: 1 },
  searchBar:  { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  filterChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full, borderWidth: 1 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  avatar:     { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
