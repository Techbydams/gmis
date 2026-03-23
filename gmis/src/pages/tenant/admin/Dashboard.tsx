// GMIS — Admin Dashboard (Clean rewrite — no TS errors)
// Uses 'as any' on all DB insert/update calls to bypass
// the never[] type issue from ungenerated Supabase types
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { timeAgo, formatNaira } from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

type Tab = 'dashboard'|'approvals'|'students'|'courses'|'results'|'fees'|'news'|'paystack'|'settings'|'academic'
type AcademicTab = 'faculties'|'departments'|'courses'|'lecturers'

const TAB_PATHS: Record<string,Tab> = {
  '/admin':'dashboard','/admin/approvals':'approvals','/admin/students':'students',
  '/admin/courses':'courses','/admin/results':'results','/admin/fees':'fees',
  '/admin/news':'news','/admin/paystack':'paystack','/admin/settings':'settings','/admin/academic':'academic'
}

export default function AdminDashboard({ initialTab }: { initialTab?: Tab }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { tenant, slug } = useTenant()

  const tabFromPath = TAB_PATHS[location.pathname] || 'dashboard'
  const [tab, setTab] = useState<Tab>(initialTab || tabFromPath)
  useEffect(() => { setTab(initialTab || tabFromPath) }, [location.pathname, initialTab])

  // ── DATA ──────────────────────────────────────────────
  const [students,    setStudents]    = useState<any[]>([])
  const [courses,     setCourses]     = useState<any[]>([])
  const [results,     setResults]     = useState<any[]>([])
  const [faculties,   setFaculties]   = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [lecturers,   setLecturers]   = useState<any[]>([])
  const [feeTypes,    setFeeTypes]    = useState<any[]>([])
  const [feeItems,    setFeeItems]    = useState<any[]>([])
  const [news,        setNews]        = useState<any[]>([])
  const [stats,       setStats]       = useState({ total:0, pending:0, active:0, courses:0 })
  const [loading,     setLoading]     = useState(true)
  const [orgSettings, setOrgSettings] = useState<any>({})
  const [paystackKey, setPaystackKey] = useState('')
  const [paystackSec, setPaystackSec] = useState('')
  const [savePay,     setSavePay]     = useState(false)

  // ── ACADEMIC SUB-TABS ─────────────────────────────────
  const [academicTab,  setAcademicTab]  = useState<AcademicTab>('faculties')
  const [showFacForm,  setShowFacForm]  = useState(false)
  const [showDeptForm, setShowDeptForm] = useState(false)
  const [showLecForm,  setShowLecForm]  = useState(false)
  const [facForm,      setFacForm]      = useState({ name:'', code:'' })
  const [deptForm,     setDeptForm]     = useState({ name:'', code:'', faculty_id:'' })
  const [lecForm,      setLecForm]      = useState({ full_name:'', email:'', staff_id:'', department_id:'' })
  const [editId,       setEditId]       = useState<string|null>(null)
  const [savingAc,     setSavingAc]     = useState(false)

  // ── FORMS ─────────────────────────────────────────────
  const [showStudForm, setShowStudForm] = useState(false)
  const [studForm, setStudForm] = useState({ first_name:'', last_name:'', matric_number:'', email:'', department_id:'', level:'100', gender:'male', phone:'' })
  const [savingStud, setSavingStud] = useState(false)

  const [showCrsForm, setShowCrsForm] = useState(false)
  const [crsForm, setCrsForm] = useState({ course_code:'', course_name:'', credit_units:'3', level:'100', semester:'first', department_id:'', lecturer_id:'' })
  const [savingCrs, setSavingCrs] = useState(false)

  const [showFeeForm, setShowFeeForm] = useState(false)
  const [feeForm, setFeeForm] = useState({ fee_type_id:'', amount:'', session:'2024/2025' })
  const [savingFee, setSavingFee] = useState(false)

  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newsForm, setNewsForm] = useState({ title:'', content:'', is_published:false })
  const [savingNews, setSavingNews] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db) loadAll() }, [db])

  // ── LOADERS ───────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true)
    await Promise.allSettled([
      loadStudents(), loadCourses(), loadResults(),
      loadFaculties(), loadDepartments(), loadLecturers(),
      loadFees(), loadNews(), loadSettings(),
    ])
    setLoading(false)
  }

  const loadStudents = async () => {
    if (!db) return
    const { data } = await db.from('students').select('*, departments(name)').order('created_at', { ascending: false })
    if (data) {
      setStudents(data)
      setStats(p => ({ ...p, total:data.length, pending:data.filter((s:any)=>s.status==='pending').length, active:data.filter((s:any)=>s.status==='active').length }))
    }
  }
  const loadCourses = async () => {
    if (!db) return
    const { data } = await db.from('courses').select('*, departments(name), lecturers(full_name)').order('course_code')
    if (data) { setCourses(data); setStats(p=>({...p,courses:data.length})) }
  }
  const loadResults = async () => {
    if (!db) return
    const { data } = await db.from('results').select('*, students(first_name,last_name,matric_number), courses(course_code,course_name)').order('created_at',{ascending:false}).limit(100)
    if (data) setResults(data)
  }
  const loadFaculties = async () => {
    if (!db) return
    const { data } = await db.from('faculties').select('*').order('name')
    if (data) setFaculties(data)
  }
  const loadDepartments = async () => {
    if (!db) return
    const { data } = await db.from('departments').select('*, faculties(name)').order('name')
    if (data) setDepartments(data)
  }
  const loadLecturers = async () => {
    if (!db) return
    const { data } = await db.from('lecturers').select('*, departments(name)').order('full_name')
    if (data) setLecturers(data)
  }
  const loadFees = async () => {
    if (!db) return
    const [t, i] = await Promise.all([
      db.from('fee_types').select('id,name,description'),
      db.from('fee_structure').select('*, fee_types(name,id)').eq('is_active', true),
    ])
    if (t.data) setFeeTypes(t.data)
    if (i.data) setFeeItems(i.data)
  }
  const loadNews = async () => {
    if (!db) return
    const { data, error } = await db.from('news').select('*').order('created_at',{ascending:false})
    if (error) console.warn('News:', error.message)
    if (data) setNews(data)
  }
  const loadSettings = async () => {
    if (!db) return
    const { data, error } = await db.from('org_settings').select('*').maybeSingle()
    if (error) console.warn('org_settings:', error.message)
    if (data) { setOrgSettings(data); setPaystackKey(data.paystack_public_key||''); setPaystackSec(data.paystack_secret_key||'') }
  }

  // ── STUDENT ACTIONS ───────────────────────────────────
  const approveStudent = async (id:string, name:string) => {
    if (!db) return
    await db.from('students').update({ status:'active', approved_at:new Date().toISOString() } as any).eq('id',id)
    toast.success(`✓ ${name} approved!`); loadStudents()
  }
  const suspendStudent = async (id:string, name:string) => {
    if (!db) return
    await db.from('students').update({ status:'suspended' } as any).eq('id',id)
    toast.success(`${name} suspended.`); loadStudents()
  }
  const addStudent = async () => {
    if (!db || !studForm.first_name || !studForm.matric_number || !studForm.email) { toast.error('Name, matric and email required'); return }
    setSavingStud(true)
    try {
      const { data: s, error: se } = await db.from('students').insert({
        matric_number: studForm.matric_number.trim().toUpperCase(), email: studForm.email.trim().toLowerCase(),
        first_name: studForm.first_name.trim(), last_name: studForm.last_name.trim(),
        gender: studForm.gender, phone: studForm.phone||null, department_id: studForm.department_id||null,
        level: studForm.level, current_session:'2024/2025', status:'active',
        gpa:0, cgpa:0, id_card_printed:false, id_card_paid:false, email_verified:false,
      } as any).select('id').single()
      if (se) { toast.error(se.message); return }
      const { data: a } = await db.auth.signUp({ email:studForm.email.trim().toLowerCase(), password:'ChangeMe@2025', options:{data:{role:'student',matric_number:studForm.matric_number.toUpperCase()}} })
      if (a?.user?.id && s?.id) await db.from('students').update({ supabase_uid:a.user.id } as any).eq('id',s.id)
      toast.success(`${studForm.first_name} added! Password: ChangeMe@2025`)
      setStudForm({first_name:'',last_name:'',matric_number:'',email:'',department_id:'',level:'100',gender:'male',phone:''})
      setShowStudForm(false); loadStudents()
    } finally { setSavingStud(false) }
  }

  // ── COURSE ACTIONS ────────────────────────────────────
  const addCourse = async () => {
    if (!db || !crsForm.course_code || !crsForm.course_name || !crsForm.department_id) { toast.error('Code, name and department required'); return }
    setSavingCrs(true)
    const { error } = await db.from('courses').insert({
      course_code: crsForm.course_code.trim().toUpperCase(), course_name: crsForm.course_name.trim(),
      credit_units: parseInt(crsForm.credit_units)||3, level: crsForm.level, semester: crsForm.semester,
      department_id: crsForm.department_id, lecturer_id: crsForm.lecturer_id||null, is_active:true,
    } as any)
    setSavingCrs(false)
    if (error) { toast.error(error.message); return }
    toast.success('Course created!')
    setCrsForm({course_code:'',course_name:'',credit_units:'3',level:'100',semester:'first',department_id:'',lecturer_id:''})
    setShowCrsForm(false); loadCourses()
  }
  const assignLecturer = async (courseId:string, lecturerId:string) => {
    if (!db) return
    await db.from('courses').update({ lecturer_id:lecturerId||null } as any).eq('id',courseId)
    toast.success('Lecturer assigned!'); loadCourses()
  }
  const deleteCourse = async (id:string, code:string) => {
    if (!db || !confirm(`Delete ${code}?`)) return
    await db.from('courses').delete().eq('id',id)
    toast.success(`${code} deleted`); loadCourses()
  }

  // ── RESULTS ACTIONS ───────────────────────────────────
  const releaseResults = async (code:string) => {
    if (!db) return
    const ids = results.filter(r=>r.courses?.course_code===code).map(r=>r.id)
    if (!ids.length) { toast.error('No results'); return }
    await db.from('results').update({ published:true, released_at:new Date().toISOString() } as any).in('id',ids)
    toast.success(`Released ${code}!`); loadResults()
  }
  const unlockResults = async (code:string) => {
    if (!db) return
    const ids = results.filter(r=>r.courses?.course_code===code).map(r=>r.id)
    await db.from('results').update({ is_locked:false, submitted_at:null } as any).in('id',ids)
    toast.success(`Unlocked ${code}`); loadResults()
  }

  // ── FEE ACTIONS ───────────────────────────────────────
  const addFee = async () => {
    if (!db || !feeForm.fee_type_id || !feeForm.amount) { toast.error('Fee type and amount required'); return }
    setSavingFee(true)
    const { error } = await db.from('fee_structure').insert({ fee_type_id:feeForm.fee_type_id, amount:parseFloat(feeForm.amount), session:feeForm.session, is_active:true } as any)
    setSavingFee(false)
    if (error) { toast.error(error.message); return }
    toast.success('Fee added!'); setFeeForm({fee_type_id:'',amount:'',session:'2024/2025'}); setShowFeeForm(false); loadFees()
  }
  const deleteFee = async (id:string) => {
    if (!db) return
    await db.from('fee_structure').delete().eq('id',id)
    toast.success('Fee removed'); loadFees()
  }

  // ── NEWS ACTIONS ──────────────────────────────────────
  const addNews = async () => {
    if (!db || !newsForm.title || !newsForm.content) { toast.error('Title and content required'); return }
    setSavingNews(true)
    const { error } = await db.from('news').insert({ title:newsForm.title.trim(), content:newsForm.content.trim(), author_name:user?.email||'Admin', is_published:newsForm.is_published } as any)
    setSavingNews(false)
    if (error) { toast.error(error.message); return }
    toast.success(newsForm.is_published?'Published!':'Saved as draft')
    setNewsForm({title:'',content:'',is_published:false}); setShowNewsForm(false); loadNews()
  }
  const togglePublish = async (id:string, current:boolean) => {
    if (!db) return
    await db.from('news').update({ is_published:!current } as any).eq('id',id)
    toast.success(!current?'Published!':'Unpublished'); loadNews()
  }

  // ── PAYSTACK ──────────────────────────────────────────
  const savePaystack = async () => {
    if (!db) return
    setSavePay(true)
    const { error } = await db.from('org_settings').upsert({ ...orgSettings, paystack_public_key:paystackKey, paystack_secret_key:paystackSec } as any)
    setSavePay(false)
    if (error) toast.error('Failed: '+error.message); else toast.success('Saved!')
  }

  // ── ACADEMIC ACTIONS ──────────────────────────────────
  const saveFaculty = async () => {
    if (!db || !facForm.name.trim() || !facForm.code.trim()) { toast.error('Name and code required'); return }
    setSavingAc(true)
    const payload = { name:facForm.name.trim(), code:facForm.code.trim().toUpperCase(), is_active:true }
    const { error } = editId
      ? await db.from('faculties').update(payload as any).eq('id',editId)
      : await db.from('faculties').insert(payload as any)
    setSavingAc(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId?'Updated!':'Faculty created!')
    setFacForm({name:'',code:''}); setShowFacForm(false); setEditId(null); loadFaculties()
  }
  const deleteFaculty = async (id:string, name:string) => {
    if (!db || !confirm(`Delete "${name}"?`)) return
    await db.from('faculties').delete().eq('id',id)
    toast.success('Deleted'); loadFaculties()
  }

  const saveDept = async () => {
    if (!db || !deptForm.name.trim() || !deptForm.code.trim() || !deptForm.faculty_id) { toast.error('All fields required'); return }
    setSavingAc(true)
    const payload = { name:deptForm.name.trim(), code:deptForm.code.trim().toUpperCase(), faculty_id:deptForm.faculty_id, is_active:true }
    const { error } = editId
      ? await db.from('departments').update(payload as any).eq('id',editId)
      : await db.from('departments').insert(payload as any)
    setSavingAc(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId?'Updated!':'Department created!')
    setDeptForm({name:'',code:'',faculty_id:''}); setShowDeptForm(false); setEditId(null); loadDepartments()
  }
  const deleteDept = async (id:string, name:string) => {
    if (!db || !confirm(`Delete "${name}"?`)) return
    await db.from('departments').delete().eq('id',id)
    toast.success('Deleted'); loadDepartments()
  }

  const saveLecturer = async () => {
    if (!db || !lecForm.full_name.trim() || !lecForm.email.trim()) { toast.error('Name and email required'); return }
    setSavingAc(true)
    const payload = { full_name:lecForm.full_name.trim(), email:lecForm.email.trim().toLowerCase(), staff_id:lecForm.staff_id.trim()||null, department_id:lecForm.department_id||null, is_active:true }
    const { error } = editId
      ? await db.from('lecturers').update(payload as any).eq('id',editId)
      : await db.from('lecturers').insert(payload as any)
    setSavingAc(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId?'Updated!':'Lecturer added! Direct them to /setup?role=lecturer')
    setLecForm({full_name:'',email:'',staff_id:'',department_id:''}); setShowLecForm(false); setEditId(null); loadLecturers()
  }
  const deleteLecturer = async (id:string, name:string) => {
    if (!db || !confirm(`Remove "${name}"?`)) return
    await db.from('courses').update({ lecturer_id:null } as any).eq('lecturer_id',id)
    await db.from('lecturers').delete().eq('id',id)
    toast.success('Removed'); loadLecturers(); loadCourses()
  }

  // ── HELPERS ───────────────────────────────────────────
  const filteredStudents = students.filter(s => {
    const m = !search || `${s.first_name} ${s.last_name} ${s.matric_number} ${s.email}`.toLowerCase().includes(search.toLowerCase())
    return m && (!statusFilter || s.status===statusFilter)
  })
  const pending = students.filter(s=>s.status==='pending')
  const courseCodes = [...new Set(results.map((r:any)=>r.courses?.course_code).filter(Boolean))]
  const sc: Record<string,string> = { active:'#4ade80', pending:'#fbbf24', suspended:'#f87171', graduated:'#60a5fa' }
  const navTo = (t:Tab) => {
    const m:Record<Tab,string> = { dashboard:'/admin', approvals:'/admin/approvals', students:'/admin/students', courses:'/admin/courses', results:'/admin/results', fees:'/admin/fees', news:'/admin/news', paystack:'/admin/paystack', settings:'/admin/settings', academic:'/admin/academic' }
    navigate(m[t])
  }

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
        {pending.length>0&&<button onClick={()=>navTo('approvals')} style={{padding:'8px 16px',background:'rgba(251,191,36,.12)',border:'1px solid rgba(251,191,36,.3)',borderRadius:10,color:'#fbbf24',fontSize:12,fontWeight:700,cursor:'pointer'}}>⏳ {pending.length} pending</button>}
      </div>

      {/* Tab nav */}
      <div style={{display:'flex',gap:5,marginBottom:22,flexWrap:'wrap'}}>
        {([['dashboard','🏠 Overview'],['approvals','⏳ Approvals'],['students','👨‍🎓 Students'],['courses','📚 Courses'],['results','📊 Results'],['fees','💳 Fees'],['news','📰 News'],['paystack','💰 Paystack'],['settings','⚙️ Settings']] as [Tab,string][]).map(([id,label])=>(
          <button key={id} onClick={()=>navTo(id)} style={{...S.tabBtn,background:tab===id?'linear-gradient(135deg,#2d6cff,#4f3ef8)':'rgba(255,255,255,0.04)',color:tab===id?'#fff':'#7a8bbf',border:tab===id?'none':'1px solid rgba(255,255,255,0.08)'}}>
            {label}{id==='approvals'&&pending.length>0&&<span style={{marginLeft:5,background:'#f87171',color:'#fff',fontSize:10,padding:'1px 6px',borderRadius:100}}>{pending.length}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab==='dashboard'&&(<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:13,marginBottom:22}}>
          {[['👨‍🎓','Total',stats.total,''],['⏳','Pending',stats.pending,'#fbbf24'],['✅','Active',stats.active,'#4ade80'],['📚','Courses',stats.courses,'']].map(([i,l,v,c])=>(
            <div key={l as string} style={S.stat}><div style={{fontSize:22,marginBottom:8}}>{i}</div><div style={{fontSize:10,color:'#7a8bbf',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{l as string}</div><div style={{fontSize:26,fontWeight:800,color:(c||'#e8eeff') as string}}>{v as number}</div></div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h3 style={S.ct}>Recent registrations</h3>
            <button onClick={()=>navTo('students')} style={S.btnSm}>View all →</button>
          </div>
          <StudentsTable students={students.slice(0,6)} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc}/>
        </div>
      </>)}

      {/* ── APPROVALS ── */}
      {tab==='approvals'&&(<>
        <h2 style={S.ct}>Pending approvals</h2>
        {pending.length===0?<Empty icon="✅" text="All caught up!"/>:<div style={S.card}><StudentsTable students={pending} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc}/></div>}
      </>)}

      {/* ── STUDENTS ── */}
      {tab==='students'&&(<>
        <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, matric, email..." style={{...S.input,flex:1,minWidth:200}}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...S.input,maxWidth:140}}>
            <option value="">All statuses</option>
            {['pending','active','suspended','graduated'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={()=>setShowStudForm(v=>!v)} style={S.btnPrimary}>+ Add student</button>
        </div>
        {showStudForm&&(
          <div style={S.formCard}>
            <h3 style={S.formTitle}>Add student manually</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
              {[['first_name','First name *','text','First name'],['last_name','Last name *','text','Last name'],['matric_number','Matric number *','text','e.g. STU/2024/001'],['email','Email *','email','student@email.com'],['phone','Phone','tel','+234 800 0000']].map(([f,l,t,p])=>(
                <div key={f}><label style={S.label}>{l}</label><input style={S.input} type={t} placeholder={p} value={(studForm as any)[f]} onChange={e=>setStudForm(prev=>({...prev,[f]:e.target.value}))}/></div>
              ))}
              <div><label style={S.label}>Department</label><select style={S.input} value={studForm.department_id} onChange={e=>setStudForm(p=>({...p,department_id:e.target.value}))}><option value="">-- Select --</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label style={S.label}>Level</label><select style={S.input} value={studForm.level} onChange={e=>setStudForm(p=>({...p,level:e.target.value}))}>{['100','200','300','400','500','600'].map(l=><option key={l} value={l}>{l} Level</option>)}</select></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={addStudent} disabled={savingStud} style={S.btnPrimary}>{savingStud?'Adding...':'Add student'}</button>
              <button onClick={()=>setShowStudForm(false)} style={S.btnSm}>Cancel</button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <p style={{fontSize:12,color:'#7a8bbf',marginBottom:12}}>{filteredStudents.length} students</p>
          <StudentsTable students={filteredStudents} onApprove={approveStudent} onSuspend={suspendStudent} sc={sc} showAll/>
        </div>
      </>)}

      {/* ── COURSES ── */}
      {tab==='courses'&&(<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14,flexWrap:'wrap',gap:10}}>
          <h2 style={S.ct}>Courses</h2>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>navTo('academic')} style={S.btnSm}>🏛️ Academic setup</button>
            <button onClick={()=>setShowCrsForm(v=>!v)} style={S.btnPrimary}>+ Add course</button>
          </div>
        </div>
        {showCrsForm&&(
          <div style={S.formCard}>
            <h3 style={S.formTitle}>Add course</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:12}}>
              <div><label style={S.label}>Code *</label><input style={S.input} value={crsForm.course_code} onChange={e=>setCrsForm(p=>({...p,course_code:e.target.value.toUpperCase()}))} placeholder="CSC301"/></div>
              <div style={{gridColumn:'span 2'}}><label style={S.label}>Course name *</label><input style={S.input} value={crsForm.course_name} onChange={e=>setCrsForm(p=>({...p,course_name:e.target.value}))} placeholder="Data Structures"/></div>
              <div><label style={S.label}>Units</label><select style={S.input} value={crsForm.credit_units} onChange={e=>setCrsForm(p=>({...p,credit_units:e.target.value}))}>{['1','2','3','4','6'].map(u=><option key={u}>{u}</option>)}</select></div>
              <div><label style={S.label}>Level</label><select style={S.input} value={crsForm.level} onChange={e=>setCrsForm(p=>({...p,level:e.target.value}))}>{['100','200','300','400','500','600'].map(l=><option key={l}>{l}</option>)}</select></div>
              <div><label style={S.label}>Semester</label><select style={S.input} value={crsForm.semester} onChange={e=>setCrsForm(p=>({...p,semester:e.target.value}))}><option value="first">First</option><option value="second">Second</option></select></div>
              <div><label style={S.label}>Department *</label><select style={S.input} value={crsForm.department_id} onChange={e=>setCrsForm(p=>({...p,department_id:e.target.value}))}><option value="">-- Select --</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label style={S.label}>Lecturer</label><select style={S.input} value={crsForm.lecturer_id} onChange={e=>setCrsForm(p=>({...p,lecturer_id:e.target.value}))}><option value="">-- Unassigned --</option>{lecturers.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}</select></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={addCourse} disabled={savingCrs} style={S.btnPrimary}>{savingCrs?'Saving...':'Create'}</button>
              <button onClick={()=>setShowCrsForm(false)} style={S.btnSm}>Cancel</button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:600}}>
              <thead><tr>{['Code','Name','Units','Level','Dept.','Lecturer','Action'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {courses.map(c=>(
                  <tr key={c.id}>
                    <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa',fontWeight:700}}>{c.course_code}</td>
                    <td style={S.td}>{c.course_name}</td>
                    <td style={{...S.td,textAlign:'center'}}>{c.credit_units}</td>
                    <td style={S.td}>{c.level} Level</td>
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
            {courses.length===0&&<Empty icon="📚" text="No courses yet."/>}
          </div>
        </div>
      </>)}

      {/* ── RESULTS ── */}
      {tab==='results'&&(<>
        <h2 style={S.ct}>Result management</h2>
        <div style={S.card}>
          {courseCodes.length===0?<Empty icon="📊" text="No results yet."/>:
            (courseCodes as string[]).map(code=>{
              const cr=results.filter(r=>r.courses?.course_code===code)
              const locked=cr.every(r=>r.is_locked)&&cr.length>0
              const pub=cr.every(r=>r.published)&&cr.length>0
              return(
                <div key={code} style={{padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
                    <div>
                      <span style={{fontFamily:'monospace',fontWeight:700,color:'#60a5fa',fontSize:14}}>{code}</span>
                      <span style={{fontSize:13,color:'#e8eeff',marginLeft:10}}>{cr[0]?.courses?.course_name}</span>
                      <span style={{fontSize:12,color:'#7a8bbf',marginLeft:8}}>{cr.length} results</span>
                      {locked&&<span style={{marginLeft:8,fontSize:11,background:'rgba(74,222,128,.12)',color:'#4ade80',padding:'2px 8px',borderRadius:100}}>🔒 Submitted</span>}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      {!pub&&<button onClick={()=>releaseResults(code)} style={{...S.btnPrimary,fontSize:12}}>Release to students</button>}
                      {pub&&<span style={{fontSize:12,color:'#4ade80',fontWeight:600}}>✓ Published</span>}
                      {locked&&<button onClick={()=>unlockResults(code)} style={{...S.btnSm,color:'#fbbf24',borderColor:'rgba(251,191,36,.3)'}}>🔓 Unlock</button>}
                    </div>
                  </div>
                </div>
              )
            })
          }
        </div>
      </>)}

      {/* ── FEES ── */}
      {tab==='fees'&&(<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={S.ct}>Fee structure</h2>
          <button onClick={()=>setShowFeeForm(v=>!v)} style={S.btnPrimary}>+ Add fee</button>
        </div>
        {showFeeForm&&(
          <div style={S.formCard}>
            <h3 style={S.formTitle}>Add fee item</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
              <div><label style={S.label}>Fee type *</label><select style={S.input} value={feeForm.fee_type_id} onChange={e=>setFeeForm(p=>({...p,fee_type_id:e.target.value}))}><option value="">-- Select --</option>{feeTypes.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              <div><label style={S.label}>Amount *</label><input style={S.input} type="number" value={feeForm.amount} onChange={e=>setFeeForm(p=>({...p,amount:e.target.value}))} placeholder="150000"/></div>
              <div><label style={S.label}>Session</label><input style={S.input} value={feeForm.session} onChange={e=>setFeeForm(p=>({...p,session:e.target.value}))}/></div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:14}}>
              <button onClick={addFee} disabled={savingFee} style={S.btnPrimary}>{savingFee?'Saving...':'Add'}</button>
              <button onClick={()=>setShowFeeForm(false)} style={S.btnSm}>Cancel</button>
            </div>
          </div>
        )}
        <div style={S.card}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr>{['Fee type','Amount','Session','Action'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>{feeItems.map(f=>(
              <tr key={f.id}>
                <td style={S.td}><strong style={{color:'#e8eeff'}}>{f.fee_types?.name}</strong></td>
                <td style={{...S.td,fontWeight:700,color:'#e8eeff'}}>{formatNaira(f.amount)}</td>
                <td style={S.td}>{f.session}</td>
                <td style={S.td}><button onClick={()=>deleteFee(f.id)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Remove</button></td>
              </tr>
            ))}</tbody>
          </table>
          {feeItems.length===0&&<Empty icon="💳" text="No fee items yet."/>}
        </div>
      </>)}

      {/* ── NEWS ── */}
      {tab==='news'&&(<>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={S.ct}>News & announcements</h2>
          <button onClick={()=>setShowNewsForm(v=>!v)} style={S.btnPrimary}>+ New post</button>
        </div>
        {showNewsForm&&(
          <div style={S.formCard}>
            <h3 style={S.formTitle}>Create announcement</h3>
            <div style={{marginBottom:12}}><label style={S.label}>Title *</label><input style={S.input} value={newsForm.title} onChange={e=>setNewsForm(p=>({...p,title:e.target.value}))} placeholder="Announcement title"/></div>
            <div style={{marginBottom:12}}><label style={S.label}>Content *</label><textarea style={{...S.input,minHeight:100,resize:'vertical'} as React.CSSProperties} value={newsForm.content} onChange={e=>setNewsForm(p=>({...p,content:e.target.value}))} placeholder="Write announcement..."/></div>
            <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,color:'#7a8bbf',cursor:'pointer',marginBottom:14}}>
              <input type="checkbox" checked={newsForm.is_published} onChange={e=>setNewsForm(p=>({...p,is_published:e.target.checked}))} style={{accentColor:'#2d6cff',width:15,height:15}}/>
              Publish immediately
            </label>
            <div style={{display:'flex',gap:10}}>
              <button onClick={addNews} disabled={savingNews} style={S.btnPrimary}>{savingNews?'Saving...':(newsForm.is_published?'Publish':'Save draft')}</button>
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
                    <div style={{fontSize:12,color:'#7a8bbf',marginBottom:6}}>{n.content?.slice(0,120)}{n.content?.length>120?'...':''}</div>
                    <div style={{fontSize:11,color:'#3d4f7a'}}>{n.author_name} · {timeAgo(n.created_at)}</div>
                  </div>
                  <div style={{display:'flex',gap:8,flexShrink:0}}>
                    <span style={{fontSize:11,background:n.is_published?'rgba(74,222,128,.12)':'rgba(255,255,255,.05)',color:n.is_published?'#4ade80':'#7a8bbf',padding:'2px 9px',borderRadius:100,fontWeight:600}}>{n.is_published?'Published':'Draft'}</span>
                    <button onClick={()=>togglePublish(n.id,n.is_published)} style={S.btnSm}>{n.is_published?'Unpublish':'Publish'}</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </>)}

      {/* ── PAYSTACK ── */}
      {tab==='paystack'&&(<>
        <h2 style={S.ct}>Paystack configuration</h2>
        <div style={S.card}>
          <div style={{marginBottom:14}}><label style={S.label}>Public key</label><input style={S.input} value={paystackKey} onChange={e=>setPaystackKey(e.target.value)} placeholder="pk_live_xxxxxxxxxx"/></div>
          <div style={{marginBottom:20}}><label style={S.label}>Secret key</label><input style={S.input} type="password" value={paystackSec} onChange={e=>setPaystackSec(e.target.value)} placeholder="sk_live_xxxxxxxxxx"/></div>
          <button onClick={savePaystack} disabled={savePay} style={S.btnPrimary}>{savePay?'Saving...':'Save keys'}</button>
        </div>
      </>)}

      {/* ── SETTINGS ── */}
      {tab==='settings'&&(
        <div style={S.card}>
          <h2 style={{...S.ct,marginBottom:18}}>Portal settings</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[['school_name','School name'],['school_email','Email'],['school_phone','Phone'],['current_session','Session'],['current_semester','Semester'],['school_address','Address']].map(([f,l])=>(
              <div key={f}><label style={S.label}>{l}</label><input style={S.input} value={orgSettings[f]||''} onChange={e=>setOrgSettings((p:any)=>({...p,[f]:e.target.value}))} placeholder={l}/></div>
            ))}
          </div>
          <button onClick={async()=>{if(!db)return;const{error}=await db.from('org_settings').upsert(orgSettings as any);if(error)toast.error(error.message);else toast.success('Saved!')}} style={{...S.btnPrimary,marginTop:16}}>Save settings</button>
        </div>
      )}

      {/* ── ACADEMIC SETUP ── */}
      {tab==='academic'&&(<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:13,marginBottom:22}}>
          {[['🏛️','Faculties',faculties.length],['🏢','Departments',departments.length],['📚','Courses',courses.length],['👨‍🏫','Lecturers',lecturers.length]].map(([i,l,v])=>(
            <div key={l as string} style={S.stat}><div style={{fontSize:22,marginBottom:6}}>{i}</div><div style={{fontSize:10,color:'#7a8bbf',textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>{l as string}</div><div style={{fontSize:26,fontWeight:800,color:'#e8eeff'}}>{v as number}</div></div>
          ))}
        </div>

        <div style={{display:'flex',gap:6,marginBottom:20,flexWrap:'wrap'}}>
          {(['faculties','departments','courses','lecturers'] as AcademicTab[]).map(id=>(
            <button key={id} onClick={()=>setAcademicTab(id)} style={{...S.tabBtn,padding:'8px 16px',background:academicTab===id?'linear-gradient(135deg,#2d6cff,#4f3ef8)':'rgba(255,255,255,0.04)',color:academicTab===id?'#fff':'#7a8bbf',border:academicTab===id?'none':'1px solid rgba(255,255,255,0.08)'}}>
              {id.charAt(0).toUpperCase()+id.slice(1)}
            </button>
          ))}
        </div>

        {/* Faculties */}
        {academicTab==='faculties'&&(<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{fontSize:13,color:'#7a8bbf'}}>{faculties.length} faculties</p>
            <button onClick={()=>{setFacForm({name:'',code:''});setEditId(null);setShowFacForm(true)}} style={S.btnPrimary}>+ Add faculty</button>
          </div>
          {showFacForm&&(
            <div style={{...S.formCard,marginBottom:14}}>
              <h3 style={S.formTitle}>{editId?'Edit faculty':'New faculty'}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div><label style={S.label}>Name *</label><input style={S.input} value={facForm.name} onChange={e=>setFacForm(p=>({...p,name:e.target.value}))} placeholder="Faculty of Science"/></div>
                <div><label style={S.label}>Code *</label><input style={S.input} value={facForm.code} onChange={e=>setFacForm(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder="FST" maxLength={10}/></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={saveFaculty} disabled={savingAc} style={S.btnPrimary}>{savingAc?'Saving...':'Save'}</button>
                <button onClick={()=>{setShowFacForm(false);setEditId(null)}} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}
          <div style={S.card}>
            {faculties.length===0?<Empty icon="🏛️" text="No faculties yet."/>:(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Name','Code','Depts','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{faculties.map(f=>(
                  <tr key={f.id}>
                    <td style={S.td}><strong style={{color:'#e8eeff'}}>{f.name}</strong></td>
                    <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa'}}>{f.code}</td>
                    <td style={{...S.td,textAlign:'center'}}>{departments.filter(d=>d.faculty_id===f.id).length}</td>
                    <td style={S.td}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setFacForm({name:f.name,code:f.code});setEditId(f.id);setShowFacForm(true)}} style={S.btnSm}>Edit</button>
                        <button onClick={()=>deleteFaculty(f.id,f.name)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>)}

        {/* Departments */}
        {academicTab==='departments'&&(<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{fontSize:13,color:'#7a8bbf'}}>{departments.length} departments — appear in student signup dropdown</p>
            <button onClick={()=>{setDeptForm({name:'',code:'',faculty_id:''});setEditId(null);setShowDeptForm(true)}} style={S.btnPrimary}>+ Add department</button>
          </div>
          {showDeptForm&&(
            <div style={{...S.formCard,marginBottom:14}}>
              <h3 style={S.formTitle}>{editId?'Edit department':'New department'}</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                <div><label style={S.label}>Name *</label><input style={S.input} value={deptForm.name} onChange={e=>setDeptForm(p=>({...p,name:e.target.value}))} placeholder="Computer Science"/></div>
                <div><label style={S.label}>Code *</label><input style={S.input} value={deptForm.code} onChange={e=>setDeptForm(p=>({...p,code:e.target.value.toUpperCase()}))} placeholder="CSC" maxLength={10}/></div>
                <div><label style={S.label}>Faculty *</label><select style={S.input} value={deptForm.faculty_id} onChange={e=>setDeptForm(p=>({...p,faculty_id:e.target.value}))}><option value="">-- Select --</option>{faculties.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={saveDept} disabled={savingAc} style={S.btnPrimary}>{savingAc?'Saving...':'Save'}</button>
                <button onClick={()=>{setShowDeptForm(false);setEditId(null)}} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}
          <div style={S.card}>
            {departments.length===0?<Empty icon="🏢" text="No departments. Add faculties first."/>:(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Department','Code','Faculty','Courses','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{departments.map(d=>(
                  <tr key={d.id}>
                    <td style={S.td}><strong style={{color:'#e8eeff'}}>{d.name}</strong></td>
                    <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa'}}>{d.code}</td>
                    <td style={{...S.td,color:'#7a8bbf'}}>{d.faculties?.name||'—'}</td>
                    <td style={{...S.td,textAlign:'center'}}>{courses.filter(c=>c.department_id===d.id).length}</td>
                    <td style={S.td}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setDeptForm({name:d.name,code:d.code,faculty_id:d.faculty_id});setEditId(d.id);setShowDeptForm(true)}} style={S.btnSm}>Edit</button>
                        <button onClick={()=>deleteDept(d.id,d.name)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>)}

        {/* Courses (academic sub-view) — linked to main courses tab */}
        {academicTab==='courses'&&(
          <div style={S.card}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <p style={{fontSize:13,color:'#7a8bbf'}}>{courses.length} courses — manage assignments here</p>
              <button onClick={()=>navTo('courses')} style={S.btnPrimary}>Open full course manager →</button>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead><tr>{['Code','Course name','Dept.','Lecturer'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>{courses.map(c=>(
                <tr key={c.id}>
                  <td style={{...S.td,fontFamily:'monospace',color:'#60a5fa',fontWeight:700}}>{c.course_code}</td>
                  <td style={S.td}>{c.course_name}</td>
                  <td style={{...S.td,color:'#7a8bbf',fontSize:12}}>{c.departments?.name||'—'}</td>
                  <td style={S.td}>
                    <select value={c.lecturer_id||''} onChange={e=>assignLecturer(c.id,e.target.value)} style={{...S.input,width:180,padding:'5px 8px',fontSize:11}}>
                      <option value="">-- Unassigned --</option>
                      {lecturers.map(l=><option key={l.id} value={l.id}>{l.full_name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {courses.length===0&&<Empty icon="📚" text="No courses. Add departments first, then courses."/>}
          </div>
        )}

        {/* Lecturers */}
        {academicTab==='lecturers'&&(<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <p style={{fontSize:13,color:'#7a8bbf'}}>{lecturers.length} lecturers — direct them to /setup?role=lecturer to activate</p>
            <button onClick={()=>{setLecForm({full_name:'',email:'',staff_id:'',department_id:''});setEditId(null);setShowLecForm(true)}} style={S.btnPrimary}>+ Add lecturer</button>
          </div>
          {showLecForm&&(
            <div style={{...S.formCard,marginBottom:14}}>
              <h3 style={S.formTitle}>{editId?'Edit lecturer':'Add lecturer'}</h3>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12,marginBottom:12}}>
                <div><label style={S.label}>Full name *</label><input style={S.input} value={lecForm.full_name} onChange={e=>setLecForm(p=>({...p,full_name:e.target.value}))} placeholder="Dr. Jane Smith"/></div>
                <div><label style={S.label}>Email *</label><input style={S.input} type="email" value={lecForm.email} onChange={e=>setLecForm(p=>({...p,email:e.target.value}))} placeholder="lecturer@edu.ng"/></div>
                <div><label style={S.label}>Staff ID</label><input style={S.input} value={lecForm.staff_id} onChange={e=>setLecForm(p=>({...p,staff_id:e.target.value}))} placeholder="STAFF/001"/></div>
                <div><label style={S.label}>Department</label><select style={S.input} value={lecForm.department_id} onChange={e=>setLecForm(p=>({...p,department_id:e.target.value}))}><option value="">-- Select --</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button onClick={saveLecturer} disabled={savingAc} style={S.btnPrimary}>{savingAc?'Saving...':editId?'Update':'Add lecturer'}</button>
                <button onClick={()=>{setShowLecForm(false);setEditId(null)}} style={S.btnSm}>Cancel</button>
              </div>
            </div>
          )}
          <div style={S.card}>
            {lecturers.length===0?<Empty icon="👨‍🏫" text="No lecturers yet."/>:(
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr>{['Lecturer','Staff ID','Department','Actions'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>{lecturers.map(l=>(
                  <tr key={l.id}>
                    <td style={S.td}><div style={{fontWeight:600,color:'#e8eeff'}}>{l.full_name}</div><div style={{fontSize:11,color:'#7a8bbf'}}>{l.email}</div></td>
                    <td style={{...S.td,fontFamily:'monospace',fontSize:12,color:'#7a8bbf'}}>{l.staff_id||'—'}</td>
                    <td style={{...S.td,color:'#7a8bbf'}}>{l.departments?.name||'—'}</td>
                    <td style={S.td}>
                      <div style={{display:'flex',gap:6}}>
                        <button onClick={()=>{setLecForm({full_name:l.full_name,email:l.email,staff_id:l.staff_id||'',department_id:l.department_id||''});setEditId(l.id);setShowLecForm(true)}} style={S.btnSm}>Edit</button>
                        <button onClick={()=>deleteLecturer(l.id,l.full_name)} style={{...S.btnSm,color:'#f87171',borderColor:'rgba(248,113,113,.3)'}}>Remove</button>
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </>)}
      </>)}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

function StudentsTable({ students, onApprove, onSuspend, sc, showAll }: { students:any[], onApprove:(id:string,name:string)=>void, onSuspend:(id:string,name:string)=>void, sc:Record<string,string>, showAll?:boolean }) {
  if (!students.length) return <Empty icon="👨‍🎓" text="No students found."/>
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',minWidth:520}}>
        <thead><tr>{(['Student','Matric no.','Level',showAll&&'Dept.',showAll&&'Status',showAll&&'Registered','Actions'] as (string|false|undefined)[]).filter(Boolean).map(h=><th key={h as string} style={S.th}>{h as string}</th>)}</tr></thead>
        <tbody>{students.map(s=>{
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
                <div style={{display:'flex',gap:6}}>
                  {s.status==='pending'&&<button onClick={()=>onApprove(s.id,name)} style={{...S.btnSm,background:'rgba(74,222,128,.12)',color:'#4ade80',border:'1px solid rgba(74,222,128,.25)',fontWeight:700}}>✓ Approve</button>}
                  {s.status==='active'&&<button onClick={()=>onSuspend(s.id,name)} style={{...S.btnSm,background:'rgba(248,113,113,.1)',color:'#f87171',border:'1px solid rgba(248,113,113,.2)'}}>Suspend</button>}
                  {s.status==='suspended'&&<button onClick={()=>onApprove(s.id,name)} style={{...S.btnSm,background:'rgba(74,222,128,.12)',color:'#4ade80',border:'1px solid rgba(74,222,128,.25)'}}>Reactivate</button>}
                </div>
              </td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

function Empty({icon,text}:{icon:string,text:string}){return<div style={{textAlign:'center',padding:'32px 0'}}><div style={{fontSize:40,marginBottom:10}}>{icon}</div><div style={{fontSize:14,color:'#7a8bbf'}}>{text}</div></div>}

const S:Record<string,React.CSSProperties>={
  title:{fontFamily:"'Syne',system-ui",fontWeight:800,fontSize:22,color:'#e8eeff',marginBottom:4},
  sub:{fontSize:13,color:'#7a8bbf'},
  card:{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'18px 20px',marginBottom:16},
  formCard:{background:'rgba(45,108,255,0.06)',border:'1px solid rgba(45,108,255,0.2)',borderRadius:16,padding:'20px 22px',marginBottom:16},
  formTitle:{fontFamily:"'Syne',system-ui",fontWeight:700,fontSize:14,color:'#e8eeff',marginBottom:16},
  stat:{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,padding:'16px 18px'},
  ct:{fontFamily:"'Syne',system-ui",fontWeight:700,fontSize:15,color:'#e8eeff',marginBottom:14},
  th:{textAlign:'left',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:1,color:'#3d4f7a',padding:'8px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',whiteSpace:'nowrap'},
  td:{padding:'11px 12px',borderBottom:'1px solid rgba(255,255,255,0.05)',fontSize:13,color:'#7a8bbf',verticalAlign:'middle'},
  tabBtn:{padding:'7px 13px',borderRadius:9,fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:"'DM Sans',system-ui",transition:'all .2s'},
  btnPrimary:{padding:'8px 18px',background:'linear-gradient(135deg,#2d6cff,#4f3ef8)',color:'#fff',border:'none',borderRadius:10,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
  btnSm:{padding:'5px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'#7a8bbf',fontSize:12,cursor:'pointer',fontFamily:"'DM Sans',system-ui"},
  label:{fontSize:12,color:'#7a8bbf',display:'block',marginBottom:5,fontWeight:500},
  input:{width:'100%',padding:'9px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,color:'#e8eeff',fontSize:13,outline:'none',fontFamily:"'DM Sans',system-ui"},
  spin:{width:32,height:32,border:'2px solid rgba(45,108,255,.2)',borderTopColor:'#2d6cff',borderRadius:'50%',animation:'spin .8s linear infinite'},
}