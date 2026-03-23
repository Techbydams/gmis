// ============================================================
// GMIS — School Login Page
// Lives at estam.gmis.com/login
// Handles Student (matric/email) + Lecturer + Parent login
// Admin login is SEPARATE at /admin/login
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTenant } from '../../context/TenantContext'
import { isValidEmail } from '../../lib/helpers'
import toast from 'react-hot-toast'

type Role = 'student' | 'lecturer' | 'parent'

interface FormState {
  identifier: string   // matric number or email
  password:   string
  remember:   boolean
}

const ROLES: { id: Role; label: string; icon: string; hint: string }[] = [
  { id: 'student',  label: 'Student',  icon: '👨‍🎓', hint: 'Matric number or email' },
  { id: 'lecturer', label: 'Lecturer', icon: '👨‍🏫', hint: 'Email address'          },
  { id: 'parent',   label: 'Parent',   icon: '👨‍👩‍👦', hint: 'Email address'          },
]

export default function SchoolLogin() {
  const navigate                     = useNavigate()
  const { signIn, signInWithMatric } = useAuth()
  const { tenant, slug }             = useTenant()

  const [role,     setRole]     = useState<Role>('student')
  const [form,     setForm]     = useState<FormState>({ identifier: '', password: '', remember: false })
  const [errors,   setErrors]   = useState<Partial<FormState>>({})
  const [loading,  setLoading]  = useState(false)
  const [showPass, setShowPass] = useState(false)

  const activeRole = ROLES.find(r => r.id === role)!

  // ── VALIDATION ────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Partial<FormState> = {}
    if (!form.identifier.trim()) {
      e.identifier = role === 'student'
        ? 'Enter your matric number or email'
        : 'Enter your email address'
    }
    if (!form.password) {
      e.password = 'Password is required'
    } else if (form.password.length < 6) {
      e.password = 'Password must be at least 6 characters'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── SUBMIT ────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validate()) return
    setLoading(true)

    try {
      let error: string | null = null

      if (role === 'student') {
        const input = form.identifier.trim()
        if (isValidEmail(input)) {
          const result = await signIn(input, form.password)
          error = result.error
        } else {
          const result = await signInWithMatric(input, form.password)
          error = result.error
        }
      } else {
        // Lecturer + Parent both use email
        const result = await signIn(form.identifier.trim(), form.password)
        error = result.error
      }

      if (error) {
        if (error.includes('Invalid login credentials') || error.includes('Incorrect')) {
          toast.error('Incorrect credentials. Please check and try again.')
        } else if (error.includes('Email not confirmed')) {
          toast.error('Please verify your email first. Check your inbox.')
        } else if (error.includes('not found')) {
          toast.error('Matric number not found. Contact your registrar.')
        } else {
          toast.error(error)
        }
        setLoading(false)
        return
      }

      // Role-based redirect is handled by RoleRedirect in App.tsx
      toast.success('Welcome back!')

    } catch {
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.orbTR} />
      <div style={S.orbBL} />
      <div style={S.grid} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>

        {/* School branding */}
        <div style={S.schoolBanner}>
          <div style={S.schoolLogo}>
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} style={{ width: '100%', height: '100%', borderRadius: 10, objectFit: 'cover' }} />
              : <span style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>
                  {(tenant?.name || slug || 'G').slice(0, 2).toUpperCase()}
                </span>
            }
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>
              {tenant?.name || `${slug}.gmis.com`}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80' }} />
              {slug}.gmis.com · Powered by GMIS
            </div>
          </div>
          <button
            onClick={() => navigate('/find')}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ← Change
          </button>
        </div>

        {/* Login card */}
        <div style={S.card}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={S.heading}>Welcome back</h1>
            <p style={S.muted}>Sign in to your {tenant?.name || 'school'} portal</p>
          </div>

          {/* Role switcher — Student / Lecturer / Parent */}
          <div style={S.roleTabs}>
            {ROLES.map(r => (
              <button
                key={r.id}
                onClick={() => { setRole(r.id); setErrors({}); setForm(p => ({ ...p, identifier: '' })) }}
                style={{
                  ...S.roleTab,
                  background: role === r.id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'transparent',
                  color:      role === r.id ? '#fff' : '#7a8bbf',
                  fontWeight: role === r.id ? 700 : 400,
                  boxShadow:  role === r.id ? '0 4px 14px rgba(45,108,255,0.3)' : 'none',
                }}
              >
                {r.icon} {r.label}
              </button>
            ))}
          </div>

          {/* Parent info banner */}
          {role === 'parent' && (
            <div style={S.infoBanner}>
              <span style={{ fontSize: 13 }}>👨‍👩‍👦</span>
              <span style={{ fontSize: 12, color: '#60a5fa', lineHeight: 1.5 }}>
                Sign in with the email linked to your ward's profile by the school admin.
              </span>
            </div>
          )}

          {/* Identifier field */}
          <div style={S.field}>
            <label style={S.label}>
              {role === 'student' ? 'Matric number or email' : 'Email address'}
            </label>
            <input
              style={{ ...S.input, borderColor: errors.identifier ? '#f87171' : 'rgba(255,255,255,0.12)' }}
              value={form.identifier}
              onChange={e => { setForm(p => ({ ...p, identifier: e.target.value })); setErrors(p => ({ ...p, identifier: '' })) }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder={role === 'student' ? 'e.g. 02SCSC026 or email' : 'your@email.com'}
              autoComplete={role === 'student' ? 'username' : 'email'}
              autoFocus
            />
            {errors.identifier && <p style={S.errMsg}>{errors.identifier}</p>}
          </div>

          {/* Password field */}
          <div style={S.field}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <label style={S.label}>Password</label>
              <button
                onClick={() => navigate('/forgot-password')}
                style={{ fontSize: 12, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...S.input, borderColor: errors.password ? '#f87171' : 'rgba(255,255,255,0.12)', paddingRight: 44 }}
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setErrors(p => ({ ...p, password: '' })) }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#3d4f7a' }}
              >
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
            {errors.password && <p style={S.errMsg}>{errors.password}</p>}
          </div>

          {/* Remember me */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
            <input
              type="checkbox"
              id="remember"
              checked={form.remember}
              onChange={e => setForm(p => ({ ...p, remember: e.target.checked }))}
              style={{ width: 15, height: 15, accentColor: '#2d6cff', cursor: 'pointer' }}
            />
            <label htmlFor="remember" style={{ fontSize: 13, color: '#7a8bbf', cursor: 'pointer' }}>
              Remember me on this device
            </label>
          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{ ...S.btnPrimary, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <span style={S.spinner} />
                Signing in...
              </span>
            ) : (
              `Sign in as ${activeRole.label}`
            )}
          </button>

          {/* Divider */}
          <div style={S.divider}><span>or</span></div>

          {/* Footer links */}
          <div style={{ textAlign: 'center', fontSize: 13, color: '#7a8bbf' }}>
            New student?{' '}
            <button
              onClick={() => navigate('/signup')}
              style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
            >
              Create account
            </button>
          </div>

          {/* Security note */}
          <div style={S.securityNote}>
            <span style={{ fontSize: 14 }}>🔒</span>
            <span style={{ fontSize: 11, color: '#3d4f7a' }}>
              This portal is exclusively for <strong style={{ color: '#7a8bbf' }}>{tenant?.name || slug}</strong>.
              Wrong school?{' '}
              <button
                onClick={() => navigate('/find')}
                style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11 }}
              >
                Go back
              </button>
            </span>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#3d4f7a' }}>
          Powered by <span style={{ color: '#f0b429', fontWeight: 600 }}>GMIS</span> · A product of DAMS Technologies
        </p>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: #2d6cff !important; box-shadow: 0 0 0 3px rgba(45,108,255,0.15); }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: '#03071a',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '32px 20px', position: 'relative', overflow: 'hidden',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  orbTR: {
    position: 'absolute', width: 600, height: 600, borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(45,108,255,0.09) 0%,transparent 70%)',
    filter: 'blur(80px)', top: -200, right: -150, pointerEvents: 'none',
  },
  orbBL: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(79,62,248,0.07) 0%,transparent 70%)',
    filter: 'blur(60px)', bottom: -100, left: -80, pointerEvents: 'none',
  },
  grid: {
    position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.03,
    backgroundImage: 'linear-gradient(#2d6cff 1px,transparent 1px),linear-gradient(90deg,#2d6cff 1px,transparent 1px)',
    backgroundSize: '60px 60px',
  },
  schoolBanner: {
    background: 'linear-gradient(135deg,#1a3a8f,#0f2460)',
    borderRadius: 16, padding: '14px 18px', marginBottom: 14,
    display: 'flex', alignItems: 'center', gap: 12,
    boxShadow: '0 8px 32px rgba(15,36,96,0.5)',
  },
  schoolLogo: {
    width: 44, height: 44, borderRadius: 12,
    background: 'rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 20, padding: '28px 28px 24px',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
  },
  heading: {
    fontFamily: "'Syne', system-ui, sans-serif",
    fontSize: 22, fontWeight: 800, color: '#e8eeff', margin: 0, marginBottom: 4,
  },
  muted: { fontSize: 13, color: '#7a8bbf', margin: 0 },
  roleTabs: {
    display: 'flex', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 13, padding: 4, marginBottom: 18,
  },
  roleTab: {
    flex: 1, padding: '9px 4px', borderRadius: 10,
    border: 'none', fontSize: 12, cursor: 'pointer',
    transition: 'all 0.2s', fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  infoBanner: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '10px 13px', marginBottom: 16,
    background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
    borderRadius: 11,
  },
  field:     { marginBottom: 16 },
  label:     { fontSize: 12, color: '#7a8bbf', display: 'block', fontWeight: 500 },
  input: {
    width: '100%', padding: '11px 14px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, fontSize: 14,
    background: 'rgba(255,255,255,0.05)', color: '#e8eeff',
    fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'all 0.2s',
    boxSizing: 'border-box',
  },
  errMsg: { margin: '4px 0 0', fontSize: 12, color: '#f87171' },
  btnPrimary: {
    width: '100%', padding: '13px',
    background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
    color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
    boxShadow: '0 4px 20px rgba(45,108,255,0.35)',
    fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'all 0.15s',
  },
  spinner: {
    display: 'inline-block', width: 16, height: 16,
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '18px 0', color: '#3d4f7a', fontSize: 12,
  } as React.CSSProperties,
  securityNote: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    padding: '10px 13px', marginTop: 18,
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
  },
}