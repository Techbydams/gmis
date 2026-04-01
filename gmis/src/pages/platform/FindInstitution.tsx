// ============================================================
// GMIS — Find Institution Page (gmis.com/find)
// User types school name → system finds it → redirects to subdomain
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { redirectToTenant } from '../../lib/helpers'
import { Button, Card, Spinner } from '../../components/ui'
import type { Organization } from '../../types'

export default function FindInstitution() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Organization[]>([])
  const [selected, setSelected] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [action, setAction] = useState<'login' | 'signup'>('login')

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSelected(null)
    setNotFound(false)
    setResults([])

    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, type, logo_url, status')
      .eq('status', 'approved')
      .or(`name.ilike.%${query}%,slug.ilike.%${query}%`)
      .limit(5)

    setLoading(false)

    if (error || !data?.length) {
      setNotFound(true)
      return
    }

    if (data.length === 1) {
      setSelected(data[0] as Organization)
    } else {
      setResults(data as Organization[])
    }
  }

  const handleRedirect = (org: Organization) => {
    setSelected(org)
    setResults([])
    setRedirecting(true)

    // Redirect after a short delay so user sees the animation
    setTimeout(() => {
      if (action === 'signup') {
        redirectToTenant(org.slug)
        // In local dev this stays on localhost — handle signup route
        navigate('/signup')
      } else {
        redirectToTenant(org.slug)
        navigate('/login')
      }
    }, 1800)
  }

  if (redirecting && selected) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-navy-950 flex flex-col items-center justify-center gap-6">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 dark:from-blue-950/20 to-transparent pointer-events-none" />
        <Spinner size="lg" />
        <div className="text-center relative">
          <p className="text-slate-500 dark:text-slate-400 mb-2">Redirecting you to</p>
          <p className="font-display font-black text-3xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {selected.slug}.gmis.com
          </p>
          <p className="text-sm text-slate-400 mt-2">{selected.name} · Isolated portal</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 flex items-center justify-center p-5 relative">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/80 dark:from-blue-950/20 to-transparent pointer-events-none" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px] -top-48 -right-24 pointer-events-none" style={{ animation: 'float 12s ease-in-out infinite' }} />

      <div className="w-full max-w-md relative animate-fade-up">
        {/* Header */}
        <div className="text-center mb-8">
          <button onClick={() => navigate('/')} className="inline-flex items-center gap-2 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl font-display shadow-lg shadow-blue-600/30">G</div>
            <span className="font-display font-black text-2xl text-slate-800 dark:text-slate-200">GMIS</span>
          </button>
          <h1 className="font-display font-bold text-2xl text-slate-800 dark:text-slate-200 mb-2">Find your institution</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Type your school name — we'll take you straight to your portal</p>
        </div>

        {/* Action toggle */}
        <div className="flex bg-white/80 dark:bg-white/5 backdrop-blur-sm border border-black/8 dark:border-white/10 rounded-xl p-1 mb-5">
          {[['login', '🔐 Sign in'], ['signup', '✨ Create account']].map(([id, label]) => (
            <button key={id} onClick={() => setAction(id as 'login' | 'signup')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${action === id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400'}`}>
              {label}
            </button>
          ))}
        </div>

        <Card>
          {/* Search input */}
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">School or institution name</label>
          <div className="flex gap-3 mb-3">
            <div className="flex-1 relative">
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setNotFound(false); setResults([]); setSelected(null) }}
                onKeyDown={(e) => e.key === 'Enter' && search()}
                placeholder="e.g. ESTAM University, Unilag..."
                className="w-full pl-10 pr-4 py-3 bg-white/80 dark:bg-white/5 border border-black/12 dark:border-white/14 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all backdrop-blur-sm"
              />
              <span className="absolute left-3 top-3 text-slate-400 text-base">🔍</span>
            </div>
            <Button onClick={search} loading={loading}>Search</Button>
          </div>

          {/* Results list */}
          {results.length > 0 && (
            <div className="bg-white/60 dark:bg-white/3 border border-black/8 dark:border-white/10 rounded-xl overflow-hidden mb-3">
              {results.map((org, i) => (
                <button key={org.id} onClick={() => handleRedirect(org)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors ${i < results.length - 1 ? 'border-b border-black/5 dark:border-white/5' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-400 flex-shrink-0">
                    {org.slug.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{org.name}</div>
                    <div className="text-xs text-slate-400">{org.slug}.gmis.com</div>
                  </div>
                  <span className="text-slate-400 text-xs">→</span>
                </button>
              ))}
            </div>
          )}

          {/* Selected school */}
          {selected && !redirecting && (
            <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl mb-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400">
                  {selected.slug.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-display font-bold text-slate-800 dark:text-slate-200">{selected.name}</div>
                  <div className="text-xs text-slate-500 capitalize">{selected.type}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400 font-semibold">{selected.slug}.gmis.com</span>
                  </div>
                </div>
              </div>
              <Button full onClick={() => handleRedirect(selected)}>
                {action === 'signup' ? `✨ Sign up at ${selected.slug}.gmis.com →` : `🔐 Sign in to ${selected.slug}.gmis.com →`}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-2">You'll be redirected to your school's isolated secure portal</p>
            </div>
          )}

          {/* Not found */}
          {notFound && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl mb-3">
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">School not found</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mb-3">"{query}" is not registered on GMIS yet.</p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/register')}>Register your institution →</Button>
            </div>
          )}

          <div className="border-t border-black/8 dark:border-white/8 pt-4 mt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Popular institutions</p>
            {/* This will be populated from the database in production */}
            <p className="text-xs text-slate-400 italic">Schools will appear here once they register on GMIS.</p>
          </div>
        </Card>

        <p className="text-center mt-4 text-xs text-slate-400">
          School not listed? <button onClick={() => navigate('/register')} className="text-blue-600 font-semibold hover:underline">Register on GMIS →</button>
        </p>
      </div>
    </div>
  )
}
