// ============================================================
// GMIS — Admin Academic Setup
// Manage faculties, departments, courses, assign lecturers
// This is the source of truth for all academic structure
// ============================================================

import { useState, useEffect } from 'react'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
interface Faculty {
  id: string; name: string; code: string; is_active: boolean
}

interface Department {
  id: string; name: string; code: string; is_active: boolean
  faculty_id: string
  faculties?: { name: string }
}

interface Course {
  id: string; course_code: string; course_name: string
  credit_units: number; level: string; semester: string
  is_active: boolean; is_elective: boolean
  department_id: string; lecturer_id: string | null
  departments?: { name: string }
  lecturers?: { full_name: string }
}

interface Lecturer {
  id: string; full_name: string; email: string; staff_id?: string
  department_id?: string; is_active: boolean
  departments?: { name: string }
}

type Tab = 'faculties' | 'departments' | 'courses' | 'lecturers'

// ── FORM DEFAULTS ─────────────────────────────────────────
const emptyFaculty   = { name: '', code: '' }
const emptyDept      = { name: '', code: '', faculty_id: '' }
const emptyCourse    = { course_code: '', course_name: '', credit_units: '3', level: '100', semester: 'first', department_id: '', lecturer_id: '', is_elective: false }
const emptyLecturer  = { full_name: '', email: '', staff_id: '', department_id: '' }

