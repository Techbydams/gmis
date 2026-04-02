// ============================================================
// GMIS — GPA Calculator
// estam.gmis.app/gpa
// ============================================================
import { useState } from 'react'
import { formatGPA, getHonourClass } from '../../../lib/helpers'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface CourseRow { id: number; code: string; units: string; grade: string }

const GRADE_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 }
const GRADE_RANGES: Record<string, string> = { A: '70–100', B: '60–69', C: '50–59', D: '45–49', E: '40–44', F: '0–39' }

let nextId = 6
const DEFAULT_COURSES: CourseRow[] = [
  { id: 1, code: 'CSC301', units: '3', grade: 'A' },
  { id: 2, code: 'CSC303', units: '3', grade: 'B' },
  { id: 3, code: 'CSC305', units: '3', grade: 'A' },
  { id: 4, code: 'MTH301', units: '2', grade: 'C' },
  { id: 5, code: 'CSC307', units: '3', grade: 'A' },
]

export default function GPACalculator() {
  const [courses, setCourses] = useState<CourseRow[]>(DEFAULT_COURSES)
  const [cgpa,    setCgpa]    = useState('')

  const totalUnits  = courses.reduce((s, c) => s + (parseFloat(c.units) || 0), 0)
  const totalPoints = courses.reduce((s, c) => s + (GRADE_POINTS[c.grade] || 0) * (parseFloat(c.units) || 0), 0)
  const gpa         = totalUnits > 0 ? totalPoints / totalUnits : 0
  const honour      = getHonourClass(gpa)
  const honourColor = gpa >= 4.5 ? '#4ade80' : gpa >= 3.5 ? '#60a5fa' : gpa >= 2.5 ? '#fbbf24' : '#f87171'

  const addCourse = () => {
    setCourses(p => [...p, { id: nextId++, code: '', units: '3', grade: 'B' }])
  }

  const removeCourse = (id: number) => {
    if (courses.length <= 1) return
    setCourses(p => p.filter(c => c.id !== id))
  }

  const update = (id: number, field: keyof CourseRow, val: string) => {
    setCourses(p => p.map(c => c.id === id ? { ...c, [field]: val } : c))
  }

  const reset = () => { setCourses(DEFAULT_COURSES); setCgpa('') }

  // Projected CGPA if user enters current CGPA
  const projectedCGPA = () => {
    const c = parseFloat(cgpa)
    if (!c || c < 0 || c > 5) return null
    return ((c + gpa) / 2).toFixed(2)
  }

  return (
    <SidebarLayout active="gpa">
      <h1 style={S.title}>GPA Calculator</h1>
      <p style={S.sub}>Simulate your GPA before results are released. Grades are not saved.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16, marginBottom: 24 }}>

        {/* GPA result */}
        <div style={{ ...S.card, textAlign: 'center', padding: '32px 24px', background: 'linear-gradient(135deg,rgba(45,108,255,0.12),rgba(79,62,248,0.08))', border: '1px solid rgba(45,108,255,0.25)' }}>
          <div style={{ fontSize: 11, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Calculated GPA</div>
          <div style={{ fontFamily: "'Syne',system-ui", fontSize: 68, fontWeight: 900, background: 'linear-gradient(135deg,#2d6cff,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
            {formatGPA(gpa)}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: honourColor, marginTop: 10 }}>{honour}</div>
          <div style={{ fontSize: 12, color: '#3d4f7a', marginTop: 6 }}>{totalUnits} credit units</div>
        </div>

        {/* Grade scale */}
        <div style={S.card}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 12 }}>Grade scale</h3>
          {Object.entries(GRADE_POINTS).map(([g, p]) => (
            <div key={g} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: '#e8eeff', width: 20 }}>{g}</span>
              <span style={{ color: '#7a8bbf' }}>{p}.0 pts</span>
              <span style={{ color: '#3d4f7a' }}>{GRADE_RANGES[g]}</span>
            </div>
          ))}
        </div>

        {/* CGPA projection */}
        <div style={S.card}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 8 }}>Projected CGPA</h3>
          <p style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 12, lineHeight: 1.6 }}>Enter your current CGPA to estimate your cumulative GPA after this semester</p>
          <label style={S.label}>Current CGPA (before this semester)</label>
          <input
            type="number" min="0" max="5" step="0.01"
            value={cgpa} onChange={e => setCgpa(e.target.value)}
            placeholder="e.g. 3.85"
            style={{ ...S.input, marginBottom: 12 }}
          />
          {projectedCGPA() && (
            <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#7a8bbf', marginBottom: 4 }}>Estimated new CGPA</div>
              <div style={{ fontFamily: "'Syne',system-ui", fontSize: 28, fontWeight: 900, color: '#4ade80' }}>{projectedCGPA()}</div>
              <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>{getHonourClass(parseFloat(projectedCGPA()!))}</div>
            </div>
          )}
        </div>
      </div>

      {/* Course list */}
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff' }}>Your courses</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={S.btnSm}>Reset</button>
            <button onClick={addCourse} style={S.btnPrimary}>+ Add course</button>
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 40px', gap: 8, marginBottom: 8 }}>
          {['Course code', 'Units', 'Grade', ''].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a' }}>{h}</div>
          ))}
        </div>

        {courses.map(c => {
          const _pts = GRADE_POINTS[c.grade] || 0
          const u   = parseFloat(c.units) || 0
          const gc: Record<string, string> = { A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#fb923c', E: '#f97316', F: '#f87171' }
          return (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 40px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input
                value={c.code} onChange={e => update(c.id, 'code', e.target.value.toUpperCase())}
                placeholder="e.g. CSC301"
                style={{ ...S.input, fontFamily: 'monospace', fontSize: 13 }}
              />
              <select value={c.units} onChange={e => update(c.id, 'units', e.target.value)} style={S.input}>
                {['1','2','3','4','6'].map(u => <option key={u} value={u}>{u} units</option>)}
              </select>
              <select value={c.grade} onChange={e => update(c.id, 'grade', e.target.value)}
                style={{ ...S.input, color: gc[c.grade] || '#e8eeff', fontWeight: 700 }}>
                {Object.keys(GRADE_POINTS).map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={() => removeCourse(c.id)}
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, color: '#f87171', cursor: 'pointer', padding: '7px', fontSize: 12 }}>
                ✕
              </button>
            </div>
          )
        })}

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 40px', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e8eeff' }}>Total / GPA</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#60a5fa' }}>{totalUnits} units</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: honourColor }}>{formatGPA(gpa)}</div>
          <div />
        </div>
      </div>
      <style>{`input:focus,select:focus{outline:none!important;border-color:#2d6cff!important;box-shadow:0 0 0 3px rgba(45,108,255,0.15)!important;}`}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:      { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:        { fontSize: 13, color: '#7a8bbf', marginBottom: 22 },
  card:       { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  label:      { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:      { width: '100%', padding: '8px 11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',system-ui" },
  btnPrimary: { padding: '8px 16px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  btnSm:      { padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer' },
}