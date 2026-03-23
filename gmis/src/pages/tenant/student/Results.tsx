// ============================================================
// GMIS — Student Results
// Shows: CA, Exam, Total, Grade, Grade Points per course
// Grouped by semester with semester GPA
// Full CGPA calculated across all semesters
// Grading: CA/40 + Exam/60 = Total/100
// A(5.0)=70+, B(4.0)=60-69, C(3.0)=50-59, D(2.0)=45-49,
//            E(1.0)=40-44, F(0.0)=0-39
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { calcGrade, gradeColor, calcGPA, calcCGPA, formatGPA, getHonourClass, CA_MAX, EXAM_MAX } from '../../../lib/grading'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Result {
  id: string
  ca_score: number
  exam_score: number
  grade: string
  grade_point: number
  published: boolean
  session: string
  semester: string
  courses: {
    course_code: string
    course_name: string
    credit_units: number
    departments?: { name: string }
  }
}

export default function StudentResults() {
  const navigate         = useNavigate()
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()

  const [results,  setResults]  = useState<Result[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('')  // 'session|semester' key

  const db = useMemo(() => {
    if (!tenant) return null
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [tenant, slug])

  useEffect(() => { if (db && user) load() }, [db, user])

  const load = async () => {
    if (!db || !user) return
    setLoading(true)
    setError(null)
    try {
      // Get student id first
      const { data: s } = await db
        .from('students')
        .select('id')
        .eq('supabase_uid', user.id)
        .maybeSingle()

      if (!s) { setError('Student record not found.'); setLoading(false); return }

      const { data, error: rErr } = await db
        .from('results')
        .select(`
          id, ca_score, exam_score, grade, grade_point,
          published, session, semester,
          courses ( course_code, course_name, credit_units, departments(name) )
        `)
        .eq('student_id', s.id)
        .eq('published', true)
        .order('session', { ascending: false })

      if (rErr) { setError('Could not load results.'); setLoading(false); return }

      const data_ = (data || []) as Result[]
      setResults(data_)

      // Auto-select most recent semester
      if (data_.length > 0) {
        const key = `${data_[0].session}|${data_[0].semester}`
        setActiveTab(key)
      }
    } finally {
      setLoading(false)
    }
  }

  // Group results by session + semester
  const grouped = useMemo(() => {
    const map = new Map<string, Result[]>()
    results.forEach(r => {
      const key = `${r.session}|${r.semester}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    // Sort: latest session first, first semester before second
    return [...map.entries()].sort(([a], [b]) => {
      const [sa, semA] = a.split('|')
      const [sb, semB] = b.split('|')
      if (sa !== sb) return sb.localeCompare(sa)
      return semA === 'second' ? 1 : -1
    })
  }, [results])

  // CGPA from all published results
  const cgpaRows = useMemo(() =>
    results.map(r => ({
      credit_units: r.courses?.credit_units || 0,
      grade_point:  r.grade_point || 0,
    }))
  , [results])
  const cgpa        = calcCGPA(cgpaRows)
  const honourClass = getHonourClass(cgpa)
  const totalUnits  = cgpaRows.reduce((s, r) => s + r.credit_units, 0)

  // ── LOADING ───────────────────────────────────────────────
  if (loading) return (
    <SidebarLayout active="results">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={S.spin} />
        <p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading your results...</p>
      </div>
    </SidebarLayout>
  )

  if (error) return (
    <SidebarLayout active="results">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <p style={{ color: '#f87171', fontSize: 14 }}>{error}</p>
        <button onClick={load} style={S.btnSm}>Try again</button>
      </div>
    </SidebarLayout>
  )

  return (
    <SidebarLayout active="results">

      {/* ── HEADER ── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.title}>My results</h1>
        <p style={S.sub}>{tenant?.name}</p>
      </div>

      {results.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '64px 32px' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#e8eeff', marginBottom: 8 }}>No results yet</div>
          <div style={{ fontSize: 13, color: '#7a8bbf' }}>Your results will appear here once your lecturers upload and your admin releases them.</div>
          <button onClick={() => navigate('/student')} style={{ ...S.btnSm, marginTop: 20 }}>← Back to dashboard</button>
        </div>
      ) : (
        <>
          {/* ── CGPA SUMMARY CARD ── */}
          <div style={{ ...S.card, background: 'rgba(45,108,255,0.06)', border: '1px solid rgba(45,108,255,0.18)', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
              {[
                { label: 'CGPA', value: formatGPA(cgpa), sub: 'Cumulative', color: cgpa >= 4.5 ? '#4ade80' : cgpa >= 3.5 ? '#60a5fa' : cgpa >= 2.4 ? '#fbbf24' : '#f87171' },
                { label: 'Honour class', value: honourClass, sub: '5.0 scale', color: '#e8eeff' },
                { label: 'Total units', value: String(totalUnits), sub: 'Earned', color: '#e8eeff' },
                { label: 'Semesters', value: String(grouped.length), sub: 'Completed', color: '#e8eeff' },
              ].map(({ label, value, sub, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: label === 'Honour class' ? 14 : 26, fontWeight: 800, color, lineHeight: 1.2 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#3d4f7a', marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── SEMESTER TABS ── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {grouped.map(([key, rows]) => {
              const [session, sem] = key.split('|')
              const gpa = calcGPA(rows.map(r => ({ credit_units: r.courses?.credit_units || 0, grade_point: r.grade_point || 0 })))
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: activeTab === key ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',system-ui",
                    background: activeTab === key ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
                    color: activeTab === key ? '#fff' : '#7a8bbf',
                    border: activeTab === key ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {session} · {sem.charAt(0).toUpperCase() + sem.slice(1)}
                  <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 11 }}>GPA {formatGPA(gpa)}</span>
                </button>
              )
            })}
          </div>

          {/* ── ACTIVE SEMESTER RESULTS ── */}
          {grouped.filter(([key]) => key === activeTab).map(([key, rows]) => {
            const [session, sem] = key.split('|')
            const semRows  = rows.map(r => ({ credit_units: r.courses?.credit_units || 0, grade_point: r.grade_point || 0 }))
            const semGPA   = calcGPA(semRows)
            const semUnits = semRows.reduce((s, r) => s + r.credit_units, 0)
            const semPassed = rows.filter(r => (r.grade_point || 0) >= 1.0).length

            return (
              <div key={key} style={S.card}>
                {/* Semester header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 6 }}>
                      {session} — {sem.charAt(0).toUpperCase() + sem.slice(1)} Semester
                    </h3>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      {[
                        ['Semester GPA', formatGPA(semGPA), semGPA >= 4.5 ? '#4ade80' : semGPA >= 3.5 ? '#60a5fa' : '#fbbf24'],
                        ['Credit units', String(semUnits), '#e8eeff'],
                        ['Courses passed', `${semPassed}/${rows.length}`, semPassed === rows.length ? '#4ade80' : '#fbbf24'],
                      ].map(([l, v, c]) => (
                        <div key={l}>
                          <span style={{ fontSize: 12, color: '#3d4f7a' }}>{l}: </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Grading key */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 11, color: '#3d4f7a', marginRight: 4 }}>Grade key:</span>
                  {[['A','70+','5.0','#4ade80'],['B','60-69','4.0','#60a5fa'],['C','50-59','3.0','#fbbf24'],['D','45-49','2.0','#fb923c'],['E','40-44','1.0','#f97316'],['F','0-39','0.0','#f87171']].map(([g,r,p,c])=>(
                    <span key={g} style={{ fontSize: 11, color: c, fontWeight: 600 }}>
                      {g}<span style={{ fontWeight: 400, color: '#3d4f7a' }}>({r})={p}</span>
                    </span>
                  ))}
                </div>

                {/* Results table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 580 }}>
                    <thead>
                      <tr>
                        {['Course code', 'Course name', 'Units', `CA /${CA_MAX}`, `Exam /${EXAM_MAX}`, 'Total /100', 'Grade', 'Points', 'Credit×Points', 'Remark'].map(h => (
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const total   = (r.ca_score || 0) + (r.exam_score || 0)
                        const grade   = r.grade || calcGrade(r.ca_score || 0, r.exam_score || 0).grade
                        const points  = r.grade_point ?? calcGrade(r.ca_score || 0, r.exam_score || 0).points
                        const units   = r.courses?.credit_units || 0
                        const wt      = points * units
                        const gc      = gradeColor(grade)
                        const passed  = points >= 1.0
                        return (
                          <tr key={r.id}>
                            <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>
                              {r.courses?.course_code}
                            </td>
                            <td style={{ ...S.td, color: '#e8eeff' }}>{r.courses?.course_name}</td>
                            <td style={{ ...S.td, textAlign: 'center', color: '#e8eeff', fontWeight: 600 }}>{units}</td>
                            <td style={{ ...S.td, textAlign: 'center', color: '#e8eeff', fontWeight: 600 }}>{r.ca_score ?? '—'}</td>
                            <td style={{ ...S.td, textAlign: 'center', color: '#e8eeff', fontWeight: 600 }}>{r.exam_score ?? '—'}</td>
                            <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: total >= 70 ? '#4ade80' : total >= 50 ? '#fbbf24' : '#f87171', fontSize: 14 }}>
                              {total}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: gc, background: gc + '18', padding: '3px 12px', borderRadius: 100 }}>
                                {grade}
                              </span>
                            </td>
                            <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#e8eeff' }}>
                              {points.toFixed(1)}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center', color: '#7a8bbf' }}>
                              {wt.toFixed(1)}
                            </td>
                            <td style={{ ...S.td }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: passed ? '#4ade80' : '#f87171', background: passed ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', padding: '2px 9px', borderRadius: 100 }}>
                                {passed ? 'Pass' : 'Fail'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {/* GPA row */}
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ ...S.td, fontWeight: 700, color: '#e8eeff', borderTop: '2px solid rgba(255,255,255,0.12)' }}>Semester total</td>
                        <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#e8eeff', borderTop: '2px solid rgba(255,255,255,0.12)' }}>{semUnits}</td>
                        <td colSpan={4} style={{ ...S.td, borderTop: '2px solid rgba(255,255,255,0.12)' }}></td>
                        <td style={{ ...S.td, textAlign: 'center', borderTop: '2px solid rgba(255,255,255,0.12)' }}>
                          <span style={{ fontWeight: 800, fontSize: 14, color: semGPA >= 4.5 ? '#4ade80' : semGPA >= 3.5 ? '#60a5fa' : '#fbbf24' }}>
                            GPA: {formatGPA(semGPA)}
                          </span>
                        </td>
                        <td style={{ ...S.td, borderTop: '2px solid rgba(255,255,255,0.12)' }}></td>
                        <td style={{ ...S.td, borderTop: '2px solid rgba(255,255,255,0.12)' }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:  { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:    { fontSize: 13, color: '#7a8bbf' },
  card:   { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  th:     { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:     { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  btnSm:  { padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  spin:   { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}