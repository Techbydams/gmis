// ============================================================
// GMIS — Account Setup Page
// Handles two flows:
//   1. /setup?role=admin  — First-time admin account creation
//   2. /setup?role=lecturer&token=xxx — Lecturer activating their invite
//
// Why this exists:
//   - Admins are created by DAMS Tech when a school is approved.
//     They receive an email with a link to /setup?role=admin
//   - Lecturers are added by the admin in Academic Setup.
//     They receive an email with a link to /setup?role=lecturer&token=xxx
//   - Both set their password here on first login
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext'
import { getTenantClient } from '../../lib/supabase'
import { isValidPassword } from '../../lib/helpers'
import toast from 'react-hot-toast'

type SetupRole = 'admin' | 'lecturer' | null

export default function SetupAccount() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const { tenant, slug, loading: tenantLoading } = useTenant()

  const role  = params.get('role') as SetupRole
  const token = params.get('token')

  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [fullName,   setFullName]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [verifying,  setVerifying]  = useState(false)
  const [lecturerId, setLecturerId] = useState<string | null>(null)
  const [errors,     setErrors]     = useState<Record<string, string>>({})

  // For lecturers: verify their token and pre-fill name/email
  useEffect(() => {
    if (role !== 'lecturer' || !token || !tenant || tenantLoading) return

    const verifyToken = async () => {
      setVerifying(true)
      const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
      const { data, error } = await db
        .from('lecturers')
        .select('id, full_name, email')
        .eq('invite_token', token)
        .eq('is_active', true)
        .maybeSingle()

      setVerifying(false)

      if (error || !data) {
        toast.error('Invalid or expired invitation link. Please contact your admin.')
        navigate('/login')
        return
      }

      setLecturerId(data.id)
      setFullName(data.full_name)
      setEmail(data.email)
    }

    verifyToken()
  }, [role, token, tenant, tenantLoading, slug, navigate])

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!email.trim())           e.email    = 'Email is required'
    if (!fullName.trim())        e.fullName = 'Full name is required'
    if (!password)               e.password = 'Password is required'
    else if (!isValidPassword(password)) e.password = 'Password must be at least 8 characters'
    if (password !== confirm)    e.confirm  = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSetup = async () => {
    if (!validate() || !tenant) return
    setLoading(true)

    const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)

    try {
      if (role === 'lecturer' && lecturerId) {
        // Lecturer: update their Supabase auth password via the magic link session
        // (Supabase sends a magic link in the invite email — by the time they land here
        //  they are already authenticated via that link)
        const { error: pwError } = await db.auth.updateUser({ password })
        if (pwError) {
          toast.error('Failed to set password. Your invitation link may have expired.')
          setLoading(false)
          return
        }

        // Get the user's UID from the current session
        const { data: { user } } = await db.auth.getUser()
        if (user) {
          await db.from('lecturers').update({
            supabase_uid:  user.id,
            invite_token:  null, // clear token so it can't be reused
          }).eq('id', lecturerId)
        }

        toast.success('Account activated! Welcome to GMIS.')
        navigate('/lecturer')

      } else if (role === 'admin') {
        // Admin first-time setup: they sign up with the email DAMS Tech registered
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    email.trim().toLowerCase(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role:      'admin',
            },
          },
        })

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            // Account exists — just sign in and update password
            const { error: signInError } = await db.auth.signInWithPassword({
              email:    email.trim().toLowerCase(),
              password,
            })
            if (signInError) {
              toast.error('Could not set up account. Please contact DAMS Tech support.')
              setLoading(false)
              return
            }
          } else {
            toast.error(signUpError.message)
            setLoading(false)
            return
          }
        }

        // Verify this email is in admin_users table
        const { data: adminRecord } = await db
          .from('admin_users')
          .select('id')
          .eq('email', email.trim().toLowerCase())
          .maybeSingle()

        if (!adminRecord) {
          toast.error('Your email is not registered as an admin for this institution. Contact DAMS Tech.')
          // Sign out the accidentally-created auth user
          await db.auth.signOut()
          setLoading(false)
          return
        }

        // Update admin_users with their supabase_uid
        const { data: { user } } = await db.auth.getUser()
        if (user) {
          await db.from('admin_users').update({ supabase_uid: user.id }).eq('id', adminRecord.id)
        }

        toast.success('Admin account activated!')
        navigate('/admin')
      } else {
        toast.error('Invalid setup link. Please contact your administrator.')
      }
    } catch (err) {
      console.error('Setup error:', err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (tenantLoading || verifying) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', color: '#7a8bbf' }}>
          <div style={S.spinner} />
          <p style={{ marginTop: 16, fontSize: 14 }}>
            {verifying ? 'Verifying your invitation...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  if (!role || (role !== 'admin' && role !== 'lecturer')) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
          <h2 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 20, color: '#e8eeff', marginBottom: 10 }}>Invalid setup link</h2>
          <p style={{ color: '#7a8bbf', marginBottom: 20 }}>This setup link is invalid or has expired. Please contact your administrator.</p>
          <button onClick={() => navigate('/login')} style={S.btnSecondary}>← Back to login</button>
        </div>
      </div>
    )
  }

  const isLecturer = role === 'lecturer'

  return (
    <div style={S.page}>
      <div style={S.orbTR} />
      <div style={S.orbBL} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative' }}>

        {/* School banner */}
        {tenant && (
          <div style={S.schoolBanner}>
            <div style={S.schoolLogo}>
              <span style={{ fontWeight: 900, fontSize: 13, color: '#fff' }}>
                {(tenant.name || slug || 'G').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{tenant.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{slug}.gmis.com</div>
            </div>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{isLecturer ? '👨‍🏫' : '⚙️'}</div>
          <h1 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 6 }}>
            {isLecturer ? 'Activate your lecturer account' : 'Set up your admin account'}
          </h1>
          <p style={{ fontSize: 13, color: '#7a8bbf', lineHeight: 1.6 }}>
            {isLecturer
              ? 'Welcome! Set your password to activate your GMIS lecturer account.'
              : 'Set your password to activate your GMIS admin account.'
            }
          </p>
        </div>

        <div style={S.card}>
          {/* Full name */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Full name *</label>
            <input
              style={{ ...S.input, ...(errors.fullName ? { borderColor: '#f87171' } : {}), ...(isLecturer ? { background: 'rgba(255,255,255,0.03)', cursor: 'not-allowed' } : {}) }}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Dr. Jane Smith"
              readOnly={isLecturer} // lecturer name is pre-filled from DB
            />
            {errors.fullName && <p style={S.err}>{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Email address *</label>
            <input
              style={{ ...S.input, ...(errors.email ? { borderColor: '#f87171' } : {}), ...(isLecturer ? { background: 'rgba(255,255,255,0.03)', cursor: 'not-allowed' } : {}) }}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@institution.edu"
              readOnly={isLecturer} // lecturer email is pre-filled from DB
            />
            {errors.email && <p style={S.err}>{errors.email}</p>}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Create password *</label>
            <input
              style={{ ...S.input, ...(errors.password ? { borderColor: '#f87171' } : {}) }}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
            {errors.password && <p style={S.err}>{errors.password}</p>}
          </div>

          {/* Confirm */}
          <div style={{ marginBottom: 20 }}>
            <label style={S.label}>Confirm password *</label>
            <input
              style={{ ...S.input, ...(errors.confirm ? { borderColor: '#f87171' } : {}) }}
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
            />
            {errors.confirm && <p style={S.err}>{errors.confirm}</p>}
          </div>

          {/* Info box */}
          <div style={{ padding: '10px 14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, marginBottom: 18, fontSize: 12, color: '#60a5fa', lineHeight: 1.6 }}>
            {isLecturer
              ? 'ℹ Once activated, sign in at the login page using your email and the password you set here.'
              : 'ℹ Once set up, sign in at the login page. Choose "Admin" on the role selector.'
            }
          </div>

          <button
            onClick={handleSetup}
            disabled={loading}
            style={{ ...S.btnPrimary, width: '100%', opacity: loading ? 0.75 : 1 }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={S.spinnerInline} /> Activating...
                </span>
              : `Activate ${isLecturer ? 'lecturer' : 'admin'} account`
            }
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#3d4f7a' }}>
          Already set up?{' '}
          <button onClick={() => navigate('/login')} style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Sign in →
          </button>
        </p>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#03071a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', overflow: 'hidden', fontFamily: "'DM Sans',system-ui,sans-serif" },
  orbTR:       { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(45,108,255,0.09) 0%,transparent 70%)', filter: 'blur(80px)', top: -150, right: -100, pointerEvents: 'none' },
  orbBL:       { position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(79,62,248,0.07) 0%,transparent 70%)', filter: 'blur(60px)', bottom: -80, left: -60, pointerEvents: 'none' },
  schoolBanner:{ background: 'linear-gradient(135deg,#1a3a8f,#0f2460)', borderRadius: 14, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 28px rgba(15,36,96,0.5)' },
  schoolLogo:  { width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card:        { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '26px 26px 22px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' },
  label:       { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:       { width: '100%', padding: '10px 13px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#e8eeff', fontFamily: "'DM Sans',system-ui,sans-serif", transition: 'all 0.2s' },
  err:         { margin: '4px 0 0', fontSize: 12, color: '#f87171' },
  btnPrimary:  { padding: '11px 22px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(45,108,255,0.35)', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSecondary:{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#7a8bbf', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif" },
  spinner:     { width: 28, height: 28, border: '2px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
  spinnerInline:{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
}