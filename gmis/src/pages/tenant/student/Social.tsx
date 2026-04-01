// ============================================================
// GMIS — Student Social Feed
// estam.gmis.app/social
//
// DB tables expected:
//   social_posts  (id, student_id, content, image_url, created_at)
//   post_likes    (id, post_id, student_id) — unique(post_id, student_id)
//   post_comments (id, post_id, student_id, content, created_at)
//
// Students can post text updates, like posts, comment.
// Feed is school-wide (all students in the tenant DB).
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useAuth }   from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { timeAgo }   from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
interface Post {
  id: string
  student_id: string
  content: string
  image_url: string | null
  created_at: string
  // joined
  author_name: string
  author_initials: string
  author_dept: string
  like_count: number
  comment_count: number
  liked_by_me: boolean
}

interface Comment {
  id: string
  post_id: string
  student_id: string
  content: string
  created_at: string
  author_name: string
  author_initials: string
}

// ── COMPONENT ─────────────────────────────────────────────
export default function StudentSocial() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()

  const [studentId,   setStudentId]   = useState<string | null>(null)
  const [posts,       setPosts]       = useState<Post[]>([])
  const [loading,     setLoading]     = useState(true)
  const [posting,     setPosting]     = useState(false)
  const [newPost,     setNewPost]     = useState('')
  const [openComments,setOpenComments]= useState<string | null>(null)  // post id with open comments
  const [comments,    setComments]    = useState<Record<string, Comment[]>>({})
  const [newComment,  setNewComment]  = useState<Record<string, string>>({})
  const [sendingCmt,  setSendingCmt]  = useState<string | null>(null)
  const [liking,      setLiking]      = useState<string | null>(null)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  // ── INIT ─────────────────────────────────────────────────
  useEffect(() => {
    if (db && user) init()
  }, [db, user])

  const init = async () => {
    if (!db || !user) return
    setLoading(true)
    try {
      const { data: s } = await db
        .from('students')
        .select('id')
        .eq('supabase_uid', user.id)
        .maybeSingle()

      if (s) {
        setStudentId(s.id)
        await loadPosts(s.id)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── LOAD POSTS ────────────────────────────────────────────
  const loadPosts = useCallback(async (sid: string) => {
    if (!db) return

    // Fetch posts with student info joined
    const { data, error } = await db
      .from('social_posts')
      .select(`
        id, student_id, content, image_url, created_at,
        students (
          first_name, last_name,
          departments ( name )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(40)

    if (error) {
      console.error('Feed load error:', error.message)
      return
    }

    if (!data) return

    // Batch-fetch like counts and my likes
    const postIds = data.map((p: any) => p.id)

    const [likesRes, myLikesRes, cntRes] = await Promise.all([
      db.from('post_likes').select('post_id', { count: 'exact' }).in('post_id', postIds),
      db.from('post_likes').select('post_id').in('post_id', postIds).eq('student_id', sid),
      db.from('post_comments').select('post_id', { count: 'exact' }).in('post_id', postIds),
    ])

    // Build counts
    const likeCounts: Record<string, number>    = {}
    const commentCounts: Record<string, number> = {}
    const myLikedIds = new Set((myLikesRes.data || []).map((l: any) => l.post_id))

    for (const postId of postIds) {
      likeCounts[postId]    = (likesRes.data    || []).filter((l: any) => l.post_id === postId).length
      commentCounts[postId] = (cntRes.data      || []).filter((c: any) => c.post_id === postId).length
    }

    const mapped: Post[] = data.map((p: any) => {
      const fn = p.students?.first_name || ''
      const ln = p.students?.last_name  || ''
      return {
        id:              p.id,
        student_id:      p.student_id,
        content:         p.content,
        image_url:       p.image_url,
        created_at:      p.created_at,
        author_name:     `${fn} ${ln}`.trim() || 'Student',
        author_initials: `${fn[0] || ''}${ln[0] || ''}`.toUpperCase() || '?',
        author_dept:     p.students?.departments?.name || '',
        like_count:      likeCounts[p.id]    || 0,
        comment_count:   commentCounts[p.id] || 0,
        liked_by_me:     myLikedIds.has(p.id),
      }
    })

    setPosts(mapped)
  }, [db])

  // ── CREATE POST ───────────────────────────────────────────
  const createPost = async () => {
    if (!newPost.trim() || !db || !studentId) return
    if (newPost.trim().length > 500) {
      toast.error('Post must be under 500 characters')
      return
    }

    setPosting(true)
    try {
      const { error } = await db.from('social_posts').insert({
        student_id: studentId,
        content:    newPost.trim(),
        image_url:  null,
      } as any)

      if (error) { toast.error('Could not post. Please try again.'); return }

      setNewPost('')
      toast.success('Posted!')
      await loadPosts(studentId)
    } finally {
      setPosting(false)
    }
  }

  // ── TOGGLE LIKE ───────────────────────────────────────────
  const toggleLike = async (postId: string, alreadyLiked: boolean) => {
    if (!db || !studentId || liking) return
    setLiking(postId)

    try {
      if (alreadyLiked) {
        await db.from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('student_id', studentId)
      } else {
        await db.from('post_likes').insert({
          post_id:    postId,
          student_id: studentId,
        } as any)
      }

      // Optimistic update
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              liked_by_me: !alreadyLiked,
              like_count:  alreadyLiked ? p.like_count - 1 : p.like_count + 1,
            }
          : p
      ))
    } catch {
      toast.error('Action failed.')
    } finally {
      setLiking(null)
    }
  }

  // ── LOAD COMMENTS ─────────────────────────────────────────
  const loadComments = async (postId: string) => {
    if (!db) return
    const { data, error } = await db
      .from('post_comments')
      .select(`
        id, post_id, student_id, content, created_at,
        students ( first_name, last_name )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error || !data) return

    const mapped: Comment[] = data.map((c: any) => {
      const fn = c.students?.first_name || ''
      const ln = c.students?.last_name  || ''
      return {
        id:              c.id,
        post_id:         c.post_id,
        student_id:      c.student_id,
        content:         c.content,
        created_at:      c.created_at,
        author_name:     `${fn} ${ln}`.trim() || 'Student',
        author_initials: `${fn[0] || ''}${ln[0] || ''}`.toUpperCase() || '?',
      }
    })

    setComments(prev => ({ ...prev, [postId]: mapped }))
  }

  // ── TOGGLE COMMENTS PANEL ─────────────────────────────────
  const toggleComments = async (postId: string) => {
    if (openComments === postId) {
      setOpenComments(null)
      return
    }
    setOpenComments(postId)
    if (!comments[postId]) {
      await loadComments(postId)
    }
  }

  // ── POST COMMENT ──────────────────────────────────────────
  const postComment = async (postId: string) => {
    const text = (newComment[postId] || '').trim()
    if (!text || !db || !studentId) return

    setSendingCmt(postId)
    try {
      const { error } = await db.from('post_comments').insert({
        post_id:    postId,
        student_id: studentId,
        content:    text,
      } as any)

      if (error) { toast.error('Comment failed.'); return }

      setNewComment(prev => ({ ...prev, [postId]: '' }))
      await loadComments(postId)

      // Bump comment count in feed
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p
      ))
    } finally {
      setSendingCmt(null)
    }
  }

  // ── DELETE POST (own only) ────────────────────────────────
  const deletePost = async (postId: string) => {
    if (!db || !confirm('Delete this post?')) return
    await db.from('social_posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    toast.success('Post deleted')
  }

  // ── AVATAR COLORS ─────────────────────────────────────────
  const avatarColor = (name: string) => {
    const colors = ['#2d6cff','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f43f5e','#84cc16']
    const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length
    return colors[idx]
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SidebarLayout active="social">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <h1 style={S.title}>Campus Feed</h1>
          <p style={S.sub}>What's happening at {tenant?.name}</p>
        </div>

        {/* Composer */}
        <div style={S.card}>
          <textarea
            value={newPost}
            onChange={e => setNewPost(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) createPost()
            }}
            placeholder="Share something with your campus..."
            rows={3}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, color: '#e8eeff',
              fontSize: 14, lineHeight: 1.6,
              resize: 'vertical', outline: 'none',
              fontFamily: "'DM Sans',system-ui",
              minHeight: 80,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 12, color: newPost.length > 450 ? '#f87171' : '#3d4f7a' }}>
              {newPost.length}/500
            </span>
            <button
              onClick={createPost}
              disabled={!newPost.trim() || posting}
              style={{
                padding: '8px 20px',
                background: newPost.trim() ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.08)',
                color: newPost.trim() ? '#fff' : '#3d4f7a',
                border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700,
                cursor: newPost.trim() ? 'pointer' : 'default',
                fontFamily: "'DM Sans',system-ui",
                transition: 'all .2s',
              }}
            >
              {posting ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={S.spin} />
            <p style={{ color: '#7a8bbf', fontSize: 13, marginTop: 14 }}>Loading feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 14 }}>📸</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e8eeff', marginBottom: 6 }}>
              No posts yet
            </div>
            <div style={{ fontSize: 13, color: '#7a8bbf' }}>
              Be the first to share something with your campus!
            </div>
          </div>
        ) : (
          posts.map(post => {
            const ac = avatarColor(post.author_name)
            const isOwn = post.student_id === studentId
            const commentsOpen = openComments === post.id
            const postComments = comments[post.id] || []

            return (
              <div key={post.id} style={{ ...S.card, marginBottom: 14, padding: 0, overflow: 'hidden' }}>
                {/* Post body */}
                <div style={{ padding: '18px 20px 14px' }}>
                  {/* Author row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: `linear-gradient(135deg,${ac},${ac}cc)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0,
                    }}>
                      {post.author_initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#e8eeff' }}>
                        {post.author_name}
                        {isOwn && (
                          <span style={{ marginLeft: 6, fontSize: 10, color: '#7a8bbf', fontWeight: 400 }}>
                            (you)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#3d4f7a' }}>
                        {post.author_dept && `${post.author_dept} · `}
                        {timeAgo(post.created_at)}
                      </div>
                    </div>
                    {isOwn && (
                      <button
                        onClick={() => deletePost(post.id)}
                        style={{
                          background: 'none', border: 'none',
                          color: '#3d4f7a', cursor: 'pointer',
                          fontSize: 16, padding: '4px 6px',
                          borderRadius: 6, transition: 'color .15s',
                        }}
                        title="Delete post"
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#3d4f7a')}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <p style={{
                    fontSize: 14, color: '#e8eeff',
                    lineHeight: 1.7, margin: 0,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {post.content}
                  </p>

                  {/* Image */}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Post"
                      style={{
                        width: '100%', borderRadius: 10,
                        marginTop: 12, maxHeight: 360,
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </div>

                {/* Actions bar */}
                <div style={{
                  display: 'flex', gap: 0,
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                  {/* Like */}
                  <button
                    onClick={() => toggleLike(post.id, post.liked_by_me)}
                    disabled={liking === post.id}
                    style={{
                      flex: 1, padding: '10px 0',
                      background: 'none', border: 'none',
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                      color: post.liked_by_me ? '#f87171' : '#7a8bbf',
                      cursor: 'pointer',
                      fontSize: 13, fontWeight: post.liked_by_me ? 700 : 400,
                      transition: 'all .15s',
                      fontFamily: "'DM Sans',system-ui",
                    }}
                  >
                    {post.liked_by_me ? '❤️' : '🤍'} {post.like_count > 0 ? post.like_count : ''} Like
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => toggleComments(post.id)}
                    style={{
                      flex: 1, padding: '10px 0',
                      background: 'none', border: 'none',
                      color: commentsOpen ? '#60a5fa' : '#7a8bbf',
                      cursor: 'pointer',
                      fontSize: 13, fontWeight: commentsOpen ? 700 : 400,
                      transition: 'all .15s',
                      fontFamily: "'DM Sans',system-ui",
                    }}
                  >
                    💬 {post.comment_count > 0 ? post.comment_count : ''} Comment
                  </button>
                </div>

                {/* Comments panel */}
                {commentsOpen && (
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    padding: '14px 20px',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    {/* Existing comments */}
                    {postComments.length === 0 ? (
                      <p style={{ fontSize: 12, color: '#3d4f7a', marginBottom: 12 }}>
                        No comments yet. Be first!
                      </p>
                    ) : (
                      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {postComments.map(c => {
                          const cc = avatarColor(c.author_name)
                          return (
                            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: `linear-gradient(135deg,${cc},${cc}cc)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
                              }}>
                                {c.author_initials}
                              </div>
                              <div style={{
                                flex: 1, padding: '8px 12px',
                                background: 'rgba(255,255,255,0.04)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '4px 12px 12px 12px',
                              }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#e8eeff', marginBottom: 2 }}>
                                  {c.author_name}
                                  <span style={{ fontSize: 10, color: '#3d4f7a', fontWeight: 400, marginLeft: 6 }}>
                                    {timeAgo(c.created_at)}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13, color: '#c8d5f0', lineHeight: 1.5 }}>
                                  {c.content}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Comment input */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={newComment[post.id] || ''}
                        onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && postComment(post.id)}
                        placeholder="Write a comment..."
                        style={{
                          flex: 1, padding: '8px 12px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 10, color: '#e8eeff',
                          fontSize: 13, outline: 'none',
                          fontFamily: "'DM Sans',system-ui",
                        }}
                      />
                      <button
                        onClick={() => postComment(post.id)}
                        disabled={!newComment[post.id]?.trim() || sendingCmt === post.id}
                        style={{
                          padding: '8px 16px',
                          background: newComment[post.id]?.trim()
                            ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)'
                            : 'rgba(255,255,255,0.06)',
                          color: newComment[post.id]?.trim() ? '#fff' : '#3d4f7a',
                          border: 'none', borderRadius: 10,
                          fontSize: 12, fontWeight: 700,
                          cursor: newComment[post.id]?.trim() ? 'pointer' : 'default',
                          fontFamily: "'DM Sans',system-ui",
                        }}
                      >
                        {sendingCmt === post.id ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Refresh button */}
        {!loading && posts.length > 0 && studentId && (
          <div style={{ textAlign: 'center', paddingBottom: 24 }}>
            <button
              onClick={() => loadPosts(studentId)}
              style={{
                padding: '8px 20px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: '#7a8bbf',
                fontSize: 12, cursor: 'pointer',
                fontFamily: "'DM Sans',system-ui",
              }}
            >
              Refresh feed
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        textarea:focus, input:focus {
          border-color: rgba(45,108,255,0.5) !important;
          box-shadow: 0 0 0 3px rgba(45,108,255,0.12) !important;
        }
      `}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  title: { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#7a8bbf' },
  card:  {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: '18px 20px',
    marginBottom: 14,
  },
  spin: {
    width: 32, height: 32,
    border: '2px solid rgba(45,108,255,0.2)',
    borderTopColor: '#2d6cff',
    borderRadius: '50%',
    animation: 'spin .8s linear infinite',
    margin: '0 auto',
  },
}