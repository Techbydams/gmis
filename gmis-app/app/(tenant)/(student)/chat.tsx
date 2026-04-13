// ============================================================
// GMIS — Course Group Chat  (WhatsApp style)
// Route: /(tenant)/(student)/chat
// Tables: chat_messages, semester_registrations, courses
//
// Design:
//  · Course list screen (like WhatsApp conversation list)
//  · Chat window with bubbles + tails
//  · Keyboard-responsive input bar uses useSafeAreaInsets
//  · My messages: blue, right-aligned, rounded-br-none tail
//  · Their messages: card-bg, left-aligned, rounded-bl-none
//
// Real-time:
//  · Subscribes to chat_messages INSERT for active course
//  · New messages from any student appear instantly — no refresh
//  · Optimistic send: message shows immediately on tap, before DB confirms
//  · Cache: course list is cached so list screen loads instantly
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  View, FlatList, TouchableOpacity, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { useRealtimeTable } from "@/lib/realtime";
import { cache } from "@/lib/cache";
import { timeAgo } from "@/lib/helpers";
import { Text, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }   from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");
const GROUP_ICON      = require("@/assets/gmis_logo.png");  // group chat default avatar

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  course_id: string | null;
}

interface Course {
  id: string;
  course_code: string;
  course_name: string;
}

// ── Conversation list top bar ──────────────────────────────
function ListTopBar({ onBack }: { onBack: () => void }) {
  const { colors, isDark } = useTheme();
  const insets             = useSafeAreaInsets();
  const GMIS_LOGO          = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;

  return (
    <View style={[styles.listTopBar, {
      backgroundColor:   colors.bg.card,
      borderBottomColor: colors.border.DEFAULT,
      paddingTop:        insets.top + spacing[2],
    }]}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={colors.text.secondary} />
      </TouchableOpacity>
      <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text.primary }}>
        Chats
      </Text>
      <Image source={GMIS_LOGO} style={{ width: 52, height: 20 }} resizeMode="contain" />
    </View>
  );
}

