// ============================================================
// GMIS — Parent Portal
// estam.gmis.app/parent
// Parents link via matric number to monitor ward
// ============================================================
import { useState, useEffect } from 'react'
import { useAuth }   from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { getTenantClient } from '../../lib/supabase'
import { formatGPA, getHonourClass, formatNaira, formatDate, timeAgo } from '../../lib/helpers'
import toast from 'react-hot-toast'

interface Ward {
  id: string; first_name: string; last_name: string
  matric_number: string; level: string; status: string
  gpa: number; cgpa: number; email: string
  departments?: { name: string }
}

interface Payment {
  id: string; amount: number; status: string; paid_at: string | null
  fee_types: { name: string }
}

interface Result {
  grade: string; total_score: number; session: string; semester: string
  courses: { course_code: string; course_name: string }
}

type Tab = 'overview' | 'results' | 'payments' | 'attendance'

export default function ParentPortal() {
  const { tenant, slug } = useTenant()
  const [matricInput, setMatricInput] = useState('')
  const [emailInput,  setEmailInput]  = useState('')
  const [linked,   setLinked]   = useState(false)
  const [ward,     setWard]     = useState<Ward | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [results,  setResults]  = useState<Result[]>([])
  const [tab,      setTab]      = useState<Tab>('overview')
  const [loading,  setLoading]  = useState(false)
  const [linking,  setLinking]  = useState(false)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  const linkWard = async () => {
    if (!matricInput.trim() || !emailInput.trim()) { toast.error('Enter both your email and your ward\'s matric number'); return }
    setLinking(true)
    const { data, error } = await db!
      .from('students')
      .select('*, departments(name)')
      .eq('matric_number', matricInput.trim().toUpperCase())
      .single()

    setLinking(false)
    if (error || !data) { toast.error('Matric number not found. Check and try again.'); return }

    const d = data as any
    setWard(d as Ward)
    setLinked(true)
    loadWardData(d.id)
    toast.success(`Linked to ${d.first_name} ${d.last_name}'s profile`)
  }

  const loadWardData = async (wardId: string) => {
    setLoading(true)
    const [paymentsRes, resultsRes] = await Promise.all([
      db!.from('student_payments').select('*, fee_types(name)').eq('student_id', wardId).order('created_at', { ascending: false }),
      db!.from('results').select('grade, total_score, session, semester, courses(course_code, course_name)').eq('student_id', wardId).eq('published', true).order('created_at', { ascending: false }),
    ])
    if (paymentsRes.data) setPayments(paymentsRes.data as Payment[])
    if (resultsRes.data)  setResults(resultsRes.data as Result[])
    setLoading(false)
  }

  // ── LINK SCREEN ──────────────────────────────────────────
  if (!linked) return (
    <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans',system-ui" }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 64, marginBottom: 14, animation: 'float 4s ease-in-out infinite' }}>👨‍👩‍👦</div>
          <h1 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 24, color: '#e8eeff', marginBottom: 6 }}>Parent portal</h1>
          <p style={{ fontSize: 14, color: '#7a8bbf' }}>Enter your ward's matric number to monitor their progress</p>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '28px 28px 24px', backdropFilter: 'blur(24px)' }}>
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Your email address</label>
            <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="parent@email.com" style={S.input} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Your ward's matric number</label>
            <input value={matricInput} onChange={e => setMatricInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && linkWard()}
              placeholder="e.g. 02SCSC026" style={S.input} />
          </div>
          <div style={{ padding: '11px 14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 11, marginBottom: 18, fontSize: 12, color: '#60a5fa' }}>
            ℹ The matric number links your account to your ward's profile. Your ward must already be registered on GMIS.
          </div>
          <button onClick={linkWard} disabled={linking}
            style={{ width: '100%', padding: 13, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: linking ? 0.75 : 1 }}>
            {linking ? 'Searching...' : 'Link ward & view dashboard'}
          </button>
        </div>
      </div>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
    </div>
  )

  // ── DASHBOARD ────────────────────────────────────────────
  const paidFees    = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0)
  const unpaidFees  = payments.filter(p => p.status === 'pending' || p.status === 'failed')
  const latestGPA   = ward?.gpa || 0
  const honourColor = latestGPA >= 4.5 ? '#4ade80' : latestGPA >= 3.5 ? '#60a5fa' : '#fbbf24'

  return (
    <div style={{ minHeight: '100vh', background: '#03071a', fontFamily: "'DM Sans',system-ui", padding: 'clamp(14px,3vw,28px)' }}>

      {/* Ward banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', background: 'linear-gradient(135deg,rgba(45,108,255,0.12),rgba(79,62,248,0.08))', border: '1px solid rgba(45,108,255,0.25)', borderRadius: 18, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0 }}>
          {ward?.first_name?.[0]}{ward?.last_name?.[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 18, color: '#e8eeff' }}>{ward?.first_name} {ward?.last_name}</div>
          <div style={{ fontSize: 13, color: '#7a8bbf', marginTop: 2 }}>{ward?.matric_number} · {ward?.departments?.name || 'Student'} · {ward?.level} Level · {tenant?.name}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, background: ward?.status === 'active' ? 'rgba(74,222,128,.15)' : 'rgba(251,191,36,.15)', color: ward?.status === 'active' ? '#4ade80' : '#fbbf24', padding: '4px 12px', borderRadius: 100 }}>
            {ward?.status === 'active' ? 'Active student' : ward?.status}
          </span>
          <button onClick={() => setLinked(false)} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer' }}>
            Switch ward
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 13, marginBottom: 22 }}>
        {[
          { icon: '⭐', label: 'Current GPA',   value: formatGPA(latestGPA),        color: honourColor },
          { icon: '📚', label: 'CGPA',          value: formatGPA(ward?.cgpa || 0),  color: '' },
          { icon: '💳', label: 'Total paid',    value: formatNaira(paidFees),        color: '#4ade80' },
          { icon: '⚠️', label: 'Pending fees',  value: String(unpaidFees.length),    color: unpaidFees.length > 0 ? '#f87171' : '#4ade80' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '16px 18px' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
            <div style={{ fontSize: 10, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: color || '#e8eeff' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['overview', 'results', 'payments', 'attendance'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", transition: 'all .2s', background: tab === t ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)', color: tab === t ? '#fff' : '#7a8bbf', border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 }}>Academic standing</h3>
          <div style={{ padding: '14px 18px', background: 'rgba(45,108,255,0.08)', border: '1px solid rgba(45,108,255,0.2)', borderRadius: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: '#60a5fa' }}>
              🎓 CGPA: <strong>{formatGPA(ward?.cgpa || 0)}</strong> — <strong>{getHonourClass(ward?.cgpa || 0)}</strong>
            </span>
          </div>
          {unpaidFees.length > 0 && (
            <div style={{ padding: '14px 18px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12 }}>
              <span style={{ fontSize: 13, color: '#f87171' }}>⚠️ Your ward has <strong>{unpaidFees.length}</strong> unpaid fee item{unpaidFees.length > 1 ? 's' : ''}. Please ensure timely payment.</span>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {tab === 'results' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 }}>Published results</h3>
          {results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#3d4f7a', fontSize: 13 }}>No published results yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Course', 'Total', 'Grade', 'Session'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {results.map((r, i) => {
                    const gc: Record<string, string> = { A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#fb923c', F: '#f87171' }
                    return (
                      <tr key={i}>
                        <td style={S.td}><strong style={{ color: '#60a5fa', fontFamily: 'monospace' }}>{r.courses?.course_code}</strong> <span style={{ color: '#7a8bbf', fontSize: 12 }}>{r.courses?.course_name}</span></td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#e8eeff' }}>{r.total_score ?? '—'}</td>
                        <td style={S.td}><span style={{ fontSize: 12, fontWeight: 800, background: (gc[r.grade] || '#7a8bbf') + '20', color: gc[r.grade] || '#7a8bbf', padding: '2px 9px', borderRadius: 100 }}>{r.grade}</span></td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{r.session} · {r.semester}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {tab === 'payments' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 }}>Payment history</h3>
          {payments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#3d4f7a', fontSize: 13 }}>No payment records yet.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Fee', 'Amount', 'Status', 'Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {payments.map(p => {
                    const sc: Record<string, string> = { success: '#4ade80', pending: '#fbbf24', failed: '#f87171' }
                    return (
                      <tr key={p.id}>
                        <td style={S.td}>{p.fee_types?.name || '—'}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#e8eeff' }}>{formatNaira(p.amount)}</td>
                        <td style={S.td}><span style={{ fontSize: 11, fontWeight: 700, background: (sc[p.status] || '#7a8bbf') + '20', color: sc[p.status] || '#7a8bbf', padding: '2px 9px', borderRadius: 100, textTransform: 'capitalize' }}>{p.status}</span></td>
                        <td style={{ ...S.td, color: '#7a8bbf', fontSize: 12 }}>{p.paid_at ? formatDate(p.paid_at) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Attendance */}
      {tab === 'attendance' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 15, color: '#e8eeff', marginBottom: 14 }}>Attendance overview</h3>
          <div style={{ textAlign: 'center', padding: '28px 0', color: '#3d4f7a' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
            <div style={{ fontSize: 14, color: '#7a8bbf' }}>Attendance data will appear here once QR attendance is recorded by lecturers.</div>
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  label: { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', padding: '10px 13px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#e8eeff', outline: 'none', fontFamily: "'DM Sans',system-ui" },
  th:    { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' },
  td:    { padding: '11px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#7a8bbf', verticalAlign: 'middle' },
}