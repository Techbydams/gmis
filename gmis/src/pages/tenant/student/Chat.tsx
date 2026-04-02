// ============================================================
// GMIS — Internal Chat
// estam.gmis.app/chat
// WhatsApp-style DMs + course group chats
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { useAuth }   from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { timeAgo } from '../../../lib/helpers'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Message {
  id: string; sender_id: string; message: string
  is_read: boolean; created_at: string
  course_id: string | null; receiver_id: string | null
}

interface Course {
  id: string; course_code: string; course_name: string
}

interface Conversation {
  id: string; name: string; type: 'dm' | 'group'
  courseCode?: string; unread: number; lastMessage?: string
}

export default function Chat() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()

  const [studentId,   setStudentId]   = useState<string | null>(null)
  const [courses,     setCourses]     = useState<Course[]>([])
  const [messages,    setMessages]    = useState<Message[]>([])
  const [newMsg,      setNewMsg]      = useState('')
  const [activeCourse,setActiveCourse]= useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db && user) load() }, [db, user])
  useEffect(() => { if (activeCourse) loadMessages(activeCourse) }, [activeCourse])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const load = async () => {
    setLoading(true)
    const { data: s } = await db!.from('students').select('id').eq('supabase_uid', user!.id).single()
    if (!s) { setLoading(false); return }
    setStudentId((s as any).id)

    // Load registered courses for group chats
    const { data: regs } = await db!
      .from('semester_registrations')
      .select('courses(id, course_code, course_name)')
      .eq('student_id', (s as any).id).eq('status', 'registered')

    const courseList = (regs || []).map((r: any) => r.courses).filter(Boolean) as Course[]
    setCourses(courseList)
    if (courseList.length > 0) setActiveCourse(courseList[0].id)
    setLoading(false)
  }

  const loadMessages = async (courseId: string) => {
    const { data } = await db!
      .from('chat_messages')
      .select('*')
      .eq('course_id', courseId)
      .order('created_at', { ascending: true })
      .limit(100)
    if (data) setMessages(data as Message[])
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !studentId || !activeCourse) return
    setSending(true)
    const { error } = await db!.from('chat_messages').insert(({
      sender_id: studentId,
      course_id: activeCourse,
      message:   newMsg.trim(),
      is_read:   false,
    } as any))
    setSending(false)
    if (error) return
    setNewMsg('')
    loadMessages(activeCourse)
  }

  const activeCourseData = courses.find(c => c.id === activeCourse)

  return (
    <SidebarLayout active="chat">
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>

        {/* Conversation list */}
        <div style={{ width: 240, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 16, color: '#e8eeff' }}>Messages</h2>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#3d4f7a', fontSize: 13 }}>Loading...</div>
            ) : courses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#3d4f7a', fontSize: 12 }}>Register for courses to access group chats</div>
            ) : (
              courses.map(c => (
                <div key={c.id} onClick={() => setActiveCourse(c.id)}
                  style={{ padding: '12px 16px', cursor: 'pointer', background: activeCourse === c.id ? 'rgba(45,108,255,0.12)' : 'transparent', borderRight: activeCourse === c.id ? '3px solid #2d6cff' : '3px solid transparent', transition: 'all .15s' }}
                  onMouseEnter={e => { if (activeCourse !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (activeCourse !== c.id) e.currentTarget.style.background = 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {c.course_code.slice(-3)}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontWeight: 600, fontSize: 12, color: '#e8eeff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.course_code}</div>
                      <div style={{ fontSize: 11, color: '#3d4f7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.course_name}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat window */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {activeCourseData ? (
              <>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>
                  {activeCourseData.course_code.slice(-3)}
                </div>
                <div>
                  <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, color: '#e8eeff', fontSize: 15 }}>{activeCourseData.course_code} Group</div>
                  <div style={{ fontSize: 12, color: '#7a8bbf' }}>{activeCourseData.course_name}</div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: '#3d4f7a' }}>Select a conversation</div>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {messages.length === 0 && activeCourse ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#3d4f7a' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                <div style={{ fontSize: 13 }}>No messages yet. Start the conversation!</div>
              </div>
            ) : (
              messages.map(m => {
                const isMe = m.sender_id === studentId
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%', padding: '10px 14px',
                      borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMe ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.06)',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      color: isMe ? '#fff' : '#e8eeff',
                      fontSize: 13, lineHeight: 1.5,
                      boxShadow: isMe ? '0 4px 14px rgba(45,108,255,0.3)' : 'none',
                    }}>
                      <div>{m.message}</div>
                      <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6, textAlign: isMe ? 'right' : 'left' }}>
                        {timeAgo(m.created_at)}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          {activeCourse && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Type a message... (Enter to send)"
                style={{ flex: 1, padding: '11px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, color: '#e8eeff', fontSize: 14, outline: 'none', fontFamily: "'DM Sans',system-ui" }}
              />
              <button onClick={sendMessage} disabled={sending || !newMsg.trim()}
                style={{ padding: '11px 20px', background: newMsg.trim() ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.06)', color: newMsg.trim() ? '#fff' : '#3d4f7a', border: 'none', borderRadius: 14, cursor: newMsg.trim() ? 'pointer' : 'default', fontWeight: 700, fontSize: 13, transition: 'all .2s' }}>
                Send
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}