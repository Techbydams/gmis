// ============================================================
// GMIS — Student Timetable
// /timetable
// Shows classes filtered by the student's department + level
// Live status: NOW / UP NEXT / ENDED — auto-updates every 30s
// Also shows exam timetable in a second tab
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useAuth }   from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import SidebarLayout from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
type Day = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'

interface TTEntry {
  id: string
  day_of_week: Day
  start_time: string
  end_time: string
  venue: string | null
  session: string | null
  semester: string | null
  courses?: {
    course_code: string
    course_name: string
    credit_units: number
    lecturers?: { full_name: string }
  }
}

interface ExamEntry {
  id: string
  exam_date: string
  start_time: string
  end_time: string
  venue: string | null
  session: string | null
  semester: string | null
  instructions: string | null
  courses?: {
    course_code: string
    course_name: string
    credit_units: number
  }
}

interface StudentProfile {
  first_name: string
  level: string
  department_id: string
  departments?: { name: string }
}

interface OrgSettings {
  current_session: string
  current_semester: string
}

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

const todayIdx   = new Date().getDay() // 0=Sun
const todayName: Day = DAYS[todayIdx - 1] ?? 'monday'

const fmtTime = (t: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr   = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

type ClassStatus = 'now' | 'next' | 'past' | 'upcoming' | 'other_day'

const getStatus = (entry: TTEntry, nowDay: Day, nowTime: string): ClassStatus => {
  if (entry.day_of_week !== nowDay) return 'other_day'
  const s = entry.start_time.slice(0, 5)
  const e = entry.end_time.slice(0, 5)
  if (nowTime >= s && nowTime < e)  return 'now'
  if (nowTime < s)                  return 'next'   // will be refined to 'upcoming' below
  return 'past'
}

// ── COMPONENT ─────────────────────────────────────────────
export default function StudentTimetable() {
  const { user }       = useAuth()
  const { tenant, slug } = useTenant()
  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug])

  const [profile,    setProfile]    = useState<StudentProfile | null>(null)
  const [entries,    setEntries]    = useState<TTEntry[]>([])
  const [exams,      setExams]      = useState<ExamEntry[]>([])
  const [settings,   setSettings]   = useState<OrgSettings | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [activeDay,  setActiveDay]  = useState<Day>(todayName)
  const [tab,        setTab]        = useState<'classes'|'exams'>('classes')

  // Live time — updates every 30 seconds
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const nowDay  = DAYS[now.getDay() - 1] ?? 'monday'
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  useEffect(() => { if (db && user) loadAll() }, [db, user])

  const loadAll = async () => {
    if (!db || !user) return
    setLoading(true)

    // 1. Get student profile (dept + level)
    const { data: p } = await db
      .from('students')
      .select('first_name, level, department_id, departments(name)')
      .eq('supabase_uid', user.id)
      .maybeSingle()

    if (!p) { setLoading(false); return }
    setProfile(p as StudentProfile)

    // 2. Get org settings (current session + semester)
    const { data: s } = await db
      .from('org_settings')
      .select('current_session, current_semester')
      .maybeSingle()
    if (s) setSettings(s as OrgSettings)

    // 3. Load timetable — get all entries for this school then filter by dept+level client-side
    //    (courses.department_id = student's dept AND courses.level = student's level)
    const { data: tt } = await db
      .from('timetable')
      .select('id, day_of_week, start_time, end_time, venue, session, semester, courses(course_code, course_name, credit_units, lecturers(full_name))')
      .order('day_of_week').order('start_time')

    if (tt) {
      // Filter to student's dept + level. We need courses to know dept, but Supabase
      // doesn't let us filter on nested relations easily so we do it client-side.
      // We separately fetch courses for this dept+level to get their IDs for matching.
      const { data: deptCourses } = await db
        .from('courses')
        .select('id')
        .eq('department_id', (p as StudentProfile).department_id)
        .eq('level', (p as StudentProfile).level)
        .eq('is_active', true)

      const deptCourseIds = new Set((deptCourses || []).map((c: any) => c.id))

      // Match timetable entries against the student's courses
      const filtered = (tt as any[]).filter(e => deptCourseIds.has(e.course_id || e.courses?.id))

      // If course_id isn't in the select, do it with a fallback
      setEntries(tt.filter((_e, i) => {
        // Since we selected courses inline, we match via course join
        return true // will filter by deptCourseIds below after getting course IDs
      }).filter((e: any) => {
        if (!e.courses) return false
        return true
      }) as TTEntry[])

      // Better approach: fetch timetable entries where course_id is in the dept course list
      if (deptCourses && deptCourses.length > 0) {
        const ids = deptCourses.map((c: any) => c.id)
        const { data: studentTT } = await db
          .from('timetable')
          .select('id, day_of_week, start_time, end_time, venue, session, semester, courses(course_code, course_name, credit_units, lecturers(full_name))')
          .in('course_id', ids)
          .eq(s?.current_session  ? 'session'  : 'id', s?.current_session  || 'skip' )
          .order('day_of_week').order('start_time')

        // Re-query without session filter if no results
        if (!studentTT || studentTT.length === 0) {
          const { data: fallback } = await db
            .from('timetable')
            .select('id, day_of_week, start_time, end_time, venue, session, semester, courses(course_code, course_name, credit_units, lecturers(full_name))')
            .in('course_id', ids)
            .order('day_of_week').order('start_time')
          setEntries((fallback || []) as TTEntry[])
        } else {
          setEntries(studentTT as TTEntry[])
        }
      } else {
        setEntries([])
      }
    }

    // 4. Load exam timetable
    const { data: examCourses } = await db
      .from('courses')
      .select('id')
      .eq('department_id', (p as StudentProfile).department_id)
      .eq('level', (p as StudentProfile).level)
    if (examCourses && examCourses.length > 0) {
      const ids = examCourses.map((c: any) => c.id)
      const { data: et } = await db
        .from('exam_timetable')
        .select('id, exam_date, start_time, end_time, venue, session, semester, instructions, courses(course_code, course_name, credit_units)')
        .in('course_id', ids)
        .order('exam_date').order('start_time')
      if (et) setExams(et as ExamEntry[])
    }

    setLoading(false)
  }

  // ── DERIVED ───────────────────────────────────────────────
  const entriesByDay = useMemo(() => {
    const map = {} as Record<Day, TTEntry[]>
    DAYS.forEach(d => { map[d] = [] })
    entries.forEach(e => { if (map[e.day_of_week]) map[e.day_of_week].push(e) })
    return map
  }, [entries])

  const todayEntries = entriesByDay[nowDay] || []

  // Determine "now" and "up next" for today
  const nowClass  = todayEntries.find(e => getStatus(e, nowDay, nowTime) === 'now')
  const nextClass = todayEntries
    .filter(e => getStatus(e, nowDay, nowTime) === 'next')
    .sort((a, b) => a.start_time.localeCompare(b.start_time))[0]

  const upcomingExams = exams.filter(e => new Date(e.exam_date) >= new Date())

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SidebarLayout>
      <div style={{ fontFamily: "'DM Sans',system-ui", color: '#e8eeff', padding: 'clamp(14px,3vw,28px)' }}>

        {/* Page header */}
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, margin: 0 }}>Timetable</h2>
          <p style={{ fontSize: 13, color: '#7a8bbf', margin: '4px 0 0' }}>
            {profile ? `${(profile.departments as any)?.name} · ${profile.level}L · ${settings?.current_session || ''} · ${settings?.current_semester || ''} semester` : ''}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={S.spin} />
          </div>
        ) : (
          <>
            {/* ── LIVE CLASS BANNER ── */}
            {(nowClass || nextClass) && (
              <div style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {nowClass && (
                  <div style={{ flex: 1, minWidth: 220, padding: '14px 18px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80', flexShrink: 0, boxShadow: '0 0 0 4px rgba(74,222,128,0.2)', animation: 'pulse 2s infinite' }} />
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Now in class</div>
                      <div style={{ fontWeight: 700, color: '#e8eeff', fontSize: 14 }}>
                        <span style={{ fontFamily: 'monospace', color: '#4ade80' }}>{nowClass.courses?.course_code}</span> {nowClass.courses?.course_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 2 }}>
                        {nowClass.venue && `📍 ${nowClass.venue} · `}{fmtTime(nowClass.start_time)} – {fmtTime(nowClass.end_time)}
                      </div>
                    </div>
                  </div>
                )}
                {nextClass && (
                  <div style={{ flex: 1, minWidth: 220, padding: '14px 18px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 20 }}>⏭</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Up next today</div>
                      <div style={{ fontWeight: 700, color: '#e8eeff', fontSize: 14 }}>
                        <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{nextClass.courses?.course_code}</span> {nextClass.courses?.course_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 2 }}>
                        {nextClass.venue && `📍 ${nextClass.venue} · `}{fmtTime(nextClass.start_time)} – {fmtTime(nextClass.end_time)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {([['classes', '📅 Class Schedule'], ['exams', '📝 Exam Timetable']] as [typeof tab, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  padding: '8px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans',system-ui", transition: 'all .15s', fontWeight: tab === id ? 700 : 400,
                  background: tab === id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
                  color: tab === id ? '#fff' : '#7a8bbf',
                  border: tab === id ? 'none' : '1px solid rgba(255,255,255,0.08)',
                }}>
                  {label}
                  {id === 'exams' && upcomingExams.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 11, background: 'rgba(248,113,113,0.2)', color: '#f87171', padding: '1px 7px', borderRadius: 100 }}>
                      {upcomingExams.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── CLASS SCHEDULE TAB ── */}
            {tab === 'classes' && (
              <>
                {entries.length === 0
                  ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#3d4f7a' }}>
                      <div style={{ fontSize: 44, marginBottom: 14 }}>📭</div>
                      <div style={{ fontSize: 14 }}>No timetable available for your class yet.</div>
                      <div style={{ fontSize: 12, marginTop: 8 }}>Check back after the admin publishes your schedule.</div>
                    </div>
                  )
                  : (
                    <>
                      {/* Day tabs */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
                        {DAYS.map(d => {
                          const isToday = d === nowDay
                          const count   = entriesByDay[d].length
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

                      {/* Entries for selected day */}
                      {entriesByDay[activeDay].length === 0
                        ? (
                          <div style={{ textAlign: 'center', padding: '40px 0', color: '#3d4f7a' }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
                            <div style={{ fontSize: 14 }}>No classes on {DAY_FULL[activeDay]}!</div>
                          </div>
                        )
                        : [...entriesByDay[activeDay]]
                            .sort((a, b) => a.start_time.localeCompare(b.start_time))
                            .map((e, i) => {
                              const isActiveDay = activeDay === nowDay
                              const st      = getStatus(e, nowDay, nowTime)
                              const isNow   = isActiveDay && st === 'now'
                              const isNext  = isActiveDay && st === 'next' && i === [...entriesByDay[activeDay]].sort((a,b) => a.start_time.localeCompare(b.start_time)).findIndex(x => getStatus(x, nowDay, nowTime) === 'next')
                              const isPast  = isActiveDay && st === 'past'

                              return (
                                <div key={e.id} style={{
                                  background: isNow  ? 'rgba(74,222,128,0.07)' :
                                              isNext ? 'rgba(251,191,36,0.06)' :
                                              'rgba(255,255,255,0.03)',
                                  border: `1px solid ${isNow  ? 'rgba(74,222,128,0.25)' :
                                                        isNext ? 'rgba(251,191,36,0.2)' :
                                                        'rgba(255,255,255,0.07)'}`,
                                  borderRadius: 14, padding: '14px 16px', marginBottom: 10,
                                  display: 'flex', alignItems: 'center', gap: 14,
                                  opacity: isPast ? 0.55 : 1,
                                  transition: 'opacity .2s',
                                }}>
                                  {/* Time */}
                                  <div style={{ minWidth: 78, textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '8px 6px', flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isNow ? '#4ade80' : isNext ? '#fbbf24' : '#60a5fa' }}>
                                      {fmtTime(e.start_time)}
                                    </div>
                                    <div style={{ fontSize: 9, color: '#3d4f7a', margin: '3px 0' }}>——</div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isNow ? '#4ade80' : isNext ? '#fbbf24' : '#60a5fa' }}>
                                      {fmtTime(e.end_time)}
                                    </div>
                                  </div>

                                  {/* Course info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e8eeff', fontSize: 13 }}>
                                        {e.courses?.course_code}
                                      </span>
                                      <span style={{ fontSize: 13, color: '#e8eeff' }}>{e.courses?.course_name}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#7a8bbf', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                      {e.venue && <span>📍 {e.venue}</span>}
                                      {(e.courses?.lecturers as any)?.full_name && <span>👤 {(e.courses?.lecturers as any).full_name}</span>}
                                      {e.courses?.credit_units && <span>⚡ {e.courses.credit_units} units</span>}
                                    </div>
                                  </div>

                                  {/* Status badge */}
                                  {isActiveDay && (
                                    <div style={{ flexShrink: 0 }}>
                                      {isNow && (
                                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '4px 10px', borderRadius: 100, animation: 'pulse 2s infinite' }}>
                                          🔴 NOW
                                        </span>
                                      )}
                                      {isNext && (
                                        <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '4px 10px', borderRadius: 100 }}>
                                          ⏭ NEXT
                                        </span>
                                      )}
                                      {isPast && (
                                        <span style={{ fontSize: 11, color: '#3d4f7a', padding: '4px 10px' }}>Ended</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })
                      }
                    </>
                  )
                }
              </>
            )}

            {/* ── EXAM TIMETABLE TAB ── */}
            {tab === 'exams' && (
              exams.length === 0
                ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: '#3d4f7a' }}>
                    <div style={{ fontSize: 44, marginBottom: 14 }}>📝</div>
                    <div style={{ fontSize: 14 }}>No exam timetable published yet.</div>
                  </div>
                )
                : (
                  <div>
                    {upcomingExams.length > 0 && (
                      <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 12, marginBottom: 16, fontSize: 13, color: '#f87171' }}>
                        ⚠️ You have <strong>{upcomingExams.length}</strong> upcoming exam{upcomingExams.length > 1 ? 's' : ''}. Good luck!
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {exams.map(e => {
                        const isUpcoming = new Date(e.exam_date) >= new Date()
                        const isPast     = !isUpcoming
                        return (
                          <div key={e.id} style={{
                            background: isUpcoming ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isUpcoming ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.06)'}`,
                            borderRadius: 14, padding: '14px 16px',
                            opacity: isPast ? 0.5 : 1, display: 'flex', gap: 14, alignItems: 'center',
                          }}>
                            {/* Date block */}
                            <div style={{ minWidth: 64, textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: '8px 6px', flexShrink: 0 }}>
                              <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', marginBottom: 2 }}>
                                {new Date(e.exam_date).toLocaleDateString('en', { month: 'short' })}
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, color: isUpcoming ? '#f87171' : '#3d4f7a' }}>
                                {new Date(e.exam_date).getDate()}
                              </div>
                              <div style={{ fontSize: 10, color: '#7a8bbf' }}>
                                {new Date(e.exam_date).toLocaleDateString('en', { weekday: 'short' })}
                              </div>
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#e8eeff' }}>{e.courses?.course_code}</span>
                                <span style={{ fontSize: 13, color: '#e8eeff' }}>{e.courses?.course_name}</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#7a8bbf', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span>🕐 {fmtTime(e.start_time)} – {fmtTime(e.end_time)}</span>
                                {e.venue && <span>📍 {e.venue}</span>}
                              </div>
                              {e.instructions && (
                                <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 5, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 7, borderLeft: '2px solid rgba(96,165,250,0.4)' }}>
                                  ℹ {e.instructions}
                                </div>
                              )}
                            </div>
                            {isPast && (
                              <span style={{ fontSize: 11, color: '#3d4f7a', flexShrink: 0 }}>Completed</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  spin: { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}