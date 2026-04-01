// ============================================================
// GMIS — Student Signup
// FIXED:
//   - 401 error: departments now load only AFTER tenant is confirmed
//     ready and getTenantClient() receives valid credentials
//   - Added null guard — if tenant is null the form shows a clear
//     "loading" state instead of firing a bad Supabase request
//   - Department join typed correctly
//   - Matric input auto-uppercases on change
// ============================================================

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTenant } from '../../context/TenantContext'
import { getTenantClient } from '../../lib/supabase'
import { isValidEmail, isValidMatric, isValidPassword } from '../../lib/helpers'
import toast from 'react-hot-toast'

interface Department {
  id:       string
  name:     string
  code:     string
  faculties: { name: string } | null   // typed correctly — single object, not array
}

interface FormData {
  matric_number:    string
  email:            string
  password:         string
  confirm_password: string
  first_name:       string
  last_name:        string
  date_of_birth:    string
  gender:           string
  department_id:    string
  level:            string
  phone:            string
  parent_email:     string
}

type Errors = Partial<Record<keyof FormData, string>>

const INIT: FormData = {
  matric_number: '', email: '', password: '', confirm_password: '',
  first_name: '', last_name: '', date_of_birth: '', gender: 'male',
  department_id: '', level: '', phone: '', parent_email: '',
}

const STEPS = ['Account', 'Personal details', 'Done']

