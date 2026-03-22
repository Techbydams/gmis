// ============================================================
// GMIS — Student Results Page
// Lives at estam.gmis.com/results
// ============================================================

import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { formatGPA, getHonourClass } from '../../../lib/helpers'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Result {
  id:          string
  ca_score:    number
  exam_score:  number
  total_score: number
  grade:       string
  grade_point: number
  remark:      string
  published:   boolean
  session:     string
  semester:    string
  courses: {
    course_code: string
    course_name: string
    credit_units: number
  }
}

interface SemesterSummary {
  session:   string
  semester:  string
  gpa:       number
  units:     number
  results:   Result[]
}

export default function StudentResults() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const [results,   setResults]   = useState<Result[]>([])
  const [loading,   setLoading]   = useState(true)
  const [session,   setSession]   = useState('2024/2025')
  const [semester,  setSemester]  = useState('first')
  const [studentId, setStudentId] = useState<string | null>(null)
  const [cgpa,      setCgpa]      = useState(0)

  const client = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => {
    if (!client || !user) return
    loadResults()
  }, [client, user, session, semester])

  const loadResults = async () => {
    if (!client || !user) return
    setLoading(true)

    // Get student ID
    const { data: student } = await client
      .from('students')
      .select('id, cgpa')
      .eq('supabase_uid', user.id)
      .single()

    if (!student) { setLoading(false); return }
    setStudentId(student.id)
    setCgpa(student.cgpa || 0)

    // Get results for selected session/semester
    const { data } = await client
      .from('results')
      .select('*, courses(course_code, course_name, credit_units)')
      .eq('student_id', student.id)
      .eq('session', session)
      .eq('semester', semester)
      .eq('published', true)
      .order('created_at')

    setResults((data || []) as Result[])
    setLoading(false)
  }

  // Calculate GPA from results
  const calcGPA = (res: Result[]) => {
    const published = res.filter(r => r.grade_point !== null && r.grade_point !== undefined)
    if (!published.length) return 0
    const totalPoints = published.reduce((s, r) => s + (r.grade_point * (r.courses?.credit_units || 3)), 0)
    const totalUnits  = published.reduce((s, r) => s + (r.courses?.credit_units || 3), 0)
    return totalUnits > 0 ? totalPoints / totalUnits : 0
  }

  const semGPA   = calcGPA(results)
  const totalUnits = results.reduce((s, r) => s + (r.courses?.credit_units || 3), 0)

  const gradeColor = (grade: string) => {
    if (['A'].includes(grade))     return '#4ade80'
    if (['B'].includes(grade))     return '#60a5fa'
    if (['C'].includes(grade))     return '#fbbf24'
    if (['D','E'].includes(grade)) return '#fb923c'
    return '#f87171'
  }

  return (
    <SidebarLayout active="results">
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.pageTitle}>Academic results</h1>
        <p style={S.pageSub}>View your published examination results</p>
      </div>

      {/* Session/Semester filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={S.filterLabel}>Session</label>
          <select style={S.select} value={session} onChange={e => setSession(e.target.value)}>
            {['2024/2025','2023/2024','2022/2023'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label style={S.filterLabel}>Semester</label>
          <select style={S.select} value={semester} onChange={e => setSemester(e.target.value)}>
            <option value="first">First semester</option>
            <option value="second">Second semester</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 13, marginBottom: 22 }}>
        {[
          { label: 'Semester GPA', value: loading ? '...' : formatGPA(semGPA),  icon: '⭐', color: semGPA >= 4.5 ? '#4ade80' : semGPA >= 3.5 ? '#60a5fa' : '#fbbf24' },
          { label: 'CGPA',         value: loading ? '...' : formatGPA(cgpa),    icon: '📈', color: '' },
          { label: 'Credit units', value: loading ? '...' : String(totalUnits), icon: '📚', color: '' },
          { label: 'Classification', value: loading ? '...' : getHonourClass(cgpa).split(' ').slice(0,2).join(' '), icon: '🎓', color: '#60a5fa' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={S.statCard}>
            <div style={{ fontSize: 20, marginBottom: 7 }}>{icon}</div>
            <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: value.length > 8 ? 13 : 22, fontWeight: 800, color: color || '#e8eeff', lineHeight: 1.2 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Results table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={S.spinner} />
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3d4f7a' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 14, color: '#7a8bbf' }}>No published results for {session} {semester} semester yet.</div>
            <div style={{ fontSize: 12, color: '#3d4f7a', marginTop: 6 }}>Results appear here once your admin releases them.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  {['Course code','Course title','Units','CA /40','Exam /60','Total','Grade','Remark'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.id}>
                    <td style={S.td}><strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{r.courses?.course_code}</strong></td>
                    <td style={S.td}>{r.courses?.course_name}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{r.courses?.credit_units}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{r.ca_score ?? '—'}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>{r.exam_score ?? '—'}</td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <strong style={{ color: '#e8eeff', fontSize: 14 }}>{r.total_score ?? '—'}</strong>
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, background: gradeColor(r.grade) + '20', color: gradeColor(r.grade), padding: '3px 10px', borderRadius: 100 }}>
                        {r.grade || '—'}
                      </span>
                    </td>
                    <td style={S.td}>
                      <span style={{ fontSize: 12, color: r.remark === 'pass' ? '#4ade80' : r.remark === 'fail' ? '#f87171' : '#fbbf24', textTransform: 'capitalize' }}>
                        {r.remark || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr style={{ background: 'rgba(45,108,255,0.06)' }}>
                  <td colSpan={2} style={{ ...S.td, fontWeight: 700, color: '#e8eeff' }}>Semester summary</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#e8eeff' }}>{totalUnits}</td>
                  <td colSpan={3} style={S.td} />
                  <td colSpan={2} style={{ ...S.td, fontWeight: 700, color: '#60a5fa' }}>GPA: {formatGPA(semGPA)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Actions */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={S.btnPrimary} onClick={() => window.print()}>🖨️ Print result slip</button>
          <button style={S.btnSecondary}>📄 Download transcript</button>
        </div>
      )}
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  pageTitle:   { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  pageSub:     { fontSize: 13, color: '#7a8bbf' },
  filterLabel: { fontSize: 11, color: '#7a8bbf', display: 'block', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.8 },
  select:      { padding: '8px 13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#e8eeff', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", outline: 'none' },
  statCard:    { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' },
  card:        { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  th:          { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:          { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  spinner:     { width: 28, height: 28, border: '2px solid rgba(45,108,255,.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' },
  btnPrimary:  { padding: '10px 20px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSecondary:{ padding: '10px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, color: '#7a8bbf', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
}