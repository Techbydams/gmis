// ============================================================
// GMIS — Student Settings
// estam.gmis.app/settings
//
// Tabs:
//   Profile    — update name, phone, address, profile photo URL
//   Security   — change password
//   Appearance — dark/light mode toggle
//   Account    — danger zone (read-only info, sign out)
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }   from '../../../context/AuthContext'
import { useTenant } from '../../../context/TenantContext'
import { useTheme }  from '../../../context/ThemeContext'
import { getTenantClient } from '../../../lib/supabase'
import { isValidPassword } from '../../../lib/helpers'
import toast from 'react-hot-toast'
import SidebarLayout from '../../../components/layout/SidebarLayout'

type Tab = 'profile' | 'security' | 'appearance' | 'account'

interface StudentProfile {
  id: string
  first_name: string
  last_name: string
  other_names: string
  phone: string
  address: string
  state_of_origin: string
  profile_photo: string
  matric_number: string
  email: string
  level: string
  status: string
  departments?: { name: string }
}

export default function StudentSettings() {
  const navigate              = useNavigate()
  const { user, signOut }     = useAuth()
  const { tenant, slug }      = useTenant()
  const { dark, toggleTheme } = useTheme()

  const [tab,      setTab]      = useState<Tab>('profile')
  const [profile,  setProfile]  = useState<StudentProfile | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  // Profile form fields
  const [firstName,   setFirstName]   = useState('')
  const [lastName,    setLastName]    = useState('')
  const [otherNames,  setOtherNames]  = useState('')
  const [phone,       setPhone]       = useState('')
  const [address,     setAddress]     = useState('')
  const [stateOrigin, setStateOrigin] = useState('')
  const [photoUrl,    setPhotoUrl]    = useState('')

  // Security form fields
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [pwErrors,   setPwErrors]   = useState<Record<string, string>>({})
  const [changingPw, setChangingPw] = useState(false)

  const db = tenant ? getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!) : null

  // ── LOAD PROFILE ─────────────────────────────────────────
  useEffect(() => {
    if (db && user) loadProfile()
  }, [db, user])

  const loadProfile = async () => {
    if (!db || !user) return
    setLoading(true)
    try {
      const { data, error } = await db
        .from('students')
        .select('*, departments(name)')
        .eq('supabase_uid', user.id)
        .maybeSingle()

      if (error || !data) return

      const p = data as StudentProfile
      setProfile(p)
      setFirstName(p.first_name   || '')
      setLastName(p.last_name     || '')
      setOtherNames(p.other_names || '')
      setPhone(p.phone            || '')
      setAddress(p.address        || '')
      setStateOrigin(p.state_of_origin || '')
      setPhotoUrl(p.profile_photo || '')
    } finally {
      setLoading(false)
    }
  }

  // ── SAVE PROFILE ─────────────────────────────────────────
  const saveProfile = async () => {
    if (!db || !profile) return
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and last name are required.')
      return
    }

    setSaving(true)
    try {
      const { error } = await db
        .from('students')
        .update({
          first_name:      firstName.trim(),
          last_name:       lastName.trim(),
          other_names:     otherNames.trim() || null,
          phone:           phone.trim()      || null,
          address:         address.trim()    || null,
          state_of_origin: stateOrigin.trim()|| null,
          profile_photo:   photoUrl.trim()   || null,
        } as any)
        .eq('id', profile.id)

      if (error) {
        toast.error('Could not save changes. Please try again.')
        return
      }

      toast.success('Profile updated!')
      await loadProfile()
    } finally {
      setSaving(false)
    }
  }

  // ── CHANGE PASSWORD ───────────────────────────────────────
  const changePassword = async () => {
    if (!db) return
    const errs: Record<string, string> = {}

    if (!currentPw)                 errs.currentPw = 'Current password is required'
    if (!newPw)                     errs.newPw     = 'New password is required'
    else if (!isValidPassword(newPw)) errs.newPw   = 'Password must be at least 8 characters'
    if (newPw !== confirmPw)         errs.confirmPw = 'Passwords do not match'
    if (newPw === currentPw)         errs.newPw    = 'New password must be different from current'

    setPwErrors(errs)
    if (Object.keys(errs).length) return

    setChangingPw(true)
    try {
      // First verify current password by re-signing in
      const { error: signInError } = await db.auth.signInWithPassword({
        email:    user!.email,
        password: currentPw,
      })

      if (signInError) {
        setPwErrors({ currentPw: 'Current password is incorrect' })
        return
      }

      // Update password
      const { error: updateError } = await db.auth.updateUser({ password: newPw })

      if (updateError) {
        toast.error('Could not update password. Please try again.')
        return
      }

      toast.success('Password changed successfully!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwErrors({})
    } finally {
      setChangingPw(false)
    }
  }

  // ── SIGN OUT ─────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // ── INITIALS ─────────────────────────────────────────────
  const initials = profile
    ? `${profile.first_name[0] || ''}${profile.last_name[0] || ''}`.toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?'

  // ── RENDER ────────────────────────────────────────────────
  return (
    <SidebarLayout active="settings">
      <div style={{ maxWidth: 640, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={S.title}>Settings</h1>
          <p style={S.sub}>Manage your account and preferences</p>
        </div>

        {/* Profile card */}
        {profile && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '16px 20px',
            background: 'linear-gradient(135deg,rgba(45,108,255,0.1),rgba(79,62,248,0.06))',
            border: '1px solid rgba(45,108,255,0.2)',
            borderRadius: 18, marginBottom: 20,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 18, color: '#fff',
              flexShrink: 0, overflow: 'hidden',
            }}>
              {profile.profile_photo
                ? <img src={profile.profile_photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : initials
              }
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#e8eeff' }}>
                {profile.first_name} {profile.last_name}
              </div>
              <div style={{ fontSize: 12, color: '#7a8bbf', marginTop: 2 }}>
                {profile.matric_number}
                {profile.departments?.name && ` · ${profile.departments.name}`}
                {profile.level && ` · ${profile.level} Level`}
              </div>
              <div style={{ fontSize: 12, color: '#3d4f7a', marginTop: 2 }}>
                {user?.email}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: profile.status === 'active' ? 'rgba(74,222,128,.15)' : 'rgba(251,191,36,.15)',
                color: profile.status === 'active' ? '#4ade80' : '#fbbf24',
                padding: '3px 10px', borderRadius: 100,
              }}>
                {profile.status}
              </span>
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            ['profile',    '👤 Profile'],
            ['security',   '🔒 Security'],
            ['appearance', '🎨 Appearance'],
            ['account',    '⚙️ Account'],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '8px 16px',
                borderRadius: 10, fontSize: 13, fontWeight: tab === id ? 700 : 400,
                cursor: 'pointer', fontFamily: "'DM Sans',system-ui",
                transition: 'all .2s',
                background: tab === id ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.04)',
                color: tab === id ? '#fff' : '#7a8bbf',
                border: tab === id ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Personal information</h3>
            <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 20 }}>
              Update your display name, contact info, and profile photo.
            </p>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                <div style={S.spin} />
              </div>
            ) : (
              <>
                {/* Name row */}
                <div style={S.grid2}>
                  <div>
                    <label style={S.label}>First name *</label>
                    <input
                      style={S.input}
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label style={S.label}>Last name *</label>
                    <input
                      style={S.input}
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                {/* Other names */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Other names</label>
                  <input
                    style={S.input}
                    value={otherNames}
                    onChange={e => setOtherNames(e.target.value)}
                    placeholder="Middle name(s), optional"
                  />
                </div>

                {/* Phone */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Phone number</label>
                  <input
                    style={S.input}
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+234 800 000 0000"
                  />
                </div>

                {/* Address */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>Home address</label>
                  <input
                    style={S.input}
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Your home address"
                  />
                </div>

                {/* State of origin */}
                <div style={{ marginBottom: 14 }}>
                  <label style={S.label}>State of origin</label>
                  <input
                    style={S.input}
                    value={stateOrigin}
                    onChange={e => setStateOrigin(e.target.value)}
                    placeholder="e.g. Lagos"
                  />
                </div>

                {/* Profile photo URL */}
                <div style={{ marginBottom: 20 }}>
                  <label style={S.label}>Profile photo URL</label>
                  <input
                    style={S.input}
                    type="url"
                    value={photoUrl}
                    onChange={e => setPhotoUrl(e.target.value)}
                    placeholder="https://example.com/your-photo.jpg"
                  />
                  <p style={{ fontSize: 11, color: '#3d4f7a', marginTop: 5 }}>
                    Paste a direct image URL. Upload your photo to a service like Imgur or Cloudinary first.
                  </p>
                </div>

                {/* Read-only info */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#3d4f7a', marginBottom: 10 }}>
                    Read-only (contact admin to change)
                  </div>
                  {[
                    ['Matric number',  profile?.matric_number || '—'],
                    ['Email',          user?.email            || '—'],
                    ['Department',     profile?.departments?.name || '—'],
                    ['Level',          profile?.level ? `${profile.level} Level` : '—'],
                  ].map(([l, v]) => (
                    <div key={l} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
                      fontSize: 13,
                    }}>
                      <span style={{ color: '#7a8bbf' }}>{l}</span>
                      <span style={{ color: '#e8eeff', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  style={{ ...S.btnPrimary, opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── SECURITY TAB ── */}
        {tab === 'security' && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Change password</h3>
            <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 20 }}>
              Choose a strong password. Minimum 8 characters.
            </p>

            {/* Current password */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>Current password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...S.input, paddingRight: 44, borderColor: pwErrors.currentPw ? '#f87171' : undefined }}
                  type={showPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => { setCurrentPw(e.target.value); setPwErrors(p => ({ ...p, currentPw: '' })) }}
                  placeholder="Your current password"
                  autoComplete="current-password"
                />
                <button
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#3d4f7a', fontSize: 16 }}
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
              {pwErrors.currentPw && <p style={S.err}>{pwErrors.currentPw}</p>}
            </div>

            {/* New password */}
            <div style={{ marginBottom: 14 }}>
              <label style={S.label}>New password *</label>
              <input
                style={{ ...S.input, borderColor: pwErrors.newPw ? '#f87171' : undefined }}
                type={showPw ? 'text' : 'password'}
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setPwErrors(p => ({ ...p, newPw: '' })) }}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              {pwErrors.newPw && <p style={S.err}>{pwErrors.newPw}</p>}
              {/* Strength indicator */}
              {newPw && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{
                      height: 3, flex: 1, borderRadius: 2,
                      background: newPw.length > [0,6,10,14][i]
                        ? ['#f87171','#fbbf24','#60a5fa','#4ade80'][i]
                        : 'rgba(255,255,255,0.1)',
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div style={{ marginBottom: 24 }}>
              <label style={S.label}>Confirm new password *</label>
              <input
                style={{ ...S.input, borderColor: pwErrors.confirmPw ? '#f87171' : undefined }}
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setPwErrors(p => ({ ...p, confirmPw: '' })) }}
                placeholder="Repeat new password"
                autoComplete="new-password"
              />
              {pwErrors.confirmPw && <p style={S.err}>{pwErrors.confirmPw}</p>}
              {confirmPw && newPw && confirmPw === newPw && (
                <p style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>✓ Passwords match</p>
              )}
            </div>

            <button
              onClick={changePassword}
              disabled={changingPw}
              style={{ ...S.btnPrimary, opacity: changingPw ? 0.7 : 1 }}
            >
              {changingPw ? 'Updating...' : 'Update password'}
            </button>

            {/* Security tips */}
            <div style={{
              marginTop: 20, padding: '12px 16px',
              background: 'rgba(96,165,250,0.06)',
              border: '1px solid rgba(96,165,250,0.2)',
              borderRadius: 12, fontSize: 12, color: '#60a5fa', lineHeight: 1.7,
            }}>
              💡 Use a combination of uppercase, lowercase, numbers and symbols for a stronger password.
              Never share your password with anyone, including school staff.
            </div>
          </div>
        )}

        {/* ── APPEARANCE TAB ── */}
        {tab === 'appearance' && (
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Appearance</h3>
            <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 24 }}>
              Customize how GMIS looks for you.
            </p>

            {/* Theme toggle */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, marginBottom: 12,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#e8eeff', marginBottom: 3 }}>
                  {dark ? '🌙 Dark mode' : '☀️ Light mode'}
                </div>
                <div style={{ fontSize: 12, color: '#7a8bbf' }}>
                  {dark ? 'Currently using dark theme' : 'Currently using light theme'}
                </div>
              </div>
              {/* Toggle switch */}
              <div
                onClick={toggleTheme}
                style={{
                  width: 48, height: 26, borderRadius: 13,
                  background: dark ? 'linear-gradient(135deg,#2d6cff,#4f3ef8)' : 'rgba(255,255,255,0.2)',
                  position: 'relative', cursor: 'pointer',
                  transition: 'background .3s',
                  boxShadow: dark ? '0 0 12px rgba(45,108,255,.4)' : 'none',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 20, height: 20, background: '#fff',
                  borderRadius: '50%', position: 'absolute',
                  top: 3, left: dark ? 25 : 3,
                  transition: 'left .25s',
                  boxShadow: '0 2px 6px rgba(0,0,0,.25)',
                }} />
              </div>
            </div>

            {/* Theme previews */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { id: 'dark', label: 'Dark', bg: '#03071a', fg: '#e8eeff', accent: '#2d6cff' },
                { id: 'light', label: 'Light', bg: '#f8faff', fg: '#1e293b', accent: '#2d6cff' },
              ].map(theme => (
                <div
                  key={theme.id}
                  onClick={() => {
                    if ((theme.id === 'dark') !== dark) toggleTheme()
                  }}
                  style={{
                    padding: 14, borderRadius: 14, cursor: 'pointer',
                    border: `2px solid ${(theme.id === 'dark') === dark ? '#2d6cff' : 'rgba(255,255,255,0.08)'}`,
                    background: `${theme.bg}`,
                    transition: 'border-color .2s',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f87171' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
                  </div>
                  <div style={{ height: 4, background: theme.accent, borderRadius: 2, marginBottom: 4, width: '60%' }} />
                  <div style={{ height: 3, background: `${theme.fg}30`, borderRadius: 2, marginBottom: 3, width: '80%' }} />
                  <div style={{ height: 3, background: `${theme.fg}30`, borderRadius: 2, width: '50%' }} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.fg, marginTop: 8 }}>
                    {theme.label}
                    {(theme.id === 'dark') === dark && (
                      <span style={{ marginLeft: 6, color: theme.accent }}>✓ Active</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              padding: '12px 16px',
              background: 'rgba(74,222,128,0.06)',
              border: '1px solid rgba(74,222,128,0.2)',
              borderRadius: 12, fontSize: 12, color: '#4ade80',
            }}>
              ✓ Theme preference is saved automatically and persists across sessions.
            </div>
          </div>
        )}

        {/* ── ACCOUNT TAB ── */}
        {tab === 'account' && (
          <>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>Account information</h3>

              {[
                ['Email address',  user?.email || '—', false],
                ['Role',           'Student',           false],
                ['Institution',    tenant?.name || '—', false],
                ['Portal',         `${slug}.gmis.app`,  false],
              ].map(([l, v]) => (
                <div key={l as string} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 13,
                }}>
                  <span style={{ color: '#7a8bbf' }}>{l as string}</span>
                  <span style={{ color: '#e8eeff', fontWeight: 500 }}>{v as string}</span>
                </div>
              ))}
            </div>

            {/* Sign out */}
            <div style={S.card}>
              <h3 style={{ ...S.sectionTitle, marginBottom: 8 }}>Sign out</h3>
              <p style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 16 }}>
                You will be signed out of your {tenant?.name} portal session.
              </p>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '10px 22px',
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 11, color: '#f87171',
                  fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',system-ui",
                }}
              >
                Sign out of portal
              </button>
            </div>

            {/* Danger zone */}
            <div style={{
              ...S.card,
              border: '1px solid rgba(248,113,113,0.2)',
              background: 'rgba(248,113,113,0.04)',
            }}>
              <h3 style={{ ...S.sectionTitle, color: '#f87171', marginBottom: 8 }}>
                Need to make changes to your academic record?
              </h3>
              <p style={{ fontSize: 13, color: '#7a8bbf', lineHeight: 1.7 }}>
                Changes to your matric number, department, level, or email must be requested through your school's registrar office. Contact your admin or visit the registrar's office in person.
              </p>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus {
          outline: none !important;
          border-color: #2d6cff !important;
          box-shadow: 0 0 0 3px rgba(45,108,255,0.15) !important;
        }
      `}</style>
    </SidebarLayout>
  )
}

// ── STYLES ────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  title:        { fontFamily: "'Syne',system-ui", fontWeight: 800, fontSize: 22, color: '#e8eeff', marginBottom: 4 },
  sub:          { fontSize: 13, color: '#7a8bbf' },
  card:         { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '22px 24px', marginBottom: 16 },
  sectionTitle: { fontFamily: "'Syne',system-ui", fontWeight: 700, fontSize: 16, color: '#e8eeff', marginBottom: 4 },
  label:        { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:        {
    width: '100%', padding: '10px 13px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 11, fontSize: 13,
    background: 'rgba(255,255,255,0.05)',
    color: '#e8eeff', outline: 'none',
    fontFamily: "'DM Sans',system-ui",
    transition: 'border-color .2s, box-shadow .2s',
  },
  grid2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
  err:          { margin: '4px 0 0', fontSize: 12, color: '#f87171' },
  btnPrimary:   {
    padding: '10px 24px',
    background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
    color: '#fff', border: 'none', borderRadius: 11,
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'DM Sans',system-ui",
    boxShadow: '0 4px 16px rgba(45,108,255,0.3)',
  },
  spin:         { width: 28, height: 28, border: '2px solid rgba(45,108,255,0.2)', borderTopColor: '#2d6cff', borderRadius: '50%', animation: 'spin .8s linear infinite' },
}