export default function StudentSignup() {
  const navigate         = useNavigate()
  const { tenant, slug, loading: tenantLoading } = useTenant()

  const [step,         setStep]         = useState(1)
  const [form,         setForm]         = useState<FormData>(INIT)
  const [errors,       setErrors]       = useState<Errors>({})
  const [loading,      setLoading]      = useState(false)
  const [departments,  setDepartments]  = useState<Department[]>([])
  const [loadingDepts, setLoadingDepts] = useState(false)
  const [deptsError,   setDeptsError]   = useState<string | null>(null)

  // ── LOAD DEPARTMENTS ─────────────────────────────────────
  // FIXED: Only runs when tenant is confirmed non-null AND has valid credentials.
  // Previously it fired immediately on mount while tenant was still null,
  // which caused getTenantClient() to fall back to the master DB — giving 401.
  useEffect(() => {
    // Don't do anything until TenantContext has finished loading
    if (tenantLoading) return

    // If tenant is still null after loading, the slug is wrong — nothing to query
    if (!tenant || !slug) return

    // Validate we have the credentials before making the call
    if (!tenant.supabase_url || !tenant.supabase_anon_key) {
      setDeptsError('School database not configured. Contact your administrator.')
      return
    }

    const fetchDepts = async () => {
      setLoadingDepts(true)
      setDeptsError(null)

      try {
        // Create the tenant-specific client with the school's own credentials
        const db = getTenantClient(
          tenant.supabase_url,
          tenant.supabase_anon_key,
          slug,
        )

        const { data, error } = await db
          .from('departments')
          .select('id, name, code, faculties(name)')
          .eq('is_active', true)
          .order('name')

        if (error) {
          console.error('Department load error:', error)
          if (error.code === '401' || error.message?.includes('401') || error.message?.includes('JWT')) {
            setDeptsError('Authentication failed. Please contact your school administrator to verify the portal setup.')
          } else if (error.code === 'PGRST116') {
            // Table doesn't exist yet
            setDeptsError('Departments table not set up yet. Contact your administrator.')
          } else {
            setDeptsError('Could not load departments. Please refresh the page.')
          }
          return
        }

        setDepartments((data || []) as Department[])
      } catch (err) {
        console.error('Department fetch exception:', err)
        setDeptsError('Network error loading departments. Please check your connection.')
      } finally {
        setLoadingDepts(false)
      }
    }

    fetchDepts()
  }, [tenant, slug, tenantLoading]) // depends on tenant being ready

  const set = (field: keyof FormData, value: string) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
  }

  // ── VALIDATION ──────────────────────────────────────────
  const validate = (s: number): boolean => {
    const e: Errors = {}

    if (s === 1) {
      if (!form.matric_number.trim())
        e.matric_number = 'Matric/student number is required'
      else if (!isValidMatric(form.matric_number))
        e.matric_number = 'Enter a valid student number'

      if (!form.email.trim())
        e.email = 'Email address is required'
      else if (!isValidEmail(form.email))
        e.email = 'Enter a valid email address'

      if (!form.password)
        e.password = 'Password is required'
      else if (!isValidPassword(form.password))
        e.password = 'Password must be at least 8 characters'

      if (form.password !== form.confirm_password)
        e.confirm_password = 'Passwords do not match'
    }

    if (s === 2) {
      if (!form.first_name.trim())  e.first_name    = 'First name is required'
      if (!form.last_name.trim())   e.last_name     = 'Last name is required'
      if (!form.department_id)      e.department_id = 'Please select your department'
      if (!form.level)              e.level         = 'Please select your year/level'
      if (form.parent_email && !isValidEmail(form.parent_email))
        e.parent_email = 'Enter a valid parent/guardian email'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => { if (validate(step)) setStep(s => s + 1) }

  // ── SUBMIT ──────────────────────────────────────────────
  const submit = async () => {
    if (!validate(2)) return
    if (!tenant) { toast.error('School portal not loaded. Please refresh.'); return }

    setLoading(true)
    const db = getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)

    try {
      // 1 — Check matric number not already taken
      const { data: existingMatric } = await db
        .from('students').select('id')
        .eq('matric_number', form.matric_number.trim().toUpperCase())
        .maybeSingle()

      if (existingMatric) {
        setErrors({ matric_number: 'This student number is already registered. Try logging in.' })
        setStep(1); return
      }

      // 2 — Check email not already taken
      const { data: existingEmail } = await db
        .from('students').select('id')
        .eq('email', form.email.trim().toLowerCase())
        .maybeSingle()

      if (existingEmail) {
        setErrors({ email: 'This email is already registered. Try logging in.' })
        setStep(1); return
      }

      // 3 — Create Supabase Auth account
      const { data: authData, error: authError } = await db.auth.signUp({
        email:    form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            full_name:     `${form.first_name.trim()} ${form.last_name.trim()}`,
            matric_number: form.matric_number.trim().toUpperCase(),
            role:          'student',
          },
        },
      })

      if (authError) {
        toast.error(
          authError.message.includes('already registered')
            ? 'This email already has an account. Try logging in.'
            : authError.message,
        )
        return
      }

      // 4 — Insert student record (pending admin approval)
      const { error: studentError } = await db.from('students').insert({
        supabase_uid:    authData.user?.id || null,
        matric_number:   form.matric_number.trim().toUpperCase(),
        email:           form.email.trim().toLowerCase(),
        email_verified:  false,
        first_name:      form.first_name.trim(),
        last_name:       form.last_name.trim(),
        gender:          form.gender,
        date_of_birth:   form.date_of_birth || null,
        phone:           form.phone.trim() || null,
        department_id:   form.department_id || null,
        level:           form.level,
        current_session: '2024/2025',
        status:          'pending',
        gpa:  0, cgpa: 0,
        id_card_printed: false, id_card_paid: false,
        parent_email:    form.parent_email.trim() || null,
      })

      if (studentError) {
        console.error('Student insert error:', studentError)
        toast.error('Registration failed. Please try again.')
        return
      }

      // 5 — Done!
      setStep(3)

    } catch (err) {
      console.error(err)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── TENANT STILL LOADING ─────────────────────────────────
  if (tenantLoading) {
    return (
      <div style={{ ...S.page }}>
        <div style={{ textAlign: 'center', color: '#7a8bbf' }}>
          <div style={S.spinner} />
          <p style={{ marginTop: 16, fontSize: 14 }}>Loading school portal...</p>
        </div>
      </div>
    )
  }

  // ── SUCCESS SCREEN ──────────────────────────────────────
  if (step === 3) {
    const selectedDept = departments.find(d => d.id === form.department_id)
    return (
      <div style={S.page}>
        <div style={S.orbTR} /><div style={S.orbBL} />
        <div style={{ ...S.card, maxWidth: 500, textAlign: 'center', padding: '48px 36px' }}>
          <div style={{ fontSize: 72, marginBottom: 18, animation: 'float 3s ease-in-out infinite' }}>🎉</div>
          <h1 style={{ ...S.heading, fontSize: 24, marginBottom: 12 }}>Application submitted!</h1>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 18px', marginBottom: 18, textAlign: 'left' }}>
            {[
              ['Student no.',  form.matric_number.toUpperCase()],
              ['Name',         `${form.first_name} ${form.last_name}`],
              ['Department',   selectedDept?.name || '—'],
              ['Level',        `Year ${form.level}`],
              ['Email',        form.email],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
                <span style={{ color: '#7a8bbf' }}>{label}</span>
                <span style={{ color: '#e8eeff', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ ...S.muted, lineHeight: 1.8, marginBottom: 10, fontSize: 13 }}>
            Your registration is <strong style={{ color: '#fbbf24' }}>pending admin approval</strong> at{' '}
            <strong style={{ color: '#e8eeff' }}>{tenant?.name}</strong>.
            You'll receive an email at <strong style={{ color: '#60a5fa' }}>{form.email}</strong> once activated.
          </p>
          {form.parent_email && (
            <p style={{ ...S.muted, lineHeight: 1.8, marginBottom: 20, fontSize: 12 }}>
              Your parent/guardian (<strong style={{ color: '#60a5fa' }}>{form.parent_email}</strong>) will also receive an invitation.
            </p>
          )}
          <button style={S.btnPrimary} onClick={() => navigate('/login')}>← Return to login</button>
        </div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}`}</style>
      </div>
    )
  }

  // ── MAIN FORM ────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.orbTR} /><div style={S.orbBL} /><div style={S.grid} />

      <div style={{ width: '100%', maxWidth: 520, position: 'relative' }}>

        {/* School banner */}
        <div style={S.schoolBanner}>
          <div style={S.schoolLogo}>
            <span style={{ fontWeight: 900, fontSize: 13, color: '#fff' }}>
              {(tenant?.name || slug || 'G').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>
              {tenant?.name}
              <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 12, marginLeft: 6 }}>
                · {slug}.gmis.app
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate('/find')}
            style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
          >← Change</button>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ ...S.heading, fontSize: 22, marginBottom: 4 }}>Create student account</h1>
          <p style={S.muted}>Admin approval required before portal access is granted</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', marginBottom: 22 }}>
          {STEPS.map((st, i) => (
            <div key={st} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `2px solid ${i + 1 <= step ? '#2d6cff' : 'rgba(255,255,255,0.1)'}`,
                background: i + 1 < step ? '#2d6cff' : i + 1 === step ? 'rgba(45,108,255,0.15)' : 'transparent',
                color: i + 1 < step ? '#fff' : i + 1 === step ? '#60a5fa' : '#3d4f7a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px', fontSize: 11, fontWeight: 700, transition: 'all .3s',
              }}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i + 1 === step ? '#60a5fa' : '#3d4f7a', fontWeight: i + 1 === step ? 600 : 400 }}>
                {st}
              </div>
            </div>
          ))}
        </div>

        <div style={S.card}>

          {/* ── STEP 1: Account ── */}
          {step === 1 && (
            <>
              <h2 style={S.stepTitle}>Account information</h2>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Student / Matric number *</label>
                <input
                  style={{ ...S.input, ...(errors.matric_number ? { borderColor: '#f87171' } : {}) }}
                  value={form.matric_number}
                  onChange={e => set('matric_number', e.target.value.toUpperCase())}
                  placeholder="e.g. STU/2024/001"
                  autoComplete="username"
                />
                {errors.matric_number && <p style={S.err}>{errors.matric_number}</p>}
                <p style={S.hint}>From your admission letter. Contact your registrar if unsure.</p>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Email address *</label>
                <input
                  style={{ ...S.input, ...(errors.email ? { borderColor: '#f87171' } : {}) }}
                  type="email" value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
                {errors.email && <p style={S.err}>{errors.email}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>Password *</label>
                  <input
                    style={{ ...S.input, ...(errors.password ? { borderColor: '#f87171' } : {}) }}
                    type="password" value={form.password}
                    onChange={e => set('password', e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  {errors.password && <p style={S.err}>{errors.password}</p>}
                </div>
                <div>
                  <label style={S.label}>Confirm password *</label>
                  <input
                    style={{ ...S.input, ...(errors.confirm_password ? { borderColor: '#f87171' } : {}) }}
                    type="password" value={form.confirm_password}
                    onChange={e => set('confirm_password', e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                  />
                  {errors.confirm_password && <p style={S.err}>{errors.confirm_password}</p>}
                </div>
              </div>

              <div style={S.infoBox}>
                <p style={{ margin: 0, fontSize: 12, color: '#60a5fa', lineHeight: 1.7 }}>
                  ℹ Your student number verifies your identity. It must match exactly what's on your admission letter.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
                <button onClick={() => navigate('/login')} style={S.btnSecondary}>← Back to login</button>
                <button style={S.btnPrimary} onClick={nextStep}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 2: Personal details ── */}
          {step === 2 && (
            <>
              <h2 style={S.stepTitle}>Personal details</h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>First name *</label>
                  <input style={{ ...S.input, ...(errors.first_name ? { borderColor: '#f87171' } : {}) }} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
                  {errors.first_name && <p style={S.err}>{errors.first_name}</p>}
                </div>
                <div>
                  <label style={S.label}>Last name *</label>
                  <input style={{ ...S.input, ...(errors.last_name ? { borderColor: '#f87171' } : {}) }} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
                  {errors.last_name && <p style={S.err}>{errors.last_name}</p>}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Date of birth</label>
                <input style={S.input} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={S.label}>Gender</label>
                  <select style={S.input} value={form.gender} onChange={e => set('gender', e.target.value)}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label style={S.label}>Year / Level *</label>
                  <select style={{ ...S.input, ...(errors.level ? { borderColor: '#f87171' } : {}) }} value={form.level} onChange={e => set('level', e.target.value)}>
                    <option value="">-- Select year --</option>
                    {['100', '200', '300', '400', '500', '600'].map(l => (
                      <option key={l} value={l}>Year {l.slice(0, 1)} ({l} Level)</option>
                    ))}
                  </select>
                  {errors.level && <p style={S.err}>{errors.level}</p>}
                </div>
              </div>

              {/* Department dropdown — data from tenant DB */}
              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Department / Programme *</label>

                {/* Show error if departments failed to load */}
                {deptsError && (
                  <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 10, marginBottom: 8, fontSize: 12, color: '#f87171' }}>
                    ⚠ {deptsError}
                  </div>
                )}

                <select
                  style={{
                    ...S.input,
                    ...(errors.department_id ? { borderColor: '#f87171' } : {}),
                    cursor: loadingDepts ? 'wait' : 'pointer',
                    opacity: loadingDepts ? 0.7 : 1,
                  }}
                  value={form.department_id}
                  onChange={e => set('department_id', e.target.value)}
                  disabled={loadingDepts || !!deptsError}
                >
                  {loadingDepts
                    ? <option>Loading departments...</option>
                    : deptsError
                    ? <option>Cannot load departments — see error above</option>
                    : (
                      <>
                        <option value="">-- Select your department --</option>
                        {departments.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name}{d.faculties?.name ? ` — ${d.faculties.name}` : ''}
                          </option>
                        ))}
                      </>
                    )
                  }
                </select>
                {errors.department_id && <p style={S.err}>{errors.department_id}</p>}
                {!loadingDepts && !deptsError && departments.length === 0 && (
                  <p style={S.hint}>No departments found. Contact your school admin to set up departments first.</p>
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Phone number</label>
                <input style={S.input} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={S.label}>Parent / Guardian email</label>
                <input
                  style={{ ...S.input, ...(errors.parent_email ? { borderColor: '#f87171' } : {}) }}
                  type="email" value={form.parent_email}
                  onChange={e => set('parent_email', e.target.value)}
                  placeholder="guardian@email.com (optional)"
                />
                {errors.parent_email && <p style={S.err}>{errors.parent_email}</p>}
                <p style={S.hint}>Optional. Your guardian will receive an invite to monitor your progress.</p>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button style={S.btnSecondary} onClick={() => setStep(1)}>← Back</button>
                <button
                  disabled={loading}
                  style={{ ...S.btnPrimary, flex: 1, opacity: loading ? 0.75 : 1 }}
                  onClick={submit}
                >
                  {loading
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                        <span style={S.spinner} /> Submitting...
                      </span>
                    : 'Submit for approval'
                  }
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#3d4f7a' }}>
          Already have an account?{' '}
          <button
            onClick={() => navigate('/login')}
            style={{ color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Sign in →
          </button>
        </p>
      </div>

      <style>{`
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        input:focus, select:focus {
          outline: none !important;
          border-color: #2d6cff !important;
          box-shadow: 0 0 0 3px rgba(45,108,255,0.15) !important;
        }
      `}</style>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:        { minHeight: '100vh', background: '#03071a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', overflow: 'hidden', fontFamily: "'DM Sans',system-ui,sans-serif" },
  orbTR:       { position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(45,108,255,0.09) 0%,transparent 70%)', filter: 'blur(80px)', top: -150, right: -100, pointerEvents: 'none' },
  orbBL:       { position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(79,62,248,0.07) 0%,transparent 70%)', filter: 'blur(60px)', bottom: -80, left: -60, pointerEvents: 'none' },
  grid:        { position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.025, backgroundImage: 'linear-gradient(#2d6cff 1px,transparent 1px),linear-gradient(90deg,#2d6cff 1px,transparent 1px)', backgroundSize: '60px 60px' },
  schoolBanner:{ background: 'linear-gradient(135deg,#1a3a8f,#0f2460)', borderRadius: 14, padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 28px rgba(15,36,96,0.5)' },
  schoolLogo:  { width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card:        { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: '26px 26px 22px', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' },
  heading:     { fontFamily: "'Syne',system-ui,sans-serif", fontWeight: 800, color: '#e8eeff', margin: 0 },
  muted:       { fontSize: 13, color: '#7a8bbf', margin: 0 },
  stepTitle:   { fontFamily: "'Syne',system-ui,sans-serif", fontSize: 15, fontWeight: 700, color: '#e8eeff', marginBottom: 16 },
  label:       { fontSize: 12, color: '#7a8bbf', display: 'block', marginBottom: 5, fontWeight: 500 },
  input:       { width: '100%', padding: '10px 13px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 11, fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#e8eeff', fontFamily: "'DM Sans',system-ui,sans-serif", transition: 'all 0.2s' },
  err:         { margin: '4px 0 0', fontSize: 12, color: '#f87171' },
  hint:        { margin: '4px 0 0', fontSize: 11, color: '#3d4f7a' },
  btnPrimary:  { padding: '10px 22px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)', color: '#fff', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(45,108,255,0.35)', fontFamily: "'DM Sans',system-ui,sans-serif", display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSecondary:{ padding: '10px 16px', background: 'rgba(255,255,255,0.05)', color: '#7a8bbf', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 11, fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans',system-ui,sans-serif" },
  spinner:     { display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  infoBox:     { padding: '11px 14px', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 11, marginTop: 4 },
}