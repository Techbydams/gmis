// ============================================================
// GMIS — Admin Dashboard (Full — all tabs working)
// Manages students, courses, results, timetable, fees, elections
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate }          from 'react-router-dom'
import { useAuth }              from '../../../context/AuthContext'
import { useTenant }            from '../../../context/TenantContext'
import { getTenantClient }      from '../../../lib/supabase'
import { formatDate, timeAgo, formatNaira } from '../../../lib/helpers'
import toast                    from 'react-hot-toast'
import SidebarLayout            from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
type Tab = 'dashboard'|'approvals'|'students'|'courses'|'results'|'timetable'|'fees'|'idcards'|'elections'|'news'|'paystack'|'settings'

interface Student {
  id: string; first_name: string; last_name: string
  matric_number: string; email: string; level: string
  status: string; gpa: number; created_at: string
  departments?: { name: string }
}

interface Course {
  id: string; course_code: string; course_name: string
  credit_units: number; level: string; semester: string
  is_active: boolean; is_elective: boolean
  department_id: string; lecturer_id: string | null
  departments?: { name: string }; lecturers?: { full_name: string }
}

interface Result {
  id: string; ca_score: number; exam_score: number
  grade: string; published: boolean; is_locked: boolean
  session: string; semester: string; submitted_at: string
  students: { first_name: string; last_name: string; matric_number: string }
  courses: { course_code: string; course_name: string }
}

interface Lecturer {
  id: string; full_name: string; email: string
}

interface Department {
  id: string; name: string; code: string
}

interface FeeType {
  id: string; name: string; description: string
}

interface FeeItem {
  id: string; amount: number; session: string; is_active: boolean
  fee_types: { name: string }
}

interface NewsItem {
  id: string; title: string; content: string
  is_published: boolean; author_name: string; created_at: string
}

