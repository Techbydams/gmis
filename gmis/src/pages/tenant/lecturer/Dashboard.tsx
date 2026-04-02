// ============================================================
// GMIS — Lecturer Portal
// FIXED:
//   - initialTab prop added for route-based tab navigation
//   - Math.random() placeholder removed from handouts tab
//   - useEffect deps merged to avoid stale closures
//   - Handouts now queries actual student_payments table
// ============================================================

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { formatDate, timeAgo } from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
interface Course {
  id: string; course_code: string; course_name: string
  credit_units: number; level: string; semester: string
  departments?: { name: string }
}

interface Student {
  id: string; first_name: string; last_name: string
  matric_number: string; level: string
  departments?: { name: string }
}

interface ResultRow {
  id?: string
  student_id: string
  matric_number: string
  student_name: string
  ca_score: string
  exam_score: string
  grade?: string
  is_locked?: boolean
  submitted_at?: string
}

interface HandoutPayment {
  student_id: string
  status: string
  paid_at: string | null
}

type Tab = 'dashboard' | 'students' | 'results' | 'attendance' | 'handouts'

// Grade calculator imported from shared utility (CA/40 + Exam/60, A=70+)
import { calcGrade } from '../../../lib/grading'

export default function LecturerPortal({ initialTab }: { initialTab?: Tab }) {
  const navigate          = useNavigate()
  const { user, signOut } = useAuth()
  const { tenant, slug }  = useTenant()

  const [tab,          setTab]          = useState<Tab>(initialTab || 'dashboard')
  const [lecturer,     setLecturer]     = useState<any>(null)
  const [courses,      setCourses]      = useState<Course[]>([])
  const [selCourse,    setSelCourse]    = useState<string>('')
  const [students,     setStudents]     = useState<Student[]>([])
  const [results,      setResults]      = useState<ResultRow[]>([])
  const [handouts,     setHandouts]     = useState<HandoutPayment[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [search,       setSearch]       = useState('')
  const [qrCode,       setQrCode]       = useState<any>(null)
  const [qrLoading,    setQrLoading]    = useState(false)
  const [qrTimer,      setQrTimer]      = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  // Sync tab with prop on route change
  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  // Initial load
  useEffect(() => {
    if (db && user) loadAll()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [db, user])

  // Reload course-specific data when selected course changes
  useEffect(() => {
    if (selCourse) {
      loadStudents()
      loadResults()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selCourse])

  // Reload handout payments when handouts tab becomes active
  useEffect(() => {
    if (tab === 'handouts' && selCourse && lecturer) {
      loadHandouts()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selCourse, lecturer])

  const loadAll = async () => {
    setLoading(true)
    try {
      const { data: lec } = await db!
        .from('lecturers')
        .select('*, departments(name)')
        .eq('supabase_uid', user!.id)
        .maybeSingle()

      if (lec) {
        setLecturer(lec)
        const lecAny = lec as any
        const { data: c } = await db!
          .from('courses')
          .select('*, departments(name)')
          .eq('lecturer_id', lecAny.id)
          .eq('is_active', true)
          .order('course_code')

        if (c) {
          setCourses(c as Course[])
          if (c.length > 0) setSelCourse((c[0] as any).id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const loadStudents = async () => {
    if (!selCourse || !db) return
    const { data: regs } = await db
      .from('semester_registrations')
      .select('student_id, students(id, first_name, last_name, matric_number, level, departments(name))')
      .eq('course_id', selCourse)
      .eq('status', 'registered')

    if (regs) {
      const studs = regs
        .map((r: any) => r.students)
        .filter((s: any): s is Student => s !== null)
      setStudents(studs)
    }
  }

  const loadResults = async () => {
    if (!selCourse || !db || !lecturer) return
    const { data } = await db
      .from('results')
      .select('id, student_id, ca_score, exam_score, grade, is_locked, submitted_at, students(first_name, last_name, matric_number)')
      .eq('course_id', selCourse)
      .eq('lecturer_id', lecturer.id)

    if (data) {
      const rows: ResultRow[] = data.map((r: any) => ({
        id:            r.id,
        student_id:    r.student_id,
        matric_number: r.students?.matric_number || '',
        student_name:  `${r.students?.first_name || ''} ${r.students?.last_name || ''}`.trim(),
        ca_score:      String(r.ca_score ?? ''),
        exam_score:    String(r.exam_score ?? ''),
        grade:         r.grade,
        is_locked:     r.is_locked,
        submitted_at:  r.submitted_at,
      }))
      setResults(rows)
    }
  }

  // FIXED: Real DB query instead of Math.random()
  const loadHandouts = async () => {
    if (!selCourse || !db) return
    const { data } = await db
      .from('student_payments')
      .select('student_id, status, paid_at')
      .eq('course_id', selCourse)
      .eq('payment_type', 'handout')
    if (data) setHandouts(data as HandoutPayment[])
  }

  const saveResult = async (studentId: string, ca: string, exam: string) => {
    if (!db || !lecturer || !selCourse) return
    const caNum   = parseFloat(ca)   || 0
    const examNum = parseFloat(exam) || 0

    if (caNum < 0 || caNum > 40)    { toast.error('CA score must be between 0 and 40'); return }
    if (examNum < 0 || examNum > 60) { toast.error('Exam score must be between 0 and 60'); return }

    const { grade, points, remark } = calcGrade(caNum, examNum)

    const { data: settings } = await db.from('org_settings').select('current_session, current_semester').maybeSingle()
    const settingsAny = settings as any
    const session  = settingsAny?.current_session  || '2024/2025'
    const semester = settingsAny?.current_semester || 'first'

    const { error } = await db.from('results').upsert(({
      student_id:  studentId,
      course_id:   selCourse,
      lecturer_id: (lecturer as any).id,
      session, semester,
      ca_score:    caNum,
      exam_score:  examNum,
      grade, grade_point: points, remark,
      published:   false, is_locked: false,
      uploaded_by: lecturer.id,
    } as any), { onConflict: 'student_id,course_id,session,semester' })

    if (error) { toast.error('Failed to save result'); return }
    toast.success('Result saved')
    loadResults()
  }

  const submitAllResults = async () => {
    if (!db || !lecturer || !selCourse) return
    const unsubmitted = results.filter(r => !r.is_locked && r.ca_score)
    if (!unsubmitted.length) { toast.error('No results to submit yet'); return }

    setSaving(true)
    const { error } = await db.from('results')
      .update({ submitted_at: new Date().toISOString(), is_locked: true } as any)
      .eq('course_id', selCourse)
      .eq('lecturer_id', lecturer.id)
      .is('submitted_at', null)

    setSaving(false)
    if (error) { toast.error('Failed to submit results'); return }
    toast.success('Results submitted and locked. Admin must approve before students can see them.')
    loadResults()
  }

  const generateQR = async () => {
    if (!db || !lecturer || !selCourse) return
    setQrLoading(true)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    const { data, error } = await db.from('qr_codes').insert(({
      course_id:   selCourse,
      lecturer_id: (lecturer as any).id,
      class_date:  new Date().toISOString().split('T')[0],
      venue:       'Lecture Hall',
      expires_at:  expiresAt,
      is_active:   true,
    } as any)).select().single()

    setQrLoading(false)
    if (error || !data) { toast.error('Failed to generate QR code'); return }

    setQrCode(data)
    setQrTimer(15 * 60)

    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setQrTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!)
          setQrCode(null)
          toast.error('QR code expired')
          return 0
        }
        return t - 1
      })
    }, 1000)

    toast.success('QR code generated — valid for 15 minutes')
  }

  const formatTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (loading) return (
    <SidebarLayout active="dashboard" role="lecturer">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
        <div style={S.spin} /><p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading lecturer portal...</p>
      </div>
    </SidebarLayout>
  )

  if (!lecturer) return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',system-ui", textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: 56, marginBottom: 16 }}>👨‍🏫</div>
        <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, color: '#e8eeff', marginBottom: 10 }}>Lecturer account not found</h2>
        <p style={{ color: '#7a8bbf', marginBottom: 20, maxWidth: 400 }}>Your email is not registered as a lecturer. Contact your admin.</p>
        <button onClick={async () => { await signOut(); navigate('/login') }} style={S.btnSm}>Sign out</button>
      </div>
    </div>
  )

  const course      = courses.find(c => c.id === selCourse)
  const allLocked   = results.length > 0 && results.every(r => r.is_locked)
  const gc: Record<string, string> = { A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#fb923c', E: '#f97316', F: '#f87171' }

  return (
    <SidebarLayout active={tab} role="lecturer">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={S.title}>{lecturer.full_name} 👨‍🏫</h1>
          <p style={S.sub}>{lecturer.departments?.name || 'Lecturer'} · {tenant?.name}</p>
        </div>
        <select
          value={selCourse}
          onChange={e => setSelCourse(e.target.value)}
          style={{ ...S.input, maxWidth: 320 }}
        >
          {courses.length === 0
            ? <option>No courses assigned yet</option>
            : courses.map(c => <option key={c.id} value={c.id}>{c.course_code} — {c.course_name} ({c.level} Level)</option>)
          }
        </select>
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {([
          ['dashboard',  '🏠 Overview'],
          ['students',   '👨‍🎓 My Students'],
          ['results',    '📊 Upload Results'],
          ['attendance', '📱 QR Attendance'],
          ['handouts',   '💳 Handout Payments'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...S.tabBtn, background: tab === id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)', color: tab === id ? '#fff' : '#7a8bbf', border: tab === id ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'dashboard' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 13, marginBottom: 22 }}>
            {[
              { icon: '📚', label: 'Courses assigned',   value: courses.length },
              { icon: '👨‍🎓', label: 'Students',          value: students.length },
              { icon: '📊', label: 'Results uploaded',   value: results.filter(r => r.ca_score).length },
              { icon: '🔒', label: 'Submitted',          value: results.filter(r => r.is_locked).length },
            ].map(({ icon, label, value }) => (
              <div key={label} style={S.stat}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#e8eeff' }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={S.ct}>Assigned courses</h3>
            {courses.length === 0 ? <Empty icon="📚" text="No courses assigned yet. Contact your admin." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Code', 'Course name', 'Units', 'Level', 'Semester', 'Results', 'Status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {courses.map(c => {
                    const cr     = results.filter(r => r.ca_score)
                    const locked = cr.every(r => r.is_locked) && cr.length > 0
                    return (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{c.course_code}</td>
                        <td style={S.td}>{c.course_name}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{c.credit_units}</td>
                        <td style={S.td}>{c.level} Level</td>
                        <td style={{ ...S.td, textTransform: 'capitalize' }}>{c.semester}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{cr.length}</td>
                        <td style={S.td}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: locked ? 'rgba(74,222,128,.15)' : 'rgba(251,191,36,.15)', color: locked ? '#4ade80' : '#fbbf24', padding: '2px 9px', borderRadius: 100 }}>
                            {locked ? '🔒 Submitted' : '⏳ Pending'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── STUDENTS ── */}
      {tab === 'students' && (
        <>
          <div style={{ marginBottom: 18 }}>
            <h2 style={S.ct}>{course?.course_code} — Registered students ({students.length})</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by matric or name..." style={{ ...S.input, maxWidth: 280 }} />
          </div>
          <div style={S.card}>
            {students.length === 0 ? <Empty icon="👨‍🎓" text="No students registered for this course yet." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Student', 'Matric no.', 'Level', 'Department', 'Result status'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {students
                    .filter(s => !search || s.matric_number.toLowerCase().includes(search.toLowerCase()) || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
                    .map(s => {
                      const res = results.find(r => r.student_id === s.id)
                      return (
                        <tr key={s.id}>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                {s.first_name[0]}{s.last_name[0]}
                              </div>
                              <span style={{ fontWeight: 600, color: '#e8eeff', fontSize: 13 }}>{s.first_name} {s.last_name}</span>
                            </div>
                          </td>
                          <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontSize: 12 }}>{s.matric_number}</td>
                          <td style={S.td}>{s.level} Level</td>
                          <td style={{ ...S.td, color: '#7a8bbf' }}>{s.departments?.name || '—'}</td>
                          <td style={S.td}>
                            {res?.is_locked
                              ? <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '2px 9px', borderRadius: 100 }}>🔒 Submitted</span>
                              : res?.ca_score
                              ? <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(96,165,250,.15)', color: '#60a5fa', padding: '2px 9px', borderRadius: 100 }}>📝 Saved</span>
                              : <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,.15)', color: '#fbbf24', padding: '2px 9px', borderRadius: 100 }}>⏳ Pending</span>
                            }
                          </td>
                        </tr>
                      )
                    })
                  }
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── RESULTS ── */}
      {tab === 'results' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={S.ct}>Upload results — {course?.course_code}</h2>
              <p style={{ fontSize: 13, color: '#7a8bbf' }}>CA out of 40 · Exam out of 60</p>
            </div>
            {!allLocked && results.some(r => r.ca_score) && (
              <button onClick={submitAllResults} disabled={saving}
                style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#059669,#047857)', opacity: saving ? 0.7 : 1 }}>
                {saving ? '...' : '🔒 Submit & lock all results'}
              </button>
            )}
          </div>

          {allLocked && (
            <div style={{ padding: '14px 18px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 14, marginBottom: 18, fontSize: 13, color: '#4ade80' }}>
              🔒 All results submitted. Only the admin can make changes now.
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..." style={{ ...S.input, maxWidth: 360 }} />
          </div>

          <div style={S.card}>
            {students.length === 0 ? <Empty icon="📊" text="No students registered for this course." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>{['Matric no.', 'Student name', 'CA /40', 'Exam /60', 'Total', 'Grade', 'Status', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {students
                      .filter(s => !search || s.matric_number.toLowerCase().includes(search.toLowerCase()) || `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase()))
                      .map(s => {
                        const res = results.find(r => r.student_id === s.id) || {
                          student_id: s.id, matric_number: s.matric_number,
                          student_name: `${s.first_name} ${s.last_name}`,
                          ca_score: '', exam_score: '', is_locked: false,
                        }
                        const caNum   = parseFloat(res.ca_score)   || 0
                        const examNum = parseFloat(res.exam_score) || 0
                        const { grade } = calcGrade(caNum, examNum)

                        return (
                          <tr key={s.id}>
                            <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontSize: 12 }}>{s.matric_number}</td>
                            <td style={S.td}>{s.first_name} {s.last_name}</td>
                            <td style={S.td}>
                              {res.is_locked
                                ? <span style={{ fontWeight: 700, color: '#e8eeff' }}>{res.ca_score || '—'}</span>
                                : <input type="number" min="0" max="40" step="0.5" value={res.ca_score}
                                    onChange={e => setResults(prev =>
                                      prev.some(r => r.student_id === s.id)
                                        ? prev.map(r => r.student_id === s.id ? { ...r, ca_score: e.target.value } : r)
                                        : [...prev, { ...res, ca_score: e.target.value }]
                                    )}
                                    style={S.scoreInput} placeholder="0" />
                              }
                            </td>
                            <td style={S.td}>
                              {res.is_locked
                                ? <span style={{ fontWeight: 700, color: '#e8eeff' }}>{res.exam_score || '—'}</span>
                                : <input type="number" min="0" max="60" step="0.5" value={res.exam_score}
                                    onChange={e => setResults(prev =>
                                      prev.some(r => r.student_id === s.id)
                                        ? prev.map(r => r.student_id === s.id ? { ...r, exam_score: e.target.value } : r)
                                        : [...prev, { ...res, exam_score: e.target.value }]
                                    )}
                                    style={S.scoreInput} placeholder="0" />
                              }
                            </td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#e8eeff', textAlign: 'center' }}>
                              {res.ca_score || res.exam_score ? caNum + examNum : '—'}
                            </td>
                            <td style={{ ...S.td, textAlign: 'center' }}>
                              {res.ca_score || res.exam_score
                                ? <span style={{ fontSize: 12, fontWeight: 800, background: (gc[grade] || '#7a8bbf') + '20', color: gc[grade] || '#7a8bbf', padding: '3px 10px', borderRadius: 100 }}>{grade}</span>
                                : '—'
                              }
                            </td>
                            <td style={S.td}>
                              {res.is_locked
                                ? <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 600 }}>🔒 Locked</span>
                                : res.ca_score
                                ? <span style={{ fontSize: 10, color: '#fbbf24' }}>Unsaved</span>
                                : <span style={{ fontSize: 10, color: '#3d4f7a' }}>Empty</span>
                              }
                            </td>
                            <td style={S.td}>
                              {res.is_locked
                                ? <span style={{ fontSize: 11, color: '#3d4f7a' }}>Admin only</span>
                                : <button
                                    onClick={() => saveResult(s.id, res.ca_score, res.exam_score)}
                                    disabled={!res.ca_score && !res.exam_score}
                                    style={{ ...S.btnSm, opacity: !res.ca_score && !res.exam_score ? 0.4 : 1 }}
                                  >Save</button>
                              }
                            </td>
                          </tr>
                        )
                      })
                    }
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── QR ATTENDANCE ── */}
      {tab === 'attendance' && (
        <>
          <h2 style={S.ct}>QR attendance — {course?.course_code}</h2>
          <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 22 }}>Students scan to mark attendance. Expires in 15 minutes.</p>

          {!qrCode ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '48px 32px' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>📱</div>
              <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 18, color: '#e8eeff', marginBottom: 8 }}>Generate QR code</h3>
              <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 24 }}>Valid for <strong style={{ color: '#e8eeff' }}>15 minutes</strong></p>
              <button onClick={generateQR} disabled={qrLoading || !selCourse} style={S.btnPrimary}>
                {qrLoading ? '...' : '📱 Generate QR code'}
              </button>
            </div>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', padding: '36px 32px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: qrTimer > 120 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${qrTimer > 120 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, borderRadius: 100, padding: '6px 18px', marginBottom: 24 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: qrTimer > 120 ? '#4ade80' : '#f87171' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: qrTimer > 120 ? '#4ade80' : '#f87171' }}>Expires in {formatTimer(qrTimer)}</span>
              </div>
              <div style={{ width: 180, height: 180, background: '#fff', borderRadius: 16, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxShadow: '0 8px 32px rgba(45,108,255,0.2)' }}>
                <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: 'repeat(9,1fr)', gap: 2 }}>
                  {qrCode.id.replace(/-/g, '').split('').slice(0, 81).map((c: string, i: number) => (
                    <div key={i} style={{ background: parseInt(c, 16) > 7 ? '#000' : '#fff', borderRadius: 1 }} />
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#60a5fa', marginBottom: 20, background: 'rgba(255,255,255,0.05)', padding: '8px 14px', borderRadius: 10 }}>
                {qrCode.id}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={generateQR} style={S.btnSm}>New code</button>
                <button onClick={() => { setQrCode(null); clearInterval(timerRef.current!) }} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── HANDOUT PAYMENTS ── */}
      {tab === 'handouts' && (
        <>
          <h2 style={S.ct}>Handout payments — {course?.course_code}</h2>
          <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 18 }}>Students who have paid for course handouts</p>
          <div style={S.card}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Matric no.', 'Student name', 'Payment status', 'Date paid'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {students.map(s => {
                    const payment = handouts.find(h => h.student_id === s.id)
                    const paid = payment?.status === 'success'
                    return (
                      <tr key={s.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontSize: 12 }}>{s.matric_number}</td>
                        <td style={S.td}>{s.first_name} {s.last_name}</td>
                        <td style={S.td}>
                          <span style={{ fontSize: 11, fontWeight: 700, background: paid ? 'rgba(74,222,128,.15)' : 'rgba(248,113,113,.15)', color: paid ? '#4ade80' : '#f87171', padding: '2px 9px', borderRadius: 100 }}>
                            {paid ? 'Paid ✓' : 'Not paid'}
                          </span>
                        </td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>
                          {payment?.paid_at ? formatDate(payment.paid_at) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {students.length === 0 && <Empty icon="💳" text="No students registered for this course." />}
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, color: '#7a8bbf' }}>{text}</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  title:     { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#7a8bbf' },
  card:      { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  ct:        { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 },
  stat:      { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' },
  th:        { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:        { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  tabBtn:    { padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", transition: 'all .2s' },
  btnPrimary:{ padding: '9px 20px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSm:     { padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  input:     { padding: '9px 13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',system-ui", width: '100%' },
  scoreInput:{ width: 60, padding: '6px 8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, color: '#e8eeff', fontSize: 13, textAlign: 'center', outline: 'none', fontFamily: "'DM Sans',system-ui" },
  spin:      { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}