// ============================================================
// GMIS — Admin Timetable Management
// FIXED:
//   - Wrapped in SidebarLayout
//   - Department filter now correctly matches using course_id lookup
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import SidebarLayout from '../../../components/layout/SidebarLayout'
import toast from 'react-hot-toast'
import type { TenantDatabase } from '../../../types/tenant'

// ── TYPES ─────────────────────────────────────────────────
type Day = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'

interface TTEntry {
  id: string
  course_id: string
  lecturer_id: string | null
  day_of_week: Day
  start_time: string
  end_time: string
  venue: string | null
  session: string | null
  semester: string | null
  courses?: {
    course_code: string
    course_name: string
    level: string
    department_id?: string
    departments?: { id: string; name: string }
    lecturers?: { full_name: string }
  }
}

interface Course {
  id: string
  course_code: string
  course_name: string
  level: string
  department_id: string
  lecturer_id: string | null
  departments?: { name: string }
  lecturers?: { full_name: string }
}

interface Dept { id: string; name: string; code: string }
interface Settings { current_session: string; current_semester: string }

// ── CONSTANTS ─────────────────────────────────────────────
const DAYS: Day[] = ['monday','tuesday','wednesday','thursday','friday','saturday']
const DAY_LABELS: Record<Day, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
  thursday: 'Thu', friday: 'Fri', saturday: 'Sat',
}
const DAY_FULL: Record<Day, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday',
}
const LEVELS = ['100','200','300','400','500','600']

const todayIdx = new Date().getDay()
const todayName: Day = DAYS[todayIdx - 1] ?? 'monday'

const fmtTime = (t: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

const parseCSV = (text: string): Record<string, string>[] => {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/['"]/g, ''))
    return headers.reduce((o, h, i) => ({ ...o, [h]: vals[i] || '' }), {} as Record<string, string>)
  })
}

const BLANK_FORM = {
  course_id: '', day_of_week: 'monday' as Day,
  start_time: '', end_time: '', venue: '',
  session: '', semester: 'first',
}