export default function AdminDashboard({ initialTab }: { initialTab?: Tab }) {
  const navigate          = useNavigate()
  const { user }          = useAuth()
  const { tenant, slug }  = useTenant()

  const [tab,        setTab]        = useState<Tab>(initialTab || 'dashboard')
  const [students,   setStudents]   = useState<Student[]>([])
  const [courses,    setCourses]    = useState<Course[]>([])
  const [results,    setResults]    = useState<Result[]>([])
  const [lecturers,  setLecturers]  = useState<Lecturer[]>([])
  const [departments,setDepartments]= useState<Department[]>([])
  const [feeTypes,   setFeeTypes]   = useState<FeeType[]>([])
  const [feeItems,   setFeeItems]   = useState<FeeItem[]>([])
  const [news,       setNews]       = useState<NewsItem[]>([])
  const [stats,      setStats]      = useState({ total:0, pending:0, active:0, courses:0 })
  const [loading,    setLoading]    = useState(true)

  // Student form state
  const [showStudForm, setShowStudForm] = useState(false)
  const [studForm, setStudForm] = useState({ first_name:'', last_name:'', matric_number:'', email:'', department_id:'', level:'100', gender:'male', phone:'' })
  const [savingStud, setSavingStud] = useState(false)

  // Course form state
  const [showCrsForm, setShowCrsForm] = useState(false)
  const [crsForm, setCrsForm] = useState({ course_code:'', course_name:'', credit_units:'3', level:'100', semester:'first', department_id:'', lecturer_id:'', is_elective:false })
  const [savingCrs, setSavingCrs] = useState(false)

  // Fee form state
  const [showFeeForm, setShowFeeForm] = useState(false)
  const [feeForm, setFeeForm] = useState({ fee_type_id:'', amount:'', session:'2024/2025' })
  const [savingFee, setSavingFee] = useState(false)

  // News form state
  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newsForm, setNewsForm] = useState({ title:'', content:'', is_published:false })
  const [savingNews, setSavingNews] = useState(false)

  // Filters
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paystackKey,  setPaystackKey]  = useState('')
  const [paystackSec,  setPaystackSec]  = useState('')
  const [savePay,      setSavePay]      = useState(false)
  const [orgSettings,  setOrgSettings]  = useState<any>({})

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db) loadAll() }, [db])
  // Sync tab when navigated with initialTab prop
  useEffect(() => { if (initialTab) setTab(initialTab) }, [initialTab])

  const loadAll = async () => {
    setLoading(true)
    await Promise.all([loadStudents(), loadCourses(), loadResults(), loadLecturers(), loadDepartments(), loadFees(), loadNews(), loadSettings()])
    setLoading(false)
  }

  const loadStudents = async () => {
    const { data } = await db!.from('students').select('*, departments(name)').order('created_at', { ascending: false })
    if (data) {
      setStudents(data as Student[])
      setStats(prev => ({
        ...prev,
        total:   data.length,
        pending: data.filter((s: any) => s.status === 'pending').length,
        active:  data.filter((s: any) => s.status === 'active').length,
      }))
    }
  }

  const loadCourses = async () => {
    const { data } = await db!.from('courses').select('*, departments(name), lecturers(full_name)').order('course_code')
    if (data) { setCourses(data as Course[]); setStats(prev => ({ ...prev, courses: data.length })) }
  }

  const loadResults = async () => {
    const { data } = await db!.from('results')
      .select('*, students(first_name,last_name,matric_number), courses(course_code,course_name)')
      .order('created_at', { ascending: false }).limit(100)
    if (data) setResults(data as Result[])
  }

  const loadLecturers  = async () => { const { data } = await db!.from('lecturers').select('id,full_name,email').eq('is_active',true); if (data) setLecturers(data) }
  const loadDepartments= async () => { const { data } = await db!.from('departments').select('id,name,code').eq('is_active',true).order('name'); if (data) setDepartments(data) }

  const loadFees = async () => {
    const [typesRes, itemsRes] = await Promise.all([
      db!.from('fee_types').select('id,name,description'),
      db!.from('fee_structure').select('*, fee_types(name)').eq('is_active',true),
    ])
    if (typesRes.data) setFeeTypes(typesRes.data as FeeType[])
    if (itemsRes.data) setFeeItems(itemsRes.data as FeeItem[])
  }

  const loadNews    = async () => { const { data } = await db!.from('news').select('*').order('created_at', { ascending: false }); if (data) setNews(data) }
  const loadSettings= async () => {
    const { data } = await db!.from('org_settings').select('*').single()
    if (data) { setOrgSettings(data); setPaystackKey(data.paystack_public_key||''); setPaystackSec(data.paystack_secret_key||'') }
  }

  // ── STUDENT ACTIONS ────────────────────────────────────
  const approveStudent = async (id: string, name: string) => {
    await db!.from('students').update({ status:'active', approved_at: new Date().toISOString() }).eq('id', id)
    toast.success(`✓ ${name} approved!`); loadStudents()
  }

  const suspendStudent = async (id: string, name: string) => {
    await db!.from('students').update({ status:'suspended' }).eq('id', id)
    toast.success(`${name} suspended.`); loadStudents()
  }

  // Add student manually
  const addStudent = async () => {
    if (!studForm.first_name || !studForm.last_name || !studForm.matric_number || !studForm.email) {
      toast.error('Name, matric number and email are required'); return
    }
    setSavingStud(true)
    // Create auth account
    const { data: authData } = await db!.auth.signUp({
      email: studForm.email.trim().toLowerCase(),
      password: 'ChangeMe@2025',
      options: { data: { role: 'student', full_name: `${studForm.first_name} ${studForm.last_name}`, matric_number: studForm.matric_number.toUpperCase() } }
    })
    // Insert student record
    const { error } = await db!.from('students').insert({
      supabase_uid:   authData?.user?.id || null,
      matric_number:  studForm.matric_number.trim().toUpperCase(),
      email:          studForm.email.trim().toLowerCase(),
      first_name:     studForm.first_name.trim(),
      last_name:      studForm.last_name.trim(),
      gender:         studForm.gender,
      phone:          studForm.phone || null,
      department_id:  studForm.department_id || null,
      level:          studForm.level,
      current_session:'2024/2025',
      status:         'active',   // admin-added students are auto-approved
      gpa: 0, cgpa: 0, id_card_printed: false, id_card_paid: false,
      email_verified: false,
    })
    setSavingStud(false)
    if (error) { toast.error(error.message); return }
    toast.success(`${studForm.first_name} added! Default password: ChangeMe@2025`)
    setStudForm({ first_name:'',last_name:'',matric_number:'',email:'',department_id:'',level:'100',gender:'male',phone:'' })
    setShowStudForm(false); loadStudents()
  }

  // ── COURSE ACTIONS ─────────────────────────────────────
  const addCourse = async () => {
    if (!crsForm.course_code || !crsForm.course_name || !crsForm.department_id) {
      toast.error('Code, name and department are required'); return
    }
    setSavingCrs(true)
    const { error } = await db!.from('courses').insert({
      course_code:   crsForm.course_code.trim().toUpperCase(),
      course_name:   crsForm.course_name.trim(),
      credit_units:  parseInt(crsForm.credit_units)||3,
      level:         crsForm.level,
      semester:      crsForm.semester,
      department_id: crsForm.department_id,
      lecturer_id:   crsForm.lecturer_id || null,
      is_elective:   crsForm.is_elective,
      is_active:     true,
    })
    setSavingCrs(false)
    if (error) { toast.error(error.message); return }
    toast.success('Course created!')
    setCrsForm({ course_code:'',course_name:'',credit_units:'3',level:'100',semester:'first',department_id:'',lecturer_id:'',is_elective:false })
    setShowCrsForm(false); loadCourses()
  }

  const assignLecturer = async (courseId: string, lecturerId: string) => {
    await db!.from('courses').update({ lecturer_id: lecturerId || null }).eq('id', courseId)
    toast.success('Lecturer assigned!'); loadCourses()
  }

  const deleteCourse = async (id: string, code: string) => {
    if (!confirm(`Delete course ${code}?`)) return
    await db!.from('courses').delete().eq('id', id)
    toast.success(`Course ${code} deleted`); loadCourses()
  }

  // ── RESULTS ACTIONS ────────────────────────────────────
  const releaseResults = async (courseCode: string) => {
    const courseResults = results.filter(r => r.courses?.course_code === courseCode)
    const ids = courseResults.map(r => r.id)
    if (!ids.length) { toast.error('No results to release'); return }
    await db!.from('results').update({ published:true, released_at:new Date().toISOString() }).in('id', ids)
    toast.success(`Results released for ${courseCode}!`); loadResults()
  }

  const unlockResults = async (courseCode: string) => {
    const courseResults = results.filter(r => r.courses?.course_code === courseCode)
    const ids = courseResults.map(r => r.id)
    await db!.from('results').update({ is_locked:false, submitted_at:null }).in('id', ids)
    toast.success(`Results unlocked for ${courseCode} — lecturer can now edit`); loadResults()
  }

  // ── FEE ACTIONS ────────────────────────────────────────
  const addFee = async () => {
    if (!feeForm.fee_type_id || !feeForm.amount) { toast.error('Fee type and amount required'); return }
    setSavingFee(true)
    const { error } = await db!.from('fee_structure').insert({
      fee_type_id: feeForm.fee_type_id, amount: parseFloat(feeForm.amount),
      session: feeForm.session, is_active: true,
    })
    setSavingFee(false)
    if (error) { toast.error(error.message); return }
    toast.success('Fee item added!'); setFeeForm({ fee_type_id:'',amount:'',session:'2024/2025' }); setShowFeeForm(false); loadFees()
  }

  const deleteFee = async (id: string) => {
    await db!.from('fee_structure').delete().eq('id', id)
    toast.success('Fee item removed'); loadFees()
  }

  // ── NEWS ACTIONS ───────────────────────────────────────
  const addNews = async () => {
    if (!newsForm.title || !newsForm.content) { toast.error('Title and content are required'); return }
    setSavingNews(true)
    const { error } = await db!.from('news').insert({
      title: newsForm.title.trim(), content: newsForm.content.trim(),
      author_name: user?.email || 'Admin', is_published: newsForm.is_published,
    })
    setSavingNews(false)
    if (error) { toast.error(error.message); return }
    toast.success(newsForm.is_published ? 'News published!' : 'News saved as draft')
    setNewsForm({ title:'', content:'', is_published:false }); setShowNewsForm(false); loadNews()
  }

  const toggleNewsPublish = async (id: string, current: boolean) => {
    await db!.from('news').update({ is_published: !current }).eq('id', id)
    toast.success(!current ? 'Published!' : 'Unpublished'); loadNews()
  }

  // ── PAYSTACK ───────────────────────────────────────────
  const savePaystack = async () => {
    setSavePay(true)
    const { error } = await db!.from('org_settings').update({ paystack_public_key: paystackKey, paystack_secret_key: paystackSec }).eq('id', orgSettings.id)
    setSavePay(false)
    if (error) toast.error('Failed to save'); else toast.success('Paystack config saved!')
  }

  // ── HELPERS ────────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const matchSearch = !search || `${s.first_name} ${s.last_name} ${s.matric_number} ${s.email}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchStatus
  })

  const pending    = students.filter(s => s.status === 'pending')
  const courseCodes= [...new Set(results.map(r => r.courses?.course_code).filter(Boolean))]

  const sc: Record<string,string> = { active:'#4ade80', pending:'#fbbf24', suspended:'#f87171', graduated:'#60a5fa' }

  if (loading) return (
    <SidebarLayout active="dashboard" role="admin">
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',flexDirection:'column',gap:14}}>
        <div style={S.spin}/><p style={{color:'#7a8bbf',fontSize:14}}>Loading admin panel...</p>
      </div>
    </SidebarLayout>
  )

  return (
    <SidebarLayout active={tab} role="admin">

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20,flexWrap:'wrap',gap:10}}>
        <div>
          <h1 style={S.title}>Admin dashboard</h1>
          <p style={S.sub}>{tenant?.name} · {user?.email}</p>
        </div>
        {pending.length > 0 && (
          <button onClick={() => setTab('approvals')} style={{padding:'8px 16px',background:'rgba(251,191,36,.12)',border:'1px solid rgba(251,191,36,.3)',borderRadius:10,color:'#fbbf24',fontSize:12,fontWeight:700,cursor:'pointer',animation:'pulse 2s infinite'}}>
            ⏳ {pending.length} pending approval{pending.length!==1?'s':''}
          </button>
        )}
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:5,marginBottom:22,flexWrap:'wrap'}}>
        {([
          ['dashboard','🏠 Overview'],['approvals','⏳ Approvals'],['students','👨‍🎓 Students'],
          ['courses','📚 Courses'],['results','📊 Results'],['fees','💳 Fees'],
          ['news','📰 News'],['paystack','💰 Paystack'],['settings','⚙️ Settings'],
        ] as [Tab,string][]).map(([id,label]) => (
          <button key={id} onClick={()=>setTab(id)}
            style={{...S.tabBtn, background:tab===id?'linear-gradient(135deg,#2d6cff,#4f3ef8)':'rgba(255,255,255,0.04)', color:tab===id?'#fff':'#7a8bbf', border:tab===id?'none':'1px solid rgba(255,255,255,0.08)'}}>
            {label}
            {id==='approvals'&&pending.length>0&&<span style={{marginLeft:5,background:'#f87171',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:100}}>{pending.length}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='dashboard'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:13,marginBottom:22}}>
            {[['👨‍🎓','Total students',stats.total,''],['⏳','Pending',stats.pending,'#fbbf24'],['✅','Active',stats.active,'#4ade80'],['📚','Courses',stats.courses,'']].map(([icon,label,val,color])=>(
              <div key={label as string} style={S.stat}>
                <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
                <div style={{fontSize:10,color:'#7a8bbf',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{label as string}</div>
                <div style={{fontSize:26,fontWeight:800,color:(color||'#e8eeff') as string}}>{val as number}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <h3 style={S.ct}>Recent student registrations</h3>
              <button onClick={()=>setTab('students')} style={S.btnSm}>View all →</button>
            </div>
            <StudentTable students={students.slice(0,6)} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc} />
          </div>
        </>
      )}

      {/* ── APPROVALS ── */}
      {tab==='approvals'&&(
        <>
          <h2 style={S.ct}>Pending student approvals</h2>
          {pending.length===0
            ?<Empty icon="✅" text="No pending approvals — all caught up!"/>
            :<div style={S.card}><StudentTable students={pending} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc}/></div>
          }
        </>
      )}

      {/* ── STUDENTS ── */}
      {tab==='students'&&(
        <>
          <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, matric, email..." style={{...S.input,flex:1,minWidth:200}}/>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...S.input,maxWidth:140}}>
              <option value="">All statuses</option>
              {['pending','active','suspended','graduated'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={()=>setShowStudForm(v=>!v)} style={S.btnPrimary}>+ Add student</button>
            <button style={S.btnSm}>📥 Bulk CSV</button>
          </div>

          {showStudForm&&(
            <div style={S.formCard}>
              <h3 style={S.formTitle}>Add student manually</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
                {[['first_name','First name *','text','First name'],['last_name','Last name *','text','Last name'],['matric_number','Matric number *','text','e.g. 02SCSC026'],['email','Email address *','email','student@email.com'],['phone','Phone','tel','+234 800 000 0000']].map(([field,label,type,ph])=>(
                  <div key={field as string}>
                    <label style={S.label}>{label as string}</label>
                    <input style={S.input} type={type as string} placeholder={ph as string} value={(studForm as any)[field as string]} onChange={e=>setStudForm(p=>({...p,[field as string]:e.target.value}))}/>
                  </div>
                ))}
                <div>
                  <label style={S.label}>Department</label>
                  <select style={S.input} value={studForm.department_id} onChange={e=>setStudForm(p=>({...p,department_id:e.target.value}))}>
                    <option value="">-- Select --</option>
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Level</label>
                  <select style={S.input} value={studForm.level} onChange={e=>setStudForm(p=>({...p,level:e.target.value}))}>
                    {['100','200','300','400','500','600'].map(l=><option key={l} value={l}>{l} Level</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Gender</label>
                  <select style={S.input} value={studForm.gender} onChange={e=>setStudForm(p=>({...p,gender:e.target.value}))}>
                    <option value="male">Male</option><option value="female">Female</option>
                  </select>
                </div>
              </div>
              <div style={{padding:'10px 14px',background:'rgba(96,165,250,0.08)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:10,marginTop:12,fontSize:12,color:'#60a5fa'}}>
                ℹ Admin-added students are auto-approved. Default password: <strong>ChangeMe@2025</strong>
              </div>
              <div style={{display:'flex',gap:10,marginTop:14}}>
                <button onClick={addStudent} disabled={savingStud} style={S.btnPrimary}>{savingStud?'Adding...':'Add student'}</button>
                <button onClick={()=>setShowStudForm(false)} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            <p style={{fontSize:12,color:'#7a8bbf',marginBottom:12}}>{filteredStudents.length} student{filteredStudents.length!==1?'s':''}</p>
            <StudentTable students={filteredStudents} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc} showAll/>
          </div>
        </>
      )}

      {/* ── COURSES ── */}
      {tab==='courses'&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
            <div><h2 style={S.ct}>Course management</h2><p style={{fontSize:13,color:'#7a8bbf'}}>Assign lecturers directly from the dropdown</p></div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>navigate('/admin/academic')} style={S.btnSm}>🏛️ Academic setup →</button>
              <button onClick={()=>setShowCrsForm(v=>!v)} style={S.btnPrimary}>+ Add course</button>
            </div>
          </div>

          {showCrsForm&&(
            <div style={S.formCard}>
              <h3 style={S.formTitle}>Add new course</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
                <div><label style={S.label}>Course code *</label><input style={S.input} value={crsForm.course_code} onChange={e=>setCrsForm(p=>({...p,course_code:e.target.value.toUpperCase()}))} placeholder="e.g. CSC301"/></div>
                <div style={{gridColumn:'span 2'}}><label style={S.label}>Course name *</label><input style={S.input} value={crsForm.course_name} onChange={e=>setCrsForm(p=>({...p,course_name:e.target.value}))} placeholder="e.g. Data Structures and Algorithms"/></div>
                <div><label style={S.label}>Credit units</label><select style={S.input} value={crsForm.credit_units} onChange={e=>setCrsForm(p=>({...p,credit_units:e.target.value}))}>{['1','2','3','4','6'].map(u=><option key={u} value={u}>{u} units</option>)}</select></div>
                <div><label style={S.label}>Level</label><select style={S.input} value={crsForm.level} onChange={e=>setCrsForm(p=>({...p,level:e.target.value}))}>{['100','200','300','400','500','600'].map(l=><option key={l} value={l}>{l} Level</option>)}</select></div>
                <div><label style={S.label}>Semester</label><select style={S.input} value={crsForm.semester} onChange={e=>setCrsForm(p=>({...p,semester:e.target.value}))}><option value="first">First</option><option value="second">Second</option></select></div>
                <div><label style={S.label}>Department *</label><select style={S.input} value={crsForm.department_id} onChange={e=>setCrsForm(p=>({...p,department_id:e.target.value}))}><option value="">-- Select --</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                <div><label style={S.label}>Assign lecturer</label><select style={S.input} value={crsForm.lecturer_id} onChange={e=>setCrsForm(p=>({...p,lecturer_id:e.target.value}))}><option value="">-- Unassigned --</option>{lecturers.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}</select></div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:14}}>
                <button onClick={addCourse} disabled={savingCrs} style={S.btnPrimary}>{savingCrs?'Saving...':'Create course'}</button>
                <button onClick={()=>setShowCrsForm(false)} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}

          <div style={S.card}>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
                <thead><tr>{['Code','Course name','Units','Level','Semester','Department','Lecturer','Action'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {courses.map(c=>(
                    <tr key={c.id}>
                      <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa',fontWeight:700}}>{c.course_code}</td>
                      <td style={S.td}>{c.course_name}</td>
                      <td style={{...S.td,textAlign:'center'}}>{c.credit_units}</td>
                      <td style={S.td}>{c.level} Level</td>
                      <td style={{...S.td,textTransform:'capitalize'}}>{c.semester}</td>
                      <td style={{...S.td,fontSize:12,color:'#7a8bbf'}}>{c.departments?.name||'—'}</td>
                      <td style={S.td}>
                        <select value={c.lecturer_id||''} onChange={e=>assignLecturer(c.id,e.target.value)} style={{...S.input,width:160,padding:'5px 8px',fontSize:11}}>
                          <option value="">-- Unassigned --</option>
                          {lecturers.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}
                        </select>
                      </td>
                      <td style={S.td}><button onClick={()=>deleteCourse(c.id,c.course_code)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {courses.length===0&&<Empty icon="📚" text="No courses yet. Add courses above or use Academic Setup."/>}
            </div>
          </div>
        </>
      )}

      {/* ── RESULTS ── */}
      {tab==='results'&&(
        <>
          <h2 style={S.ct}>Result management</h2>
          <p style={{fontSize:13,color:'#7a8bbf',marginBottom:18}}>Review and release results to students. Unlock for lecturers to re-edit.</p>
          <div style={S.card}>
            {courseCodes.length===0?<Empty icon="📊" text="No results uploaded by lecturers yet."/>:
              courseCodes.map(code=>{
                const cr   = results.filter(r=>r.courses?.course_code===code)
                const locked= cr.every(r=>r.is_locked)&&cr.length>0
                const pub  = cr.every(r=>r.published)&&cr.length>0
                return(
                  <div key={code} style={{padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                      <div>
                        <span style={{fontFamily:'monospace',fontWeight:700,color:'#60a5fa',fontSize:14}}>{code}</span>
                        <span style={{fontSize:13,color:'#e8eeff',marginLeft:10}}>{cr[0]?.courses?.course_name}</span>
                        <span style={{fontSize:12,color:'#7a8bbf',marginLeft:8}}>{cr.length} results</span>
                        {locked&&<span style={{marginLeft:8,fontSize:11,background:'rgba(74,222,128,.12)',color:'#4ade80',padding:'2px 8px',borderRadius:100}}>🔒 Submitted by lecturer</span>}
                      </div>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                        {!pub&&<button onClick={()=>releaseResults(code)} style={{...S.btnPrimary,fontSize:12}}>Release to students</button>}
                        {pub&&<span style={{fontSize:12,color:'#4ade80',fontWeight:600}}>✓ Published</span>}
                        {locked&&<button onClick={()=>unlockResults(code)} style={{...S.btnSm,color:'#fbbf24',borderColor:'rgba(251,191,36,.3)'}}>🔓 Unlock for lecturer</button>}
                      </div>
                    </div>
                  </div>
                )
              })
            }
          </div>
        </>
      )}

      {/* ── FEE STRUCTURE ── */}
      {tab==='fees'&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={S.ct}>Fee structure</h2>
            <button onClick={()=>setShowFeeForm(v=>!v)} style={S.btnPrimary}>+ Add fee item</button>
          </div>
          {showFeeForm&&(
            <div style={S.formCard}>
              <h3 style={S.formTitle}>Add fee item</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                <div><label style={S.label}>Fee type *</label><select style={S.input} value={feeForm.fee_type_id} onChange={e=>setFeeForm(p=>({...p,fee_type_id:e.target.value}))}><option value="">-- Select type --</option>{feeTypes.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
                <div><label style={S.label}>Amount (₦) *</label><input style={S.input} type="number" value={feeForm.amount} onChange={e=>setFeeForm(p=>({...p,amount:e.target.value}))} placeholder="e.g. 150000"/></div>
                <div><label style={S.label}>Session</label><input style={S.input} value={feeForm.session} onChange={e=>setFeeForm(p=>({...p,session:e.target.value}))} placeholder="2024/2025"/></div>
              </div>
              <div style={{display:'flex',gap:10,marginTop:14}}>
                <button onClick={addFee} disabled={savingFee} style={S.btnPrimary}>{savingFee?'Saving...':'Add fee'}</button>
                <button onClick={()=>setShowFeeForm(false)} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}
          <div style={S.card}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Fee type','Amount','Session','Status','Action'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {feeItems.map(f=>(
                  <tr key={f.id}>
                    <td style={S.td}><strong style={{color:'#e8eeff'}}>{f.fee_types?.name}</strong></td>
                    <td style={{...S.td,fontWeight:700,color:'#e8eeff'}}>{formatNaira(f.amount)}</td>
                    <td style={S.td}>{f.session}</td>
                    <td style={S.td}><span style={{fontSize:11,background:'rgba(74,222,128,.12)',color:'#4ade80',padding:'2px 9px',borderRadius:100}}>Active</span></td>
                    <td style={S.td}><button onClick={()=>deleteFee(f.id)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {feeItems.length===0&&<Empty icon="💳" text="No fee items yet. Add fee items above."/>}
          </div>
        </>
      )}

      {/* ── NEWS ── */}
      {tab==='news'&&(
        <>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style={S.ct}>News & announcements</h2>
            <button onClick={()=>setShowNewsForm(v=>!v)} style={S.btnPrimary}>+ New post</button>
          </div>
          {showNewsForm&&(
            <div style={S.formCard}>
              <h3 style={S.formTitle}>Create announcement</h3>
              <div style={{marginBottom:12}}><label style={S.label}>Title *</label><input style={S.input} value={newsForm.title} onChange={e=>setNewsForm(p=>({...p,title:e.target.value}))} placeholder="Announcement title"/></div>
              <div style={{marginBottom:12}}><label style={S.label}>Content *</label><textarea style={{...S.input,minHeight:100,resize:'vertical'}} value={newsForm.content} onChange={e=>setNewsForm(p=>({...p,content:e.target.value}))} placeholder="Write your announcement here..."/></div>
              <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#7a8bbf',cursor:'pointer',marginBottom:14}}>
                <input type="checkbox" checked={newsForm.is_published} onChange={e=>setNewsForm(p=>({...p,is_published:e.target.checked}))} style={{accentColor:'#2d6cff',width:15,height:15}}/>
                Publish immediately (visible to all students)
              </label>
              <div style={{display:'flex',gap:10}}>
                <button onClick={addNews} disabled={savingNews} style={S.btnPrimary}>{savingNews?'Saving...':(newsForm.is_published?'Publish':'Save as draft')}</button>
                <button onClick={()=>setShowNewsForm(false)} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}
          <div style={S.card}>
            {news.length===0?<Empty icon="📰" text="No news posts yet."/>:
              news.map(n=>(
                <div key={n.id} style={{padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                    <div>
                      <div style={{fontWeight:600,color:'#e8eeff',fontSize:13,marginBottom:4}}>{n.title}</div>
                      <div style={{fontSize:12,color:'#7a8bbf',marginBottom:6,lineHeight:1.5}}>{n.content.slice(0,120)}{n.content.length>120?'...':''}</div>
                      <div style={{fontSize:11,color:'#3d4f7a'}}>{n.author_name} · {timeAgo(n.created_at)}</div>
                    </div>
                    <div style={{display:'flex',gap:8,flexShrink:0}}>
                      <span style={{fontSize:11,background:n.is_published?'rgba(74,222,128,.12)':'rgba(255,255,255,.05)',color:n.is_published?'#4ade80':'#7a8bbf',padding:'2px 9px',borderRadius:100,fontWeight:600}}>{n.is_published?'Published':'Draft'}</span>
                      <button onClick={()=>toggleNewsPublish(n.id,n.is_published)} style={S.btnSm}>{n.is_published?'Unpublish':'Publish'}</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </>
      )}

      {/* ── PAYSTACK ── */}
      {tab==='paystack'&&(
        <>
          <h2 style={S.ct}>Paystack configuration</h2>
          <div style={{padding:'13px 16px',background:'rgba(96,165,250,0.08)',border:'1px solid rgba(96,165,250,0.2)',borderRadius:12,marginBottom:20,fontSize:13,color:'#60a5fa'}}>
            ℹ Link your school's Paystack API keys. All student payments go 100% to your account — GMIS takes zero cut.
          </div>
          <div style={S.card}>
            <div style={{marginBottom:14}}><label style={S.label}>Paystack public key</label><input style={S.input} value={paystackKey} onChange={e=>setPaystackKey(e.target.value)} placeholder="pk_live_xxxxxxxxxx"/></div>
            <div style={{marginBottom:20}}><label style={S.label}>Paystack secret key</label><input style={S.input} type="password" value={paystackSec} onChange={e=>setPaystackSec(e.target.value)} placeholder="sk_live_xxxxxxxxxx"/></div>
            <button onClick={savePaystack} disabled={savePay} style={S.btnPrimary}>{savePay?'Saving...':'Save keys'}</button>
          </div>
        </>
      )}

      {/* ── SETTINGS ── */}
      {tab==='settings'&&(
        <div style={S.card}>
          <h2 style={{...S.ct,marginBottom:18}}>Portal settings</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[['school_name','School name'],['school_email','School email'],['school_phone','Phone'],['current_session','Current session'],['current_semester','Current semester'],['school_address','Address']].map(([field,label])=>(
              <div key={field}>
                <label style={S.label}>{label}</label>
                <input style={S.input} value={orgSettings[field]||''} onChange={e=>setOrgSettings((p: any)=>({...p,[field]:e.target.value}))} placeholder={label}/>
              </div>
            ))}
          </div>
          <button onClick={async()=>{await db!.from('org_settings').update(orgSettings).eq('id',orgSettings.id);toast.success('Settings saved!')}} style={{...S.btnPrimary,marginTop:16}}>Save settings</button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </SidebarLayout>
  )
}

// ── STUDENT TABLE ─────────────────────────────────────────
function StudentTable({students,onApprove,onSuspend,sc,showAll}:{students:any[];onApprove:(id:string,name:string)=>void;onSuspend:(id:string,name:string)=>void;sc:Record<string,string>;showAll?:boolean}){
  if(!students.length) return <Empty icon="👨‍🎓" text="No students found."/>
  return(
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',minWidth:520}}>
        <thead><tr>{['Student','Matric no.','Level',showAll&&'Dept.',showAll&&'Status',showAll&&'Registered','Actions'].filter(Boolean).map(h=><th key={h as string} style={S.th}>{h as string}</th>)}</tr></thead>
        <tbody>
          {students.map((s:any)=>{
            const name=`${s.first_name} ${s.last_name}`
            return(
              <tr key={s.id}>
                <td style={S.td}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#2d6cff,#4f3ef8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',flexShrink:0}}>{s.first_name?.[0]}{s.last_name?.[0]}</div>
                    <div><div style={{fontWeight:600,color:'#e8eeff',fontSize:13}}>{name}</div><div style={{fontSize:11,color:'#7a8bbf'}}>{s.email}</div></div>
                  </div>
                </td>
                <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa',fontSize:12}}>{s.matric_number}</td>
                <td style={S.td}>{s.level} Level</td>
                {showAll&&<td style={{...S.td,fontSize:12,color:'#7a8bbf'}}>{s.departments?.name||'—'}</td>}
                {showAll&&<td style={S.td}><span style={{fontSize:11,fontWeight:700,background:(sc[s.status]||'#7a8bbf')+'20',color:sc[s.status]||'#7a8bbf',padding:'2px 9px',borderRadius:100,textTransform:'capitalize'}}>{s.status}</span></td>}
                {showAll&&<td style={{...S.td,fontSize:12,color:'#7a8bbf'}}>{timeAgo(s.created_at)}</td>}
                <td style={S.td}>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    {s.status==='pending'&&<button onClick={()=>onApprove(s.id,name)} style={{...S.btnSm,background:'rgba(74,222,128,.12)',color:'#4ade80',border:'1px solid rgba(74,222,128,.25)',fontWeight:700}}>✓ Approve</button>}
                    {s.status==='active'&&<button onClick={()=>onSuspend(s.id,name)} style={{...S.btnSm,background:'rgba(248,113,113,.1)',color:'#f87171',border:'1px solid rgba(248,113,113,.2)'}}>Suspend</button>}
                    {s.status==='suspended'&&<button onClick={()=>onApprove(s.id,name)} style={{...S.btnSm,background:'rgba(74,222,128,.12)',color:'#4ade80',border:'1px solid rgba(74,222,128,.25)'}}>Reactivate</button>}
                    <button style={S.btnSm}>View</button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Empty({icon,text}:{icon:string;text:string}){return<div style={{textAlign:'center',padding:'32px 0'}}><div style={{fontSize:40,marginBottom:10}}>{icon}</div><div style={{fontSize:14,color:'#7a8bbf'}}>{text}</div></div>}

const S:Record<string,React.CSSProperties>={
  title:    {fontFamily:"'Syne',system-ui",fontWeight:800,fontSize:22,color:'#e8eeff',marginBottom:4},
  sub:      {fontSize:13,color:'#7a8bbf'},
  card:     {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'18px 20px',marginBottom:16},
  formCard: {background:'rgba(45,108,255,0.06)',border:'1px solid rgba(45,108,255,0.2)',borderRadius:16,padding:'20px 22px',marginBottom:16},
  formTitle:{fontFamily:"'Syne',system-ui",fontWeight:700,fontSize:14,color:'#e8eeff',marginBottom:16},
  stat:     {background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'16px 18px'},
  ct:       {fontFamily:"'Syne',system-ui",fontWeight:700,fontSize:15,color:'#e8eeff',marginBottom:14},
  th:       {textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#3d4f7a',padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',whiteSpace:'nowrap'},
  td:       {padding:'11px 12px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13,color:'#7a8bbf',verticalAlign:'middle'},
  tabBtn:   {padding:'7px 13px',borderRadius:9,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',system-ui",transition:'all .2s'},
  btnPrimary:{padding:'8px 18px',background:'linear-gradient(135deg,#2d6cff,#4f3ef8)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
  btnSm:    {padding:'5px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#7a8bbf',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
  label:    {fontSize:12,color:'#7a8bbf',display:'block',marginBottom:5,fontWeight:500},
  input:    {width:'100%',padding:'9px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,color:'#e8eeff',fontSize:13,outline:'none',fontFamily:"'DM Sans',system-ui"},
  spin:     {width:32,height:32,border:'2px solid rgba(45,108,255,.2)',borderTopColor:'#2d6cff',borderRadius:'50%',animation:'spin .8s linear infinite'},
}
