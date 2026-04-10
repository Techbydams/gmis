// ============================================================
// GMIS — Student Social Feed
// Route: /(tenant)/(student)/social
// Tables: social_posts, post_likes, post_comments
// School-wide feed. Text posts, likes, comments.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, RefreshControl, KeyboardAvoidingView, Platform,
} from "react-native";
import { useAuth }   from "@/context/AuthContext";
import { useTenant } from "@/context/TenantContext";
import { getTenantClient } from "@/lib/supabase";
import { timeAgo, getInitials } from "@/lib/helpers";
import { Text, Card, Avatar, Spinner, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/Icon";
import { AppShell } from "@/components/layout";
import { useTheme }      from "@/context/ThemeContext";
import { useResponsive } from "@/lib/responsive";
import { brand, spacing, radius, fontSize, fontWeight } from "@/theme/tokens";
import { layout } from "@/styles/shared";

interface Post {
  id: string; student_id: string; content: string;
  image_url: string | null; created_at: string;
  author_name: string; like_count: number;
  comment_count: number; liked_by_me: boolean;
}

interface Comment {
  id: string; post_id: string; content: string;
  created_at: string; author_name: string;
}

export default function StudentSocial() {
  const { user, signOut } = useAuth();
  const { tenant, slug }  = useTenant();
  const { colors }        = useTheme();
  const { pagePadding }   = useResponsive();

  const [posts,      setPosts]      = useState<Post[]>([]);
  const [studentId,  setStudentId]  = useState<string | null>(null);
  const [studentName,setStudentName]= useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newPost,    setNewPost]    = useState("");
  const [posting,    setPosting]    = useState(false);
  const [comments,   setComments]   = useState<Record<string, Comment[]>>({});
  const [openComments, setOpenComments] = useState<string | null>(null);
  const [commentText,  setCommentText]  = useState("");

  const db = useMemo(() => {
    if (!tenant) return null;
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!);
  }, [tenant, slug]);

  useEffect(() => { if (db && user) init(); }, [db, user]);

  const init = async () => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const { data: s } = await db.from("students")
        .select("id, first_name, last_name").eq("supabase_uid", user.id).maybeSingle();
      if (s) {
        const sAny = s as any;
        setStudentId(sAny.id);
        setStudentName(`${sAny.first_name} ${sAny.last_name}`);
      }
      await loadPosts(s ? (s as any).id : null);
    } finally { setLoading(false); }
  };

  const loadPosts = async (sid: string | null) => {
    if (!db) return;
    const { data } = await db
      .from("social_posts")
      .select("id, student_id, content, image_url, created_at, students(first_name, last_name)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (!data) return;

    // Get like/comment counts
    const postIds = data.map((p: any) => p.id);
    const [likesRes, commentsRes, myLikesRes] = await Promise.allSettled([
      db.from("post_likes").select("post_id").in("post_id", postIds),
      db.from("post_comments").select("post_id").in("post_id", postIds),
      sid ? db.from("post_likes").select("post_id").in("post_id", postIds).eq("student_id", sid) : Promise.resolve({ data: [] }),
    ]);

    const likes     = likesRes.status     === "fulfilled" ? (likesRes.value.data     || []) : [];
    const cmts      = commentsRes.status  === "fulfilled" ? (commentsRes.value.data  || []) : [];
    const myLikes   = myLikesRes.status   === "fulfilled" ? ((myLikesRes.value as any).data || []) : [];
    const myLikeIds = new Set(myLikes.map((l: any) => l.post_id));

    const enriched: Post[] = data.map((p: any) => ({
      id:            p.id,
      student_id:    p.student_id,
      content:       p.content,
      image_url:     p.image_url,
      created_at:    p.created_at,
      author_name:   p.students ? `${p.students.first_name} ${p.students.last_name}` : "Unknown",
      like_count:    likes.filter((l: any) => l.post_id === p.id).length,
      comment_count: cmts.filter((c: any) => c.post_id === p.id).length,
      liked_by_me:   myLikeIds.has(p.id),
    }));

    setPosts(enriched);
  };

  const submitPost = async () => {
    if (!newPost.trim() || !studentId || !db) return;
    setPosting(true);
    await db.from("social_posts").insert({ student_id: studentId, content: newPost.trim() } as any);
    setNewPost("");
    await loadPosts(studentId);
    setPosting(false);
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

  const loadComments = async (postId: string) => {
    if (!db) return;
    const { data } = await db.from("post_comments")
      .select("id, post_id, content, created_at, students(first_name, last_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(20);
    if (data) {
      setComments((prev) => ({
        ...prev,
        [postId]: data.map((c: any) => ({
          id: c.id, post_id: c.post_id, content: c.content, created_at: c.created_at,
          author_name: c.students ? `${c.students.first_name} ${c.students.last_name}` : "Unknown",
        })),
      }));
    }
  };

  const submitComment = async (postId: string) => {
    if (!commentText.trim() || !studentId || !db) return;
    await db.from("post_comments").insert({ post_id: postId, student_id: studentId, content: commentText.trim() } as any);
    setCommentText("");
    await loadComments(postId);
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p));
  };

  const shellUser = { name: studentName || user?.email || "", role: "student" as const };

  if (loading) return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Social">
      <View style={[layout.fill, layout.centred]}><Spinner size="lg" /></View>
    </AppShell>
  );

  return (
    <AppShell role="student" user={shellUser} schoolName={tenant?.name || ""} pageTitle="Campus Social"
      onLogout={async () => { await signOut(); }}>
      <KeyboardAvoidingView style={layout.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={[layout.fill, { backgroundColor: colors.bg.primary }]}
          contentContainerStyle={{ padding: pagePadding, gap: spacing[4] }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPosts(studentId).finally(() => setRefreshing(false)); }} tintColor={brand.blue} />}
        >
          <Text variant="heading" color="primary">Campus Feed</Text>
          <Text variant="caption" color="muted" style={{ marginTop: -spacing[3] }}>What's happening at {tenant?.name}</Text>

          {/* Compose */}
          <Card>
            <View style={[layout.row, { gap: spacing[3], alignItems: "flex-start" }]}>
              <Avatar name={studentName || "Me"} size="md" role="student" />
              <TextInput
                value={newPost}
                onChangeText={setNewPost}
                placeholder="What's happening on campus?"
                placeholderTextColor={colors.text.muted}
                multiline
                style={[styles.composer, { color: colors.text.primary, borderColor: colors.border.DEFAULT, backgroundColor: colors.bg.input }]}
              />
            </View>
            <View style={[layout.rowEnd, { marginTop: spacing[3] }]}>
              <TouchableOpacity
                onPress={submitPost}
                disabled={!newPost.trim() || posting}
                activeOpacity={0.75}
                style={[styles.postBtn, { backgroundColor: newPost.trim() ? brand.blue : colors.bg.hover, opacity: posting ? 0.7 : 1 }]}
              >
                <Icon name="action-send" size="sm" color={newPost.trim() ? "#fff" : colors.text.muted} />
                <Text style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: newPost.trim() ? "#fff" : colors.text.muted, marginLeft: spacing[1] }}>
                  {posting ? "Posting..." : "Post"}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Feed */}
          {posts.length === 0 ? (
            <EmptyState icon="nav-social" title="No posts yet" description="Be the first to post something on campus!" />
          ) : (
            posts.map((post) => (
              <Card key={post.id}>
                {/* Post header */}
                <View style={[layout.row, { gap: spacing[3], marginBottom: spacing[3] }]}>
                  <Avatar name={post.author_name} size="md" role="student" />
                  <View style={layout.fill}>
                    <Text variant="label" weight="semibold" color="primary">{post.author_name}</Text>
                    <Text variant="micro" color="muted">{timeAgo(post.created_at)}</Text>
                  </View>
                </View>

                {/* Content */}
                <Text variant="body" color="primary" style={{ marginBottom: spacing[3], lineHeight: 22 }}>{post.content}</Text>

                {/* Actions */}
                <View style={[layout.row, { gap: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing[3] }]}>
                  <TouchableOpacity onPress={() => toggleLike(post)} activeOpacity={0.75} style={[layout.row, { gap: spacing[1] }]}>
                    <Icon name={post.liked_by_me ? "content-liked" : "content-like"} size="md" color={post.liked_by_me ? "#f87171" : colors.text.muted} filled={post.liked_by_me} />
                    <Text style={{ fontSize: fontSize.sm, color: post.liked_by_me ? "#f87171" : colors.text.muted }}>{post.like_count}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (openComments === post.id) { setOpenComments(null); }
                      else { setOpenComments(post.id); loadComments(post.id); }
                    }}
                    activeOpacity={0.75}
                    style={[layout.row, { gap: spacing[1] }]}
                  >
                    <Icon name="content-comment" size="md" color={colors.text.muted} />
                    <Text style={{ fontSize: fontSize.sm, color: colors.text.muted }}>{post.comment_count}</Text>
                  </TouchableOpacity>
                </View>

                {/* Comments section */}
                {openComments === post.id && (
                  <View style={{ marginTop: spacing[3] }}>
                    {(comments[post.id] || []).map((c) => (
                      <View key={c.id} style={[layout.row, { gap: spacing[2], marginBottom: spacing[2] }]}>
                        <Avatar name={c.author_name} size="xs" role="student" />
                        <View style={[styles.commentBubble, { backgroundColor: colors.bg.hover }]}>
                          <Text style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.text.primary }}>{c.author_name}</Text>
                          <Text style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 2 }}>{c.content}</Text>
                        </View>
                      </View>
                    ))}
                    <View style={[layout.row, { gap: spacing[2], marginTop: spacing[2] }]}>
                      <TextInput
                        value={commentText}
                        onChangeText={setCommentText}
                        placeholder="Write a comment..."
                        placeholderTextColor={colors.text.muted}
                        style={[styles.commentInput, { flex: 1, backgroundColor: colors.bg.input, borderColor: colors.border.DEFAULT, color: colors.text.primary }]}
                        onSubmitEditing={() => submitComment(post.id)}
                        returnKeyType="send"
                      />
                      <TouchableOpacity onPress={() => submitComment(post.id)} activeOpacity={0.75} style={[styles.sendBtn, { backgroundColor: brand.blue }]}>
                        <Icon name="action-send" size="sm" color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </Card>
            ))
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  composer: { flex: 1, borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: fontSize.md, minHeight: spacing[12], textAlignVertical: "top" },
  postBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[4], paddingVertical: spacing[2], borderRadius: radius.xl, gap: spacing[1] },
  commentBubble: { flex: 1, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  commentInput: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: fontSize.sm },
  sendBtn: { width: spacing[10], height: spacing[10], borderRadius: radius.full, alignItems: "center", justifyContent: "center" },
});
