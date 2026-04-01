// ============================================================
// GMIS — Admin Elections Management
// FIXED:
//   - Wrapped both list and detail views in SidebarLayout
//   - ElectionModal now renders in detail view too
//   - Vote counts load when opening a closed election
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useTenant } from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import SidebarLayout from '../../../components/layout/SidebarLayout'
import toast from 'react-hot-toast'

// ── TYPES ─────────────────────────────────────────────────
interface Election {
  id: string
  title: string
  description: string | null
  position: string | null
  scope: string
  department_id: string | null
  start_date: string | null
  end_date: string | null
  status: 'draft' | 'active' | 'closed'
  nomination_open: boolean
  departments?: { name: string }
}

interface Candidate {
  id: string
  election_id: string
  student_id: string | null
  full_name: string
  manifesto: string | null
  photo_url: string | null
  nomination_status: string
  vote_count?: number
  students?: { first_name: string; last_name: string; matric_number: string }
}

interface Dept { id: string; name: string }
interface Student { id: string; first_name: string; last_name: string; matric_number: string }

const BLANK_ELECTION = {
  title: '', description: '', position: '',
  scope: 'sug', department_id: '',
  start_date: '', end_date: '',
  status: 'draft' as const, nomination_open: false,
}

const BLANK_CANDIDATE = {
  full_name: '', manifesto: '', photo_url: '', student_id: '',
}

const statusColor: Record<string, string> = {
  draft: '#fbbf24', active: '#4ade80', closed: '#7a8bbf',
}

