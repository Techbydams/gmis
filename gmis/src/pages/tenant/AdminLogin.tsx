// ============================================================
// GMIS — Admin Login
// Lives at estam.gmis.com/admin/login
// Deliberately separate from the public-facing school login.
// Only school admins should ever know this URL exists.
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const navigate          = useNavigate()
  const { signIn, user, loading: authLoading } = useAuth()
  const { tenant, slug }  = useTenant()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [errEmail, setErrEmail] = useState('')
  const [errPass,  setErrPass]  = useState('')
  const [attempts, setAttempts] = useState(0)

  // If already logged in as admin, forward immediately
  useEffect(() => {
    if (!authLoading && user?.role === 'admin') {
      navigate('/admin', { replace: true })
    }
  }, [user, authLoading, navigate])

  const validate = (): boolean => {
    let ok = true
    if (!email.trim()) { setErrEmail('Email is required'); ok = false }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErrEmail('Enter a valid email address'); ok = false }
    if (!password) { setErrPass('Password is required'); ok = false }
    else if (password.length < 6) { setErrPass('Password too short'); ok = false }
    return ok
  }

  const handleLogin = async () => {
    setErrEmail(''); setErrPass('')
    if (!validate()) return
    setLoading(true)

    try {
      const { error } = await signIn(email.trim().toLowerCase(), password)

      if (error) {
        setAttempts(a => a + 1)
        if (error.includes('Incorrect') || error.includes('Invalid')) {
          toast.error('Wrong credentials. This portal is for administrators only.')
        } else {
          toast.error(error)
        }
        setLoading(false)
        return
      }

      // AuthContext will resolve role — if they're not an admin, RoleRedirect
      // will send them to their correct portal. But we can short-circuit here:
      toast.success('Access granted')
      // Navigate is handled by the useEffect above once user.role resolves

    } catch {
      toast.error('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={S.page}>
      {/* Subtle scanline texture */}
      <div style={S.scanlines} />
      {/* Dim radial glow */}
      <div style={S.glow} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Header lockup */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {/* GMIS emblem */}
          <div style={S.emblem}>
            <div style={S.emblemInner}>
              <span style={{ fontFamily: "'Syne',system-ui", fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: -1 }}>G</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Syne',system-ui", fontWeight: 900, fontSize: 20, color: '#e8eeff', marginBottom: 4, letterSpacing: -0.5 }}>
            Administration Access
          </div>
          <div style={{ fontSize: 12, color: '#3d4f7a', letterSpacing: 0.5 }}>
            {tenant?.name?.toUpperCase() || slug?.toUpperCase()} · RESTRICTED PORTAL
          </div>
        </div>

        {/* Warning banner */}
        <div style={S.warningBanner}>
          <span style={{ fontSize: 13, lineHeight: 1 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#fbbf24', lineHeight: 1.55 }}>
            This page is for <strong>school administrators only</strong>. Unauthorised access attempts are logged.
          </span>
        </div>

        {/* Login card */}
        <div style={S.card}>
          {/* School identifier strip */}
          <div style={S.schoolStrip}>
            <div style={S.stripDot} />
            <span style={{ fontSize: 11, color: '#7a8bbf', fontFamily: 'monospace', letterSpacing: 0.5 }}>
              {slug}.gmis.com
            </span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: '#3d4f7a', textTransform: 'uppercase', letterSpacing: 1 }}>Admin</span>
          </div>

          {/* Email */}
          <div style={S.field}>
            <label style={S.label}>Administrator email</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrEmail('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="admin@institution.edu"
              autoComplete="email"
              autoFocus
              style={{ ...S.input, borderColor: errEmail ? '#f87171' : 'rgba(255,255,255,0.1)' }}
            />
            {errEmail && <p style={S.err}>{errEmail}</p>}
          </div>

          {/* Password */}
          <div style={S.field}>
            <label style={S.label}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setErrPass('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••••••"
                autoComplete="current-password"
                style={{ ...S.input, borderColor: errPass ? '#f87171' : 'rgba(255,255,255,0.1)', paddingRight: 44 }}
              />
              <button
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#3d4f7a', padding: 0 }}
                tabIndex={-1}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {errPass && <p style={S.err}>{errPass}</p>}
          </div>

          {/* Too many attempts warning */}
          {attempts >= 3 && (
            <div style={{ padding: '9px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 9, marginBottom: 14, fontSize: 11, color: '#f87171' }}>
              Multiple failed attempts detected. Ensure you are using the correct admin credentials.
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...S.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={S.spinner} /> Authenticating...
                </span>
              : 'Access Admin Portal'
            }
          </button>

          {/* First-time setup link */}
          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              onClick={() => navigate('/setup?role=admin')}
              style={{ fontSize: 12, color: '#3d4f7a', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              First-time setup →
            </button>
          </div>
        </div>

        {/* Back to school portal */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => navigate('/login')}
            style={{ fontSize: 12, color: '#3d4f7a', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Back to student / lecturer portal
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 10, color: '#1e2d50', letterSpacing: 0.5 }}>
          GMIS · DAMS TECHNOLOGIES · {new Date().getFullYear()}
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none !important; border-color: rgba(240,180,41,0.5) !important; box-shadow: 0 0 0 3px rgba(240,180,41,0.1) !important; }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    // Distinct from the main school login — darker, more institutional
    background: 'linear-gradient(160deg, #010a18 0%, #03071a 50%, #000d1a 100%)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '32px 20px', position: 'relative', overflow: 'hidden',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  scanlines: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
    opacity: 0.5,
  },
  glow: {
    position: 'absolute', width: 700, height: 700, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(240,180,41,0.04) 0%, transparent 65%)',
    filter: 'blur(60px)', top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)', pointerEvents: 'none',
  },
  emblem: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(240,180,41,0.15), rgba(240,180,41,0.05))',
    border: '1px solid rgba(240,180,41,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 14px',
    boxShadow: '0 0 24px rgba(240,180,41,0.1)',
  },
  emblemInner: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'linear-gradient(135deg,#1a3a8f,#0f2460)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  warningBanner: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '11px 14px', marginBottom: 16,
    background: 'rgba(251,191,36,0.06)',
    border: '1px solid rgba(251,191,36,0.18)',
    borderRadius: 11,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18, padding: '24px 24px 20px',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    // Slightly more amber accent on the card border-top
    boxShadow: 'inset 0 1px 0 rgba(240,180,41,0.12)',
  },
  schoolStrip: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)', borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.06)',
  },
  stripDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#f0b429', flexShrink: 0,
    boxShadow: '0 0 6px rgba(240,180,41,0.6)',
  },
  field:  { marginBottom: 16 },
  label:  { fontSize: 11, color: '#4d618a', display: 'block', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    width: '100%', padding: '11px 14px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 11, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', color: '#e8eeff',
    fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'all 0.2s',
    boxSizing: 'border-box',
  },
  err: { margin: '4px 0 0', fontSize: 12, color: '#f87171' },
  btn: {
    width: '100%', padding: '13px',
    // Gold accent instead of blue — visually distinct from student login
    background: 'linear-gradient(135deg, #1a3a8f, #0f2460)',
    border: '1px solid rgba(240,180,41,0.3)',
    color: '#fff', borderRadius: 11, fontSize: 14, fontWeight: 700,
    boxShadow: '0 4px 20px rgba(15,36,96,0.5)',
    fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'all 0.15s',
    letterSpacing: 0.3,
  },
  spinner: {
    display: 'inline-block', width: 15, height: 15,
    border: '2px solid rgba(255,255,255,0.25)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
}