/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from "react-native";
import { useRouter }       from "expo-router";
import { useAuth }         from "@/context/AuthContext";
import { useTenant }       from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { Text }            from "@/components/ui/Text";
import { Card }            from "@/components/ui/Card";
import { Badge }           from "@/components/ui/Badge";
import { Icon }            from "@/components/ui/Icon";
import { Spinner }         from "@/components/ui/Spinner";
import { EmptyState }      from "@/components/ui/EmptyState";
import { AppShell }        from "@/components/layout";
import { useTheme }        from "@/context/ThemeContext";
import { useResponsive }   from "@/lib/responsive";
import { timeAgo }         from "@/lib/helpers";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout }          from "@/styles/shared";

export default function AdminNews() {
  const router             = useRouter();
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { pagePadding }    = useResponsive();

  const [news,       setNews]       = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composing,  setComposing]  = useState(false);
  const [title,      setTitle]      = useState("");
  const [body,       setBody]       = useState("");
  const [posting,    setPosting]    = useState(false);

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db) load(); }, [db]);

  const load = async (isRefresh = false) => {
    if (!db) return;
    if (!isRefresh) setLoading(true);
    const { data } = await db.from("notifications").select("id, title, message, type, created_at, is_read").order("created_at", { ascending: false }).limit(30);
    if (data) setNews(data as any[]);
    setLoading(false);
    setRefreshing(false);
  };

  const post = async () => {
    if (!db || !title.trim() || !body.trim()) return;
    setPosting(true);
    await db.from("notifications").insert({ title: title.trim(), message: body.trim(), type: "announcement", is_read: false, user_id: null } as any);
    setTitle("");
    setBody("");
    setComposing(false);
    setPosting(false);
    load(true);
  };

  const adminUser = { name: user?.email || "Admin", role: "admin" as const };

  return (
    <AppShell role="admin" user={adminUser} schoolName={tenant?.name || ""} pageTitle="News & Announcements"
      onLogout={async () => { await signOut(); router.replace("/login"); }}>
      <ScrollView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={brand.gold} />}
      >
        <View style={layout.rowBetween}>
          <Text variant="heading" color="primary">News & Announcements</Text>
          <TouchableOpacity onPress={() => setComposing((c) => !c)} activeOpacity={0.75}
            style={[styles.composeBtn, { backgroundColor: brand.blue }]}>
            <Icon name="ui-add" size="sm" color="#fff" />
            <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>New</Text>
          </TouchableOpacity>
        </View>

        {composing && (
          <Card>
            <Text variant="label" weight="bold" color="primary" style={{ marginBottom: spacing[3] }}>New announcement</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
              placeholder="Title"
              placeholderTextColor={colors.text.muted}
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.textInput, styles.bodyInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
              placeholder="Write your announcement..."
              placeholderTextColor={colors.text.muted}
              value={body}
              onChangeText={setBody}
              multiline
            />
            <View style={[layout.row, { gap: spacing[3], marginTop: spacing[2] }]}>
              <TouchableOpacity onPress={() => setComposing(false)} activeOpacity={0.75} style={[styles.btn, { borderColor: colors.border.DEFAULT, flex: 1 }]}>
                <Text style={{ color: colors.text.secondary, fontWeight: fontWeight.medium, fontSize: fontSize.sm }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={post} disabled={posting || !title.trim()} activeOpacity={0.75}
                style={[styles.btn, { backgroundColor: brand.blue, flex: 1 }]}>
                <Text style={{ color: "#fff", fontWeight: fontWeight.bold, fontSize: fontSize.sm }}>{posting ? "Posting..." : "Post"}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {loading ? (
          <View style={[layout.centred, { paddingVertical: spacing[12] }]}><Spinner size="lg" label="Loading..." /></View>
        ) : news.length === 0 ? (
          <EmptyState icon="nav-news" title="No announcements yet" description="Post an announcement to notify all students." />
        ) : (
          news.map((n) => (
            <Card key={n.id}>
              <View style={layout.rowBetween}>
                <Badge label={n.type || "general"} variant="blue" size="sm" />
                <Text variant="micro" color="muted">{timeAgo(n.created_at)}</Text>
              </View>
              <Text variant="label" weight="bold" color="primary" style={{ marginTop: spacing[2] }}>{n.title}</Text>
              <Text variant="body" color="secondary" style={{ marginTop: spacing[1] }}>{n.message}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  composeBtn: { flexDirection: "row", alignItems: "center", gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl },
  textInput:  { paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, fontSize: fontSize.md, marginBottom: spacing[2] },
  bodyInput:  { minHeight: 100, textAlignVertical: "top" },
  btn:        { paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, alignItems: "center" },
});
