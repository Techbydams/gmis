/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useMemo, useCallback } from "react";
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { StatCard }        from "@/components/ui/StatCard";
import { Icon }            from "@/components/ui/Icon";
import { EmptyState }      from "@/components/ui/EmptyState";
import { Spinner }         from "@/components/ui/Spinner";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { useAutoLoad }     from "@/lib/useAutoLoad";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function LecturerStudents() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [lecturer,   setLecturer]   = useState<any>(null);
  const [students,   setStudents]   = useState<any[]>([]);
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: students.length > 0 });

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);

    const { data: lec } = await db.from("lecturers").select("id, full_name, staff_id").eq("supabase_uid", user.id).maybeSingle();
    if (!lec) { setLoading(false); return; }
    setLecturer(lec);

    // Get courses for this lecturer
    const { data: courses } = await db.from("courses").select("id").eq("lecturer_id", (lec as any).id).eq("is_active", true);
    if (!courses?.length) { setLoading(false); setRefreshing(false); return; }

    // Get enrolled students
    const courseIds = (courses as any[]).map((c) => c.id);
    const { data: regs } = await db
      .from("semester_registrations")
      .select("student_id, course_id, courses(course_code), students(id, first_name, last_name, matric_number, level)")
      .in("course_id", courseIds)
      .eq("status", "registered");

    if (regs) {
      // De-duplicate by student_id
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const r of regs as any[]) {
        if (!seen.has(r.student_id)) {
          seen.add(r.student_id);
          unique.push(r.students);
        }
      }
      setStudents(unique.filter(Boolean));
    }
    setLoading(false);
    setRefreshing(false);
  };

  const filtered = students.filter((s) =>
    !search || `${s.first_name} ${s.last_name} ${s.matric_number}`.toLowerCase().includes(search.toLowerCase())
  );

  const shellUser = { name: lecturer?.full_name || user?.email || "Lecturer", role: "lecturer" as const, sub: lecturer?.staff_id };

  return (
    <AppShell role="lecturer" user={shellUser} schoolName={tenant?.name || ""} pageTitle="My Students"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <View style={[layout.fill, { backgroundColor: colors.bg.primary }]}>
        <View style={[styles.searchWrap, { backgroundColor: colors.bg.card, borderBottomColor: colors.border.DEFAULT }]}>
          <View style={[styles.searchBar, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
            <Icon name="ui-search" size="md" color={colors.text.muted} />
            <TextInput
              style={{ flex: 1, fontSize: fontSize.md, color: colors.text.primary }}
              placeholder="Search students…"
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>
        </View>

        <ScrollView
          style={layout.fill}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[3] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.blue} />}
        >
          {loading ? (
            <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading students..." /></View>
          ) : (
            <>
              <StatCard icon="user-student" label="Enrolled students" value={String(students.length)} color="brand" />
              {filtered.length === 0 ? (
                <EmptyState icon="user-student" title="No students found" description="No students enrolled in your courses yet." />
              ) : (
                filtered.map((s) => (
                  <View key={s.id} style={[styles.row, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }]}>
                    <View style={[styles.avatar, { backgroundColor: brand.blueAlpha15 }]}>
                      <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.black, color: brand.blue }}>{s.first_name?.[0]}{s.last_name?.[0]}</Text>
                    </View>
                    <View style={layout.fill}>
                      <Text variant="label" weight="semibold" color="primary">{s.first_name} {s.last_name}</Text>
                      <Text variant="micro" color="muted">{s.matric_number} · {s.level} Level</Text>
                    </View>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  searchWrap: { padding: spacing[4], borderBottomWidth: 1 },
  searchBar:  { flexDirection: "row", alignItems: "center", gap: spacing[3], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, borderWidth: 1 },
  row:        { flexDirection: "row", alignItems: "center", gap: spacing[4], padding: spacing[4], borderRadius: radius.xl, borderWidth: 1 },
  avatar:     { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
