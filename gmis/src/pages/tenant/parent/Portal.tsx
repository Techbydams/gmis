// ============================================================
// GMIS — Parent Portal
// Shows all children linked by parent_email in students table
// Read-only: results, CGPA, attendance, fees, news
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { calcGPA, calcCGPA, formatGPA, getHonourClass } from '../../../lib/grading'
import { timeAgo } from '../../../lib/helpers'

interface Child {
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

interface Result {
  id: string
  ca_score: number
  exam_score: number
  grade: string
  grade_point: number
  session: string
  semester: string
  courses: { course_code: string; course_name: string; credit_units: number }
}

interface FeePayment {
  id: string
  status: string
  amount: number
  paid_at: string
  fee_structure: { fee_types: { name: string } }
}

interface NewsItem {
  id: string
  title: string
  content: string
  author_name: string
  created_at: string
}

interface AttendanceSummary {
  total: number
  present: number
}

const gradeColor = (g: string) =>
  ({ A:'#4ade80', B:'#60a5fa', C:'#fbbf24', D:'#fb923c', E:'#f97316', F:'#f87171' }[g] || '#7a8bbf')

export default function ParentPortal() {
  const { user, signOut } = useAuth()
  const { tenant, slug }  = useTenant()

  const [children,    setChildren]    = useState<Child[]>([])
  const [activeChild, setActiveChild] = useState<string>('')
  const [results,     setResults]     = useState<Record<string, Result[]>>({})
  const [payments,    setPayments]    = useState<Record<string, FeePayment[]>>({})
  const [attendance,  setAttendance]  = useState<Record<string, AttendanceSummary>>({})
  const [news,        setNews]        = useState<NewsItem[]>([])
  const [loading,     setLoading]     = useState(true)
  const [childLoading,setChildLoading]= useState(false)
  const [activeTab,   setActiveTab]   = useState<'overview'|'results'|'fees'|'attendance'>('overview')
  const [error,       setError]       = useState<string | null>(null)

  const db = useMemo(() => {
    if (!tenant) return null
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [tenant, slug])

  useEffect(() => { if (db && user) loadInitial() }, [db, user])

  useEffect(() => {
    if (activeChild && db) loadChildData(activeChild)
  }, [activeChild])

  const loadInitial = async () => {
    if (!db || !user) return
    setLoading(true)
    setError(null)
    try {
      // Find all children linked to this parent's auth UID
      const { data: kids, error: kErr } = await db
        .from('students')
        .select('id, first_name, last_name, matric_number, level, status, gpa, cgpa, departments(name)')
        .eq('parent_supabase_uid', user.id)

      if (kErr) { setError('Could not load children records.'); return }
      if (!kids || kids.length === 0) {
        setError('No students linked to your account. Please contact the school admin.')
        return
      }

      setChildren(kids as Child[])
      setActiveChild(kids[0].id)

      // Load school news
      const { data: n } = await db
        .from('news')
        .select('id, title, content, author_name, created_at')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(5)
      if (n) setNews(n as NewsItem[])

    } finally {
      setLoading(false)
    }
  }

  const loadChildData = async (childId: string) => {
    if (!db) return
    setChildLoading(true)
    try {
      await Promise.allSettled([
        loadResults(childId),
        loadPayments(childId),
        loadAttendance(childId),
      ])
    } finally {
      setChildLoading(false)
    }
  }

  const loadResults = async (childId: string) => {
    if (!db || results[childId]) return // cache hit
    const { data } = await db
      .from('results')
      .select('id, ca_score, exam_score, grade, grade_point, session, semester, courses(course_code, course_name, credit_units)')
      .eq('student_id', childId)
      .eq('published', true)
      .order('session', { ascending: false })
    if (data) setResults(p => ({ ...p, [childId]: data as Result[] }))
  }

  const loadPayments = async (childId: string) => {
    if (!db || payments[childId]) return
    const { data } = await db
      .from('student_payments')
      .select('id, status, amount, paid_at, fee_structure(fee_types(name))')
      .eq('student_id', childId)
      .order('paid_at', { ascending: false })
    if (data) setPayments(p => ({ ...p, [childId]: data as FeePayment[] }))
  }

  const loadAttendance = async (childId: string) => {
    if (!db || attendance[childId]) return
    const { data } = await db
      .from('attendance_records')
      .select('is_present')
      .eq('student_id', childId)
    if (data) {
      const total   = data.length
      const present = data.filter((r: any) => r.is_present).length
      setAttendance(p => ({ ...p, [childId]: { total, present } }))
    }
  }

  // ── DERIVED ───────────────────────────────────────────────
  const child       = children.find(c => c.id === activeChild)
  const childRes    = results[activeChild]    || []
  const childPay    = payments[activeChild]   || []
  const childAttend = attendance[activeChild]

  const cgpaRows = childRes.map(r => ({
    credit_units: r.courses?.credit_units || 0,
    grade_point:  r.grade_point || 0,
  }))
  const cgpa        = calcCGPA(cgpaRows)
  const honourClass = getHonourClass(cgpa)

  // Group results by session+semester
  const groupedResults = useMemo(() => {
    const map = new Map<string, Result[]>()
    childRes.forEach(r => {
      const key = `${r.session}|${r.semester}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return [...map.entries()].sort(([a], [b]) => {
      const [sa, semA] = a.split('|')
      const [sb, semB] = b.split('|')
      if (sa !== sb) return sb.localeCompare(sa)
      return semA === 'second' ? 1 : -1
    })
  }, [childRes])

  const paidCount  = childPay.filter(p => p.status === 'success').length
  const attendPct  = childAttend && childAttend.total > 0
    ? Math.round((childAttend.present / childAttend.total) * 100) : null

  // ── LOADING ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: "'DM Sans',system-ui" }}>
      <div style={S.spin} />
      <p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading parent portal...</p>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',system-ui", textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, color: '#e8eeff', marginBottom: 10 }}>Access issue</h2>
        <p style={{ color: '#7a8bbf', lineHeight: 1.8, marginBottom: 24 }}>{error}</p>
        <button onClick={() => { signOut(); window.location.href = '/login' }}
          style={{ padding: '10px 24px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, color: '#7a8bbf', cursor: 'pointer', fontSize: 13 }}>
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#03071a', fontFamily: "'DM Sans',system-ui", color: '#e8eeff' }}>

      {/* ── TOP NAV ── */}
      <div style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>G</div>
          <div>
            <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff' }}>GMIS Parent Portal</div>
            <div style={{ fontSize: 11, color: '#3d4f7a' }}>{tenant?.name}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: '#7a8bbf' }}>{user?.email}</span>
          <button onClick={() => signOut()} style={{ ...S.btnSm, fontSize: 12 }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

        {/* ── CHILD SELECTOR (if multiple) ── */}
        {children.length > 1 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
            {children.map(c => (
              <button key={c.id} onClick={() => { setActiveChild(c.id); setActiveTab('overview') }}
                style={{ padding: '10px 18px', borderRadius: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontSize: 13, fontWeight: activeChild === c.id ? 700 : 400, background: activeChild === c.id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)', color: activeChild === c.id ? '#fff' : '#7a8bbf', border: activeChild === c.id ? 'none' : '1px solid rgba(255,255,255,0.08)', transition: 'all .2s' }}>
                👤 {c.first_name} {c.last_name}
                <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{c.level} Level</span>
              </button>
            ))}
          </div>
        )}

        {/* ── CHILD HEADER ── */}
        {child && (
          <div style={{ ...S.card, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                {child.first_name[0]}{child.last_name[0]}
              </div>
              <div>
                <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 18, color: '#e8eeff' }}>
                  {child.first_name} {child.last_name}
                </div>
                <div style={{ fontSize: 13, color: '#7a8bbf', marginTop: 2 }}>
                  {child.matric_number} · {(child.departments as any)?.name || ''} · {child.level} Level
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: cgpa >= 4.5 ? '#4ade80' : cgpa >= 3.5 ? '#60a5fa' : '#fbbf24' }}>{formatGPA(cgpa)}</div>
                <div style={{ fontSize: 11, color: '#3d4f7a' }}>CGPA</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e8eeff', maxWidth: 140 }}>{honourClass}</div>
                <div style={{ fontSize: 11, color: '#3d4f7a' }}>Honour class</div>
              </div>
              <span style={{ alignSelf: 'center', fontSize: 12, fontWeight: 700, background: child.status === 'active' ? 'rgba(74,222,128,0.12)' : 'rgba(251,191,36,0.12)', color: child.status === 'active' ? '#4ade80' : '#fbbf24', padding: '4px 12px', borderRadius: 100 }}>
                {child.status.charAt(0).toUpperCase() + child.status.slice(1)}
              </span>
            </div>
          </div>
        )}

        {/* ── TAB NAV ── */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            ['overview',    '🏠 Overview'],
            ['results',     '📊 Results'],
            ['fees',        '💳 Fees'],
            ['attendance',  '✅ Attendance'],
          ] as [typeof activeTab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: activeTab === id ? 700 : 400, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", transition: 'all .2s', background: activeTab === id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)', color: activeTab === id ? '#fff' : '#7a8bbf', border: activeTab === id ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
              {label}
            </button>
          ))}
        </div>

        {childLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 14, flexDirection: 'column' }}>
            <div style={S.spin} /><p style={{ color: '#7a8bbf', fontSize: 13 }}>Loading...</p>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>

                {/* Stats */}
                <div style={S.card}>
                  <h3 style={S.ct}>Academic summary</h3>
                  {[
                    { label: 'CGPA', value: formatGPA(cgpa), color: cgpa >= 4.5 ? '#4ade80' : cgpa >= 3.5 ? '#60a5fa' : '#fbbf24' },
                    { label: 'Honour class', value: honourClass, color: '#e8eeff' },
                    { label: 'Semesters completed', value: String(groupedResults.length), color: '#e8eeff' },
                    { label: 'Attendance', value: attendPct !== null ? `${attendPct}%` : '—', color: attendPct !== null ? (attendPct >= 75 ? '#4ade80' : '#f87171') : '#7a8bbf' },
                    { label: 'Fees paid', value: `${paidCount} payment${paidCount !== 1 ? 's' : ''}`, color: '#e8eeff' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                      <span style={{ color: '#7a8bbf' }}>{label}</span>
                      <span style={{ fontWeight: 700, color }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Latest results */}
                <div style={S.card}>
                  <h3 style={S.ct}>Latest results</h3>
                  {childRes.length === 0
                    ? <div style={S.empty}>No published results yet.</div>
                    : childRes.slice(0, 5).map(r => {
                        const total = (r.ca_score || 0) + (r.exam_score || 0)
                        const gc    = gradeColor(r.grade || 'F')
                        return (
                          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <div style={{ fontSize: 13, color: '#e8eeff', fontWeight: 500 }}>{r.courses?.course_code}</div>
                              <div style={{ fontSize: 11, color: '#3d4f7a' }}>{r.session} · {r.semester}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 14, fontWeight: 800, color: gc }}>{r.grade || '—'}</div>
                              <div style={{ fontSize: 11, color: '#7a8bbf' }}>{total}/100</div>
                            </div>
                          </div>
                        )
                      })
                  }
                  {childRes.length > 5 && (
                    <button onClick={() => setActiveTab('results')} style={{ ...S.btnSm, marginTop: 10, width: '100%', textAlign: 'center' as const }}>
                      View all {childRes.length} results →
                    </button>
                  )}
                </div>

                {/* School news */}
                <div style={S.card}>
                  <h3 style={S.ct}>School announcements</h3>
                  {news.length === 0
                    ? <div style={S.empty}>No announcements yet.</div>
                    : news.map(n => (
                        <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eeff', marginBottom: 3 }}>{n.title}</div>
                          <div style={{ fontSize: 12, color: '#7a8bbf', lineHeight: 1.5, marginBottom: 4 }}>{n.content.slice(0, 100)}{n.content.length > 100 ? '...' : ''}</div>
                          <div style={{ fontSize: 11, color: '#3d4f7a' }}>{n.author_name} · {timeAgo(n.created_at)}</div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}

            {/* ── RESULTS ── */}
            {activeTab === 'results' && (
              <div>
                {/* CGPA banner */}
                <div style={{ ...S.card, background: 'rgba(45,108,255,0.06)', border: '1px solid rgba(45,108,255,0.18)', marginBottom: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
                    {[
                      { label: 'CGPA', value: formatGPA(cgpa), color: cgpa >= 4.5 ? '#4ade80' : cgpa >= 3.5 ? '#60a5fa' : '#fbbf24' },
                      { label: 'Honour class', value: honourClass, color: '#e8eeff' },
                      { label: 'Total units', value: String(cgpaRows.reduce((s, r) => s + r.credit_units, 0)), color: '#e8eeff' },
                      { label: 'Semesters', value: String(groupedResults.length), color: '#e8eeff' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: label === 'Honour class' ? 14 : 24, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {groupedResults.length === 0
                  ? <div style={{ ...S.card, textAlign: 'center', padding: '48px 0' }}><div style={S.empty}>No published results yet.</div></div>
                  : groupedResults.map(([key, rows]) => {
                      const [session, sem] = key.split('|')
                      const gpa = calcGPA(rows.map(r => ({ credit_units: r.courses?.credit_units || 0, grade_point: r.grade_point || 0 })))
                      return (
                        <div key={key} style={{ ...S.card, marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                            <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', margin: 0 }}>
                              {session} — {sem.charAt(0).toUpperCase() + sem.slice(1)} Semester
                            </h3>
                            <span style={{ fontSize: 13, fontWeight: 700, color: gpa >= 4.5 ? '#4ade80' : gpa >= 3.5 ? '#60a5fa' : '#fbbf24' }}>
                              GPA: {formatGPA(gpa)}
                            </span>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                              <thead>
                                <tr>{['Course', 'Course name', 'Units', 'CA /40', 'Exam /60', 'Total', 'Grade', 'Points'].map(h => (
                                  <th key={h} style={S.th}>{h}</th>
                                ))}</tr>
                              </thead>
                              <tbody>
                                {rows.map(r => {
                                  const total = (r.ca_score || 0) + (r.exam_score || 0)
                                  const gc    = gradeColor(r.grade || 'F')
                                  return (
                                    <tr key={r.id}>
                                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{r.courses?.course_code}</td>
                                      <td style={{ ...S.td, color: '#e8eeff' }}>{r.courses?.course_name}</td>
                                      <td style={{ ...S.td, textAlign: 'center' }}>{r.courses?.credit_units}</td>
                                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: '#e8eeff' }}>{r.ca_score ?? '—'}</td>
                                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 600, color: '#e8eeff' }}>{r.exam_score ?? '—'}</td>
                                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: total >= 70 ? '#4ade80' : total >= 50 ? '#fbbf24' : '#f87171', fontSize: 14 }}>{total}</td>
                                      <td style={{ ...S.td, textAlign: 'center' }}>
                                        <span style={{ fontSize: 13, fontWeight: 800, color: gc, background: gc + '18', padding: '3px 10px', borderRadius: 100 }}>{r.grade || '—'}</span>
                                      </td>
                                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#e8eeff' }}>{r.grade_point?.toFixed(1) || '—'}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    })
                }
              </div>
            )}

            {/* ── FEES ── */}
            {activeTab === 'fees' && (
              <div style={S.card}>
                <h3 style={S.ct}>Fee payments</h3>
                {childPay.length === 0
                  ? <div style={S.empty}>No payment records found.</div>
                  : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>{['Fee type', 'Amount', 'Status', 'Date paid'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {childPay.map(p => (
                            <tr key={p.id}>
                              <td style={{ ...S.td, color: '#e8eeff', fontWeight: 500 }}>{(p.fee_structure as any)?.fee_types?.name || '—'}</td>
                              <td style={{ ...S.td, fontWeight: 700, color: '#e8eeff' }}>₦{p.amount?.toLocaleString() || '—'}</td>
                              <td style={S.td}>
                                <span style={{ fontSize: 11, fontWeight: 700, background: p.status === 'success' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)', color: p.status === 'success' ? '#4ade80' : '#f87171', padding: '2px 9px', borderRadius: 100 }}>
                                  {p.status === 'success' ? '✓ Paid' : p.status}
                                </span>
                              </td>
                              <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </div>
            )}

            {/* ── ATTENDANCE ── */}
            {activeTab === 'attendance' && (
              <div style={S.card}>
                <h3 style={S.ct}>Attendance summary</h3>
                {!childAttend || childAttend.total === 0
                  ? <div style={S.empty}>No attendance records found yet.</div>
                  : (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                      {/* Big percentage circle */}
                      <div style={{ width: 140, height: 140, borderRadius: '50%', background: `conic-gradient(${attendPct! >= 75 ? '#4ade80' : '#f87171'} ${attendPct}%, rgba(255,255,255,0.06) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 0 0 8px rgba(255,255,255,0.03)' }}>
                        <div style={{ width: 108, height: 108, borderRadius: '50%', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color: attendPct! >= 75 ? '#4ade80' : '#f87171' }}>{attendPct}%</div>
                          <div style={{ fontSize: 11, color: '#3d4f7a' }}>Attendance</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {[
                          ['Classes attended', childAttend.present, '#4ade80'],
                          ['Classes missed', childAttend.total - childAttend.present, '#f87171'],
                          ['Total classes', childAttend.total, '#e8eeff'],
                        ].map(([label, value, color]) => (
                          <div key={label as string} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 24, fontWeight: 800, color: color as string }}>{value as number}</div>
                            <div style={{ fontSize: 12, color: '#7a8bbf' }}>{label as string}</div>
                          </div>
                        ))}
                      </div>
                      {attendPct! < 75 && (
                        <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, fontSize: 13, color: '#f87171', maxWidth: 400, margin: '20px auto 0' }}>
                          ⚠️ Attendance is below 75%. This may affect your child's eligibility to sit exams. Please contact the school.
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            )}
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  card:  { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  ct:    { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 },
  th:    { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:    { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  btnSm: { padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  empty: { textAlign: 'center', padding: '28px 0', color: '#3d4f7a', fontSize: 13 },
  spin:  { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}