export default function AdminAcademicSetup() {
  const { tenant, slug } = useTenant()

  const [tab,        setTab]        = useState<Tab>('faculties')
  const [faculties,  setFaculties]  = useState<Faculty[]>([])
  const [departments,setDepartments]= useState<Department[]>([])
  const [courses,    setCourses]    = useState<Course[]>([])
  const [lecturers,  setLecturers]  = useState<Lecturer[]>([])
  const [loading,    setLoading]    = useState(true)

  // Forms
  const [showFacForm,  setShowFacForm]  = useState(false)
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showCrsForm,  setShowCrsForm]  = useState(false)
  const [showLecForm,  setShowLecForm]  = useState(false)
  const [facForm,   setFacForm]   = useState(emptyFaculty)
  const [deptForm,  setDeptForm]  = useState(emptyDept)
  const [crsForm,   setCrsForm]   = useState(emptyCourse)
  const [lecForm,   setLecForm]   = useState(emptyLecturer)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  // Filters
  const [filterDept,  setFilterDept]  = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterSem,   setFilterSem]   = useState('')
  const [searchCrs,   setSearchCrs]   = useState('')
  const [searchLec,   setSearchLec]   = useState('')

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db) loadAll() }, [db])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadFaculties(), loadDepartments(), loadCourses(), loadLecturers()])
    setLoading(false)
  }

  const loadFaculties  = async () => { const { data } = await db!.from('faculties').select('*').order('name'); if (data) setFaculties(data) }
  const loadDepartments= async () => { const { data } = await db!.from('departments').select('*, faculties(name)').order('name'); if (data) setDepartments(data as Department[]) }
  const loadCourses    = async () => { const { data } = await db!.from('courses').select('*, departments(name), lecturers(full_name)').order('course_code'); if (data) setCourses(data as Course[]) }
  const loadLecturers  = async () => { const { data } = await db!.from('lecturers').select('*, departments(name)').order('full_name'); if (data) setLecturers(data as Lecturer[]) }

  // ── FACULTY CRUD ──────────────────────────────────────
  const saveFaculty = async () => {
    if (!facForm.name.trim() || !facForm.code.trim()) { toast.error('Name and code are required'); return }
    setSaving(true)
    const payload = { name: facForm.name.trim(), code: facForm.code.trim().toUpperCase(), is_active: true }
    const { error } = editId
      ? await db!.from('faculties').update(payload).eq('id', editId)
      : await db!.from('faculties').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Faculty updated!' : 'Faculty created!')
    setFacForm(emptyFaculty); setShowFacForm(false); setEditId(null); loadFaculties()
  }

  const deleteFaculty = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This may affect departments under it.`)) return
    await db!.from('faculties').delete().eq('id', id)
    toast.success('Faculty deleted'); loadFaculties()
  }

  const editFaculty = (f: Faculty) => {
    setFacForm({ name: f.name, code: f.code })
    setEditId(f.id); setShowFacForm(true)
  }

  // ── DEPARTMENT CRUD ───────────────────────────────────
  const saveDept = async () => {
    if (!deptForm.name.trim() || !deptForm.code.trim() || !deptForm.faculty_id) { toast.error('All fields are required'); return }
    setSaving(true)
    const payload = { name: deptForm.name.trim(), code: deptForm.code.trim().toUpperCase(), faculty_id: deptForm.faculty_id, is_active: true }
    const { error } = editId
      ? await db!.from('departments').update(payload).eq('id', editId)
      : await db!.from('departments').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Department updated!' : 'Department created!')
    setDeptForm(emptyDept); setShowDeptForm(false); setEditId(null); loadDepartments()
  }

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This may affect students and courses under it.`)) return
    await db!.from('departments').delete().eq('id', id)
    toast.success('Department deleted'); loadDepartments()
  }

  const editDept = (d: Department) => {
    setDeptForm({ name: d.name, code: d.code, faculty_id: d.faculty_id })
    setEditId(d.id); setShowDeptForm(true)
  }

  // ── COURSE CRUD ───────────────────────────────────────
  const saveCourse = async () => {
    if (!crsForm.course_code.trim() || !crsForm.course_name.trim() || !crsForm.department_id) {
      toast.error('Code, name and department are required'); return
    }
    setSaving(true)
    const payload = {
      course_code:   crsForm.course_code.trim().toUpperCase(),
      course_name:   crsForm.course_name.trim(),
      credit_units:  parseInt(crsForm.credit_units) || 3,
      level:         crsForm.level,
      semester:      crsForm.semester,
      department_id: crsForm.department_id,
      lecturer_id:   crsForm.lecturer_id || null,
      is_elective:   crsForm.is_elective,
      is_active:     true,
    }
    const { error } = editId
      ? await db!.from('courses').update(payload).eq('id', editId)
      : await db!.from('courses').insert(payload)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Course updated!' : 'Course created!')
    setCrsForm(emptyCourse); setShowCrsForm(false); setEditId(null); loadCourses()
  }

  const deleteCourse = async (id: string, code: string) => {
    if (!confirm(`Delete course "${code}"? This will remove all registrations and results for this course.`)) return
    await db!.from('courses').delete().eq('id', id)
    toast.success('Course deleted'); loadCourses()
  }

  const editCourse = (c: Course) => {
    setCrsForm({
      course_code: c.course_code, course_name: c.course_name,
      credit_units: String(c.credit_units), level: c.level, semester: c.semester,
      department_id: c.department_id, lecturer_id: c.lecturer_id || '',
      is_elective: c.is_elective,
    })
    setEditId(c.id); setShowCrsForm(true)
  }

  // Assign lecturer to course without opening full edit form
  const assignLecturer = async (courseId: string, lecturerId: string) => {
    const { error } = await db!.from('courses').update({ lecturer_id: lecturerId || null }).eq('id', courseId)
    if (error) { toast.error('Failed to assign lecturer'); return }
    toast.success('Lecturer assigned!')
    loadCourses()
  }

  // ── LECTURER CRUD ─────────────────────────────────────
  const saveLecturer = async () => {
    if (!lecForm.full_name.trim() || !lecForm.email.trim()) { toast.error('Name and email are required'); return }
    setSaving(true)
    const payload = {
      full_name:     lecForm.full_name.trim(),
      email:         lecForm.email.trim().toLowerCase(),
      staff_id:      lecForm.staff_id.trim() || null,
      department_id: lecForm.department_id || null,
      is_active:     true,
    }

    if (editId) {
      const { error } = await db!.from('lecturers').update(payload).eq('id', editId)
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Lecturer updated!')
    } else {
      // Create auth account for lecturer too
      const { data: authData, error: authErr } = await db!.auth.admin
        ? await (db!.auth as any).admin.createUser({ email: lecForm.email.trim().toLowerCase(), password: 'ChangeMe@2025', email_confirm: true, user_metadata: { role: 'lecturer', full_name: lecForm.full_name.trim() } })
        : { data: null, error: null }

      const { error } = await db!.from('lecturers').insert({
        ...payload,
        supabase_uid: authData?.user?.id || null,
      })
      setSaving(false)
      if (error) { toast.error(error.message); return }
      toast.success('Lecturer created! They can now log in with their email.')
    }

    setLecForm(emptyLecturer); setShowLecForm(false); setEditId(null); loadLecturers()
  }

  const editLecturer = (l: Lecturer) => {
    setLecForm({ full_name: l.full_name, email: l.email, staff_id: l.staff_id || '', department_id: l.department_id || '' })
    setEditId(l.id); setShowLecForm(true)
  }

  const deleteLecturer = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" as a lecturer? Their assigned courses will be unassigned.`)) return
    await db!.from('courses').update({ lecturer_id: null }).eq('lecturer_id', id)
    await db!.from('lecturers').delete().eq('id', id)
    toast.success('Lecturer removed'); loadAll()
  }

  // Filtered courses
  const filteredCourses = courses.filter(c =>
    (!filterDept  || c.department_id === filterDept) &&
    (!filterLevel || c.level === filterLevel) &&
    (!filterSem   || c.semester === filterSem) &&
    (!searchCrs   || c.course_code.toLowerCase().includes(searchCrs.toLowerCase()) || c.course_name.toLowerCase().includes(searchCrs.toLowerCase()))
  )

  const filteredLecturers = lecturers.filter(l =>
    !searchLec || l.full_name.toLowerCase().includes(searchLec.toLowerCase()) || l.email.toLowerCase().includes(searchLec.toLowerCase())
  )

  if (loading) return (
    <SidebarLayout active="academic" role="admin">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 14 }}>
        <div style={S.spin} /><p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading academic setup...</p>
      </div>
    </SidebarLayout>
  )

  return (
    <SidebarLayout active="academic" role="admin">

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={S.title}>Academic structure</h1>
        <p style={S.sub}>Manage faculties, departments, courses and lecturers. Students see departments and courses you create here.</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 13, marginBottom: 24 }}>
        {[['🏛️','Faculties',faculties.length],['🏢','Departments',departments.length],['📚','Courses',courses.length],['👨‍🏫','Lecturers',lecturers.length]].map(([icon,label,val])=>(
          <div key={label as string} style={S.stat}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label as string}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#e8eeff' }}>{val as number}</div>
          </div>
        ))}
      </div>

      {/* Tab nav */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22, flexWrap: 'wrap' }}>
        {([['faculties','🏛️ Faculties'],['departments','🏢 Departments'],['courses','📚 Courses'],['lecturers','👨‍🏫 Lecturers']] as [Tab,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{...S.tabBtn, background:tab===id?'linear-gradient(135deg,#2d6cff,#4f3ef8)':'rgba(255,255,255,0.04)', color:tab===id?'#fff':'#7a8bbf', border:tab===id?'none':'1px solid rgba(255,255,255,0.08)'}}>
            {label}
          </button>
        ))}
      </div>

      {/* ── FACULTIES ── */}
      {tab === 'faculties' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#7a8bbf' }}>Faculties group related departments together</p>
            <button onClick={() => { setFacForm(emptyFaculty); setEditId(null); setShowFacForm(true) }} style={S.btnPrimary}>+ Add faculty</button>
          </div>

          {showFacForm && (
            <div style={S.formCard}>
              <h3 style={S.formTitle}>{editId ? 'Edit faculty' : 'Add new faculty'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Faculty name *</label>
                  <input style={S.input} value={facForm.name} onChange={e => setFacForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Faculty of Science and Technology" />
                </div>
                <div>
                  <label style={S.label}>Faculty code *</label>
                  <input style={S.input} value={facForm.code} onChange={e => setFacForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. FST" maxLength={10} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={saveFaculty} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving...' : editId ? 'Update faculty' : 'Create faculty'}</button>
                <button onClick={() => { setShowFacForm(false); setEditId(null) }} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            {faculties.length === 0 ? <Empty icon="🏛️" text="No faculties yet. Add your first faculty above." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Faculty name', 'Code', 'Departments', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {faculties.map(f => (
                    <tr key={f.id}>
                      <td style={S.td}><strong style={{ color: '#e8eeff' }}>{f.name}</strong></td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa' }}>{f.code}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{departments.filter(d => d.faculty_id === f.id).length}</td>
                      <td style={S.td}><Dot on={f.is_active} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => editFaculty(f)} style={S.btnSm}>Edit</button>
                          <button onClick={() => deleteFaculty(f.id, f.name)} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,.3)' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── DEPARTMENTS ── */}
      {tab === 'departments' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: '#7a8bbf' }}>Departments appear in the student signup dropdown</p>
            <button onClick={() => { setDeptForm(emptyDept); setEditId(null); setShowDeptForm(true) }} style={S.btnPrimary}>+ Add department</button>
          </div>

          {showDeptForm && (
            <div style={S.formCard}>
              <h3 style={S.formTitle}>{editId ? 'Edit department' : 'Add new department'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={S.label}>Department name *</label>
                  <input style={S.input} value={deptForm.name} onChange={e => setDeptForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Computer Science" />
                </div>
                <div>
                  <label style={S.label}>Department code *</label>
                  <input style={S.input} value={deptForm.code} onChange={e => setDeptForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="e.g. CSC" maxLength={10} />
                </div>
                <div>
                  <label style={S.label}>Faculty *</label>
                  <select style={S.input} value={deptForm.faculty_id} onChange={e => setDeptForm(p => ({ ...p, faculty_id: e.target.value }))}>
                    <option value="">-- Select faculty --</option>
                    {faculties.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={saveDept} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving...' : editId ? 'Update department' : 'Create department'}</button>
                <button onClick={() => { setShowDeptForm(false); setEditId(null) }} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            {departments.length === 0 ? <Empty icon="🏢" text="No departments yet. Add faculties first, then add departments." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Department', 'Code', 'Faculty', 'Courses', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {departments.map(d => (
                    <tr key={d.id}>
                      <td style={S.td}><strong style={{ color: '#e8eeff' }}>{d.name}</strong></td>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa' }}>{d.code}</td>
                      <td style={{ ...S.td, color: '#7a8bbf' }}>{d.faculties?.name || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{courses.filter(c => c.department_id === d.id).length}</td>
                      <td style={S.td}><Dot on={d.is_active} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => editDept(d)} style={S.btnSm}>Edit</button>
                          <button onClick={() => deleteDept(d.id, d.name)} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,.3)' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* ── COURSES ── */}
      {tab === 'courses' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#7a8bbf' }}>Courses appear in course registration. Assign lecturers here.</p>
            <button onClick={() => { setCrsForm(emptyCourse); setEditId(null); setShowCrsForm(true) }} style={S.btnPrimary}>+ Add course</button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input value={searchCrs} onChange={e => setSearchCrs(e.target.value)} placeholder="Search code or name..." style={{ ...S.input, maxWidth: 220 }} />
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ ...S.input, maxWidth: 200 }}>
              <option value="">All departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={{ ...S.input, maxWidth: 130 }}>
              <option value="">All levels</option>
              {['100','200','300','400','500','600'].map(l => <option key={l} value={l}>{l} Level</option>)}
            </select>
            <select value={filterSem} onChange={e => setFilterSem(e.target.value)} style={{ ...S.input, maxWidth: 150 }}>
              <option value="">Both semesters</option>
              <option value="first">First semester</option>
              <option value="second">Second semester</option>
            </select>
          </div>

          {showCrsForm && (
            <div style={S.formCard}>
              <h3 style={S.formTitle}>{editId ? 'Edit course' : 'Add new course'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
                <div>
                  <label style={S.label}>Course code *</label>
                  <input style={S.input} value={crsForm.course_code} onChange={e => setCrsForm(p => ({ ...p, course_code: e.target.value.toUpperCase() }))} placeholder="e.g. CSC301" />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={S.label}>Course name *</label>
                  <input style={S.input} value={crsForm.course_name} onChange={e => setCrsForm(p => ({ ...p, course_name: e.target.value }))} placeholder="e.g. Data Structures and Algorithms" />
                </div>
                <div>
                  <label style={S.label}>Credit units</label>
                  <select style={S.input} value={crsForm.credit_units} onChange={e => setCrsForm(p => ({ ...p, credit_units: e.target.value }))}>
                    {['1','2','3','4','6'].map(u => <option key={u} value={u}>{u} units</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Level *</label>
                  <select style={S.input} value={crsForm.level} onChange={e => setCrsForm(p => ({ ...p, level: e.target.value }))}>
                    {['100','200','300','400','500','600'].map(l => <option key={l} value={l}>{l} Level</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Semester</label>
                  <select style={S.input} value={crsForm.semester} onChange={e => setCrsForm(p => ({ ...p, semester: e.target.value }))}>
                    <option value="first">First semester</option>
                    <option value="second">Second semester</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Department *</label>
                  <select style={S.input} value={crsForm.department_id} onChange={e => setCrsForm(p => ({ ...p, department_id: e.target.value }))}>
                    <option value="">-- Select department --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Assign lecturer</label>
                  <select style={S.input} value={crsForm.lecturer_id} onChange={e => setCrsForm(p => ({ ...p, lecturer_id: e.target.value }))}>
                    <option value="">-- Unassigned --</option>
                    {lecturers.filter(l => l.is_active).map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="elective" checked={crsForm.is_elective} onChange={e => setCrsForm(p => ({ ...p, is_elective: e.target.checked }))} style={{ accentColor: '#2d6cff', width: 15, height: 15 }} />
                  <label htmlFor="elective" style={{ fontSize: 13, color: '#7a8bbf', cursor: 'pointer' }}>Elective course</label>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button onClick={saveCourse} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving...' : editId ? 'Update course' : 'Create course'}</button>
                <button onClick={() => { setShowCrsForm(false); setEditId(null) }} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 12 }}>{filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found</div>
            {filteredCourses.length === 0 ? <Empty icon="📚" text="No courses match your filters." /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead><tr>{['Code', 'Course name', 'Units', 'Level', 'Semester', 'Department', 'Lecturer', 'Type', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {filteredCourses.map(c => (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 700 }}>{c.course_code}</td>
                        <td style={S.td}>{c.course_name}</td>
                        <td style={{ ...S.td, textAlign: 'center' }}>{c.credit_units}</td>
                        <td style={S.td}>{c.level} Level</td>
                        <td style={{ ...S.td, textTransform: 'capitalize' }}>{c.semester}</td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{c.departments?.name || '—'}</td>
                        {/* Inline lecturer assignment dropdown */}
                        <td style={S.td}>
                          <select
                            value={c.lecturer_id || ''}
                            onChange={e => assignLecturer(c.id, e.target.value)}
                            style={{ ...S.input, width: 160, padding: '5px 8px', fontSize: 12 }}
                          >
                            <option value="">-- Unassigned --</option>
                            {lecturers.filter(l => l.is_active).map(l => (
                              <option key={l.id} value={l.id}>{l.full_name}</option>
                            ))}
                          </select>
                        </td>
                        <td style={S.td}>
                          <span style={{ fontSize: 11, background: c.is_elective ? 'rgba(168,85,247,.15)' : 'rgba(45,108,255,.12)', color: c.is_elective ? '#c084fc' : '#60a5fa', padding: '2px 8px', borderRadius: 100, fontWeight: 600 }}>
                            {c.is_elective ? 'Elective' : 'Core'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => editCourse(c)} style={S.btnSm}>Edit</button>
                            <button onClick={() => deleteCourse(c.id, c.course_code)} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,.3)' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── LECTURERS ── */}
      {tab === 'lecturers' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <p style={{ fontSize: 13, color: '#7a8bbf' }}>Lecturers can log in and upload results for their assigned courses</p>
            <button onClick={() => { setLecForm(emptyLecturer); setEditId(null); setShowLecForm(true) }} style={S.btnPrimary}>+ Add lecturer</button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <input value={searchLec} onChange={e => setSearchLec(e.target.value)} placeholder="Search by name or email..." style={{ ...S.input, maxWidth: 280 }} />
          </div>

          {showLecForm && (
            <div style={S.formCard}>
              <h3 style={S.formTitle}>{editId ? 'Edit lecturer' : 'Add new lecturer'}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
                <div>
                  <label style={S.label}>Full name *</label>
                  <input style={S.input} value={lecForm.full_name} onChange={e => setLecForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Dr. Adebayo Okon" />
                </div>
                <div>
                  <label style={S.label}>Email address *</label>
                  <input style={S.input} type="email" value={lecForm.email} onChange={e => setLecForm(p => ({ ...p, email: e.target.value }))} placeholder="lecturer@school.edu.ng" />
                </div>
                <div>
                  <label style={S.label}>Staff ID</label>
                  <input style={S.input} value={lecForm.staff_id} onChange={e => setLecForm(p => ({ ...p, staff_id: e.target.value }))} placeholder="e.g. STAFF/2019/001" />
                </div>
                <div>
                  <label style={S.label}>Department</label>
                  <select style={S.input} value={lecForm.department_id} onChange={e => setLecForm(p => ({ ...p, department_id: e.target.value }))}>
                    <option value="">-- Select department --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {!editId && (
                <div style={{ padding: '10px 14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, marginTop: 12, fontSize: 12, color: '#60a5fa' }}>
                  ℹ A login account will be created for this lecturer. Default password: <strong>ChangeMe@2025</strong> — they should change it on first login.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button onClick={saveLecturer} disabled={saving} style={S.btnPrimary}>{saving ? 'Saving...' : editId ? 'Update lecturer' : 'Create lecturer'}</button>
                <button onClick={() => { setShowLecForm(false); setEditId(null) }} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            {filteredLecturers.length === 0 ? <Empty icon="👨‍🏫" text="No lecturers added yet." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Lecturer', 'Staff ID', 'Department', 'Courses assigned', 'Status', 'Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {filteredLecturers.map(l => (
                    <tr key={l.id}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {l.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#e8eeff', fontSize: 13 }}>{l.full_name}</div>
                            <div style={{ fontSize: 11, color: '#7a8bbf' }}>{l.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12, color: '#7a8bbf' }}>{l.staff_id || '—'}</td>
                      <td style={{ ...S.td, color: '#7a8bbf' }}>{l.departments?.name || '—'}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>{courses.filter(c => c.lecturer_id === l.id).length}</td>
                      <td style={S.td}><Dot on={l.is_active} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => editLecturer(l)} style={S.btnSm}>Edit</button>
                          <button onClick={() => deleteLecturer(l.id, l.full_name)} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,.3)' }}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

// ── SMALL COMPONENTS ──────────────────────────────────────
function Dot({ on }: { on: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: on ? '#4ade80' : '#f87171' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#4ade80' : '#f87171' }} />
      {on ? 'Active' : 'Inactive'}
    </span>
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
  title:    { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:      { fontSize: 13, color: '#7a8bbf' },
  card:     { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  formCard: { background: 'rgba(45,108,255,0.06)', border: '1px solid rgba(45,108,255,0.2)', borderRadius: 16, padding: '20px 22px', marginBottom: 16 },
  formTitle:{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 16 },
  stat:     { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' },
  th:       { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:       { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
  tabBtn:   { padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", transition: 'all .2s' },
  btnPrimary: { padding: '9px 18px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSm:    { padding: '6px 13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  label:    { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:    { width: '100%', padding: '9px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#e8eeff', fontSize: 13, outline: 'none', fontFamily: "'DM Sans',system-ui" },
  spin:     { width: 32, height: 32, border: '2px solid rgba(45,108,255,.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}
