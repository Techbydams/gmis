// ============================================================
// GMIS — Course Group Chat
// Route: /(tenant)/(student)/chat
// Table: chat_messages, semester_registrations
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useRef, useMemo } from "react";
import { View, FlatList, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/helpers";
import { Text, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Message { id: string; sender_id: string; message: string; created_at: string; course_id: string | null; }
interface Course  { id: string; course_code: string; course_name: string; }

export default function Chat() {
  const { user, signOut }  = useAuth();
  const { tenant, slug }   = useTenant();
  const { colors }         = useTheme();
  const { isMobile }       = useResponsive();

  const [studentId,    setStudentId]    = useState<string | null>(null);
  const [courses,      setCourses]      = useState<Course[]>([]);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [newMsg,       setNewMsg]       = useState("");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [showSidebar,  setShowSidebar]  = useState(!isMobile);
  const flatRef = useRef<FlatList>(null);

  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug]);

  useEffect(() => { if (db && user) loadInit(); }, [db, user]);
  useEffect(() => { if (activeCourse) loadMessages(activeCourse); }, [activeCourse]);

  const loadInit = async () => {
    if (!db || !user) return;
    setLoading(true);
    const { data: s } = await db.from("students").select("id").eq("supabase_uid", user.id).maybeSingle();
    if (!s) { setLoading(false); return; }
    setStudentId((s as any).id);

    const { data: regs } = await db
      .from("semester_registrations")
      .select("courses(id, course_code, course_name)")
      .eq("student_id", (s as any).id).eq("status", "registered");

    const list = (regs || []).map((r: any) => r.courses).filter(Boolean) as Course[];
    setCourses(list);
    if (list.length > 0) setActiveCourse(list[0].id);
    setLoading(false);
  };

  const loadMessages = async (courseId: string) => {
    if (!db) return;
    const { data } = await db.from("chat_messages").select("*").eq("course_id", courseId).order("created_at", { ascending: true }).limit(100);
    if (data) setMessages(data as Message[]);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const send = async () => {
    if (!newMsg.trim() || !studentId || !activeCourse || !db) return;
    setSending(true);
    const { error } = await db.from("chat_messages").insert({ sender_id: studentId, course_id: activeCourse, message: newMsg.trim(), is_read: false } as any);
    setSending(false);
    if (error) return;
    setNewMsg("");
    loadMessages(activeCourse);
  };

  const activeCourseData = courses.find((c) => c.id === activeCourse);
  const shellUser = { name: user?.email?.split("@")[0] || "Student", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Messages" onLogout={async () => signOut()}>
      <View style={[layout.fillRow, { backgroundColor: colors.bg.primary }]}>

        {/* Sidebar — course list */}
        {(showSidebar || !isMobile) && (
          <View style={[styles.sidebar, { backgroundColor: colors.bg.secondary, borderRightColor: colors.border.DEFAULT }]}>
            <View style={[styles.sidebarHeader, { borderBottomColor: colors.border.DEFAULT }]}>
              <Text variant="subtitle" weight="bold" color="primary">Chats</Text>
            </View>
            {loading ? (
              <View style={[layout.centred, { flex: 1 }]}><Spinner size="md" /></View>
            ) : courses.length === 0 ? (
              <View style={[layout.centred, { flex: 1, padding: spacing[4] }]}>
                <Text variant="caption" color="muted" align="center">Register for courses to access group chats</Text>
              </View>
            ) : (
              courses.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => { setActiveCourse(c.id); if (isMobile) setShowSidebar(false); }}
                  activeOpacity={0.75}
                  style={[
                    styles.courseRow,
                    activeCourse === c.id && { backgroundColor: brand.blueAlpha15, borderRightWidth: 3, borderRightColor: brand.blue },
                  ]}
                >
                  <View style={[styles.courseAvatar, { backgroundColor: brand.blue }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: "#fff" }}>{c.course_code.slice(-3)}</Text>
                  </View>
                  <View style={layout.fill}>
                    <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text.primary }} numberOfLines={1}>{c.course_code}</Text>
                    <Text variant="micro" color="muted" numberOfLines={1}>{c.course_name}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Chat window */}
        {(!isMobile || !showSidebar) && (
          <KeyboardAvoidingView style={[layout.fillCol, styles.chatWindow, { backgroundColor: colors.bg.primary }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
            {/* Header */}
            <View style={[styles.chatHeader, { borderBottomColor: colors.border.DEFAULT, backgroundColor: colors.bg.card }]}>
              {isMobile && (
                <TouchableOpacity onPress={() => setShowSidebar(true)} activeOpacity={0.7} style={{ marginRight: spacing[3] }}>
                  <Icon name="ui-back" size="md" color={colors.text.secondary} />
                </TouchableOpacity>
              )}
              {activeCourseData ? (
                <>
                  <View style={[styles.courseAvatar, { backgroundColor: brand.blue }]}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.black, color: "#fff" }}>{activeCourseData.course_code.slice(-3)}</Text>
                  </View>
                  <View style={{ marginLeft: spacing[2] }}>
                    <Text variant="label" weight="bold" color="primary">{activeCourseData.course_code} Group</Text>
                    <Text variant="micro" color="muted">{activeCourseData.course_name}</Text>
                  </View>
                </>
              ) : (
                <Text variant="caption" color="muted">Select a conversation</Text>
              )}
            </View>

            {/* Messages */}
            {messages.length === 0 && activeCourse ? (
              <View style={[layout.fill, layout.centred]}>
                <Icon name="nav-chat" size="3xl" color={colors.text.muted} />
                <Text variant="body" color="muted" style={{ marginTop: spacing[3] }}>No messages yet. Start the conversation!</Text>
              </View>
            ) : (
              <FlatList
                ref={flatRef}
                data={messages}
                keyExtractor={(m) => m.id}
                contentContainerStyle={{ padding: spacing[4], gap: spacing[2] }}
                onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item: m }) => {
                  const isMe = m.sender_id === studentId;
                  return (
                    <View style={[layout.row, { justifyContent: isMe ? "flex-end" : "flex-start" }]}>
                      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble, { backgroundColor: isMe ? brand.blue : colors.bg.card, borderColor: isMe ? brand.blue : colors.border.DEFAULT }]}>
                        <Text style={{ fontSize: fontSize.sm, color: isMe ? "#fff" : colors.text.primary, lineHeight: 20 }}>{m.message}</Text>
                        <Text style={{ fontSize: fontSize["2xs"], color: isMe ? "rgba(255,255,255,0.6)" : colors.text.muted, marginTop: spacing[1], textAlign: isMe ? "right" : "left" as any }}>
                          {timeAgo(m.created_at)}
                        </Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Input */}
            {activeCourse && (
              <View style={[styles.inputBar, { borderTopColor: colors.border.DEFAULT, backgroundColor: colors.bg.card }]}>
                <TextInput
                  value={newMsg}
                  onChangeText={setNewMsg}
                  onSubmitEditing={send}
                  placeholder="Type a message..."
                  placeholderTextColor={colors.text.muted}
                  style={[styles.textInput, { backgroundColor: colors.bg.input, color: colors.text.primary, borderColor: colors.border.DEFAULT }]}
                  multiline
                />
                <TouchableOpacity
                  onPress={send}
                  disabled={!newMsg.trim() || sending}
                  activeOpacity={0.75}
                  style={[styles.sendBtn, { backgroundColor: newMsg.trim() ? brand.blue : colors.bg.hover }]}
                >
                  <Icon name="action-send" size="md" color={newMsg.trim() ? "#fff" : colors.text.muted} />
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  sidebar:       { width: 240, flexShrink: 0, borderRightWidth: 1 },
  sidebarHeader: { padding: spacing[4], borderBottomWidth: 1 },
  courseRow:     { flexDirection: "row", alignItems: "center", gap: spacing[3], padding: spacing[4], borderRightWidth: 3, borderRightColor: "transparent" },
  courseAvatar:  { width: spacing[10], height: spacing[10], borderRadius: radius.lg, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chatWindow:    { flex: 1, overflow: "hidden" },
  chatHeader:    { flexDirection: "row", alignItems: "center", padding: spacing[4], borderBottomWidth: 1 },
  bubble:        { maxWidth: "72%", padding: spacing[3], borderWidth: 1 },
  myBubble:      { borderRadius: radius.lg, borderBottomRightRadius: radius.xs },
  theirBubble:   { borderRadius: radius.lg, borderBottomLeftRadius: radius.xs },
  inputBar:      { flexDirection: "row", alignItems: "flex-end", gap: spacing[2], padding: spacing[3], borderTopWidth: 1 },
  textInput:     { flex: 1, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: fontSize.base, maxHeight: 100 },
  sendBtn:       { width: spacing[10] + spacing[2], height: spacing[10] + spacing[2], borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
});
