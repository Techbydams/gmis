// ============================================================
// GMIS — Voting / SUG Elections
// estam.gmis.com/voting
// ============================================================
import { useState, useEffect } from 'react'
import { useAuth }    from '../../../context/AuthContext'
import { useTenant }  from '../../../context/TenantContext'
import { getTenantClient } from '../../../lib/supabase'
import toast from 'react-hot-toast'
import SidebarLayout  from '../../../components/layout/SidebarLayout'

interface Election {
  id: string; title: string; description: string
  position: string; status: string
  start_date: string; end_date: string
}
interface Candidate {
  id: string; full_name: string; manifesto: string
  photo_url: string; election_id: string
  vote_count?: number
}

export default function Voting() {
  const { user }         = useAuth()
  const { tenant, slug } = useTenant()
  const [elections,  setElections]  = useState<Election[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [myVotes,    setMyVotes]    = useState<string[]>([])  // election IDs I voted in
  const [loading,    setLoading]    = useState(true)
  const [voting,     setVoting]     = useState<string | null>(null)
  const [studentId,  setStudentId]  = useState<string | null>(null)
  const [selElection,setSelElection]= useState<string | null>(null)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  useEffect(() => { if (db && user) load() }, [db, user])

  const load = async () => {
    setLoading(true)
    const { data: s } = await db!.from('students').select('id').eq('supabase_uid', user!.id).single()
    if (s) {
      setStudentId(s.id)
      const [elRes, voteRes] = await Promise.all([
        db!.from('elections').select('*').in('status', ['active', 'closed']).order('created_at', { ascending: false }),
        db!.from('election_votes').select('election_id').eq('voter_id', s.id),
      ])
      if (elRes.data) {
        setElections(elRes.data)
        if (elRes.data.length > 0) {
          setSelElection(elRes.data[0].id)
          loadCandidates(elRes.data[0].id, s.id)
        }
      }
      if (voteRes.data) setMyVotes(voteRes.data.map((v: any) => v.election_id))
    }
    setLoading(false)
  }

  const loadCandidates = async (electionId: string, sid?: string) => {
    const { data: cands } = await db!
      .from('election_candidates').select('*').eq('election_id', electionId)
    if (!cands) return

    // Get vote counts
    const counts = await Promise.all(cands.map(async (c: any) => {
      const { count } = await db!.from('election_votes')
        .select('*', { count: 'exact', head: true }).eq('candidate_id', c.id)
      return { ...c, vote_count: count || 0 }
    }))
    setCandidates(counts)
  }

  const selectElection = (id: string) => {
    setSelElection(id)
    loadCandidates(id, studentId || undefined)
  }

  const castVote = async (candidateId: string, electionId: string) => {
    if (!studentId) return
    if (myVotes.includes(electionId)) { toast.error('You have already voted in this election'); return }
    setVoting(candidateId)
    const { error } = await db!.from('election_votes').insert({
      election_id: electionId, candidate_id: candidateId, voter_id: studentId,
    })
    setVoting(null)
    if (error) { toast.error('Vote failed. Please try again.'); return }
    toast.success('✓ Your vote has been recorded!')
    setMyVotes(prev => [...prev, electionId])
    loadCandidates(electionId, studentId)
  }

  const activeElection = elections.find(e => e.id === selElection)
  const totalVotes = candidates.reduce((s, c) => s + (c.vote_count || 0), 0)
  const hasVoted = selElection ? myVotes.includes(selElection) : false

  return (
    <SidebarLayout active="voting">
      <h1 style={S.title}>Student Union Elections</h1>
      <p style={S.sub}>Cast your vote for student government representatives</p>

      {loading ? <Spin /> : elections.length === 0 ? (
        <Empty icon="🗳️" text="No elections are currently running. Check back later." />
      ) : (
        <>
          {/* Election selector */}
          {elections.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {elections.map(e => (
                <button key={e.id} onClick={() => selectElection(e.id)}
                  style={{ ...S.tabBtn, background: selElection === e.id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)', color: selElection === e.id ? '#fff' : '#7a8bbf', border: selElection === e.id ? 'none' : '1px solid rgba(255,255,255,0.08)' }}>
                  {e.title}
                </button>
              ))}
            </div>
          )}

          {activeElection && (
            <>
              {/* Election header */}
              <div style={{ ...S.card, marginBottom: 20, padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, color: '#e8eeff', marginBottom: 4 }}>{activeElection.title}</h2>
                    <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 8 }}>{activeElection.description}</p>
                    <p style={{ fontSize: 12, color: '#3d4f7a' }}>Position: <strong style={{ color: '#60a5fa' }}>{activeElection.position}</strong> · {totalVotes} votes cast</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: activeElection.status === 'active' ? 'rgba(74,222,128,.15)' : 'rgba(96,165,250,.15)', color: activeElection.status === 'active' ? '#4ade80' : '#60a5fa', padding: '4px 12px', borderRadius: 100 }}>
                      {activeElection.status === 'active' ? '🟢 Voting open' : '🔵 Closed'}
                    </span>
                    {hasVoted && <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '4px 12px', borderRadius: 100 }}>✓ You voted</span>}
                  </div>
                </div>
              </div>

              {/* Candidates */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16 }}>
                {candidates.map(c => {
                  const pct = totalVotes > 0 ? Math.round((c.vote_count || 0) / totalVotes * 100) : 0
                  return (
                    <div key={c.id} style={{ ...S.card, padding: '24px 22px' }}>
                      {/* Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, color: '#fff', flexShrink: 0 }}>
                          {c.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 16, color: '#e8eeff' }}>{c.full_name}</div>
                          <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 2 }}>{c.vote_count} vote{c.vote_count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>

                      {/* Manifesto */}
                      {c.manifesto && (
                        <p style={{ fontSize: 13, color: '#7a8bbf', fontStyle: 'italic', lineHeight: 1.7, marginBottom: 14, borderLeft: '3px solid rgba(45,108,255,0.4)', paddingLeft: 12 }}>
                          "{c.manifesto}"
                        </p>
                      )}

                      {/* Vote bar */}
                      {(hasVoted || activeElection.status === 'closed') && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a8bbf', marginBottom: 5 }}>
                            <span>Vote share</span><span style={{ fontWeight: 700, color: '#e8eeff' }}>{pct}%</span>
                          </div>
                          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', borderRadius: 4, transition: 'width .8s ease' }} />
                          </div>
                        </div>
                      )}

                      {/* Vote button */}
                      {activeElection.status === 'active' && !hasVoted && (
                        <button
                          onClick={() => castVote(c.id, activeElection.id)}
                          disabled={!!voting}
                          style={{ width: '100%', padding: '10px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: voting ? 0.7 : 1 }}
                        >
                          {voting === c.id ? '...' : `Vote for ${c.full_name.split(' ')[0]}`}
                        </button>
                      )}
                      {hasVoted && <div style={{ textAlign: 'center', fontSize: 12, color: '#4ade80', fontWeight: 600 }}>✓ Vote recorded</div>}
                      {activeElection.status === 'closed' && !hasVoted && <div style={{ textAlign: 'center', fontSize: 12, color: '#3d4f7a' }}>Election closed</div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </SidebarLayout>
  )
}

function Spin() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div style={{ width: 32, height: 32, border: '2px solid rgba(45,108,255,.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' }} /></div> }
function Empty({ icon, text }: { icon: string; text: string }) { return <div style={{ textAlign: 'center', padding: 60 }}><div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div><div style={{ fontSize: 14, color: '#7a8bbf' }}>{text}</div></div> }

const S: Record<string, React.CSSProperties> = {
  title:  { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:    { fontSize: 13, color: '#7a8bbf', marginBottom: 22 },
  card:   { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '18px 20px' },
  tabBtn: { padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans',system-ui", transition: 'all .2s' },
}