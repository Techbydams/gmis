// ============================================================
// GMIS — Campus Social Feed  (X / Twitter style)
// Route: /(tenant)/(student)/social
// Tables: social_posts, post_likes, post_comments, students
//
// Design: flat feed (no card boxes), separator dividers,
//         compose bar at top, like / comment / share actions,
//         native top bar, keyboard-aware composer modal.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, FlatList, TouchableOpacity, TextInput, Modal,
  StyleSheet, RefreshControl, KeyboardAvoidingView,
  Platform, Image, ActivityIndicator, Pressable,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/helpers";
import { Text, Avatar, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }   from "@/context/ThemeContext";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

const GMIS_LOGO_LIGHT = require("@/assets/gmis_logo_light.png");
const GMIS_LOGO_DARK  = require("@/assets/gmis_logo_dark.png");

// ── Types ──────────────────────────────────────────────────
interface Post {
  id: string;
  student_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_name: string;
  author_initials: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_name: string;
}

// ── Top bar ────────────────────────────────────────────────
function TopBar({ onBack, onCompose }: { onBack: () => void; onCompose: () => void }) {
  const { colors, isDark } = useTheme();
  const insets             = useSafeAreaInsets();
  const GMIS_LOGO          = isDark ? GMIS_LOGO_DARK : GMIS_LOGO_LIGHT;

  return (
    <View
      style={[
        styles.topBar,
        {
          backgroundColor:   colors.bg.card,
          borderBottomColor: colors.border.DEFAULT,
          paddingTop:        insets.top + spacing[2],
        },
      ]}
    >
      <TouchableOpacity onPress={onBack} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Icon name="ui-back" size="md" color={colors.text.secondary} />
      </TouchableOpacity>

      <Image source={GMIS_LOGO} style={styles.topLogo} resizeMode="contain" />

      <TouchableOpacity
        onPress={onCompose}
        activeOpacity={0.8}
        style={[styles.composeFab, { backgroundColor: brand.blue }]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Icon name="action-send" size="sm" color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Post card (Twitter/X style) ────────────────────────────
function PostCard({
  post,
  isMe,
  onLike,
  onComment,
  colors,
}: {
  post: Post;
  isMe: boolean;
  onLike: () => void;
  onComment: () => void;
  colors: any;
}) {
  return (
    <View style={[styles.postCard, { borderBottomColor: colors.border.subtle }]}>
      {/* Avatar column */}
      <View style={styles.postAvatar}><Avatar name={post.author_name} size="md" role="student" /></View>

      {/* Content column */}
      <View style={styles.postBody}>
        {/* Author row */}
        <View style={[layout.row, { gap: spacing[2], alignItems: "center", marginBottom: 3 }]}>
          <Text style={[styles.authorName, { color: colors.text.primary }]} numberOfLines={1}>
            {post.author_name}
          </Text>
          {isMe && (
            <View style={[styles.youPill, { backgroundColor: brand.blueAlpha15 }]}>
              <Text style={{ fontSize: 9, fontWeight: fontWeight.bold, color: brand.blue }}>You</Text>
            </View>
          )}
          <Text style={[styles.postTime, { color: colors.text.muted }]}>· {timeAgo(post.created_at)}</Text>
        </View>

        {/* Post content */}
        <Text style={[styles.postText, { color: colors.text.primary }]}>{post.content}</Text>

        {/* Actions row */}
        <View style={[layout.row, { gap: spacing[5], marginTop: spacing[3] }]}>
          {/* Comment */}
          <TouchableOpacity onPress={onComment} activeOpacity={0.7} style={layout.row} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="content-comment" size="sm" color={colors.text.muted} />
            {post.comment_count > 0 && (
              <Text style={[styles.actionCount, { color: colors.text.muted }]}>{post.comment_count}</Text>
            )}
          </TouchableOpacity>

          {/* Like */}
          <TouchableOpacity onPress={onLike} activeOpacity={0.7} style={layout.row} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon
              name={post.liked_by_me ? "content-liked" : "content-like"}
              size="sm"
              color={post.liked_by_me ? "#f43f5e" : colors.text.muted}
              filled={post.liked_by_me}
            />
            {post.like_count > 0 && (
              <Text style={[styles.actionCount, { color: post.liked_by_me ? "#f43f5e" : colors.text.muted }]}>
                {post.like_count}
              </Text>
            )}
          </TouchableOpacity>

          {/* Views (decorative) */}
          <View style={layout.row}>
            <Icon name="status-info" size="sm" color={colors.text.muted} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Compose modal ──────────────────────────────────────────
function ComposeModal({
  visible,
  authorName,
  value,
  onChangeText,
  onPost,
  posting,
  onClose,
}: {
  visible: boolean;
  authorName: string;
  value: string;
  onChangeText: (v: string) => void;
  onPost: () => void;
  posting: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();
  const inputRef   = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 150);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.bg.card }]} edges={["top"]}>
        <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border.DEFAULT }]}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: fontSize.base, color: colors.text.secondary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>New post</Text>
            <TouchableOpacity
              onPress={onPost}
              disabled={!value.trim() || posting}
              activeOpacity={0.8}
              style={[styles.postAction, { backgroundColor: value.trim() && !posting ? brand.blue : colors.bg.hover }]}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: value.trim() ? "#fff" : colors.text.muted }}>Post</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Compose area */}
          <View style={[layout.row, { gap: spacing[3], padding: spacing[4], flex: 1 }]}>
            <Avatar name={authorName} size="md" role="student" />
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder="What's happening on campus?"
              placeholderTextColor={colors.text.muted}
              multiline
              style={[styles.composeInput, { color: colors.text.primary }]}
              maxLength={280}
            />
          </View>

          {/* Character count */}
          <View style={[styles.charCount, { borderTopColor: colors.border.subtle, paddingBottom: insets.bottom + spacing[2] }]}>
            <Text style={{ fontSize: fontSize.xs, color: value.length > 250 ? colors.status.warning : colors.text.muted }}>
              {280 - value.length}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Comments modal ─────────────────────────────────────────
