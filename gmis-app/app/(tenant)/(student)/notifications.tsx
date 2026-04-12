// ============================================================
// GMIS — Student Notifications (Opay-style)
// Route: /(tenant)/(student)/notifications
//
// Groups notifications by date: Today · Yesterday · Earlier
// Each item: coloured icon by type, title, message, timestamp
// Unread items glow with a blue left accent.
// Tapping a notification opens a detail BottomSheet with full
// message, timestamp, and optional image/PDF attachment.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
  Image, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter }   from "expo-router";
import { useAuth }     from "@/context/AuthContext";
import { useTenant }   from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useAutoLoad } from "@/lib/useAutoLoad";
import { Text, Spinner, EmptyState } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/Icon";
import { AppShell }    from "@/components/layout";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTheme }    from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

// ── Notification type config ───────────────────────────────
type NType = "result" | "payment" | "alert" | "info" | "election" | "attendance";

const TYPE_CONFIG: Record<NType | "default", { icon: IconName; color: string }> = {
  result:     { icon: "academic-grade",  color: "#10b981" },
  payment:    { icon: "nav-payments",    color: "#f59e0b" },
  alert:      { icon: "status-warning",  color: "#ef4444" },
  info:       { icon: "status-info",     color: "#3b82f6" },
  election:   { icon: "nav-voting",      color: "#8b5cf6" },
  attendance: { icon: "nav-attendance",  color: "#06b6d4" },
  default:    { icon: "ui-bell",         color: "#64748b" },
};

interface Notif {
  id: string;
  title: string;
  message: string;
  type: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  attachment_url: string | null;
  attachment_type: string | null;
}

type SelectedNotif = Notif & {
  attachment_url?: string | null;
  attachment_type?: "image" | "pdf" | null;
};

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (nd.getTime() === today.getTime()) return "Today";
  if (nd.getTime() === yesterday.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }) + " · " + formatTime(dateStr);
}

// ── Top bar ────────────────────────────────────────────────
function TopBar({ onBack, unread, onMarkAll }: { onBack: () => void; unread: number; onMarkAll: () => void }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, {
      backgroundColor:   colors.bg.card,
      borderBottomColor: colors.border.DEFAULT,
      paddingTop:        insets.top + spacing[2],
    }]}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={colors.text.secondary} />
      </TouchableOpacity>
      <View style={layout.fill}>
        <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>
          Notifications
        </Text>
        {unread > 0 && (
          <Text style={{ fontSize: fontSize.xs, color: brand.blue }}>{unread} unread</Text>
        )}
      </View>
      {unread > 0 && (
        <TouchableOpacity onPress={onMarkAll} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: fontSize.sm, color: brand.blue, fontWeight: fontWeight.semibold }}>
            Mark all read
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Notification item ──────────────────────────────────────
function NotifItem({
  notif, colors, onPress,
}: { notif: Notif; colors: any; onPress: () => void }) {
  const cfg = TYPE_CONFIG[(notif.type as NType) ?? "default"] ?? TYPE_CONFIG.default;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.item,
        {
          backgroundColor: notif.is_read ? colors.bg.card : colors.bg.hover,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      {/* Unread accent bar */}
      {!notif.is_read && (
        <View style={[styles.unreadBar, { backgroundColor: brand.blue }]} />
      )}

      {/* Type icon */}
      <View style={[styles.iconCircle, { backgroundColor: cfg.color + "18" }]}>
        <Icon name={cfg.icon} size="md" color={cfg.color} />
      </View>

      {/* Content */}
      <View style={layout.fill}>
        <Text
          style={{
            fontSize: fontSize.sm,
            fontWeight: notif.is_read ? fontWeight.normal : fontWeight.semibold,
            color: colors.text.primary,
          }}
          numberOfLines={1}
        >
          {notif.title}
        </Text>
        <Text
          style={{ fontSize: fontSize.xs, color: colors.text.secondary, marginTop: 2, lineHeight: 17 }}
          numberOfLines={2}
        >
          {notif.message}
        </Text>
        <Text style={{ fontSize: fontSize["2xs"] + 1, color: colors.text.muted, marginTop: 4 }}>
          {formatTime(notif.created_at)}
        </Text>
      </View>

      {/* Unread dot */}
      {!notif.is_read && (
        <View style={[styles.dot, { backgroundColor: brand.blue }]} />
      )}
    </TouchableOpacity>
  );
}

