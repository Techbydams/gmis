// ============================================================
// GMIS — Student Clearance
// estam.gmis.app/clearance
// ============================================================
import { useState, useEffect } from 'react'
import { useAuth }   from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import { formatDate } from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

interface ClearanceItem {
  id: string; department: string; status: string
  cleared_by: string | null; notes: string | null
  session: string; updated_at: string
}

const DEPARTMENTS = [
  { key: 'library',  label: 'Library',    icon: '📚', desc: 'Return all borrowed books and clear any outstanding fines' },
  { key: 'fees',     label: 'Fees',       icon: '💳', desc: 'All semester fees must be fully paid and confirmed' },
  { key: 'hostel',   label: 'Hostel',     icon: '🏠', desc: 'Return your room key and clear all hostel charges' },
  { key: 'lab',      label: 'Laboratory', icon: '🔬', desc: 'Return all laboratory equipment and clear outstanding fees' },
  { key: 'sports',   label: 'Sports',     icon: '⚽', desc: 'Return sports equipment and clear all dues' },
]

export default function Clearance() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const [items,   setItems]   = useState<ClearanceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState('2024/2025')

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db && user) load() }, [db, user])

  const load = async () => {
    setLoading(true)
    const { data: s } = await db!.from('students').select('id').eq('supabase_uid', user!.id).single()
    if (!s) { setLoading(false); return }

    const { data } = await db!
      .from('clearance_items')
      .select('*')
      .eq('student_id', s.id)
      .eq('session', session)
    setItems((data || []) as ClearanceItem[])
    setLoading(false)
  }

  const getStatus = (dept: string) => items.find(i => i.department === dept)

  const cleared = DEPARTMENTS.filter(d => getStatus(d.key)?.status === 'cleared').length
  const total   = DEPARTMENTS.length
  const allClear = cleared === total

  return (
    <SidebarLayout active="clearance">
      <h1 style={S.title}>End-of-year clearance</h1>
      <p style={S.sub}>Complete all clearance items before the semester ends. Managed by your school admin.</p>

      {/* Progress card */}
      <div style={{ ...S.card, marginBottom: 20, padding: '24px 28px', background: allClear ? 'rgba(74,222,128,0.07)' : 'rgba(255,255,255,0.03)', border: allClear ? '1px solid rgba(74,222,128,0.25)' : '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Syne',system-ui", fontSize: 36, fontWeight: 900, color: allClear ? '#4ade80' : '#e8eeff', lineHeight: 1, marginBottom: 6 }}>
              {cleared}/{total}
            </div>
            <div style={{ fontSize: 14, color: allClear ? '#4ade80' : '#7a8bbf' }}>
              {allClear ? '✅ All clearances complete! You are fully cleared.' : 'Clearance items completed'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#3d4f7a', marginBottom: 4 }}>Session</div>
            <select value={session} onChange={e => { setSession(e.target.value); load() }}
              style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 9, color: '#e8eeff', fontSize: 12, cursor: 'pointer' }}>
              {['2024/2025', '2023/2024', '2022/2023'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, marginTop: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(cleared / total) * 100}%`, background: allClear ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#2d6cff,#4f3ef8)', borderRadius: 5, transition: 'width .8s ease' }} />
        </div>
      </div>

      {/* Clearance items */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 28, height: 28, border: '2px solid rgba(45,108,255,.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} /></div>
      ) : (
        <div style={S.card}>
          {DEPARTMENTS.map((dept, i) => {
            const item = getStatus(dept.key)
            const isCleared = item?.status === 'cleared'
            const isRejected = item?.status === 'rejected'

            return (
              <div key={dept.key} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 0', borderBottom: i < DEPARTMENTS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                {/* Icon */}
                <div style={{ width: 52, height: 52, borderRadius: 14, background: isCleared ? 'rgba(74,222,128,0.12)' : isRejected ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: `1px solid ${isCleared ? 'rgba(74,222,128,0.25)' : isRejected ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.08)'}` }}>
                  {dept.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#e8eeff', marginBottom: 3 }}>{dept.label}</div>
                  <div style={{ fontSize: 12, color: '#7a8bbf' }}>{dept.desc}</div>
                  {item?.notes && <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 4 }}>📝 {item.notes}</div>}
                  {isCleared && item?.cleared_by && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>Cleared by {item.cleared_by} · {formatDate(item.updated_at)}</div>}
                </div>

                {/* Status badge */}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, flexShrink: 0, background: isCleared ? 'rgba(74,222,128,0.15)' : isRejected ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)', color: isCleared ? '#4ade80' : isRejected ? '#f87171' : '#fbbf24' }}>
                  {isCleared ? 'Cleared ✓' : isRejected ? 'Rejected' : 'Pending'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: '12px 16px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 12, fontSize: 13, color: '#60a5fa' }}>
        ℹ Clearance items are marked by the respective departments. Contact the relevant office if your status is incorrect.
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

const S: Record<string, React.CSSProperties> = {
  title: { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:   { fontSize: 13, color: '#7a8bbf', marginBottom: 22 },
  card:  { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px', marginBottom: 16 },
}