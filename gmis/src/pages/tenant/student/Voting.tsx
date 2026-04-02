// ============================================================
// GMIS — Student Voting
// /voting
// Shows elections the student is eligible for:
//   SUG = all students  |  departmental = student's dept only
// Vote once per election. Live results shown after polls close.
// Self-nomination when nominations are open.
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { useAuth }   from '../../../context/AuthContext'
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
  full_name: string
  manifesto: string | null
  photo_url: string | null
  nomination_status: string
}

interface StudentProfile {
  id: string
  first_name: string
  last_name: string
  department_id: string
  level: string
  departments?: { name: string }
}

// ── HELPERS ───────────────────────────────────────────────
const fmtDateTime = (s: string | null) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const isLive = (e: Election) => {
  if (e.status !== 'active') return false
  const now = new Date()
  if (e.start_date && new Date(e.start_date) > now) return false
  if (e.end_date   && new Date(e.end_date)   < now) return false
  return true
}

// ── COMPONENT ─────────────────────────────────────────────
export default function StudentVoting() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const db = useMemo(() => tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null, [tenant, slug])

  const [profile,    setProfile]    = useState<StudentProfile | null>(null)
  const [elections,  setElections]  = useState<Election[]>([])
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({})
  const [votedMap,   setVotedMap]   = useState<Record<string, string>>({})    // electionId → candidateId voted
  const [voteCounts, setVoteCounts] = useState<Record<string, Record<string, number>>>({})
  const [loading,    setLoading]    = useState(true)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [voting,     setVoting]     = useState(false)
  const [loadingCands, setLoadingCands] = useState(false)

  // Nomination form
  const [showNomModal, setShowNomModal] = useState(false)
  const [nomElection,  setNomElection]  = useState<Election | null>(null)
  const [nomForm,      setNomForm]      = useState({ manifesto: '', photo_url: '' })
  const [submittingNom, setSubmittingNom] = useState(false)

  useEffect(() => { if (db && user) loadAll() }, [db, user])

  const loadAll = async () => {
    if (!db || !user) return
    setLoading(true)

    // Get student profile
    const { data: p } = await db
      .from('students')
      .select('id, first_name, last_name, department_id, level, departments(name)')
      .eq('supabase_uid', user.id)
      .maybeSingle()

    if (!p) { setLoading(false); return }
    setProfile(p as StudentProfile)

    // Get all non-draft elections
    const { data: e } = await db
      .from('elections')
      .select('*, departments(name)')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (e) {
      // Filter: SUG = everyone, departmental = only matching dept
      const eligible = (e as Election[]).filter(el =>
        el.scope === 'sug' || el.department_id === (p as StudentProfile).department_id
      )
      setElections(eligible)

      // Check which ones the student already voted in
      if (eligible.length > 0) {
        const { data: votes } = await db
          .from('election_votes')
          .select('election_id, candidate_id')
          .eq('voter_id', (p as StudentProfile).id)
          .in('election_id', eligible.map(x => x.id))

        if (votes) {
          const map: Record<string, string> = {}
          votes.forEach((v: any) => { map[v.election_id] = v.candidate_id })
          setVotedMap(map)
        }
      }
    }

    setLoading(false)
  }

  const openElection = async (election: Election) => {
    setActiveId(election.id)

    if (!candidates[election.id]) {
      setLoadingCands(true)
      const { data } = await db!
        .from('election_candidates')
        .select('id, full_name, manifesto, photo_url, nomination_status')
        .eq('election_id', election.id)
        .eq('nomination_status', 'approved')
        .order('created_at')
      if (data) setCandidates(p => ({ ...p, [election.id]: data as Candidate[] }))
      setLoadingCands(false)
    }

    // Load vote counts if closed
    if (election.status === 'closed' && !voteCounts[election.id]) {
      const { data: votes } = await db!
        .from('election_votes')
        .select('candidate_id')
        .eq('election_id', election.id)
      if (votes) {
        const counts: Record<string, number> = {}
        votes.forEach((v: any) => { counts[v.candidate_id] = (counts[v.candidate_id] || 0) + 1 })
        setVoteCounts(p => ({ ...p, [election.id]: counts }))
      }
    }
  }

  const castVote = async (election: Election, candidateId: string) => {
    if (!db || !profile || voting) return
    if (!isLive(election)) { toast.error('This election is not currently accepting votes'); return }
    if (votedMap[election.id]) { toast.error('You have already voted in this election'); return }

    setVoting(true)
    const { error } = await db.from('election_votes').insert({
      election_id:  election.id,
      candidate_id: candidateId,
      voter_id:     profile.id,
    } as any)
    setVoting(false)

    if (error) {
      if (error.code === '23505') {
        toast.error('You have already voted in this election')
      } else {
        toast.error('Vote failed: ' + error.message)
      }
      return
    }

    toast.success('✅ Vote cast successfully!')
    setVotedMap(p => ({ ...p, [election.id]: candidateId }))
  }

  // ── SELF-NOMINATION ──────────────────────────────────────
  const openNominate = (election: Election) => {
    setNomElection(election)
    setNomForm({ manifesto: '', photo_url: '' })
    setShowNomModal(true)
  }

  const submitNomination = async () => {
    if (!db || !profile || !nomElection) return
    if (!nomForm.manifesto.trim()) { toast.error('Please write a manifesto'); return }

    // Check if already nominated
    const { data: existing } = await db
      .from('election_candidates')
      .select('id')
      .eq('election_id', nomElection.id)
      .eq('student_id', profile.id)
      .maybeSingle()

    if (existing) { toast.error('You have already submitted a nomination for this election'); return }

    setSubmittingNom(true)
    const { error } = await db.from('election_candidates').insert({
      election_id:       nomElection.id,
      student_id:        profile.id,
      full_name:         `${profile.first_name} ${profile.last_name}`,
      manifesto:         nomForm.manifesto.trim(),
      photo_url:         nomForm.photo_url || null,
      nomination_status: 'pending',
    } as any)
    setSubmittingNom(false)

    if (error) { toast.error('Submission failed: ' + error.message); return }
    toast.success('Nomination submitted! The admin will review and approve it.')
    setShowNomModal(false)
  }

  // ── DERIVED ───────────────────────────────────────────────
  const activeElection = elections.find(e => e.id === activeId)
  const activeCands    = activeId ? (candidates[activeId] || []) : []
  const counts         = activeId ? (voteCounts[activeId] || {}) : {}
  const totalVotes     = Object.values(counts).reduce((s: number, n) => s + (n as number), 0)
  const maxVotes       = Math.max(...Object.values(counts).map(v => v as number), 1)
  const myVote         = activeId ? votedMap[activeId] : undefined
  const isClosed       = activeElection?.status === 'closed'
  const canVote        = activeElection && isLive(activeElection) && !myVote

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SidebarLayout>
      <div style={{ fontFamily: "'DM Sans',system-ui", color: '#e8eeff', padding: 'clamp(14px,3vw,28px)' }}>

        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, margin: 0 }}>Elections & Voting</h2>
          <p style={{ fontSize: 13, color: '#7a8bbf', margin: '4px 0 0' }}>
            {profile ? `${(profile.departments as any)?.name} · ${profile.level}L` : ''}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={S.spin} />
          </div>
        ) : elections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#3d4f7a' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🗳️</div>
            <div style={{ fontSize: 14 }}>No active elections at the moment.</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Check back during election periods.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* ── ELECTIONS LIST (left panel) ── */}
            <div style={{ minWidth: 260, flex: '0 0 280px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', marginBottom: 10 }}>
                Elections ({elections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {elections.map(e => {
                  const hasVoted = !!votedMap[e.id]
                  const live     = isLive(e)
                  const closed   = e.status === 'closed'
                  return (
                    <button key={e.id} onClick={() => openElection(e)} style={{
                      background: activeId === e.id ? 'rgba(45,108,255,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeId === e.id ? 'rgba(45,108,255,0.35)' : 'rgba(255,255,255,0.07)'}`,
                      borderRadius: 14, padding: '14px 16px', cursor: 'pointer',
                      textAlign: 'left', fontFamily: "'DM Sans',system-ui", transition: 'all .15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: live ? 'rgba(74,222,128,0.15)' : closed ? 'rgba(255,255,255,0.08)' : 'rgba(251,191,36,0.15)', color: live ? '#4ade80' : closed ? '#7a8bbf' : '#fbbf24', padding: '2px 9px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {live ? '🟢 Live' : closed ? 'Closed' : 'Upcoming'}
                        </span>
                        <span style={{ fontSize: 10, background: e.scope === 'sug' ? 'rgba(96,165,250,0.12)' : 'rgba(167,139,250,0.12)', color: e.scope === 'sug' ? '#60a5fa' : '#a78bfa', padding: '2px 9px', borderRadius: 100 }}>
                          {e.scope === 'sug' ? 'SUG' : 'Dept'}
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, color: '#e8eeff', fontSize: 13, marginBottom: 3 }}>{e.title}</div>
                      {e.position && <div style={{ fontSize: 12, color: '#7a8bbf' }}>{e.position}</div>}
                      {hasVoted && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#4ade80' }}>✓ You voted</div>
                      )}
                      {e.nomination_open && !hasVoted && (
                        <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24' }}>📬 Nominations open</div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── ELECTION DETAIL (right panel) ── */}
            <div style={{ flex: 1, minWidth: 280 }}>
              {!activeElection ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#3d4f7a' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>👈</div>
                  <div style={{ fontSize: 14 }}>Select an election to view details</div>
                </div>
              ) : (
                <>
                  {/* Election header */}
                  <div style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                      <div>
                        <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: '0 0 6px' }}>{activeElection.title}</h3>
                        {activeElection.position && <div style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 4 }}>Position: {activeElection.position}</div>}
                        {activeElection.description && <div style={{ fontSize: 13, color: '#7a8bbf', lineHeight: 1.6, marginBottom: 8 }}>{activeElection.description}</div>}
                        <div style={{ fontSize: 12, color: '#3d4f7a' }}>
                          {fmtDateTime(activeElection.start_date)} → {fmtDateTime(activeElection.end_date)}
                        </div>
                      </div>
                      {/* Nominate button */}
                      {activeElection.nomination_open && (
                        <button onClick={() => openNominate(activeElection)} style={{ ...S.btnSm, color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)', flexShrink: 0 }}>
                          ✋ Nominate Yourself
                        </button>
                      )}
                    </div>

                    {/* Already voted banner */}
                    {myVote && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, fontSize: 13, color: '#4ade80' }}>
                        ✅ Your vote has been recorded. {isClosed ? 'Results are shown below.' : 'Results will appear after polls close.'}
                      </div>
                    )}
                    {!myVote && isClosed && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 13, color: '#7a8bbf' }}>
                        This election is closed. You did not vote.
                      </div>
                    )}
                  </div>

                  {/* Candidates */}
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', marginBottom: 12 }}>
                      Candidates ({activeCands.length})
                    </div>

                    {loadingCands ? (
                      <div style={{ padding: '24px 0', textAlign: 'center' }}>
                        <div style={S.spin} />
                      </div>
                    ) : activeCands.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '32px 0', color: '#3d4f7a', fontSize: 14 }}>
                        No candidates have been added yet.
                      </div>
                    ) : (
                      // RESULTS VIEW (closed) or VOTING VIEW (active)
                      isClosed ? (
                        // ── RESULTS ──
                        <div style={S.card}>
                          <div style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 16 }}>
                            Total votes: <strong style={{ color: '#e8eeff' }}>{totalVotes}</strong>
                          </div>
                          {[...activeCands]
                            .sort((a, b) => ((counts[b.id] as number) || 0) - ((counts[a.id] as number) || 0))
                            .map((c, i) => {
                              const cVotes = counts[c.id] || 0
                              const pct    = totalVotes > 0 ? Math.round((cVotes / totalVotes) * 100) : 0
                              const winner = i === 0 && cVotes > 0
                              const isMyPick = myVote === c.id
                              return (
                                <div key={c.id} style={{ marginBottom: 16 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <CandidateAvatar name={c.full_name} photo={c.photo_url} size={38} />
                                    <div style={{ flex: 1 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontWeight: 700, color: '#e8eeff', fontSize: 14 }}>{c.full_name}</span>
                                        {winner && <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 100, fontWeight: 700 }}>🏆 WINNER</span>}
                                        {isMyPick && <span style={{ fontSize: 10, background: 'rgba(74,222,128,0.12)', color: '#4ade80', padding: '2px 8px', borderRadius: 100 }}>Your vote</span>}
                                      </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                      <div style={{ fontSize: 16, fontWeight: 800, color: winner ? '#fbbf24' : '#e8eeff' }}>{cVotes}</div>
                                      <div style={{ fontSize: 11, color: '#7a8bbf' }}>{pct}%</div>
                                    </div>
                                  </div>
                                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 100, overflow: 'hidden' }}>
                                    <div style={{
                                      height: '100%', borderRadius: 100, transition: 'width 0.7s ease',
                                      width: `${(cVotes / maxVotes) * 100}%`,
                                      background: winner ? 'linear-gradient(90deg,#f0b429,#fbbf24)' : isMyPick ? 'linear-gradient(90deg,#4ade80,#22c55e)' : 'linear-gradient(90deg,#2d6cff,#4f3ef8)',
                                    }} />
                                  </div>
                                </div>
                              )
                            })
                          }
                        </div>
                      ) : (
                        // ── VOTING ──
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                          {activeCands.map(c => {
                            const isSelected = myVote === c.id
                            return (
                              <div key={c.id} style={{
                                background: isSelected ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isSelected ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                borderRadius: 16, padding: '18px 16px',
                                display: 'flex', flexDirection: 'column', gap: 12,
                                transition: 'all .2s',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <CandidateAvatar name={c.full_name} photo={c.photo_url} size={48} />
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#e8eeff', fontSize: 14 }}>{c.full_name}</div>
                                    {isSelected && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 2 }}>✓ Your vote</div>}
                                  </div>
                                </div>
                                {c.manifesto && (
                                  <p style={{ fontSize: 12, color: '#7a8bbf', lineHeight: 1.65, margin: 0, flex: 1 }}>
                                    {c.manifesto.length > 180 ? c.manifesto.slice(0, 180) + '…' : c.manifesto}
                                  </p>
                                )}
                                {canVote && (
                                  <button
                                    onClick={() => castVote(activeElection, c.id)}
                                    disabled={voting}
                                    style={{
                                      width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: voting ? 'not-allowed' : 'pointer',
                                      background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', fontWeight: 700, fontSize: 13,
                                      fontFamily: "'DM Sans',system-ui", opacity: voting ? 0.7 : 1, transition: 'all .15s',
                                    }}
                                  >
                                    {voting ? 'Casting vote...' : '🗳 Vote for ' + c.full_name.split(' ')[0]}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    )}
                  </div>

                  {/* Upcoming / not yet open notice */}
                  {!isClosed && !isLive(activeElection) && activeElection.status === 'active' && (
                    <div style={{ ...S.card, marginTop: 16, textAlign: 'center', padding: '24px' }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>⏰</div>
                      <div style={{ fontSize: 13, color: '#7a8bbf' }}>
                        Voting opens {fmtDateTime(activeElection.start_date)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── NOMINATION MODAL ── */}
        {showNomModal && nomElection && (
          <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowNomModal(false)}>
            <div style={S.modal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, margin: 0 }}>Self-Nomination</h3>
                  <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 3 }}>{nomElection.title}</div>
                </div>
                <button onClick={() => setShowNomModal(false)} style={S.btnClose}>×</button>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10, marginBottom: 18, fontSize: 12, color: '#fbbf24' }}>
                ℹ Your nomination will be reviewed by the school admin before it appears to voters.
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, marginBottom: 18, fontSize: 13, color: '#e8eeff' }}>
                Nominating as: <strong>{profile?.first_name} {profile?.last_name}</strong>
              </div>

              <div style={S.field}>
                <label style={S.label}>Manifesto / Campaign statement *</label>
                <textarea
                  value={nomForm.manifesto}
                  onChange={e => setNomForm(p => ({ ...p, manifesto: e.target.value }))}
                  rows={5}
                  placeholder="Tell students why they should vote for you..."
                  style={{ ...S.input, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>Profile photo URL (optional)</label>
                <input
                  value={nomForm.photo_url}
                  onChange={e => setNomForm(p => ({ ...p, photo_url: e.target.value }))}
                  placeholder="https://..."
                  style={S.input}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNomModal(false)} style={S.btnSm}>Cancel</button>
                <button onClick={submitNomination} disabled={submittingNom} style={{ ...S.btnPrimary, opacity: submittingNom ? 0.7 : 1 }}>
                  {submittingNom ? 'Submitting...' : 'Submit Nomination'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

// ── AVATAR HELPER ─────────────────────────────────────────
function CandidateAvatar({ name, photo, size = 40 }: { name: string; photo?: string | null; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
  return photo
    ? <img src={photo} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
        {initials}
      </div>
}

// ── STYLES ─────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  spin:       { width: 36, height: 36, border: '3px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  card:       { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '18px 20px' },
  btnPrimary: { padding: '9px 18px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnSm:      { padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 9, color: '#7a8bbf', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans',system-ui" },
  btnClose:   { background: 'none', border: 'none', color: '#7a8bbf', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  field:      { marginBottom: 14 },
  label:      { fontSize: 11, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:      { width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#e8eeff', fontSize: 13, fontFamily: "'DM Sans',system-ui", boxSizing: 'border-box' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' },
  modal:      { background: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '24px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
}