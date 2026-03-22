// ============================================================
// GMIS — Student Timetable
// Weekly grid built from live timetable data in Supabase
// ============================================================
import { useState, useEffect } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface Slot {
  id: string
  day_of_week: string
  start_time: string
  end_time: string
  venue: string
  courses: { course_code: string; course_name: string }
  lecturers?: { full_name: string }
}

const DAYS   = ['monday','tuesday','wednesday','thursday','friday']
const LABELS = ['Mon','Tue','Wed','Thu','Fri']
const COLORS = ['#2d6cff','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f43f5e']

export default function StudentTimetable() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const [slots,    setSlots]    = useState<Slot[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<'grid'|'list'>('grid')
  const [tab,      setTab]      = useState<'class'|'exam'>('class')

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db && user) load() }, [db, user])

  const load = async () => {
    setLoading(true)
    if (!db || !user) { setLoading(false); return }

    // Get student record
    const { data: s } = await db.from('students').select('id').eq('supabase_uid', user.id).single()
    if (!s) { setLoading(false); return }

    // Get their registered courses
    const { data: regs } = await db
      .from('semester_registrations').select('course_id')
      .eq('student_id', s.id).eq('status', 'registered')

    if (!regs?.length) { setLoading(false); return }

    const courseIds = regs.map((r: any) => r.course_id)

    // Get timetable slots for those courses
    const table = tab === 'exam' ? 'exam_timetable' : 'timetable'
    const { data } = await db
      .from(table)
      .select('*, courses(course_code, course_name), lecturers(full_name)')
      .in('course_id', courseIds)
      .order('start_time')

    if (data) setSlots(data as Slot[])
    setLoading(false)
  }

  useEffect(() => { if (db && user) load() }, [tab])

  // Get slots for a specific day
  const daySlots = (day: string) => slots.filter(s => s.day_of_week === day)

  // Assign consistent color per course code
  const courseColor = (code: string) => {
    const idx = code.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
    return COLORS[idx]
  }

  const today = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]

  return (
    <SidebarLayout active="timetable">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={S.title}>Timetable</h1>
          <p style={S.sub}>
            {new Date().toLocaleDateString('en-NG',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          </p>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Class / Exam toggle */}
          <div style={S.toggle}>
            {(['class','exam'] as const).map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                style={{...S.toggleBtn, background:tab===t?'linear-gradient(135deg,#2d6cff,#4f3ef8)':'transparent', color:tab===t?'#fff':'#7a8bbf', fontWeight:tab===t?700:400}}>
                {t==='class'?'📅 Class':'📝 Exam'} timetable
              </button>
            ))}
          </div>
          {/* Grid / List toggle */}
          <div style={S.toggle}>
            {(['grid','list'] as const).map(v=>(
              <button key={v} onClick={()=>setView(v)}
                style={{...S.toggleBtn, background:view===v?'rgba(45,108,255,0.2)':'transparent', color:view===v?'#60a5fa':'#7a8bbf'}}>
                {v==='grid'?'⊞':'☰'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <Spin /> : slots.length === 0 ? (
        <div style={S.empty}>
          <div style={{fontSize:48,marginBottom:12}}>📅</div>
          <div style={{fontSize:16,color:'#7a8bbf',marginBottom:6}}>No {tab} timetable yet</div>
          <div style={{fontSize:13,color:'#3d4f7a'}}>Register for courses first, then your timetable will appear here.</div>
        </div>
      ) : view === 'grid' ? (

        // ── GRID VIEW ──────────────────────────────────────
        <div style={S.card}>
          <div style={{overflowX:'auto'}}>
            <div style={{minWidth:580}}>
              {/* Day headers */}
              <div style={{display:'grid',gridTemplateColumns:`80px repeat(${DAYS.length},1fr)`,marginBottom:4}}>
                <div/>
                {DAYS.map((d,i)=>(
                  <div key={d} style={{
                    padding:'10px 6px', textAlign:'center',
                    fontSize:13, fontWeight:700,
                    color: d===today ? '#60a5fa' : '#7a8bbf',
                    background: d===today ? 'rgba(45,108,255,0.08)' : 'transparent',
                    borderRadius:10, marginRight:4,
                  }}>
                    {LABELS[i]}
                    {d===today&&<div style={{width:5,height:5,borderRadius:'50%',background:'#2d6cff',margin:'4px auto 0'}}/>}
                  </div>
                ))}
              </div>

              {/* Time slots */}
              <div style={{display:'grid',gridTemplateColumns:`80px repeat(${DAYS.length},1fr)`,gap:4,alignItems:'start'}}>
                {/* Time labels */}
                <div style={{display:'flex',flexDirection:'column',gap:4,paddingTop:4}}>
                  {['8:00','9:00','10:00','11:00','12:00','1:00','2:00','3:00','4:00','5:00'].map(t=>(
                    <div key={t} style={{height:52,display:'flex',alignItems:'center',fontSize:10,color:'#3d4f7a',paddingRight:8,justifyContent:'flex-end'}}>{t}</div>
                  ))}
                </div>

                {/* Day columns */}
                {DAYS.map(day=>(
                  <div key={day} style={{display:'flex',flexDirection:'column',gap:4, background:day===today?'rgba(45,108,255,0.04)':'transparent',borderRadius:10,padding:2}}>
                    {daySlots(day).length===0
                      ?<div style={{height:52,display:'flex',alignItems:'center',justifyContent:'center',color:'#3d4f7a',fontSize:11}}>—</div>
                      :daySlots(day).map(slot=>{
                        const col = courseColor(slot.courses?.course_code||'')
                        return(
                          <div key={slot.id} style={{background:col+'18',border:`1px solid ${col}35`,borderLeft:`3px solid ${col}`,borderRadius:'0 9px 9px 0',padding:'8px 10px',minHeight:52}}>
                            <div style={{fontWeight:700,fontSize:11,color:col}}>{slot.courses?.course_code}</div>
                            <div style={{fontSize:10,color:'#7a8bbf',marginTop:2,lineHeight:1.3}}>{slot.courses?.course_name?.slice(0,22)}{(slot.courses?.course_name?.length||0)>22?'...':''}</div>
                            <div style={{fontSize:10,color:'#3d4f7a',marginTop:2}}>{slot.start_time?.slice(0,5)}–{slot.end_time?.slice(0,5)}</div>
                            {slot.venue&&<div style={{fontSize:10,color:'#3d4f7a'}}>{slot.venue}</div>}
                          </div>
                        )
                      })
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      ) : (

        // ── LIST VIEW ──────────────────────────────────────
        <div>
          {DAYS.map((day, di) => {
            const ds = daySlots(day)
            if (!ds.length) return null
            return (
              <div key={day} style={{marginBottom:16}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:700,color:day===today?'#60a5fa':'#7a8bbf',textTransform:'capitalize'}}>{LABELS[di]}</div>
                  {day===today&&<span style={{fontSize:10,fontWeight:700,background:'rgba(45,108,255,0.2)',color:'#60a5fa',padding:'2px 8px',borderRadius:100}}>Today</span>}
                  <div style={{flex:1,height:1,background:'rgba(255,255,255,0.06)'}}/>
                </div>
                {ds.map(slot=>{
                  const col=courseColor(slot.courses?.course_code||'')
                  return(
                    <div key={slot.id} style={{display:'flex',gap:14,alignItems:'center',padding:'12px 16px',background:'rgba(255,255,255,0.03)',border:`1px solid rgba(255,255,255,0.07)`,borderLeft:`3px solid ${col}`,borderRadius:'0 14px 14px 0',marginBottom:8}}>
                      <div style={{minWidth:80,textAlign:'right'}}>
                        <div style={{fontSize:12,fontWeight:700,color:'#e8eeff'}}>{slot.start_time?.slice(0,5)}</div>
                        <div style={{fontSize:11,color:'#3d4f7a'}}>– {slot.end_time?.slice(0,5)}</div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:14,color:col}}>{slot.courses?.course_code}</div>
                        <div style={{fontSize:13,color:'#e8eeff'}}>{slot.courses?.course_name}</div>
                        <div style={{fontSize:11,color:'#7a8bbf',marginTop:2}}>
                          {slot.venue&&`📍 ${slot.venue}`}
                          {slot.lecturers?.full_name&&` · 👨‍🏫 ${slot.lecturers.full_name}`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* Color legend */}
      {slots.length > 0 && (
        <div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:16}}>
          {Array.from(new Set(slots.map(s=>s.courses?.course_code))).map(code=>(
            <div key={code} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'#7a8bbf'}}>
              <div style={{width:10,height:10,borderRadius:3,background:courseColor(code),flexShrink:0}}/>
              {code}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

function Spin(){return<div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'60px 0'}}><div style={{width:32,height:32,border:'2px solid rgba(45,108,255,.2)',borderTopColor:'#2d6cff',borderRadius:'50%',animation:'spin .8s linear infinite'}}/></div>}

const S: Record<string,React.CSSProperties> = {
  title:     {fontFamily:"'Syne',system-ui",fontWeight:800,fontSize:22,color:'#e8eeff',marginBottom:4},
  sub:       {fontSize:13,color:'#7a8bbf'},
  card:      {background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:18,padding:'18px 16px'},
  toggle:    {display:'flex',background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:11,padding:3},
  toggleBtn: {padding:'6px 12px',borderRadius:9,border:'none',fontSize:12,cursor:'pointer',transition:'all .2s',fontFamily:"'DM Sans',system-ui"},
  empty:     {textAlign:'center',padding:'60px 20px',color:'#3d4f7a'},
}