// ── COMPONENT ─────────────────────────────────────────────
export default function AdminTimetable() {
  const { tenant, slug } = useTenant()
  const db = useMemo(
    () => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
    [tenant, slug]
  )

  const [entries,  setEntries]  = useState<TTEntry[]>([])
  const [courses,  setCourses]  = useState<Course[]>([])
  const [depts,    setDepts]    = useState<Dept[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading,  setLoading]  = useState(true)

  // Filters
  const [fDept,     setFDept]     = useState('')
  const [fLevel,    setFLevel]    = useState('')
  const [fSession,  setFSession]  = useState('')
  const [fSemester, setFSemester] = useState('')

  // View
  const [view,      setView]      = useState<'schedule'|'manage'>('schedule')
  const [activeDay, setActiveDay] = useState<Day>(todayName)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<TTEntry | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState({ ...BLANK_FORM })

  // CSV
  const [csvRows,   setCsvRows]   = useState<Record<string, string>[]>([])
  const [showCSV,   setShowCSV]   = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => { if (db) loadAll() }, [db])

  const loadAll = async () => {
    if (!db) return
    setLoading(true)
    const [eRes, cRes, dRes, sRes] = await Promise.all([
      db.from('timetable')
        .select('*, courses(course_code, course_name, level, department_id, departments(id, name), lecturers(full_name))')
        .order('day_of_week').order('start_time'),
      db.from('courses')
        .select('id, course_code, course_name, level, department_id, lecturer_id, departments(name), lecturers(full_name)')
        .eq('is_active', true).order('course_code'),
      db.from('departments').select('id, name, code').eq('is_active', true).order('name'),
      db.from('org_settings').select('current_session, current_semester').maybeSingle(),
    ])
    if (eRes.data) setEntries(eRes.data as TTEntry[])
    if (cRes.data) setCourses(cRes.data as Course[])
    if (dRes.data) setDepts(dRes.data as Dept[])
    if (sRes.data) {
      const s = sRes.data as any
      setSettings(s)
      setFSession(s.current_session)
      setFSemester(s.current_semester)
      setForm(f => ({ ...f, session: s.current_session, semester: s.current_semester }))
    }
    setLoading(false)
  }

  // ── FILTERED DATA ────────────────────────────────────────
  // FIXED: Department filter now uses course_id to look up department_id from courses array
  const filtered = useMemo(() => entries.filter(e => {
    const c = e.courses
    if (!c) return true

    if (fDept) {
      // Use the flat department_id from the courses join, or look it up from courses array
      const deptId = c.department_id || courses.find(co => co.id === e.course_id)?.department_id
      if (deptId !== fDept) return false
    }

    if (fLevel && c.level !== fLevel) return false
    if (fSession  && e.session  && e.session  !== fSession)  return false
    if (fSemester && e.semester && e.semester !== fSemester) return false
    return true
  }), [entries, courses, fDept, fLevel, fSession, fSemester])

  const byDay = useMemo(() => {
    const map = {} as Record<Day, TTEntry[]>
    DAYS.forEach(d => { map[d] = [] })
    filtered.forEach(e => { if (map[e.day_of_week]) map[e.day_of_week].push(e) })
    return map
  }, [filtered])

  // ── MODAL HELPERS ────────────────────────────────────────
  const openAdd = () => {
    setEditEntry(null)
    setForm({
      ...BLANK_FORM,
      session:  settings?.current_session  || '',
      semester: settings?.current_semester || 'first',
    })
    setShowModal(true)
  }

  const openEdit = (e: TTEntry) => {
    setEditEntry(e)
    setForm({
      course_id:   e.course_id,
      day_of_week: e.day_of_week,
      start_time:  e.start_time.slice(0, 5),
      end_time:    e.end_time.slice(0, 5),
      venue:       e.venue    || '',
      session:     e.session  || settings?.current_session || '',
      semester:    e.semester || 'first',
    })
    setShowModal(true)
  }

  const saveEntry = async () => {
    if (!db) return
    if (!form.course_id)  { toast.error('Select a course'); return }
    if (!form.start_time) { toast.error('Enter start time'); return }
    if (!form.end_time)   { toast.error('Enter end time'); return }
    if (form.start_time >= form.end_time) { toast.error('End time must be after start time'); return }
    setSaving(true)
    const course = courses.find(c => c.id === form.course_id)
    const payload = {
      course_id:   form.course_id,
      lecturer_id: course?.lecturer_id || null,
      day_of_week: form.day_of_week,
      start_time:  form.start_time,
      end_time:    form.end_time,
      venue:       form.venue || null,
      session:     form.session || null,
      semester:    form.semester,
    }
    const { error } = editEntry
      ? await db.from('timetable').update(payload as any).eq('id', editEntry.id)
      : await db.from('timetable').insert(payload as any)
    setSaving(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
    toast.success(editEntry ? 'Entry updated' : 'Entry added')
    setShowModal(false)
    loadAll()
  }

  const deleteEntry = async (id: string) => {
    if (!db || !confirm('Delete this timetable slot?')) return
    const { error } = await db.from('timetable').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    toast.success('Deleted')
    setEntries(p => p.filter(e => e.id !== id))
  }

  // ── CSV HELPERS ──────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      if (rows.length === 0) { toast.error('No valid rows found in CSV'); return }
      setCsvRows(rows)
      setShowCSV(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const importCSV = async () => {
    if (!db || csvRows.length === 0) return
    setImporting(true)
    let ok = 0, fail = 0
    for (const row of csvRows) {
      const course = courses.find(c => c.course_code.toLowerCase() === row.course_code?.toLowerCase())
      if (!course) { fail++; continue }
      const { error } = await db.from('timetable').insert({
        course_id:   course.id,
        lecturer_id: course.lecturer_id || null,
        day_of_week: row.day_of_week?.toLowerCase(),
        start_time:  row.start_time,
        end_time:    row.end_time,
        venue:       row.venue || null,
        session:     row.session  || settings?.current_session  || null,
        semester:    row.semester || settings?.current_semester || 'first',
      } as any)
      if (error) fail++; else ok++
    }
    setImporting(false)
    toast.success(`Imported ${ok} entries${fail ? `, ${fail} skipped` : ''}`)
    setShowCSV(false)
    setCsvRows([])
    loadAll()
  }

  const downloadTemplate = () => {
    const session  = settings?.current_session  || '2024/2025'
    const semester = settings?.current_semester || 'first'
    const csv = [
      'course_code,day_of_week,start_time,end_time,venue,session,semester',
      `CSC101,monday,08:00,10:00,Room 201,${session},${semester}`,
      `MTH201,tuesday,10:00,12:00,LT3,${session},${semester}`,
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'timetable_template.csv'
    a.click()
  }

  const selectedCourse = courses.find(c => c.id === form.course_id)

  if (loading) return (
    <SidebarLayout active="timetable" role="admin">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div style={S.spin} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </SidebarLayout>
  )

  return (
    <SidebarLayout active="timetable" role="admin">
      <div style={{ fontFamily: "'DM Sans',system-ui", color: '#e8eeff' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, margin: 0, color: '#e8eeff' }}>
              Class Timetable
            </h2>
            <p style={{ fontSize: 13, color: '#7a8bbf', margin: '4px 0 0' }}>
              {filtered.length} entries · {settings?.current_session || '—'} · {settings?.current_semester || '—'} semester
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={downloadTemplate} style={S.btnSm}>⬇ Template</button>
            <label style={{ ...S.btnSm, cursor: 'pointer' }}>
              📂 Import CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
            <button onClick={openAdd} style={S.btnPrimary}>+ Add Entry</button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <select value={fDept} onChange={e => setFDept(e.target.value)} style={S.select}>
            <option value="">All departments</option>
            {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={fLevel} onChange={e => setFLevel(e.target.value)} style={S.select}>
            <option value="">All levels</option>
            {LEVELS.map(l => <option key={l} value={l}>{l}L</option>)}
          </select>
          <select value={fSemester} onChange={e => setFSemester(e.target.value)} style={S.select}>
            <option value="">All semesters</option>
            <option value="first">First semester</option>
            <option value="second">Second semester</option>
          </select>
          <input
            value={fSession}
            onChange={e => setFSession(e.target.value)}
            placeholder="Session e.g. 2024/2025"
            style={{ ...S.select, minWidth: 160 }}
          />
        </div>

        {/* View toggle */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {(['schedule', 'manage'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
              fontFamily: "'DM Sans',system-ui", transition: 'all .15s', fontWeight: v === view ? 700 : 400,
              background: v === view ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
              color: v === view ? '#fff' : '#7a8bbf',
              border: v === view ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>
              {v === 'schedule' ? '📅 Schedule View' : '⚙️ Manage Entries'}
            </button>
          ))}
        </div>

        {/* ── SCHEDULE VIEW ── */}
        {view === 'schedule' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
              {DAYS.map(d => {
                const isToday = d === todayName
                const count   = byDay[d].length
                return (
                  <button key={d} onClick={() => setActiveDay(d)} style={{
                    padding: '8px 14px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
                    fontFamily: "'DM Sans',system-ui", transition: 'all .15s',
                    background: activeDay === d ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
                    color: activeDay === d ? '#fff' : isToday ? '#60a5fa' : '#7a8bbf',
                    border: activeDay === d ? 'none' : isToday ? '1px solid rgba(96,165,250,0.3)' : '1px solid rgba(255,255,255,0.08)',
                    fontWeight: isToday ? 700 : 400,
                  }}>
                    {DAY_LABELS[d]}{isToday ? ' · Today' : ''}
                    {count > 0 && <span style={{ marginLeft: 5, opacity: 0.7, fontSize: 11 }}>({count})</span>}
                  </button>
                )
              })}
            </div>

            {byDay[activeDay].length === 0 ? (
              <div style={{ textAlign: 'center', padding: '52px 0', color: '#3d4f7a' }}>
                <div style={{ fontSize: 38, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, marginBottom: 16 }}>No classes scheduled for {DAY_FULL[activeDay]}</div>
                <button onClick={openAdd} style={S.btnPrimary}>+ Add Class</button>
              </div>
            ) : (
              [...byDay[activeDay]]
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map(e => <EntryCard key={e.id} e={e} onEdit={openEdit} onDelete={deleteEntry} />)
            )}
          </>
        )}

        {/* ── MANAGE VIEW ── */}
        {view === 'manage' && (
          filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 0', color: '#3d4f7a' }}>
              <div style={{ fontSize: 14 }}>No entries match your filters.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    {['Day','Time','Course','Dept / Level','Venue','Lecturer',''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...filtered]
                    .sort((a, b) =>
                      DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) ||
                      a.start_time.localeCompare(b.start_time)
                    )
                    .map(e => (
                      <tr
                        key={e.id}
                        style={{ transition: 'background .15s' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                      >
                        <td style={S.td}>
                          <span style={{ fontWeight: 600, textTransform: 'capitalize', color: e.day_of_week === todayName ? '#60a5fa' : '#e8eeff' }}>
                            {e.day_of_week}
                          </span>
                        </td>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                          {fmtTime(e.start_time)} – {fmtTime(e.end_time)}
                        </td>
                        <td style={S.td}>
                          <div style={{ fontWeight: 600, color: '#e8eeff', fontSize: 13 }}>{e.courses?.course_code}</div>
                          <div style={{ fontSize: 11, color: '#7a8bbf' }}>{e.courses?.course_name}</div>
                        </td>
                        <td style={{ ...S.td, fontSize: 12 }}>
                          <div style={{ color: '#7a8bbf' }}>{(e.courses?.departments as any)?.name || '—'}</div>
                          {e.courses?.level && <div style={{ color: '#3d4f7a', fontSize: 11 }}>{e.courses.level}L</div>}
                        </td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{e.venue || '—'}</td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{(e.courses?.lecturers as any)?.full_name || '—'}</td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openEdit(e)} style={S.btnIcon} title="Edit">✏️</button>
                            <button onClick={() => deleteEntry(e.id)} style={S.btnIcon} title="Delete">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* ── ADD/EDIT MODAL ── */}
        {showModal && (
          <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <div style={S.modal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: 0 }}>
                  {editEntry ? 'Edit Entry' : 'Add Timetable Entry'}
                </h3>
                <button onClick={() => setShowModal(false)} style={S.btnClose}>×</button>
              </div>

              <div style={S.field}>
                <label style={S.label}>Course *</label>
                <select
                  value={form.course_id}
                  onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))}
                  style={S.input}
                >
                  <option value="">Select course...</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.course_code} — {c.course_name} ({c.level}L)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourse && (
                <div style={{ padding: '9px 12px', background: 'rgba(45,108,255,0.08)', border: '1px solid rgba(45,108,255,0.2)', borderRadius: 9, marginBottom: 14, fontSize: 12, color: '#60a5fa' }}>
                  ℹ Visible to: <strong>{(selectedCourse.departments as any)?.name || 'all'} — {selectedCourse.level}L</strong>
                  {(selectedCourse.lecturers as any)?.full_name && (
                    <span style={{ color: '#7a8bbf' }}> · Lecturer: {(selectedCourse.lecturers as any).full_name}</span>
                  )}
                </div>
              )}

              <div style={S.field}>
                <label style={S.label}>Day *</label>
                <select
                  value={form.day_of_week}
                  onChange={e => setForm(p => ({ ...p, day_of_week: e.target.value as Day }))}
                  style={S.input}
                >
                  {DAYS.map(d => <option key={d} value={d}>{DAY_FULL[d]}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>Start time *</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    style={S.input}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>End time *</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                    style={S.input}
                  />
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Venue</label>
                <input
                  value={form.venue}
                  onChange={e => setForm(p => ({ ...p, venue: e.target.value }))}
                  placeholder="e.g. Room 201, LT3, Online"
                  style={S.input}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={S.field}>
                  <label style={S.label}>Session</label>
                  <input
                    value={form.session}
                    onChange={e => setForm(p => ({ ...p, session: e.target.value }))}
                    placeholder={settings?.current_session || '2024/2025'}
                    style={S.input}
                  />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Semester</label>
                  <select
                    value={form.semester}
                    onChange={e => setForm(p => ({ ...p, semester: e.target.value }))}
                    style={S.input}
                  >
                    <option value="first">First</option>
                    <option value="second">Second</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowModal(false)} style={S.btnSm}>Cancel</button>
                <button onClick={saveEntry} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : editEntry ? 'Update' : 'Add Entry'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CSV PREVIEW MODAL ── */}
        {showCSV && (
          <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowCSV(false)}>
            <div style={{ ...S.modal, maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: 0 }}>
                  CSV Preview — {csvRows.length} rows
                </h3>
                <button onClick={() => setShowCSV(false)} style={S.btnClose}>×</button>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 300, overflowY: 'auto', marginBottom: 14, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {Object.keys(csvRows[0] || {}).map(h => <th key={h} style={S.th}>{h}</th>)}
                      <th style={S.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => {
                      const found = courses.some(c => c.course_code.toLowerCase() === row.course_code?.toLowerCase())
                      return (
                        <tr key={i} style={{ opacity: found ? 1 : 0.5 }}>
                          {Object.values(row).map((v, j) => <td key={j} style={S.td}>{v}</td>)}
                          <td style={S.td}>
                            {found
                              ? <span style={{ color: '#4ade80', fontWeight: 700 }}>✓ OK</span>
                              : <span style={{ color: '#f87171' }}>✗ Course not found</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 14 }}>
                Rows with unrecognised course codes will be skipped.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setShowCSV(false); setCsvRows([]) }} style={S.btnSm}>Cancel</button>
                <button onClick={importCSV} disabled={importing} style={{ ...S.btnPrimary, opacity: importing ? 0.7 : 1 }}>
                  {importing
                    ? 'Importing...'
                    : `Import ${csvRows.filter(r => courses.some(c => c.course_code.toLowerCase() === r.course_code?.toLowerCase())).length} Valid Rows`
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} input:focus,select:focus{outline:none;border-color:#2d6cff!important;box-shadow:0 0 0 3px rgba(45,108,255,0.15)}`}</style>
      </div>
    </SidebarLayout>
  )
}

// ── ENTRY CARD ────────────────────────────────────────────
function EntryCard({ e, onEdit, onDelete }: { e: TTEntry; onEdit: (e: TTEntry) => void; onDelete: (id: string) => void | Promise<void> }) {
  return (
    <div style={{
      background: 'rgba(45,108,255,0.06)', border: '1px solid rgba(45,108,255,0.15)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 10,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ minWidth: 76, textAlign: 'center', background: 'rgba(45,108,255,0.12)', borderRadius: 8, padding: '8px 6px', flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{fmtTime(e.start_time)}</div>
        <div style={{ fontSize: 9, color: '#3d4f7a', margin: '3px 0' }}>——</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>{fmtTime(e.end_time)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e8eeff' }}>
          <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{e.courses?.course_code}</span>
          {' '}{e.courses?.course_name}
        </div>
        <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {e.venue && <span>📍 {e.venue}</span>}
          {(e.courses?.lecturers as any)?.full_name && <span>👤 {(e.courses?.lecturers as any).full_name}</span>}
          {(e.courses?.departments as any)?.name && <span>🏛 {(e.courses?.departments as any).name} · {e.courses?.level}L</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <button onClick={() => onEdit(e)} style={S.btnIcon} title="Edit">✏️</button>
        <button onClick={() => onDelete(e.id)} style={S.btnIcon} title="Delete">🗑️</button>
      </div>
    </div>
  )
}

// ── STYLES ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  spin:       { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  btnPrimary: { padding: '9px 18px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSm:      { padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnIcon:    { padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer', fontSize: 13 },
  btnClose:   { background: 'none', border: 'none', color: '#7a8bbf', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  select:     { padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#e8eeff', fontSize: 12, fontFamily: "'DM Sans',system-ui" },
  field:      { marginBottom: 14 },
  label:      { fontSize: 11, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8eeff', fontSize: 13, fontFamily: "'DM Sans',system-ui", boxSizing: 'border-box' },
  th:         { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:         { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' },
  modal:      { background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
}