const fmtDateTime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── COMPONENT ─────────────────────────────────────────────
export default function AdminElections() {
  const { tenant, slug } = useTenant()
  const db = useMemo(
    () => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null,
    [tenant, slug]
  )

  const [elections,   setElections]   = useState<Election[]>([])
  const [depts,       setDepts]       = useState<Dept[]>([])
  const [loading,     setLoading]     = useState(true)
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [candidates,  setCandidates]  = useState<Record<string, Candidate[]>>({})
  const [voteCounts,  setVoteCounts]  = useState<Record<string, Record<string, number>>>({})
  const [loadingCand, setLoadingCand] = useState(false)

  // Election modal
  const [showEModal, setShowEModal] = useState(false)
  const [editElect,  setEditElect]  = useState<Election | null>(null)
  const [eForm,      setEForm]      = useState({ ...BLANK_ELECTION })
  const [savingE,    setSavingE]    = useState(false)

  // Candidate modal
  const [showCModal, setShowCModal] = useState(false)
  const [editCand,   setEditCand]   = useState<Candidate | null>(null)
  const [cForm,      setCForm]      = useState({ ...BLANK_CANDIDATE })
  const [savingC,    setSavingC]    = useState(false)
  const [students,   setStudents]   = useState<Student[]>([])

  const [view, setView] = useState<'list' | 'detail'>('list')

  useEffect(() => { if (db) loadAll() }, [db])

  const loadAll = async () => {
    if (!db) return
    setLoading(true)
    const [eRes, dRes] = await Promise.all([
      db.from('elections')
        .select('*, departments(name)')
        .order('created_at', { ascending: false }),
      db.from('departments').select('id, name').eq('is_active', true).order('name'),
    ])
    if (eRes.data) setElections(eRes.data as Election[])
    if (dRes.data) setDepts(dRes.data as Dept[])
    setLoading(false)
  }

  const openElection = async (election: Election) => {
    setActiveId(election.id)
    setView('detail')
    if (!candidates[election.id]) await loadCandidates(election.id)
    // Load vote counts for closed elections even on fresh open
    if (election.status === 'closed') await loadVoteCounts(election.id)
  }

  const loadCandidates = async (electionId: string) => {
    if (!db) return
    setLoadingCand(true)
    const { data } = await db
      .from('election_candidates')
      .select('*, students(first_name, last_name, matric_number)')
      .eq('election_id', electionId)
      .order('created_at')
    if (data) setCandidates(p => ({ ...p, [electionId]: data as Candidate[] }))
    setLoadingCand(false)
  }

  const loadVoteCounts = async (electionId: string) => {
    if (!db) return
    const { data } = await db
      .from('election_votes')
      .select('candidate_id')
      .eq('election_id', electionId)
    if (data) {
      const counts: Record<string, number> = {}
      data.forEach((v: any) => { counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1 })
      setVoteCounts(p => ({ ...p, [electionId]: counts }))
    }
  }

  // ── ELECTION CRUD ────────────────────────────────────────
  const openNewElection = () => {
    setEditElect(null)
    setEForm({ ...BLANK_ELECTION })
    setShowEModal(true)
  }

  const openEditElection = (e: Election) => {
    setEditElect(e)
    setEForm({
      title:           e.title,
      description:     e.description   || '',
      position:        e.position      || '',
      scope:           e.scope         || 'sug',
      department_id:   e.department_id || '',
      start_date:      e.start_date    ? e.start_date.slice(0, 16) : '',
      end_date:        e.end_date      ? e.end_date.slice(0, 16)   : '',
      status:          e.status,
      nomination_open: e.nomination_open,
    })
    setShowEModal(true)
  }

  const saveElection = async () => {
    if (!db) return
    if (!eForm.title.trim()) { toast.error('Election title is required'); return }
    setSavingE(true)
    const payload: any = {
      title:          eForm.title.trim(),
      description:    eForm.description  || null,
      position:       eForm.position     || null,
      scope:          eForm.scope,
      department_id:  eForm.scope === 'departmental' && eForm.department_id ? eForm.department_id : null,
      start_date:     eForm.start_date   || null,
      end_date:       eForm.end_date     || null,
      status:         eForm.status,
      nomination_open: eForm.nomination_open,
    }
    const { error } = editElect
      ? await db.from('elections').update(payload).eq('id', editElect.id)
      : await db.from('elections').insert(payload)
    setSavingE(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
    toast.success(editElect ? 'Election updated' : 'Election created')
    setShowEModal(false)
    loadAll()
  }

  const deleteElection = async (id: string) => {
    if (!db || !confirm('Delete this election and all its data?')) return
    await db.from('election_votes').delete().eq('election_id', id)
    await db.from('election_candidates').delete().eq('election_id', id)
    const { error } = await db.from('elections').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    toast.success('Election deleted')
    if (activeId === id) { setActiveId(null); setView('list') }
    setElections(p => p.filter(e => e.id !== id))
  }

  const updateStatus = async (election: Election, newStatus: Election['status']) => {
    if (!db) return
    const { error } = await db.from('elections').update({ status: newStatus } as any).eq('id', election.id)
    if (error) { toast.error('Update failed'); return }
    const label = newStatus === 'active' ? 'Election activated' : newStatus === 'closed' ? 'Election closed' : 'Moved to draft'
    toast.success(label)
    setElections(p => p.map(e => e.id === election.id ? { ...e, status: newStatus } : e))
    if (newStatus === 'closed') loadVoteCounts(election.id)
  }

  const toggleNominations = async (election: Election) => {
    if (!db) return
    const next = !election.nomination_open
    const { error } = await db.from('elections').update({ nomination_open: next } as any).eq('id', election.id)
    if (error) { toast.error('Update failed'); return }
    toast.success(next ? 'Nominations opened' : 'Nominations closed')
    setElections(p => p.map(e => e.id === election.id ? { ...e, nomination_open: next } : e))
  }

  // ── CANDIDATE CRUD ───────────────────────────────────────
  const openAddCandidate = async () => {
    setEditCand(null)
    setCForm({ ...BLANK_CANDIDATE })
    if (students.length === 0 && db) {
      const { data } = await db
        .from('students')
        .select('id, first_name, last_name, matric_number')
        .eq('status', 'active')
        .order('first_name')
      if (data) setStudents(data as Student[])
    }
    setShowCModal(true)
  }

  const openEditCandidate = (c: Candidate) => {
    setEditCand(c)
    setCForm({
      full_name:  c.full_name,
      manifesto:  c.manifesto  || '',
      photo_url:  c.photo_url  || '',
      student_id: c.student_id || '',
    })
    setShowCModal(true)
  }

  const saveCandidate = async () => {
    if (!db || !activeId) return
    if (!cForm.full_name.trim()) { toast.error('Candidate name is required'); return }
    setSavingC(true)
    const payload: any = {
      election_id:       activeId,
      full_name:         cForm.full_name.trim(),
      manifesto:         cForm.manifesto  || null,
      photo_url:         cForm.photo_url  || null,
      student_id:        cForm.student_id || null,
      nomination_status: 'approved',
    }
    const { error } = editCand
      ? await db.from('election_candidates').update(payload).eq('id', editCand.id)
      : await db.from('election_candidates').insert(payload)
    setSavingC(false)
    if (error) { toast.error('Save failed: ' + error.message); return }
    toast.success(editCand ? 'Candidate updated' : 'Candidate added')
    setShowCModal(false)
    loadCandidates(activeId)
  }

  const deleteCandidate = async (id: string) => {
    if (!db || !activeId || !confirm('Remove this candidate?')) return
    await db.from('election_votes').delete().eq('candidate_id', id)
    const { error } = await db.from('election_candidates').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    toast.success('Candidate removed')
    setCandidates(p => ({ ...p, [activeId]: (p[activeId] || []).filter(c => c.id !== id) }))
  }

  const approveNomination = async (c: Candidate, status: 'approved' | 'rejected') => {
    if (!db || !activeId) return
    const { error } = await db.from('election_candidates').update({ nomination_status: status } as any).eq('id', c.id)
    if (error) { toast.error('Update failed'); return }
    toast.success(status === 'approved' ? 'Nomination approved' : 'Nomination rejected')
    setCandidates(p => ({
      ...p,
      [activeId]: (p[activeId] || []).map(x => x.id === c.id ? { ...x, nomination_status: status } : x),
    }))
  }

  // ── DERIVED ───────────────────────────────────────────────
  const activeElection = elections.find(e => e.id === activeId)
  const activeCands    = activeId ? (candidates[activeId] || []) : []
  const approvedCands  = activeCands.filter(c => c.nomination_status === 'approved')
  const pendingCands   = activeCands.filter(c => c.nomination_status === 'pending')
  const counts         = activeId ? (voteCounts[activeId] || {}) : {}
  const totalVotes     = Object.values(counts).reduce((s, n) => s + n, 0)
  const maxVotes       = Math.max(...Object.values(counts), 1)

  // ── SHARED MODALS (used in both views) ───────────────────
  const ElectionModalJSX = showEModal ? (
    <ElectionModal
      form={eForm} setForm={setEForm}
      depts={depts} saving={savingE}
      isEdit={!!editElect}
      onSave={saveElection}
      onClose={() => setShowEModal(false)}
    />
  ) : null

  const CandidateModalJSX = showCModal ? (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowCModal(false)}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: 0 }}>
            {editCand ? 'Edit Candidate' : 'Add Candidate'}
          </h3>
          <button onClick={() => setShowCModal(false)} style={S.btnClose}>×</button>
        </div>

        <div style={S.field}>
          <label style={S.label}>Full name *</label>
          <input
            value={cForm.full_name}
            onChange={e => setCForm(p => ({ ...p, full_name: e.target.value }))}
            placeholder="Candidate full name"
            style={S.input}
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Link to student (optional)</label>
          <select
            value={cForm.student_id}
            onChange={e => {
              const s = students.find(x => x.id === e.target.value)
              setCForm(p => ({
                ...p,
                student_id: e.target.value,
                full_name: p.full_name || (s ? `${s.first_name} ${s.last_name}` : p.full_name),
              }))
            }}
            style={S.input}
          >
            <option value="">Select student...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.matric_number})</option>
            ))}
          </select>
        </div>

        <div style={S.field}>
          <label style={S.label}>Photo URL (optional)</label>
          <input
            value={cForm.photo_url}
            onChange={e => setCForm(p => ({ ...p, photo_url: e.target.value }))}
            placeholder="https://..."
            style={S.input}
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Manifesto / Statement</label>
          <textarea
            value={cForm.manifesto}
            onChange={e => setCForm(p => ({ ...p, manifesto: e.target.value }))}
            rows={4}
            placeholder="Candidate's manifesto or campaign statement..."
            style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowCModal(false)} style={S.btnSm}>Cancel</button>
          <button onClick={saveCandidate} disabled={savingC} style={{ ...S.btnPrimary, opacity: savingC ? 0.7 : 1 }}>
            {savingC ? 'Saving...' : editCand ? 'Update' : 'Add Candidate'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (loading) return (
    <SidebarLayout active="elections" role="admin">
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
        <div style={S.spin} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </SidebarLayout>
  )

  // ── LIST VIEW ─────────────────────────────────────────────
  if (view === 'list') return (
    <SidebarLayout active="elections" role="admin">
      <div style={{ fontFamily: "'DM Sans',system-ui", color: '#e8eeff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, margin: 0 }}>Elections</h2>
            <p style={{ fontSize: 13, color: '#7a8bbf', margin: '4px 0 0' }}>{elections.length} total</p>
          </div>
          <button onClick={openNewElection} style={S.btnPrimary}>+ New Election</button>
        </div>

        {elections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#3d4f7a' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🗳️</div>
            <div style={{ fontSize: 15, marginBottom: 18 }}>No elections created yet</div>
            <button onClick={openNewElection} style={S.btnPrimary}>Create first election</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {elections.map(e => (
              <div key={e.id} style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                      <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 15, margin: 0, color: '#e8eeff' }}>
                        {e.title}
                      </h3>
                      <span style={{ fontSize: 11, fontWeight: 700, background: (statusColor[e.status] || '#7a8bbf') + '20', color: statusColor[e.status] || '#7a8bbf', padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {e.status}
                      </span>
                      <span style={{ fontSize: 11, background: e.scope === 'sug' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)', color: e.scope === 'sug' ? '#60a5fa' : '#a78bfa', padding: '3px 10px', borderRadius: 100, fontWeight: 600 }}>
                        {e.scope === 'sug' ? 'SUG' : `Dept — ${(e.departments as any)?.name || 'Unknown'}`}
                      </span>
                    </div>
                    {e.position && (
                      <div style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 4 }}>
                        Position: <strong style={{ color: '#e8eeff' }}>{e.position}</strong>
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#3d4f7a' }}>
                      {fmtDateTime(e.start_date)} → {fmtDateTime(e.end_date)}
                    </div>
                    {e.nomination_open && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontSize: 11, background: 'rgba(74,222,128,0.1)', color: '#4ade80', padding: '2px 9px', borderRadius: 100 }}>
                          ✓ Nominations open
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={() => openElection(e)} style={S.btnSm}>Manage →</button>
                    <button onClick={() => openEditElection(e)} style={S.btnIcon} title="Edit">✏️</button>
                    <button onClick={() => deleteElection(e.id)} style={S.btnIcon} title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {ElectionModalJSX}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </SidebarLayout>
  )

  // ── DETAIL VIEW ───────────────────────────────────────────
  const isClosed = activeElection?.status === 'closed'

  return (
    <SidebarLayout active="elections" role="admin">
      <div style={{ fontFamily: "'DM Sans',system-ui", color: '#e8eeff' }}>

        {/* Back + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setView('list')} style={{ ...S.btnSm, display: 'flex', alignItems: 'center', gap: 6 }}>
            ← Back
          </button>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 18, margin: 0 }}>
              {activeElection?.title}
            </h2>
            <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {activeElection?.position && <span>Position: {activeElection.position}</span>}
              <span>{activeElection?.scope === 'sug' ? 'SUG Election' : `Departmental — ${(activeElection?.departments as any)?.name}`}</span>
              <span>{fmtDateTime(activeElection?.start_date || null)} → {fmtDateTime(activeElection?.end_date || null)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {activeElection?.status === 'draft' && (
              <button onClick={() => updateStatus(activeElection, 'active')} style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#059669,#047857)' }}>
                ▶ Activate
              </button>
            )}
            {activeElection?.status === 'active' && (
              <button onClick={() => updateStatus(activeElection, 'closed')} style={{ ...S.btnPrimary, background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }}>
                ■ Close Election
              </button>
            )}
            {activeElection?.status === 'closed' && (
              <button onClick={() => updateStatus(activeElection, 'draft')} style={S.btnSm}>↩ Reopen as draft</button>
            )}
            {activeElection && activeElection.status !== 'closed' && (
              <button
                onClick={() => toggleNominations(activeElection)}
                style={{ ...S.btnSm, color: activeElection.nomination_open ? '#fbbf24' : '#4ade80' }}
              >
                {activeElection.nomination_open ? '🔒 Close Nominations' : '📬 Open Nominations'}
              </button>
            )}
            <button onClick={() => openEditElection(activeElection!)} style={S.btnIcon} title="Edit">✏️</button>
          </div>
        </div>

        {/* Pending nominations */}
        {pendingCands.length > 0 && (
          <div style={{ ...S.card, marginBottom: 16, border: '1px solid rgba(251,191,36,0.25)' }}>
            <h3 style={{ ...S.sectionTitle, color: '#fbbf24', marginBottom: 12 }}>
              ⏳ Pending Nominations ({pendingCands.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pendingCands.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 10 }}>
                  <CandidateAvatar name={c.full_name} photo={c.photo_url} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#e8eeff', fontSize: 13 }}>{c.full_name}</div>
                    {c.students && <div style={{ fontSize: 11, color: '#7a8bbf' }}>{c.students.matric_number}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approveNomination(c, 'approved')} style={{ ...S.btnSm, color: '#4ade80', borderColor: 'rgba(74,222,128,0.3)' }}>✓ Approve</button>
                    <button onClick={() => approveNomination(c, 'rejected')} style={{ ...S.btnSm, color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>✗ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results (when closed) */}
        {isClosed && approvedCands.length > 0 && (
          <div style={{ ...S.card, marginBottom: 16 }}>
            <h3 style={S.sectionTitle}>🏆 Election Results</h3>
            <div style={{ fontSize: 12, color: '#7a8bbf', marginBottom: 16 }}>
              Total votes cast: <strong style={{ color: '#e8eeff' }}>{totalVotes}</strong>
            </div>
            {[...approvedCands]
              .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
              .map((c, i) => {
                const cVotes = counts[c.id] || 0
                const pct    = totalVotes > 0 ? Math.round((cVotes / totalVotes) * 100) : 0
                const winner = i === 0 && cVotes > 0
                return (
                  <div key={c.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <CandidateAvatar name={c.full_name} photo={c.photo_url} size={32} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#e8eeff', fontSize: 13 }}>{c.full_name}</span>
                          {winner && (
                            <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>
                              🏆 WINNER
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: winner ? '#fbbf24' : '#e8eeff' }}>{cVotes}</div>
                        <div style={{ fontSize: 11, color: '#7a8bbf' }}>{pct}%</div>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 100, transition: 'width 0.6s ease',
                        width: `${(cVotes / maxVotes) * 100}%`,
                        background: winner ? 'linear-gradient(90deg,#f0b429,#fbbf24)' : 'linear-gradient(90deg,#2d6cff,#4f3ef8)',
                      }} />
                    </div>
                  </div>
                )
              })}
          </div>
        )}

        {/* Candidates */}
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ ...S.sectionTitle, marginBottom: 0 }}>Candidates ({approvedCands.length})</h3>
            {!isClosed && (
              <button onClick={openAddCandidate} style={S.btnPrimary}>+ Add Candidate</button>
            )}
          </div>

          {loadingCand ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#7a8bbf' }}>Loading...</div>
          ) : approvedCands.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#3d4f7a' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>👤</div>
              <div style={{ fontSize: 13, marginBottom: 14 }}>No candidates yet</div>
              {!isClosed && <button onClick={openAddCandidate} style={S.btnPrimary}>Add first candidate</button>}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
              {approvedCands.map(c => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px', position: 'relative' }}>
                  {!isClosed && (
                    <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                      <button onClick={() => openEditCandidate(c)} style={S.btnIcon}>✏️</button>
                      <button onClick={() => deleteCandidate(c.id)} style={S.btnIcon}>🗑️</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <CandidateAvatar name={c.full_name} photo={c.photo_url} size={44} />
                    <div>
                      <div style={{ fontWeight: 700, color: '#e8eeff', fontSize: 14 }}>{c.full_name}</div>
                      {c.students && <div style={{ fontSize: 11, color: '#7a8bbf', marginTop: 2 }}>{c.students.matric_number}</div>}
                    </div>
                  </div>
                  {c.manifesto && (
                    <p style={{ fontSize: 12, color: '#7a8bbf', lineHeight: 1.6, margin: 0 }}>
                      {c.manifesto.length > 140 ? c.manifesto.slice(0, 140) + '…' : c.manifesto}
                    </p>
                  )}
                  {isClosed && (
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#7a8bbf' }}>Votes</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa' }}>{counts[c.id] || 0}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Both modals available in detail view */}
        {ElectionModalJSX}
        {CandidateModalJSX}

        <style>{`@keyframes spin{to{transform:rotate(360deg)}} input:focus,select:focus,textarea:focus{outline:none;border-color:#2d6cff!important;box-shadow:0 0 0 3px rgba(45,108,255,0.15)}`}</style>
      </div>
    </SidebarLayout>
  )
}

// ── HELPER COMPONENTS ────────────────────────────────────
function CandidateAvatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return photo ? (
    <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function ElectionModal({ form, setForm, depts, saving, isEdit, onSave, onClose }: {
  form: typeof BLANK_ELECTION
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK_ELECTION>>
  depts: Dept[]
  saving: boolean
  isEdit: boolean
  onSave: () => void
  onClose: () => void
}) {
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: 0 }}>
            {isEdit ? 'Edit Election' : 'New Election'}
          </h3>
          <button onClick={onClose} style={S.btnClose}>×</button>
        </div>

        <div style={S.field}>
          <label style={S.label}>Election title *</label>
          <input
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="e.g. SUG President 2024/2025"
            style={S.input}
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Position</label>
          <input
            value={form.position}
            onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
            placeholder="e.g. President, Vice President, Treasurer"
            style={S.input}
          />
        </div>

        <div style={S.field}>
          <label style={S.label}>Scope *</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{ v: 'sug', label: '🏫 SUG (school-wide)' }, { v: 'departmental', label: '🏛 Departmental' }].map(({ v, label }) => (
              <button
                key={v}
                onClick={() => setForm(p => ({ ...p, scope: v }))}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                  fontSize: 12, fontWeight: form.scope === v ? 700 : 400,
                  fontFamily: "'DM Sans',system-ui", transition: 'all .15s',
                  background: form.scope === v ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
                  color: form.scope === v ? '#fff' : '#7a8bbf',
                  border: form.scope === v ? 'none' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {form.scope === 'departmental' && (
          <div style={S.field}>
            <label style={S.label}>Department *</label>
            <select
              value={form.department_id}
              onChange={e => setForm(p => ({ ...p, department_id: e.target.value }))}
              style={S.input}
            >
              <option value="">Select department...</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        <div style={S.field}>
          <label style={S.label}>Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            rows={3}
            placeholder="Brief description of this election..."
            style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={S.field}>
            <label style={S.label}>Start date & time</label>
            <input
              type="datetime-local"
              value={form.start_date}
              onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
              style={S.input}
            />
          </div>
          <div style={S.field}>
            <label style={S.label}>End date & time</label>
            <input
              type="datetime-local"
              value={form.end_date}
              onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
              style={S.input}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <input
            type="checkbox"
            id="nom"
            checked={form.nomination_open}
            onChange={e => setForm(p => ({ ...p, nomination_open: e.target.checked }))}
            style={{ width: 15, height: 15, accentColor: '#2d6cff', cursor: 'pointer' }}
          />
          <label htmlFor="nom" style={{ fontSize: 13, color: '#7a8bbf', cursor: 'pointer' }}>
            Open for self-nominations
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={S.btnSm}>Cancel</button>
          <button onClick={onSave} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Election'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── STYLES ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  spin:        { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  btnPrimary:  { padding: '9px 18px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSm:       { padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnIcon:     { padding: '5px 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, cursor: 'pointer', fontSize: 12 },
  btnClose:    { background: 'none', border: 'none', color: '#7a8bbf', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  card:        { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px' },
  sectionTitle:{ fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 14, color: '#e8eeff', marginBottom: 16 },
  field:       { marginBottom: 14 },
  label:       { fontSize: 11, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:       { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8eeff', fontSize: 13, fontFamily: "'DM Sans',system-ui", boxSizing: 'border-box' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' },
  modal:       { background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' },
}