// ── Detail BottomSheet ─────────────────────────────────────
function NotifDetail({
  notif,
  onClose,
}: { notif: SelectedNotif | null; onClose: () => void }) {
  const { colors } = useTheme();

  const cfg = notif
    ? (TYPE_CONFIG[(notif.type as NType) ?? "default"] ?? TYPE_CONFIG.default)
    : TYPE_CONFIG.default;

  const isImage = notif?.attachment_type === "image" && !!notif?.attachment_url;
  const isPdf   = notif?.attachment_type === "pdf"   && !!notif?.attachment_url;

  return (
    <BottomSheet visible={!!notif} onClose={onClose} scrollable>
      <View style={styles.detailContainer}>

        {/* Icon badge */}
        <View style={[styles.detailIconCircle, { backgroundColor: cfg.color + "18" }]}>
          <Icon name={cfg.icon} size="xl" color={cfg.color} />
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: fontSize.lg,
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
            textAlign: "center",
            marginTop: spacing[3],
          }}
        >
          {notif?.title ?? ""}
        </Text>

        {/* Timestamp */}
        <Text
          style={{
            fontSize: fontSize.xs,
            color: colors.text.muted,
            textAlign: "center",
            marginTop: spacing[1],
          }}
        >
          {notif ? formatFullDate(notif.created_at) : ""}
        </Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border.subtle }]} />

        {/* Full message */}
        <Text
          style={{
            fontSize: fontSize.sm,
            color: colors.text.secondary,
            lineHeight: 22,
            marginBottom: spacing[4],
          }}
        >
          {notif?.message ?? ""}
        </Text>

        {/* Image attachment */}
        {isImage && (
          <View style={styles.attachmentWrap}>
            <Image
              source={{ uri: notif!.attachment_url! }}
              style={styles.attachmentImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* PDF attachment chip */}
        {isPdf && (
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => Linking.openURL(notif!.attachment_url!)}
            style={[
              styles.pdfChip,
              {
                backgroundColor: colors.bg.hover,
                borderColor: colors.border.DEFAULT,
              },
            ]}
          >
            <Icon name="status-info" size="sm" color={brand.blue} />
            <Text
              style={{
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semibold,
                color: brand.blue,
                marginLeft: spacing[2],
              }}
            >
              Open PDF attachment
            </Text>
          </TouchableOpacity>
        )}

      </View>
    </BottomSheet>
  );
}

// ── Main screen ────────────────────────────────────────────
export default function Notifications() {
  const router             = useRouter();
  const { user }           = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();

  const [studentId,      setStudentId]      = useState<string | null>(null);
  const [notifs,         setNotifs]         = useState<Notif[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [unread,         setUnread]         = useState(0);
  const [selectedNotif,  setSelectedNotif]  = useState<SelectedNotif | null>(null);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  useAutoLoad(() => { if (db && user) load(); }, [db, user], { hasData: notifs.length > 0 });

  const load = async (isRefresh = false) => {
    if (!db || !user) return;
    if (!isRefresh) setLoading(true);

    // Get student id
    const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
    const sid = (s as any)?.id ?? null;
    setStudentId(sid);

    // Fetch: notifications for this student OR broadcast (user_id IS NULL)
    const { data } = await db
      .from("notifications")
      .select("id, title, message, type, action_url, is_read, created_at, attachment_url, attachment_type")
      .or(sid ? `user_id.eq.${sid},user_id.is.null` : "user_id.is.null")
      .order("created_at", { ascending: false })
      .limit(50);

    const list = (data || []) as Notif[];
    setNotifs(list);
    setUnread(list.filter((n) => !n.is_read).length);
    setLoading(false);
    setRefreshing(false);
  };

  const markAllRead = async () => {
    if (!db || !studentId) return;
    const ids = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await db.from("notifications").update({ is_read: true } as any).in("id", ids);
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const markRead = async (id: string) => {
    if (!db) return;
    await db.from("notifications").update({ is_read: true } as any).eq("id", id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  };

  const handleNotifPress = useCallback(async (notif: Notif) => {
    // Mark as read if unread
    if (!notif.is_read) {
      await markRead(notif.id);
    }
    // Open detail sheet
    setSelectedNotif(notif as SelectedNotif);
  }, [db, notifs]);

  // Group by date label
  const grouped = useMemo(() => {
    const map = new Map<string, Notif[]>();
    notifs.forEach((n) => {
      const label = dayLabel(n.created_at);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    });
    return Array.from(map.entries());
  }, [notifs]);

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""}>
      <TopBar
        onBack={() => router.back()}
        unread={unread}
        onMarkAll={markAllRead}
      />

      {loading ? (
        <View style={[layout.fill, layout.centred]}>
          <Spinner size="lg" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
          <EmptyState
            icon="ui-bell"
            title="No notifications"
            description="You're all caught up! New notifications from your school will appear here."
          />
        </View>
      ) : (
        <ScrollView
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={{ paddingBottom: spacing[12] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={brand.blue}
            />
          }
        >
          {grouped.map(([label, items]) => (
            <View key={label}>
              {/* Date group header */}
              <View style={[styles.groupHeader, { backgroundColor: colors.bg.primary }]}>
                <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.text.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>
                  {label}
                </Text>
              </View>

              {/* Items */}
              {items.map((n) => (
                <NotifItem
                  key={n.id}
                  notif={n}
                  colors={colors}
                  onPress={() => handleNotifPress(n)}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Notification detail sheet */}
      <NotifDetail
        notif={selectedNotif}
        onClose={() => setSelectedNotif(null)}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
    borderBottomWidth: 1, gap: spacing[3],
  },
  groupHeader: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2] + 2,
  },
  item: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[3], position: "relative",
  },
  unreadBar: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
    borderTopRightRadius: radius.sm, borderBottomRightRadius: radius.sm,
  },
  iconCircle: {
    width: spacing[11], height: spacing[11],
    borderRadius: radius.full,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  dot: {
    width: spacing[2] + 2, height: spacing[2] + 2,
    borderRadius: radius.full, flexShrink: 0,
    marginTop: spacing[1],
  },
  // Detail sheet styles
  detailContainer: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[4],
    alignItems: "center",
  },
  detailIconCircle: {
    width: spacing[16],
    height: spacing[16],
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing[2],
  },
  divider: {
    width: "100%",
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing[4],
  },
  attachmentWrap: {
    alignSelf: "stretch",
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing[4],
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  attachmentImage: {
    width: "100%",
    aspectRatio: 16 / 9,
    minHeight: 160,
  } as any,
  pdfChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing[4],
    alignSelf: "stretch",
  },
});
