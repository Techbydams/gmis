// ============================================================
// GMIS — Course Registration
// - Admin controls open/close via org_settings.registration_open
// - Students see ALL active courses in the school
// - Can filter by level, semester, search by code/name
// - Registered courses shown separately with credit unit total
// - Drop only allowed while registration is open
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Course {
  id: string
  course_code: string
  course_name: string
  credit_units: number
  level: string
  semester: string
  departments?: { name: string }
  lecturers?: { full_name: string }
}

interface Registration {
  id: string
  course_id: string
  status: string
}

export default function CourseRegistration() {
  const navigate         = useNavigate()
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()

  const [studentId,      setStudentId]      = useState<string | null>(null)
  const [courses,        setCourses]        = useState<Course[]>([])
  const [registrations,  setRegistrations]  = useState<Registration[]>([])
  const [regOpen,        setRegOpen]        = useState(false)
  const [session,        setSession]        = useState('')
  const [semester,       setSemester]       = useState('')
  const [loading,        setLoading]        = useState(true)
  const [actionId,       setActionId]       = useState<string | null>(null)
  const [search,         setSearch]         = useState('')
  const [filterLevel,    setFilterLevel]    = useState('')
  const [filterSemester, setFilterSemester] = useState('')

  const db = useMemo(() => {
    if (!tenant) return null
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [tenant, slug])

  useEffect(() => { if (db && user) load() }, [db, user])

  const load = async () => {
    if (!db || !user) return
    setLoading(true)
    try {
      // Get student record
      const { data: s } = await db
        .from('students')
        .select('id')
        .eq('supabase_uid', user.id)
        .maybeSingle()

      if (!s) { setLoading(false); return }
      setStudentId(s.id)

      // Load all in parallel
      await Promise.all([
        loadSettings(),
        loadCourses(),
        loadRegistrations(s.id),
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async () => {
    if (!db) return
    const { data } = await db.from('org_settings').select('registration_open, current_session, current_semester').maybeSingle()
    if (data) {
      setRegOpen(data.registration_open === 'true' || data.registration_open === true)
      setSession(data.current_session || '2024/2025')
      setSemester(data.current_semester || 'first')
    }
  }

  const loadCourses = async () => {
    if (!db) return
    const { data } = await db
      .from('courses')
      .select('id, course_code, course_name, credit_units, level, semester, departments(name), lecturers(full_name)')
      .eq('is_active', true)
      .order('course_code')
    if (data) setCourses(data as Course[])
  }

  const loadRegistrations = async (sid: string) => {
    if (!db) return
    const { data } = await db
      .from('semester_registrations')
      .select('id, course_id, status')
      .eq('student_id', sid)
    if (data) setRegistrations(data as Registration[])
  }

  const register = async (course: Course) => {
    if (!db || !studentId) return
    if (!regOpen) { toast.error('Registration is currently closed.'); return }

    setActionId(course.id)
    try {
      const { error } = await db.from('semester_registrations').insert({
        student_id: studentId,
        course_id:  course.id,
        session,
        semester,
        status:     'registered',
      } as any)

      if (error) {
        if (error.code === '23505') {
          toast.error('You are already registered for this course.')
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success(`✓ Registered for ${course.course_code}`)
      await loadRegistrations(studentId)
    } finally {
      setActionId(null)
    }
  }

  const drop = async (course: Course) => {
    if (!db || !studentId) return
    if (!regOpen) { toast.error('Registration is closed — you cannot drop courses now.'); return }
    if (!confirm(`Drop ${course.course_code} — ${course.course_name}?`)) return

    setActionId(course.id)
    try {
      const reg = registrations.find(r => r.course_id === course.id)
      if (!reg) return

      const { error } = await db
        .from('semester_registrations')
        .delete()
        .eq('id', reg.id)

      if (error) { toast.error(error.message); return }

      toast.success(`Dropped ${course.course_code}`)
      await loadRegistrations(studentId)
    } finally {
      setActionId(null)
    }
  }

  // ── DERIVED STATE ─────────────────────────────────────────
  const registeredIds = new Set(registrations.map(r => r.course_id))

  const registeredCourses = courses.filter(c => registeredIds.has(c.id))
  const totalUnits        = registeredCourses.reduce((sum, c) => sum + (c.credit_units || 0), 0)

  const availableCourses = courses.filter(c => {
    if (registeredIds.has(c.id)) return false
    if (filterLevel    && c.level    !== filterLevel)    return false
    if (filterSemester && c.semester !== filterSemester) return false
    if (search) {
      const q = search.toLowerCase()
      return c.course_code.toLowerCase().includes(q) || c.course_name.toLowerCase().includes(q)
    }
    return true
  })

  const levels    = [...new Set(courses.map(c => c.level))].sort()
  const semesters = [...new Set(courses.map(c => c.semester as string))]

  // ── LOADING ───────────────────────────────────────────────
  if (loading) return (
    <SidebarLayout active="courses">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={S.spin} />
        <p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading courses...</p>
      </div>
    </SidebarLayout>
  )

  return (
    <SidebarLayout active="courses">

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.title}>Course registration</h1>
        <p style={S.sub}>
          {session} · {semester.charAt(0).toUpperCase() + semester.slice(1)} semester · {tenant?.name}
        </p>
      </div>

      {/* ── STATUS BANNER ── */}
      <div style={{
        padding: '14px 18px',
        background: regOpen ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
        border: `1px solid ${regOpen ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
        borderRadius: 14,
        marginBottom: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: regOpen ? '#4ade80' : '#f87171', marginBottom: 2 }}>
            {regOpen ? '🟢 Registration is open' : '🔴 Registration is closed'}
          </div>
          <div style={{ fontSize: 12, color: '#7a8bbf' }}>
            {regOpen
              ? 'You can register and drop courses until the admin closes registration.'
              : 'Course registration is currently closed. Contact your admin for assistance.'}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#e8eeff', fontWeight: 600 }}>
          {registeredCourses.length} course{registeredCourses.length !== 1 ? 's' : ''} · {totalUnits} units
        </div>
      </div>

      {/* ── REGISTERED COURSES ── */}
      {registeredCourses.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...S.ct, margin: 0 }}>
              My registered courses
              <span style={{ marginLeft: 10, fontSize: 12, color: '#7a8bbf', fontWeight: 400 }}>
                {totalUnits} total credit units
              </span>
            </h3>
            {totalUnits > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: totalUnits >= 15 && totalUnits <= 24 ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)',
                color:      totalUnits >= 15 && totalUnits <= 24 ? '#4ade80' : '#fbbf24',
                padding: '3px 10px', borderRadius: 100,
              }}>
                {totalUnits >= 15 && totalUnits <= 24 ? '✓ Valid load' : totalUnits < 15 ? 'Under minimum' : 'Over maximum'}
              </span>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>
                  {['Code', 'Course name', 'Units', 'Level', 'Semester', 'Lecturer', regOpen ? 'Action' : ''].filter(Boolean).map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registeredCourses.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{c.course_code}</td>
                    <td style={{ ...S.td, color: '#e8eeff' }}>{c.course_name}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{c.credit_units}</td>
                    <td style={S.td}>{c.level} Level</td>
                    <td style={{ ...S.td, textTransform: 'capitalize' }}>{c.semester}</td>
                    <td style={{ ...S.td, fontSize: 12, color: '#7a8bbf' }}>{(c.lecturers as any)?.full_name || '—'}</td>
                    {regOpen && (
                      <td style={S.td}>
                        <button
                          onClick={() => drop(c)}
                          disabled={actionId === c.id}
                          style={{ ...S.btnDanger, opacity: actionId === c.id ? 0.6 : 1 }}
                        >
                          {actionId === c.id ? '...' : 'Drop'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AVAILABLE COURSES ── */}
      <div style={S.card}>
        <h3 style={{ ...S.ct, marginBottom: 16 }}>
          {regOpen ? 'Available courses' : 'All courses this semester'}
        </h3>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by code or name..."
            style={{ ...S.input, flex: 1, minWidth: 180 }}
          />
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...S.input, maxWidth: 130 }}>
            <option value="">All levels</option>
            {levels.map(l => <option key={l} value={l}>{l} Level</option>)}
          </select>
          <select value={filterSemester} onChange={e => setFilterSemester(e.target.value)} style={{ ...S.input, maxWidth: 140 }}>
            <option value="">All semesters</option>
            {semesters.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{String(s).charAt(0).toUpperCase() + String(s).slice(1)} Semester</option>)}
          </select>
          {(search || filterLevel || filterSemester) && (
            <button onClick={() => { setSearch(''); setFilterLevel(''); setFilterSemester('') }} style={S.btnSm}>
              Clear
            </button>
          )}
        </div>

        {/* Course list */}
        {availableCourses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
            <div style={{ fontSize: 14, color: '#7a8bbf' }}>
              {search || filterLevel || filterSemester
                ? 'No courses match your filters.'
                : registeredCourses.length > 0
                ? 'You have registered all available courses!'
                : 'No courses are available for registration yet.'}
            </div>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 12 }}>
              {availableCourses.length} course{availableCourses.length !== 1 ? 's' : ''} available
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr>
                    {['Code', 'Course name', 'Units', 'Level', 'Semester', 'Department', 'Lecturer', regOpen ? 'Action' : ''].filter(Boolean).map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {availableCourses.map(c => (
                    <tr key={c.id} style={{ transition: 'background .15s' }}>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{c.course_code}</td>
                      <td style={{ ...S.td, color: '#e8eeff' }}>{c.course_name}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{c.credit_units}</td>
                      <td style={S.td}>{c.level} Level</td>
                      <td style={{ ...S.td, textTransform: 'capitalize' }}>{c.semester}</td>
                      <td style={{ ...S.td, fontSize: 12, color: '#7a8bbf' }}>{(c.departments as any)?.name || '—'}</td>
                      <td style={{ ...S.td, fontSize: 12, color: '#7a8bbf' }}>{(c.lecturers as any)?.full_name || 'Unassigned'}</td>
                      {regOpen && (
                        <td style={S.td}>
                          <button
                            onClick={() => register(c)}
                            disabled={actionId === c.id}
                            style={{ ...S.btnPrimary, opacity: actionId === c.id ? 0.6 : 1 }}
                          >
                            {actionId === c.id ? '...' : 'Register'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Back */}
      <div style={{ marginTop: 16 }}>
        <button onClick={() => navigate('/student')} style={S.btnSm}>← Back to dashboard</button>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:     { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#7a8bbf' },
  card:      { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  ct:        { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 },
  th:        { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:        { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  input:     { padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',system-ui", width: '100%' },
  btnPrimary:{ padding: '6px 16px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", whiteSpace: 'nowrap' as const },
  btnDanger: { padding: '6px 14px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 9, color: '#f87171', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", whiteSpace: 'nowrap' as const },
  btnSm:     { padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  spin:      { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}