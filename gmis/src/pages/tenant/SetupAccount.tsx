// ============================================================
// GMIS — Account Setup Page
// Handles two flows:
//   1. /setup?role=admin    — First-time admin account creation
//   2. /setup?role=lecturer — Lecturer self-activates by email lookup
//
// Lecturer flow: admin adds them in the dashboard, lecturer comes
// here, types their email — system finds their record and creates
// their Supabase auth account. No tokens or edge functions needed.
// ============================================================

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext'
import { getTenantClient } from '../../lib/supabase'
import { isValidPassword } from '../../lib/helpers'
import toast from 'react-hot-toast'

type SetupRole = 'admin' | 'lecturer' | 'parent' | null

export default function SetupAccount() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const { tenant, slug, loading: tenantLoading } = useTenant()

  const role = params.get('role') as SetupRole

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [fullName, setFullName] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [errors,   setErrors]   = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!email.trim())                   e.email    = 'Email is required'
    if (!fullName.trim())                e.fullName = 'Full name is required'
    if (!password)                       e.password = 'Password is required'
    else if (!isValidPassword(password)) e.password = 'Password must be at least 8 characters'
    if (password !== confirm)            e.confirm  = 'Passwords do not match'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSetup = async () => {
    if (!validate() || !tenant) return
    setLoading(true)

    const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
    const cleanEmail = email.trim().toLowerCase()

    try {
      if (role === 'lecturer') {
        // Step 1: Check the lecturer exists in the DB (admin must have added them first)
        const { data: lecturer, error: lookupError } = await db
          .from('lecturers')
          .select('id, full_name, supabase_uid')
          .eq('email', cleanEmail)
          .eq('is_active', true)
          .maybeSingle()

        if (lookupError || !lecturer) {
          toast.error('Your email is not registered as a lecturer. Ask your admin to add you first.')
          setLoading(false)
          return
        }

        if (lecturer.supabase_uid) {
          toast.error('This lecturer account is already activated. Use the login page.')
          setLoading(false)
          return
        }

        // Step 2: Create Supabase auth account
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    cleanEmail,
          password,
          options: { data: { full_name: fullName.trim(), role: 'lecturer' } },
        })

        if (signUpError) {
          toast.error(signUpError.message)
          setLoading(false)
          return
        }

        // Step 3: Link the auth UID to the lecturers table
        if (authData?.user?.id) {
          await db.from('lecturers').update({
            supabase_uid: authData.user.id,
            full_name:    fullName.trim(), // allow them to correct their name
          }).eq('id', lecturer.id)
        }

        toast.success('Account activated! You can now sign in.')
        navigate('/login')

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

      } else if (role === 'parent') {
        // Step 1: Check parent_email exists in at least one student record
        const { data: children, error: lookupErr } = await db
          .from('students')
          .select('id, first_name, last_name')
          .eq('parent_email', cleanEmail)
          .eq('status', 'active')

        if (lookupErr || !children || children.length === 0) {
          toast.error('No active students found with this parent email. Contact your child\'s school admin.')
          setLoading(false)
          return
        }

        // Step 2: Create Supabase auth account
        const { data: authData, error: signUpError } = await db.auth.signUp({
          email:    cleanEmail,
          password,
          options: { data: { full_name: fullName.trim(), role: 'parent' } },
        })

        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered')) {
            toast.error('An account with this email already exists. Please use the login page.')
          } else {
            toast.error(signUpError.message)
          }
          setLoading(false)
          return
        }

        // Step 3: Link parent_supabase_uid to all matching student records
        if (authData?.user?.id) {
          await db
            .from('students')
            .update({ parent_supabase_uid: authData.user.id } as any)
            .eq('parent_email', cleanEmail)
        }

        toast.success(`Account activated! You can monitor ${children.length > 1 ? `${children.length} children` : children[0].first_name}.`)
        navigate('/parent')

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

  if (tenantLoading) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', color: '#7a8bbf' }}>
          <div style={S.spinner} />
          <p style={{ marginTop: 16, fontSize: 14 }}>Loading...</p>
        </div>
      </div>
    )
  }

  if (!role || !['admin', 'lecturer', 'parent'].includes(role)) {
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
  const isParent   = role === 'parent'

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
          <div style={{ fontSize: 40, marginBottom: 12 }}>{isLecturer ? '👨‍🏫' : isParent ? '👨‍👩‍👧' : '⚙️'}</div>
          <h1 style={{ fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 6 }}>
            {isLecturer ? 'Activate your lecturer account' : isParent ? 'Set up your parent account' : 'Set up your admin account'}
          </h1>
          <p style={{ fontSize: 13, color: '#7a8bbf', lineHeight: 1.6 }}>
            {isLecturer
              ? 'Enter the email your admin registered for you, then set your password.'
              : isParent
              ? 'Enter the email you used during your child\'s registration, then set your password.'
              : 'Set your password to activate your GMIS admin account.'
            }
          </p>
        </div>

        <div style={S.card}>
          {/* Full name */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Full name *</label>
            <input
              style={{ ...S.input, ...(errors.fullName ? { borderColor: '#f87171' } : {}) }}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Dr. Jane Smith"
            />
            {errors.fullName && <p style={S.err}>{errors.fullName}</p>}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={S.label}>Email address *</label>
            <input
              style={{ ...S.input, ...(errors.email ? { borderColor: '#f87171' } : {}) }}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@institution.edu"
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
              ? 'ℹ Enter the exact email your admin used when adding you. You can correct your display name above.'
              : isParent
              ? 'ℹ Enter the exact email you provided during your child\'s school registration. Once set up, sign in at the login page.'
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
              : `Activate ${isLecturer ? 'lecturer' : isParent ? 'parent' : 'admin'} account`
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