function CommentsModal({
  visible,
  post,
  comments,
  commentText,
  onChangeText,
  onSubmit,
  onClose,
  authorName,
}: {
  visible: boolean;
  post: Post | null;
  comments: Comment[];
  commentText: string;
  onChangeText: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  authorName: string;
}) {
  const { colors } = useTheme();
  const insets     = useSafeAreaInsets();

  if (!post) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modalRoot, { backgroundColor: colors.bg.primary }]} edges={["top"]}>
        <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>

          <View style={[styles.modalHeader, { borderBottomColor: colors.border.DEFAULT, backgroundColor: colors.bg.card }]}>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="ui-back" size="md" color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.text.primary }}>Replies</Text>
            <View style={{ width: spacing[8] }} />
          </View>

          {/* Original post */}
          <View style={[styles.postCard, { borderBottomColor: colors.border.DEFAULT }]}>
            <View style={styles.postAvatar}><Avatar name={post.author_name} size="md" role="student" /></View>
            <View style={styles.postBody}>
              <Text style={[styles.authorName, { color: colors.text.primary }]}>{post.author_name}</Text>
              <Text style={[styles.postTime, { color: colors.text.muted }]}>{timeAgo(post.created_at)}</Text>
              <Text style={[styles.postText, { color: colors.text.primary, marginTop: spacing[1] }]}>{post.content}</Text>
            </View>
          </View>

          {/* Comments list */}
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={{ paddingBottom: spacing[4] }}
            ListEmptyComponent={
              <View style={[layout.centred, { paddingVertical: spacing[8] }]}>
                <Text variant="caption" color="muted">No replies yet. Start the conversation!</Text>
              </View>
            }
            renderItem={({ item: c }) => (
              <View style={[styles.postCard, { borderBottomColor: colors.border.subtle }]}>
                <View style={styles.postAvatar}><Avatar name={c.author_name} size="sm" role="student" /></View>
                <View style={styles.postBody}>
                  <View style={[layout.row, { gap: spacing[2], marginBottom: 3 }]}>
                    <Text style={[styles.authorName, { color: colors.text.primary }]}>{c.author_name}</Text>
                    <Text style={[styles.postTime, { color: colors.text.muted }]}>· {timeAgo(c.created_at)}</Text>
                  </View>
                  <Text style={[styles.postText, { color: colors.text.primary }]}>{c.content}</Text>
                </View>
              </View>
            )}
          />

          {/* Reply input */}
          <View style={[styles.replyBar, { borderTopColor: colors.border.DEFAULT, backgroundColor: colors.bg.card, paddingBottom: insets.bottom + spacing[2] }]}>
            <Avatar name={authorName} size="sm" role="student" />
            <TextInput
              value={commentText}
              onChangeText={onChangeText}
              placeholder="Tweet your reply"
              placeholderTextColor={colors.text.muted}
              style={[styles.replyInput, { color: colors.text.primary }]}
              returnKeyType="send"
              onSubmitEditing={onSubmit}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              onPress={onSubmit}
              disabled={!commentText.trim()}
              activeOpacity={0.8}
              style={[styles.replyBtn, { backgroundColor: commentText.trim() ? brand.blue : colors.bg.hover }]}
            >
              <Icon name="action-send" size="sm" color={commentText.trim() ? "#fff" : colors.text.muted} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────
