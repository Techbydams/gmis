// ============================================================
// GMIS — Student Dashboard
// FIXED:
//   - .single() → .maybeSingle() to prevent 406 crash
//   - db memoized to prevent recreation on every render
//   - loadStats count queries null-safed
//   - Attendance computed from real attendance_records table
//   - loadClasses early return handled gracefully
//   - Suspended student shown proper screen
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { formatGPA, getHonourClass, timeAgo } from '../../../lib/helpers'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Student {
  id: string
  first_name: string
  last_name: string
  matric_number: string
  level: string
  status: string
  gpa: number
  cgpa: number
  departments?: { name: string }
}

interface ClassSlot {
  id: string
  start_time: string
  end_time: string
  venue: string
  courses: { course_code: string; course_name: string }
}

interface Notif {
  id: string
  title: string
  message: string
  type: string
  is_read: boolean
  created_at: string
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function StudentDashboard() {
  const navigate          = useNavigate()
  const { user, signOut } = useAuth()
  const { tenant, slug }  = useTenant()

  const [student,  setStudent]  = useState<Student | null>(null)
  const [classes,  setClasses]  = useState<ClassSlot[]>([])
  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [stats,    setStats]    = useState({ courses: 0, paidFees: 0, totalFees: 0, attendance: 0 })
  const [loading,  setLoading]  = useState(true)
  const [unread,   setUnread]   = useState(0)
  const [error,    setError]    = useState<string | null>(null)

  // FIXED: memoize db so it doesn't recreate every render
  const db = useMemo(() => {
    if (!tenant) return null
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [tenant, slug])

  useEffect(() => {
    if (db && user) load()
  }, [db, user])

  // ── LOAD ALL DATA ─────────────────────────────────────────
  const load = async () => {
    if (!db || !user) return
    setLoading(true)
    setError(null)
    try {
      // FIXED: .maybeSingle() instead of .single() — won't crash if no row
      const { data: s, error: sErr } = await db
        .from('students')
        .select('id, first_name, last_name, matric_number, level, status, gpa, cgpa, departments(name)')
        .eq('supabase_uid', user.id)
        .maybeSingle()

      if (sErr) {
        console.error('Student load error:', sErr.message)
        setError('Could not load your profile. Please refresh the page.')
        setLoading(false)
        return
      }

      if (!s) {
        setError('Your student record was not found. Contact your admin.')
        setLoading(false)
        return
      }

      setStudent(s as Student)

      // Load everything else in parallel using student.id
      await Promise.allSettled([
        loadClasses(s.id),
        loadNotifs(s.id),
        loadStats(s.id),
      ])
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Something went wrong loading your dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const loadClasses = async (sid: string) => {
    if (!db) return
    const days  = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const today = days[new Date().getDay()]

    // Get registered course IDs for this student
    const { data: regs } = await db
      .from('semester_registrations')
      .select('course_id')
      .eq('student_id', sid)
      .eq('status', 'registered')

    // FIXED: graceful early return — no courses registered is fine
    if (!regs || regs.length === 0) return

    const courseIds = regs.map((r: any) => r.course_id)
    const { data } = await db
      .from('timetable')
      .select('*, courses(course_code, course_name)')
      .in('course_id', courseIds)
      .eq('day_of_week', today)
      .order('start_time')

    if (data) setClasses(data as ClassSlot[])
  }

  const loadNotifs = async (sid: string) => {
    if (!db) return
    const { data } = await db
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${sid},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(6)

    if (data) {
      setNotifs(data as Notif[])
      setUnread(data.filter((n: any) => !n.is_read).length)
    }
  }

  const loadStats = async (sid: string) => {
    if (!db) return

    // FIXED: null-safe count results
    const [regsRes, paymentsRes, feeStructRes, attendRes] = await Promise.allSettled([
      db.from('semester_registrations')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', sid)
        .eq('status', 'registered'),
      db.from('student_payments')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', sid)
        .eq('status', 'success'),
      db.from('fee_structure')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      // FIXED: real attendance query instead of hardcoded 87%
      db.from('attendance_records')
        .select('is_present', { count: 'exact' })
        .eq('student_id', sid),
    ])

    const courses    = regsRes.status    === 'fulfilled' ? (regsRes.value.count    ?? 0) : 0
    const paidFees   = paymentsRes.status === 'fulfilled' ? (paymentsRes.value.count ?? 0) : 0
    const totalFees  = feeStructRes.status === 'fulfilled' ? (feeStructRes.value.count ?? 0) : 0

    // Calculate real attendance percentage
    let attendance = 0
    if (attendRes.status === 'fulfilled' && attendRes.value.data) {
      const records = attendRes.value.data as any[]
      if (records.length > 0) {
        const present = records.filter(r => r.is_present).length
        attendance = Math.round((present / records.length) * 100)
      }
    }

    setStats({ courses, paidFees, totalFees, attendance })
  }

  const markRead = async () => {
    if (!db) return
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (!ids.length) return
    await db.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifs(p => p.map(n => ({ ...n, is_read: true })))
    setUnread(0)
  }

  // ── LOADING ───────────────────────────────────────────────
  if (loading) return (
    <SidebarLayout active="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={S.spin} />
        <p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading your dashboard...</p>
      </div>
    </SidebarLayout>
  )

  // ── ERROR ─────────────────────────────────────────────────
  if (error) return (
    <SidebarLayout active="dashboard">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <p style={{ color: '#f87171', fontSize: 14, maxWidth: 360 }}>{error}</p>
        <button onClick={load} style={S.ghost}>Try again</button>
      </div>
    </SidebarLayout>
  )

  // ── PENDING APPROVAL ──────────────────────────────────────
  if (student?.status === 'pending') return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',system-ui", textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>⏳</div>
        <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 10 }}>
          Awaiting approval
        </h2>
        <p style={{ color: '#7a8bbf', lineHeight: 1.8, marginBottom: 24 }}>
          Hi <strong style={{ color: '#e8eeff' }}>{student.first_name}</strong>, your registration is pending admin approval at{' '}
          <strong style={{ color: '#e8eeff' }}>{tenant?.name}</strong>. You'll be emailed at{' '}
          <strong style={{ color: '#60a5fa' }}>{user?.email}</strong> once activated.
        </p>
        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, color: '#7a8bbf', cursor: 'pointer', fontSize: 13 }}
        >
          Sign out
        </button>
      </div>
    </div>
  )

  // ── SUSPENDED ─────────────────────────────────────────────
  if (student?.status === 'suspended') return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',system-ui", textAlign: 'center' }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🔒</div>
        <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#f87171', marginBottom: 10 }}>Account suspended</h2>
        <p style={{ color: '#7a8bbf', lineHeight: 1.8, marginBottom: 24 }}>
          Your account has been suspended. Please contact the {tenant?.name} admin office for assistance.
        </p>
        <button
          onClick={async () => { await signOut(); navigate('/login') }}
          style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, color: '#7a8bbf', cursor: 'pointer', fontSize: 13 }}
        >
          Sign out
        </button>
      </div>
    </div>
  )

  // ── DERIVE DISPLAY VALUES ─────────────────────────────────
  const firstName = student?.first_name || user?.email?.split('@')[0] || 'Student'
  const lastName  = student?.last_name  || ''
  const initials  = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?'
  const dept      = (student as any)?.departments?.name || ''

  const nc: Record<string, string> = {
    result: '#4ade80', payment: '#fbbf24', info: '#60a5fa', alert: '#f87171', success: '#4ade80',
  }

  const attendanceColor = stats.attendance >= 75 ? '#4ade80' : stats.attendance >= 50 ? '#fbbf24' : '#f87171'

  return (
    <SidebarLayout active="dashboard">

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 'clamp(18px,3vw,24px)', color: '#e8eeff', marginBottom: 4 }}>
            {greeting()},{' '}
            <span style={{ background: 'linear-gradient(135deg,#2d6cff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {firstName}
            </span>{' '}
            👋
          </h1>
          <p style={{ fontSize: 13, color: '#7a8bbf' }}>
            {student?.matric_number}
            {dept ? ` · ${dept}` : ''}
            {student?.level ? ` · ${student.level} Level` : ''}
            {tenant?.name ? ` · ${tenant.name}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => navigate('/settings')} style={S.ghost}>⚙ Settings</button>
          <div
            onClick={() => navigate('/settings')}
            style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 3px 12px rgba(45,108,255,.35)', cursor: 'pointer', flexShrink: 0 }}
          >
            {initials}
          </div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 13, marginBottom: 20 }}>
        {[
          { label: 'Current GPA', value: formatGPA(student?.gpa || 0), sub: '5.0 scale', icon: '⭐', color: (student?.gpa || 0) >= 4.5 ? '#4ade80' : (student?.gpa || 0) >= 3.5 ? '#60a5fa' : '#fbbf24' },
          { label: 'Courses', value: String(stats.courses), sub: 'This semester', icon: '📚', color: '' },
          { label: 'Fees paid', value: `${stats.paidFees}/${stats.totalFees}`, sub: 'Items cleared', icon: '💳', color: stats.paidFees === stats.totalFees && stats.totalFees > 0 ? '#4ade80' : '#fbbf24' },
          { label: 'Attendance', value: stats.attendance > 0 ? `${stats.attendance}%` : '—', sub: 'This semester', icon: '✅', color: stats.attendance > 0 ? attendanceColor : '#7a8bbf' },
        ].map(({ label, value, sub, icon, color }) => (
          <div key={label} style={S.stat}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: color || '#e8eeff', lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: 11, color: '#3d4f7a', marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* CGPA banner */}
      {(student?.cgpa || 0) > 0 && (
        <div style={{ padding: '12px 16px', background: 'rgba(45,108,255,0.08)', border: '1px solid rgba(45,108,255,0.2)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#60a5fa' }}>
            🎓 CGPA: <strong>{formatGPA(student?.cgpa || 0)}</strong> — <strong>{getHonourClass(student?.cgpa || 0)}</strong>
          </span>
          <button onClick={() => navigate('/results')} style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '4px 12px', cursor: 'pointer' }}>
            View results →
          </button>
        </div>
      )}

      {/* ── TWO COLUMN ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 16 }}>

        {/* Quick actions */}
        <div style={S.card}>
          <h3 style={S.ct}>Quick actions</h3>
          {[
            { label: '📊 View my results',   path: '/results',   badge: '',      bc: '' },
            { label: '💳 Pay school fees',   path: '/payments',  badge: 'Due',   bc: '#f87171' },
            { label: '📅 Timetable',         path: '/timetable', badge: '',      bc: '' },
            { label: '📝 Register courses',  path: '/courses',   badge: '',      bc: '' },
            { label: '🗳️ SUG elections',     path: '/voting',    badge: 'Open',  bc: '#4ade80' },
            { label: '🧮 GPA calculator',    path: '/gpa',       badge: '',      bc: '' },
            { label: '🧾 Clearance',         path: '/clearance', badge: '',      bc: '' },
            { label: '🤖 AI assistant',      path: '/ai',        badge: 'New',   bc: '#a855f7' },
          ].map(({ label, path, badge, bc }) => (
            <div
              key={label}
              onClick={() => navigate(path)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)', transition: 'background .15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(45,108,255,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
            >
              <span style={{ fontSize: 13, color: '#e8eeff' }}>{label}</span>
              {badge
                ? <span style={{ fontSize: 10, fontWeight: 700, background: bc + '22', color: bc, padding: '2px 9px', borderRadius: 100 }}>{badge}</span>
                : <span style={{ color: '#3d4f7a', fontSize: 12 }}>→</span>
              }
            </div>
          ))}
        </div>

        {/* Today's classes */}
        <div style={S.card}>
          <h3 style={S.ct}>
            Today's classes
            <span style={{ fontSize: 11, color: '#3d4f7a', fontWeight: 400, marginLeft: 8 }}>
              {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' })}
            </span>
          </h3>
          {classes.length === 0
            ? <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 14, color: '#7a8bbf' }}>No classes today!</div>
                <div style={{ fontSize: 12, color: '#3d4f7a', marginTop: 4 }}>Enjoy your free time, {firstName}.</div>
              </div>
            : classes.map((c, i) => {
                const colors = ['#2d6cff', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
                const col = colors[i % colors.length]
                return (
                  <div key={c.id} style={{ padding: '10px 12px', borderLeft: `3px solid ${col}`, background: col + '12', borderRadius: '0 10px 10px 0', marginBottom: 9 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eeff' }}>{c.courses?.course_code} — {c.courses?.course_name}</div>
                    <div style={{ fontSize: 11, color: '#7a8bbf', marginTop: 2 }}>{c.start_time?.slice(0, 5)} – {c.end_time?.slice(0, 5)}{c.venue && ` · ${c.venue}`}</div>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* ── NOTIFICATIONS ── */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ ...S.ct, margin: 0 }}>
            Notifications
            {unread > 0 && (
              <span style={{ marginLeft: 8, background: '#f87171', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100 }}>
                {unread} new
              </span>
            )}
          </h3>
          {unread > 0 && (
            <button onClick={markRead} style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer' }}>
              Mark all read
            </button>
          )}
        </div>
        {notifs.length === 0
          ? <div style={{ textAlign: 'center', padding: '18px 0', color: '#3d4f7a', fontSize: 13 }}>No notifications yet, {firstName}.</div>
          : notifs.map(n => (
              <div key={n.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: n.is_read ? 0.55 : 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: nc[n.type] || '#60a5fa', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#e8eeff', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: '#7a8bbf', lineHeight: 1.5 }}>{n.message}</div>
                </div>
                <span style={{ fontSize: 11, color: '#3d4f7a', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at)}</span>
              </div>
            ))
        }
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  card:  { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' },
  ct:    { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 },
  stat:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' },
  ghost: { padding: '7px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  spin:  { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}