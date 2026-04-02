// ============================================================
// GMIS — Platform Admin Panel
// gmis.app/admin
// DAMS Technologies reviews and approves organisations
// ============================================================

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatNaira } from '../../lib/helpers'
import toast from 'react-hot-toast'

interface Org {
  id: string
  name: string
  slug: string
  email: string
  phone: string
  type: string
  state: string
  country: string
  status: string
  payment_status: string
  admin_name: string
  admin_email: string
  created_at: string
  approved_at: string | null
  locked_at: string | null
  lock_reason: string | null
  subscription_end: string | null
  documents?: OrgDoc[]
}

interface OrgDoc {
  id: string
  document_type: string
  file_url: string
  file_name: string
  verified: boolean
}

interface Feature {
  id: string
  key: string
  label: string
  category: string
}

interface FeatureToggle {
  feature_id: string
  is_enabled: boolean
}

type Tab = 'dashboard' | 'pending' | 'approved' | 'toggles' | 'billing'

export default function PlatformAdmin() {
  const [tab, setTab]             = useState<Tab>('dashboard')
  const [orgs, setOrgs]           = useState<Org[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Org | null>(null)
  const [features, setFeatures]   = useState<Feature[]>([])
  const [toggles, setToggles]     = useState<FeatureToggle[]>([])
  const [toggleOrg, setToggleOrg] = useState<string>('')
  const [stats, setStats]         = useState({ total: 0, pending: 0, approved: 0, locked: 0 })

  // Simple admin gate — in production this should use proper auth
  const [authed, setAuthed] = useState(false)
  const [pin, setPin]       = useState('')
  const ADMIN_PIN           = 'DAMS2025'  // change this to something secure!

  // ── LOAD DATA ─────────────────────────────────────────────
  useEffect(() => {
    if (authed) loadData()
  }, [authed])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('organizations')
      .select(`*, organization_documents(*)`)
      .order('created_at', { ascending: false })

    if (data) {
      const orgList = data as Org[]
      setOrgs(orgList)
      setStats({
        total:    orgList.length,
        pending:  orgList.filter(o => o.status === 'pending').length,
        approved: orgList.filter(o => o.status === 'approved').length,
        locked:   orgList.filter(o => o.status === 'locked').length,
      })
    }

    // Load features for toggle screen
    const { data: feats } = await supabase.from('features').select('*').order('category')
    if (feats) setFeatures(feats as Feature[])

    setLoading(false)
  }

  // ── APPROVE ORG ───────────────────────────────────────────
  const approveOrg = async (org: Org) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', org.id)

    if (error) { toast.error('Failed to approve'); return }
    toast.success(`✓ ${org.name} approved!`)
    loadData()
    setSelected(null)
  }

  // ── REJECT ORG ────────────────────────────────────────────
  const rejectOrg = async (org: Org, reason: string) => {
    const { error } = await supabase
      .from('organizations')
      .update({ status: 'rejected', rejection_reason: reason })
      .eq('id', org.id)

    if (error) { toast.error('Failed to reject'); return }
    toast.success(`${org.name} rejected.`)
    loadData()
    setSelected(null)
  }

  // ── LOCK / UNLOCK ─────────────────────────────────────────
  const toggleLock = async (org: Org) => {
    const newStatus = org.status === 'locked' ? 'approved' : 'locked'
    await supabase
      .from('organizations')
      .update({ status: newStatus, locked_at: newStatus === 'locked' ? new Date().toISOString() : null, lock_reason: newStatus === 'locked' ? 'Manual lock by admin' : null })
      .eq('id', org.id)
    toast.success(`${org.name} ${newStatus === 'locked' ? 'locked' : 'unlocked'}.`)
    loadData()
  }

  // ── LOAD FEATURE TOGGLES FOR AN ORG ──────────────────────
  const loadToggles = async (orgId: string) => {
    setToggleOrg(orgId)
    const { data } = await supabase
      .from('org_feature_toggles')
      .select('feature_id, is_enabled')
      .eq('org_id', orgId)
    if (data) setToggles(data as FeatureToggle[])
  }

  // ── TOGGLE A FEATURE ──────────────────────────────────────
  const toggleFeature = async (featureId: string) => {
    const current = toggles.find(t => t.feature_id === featureId)
    const newVal  = !current?.is_enabled

    await supabase
      .from('org_feature_toggles')
      .upsert({ org_id: toggleOrg, feature_id: featureId, is_enabled: newVal }, { onConflict: 'org_id,feature_id' } as any)

    setToggles(prev =>
      prev.some(t => t.feature_id === featureId)
        ? prev.map(t => t.feature_id === featureId ? { ...t, is_enabled: newVal } : t)
        : [...prev, { feature_id: featureId, is_enabled: newVal }]
    )
  }

  const isEnabled = (featureId: string) => toggles.find(t => t.feature_id === featureId)?.is_enabled ?? true

  // ── SIMPLE LOGIN GATE ─────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#03071a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans',system-ui,sans-serif" }}>
        <div style={{ width: 360, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(45,108,255,.4)' }}>G</div>
          <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, color: '#e8eeff', marginBottom: 6 }}>GMIS Admin</h2>
          <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 24 }}>DAMS Technologies · Master control</p>
          <input
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (pin === ADMIN_PIN ? setAuthed(true) : toast.error('Wrong PIN'))}
            placeholder="Enter admin PIN"
            style={{ width: '100%', padding: '11px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, color: '#e8eeff', fontSize: 14, marginBottom: 12, outline: 'none', textAlign: 'center', letterSpacing: 6 }}
          />
          <button onClick={() => pin === ADMIN_PIN ? setAuthed(true) : toast.error('Wrong PIN')}
            style={{ width: '100%', padding: 11, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Sign in
          </button>
        </div>
      </div>
    )
  }

  // ── MAIN ADMIN UI ─────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#03071a', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'flex' }}>

      {/* Sidebar */}
      <div style={{ width: 220, background: 'rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14, color: '#fff' }}>G</div>
            <div>
              <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff' }}>GMIS Admin</div>
              <div style={{ fontSize: 11, color: '#3d4f7a' }}>DAMS Technologies</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, padding: '8px 0' }}>
          {([
            ['dashboard', '🏠', 'Dashboard'],
            ['pending',   '⏳', `Pending (${stats.pending})`],
            ['approved',  '✅', 'Approved'],
            ['toggles',   '🔧', 'Feature toggles'],
            ['billing',   '💳', 'Billing'],
          ] as [Tab, string, string][]).map(([id, icon, label]) => (
            <div key={id} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, color: tab === id ? '#60a5fa' : '#7a8bbf', background: tab === id ? 'rgba(45,108,255,0.1)' : 'transparent', fontWeight: tab === id ? 600 : 400, cursor: 'pointer', borderRight: tab === id ? '3px solid #2d6cff' : '3px solid transparent', transition: 'all .15s' }}>
              <span>{icon}</span>{label}
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setAuthed(false)} style={{ fontSize: 12, color: '#3d4f7a', background: 'none', border: 'none', cursor: 'pointer' }}>Sign out</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <>
            <h2 style={s.pageTitle}>Platform dashboard</h2>
            <p style={s.pageSub}>DAMS Technologies · Master admin control</p>
            <div style={s.grid4}>
              {[['🏫','Total orgs', stats.total, ''], ['⏳','Pending', stats.pending, '#fbbf24'], ['✅','Approved', stats.approved, '#4ade80'], ['🔒','Locked', stats.locked, '#f87171']].map(([icon, label, val, color]) => (
                <div key={label as string} style={s.statCard}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 11, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label as string}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: color as string || '#e8eeff' }}>{val as number}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>Recent registrations</div>
              <OrgTable orgs={orgs.slice(0, 8)} onSelect={setSelected} onApprove={approveOrg} onLock={toggleLock} />
            </div>
          </>
        )}

        {/* ── PENDING ── */}
        {tab === 'pending' && (
          <>
            <h2 style={s.pageTitle}>Pending approvals</h2>
            <p style={s.pageSub}>Review documents and approve or reject each institution</p>
            {loading ? <Loader /> : orgs.filter(o => o.status === 'pending').length === 0
              ? <Empty icon="📭" text="No pending applications right now" />
              : orgs.filter(o => o.status === 'pending').map(org => (
                <OrgCard key={org.id} org={org} onApprove={() => approveOrg(org)} onReject={(r) => rejectOrg(org, r)} onViewDocs={() => setSelected(org)} />
              ))
            }
          </>
        )}

        {/* ── APPROVED ── */}
        {tab === 'approved' && (
          <>
            <h2 style={s.pageTitle}>Approved organisations</h2>
            <p style={s.pageSub}>All active schools on GMIS</p>
            <div style={s.card}>
              <OrgTable orgs={orgs.filter(o => ['approved','locked'].includes(o.status))} onSelect={setSelected} onApprove={approveOrg} onLock={toggleLock} />
            </div>
          </>
        )}

        {/* ── FEATURE TOGGLES ── */}
        {tab === 'toggles' && (
          <>
            <h2 style={s.pageTitle}>Feature toggles</h2>
            <p style={s.pageSub}>Turn features on/off per organisation</p>
            <div style={{ marginBottom: 20, maxWidth: 360 }}>
              <select
                style={{ ...s.input, width: '100%' }}
                value={toggleOrg}
                onChange={e => loadToggles(e.target.value)}
              >
                <option value="">Select an organisation...</option>
                {orgs.filter(o => o.status === 'approved').map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            {toggleOrg && (
              <div style={s.card}>
                <div style={s.cardTitle}>Features for {orgs.find(o => o.id === toggleOrg)?.name}</div>
                {['student','admin','lecturer'].map(cat => (
                  <div key={cat} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#3d4f7a', marginBottom: 10 }}>{cat} features</div>
                    {features.filter(f => f.category === cat).map(feat => (
                      <div key={feat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 13, color: '#e8eeff' }}>{feat.label}</span>
                        <div onClick={() => toggleFeature(feat.id)}
                          style={{ width: 44, height: 24, borderRadius: 12, background: isEnabled(feat.id) ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.12)', position: 'relative', cursor: 'pointer', transition: 'all .3s', boxShadow: isEnabled(feat.id) ? '0 0 12px rgba(45,108,255,.4)' : 'none' }}>
                          <div style={{ width: 20, height: 20, background: '#fff', borderRadius: '50%', position: 'absolute', top: 2, left: isEnabled(feat.id) ? 22 : 2, transition: 'left .25s', boxShadow: '0 2px 6px rgba(0,0,0,.2)' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── BILLING ── */}
        {tab === 'billing' && (
          <>
            <h2 style={s.pageTitle}>Billing overview</h2>
            <p style={s.pageSub}>GMIS subscription revenue</p>
            <div style={{ ...s.grid4, gridTemplateColumns: 'repeat(3,1fr)' }}>
              {[['💰','Active schools', orgs.filter(o=>o.status==='approved').length, ''],
                ['⚠️','Overdue', orgs.filter(o=>o.payment_status==='overdue').length, '#f87171'],
                ['📊','Total registered', orgs.length, '']].map(([icon, label, val, color]) => (
                <div key={label as string} style={s.statCard}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
                  <div style={{ fontSize: 11, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label as string}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: color as string || '#e8eeff' }}>{val as number}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.cardTitle}>All organisations</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Institution','Subdomain','Payment status','Subscription end','Action'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {orgs.map(org => (
                    <tr key={org.id}>
                      <td style={s.td}>{org.name}</td>
                      <td style={{ ...s.td, color: '#60a5fa', fontFamily: 'monospace' }}>{org.slug}.gmis.app</td>
                      <td style={s.td}><StatusBadge status={org.payment_status} /></td>
                      <td style={{ ...s.td, color: '#7a8bbf' }}>{org.subscription_end ? formatDate(org.subscription_end) : '—'}</td>
                      <td style={s.td}>
                        <button onClick={() => toggleLock(org)}
                          style={{ ...s.btnSm, background: org.status === 'locked' ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', color: org.status === 'locked' ? '#4ade80' : '#f87171', border: `1px solid ${org.status === 'locked' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}` }}>
                          {org.status === 'locked' ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── ORG DETAIL MODAL ── */}
      {selected && (
        <OrgDetailModal org={selected} onClose={() => setSelected(null)} onApprove={() => { approveOrg(selected); setSelected(null) }} onReject={(r) => { rejectOrg(selected, r); setSelected(null) }} onLock={() => { toggleLock(selected); setSelected(null) }} />
      )}
    </div>
  )
}

// ── ORG TABLE ─────────────────────────────────────────────
function OrgTable({ orgs, onSelect, onApprove, onLock }: { orgs: Org[]; onSelect: (o: Org) => void; onApprove: (o: Org) => void; onLock: (o: Org) => void }) {
  if (orgs.length === 0) return <Empty icon="📭" text="No organisations yet" />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['Institution','Subdomain','Type','Status','Registered','Actions'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
      <tbody>
        {orgs.map(org => (
          <tr key={org.id}>
            <td style={s.td}><div style={{ fontWeight: 600, color: '#e8eeff' }}>{org.name}</div><div style={{ fontSize: 11, color: '#7a8bbf' }}>{org.admin_email}</div></td>
            <td style={{ ...s.td, color: '#60a5fa', fontFamily: 'monospace', fontSize: 12 }}>{org.slug}.gmis.app</td>
            <td style={s.td}><span style={{ fontSize: 12, color: '#7a8bbf', textTransform: 'capitalize' }}>{org.type}</span></td>
            <td style={s.td}><StatusBadge status={org.status} /></td>
            <td style={{ ...s.td, color: '#7a8bbf', fontSize: 12 }}>{formatDate(org.created_at)}</td>
            <td style={s.td}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => onSelect(org)} style={s.btnSm}>View</button>
                {org.status === 'pending' && <button onClick={() => onApprove(org)} style={{ ...s.btnSm, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>Approve</button>}
                {org.status === 'approved' && <button onClick={() => onLock(org)} style={{ ...s.btnSm, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>Lock</button>}
                {org.status === 'locked' && <button onClick={() => onLock(org)} style={{ ...s.btnSm, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>Unlock</button>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── ORG CARD (pending view) ───────────────────────────────
function OrgCard({ org, onApprove, onReject, onViewDocs, ...rest }: { org: Org; onApprove: () => void | Promise<void>; onReject: (r: string) => void | Promise<void>; onViewDocs: () => void }) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 16, color: '#e8eeff', marginBottom: 4 }}>{org.name}</div>
          <div style={{ fontSize: 12, color: '#60a5fa', fontFamily: 'monospace', marginBottom: 8 }}>{org.slug}.gmis.app</div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#7a8bbf', flexWrap: 'wrap' }}>
            <span>👤 {org.admin_name}</span>
            <span>✉️ {org.admin_email}</span>
            <span>📍 {org.state}, {org.country}</span>
            <span>🏫 {org.type}</span>
            <span>📅 {formatDate(org.created_at)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onViewDocs} style={s.btnSm}>View docs</button>
          <button onClick={onApprove} style={{ ...s.btnSm, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', fontWeight: 700 }}>✓ Approve</button>
          <button onClick={() => setShowReject(v => !v)} style={{ ...s.btnSm, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' }}>✗ Reject</button>
        </div>
      </div>
      {showReject && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <label style={{ fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 6 }}>Rejection reason (will be emailed to the school)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Documents are unclear or incomplete..." style={{ ...s.input, width: '100%', marginBottom: 10 }} />
          <button onClick={() => reason && onReject(reason)} disabled={!reason} style={{ ...s.btnSm, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', padding: '8px 16px' }}>
            Confirm rejection
          </button>
        </div>
      )}
    </div>
  )
}

// ── ORG DETAIL MODAL ──────────────────────────────────────
function OrgDetailModal({ org, onClose, onApprove, onReject, onLock }: { org: Org; onClose: () => void; onApprove: () => void; onReject: (r: string) => void; onLock: () => void }) {
  const [reason, setReason] = useState('')
  const docs = (org as any).organization_documents || []
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0b1628', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 18, color: '#e8eeff' }}>{org.name}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7a8bbf', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {[['Subdomain', `${org.slug}.gmis.app`], ['Type', org.type], ['State', org.state], ['Country', org.country], ['Phone', org.phone || '—'], ['Admin name', org.admin_name], ['Admin email', org.admin_email], ['Status', org.status], ['Registered', formatDate(org.created_at)]].map(([k,v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
            <span style={{ color: '#7a8bbf' }}>{k}</span>
            <span style={{ fontWeight: 600, color: '#e8eeff' }}>{v}</span>
          </div>
        ))}

        {docs.length > 0 && (
          <>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7a8bbf', textTransform: 'uppercase', letterSpacing: 1, marginTop: 16, marginBottom: 10 }}>Documents</div>
            {docs.map((doc: OrgDoc) => (
              <a key={doc.id} href={doc.file_url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 8, textDecoration: 'none' }}>
                <span style={{ fontSize: 13, color: '#e8eeff' }}>📄 {doc.document_type.toUpperCase()}</span>
                <span style={{ fontSize: 12, color: '#60a5fa' }}>View →</span>
              </a>
            ))}
          </>
        )}

        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {org.status === 'pending' && <>
            <button onClick={onApprove} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Approve school</button>
          </>}
          {org.status === 'approved' && <button onClick={onLock} style={{ flex: 1, padding: 11, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 11, cursor: 'pointer', fontWeight: 600 }}>🔒 Lock school</button>}
          {org.status === 'locked' && <button onClick={onLock} style={{ flex: 1, padding: 11, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 11, cursor: 'pointer', fontWeight: 600 }}>🔓 Unlock school</button>}
        </div>

        {org.status === 'pending' && (
          <div style={{ marginTop: 12 }}>
            <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason..." style={{ ...s.input, width: '100%', marginBottom: 8 }} />
            <button onClick={() => reason && onReject(reason)} disabled={!reason}
              style={{ width: '100%', padding: 11, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 11, cursor: 'pointer', fontWeight: 600 }}>
              ✗ Reject school
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── SMALL COMPONENTS ──────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending:      ['rgba(251,191,36,.15)', '#fbbf24'],
    approved:     ['rgba(74,222,128,.15)', '#4ade80'],
    rejected:     ['rgba(248,113,113,.15)', '#f87171'],
    locked:       ['rgba(248,113,113,.15)', '#f87171'],
    suspended:    ['rgba(248,113,113,.15)', '#f87171'],
    paid:         ['rgba(74,222,128,.15)', '#4ade80'],
    unpaid:       ['rgba(251,191,36,.15)', '#fbbf24'],
    overdue:      ['rgba(248,113,113,.15)', '#f87171'],
    trial:        ['rgba(96,165,250,.15)', '#60a5fa'],
  }
  const [bg, color] = map[status] || ['rgba(255,255,255,.08)', '#7a8bbf']
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, textTransform: 'capitalize' }}>{status}</span>
}

function Loader() {
  return <div style={{ textAlign: 'center', padding: 40 }}><div style={{ width: 32, height: 32, border: '2px solid rgba(45,108,255,.3)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto' }} /></div>
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div style={{ textAlign: 'center', padding: 48, color: '#3d4f7a' }}><div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 14 }}>{text}</div></div>
}

// ── STYLES ────────────────────────────────────────────────
const s = {
  pageTitle: { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 } as React.CSSProperties,
  pageSub:   { fontSize: 13, color: '#7a8bbf', marginBottom: 20 } as React.CSSProperties,
  grid4:     { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 } as React.CSSProperties,
  statCard:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 } as React.CSSProperties,
  card:      { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 } as React.CSSProperties,
  cardTitle: { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 14 } as React.CSSProperties,
  th:        { textAlign: 'left' as const, fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#3d4f7a', padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.07)', whiteSpace: 'nowrap' as const } as React.CSSProperties,
  td:        { padding: '11px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13, color: '#e8eeff', verticalAlign: 'middle' as const } as React.CSSProperties,
  btnSm:     { padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" } as React.CSSProperties,
  input:     { padding: '9px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.04)', color: '#e8eeff', outline: 'none', fontFamily: "'DM Sans',system-ui" } as React.CSSProperties,
}

const style = document.createElement('style')
style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}'
document.head.appendChild(style)