export default function StudentSocial() {
  const router            = useRouter();
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();

  const [posts,         setPosts]         = useState<Post[]>([]);
  const [studentId,     setStudentId]     = useState<string | null>(null);
  const [studentName,   setStudentName]   = useState("");
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [newPost,       setNewPost]       = useState("");
  const [posting,       setPosting]       = useState(false);
  const [showCompose,   setShowCompose]   = useState(false);
  const [openPost,      setOpenPost]      = useState<Post | null>(null);
  const [comments,      setComments]      = useState<Comment[]>([]);
  const [commentText,   setCommentText]   = useState("");

  const db = useMemo(() => tenant
    ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
    : null, [tenant, slug]);

  useEffect(() => { if (db && user) init(); }, [db, user]);

  const init = async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const { data: s } = await db.from("students")
        .select("id, first_name, last_name")
        .eq("supabase_uid", user.id)
        .maybeSingle();
      if (s) {
        const sAny = s as any;
        setStudentId(sAny.id);
        setStudentName(`${sAny.first_name} ${sAny.last_name}`);
        await loadPosts(sAny.id);
      } else {
        await loadPosts(null);
      }
    } finally { setLoading(false); }
  };

  const loadPosts = useCallback(async (sid: string | null) => {
    if (!db) return;
    const { data } = await db
      .from("social_posts")
      .select("id, student_id, content, image_url, created_at, students(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(40);

    if (!data) return;

    const postIds = data.map((p: any) => p.id);
    const [likesRes, cmtsRes, myLikesRes] = await Promise.allSettled([
      db.from("post_likes").select("post_id").in("post_id", postIds),
      db.from("post_comments").select("post_id").in("post_id", postIds),
      sid ? db.from("post_likes").select("post_id").in("post_id", postIds).eq("student_id", sid) : Promise.resolve({ data: [] }),
    ]);

    const likes    = likesRes.status    === "fulfilled" ? (likesRes.value.data    || []) : [];
    const cmts     = cmtsRes.status     === "fulfilled" ? (cmtsRes.value.data     || []) : [];
    const myLikes  = myLikesRes.status  === "fulfilled" ? ((myLikesRes.value as any).data || []) : [];
    const myLikeIds = new Set(myLikes.map((l: any) => l.post_id));

    setPosts(data.map((p: any) => ({
      id:             p.id,
      student_id:     p.student_id,
      content:        p.content,
      image_url:      p.image_url,
      created_at:     p.created_at,
      author_name:    p.students ? `${p.students.first_name} ${p.students.last_name}` : "Unknown",
      author_initials: p.students ? `${p.students.first_name?.[0] || ""}${p.students.last_name?.[0] || ""}` : "?",
      like_count:     likes.filter((l: any) => l.post_id === p.id).length,
      comment_count:  cmts.filter((c: any) => c.post_id === p.id).length,
      liked_by_me:    myLikeIds.has(p.id),
    })));
  }, [db]);

  const submitPost = async () => {
    if (!newPost.trim() || !studentId || !db) return;
    setPosting(true);
    try {
      await db.from("social_posts").insert({ student_id: studentId, content: newPost.trim() } as any);
      setNewPost("");
      setShowCompose(false);
      await loadPosts(studentId);
    } finally { setPosting(false); }
  };

  const toggleLike = async (post: Post) => {
    if (!studentId || !db) return;
    if (post.liked_by_me) {
      await db.from("post_likes").delete().eq("post_id", post.id).eq("student_id", studentId);
    } else {
      await db.from("post_likes").insert({ post_id: post.id, student_id: studentId } as any);
    }
    setPosts((prev) => prev.map((p) => p.id === post.id
      ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
      : p));
  };

  const openComments = async (post: Post) => {
    setOpenPost(post);
    setCommentText("");
    if (!db) return;
    const { data } = await db.from("post_comments")
      .select("id, content, created_at, students(first_name, last_name)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(30);
    if (data) {
      setComments(data.map((c: any) => ({
        id: c.id, content: c.content, created_at: c.created_at,
        author_name: c.students ? `${c.students.first_name} ${c.students.last_name}` : "Unknown",
      })));
    }
  };

  const submitComment = async () => {
    if (!commentText.trim() || !studentId || !openPost || !db) return;
    await db.from("post_comments").insert({ post_id: openPost.id, student_id: studentId, content: commentText.trim() } as any);
    setCommentText("");
    setPosts((prev) => prev.map((p) => p.id === openPost.id ? { ...p, comment_count: p.comment_count + 1 } : p));
    await openComments(openPost);
  };

  const shellUser = { name: studentName || user?.email || "", role: "student" as const };

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} onLogout={async () => signOut()}>

      {/* Native top bar */}
      <TopBar onBack={() => router.back()} onCompose={() => setShowCompose(true)} />

      {/* Feed */}
      {loading ? (
        <View style={[layout.fill, layout.centred]}>
          <Spinner size="lg" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={posts.length === 0 ? [layout.fill, layout.centred] : { paddingBottom: spacing[16] }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadPosts(studentId).finally(() => setRefreshing(false)); }}
              tintColor={brand.blue}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="nav-social"
              title="Nothing here yet"
              description="Be the first to post something! Tap the button at the top."
            />
          }
          renderItem={({ item: post }) => (
            <PostCard
              post={post}
              isMe={post.student_id === studentId}
              onLike={() => toggleLike(post)}
              onComment={() => openComments(post)}
              colors={colors}
            />
          )}
        />
      )}

      {/* Compose modal */}
      <ComposeModal
        visible={showCompose}
        authorName={studentName || "Me"}
        value={newPost}
        onChangeText={setNewPost}
        onPost={submitPost}
        posting={posting}
        onClose={() => { setShowCompose(false); setNewPost(""); }}
      />

      {/* Comments modal */}
      <CommentsModal
        visible={!!openPost}
        post={openPost}
        comments={comments}
        commentText={commentText}
        onChangeText={setCommentText}
        onSubmit={submitComment}
        onClose={() => { setOpenPost(null); setCommentText(""); }}
        authorName={studentName || "Me"}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  // Top bar
  topBar: {
    flexDirection:     "row",
    alignItems:        "center",
    justifyContent:    "space-between",
    paddingHorizontal: spacing[4],
    paddingBottom:     spacing[3],
    borderBottomWidth: 1,
  },
  topLogo: { width: 72, height: 26 },
  composeFab: {
    width:        32,
    height:       32,
    borderRadius: radius.full,
    alignItems:   "center",
    justifyContent: "center",
  },

  // Post card (Twitter style: flat, no card box)
  postCard: {
    flexDirection:    "row",
    paddingHorizontal: spacing[4],
    paddingVertical:  spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:              spacing[3],
  },
  postAvatar: { flexShrink: 0 },
  postBody:   { flex: 1, minWidth: 0 },
  authorName: {
    fontSize:   fontSize.sm,
    fontWeight: fontWeight.bold,
    flexShrink: 1,
  },
  youPill: {
    paddingHorizontal: spacing[2],
    paddingVertical:   2,
    borderRadius:      radius.full,
  },
  postTime: {
    fontSize: fontSize.xs,
    flexShrink: 0,
  },
  postText: {
    fontSize:   fontSize.base,
    lineHeight: 22,
    marginTop:  2,
  },
  actionCount: {
    fontSize:   fontSize.xs,
    marginLeft: spacing[1],
  },

  // Compose modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection:    "row",
    alignItems:       "center",
    justifyContent:   "space-between",
    paddingHorizontal: spacing[4],
    paddingVertical:  spacing[3],
    borderBottomWidth: 1,
  },
  postAction: {
    paddingHorizontal: spacing[4],
    paddingVertical:   spacing[2],
    borderRadius:      radius.full,
    minWidth:          60,
    alignItems:        "center",
  },
  composeInput: {
    flex:      1,
    fontSize:  fontSize.xl,
    lineHeight: 28,
    textAlignVertical: "top",
    minHeight: 120,
  },
  charCount: {
    alignItems:   "flex-end",
    paddingHorizontal: spacing[4],
    paddingTop:   spacing[2],
    borderTopWidth: 1,
  },

  // Reply bar
  replyBar: {
    flexDirection:    "row",
    alignItems:       "center",
    paddingHorizontal: spacing[4],
    paddingTop:       spacing[3],
    gap:              spacing[3],
    borderTopWidth:   1,
  },
  replyInput: {
    flex:      1,
    fontSize:  fontSize.base,
    lineHeight: 22,
    maxHeight:  80,
  },
  replyBtn: {
    width:        36,
    height:       36,
    borderRadius: radius.full,
    alignItems:   "center",
    justifyContent: "center",
    flexShrink:   0,
  },
});
