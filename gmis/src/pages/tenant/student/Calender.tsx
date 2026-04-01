// ============================================================
// GMIS — Academic Calendar
// estam.gmis.app/calendar
//
// DB table expected:
//   academic_calendar (
//     id, title, description, event_date DATE,
//     end_date DATE nullable, event_type TEXT,
//     session TEXT, is_published BOOL
//   )
//
// event_type values:
//   exam | registration | holiday | deadline | resumption |
//   lecture | graduation | orientation | other
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import SidebarLayout from '../../../components/layout/SidebarLayout'

// ── TYPES ─────────────────────────────────────────────────
interface CalEvent {
  id: string
  title: string
  description: string | null
  event_date: string     // YYYY-MM-DD
  end_date: string | null
  event_type: string
  session: string
  is_published: boolean
}

// ── EVENT TYPE CONFIG ─────────────────────────────────────
const EVENT_TYPES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  exam:         { label: 'Exam',           color: '#f87171', bg: 'rgba(248,113,113,0.15)', icon: '📝' },
  registration: { label: 'Registration',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',  icon: '📋' },
  holiday:      { label: 'Holiday',        color: '#4ade80', bg: 'rgba(74,222,128,0.15)',  icon: '🎉' },
  deadline:     { label: 'Deadline',       color: '#fb923c', bg: 'rgba(251,146,60,0.15)',  icon: '⏰' },
  resumption:   { label: 'Resumption',     color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', icon: '🏫' },
  lecture:      { label: 'Lecture event',  color: '#34d399', bg: 'rgba(52,211,153,0.15)',  icon: '🎓' },
  graduation:   { label: 'Graduation',     color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',  icon: '🎓' },
  orientation:  { label: 'Orientation',    color: '#38bdf8', bg: 'rgba(56,189,248,0.15)',  icon: '👋' },
  other:        { label: 'Other',          color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: '📌' },
}

const getType = (t: string) => EVENT_TYPES[t] || EVENT_TYPES.other

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── COMPONENT ─────────────────────────────────────────────
export default function StudentCalendar() {
  const { tenant, slug } = useTenant()
  const today = new Date()

  const [events,       setEvents]       = useState<CalEvent[]>([])
  const [loading,      setLoading]      = useState(true)
  const [currentYear,  setCurrentYear]  = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [view,         setView]         = useState<'month' | 'list'>('month')
  const [typeFilter,   setTypeFilter]   = useState<string>('all')

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => {
    if (db) loadEvents()
  }, [db])

  const loadEvents = async () => {
    if (!db) return
    setLoading(true)
    try {
      const { data, error } = await db
        .from('academic_calendar')
        .select('*')
        .eq('is_published', true)
        .order('event_date', { ascending: true })

      if (error) {
        console.error('Calendar load error:', error.message)
        return
      }

      setEvents((data || []) as CalEvent[])
    } finally {
      setLoading(false)
    }
  }

  // ── CALENDAR GRID ─────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay  = new Date(currentYear, currentMonth, 1).getDay()
    const daysInMon = new Date(currentYear, currentMonth + 1, 0).getDate()
    const daysInPrev= new Date(currentYear, currentMonth, 0).getDate()

    const days: Array<{
      date: string
      day: number
      isCurrentMonth: boolean
      isToday: boolean
      events: CalEvent[]
    }> = []

    // Prev month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrev - i
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date, day: d, isCurrentMonth: false, isToday: false, events: [] })
    }

    // Current month days
    for (let d = 1; d <= daysInMon; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const dayEvents = events.filter(e => {
        if (e.event_date === dateStr) return true
        if (e.end_date && e.event_date <= dateStr && e.end_date >= dateStr) return true
        return false
      })
      days.push({
        date: dateStr,
        day: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        events: dayEvents,
      })
    }

    // Next month leading days
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const date = `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date, day: d, isCurrentMonth: false, isToday: false, events: [] })
    }

    return days
  }, [currentYear, currentMonth, events])

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentYear(y => y - 1); setCurrentMonth(11) }
    else setCurrentMonth(m => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentYear(y => y + 1); setCurrentMonth(0) }
    else setCurrentMonth(m => m + 1)
    setSelectedDate(null)
  }

  const goToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDate(null)
  }

  // Events for selected date
  const selectedEvents = selectedDate
    ? events.filter(e => {
        if (e.event_date === selectedDate) return true
        if (e.end_date && e.event_date <= selectedDate && e.end_date >= selectedDate) return true
        return false
      })
    : []

  // Upcoming events (next 30 days) for list view
  const upcomingEvents = useMemo(() => {
    const now  = today.toISOString().split('T')[0]
    const then = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
    return events
      .filter(e => e.event_date >= now && e.event_date <= then)
      .filter(e => typeFilter === 'all' || e.event_type === typeFilter)
  }, [events, typeFilter])

  // All events for list view (not filtered by date)
  const filteredEvents = events.filter(e => typeFilter === 'all' || e.event_type === typeFilter)

  const formatEventDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SidebarLayout active="calendar">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={S.title}>Academic Calendar</h1>
          <p style={S.sub}>{tenant?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={S.toggle}>
            {(['month', 'list'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  ...S.toggleBtn,
                  background: view === v ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'transparent',
                  color: view === v ? '#fff' : '#7a8bbf',
                  fontWeight: view === v ? 700 : 400,
                }}
              >
                {v === 'month' ? '📅 Month' : '📋 List'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', flexDirection: 'column', gap: 16 }}>
          <div style={S.spin} />
          <p style={{ color: '#7a8bbf', fontSize: 14 }}>Loading calendar...</p>
        </div>
      ) : (
        <>
          {/* ── MONTH VIEW ── */}
          {view === 'month' && (
            <div style={S.card}>
              {/* Month nav */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <button onClick={prevMonth} style={S.navBtn}>‹</button>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, color: '#e8eeff' }}>
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={goToday} style={{ ...S.navBtn, fontSize: 12, padding: '6px 14px', borderRadius: 9 }}>
                    Today
                  </button>
                  <button onClick={nextMonth} style={S.navBtn}>›</button>
                </div>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
                {DAY_NAMES.map(d => (
                  <div key={d} style={{
                    textAlign: 'center', fontSize: 11, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: 1,
                    color: '#3d4f7a', padding: '6px 0',
                  }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                {calendarDays.map((day, idx) => {
                  const isSelected = selectedDate === day.date
                  const hasEvents  = day.events.length > 0

                  return (
                    <div
                      key={idx}
                      onClick={() => day.isCurrentMonth && setSelectedDate(isSelected ? null : day.date)}
                      style={{
                        minHeight: 64, padding: '6px 4px',
                        borderRadius: 10,
                        background: isSelected
                          ? 'rgba(45,108,255,0.18)'
                          : day.isToday
                          ? 'rgba(45,108,255,0.08)'
                          : 'rgba(255,255,255,0.02)',
                        border: isSelected
                          ? '1px solid rgba(45,108,255,0.5)'
                          : day.isToday
                          ? '1px solid rgba(45,108,255,0.25)'
                          : '1px solid rgba(255,255,255,0.04)',
                        cursor: day.isCurrentMonth ? 'pointer' : 'default',
                        opacity: day.isCurrentMonth ? 1 : 0.3,
                        transition: 'all .15s',
                        position: 'relative',
                      }}
                    >
                      <div style={{
                        fontSize: 13, fontWeight: day.isToday ? 800 : 500,
                        color: day.isToday ? '#60a5fa' : isSelected ? '#60a5fa' : '#e8eeff',
                        textAlign: 'center', marginBottom: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {day.isToday ? (
                          <span style={{
                            width: 24, height: 24, borderRadius: '50%',
                            background: '#2d6cff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12,
                          }}>
                            {day.day}
                          </span>
                        ) : day.day}
                      </div>

                      {/* Event dots */}
                      {day.events.slice(0, 3).map((ev, i) => {
                        const tc = getType(ev.event_type)
                        return (
                          <div key={i} style={{
                            fontSize: 9, padding: '1px 4px',
                            borderRadius: 4, marginBottom: 2,
                            background: tc.bg, color: tc.color,
                            fontWeight: 600,
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.4,
                          }}>
                            {tc.icon} {ev.title}
                          </div>
                        )
                      })}
                      {day.events.length > 3 && (
                        <div style={{ fontSize: 9, color: '#7a8bbf', textAlign: 'center' }}>
                          +{day.events.length - 3} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selected date events */}
          {view === 'month' && selectedDate && selectedEvents.length > 0 && (
            <div style={{ ...S.card, marginTop: 14 }}>
              <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 14 }}>
                {formatEventDate(selectedDate)}
              </h3>
              {selectedEvents.map(ev => {
                const tc = getType(ev.event_type)
                return (
                  <EventRow key={ev.id} event={ev} tc={tc} formatEventDate={formatEventDate} />
                )
              })}
            </div>
          )}

          {view === 'month' && selectedDate && selectedEvents.length === 0 && (
            <div style={{ ...S.card, marginTop: 14, textAlign: 'center', padding: '28px 0' }}>
              <div style={{ fontSize: 13, color: '#3d4f7a' }}>No events on {formatEventDate(selectedDate)}</div>
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {view === 'list' && (
            <>
              {/* Filter row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setTypeFilter('all')}
                  style={{
                    ...S.filterBtn,
                    background: typeFilter === 'all' ? 'rgba(45,108,255,0.2)' : 'rgba(255,255,255,0.04)',
                    color: typeFilter === 'all' ? '#60a5fa' : '#7a8bbf',
                    border: typeFilter === 'all' ? '1px solid rgba(45,108,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  All events
                </button>
                {Object.entries(EVENT_TYPES).map(([key, tc]) => (
                  <button
                    key={key}
                    onClick={() => setTypeFilter(key)}
                    style={{
                      ...S.filterBtn,
                      background: typeFilter === key ? tc.bg : 'rgba(255,255,255,0.04)',
                      color: typeFilter === key ? tc.color : '#7a8bbf',
                      border: typeFilter === key ? `1px solid ${tc.color}44` : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {tc.icon} {tc.label}
                  </button>
                ))}
              </div>

              {filteredEvents.length === 0 ? (
                <div style={{ ...S.card, textAlign: 'center', padding: '48px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
                  <div style={{ fontSize: 14, color: '#7a8bbf' }}>No events found</div>
                </div>
              ) : (
                <div style={S.card}>
                  {filteredEvents.map(ev => {
                    const tc = getType(ev.event_type)
                    return (
                      <EventRow key={ev.id} event={ev} tc={tc} formatEventDate={formatEventDate} />
                    )
                  })}
                </div>
              )}
            </>
          )}

          {/* Legend */}
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', marginBottom: 10 }}>
              Event types
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(EVENT_TYPES).map(([key, tc]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: tc.color }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: tc.color, flexShrink: 0 }} />
                  {tc.label}
                </div>
              ))}
            </div>
          </div>

          {/* Empty state */}
          {events.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '20px 0', marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#3d4f7a' }}>
                No events have been published yet. Your admin adds events to this calendar.
              </div>
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

// ── EVENT ROW COMPONENT ────────────────────────────────────
function EventRow({
  event, tc, formatEventDate
}: {
  event: CalEvent
  tc: { label: string; color: string; bg: string; icon: string }
  formatEventDate: (d: string) => string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: event.description ? 'pointer' : 'default',
      }}
      onClick={() => event.description && setOpen(v => !v)}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Type indicator */}
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: tc.bg, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {tc.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 2 }}>
                {event.title}
              </div>
              <div style={{ fontSize: 12, color: '#7a8bbf' }}>
                {formatEventDate(event.event_date)}
                {event.end_date && event.end_date !== event.event_date && (
                  <> — {formatEventDate(event.end_date)}</>
                )}
                {event.session && (
                  <span style={{ marginLeft: 8, color: '#3d4f7a' }}>{event.session}</span>
                )}
              </div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: tc.bg, color: tc.color,
              padding: '2px 9px', borderRadius: 100,
              whiteSpace: 'nowrap',
            }}>
              {tc.label}
            </span>
          </div>

          {/* Description (expandable) */}
          {open && event.description && (
            <div style={{
              marginTop: 8, fontSize: 13, color: '#7a8bbf',
              lineHeight: 1.6, paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              {event.description}
            </div>
          )}
          {event.description && (
            <div style={{ fontSize: 11, color: '#3d4f7a', marginTop: 4 }}>
              {open ? '▲ Less' : '▼ More details'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  title:     { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#7a8bbf' },
  card:      { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
  toggle:    { display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 11, padding: 3 },
  toggleBtn: { padding: '7px 14px', borderRadius: 9, border: 'none', fontSize: 12, cursor: 'pointer', transition: 'all .2s', fontFamily: "'DM Sans',system-ui" },
  navBtn:    { padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8eeff', cursor: 'pointer', fontSize: 18, fontFamily: "'DM Sans',system-ui" },
  filterBtn: { padding: '6px 12px', borderRadius: 9, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", fontWeight: 500, transition: 'all .15s' },
  spin:      { width: 32, height: 32, border: '2px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}