// ── Chat room top bar ──────────────────────────────────────
function ChatTopBar({
  course,
  onBack,
  onLayout,
}: { course: Course | null; onBack: () => void; onLayout?: (e: any) => void }) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  return (
    <View
      onLayout={onLayout}
      style={[styles.chatTopBar, {
        backgroundColor:   colors.bg.card,
        borderBottomColor: colors.border.DEFAULT,
        paddingTop:        insets.top + spacing[2],
      }]}
    >
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={brand.blue} />
      </TouchableOpacity>

      {/* Group avatar — GMIS logo until lecturer photo is available */}
      <View style={[styles.chatAvatar, { backgroundColor: colors.bg.hover, borderWidth: 1, borderColor: colors.border.DEFAULT }]}>
        <Image source={GROUP_ICON} style={{ width: 28, height: 28 }} resizeMode="contain" />
      </View>

      <View style={layout.fill}>
        <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }} numberOfLines={1}>
          {course?.course_code ?? "Chat"} Group
        </Text>
        {course?.course_name && (
          <Text style={{ fontSize: fontSize.xs, color: colors.text.muted }} numberOfLines={1}>
            {course.course_name}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── Message bubble ─────────────────────────────────────────
function Bubble({ msg, isMe, colors }: { msg: Message; isMe: boolean; colors: any }) {
  return (
    <View style={[styles.bubbleRow, isMe ? styles.rowRight : styles.rowLeft]}>
      <View
        style={[
          styles.bubble,
          isMe
            ? [styles.myBubble,    { backgroundColor: brand.blue }]
            : [styles.theirBubble, { backgroundColor: colors.bg.card, borderColor: colors.border.DEFAULT }],
        ]}
      >
        <Text style={{ fontSize: fontSize.base, color: isMe ? "#fff" : colors.text.primary, lineHeight: 21 }}>
          {msg.message}
        </Text>
        <Text style={[styles.bubbleTime, { color: isMe ? "rgba(255,255,255,0.65)" : colors.text.muted }]}>
          {timeAgo(msg.created_at)}
        </Text>
      </View>
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────
export default function Chat() {
  const { user, signOut }  = useAuth();
  const router             = useRouter();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const insets             = useSafeAreaInsets();

  const [studentId,    setStudentId]    = useState<string | null>(null);
  const [courses,      setCourses]      = useState<Course[]>([]);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [newMsg,       setNewMsg]       = useState("");
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const flatRef     = useRef<FlatList>(null);
  const studentIdRef = useRef<string | null>(null);

  const db = useMemo(() =>
    tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
  [tenant, slug]);

  // ── Cache key helpers ──────────────────────────────────────
  const courseCacheKey = slug && user ? `chat:courses:${slug}:${user.id}` : null;

  useEffect(() => { if (db && user) loadInit(); }, [db, user]);

  // When course changes: load messages (with cache), then subscribe
  useEffect(() => {
    if (!activeCourse) { setMessages([]); return; }
    loadMessages(activeCourse.id);
  }, [activeCourse?.id]);

  const loadInit = async () => {
    if (!db || !user) return;

    // Show cached course list immediately so screen feels instant
    if (courseCacheKey) {
      const cached = cache.get<Course[]>(courseCacheKey);
      if (cached) { setCourses(cached); setLoading(false); }
    }

    const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
    if (!s) { setLoading(false); return; }
    const sid = (s as any).id as string;
    setStudentId(sid);
    studentIdRef.current = sid;

    const { data: regs } = await db
      .from("semester_registrations")
      .select("courses(id, course_code, course_name)")
      .eq("student_id", sid)
      .eq("status", "registered");

    const list = (regs || []).map((r: any) => r.courses).filter(Boolean) as Course[];
    setCourses(list);
    if (courseCacheKey) cache.set(courseCacheKey, list);
    setLoading(false);
  };

  const loadMessages = async (courseId: string) => {
    if (!db) return;

    // Show cached messages instantly
    const msgKey = `chat:msgs:${slug}:${courseId}`;
    const cached = cache.get<Message[]>(msgKey);
    if (cached) {
      setMessages(cached);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
    }

    const { data } = await db.from("chat_messages")
      .select("*")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) {
      setMessages(data as Message[]);
      cache.set(msgKey, data);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
    }
  };

  // ── Real-time: new messages for active course ──────────────
  // Appends incoming rows directly — no full reload needed
  useRealtimeTable(db, "chat_messages", {
    filter: activeCourse ? `course_id=eq.${activeCourse.id}` : undefined,
    onInsert: useCallback((row: Message) => {
      // Skip if we already have this message (e.g. the optimistic copy we added on send)
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        const updated = [...prev, row];
        // Update cache too so background reload is consistent
        if (activeCourse && slug) {
          cache.set(`chat:msgs:${slug}:${activeCourse.id}`, updated);
        }
        return updated;
      });
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);
    }, [activeCourse?.id, slug]),
  });

  const send = async () => {
    const text = newMsg.trim();
    if (!text || !studentIdRef.current || !activeCourse || !db) return;

    // Optimistic: show message immediately before DB confirms
    const optimistic: Message = {
      id:         `opt-${Date.now()}`,
      sender_id:  studentIdRef.current,
      course_id:  activeCourse.id,
      message:    text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setNewMsg("");
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 50);

    setSending(true);
    const { error } = await db.from("chat_messages").insert({
      sender_id: studentIdRef.current,
      course_id: activeCourse.id,
      message:   text,
      is_read:   false,
    } as any);
    setSending(false);

    if (error) {
      // Roll back optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setNewMsg(text);
    }
    // On success: the realtime subscription will append the real row,
    // and the duplicate-check above will prevent showing it twice.
  };

  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  // ── Course list (no active chat) ─────────────────────────
  if (!activeCourse) {
    return (
      <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} onLogout={async () => signOut()}>
        <ListTopBar onBack={() => router.back()} />

        {loading ? (
          <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
        ) : courses.length === 0 ? (
          <View style={[layout.fill, layout.centred, { padding: spacing[6] }]}>
            <EmptyState
              icon="nav-chat"
              title="No group chats yet"
              description="Register for courses to join their group chats."
            />
          </View>
        ) : (
          <FlatList
            data={courses}
            keyExtractor={(c) => c.id}
            style={{ backgroundColor: colors.bg.primary }}
            contentContainerStyle={{ paddingBottom: spacing[12] }}
            ItemSeparatorComponent={() => (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border.subtle, marginLeft: spacing[4] + spacing[10] + spacing[3] }} />
            )}
            renderItem={({ item: c }) => (
              <TouchableOpacity
                onPress={() => setActiveCourse(c)}
                activeOpacity={0.75}
                style={[styles.convRow, { backgroundColor: colors.bg.primary }]}
              >
                {/* Group avatar — GMIS logo until lecturer photo is available */}
                <View style={[styles.chatAvatar, { backgroundColor: colors.bg.hover, borderWidth: 1, borderColor: colors.border.DEFAULT }]}>
                  <Image source={GROUP_ICON} style={{ width: 28, height: 28 }} resizeMode="contain" />
                </View>
                <View style={layout.fill}>
                  <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text.primary }} numberOfLines={1}>
                    {c.course_code} Group
                  </Text>
                  <Text style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }} numberOfLines={1}>
                    {c.course_name}
                  </Text>
                </View>
                <Icon name="ui-forward" size="sm" color={colors.text.muted} />
              </TouchableOpacity>
            )}
          />
        )}
      </AppShell>
    );
  }

  // ── Chat window ──────────────────────────────────────────
  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} onLogout={async () => signOut()}>
      <ChatTopBar
        course={activeCourse}
        onBack={() => { setActiveCourse(null); setMessages([]); }}
        onLayout={(e: any) => setTopBarHeight(e.nativeEvent.layout.height)}
      />

      <KeyboardAvoidingView
        style={[layout.fill, { backgroundColor: colors.bg.primary }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={topBarHeight}
      >
        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={{ paddingVertical: spacing[3], paddingHorizontal: spacing[3], gap: spacing[1] }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={[layout.fill, layout.centred, { paddingVertical: spacing[12] }]}>
              <Icon name="nav-chat" size="3xl" color={colors.text.muted} />
              <Text variant="body" color="muted" style={{ marginTop: spacing[3] }}>
                No messages yet. Say hi!
              </Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <Bubble msg={m} isMe={m.sender_id === studentId} colors={colors} />
          )}
        />

        {/* Input bar — sticks to keyboard */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.bg.card,
              borderTopColor:  colors.border.DEFAULT,
              // On iOS with padding behavior, KAV handles bottom offset.
              // On Android, add bottom inset manually.
              paddingBottom: Platform.OS === "android"
                ? Math.max(insets.bottom, spacing[2])
                : spacing[2],
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT }]}>
            <TextInput
              value={newMsg}
              onChangeText={setNewMsg}
              placeholder="Message"
              placeholderTextColor={colors.text.muted}
              style={[styles.textInput, { color: colors.text.primary }]}
              multiline
              maxLength={1000}
              returnKeyType="default"
              blurOnSubmit={false}
              enablesReturnKeyAutomatically
              onSubmitEditing={Platform.OS === "web" ? send : undefined}
              scrollEnabled
            />
          </View>

          {/* Send button */}
          <TouchableOpacity
            onPress={send}
            disabled={!newMsg.trim() || sending}
            activeOpacity={0.8}
            style={[
              styles.sendBtn,
              { backgroundColor: newMsg.trim() ? brand.blue : colors.bg.hover },
            ]}
          >
            <Icon
              name="action-send"
              size="md"
              color={newMsg.trim() ? "#fff" : colors.text.muted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  // Top bars
  listTopBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
  },
  chatTopBar: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
    gap:               spacing[3],
  },
  chatAvatar: {
    width:          spacing[10],
    height:         spacing[10],
    borderRadius:   radius.full,
    alignItems:     "center",
    justifyContent: "center",
    flexShrink:     0,
  },

  // Course list
  convRow: {
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[3] + 2,
    gap:               spacing[3],
  },

  // Bubbles
  bubbleRow: {
    marginVertical: 2,
  },
  rowLeft:  { alignItems: "flex-start",  paddingRight:  "20%" },
  rowRight: { alignItems: "flex-end",    paddingLeft:   "20%" },
  bubble: {
    paddingHorizontal: spacing[3] + 2,
    paddingVertical:   spacing[2] + 2,
    maxWidth:          "100%",
  },
  myBubble: {
    borderRadius:       radius.lg,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderRadius:      radius.lg,
    borderBottomLeftRadius: 4,
    borderWidth:       1,
  },
  bubbleTime: {
    fontSize:  fontSize["2xs"] + 1,
    marginTop: spacing[1],
    alignSelf: "flex-end",
  },

  // Input bar
  inputBar: {
    flexDirection:     "row",
    alignItems:        "flex-end",
    paddingHorizontal: spacing[3],
    paddingTop:        spacing[2],
    borderTopWidth:    1,
    gap:               spacing[2],
  },
  inputWrap: {
    flex:         1,
    borderRadius: radius.xl,
    borderWidth:  1,
    paddingHorizontal: spacing[3],
    paddingVertical:   Platform.OS === "ios" ? spacing[2] + 2 : spacing[1],
    minHeight:    44,
    justifyContent: "center",
  },
  textInput: {
    fontSize:          fontSize.base,
    lineHeight:        22,
    maxHeight:         120,
    textAlignVertical: "center",
  },
  sendBtn: {
    width:        44,
    height:       44,
    borderRadius: radius.full,
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
    marginBottom: 0,
  },
});
