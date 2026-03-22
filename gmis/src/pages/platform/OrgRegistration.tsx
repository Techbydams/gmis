// ============================================================
// GMIS — Organisation Registration Page
// gmis.com/register
// Schools sign up here — DAMS Technologies reviews & approves
// ============================================================

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { nameToSlug, isValidEmail, isValidSlug } from '../../lib/helpers'
import toast from 'react-hot-toast'

// ── TYPES ─────────────────────────────────────────────────
interface FormData {
  // Step 1 — Institution info
  name: string
  type: string
  slug: string
  year_founded: string
  country: string
  state: string
  phone: string
  website: string
  address: string
  // Step 2 — Admin account
  admin_name: string
  admin_email: string
  admin_phone: string
  password: string
  confirm_password: string
  // Step 3 — Documents
  doc_cac: File | null
  doc_nuc: File | null
  doc_letterhead: File | null
}

interface Errors {
  [key: string]: string
}

const INITIAL: FormData = {
  name: '', type: 'university', slug: '', year_founded: '',
  country: 'Nigeria', state: '', phone: '', website: '', address: '',
  admin_name: '', admin_email: '', admin_phone: '',
  password: '', confirm_password: '',
  doc_cac: null, doc_nuc: null, doc_letterhead: null,
}

const STEPS = ['Institution', 'Admin account', 'Documents', 'Review']

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara', 'Outside Nigeria',
]

// ── MAIN COMPONENT ─────────────────────────────────────────
export default function OrgRegistration() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [form, setForm]       = useState<FormData>(INITIAL)
  const [errors, setErrors]   = useState<Errors>({})
  const [loading, setLoading] = useState(false)
  const [slugAvail, setSlugAvail] = useState<boolean | null>(null)
  const [checkingSlug, setCheckingSlug] = useState(false)
  const [done, setDone] = useState(false)

  // ── FIELD CHANGE ──────────────────────────────────────────
  const set = (field: keyof FormData, value: string | File | null) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))

    // Auto-generate slug from name
    if (field === 'name' && typeof value === 'string') {
      const auto = nameToSlug(value)
      setForm(prev => ({ ...prev, name: value, slug: auto }))
      setSlugAvail(null)
    }
  }

  // ── SLUG AVAILABILITY CHECK ───────────────────────────────
  const checkSlug = async () => {
    if (!form.slug || !isValidSlug(form.slug)) return
    setCheckingSlug(true)
    const { data } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', form.slug)
      .single()
    setCheckingSlug(false)
    setSlugAvail(!data) // available if no result found
  }

  // ── VALIDATION PER STEP ───────────────────────────────────
  const validate = (s: number): boolean => {
    const e: Errors = {}

    if (s === 1) {
      if (!form.name.trim())            e.name = 'Institution name is required'
      if (!form.slug.trim())            e.slug = 'Subdomain is required'
      else if (!isValidSlug(form.slug)) e.slug = 'Only lowercase letters and numbers, 2-30 chars'
      else if (slugAvail === false)     e.slug = 'This subdomain is already taken'
      if (!form.type)                   e.type = 'Please select an institution type'
      if (!form.state.trim())           e.state = 'State is required'
      if (!form.phone.trim())           e.phone = 'Phone number is required'
      if (!form.address.trim())         e.address = 'Address is required'
    }

    if (s === 2) {
      if (!form.admin_name.trim())           e.admin_name = 'Admin full name is required'
      if (!form.admin_email.trim())          e.admin_email = 'Email is required'
      else if (!isValidEmail(form.admin_email)) e.admin_email = 'Enter a valid email address'
      if (!form.password)                    e.password = 'Password is required'
      else if (form.password.length < 8)     e.password = 'Password must be at least 8 characters'
      if (form.password !== form.confirm_password) e.confirm_password = 'Passwords do not match'
    }

    if (s === 3) {
      if (!form.doc_cac)         e.doc_cac = 'CAC certificate is required'
      if (!form.doc_nuc)         e.doc_nuc = 'NUC/NBTE accreditation is required'
      if (!form.doc_letterhead)  e.doc_letterhead = 'Signed letterhead is required'
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => {
    if (validate(step)) setStep(s => s + 1)
  }

  // ── UPLOAD A FILE TO SUPABASE STORAGE ────────────────────
  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from('org-documents')
      .upload(path, file, { upsert: true })

    if (error) {
      console.error('Upload error:', error)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('org-documents')
      .getPublicUrl(data.path)

    return urlData.publicUrl
  }

  // ── FINAL SUBMIT ─────────────────────────────────────────
  const submit = async () => {
    if (!validate(3)) return
    setLoading(true)

    try {
      const orgId = crypto.randomUUID()
      const slugFolder = `${form.slug}-${orgId.slice(0, 8)}`

      // Upload all 3 documents
      toast.loading('Uploading documents...', { id: 'upload' })

      const [cacUrl, nucUrl, letterheadUrl] = await Promise.all([
        uploadFile(form.doc_cac!, `${slugFolder}/cac.${form.doc_cac!.name.split('.').pop()}`),
        uploadFile(form.doc_nuc!, `${slugFolder}/nuc.${form.doc_nuc!.name.split('.').pop()}`),
        uploadFile(form.doc_letterhead!, `${slugFolder}/letterhead.${form.doc_letterhead!.name.split('.').pop()}`),
      ])

      if (!cacUrl || !nucUrl || !letterheadUrl) {
        throw new Error('Document upload failed. Please try again.')
      }

      toast.loading('Submitting registration...', { id: 'upload' })

      // Insert organisation record
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          id:          orgId,
          name:        form.name.trim(),
          slug:        form.slug.trim().toLowerCase(),
          email:       form.admin_email.trim().toLowerCase(),
          phone:       form.phone.trim(),
          address:     form.address.trim(),
          state:       form.state.trim(),
          country:     form.country.trim(),
          website:     form.website.trim() || null,
          type:        form.type,
          year_founded: form.year_founded ? parseInt(form.year_founded) : null,
          status:      'pending',
          payment_status: 'unpaid',
          admin_name:  form.admin_name.trim(),
          admin_email: form.admin_email.trim().toLowerCase(),
          admin_phone: form.admin_phone.trim() || null,
        })
        .select()
        .single()

      if (orgError) throw new Error(orgError.message)

      // Insert documents
      await supabase.from('organization_documents').insert([
        { org_id: orgId, document_type: 'cac',         file_url: cacUrl,         file_name: form.doc_cac!.name },
        { org_id: orgId, document_type: 'nuc',         file_url: nucUrl,         file_name: form.doc_nuc!.name },
        { org_id: orgId, document_type: 'letterhead',  file_url: letterheadUrl,  file_name: form.doc_letterhead!.name },
      ])

      toast.success('Registration submitted!', { id: 'upload' })
      setDone(true)

    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.', { id: 'upload' })
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────
  if (done) {
    return (
      <div style={styles.page}>
        <div style={styles.orbL} />
        <div style={styles.orbR} />
        <div style={{ ...styles.card, maxWidth: 520, textAlign: 'center', padding: '48px 40px' }}>
          <div style={{ fontSize: 72, marginBottom: 20, animation: 'float 3s ease-in-out infinite' }}>🎉</div>
          <h1 style={{ ...styles.heading, fontSize: 26, marginBottom: 10 }}>Application submitted!</h1>
          <p style={{ ...styles.muted, fontSize: 15, lineHeight: 1.8, marginBottom: 8 }}>
            <strong style={{ color: '#e8eeff' }}>{form.name}</strong> has been submitted for review.
          </p>
          <p style={{ ...styles.muted, lineHeight: 1.8, marginBottom: 24 }}>
            Our team at <strong style={{ color: '#f0b429' }}>DAMS Technologies</strong> will review your documents within <strong style={{ color: '#e8eeff' }}>48 hours</strong>. You'll receive an email at <strong style={{ color: '#60a5fa' }}>{form.admin_email}</strong> once your school is approved and live on GMIS.
          </p>
          <div style={{ ...styles.infoBox, marginBottom: 28, textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 13, color: '#60a5fa' }}>
              📌 Your school's portal will be available at:<br />
              <strong style={{ fontSize: 15 }}>{form.slug}.gmis.com</strong>
            </p>
          </div>
          <button style={styles.btnPrimary} onClick={() => navigate('/')}>← Back to GMIS home</button>
        </div>
      </div>
    )
  }

  // ── MAIN FORM ─────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.orbL} />
      <div style={styles.orbR} />

      <div style={{ width: '100%', maxWidth: 600, position: 'relative' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
            <div style={styles.logo}>G</div>
          </button>
          <h1 style={{ ...styles.heading, fontSize: 24, marginBottom: 4 }}>Register your institution</h1>
          <p style={styles.muted}>Reviewed by DAMS Technologies · Approval within 48 hours</p>
        </div>

        {/* Progress steps */}
        <div style={{ display: 'flex', marginBottom: 28 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, textAlign: 'center', cursor: 'pointer' }} onClick={() => i + 1 < step && setStep(i + 1)}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                border: `2px solid ${i + 1 <= step ? '#2d6cff' : 'rgba(255,255,255,0.12)'}`,
                background: i + 1 < step ? '#2d6cff' : i + 1 === step ? 'rgba(45,108,255,0.15)' : 'transparent',
                color: i + 1 < step ? '#fff' : i + 1 === step ? '#60a5fa' : '#3d4f7a',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 6px', fontSize: 12, fontWeight: 700,
                transition: 'all 0.3s',
              }}>
                {i + 1 < step ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: i + 1 === step ? '#60a5fa' : '#3d4f7a', fontWeight: i + 1 === step ? 600 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Form card */}
        <div style={styles.card}>

          {/* ── STEP 1: Institution Info ── */}
          {step === 1 && (
            <>
              <h2 style={styles.stepTitle}>Institution details</h2>
              <Field label="Institution name *" error={errors.name}>
                <input style={styles.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. ESTAM University" />
              </Field>

              <div style={styles.grid2}>
                <Field label="Institution type *" error={errors.type}>
                  <select style={styles.input} value={form.type} onChange={e => set('type', e.target.value)}>
                    <option value="university">University</option>
                    <option value="polytechnic">Polytechnic</option>
                    <option value="college">College of Education</option>
                    <option value="monotechnic">Monotechnic</option>
                  </select>
                </Field>
                <Field label="Year founded" error={errors.year_founded}>
                  <input style={styles.input} value={form.year_founded} onChange={e => set('year_founded', e.target.value)} placeholder="e.g. 1998" type="number" min="1800" max="2025" />
                </Field>
              </div>

              <Field
                label="Preferred subdomain *"
                error={errors.slug}
                hint={form.slug ? `Your portal will be at: ${form.slug}.gmis.com` : 'Auto-generated from name. Lowercase letters and numbers only.'}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    style={{ ...styles.input, flex: 1 }}
                    value={form.slug}
                    onChange={e => { set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')); setSlugAvail(null) }}
                    placeholder="e.g. estam"
                    onBlur={checkSlug}
                  />
                  <button
                    onClick={checkSlug}
                    disabled={checkingSlug || !form.slug}
                    style={{ ...styles.btnSecondary, whiteSpace: 'nowrap', padding: '8px 14px' }}
                  >
                    {checkingSlug ? '...' : 'Check'}
                  </button>
                </div>
                {slugAvail === true && <p style={{ marginTop: 4, fontSize: 12, color: '#4ade80' }}>✓ {form.slug}.gmis.com is available!</p>}
                {slugAvail === false && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>✗ This subdomain is already taken. Try another.</p>}
              </Field>

              <div style={styles.grid2}>
                <Field label="Country *" error={errors.country}>
                  <input style={styles.input} value={form.country} onChange={e => set('country', e.target.value)} placeholder="Nigeria" />
                </Field>
                <Field label="State *" error={errors.state}>
                  <select style={styles.input} value={form.state} onChange={e => set('state', e.target.value)}>
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Phone number *" error={errors.phone}>
                <input style={styles.input} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+234 801 234 5678" />
              </Field>

              <Field label="Address *" error={errors.address}>
                <input style={styles.input} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full institution address" />
              </Field>

              <Field label="Official website" error={errors.website}>
                <input style={styles.input} value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://yourschool.edu.ng (optional)" />
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button style={styles.btnPrimary} onClick={nextStep}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 2: Admin Account ── */}
          {step === 2 && (
            <>
              <h2 style={styles.stepTitle}>Admin account</h2>
              <p style={{ ...styles.muted, marginBottom: 18, fontSize: 13 }}>
                This will be the super-admin account for <strong style={{ color: '#e8eeff' }}>{form.name}</strong>. You can add more admins later from the dashboard.
              </p>

              <div style={styles.grid2}>
                <Field label="Full name *" error={errors.admin_name}>
                  <input style={styles.input} value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Dr. Emmanuel Adeyemi" />
                </Field>
                <Field label="Phone number" error={errors.admin_phone}>
                  <input style={styles.input} value={form.admin_phone} onChange={e => set('admin_phone', e.target.value)} placeholder="+234 801 234 5678" />
                </Field>
              </div>

              <Field label="Email address *" error={errors.admin_email}>
                <input style={styles.input} value={form.admin_email} onChange={e => set('admin_email', e.target.value)} placeholder="admin@yourschool.edu.ng" type="email" />
              </Field>

              <div style={styles.grid2}>
                <Field label="Password *" error={errors.password}>
                  <input style={styles.input} value={form.password} onChange={e => set('password', e.target.value)} type="password" placeholder="Min. 8 characters" />
                </Field>
                <Field label="Confirm password *" error={errors.confirm_password}>
                  <input style={styles.input} value={form.confirm_password} onChange={e => set('confirm_password', e.target.value)} type="password" placeholder="Repeat password" />
                </Field>
              </div>

              <div style={styles.infoBox}>
                <p style={{ margin: 0, fontSize: 13, color: '#60a5fa' }}>
                  🔒 Your password is stored securely. After your school is approved, you'll use this email and password to log in at <strong>{form.slug}.gmis.com</strong>
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
                <button style={styles.btnSecondary} onClick={() => setStep(1)}>← Back</button>
                <button style={styles.btnPrimary} onClick={nextStep}>Continue →</button>
              </div>
            </>
          )}

          {/* ── STEP 3: Documents ── */}
          {step === 3 && (
            <>
              <h2 style={styles.stepTitle}>Required documents</h2>
              <p style={{ ...styles.muted, marginBottom: 18, fontSize: 13 }}>
                These documents are reviewed by DAMS Technologies to verify your institution's legitimacy before going live on GMIS. PDF, JPG, or PNG — max 10MB each.
              </p>

              <DocUpload
                label="CAC Registration Certificate *"
                hint="Certificate of Incorporation or equivalent government registration"
                file={form.doc_cac}
                error={errors.doc_cac}
                onChange={f => set('doc_cac', f)}
              />

              <DocUpload
                label="NUC / NBTE Accreditation Letter *"
                hint="National Universities Commission or NBTE accreditation document"
                file={form.doc_nuc}
                error={errors.doc_nuc}
                onChange={f => set('doc_nuc', f)}
              />

              <DocUpload
                label="Signed Institution Letterhead *"
                hint="Official letterhead signed by the Vice-Chancellor, Rector, or Provost"
                file={form.doc_letterhead}
                error={errors.doc_letterhead}
                onChange={f => set('doc_letterhead', f)}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
                <button style={styles.btnSecondary} onClick={() => setStep(2)}>← Back</button>
                <button style={styles.btnPrimary} onClick={nextStep}>Review →</button>
              </div>
            </>
          )}

          {/* ── STEP 4: Review & Submit ── */}
          {step === 4 && (
            <>
              <h2 style={styles.stepTitle}>Review & submit</h2>

              <ReviewSection title="Institution">
                <ReviewRow label="Name"     value={form.name} />
                <ReviewRow label="Type"     value={form.type.charAt(0).toUpperCase() + form.type.slice(1)} />
                <ReviewRow label="Portal"   value={`${form.slug}.gmis.com`} highlight />
                <ReviewRow label="State"    value={form.state} />
                <ReviewRow label="Country"  value={form.country} />
                <ReviewRow label="Phone"    value={form.phone} />
                <ReviewRow label="Address"  value={form.address} />
                {form.website && <ReviewRow label="Website" value={form.website} />}
              </ReviewSection>

              <ReviewSection title="Admin account">
                <ReviewRow label="Name"     value={form.admin_name} />
                <ReviewRow label="Email"    value={form.admin_email} highlight />
                {form.admin_phone && <ReviewRow label="Phone" value={form.admin_phone} />}
              </ReviewSection>

              <ReviewSection title="Documents">
                <ReviewRow label="CAC certificate"   value={form.doc_cac?.name || '—'} />
                <ReviewRow label="NUC accreditation" value={form.doc_nuc?.name || '—'} />
                <ReviewRow label="Letterhead"        value={form.doc_letterhead?.name || '—'} />
              </ReviewSection>

              <div style={{ padding: '14px 16px', background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.25)', borderRadius: 12, marginBottom: 20 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#fbbf24', lineHeight: 1.7 }}>
                  ⚠ After submission, <strong>DAMS Technologies</strong> will review your documents within 48 hours. You'll receive an email at <strong>{form.admin_email}</strong> once approved. You cannot edit this submission — contact us if changes are needed.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button style={styles.btnSecondary} onClick={() => setStep(3)}>← Back</button>
                <button style={{ ...styles.btnPrimary, opacity: loading ? 0.7 : 1 }} onClick={submit} disabled={loading}>
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                      Submitting...
                    </span>
                  ) : 'Submit for approval ✓'}
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#3d4f7a' }}>
          Already registered? <button onClick={() => navigate('/find')} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Find your school →</button>
        </p>
      </div>

      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)} }
        @keyframes spin  { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}

// ── HELPER COMPONENTS ─────────────────────────────────────

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      {children}
      {error && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>{error}</p>}
      {hint && !error && <p style={{ marginTop: 4, fontSize: 11, color: '#3d4f7a' }}>{hint}</p>}
    </div>
  )
}

function DocUpload({ label, hint, file, error, onChange }: {
  label: string; hint: string; file: File | null; error?: string; onChange: (f: File | null) => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.label}>{label}</label>
      <p style={{ fontSize: 11, color: '#3d4f7a', marginBottom: 8 }}>{hint}</p>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10 }}>
          <span style={{ fontSize: 13, color: '#4ade80' }}>✓ {file.name}</span>
          <button onClick={() => onChange(null)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}>Remove</button>
        </div>
      ) : (
        <label style={{ display: 'block', padding: '20px', border: `2px dashed ${error ? '#f87171' : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 13, color: '#7a8bbf', marginBottom: 4 }}>Click to upload or drag and drop</div>
          <div style={{ fontSize: 11, color: '#3d4f7a' }}>PDF, JPG, PNG — max 10MB</div>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
      )}
      {error && <p style={{ marginTop: 4, fontSize: 12, color: '#f87171' }}>{error}</p>}
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: '#3d4f7a', marginBottom: 8 }}>{title}</div>
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function ReviewRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
      <span style={{ color: '#7a8bbf' }}>{label}</span>
      <span style={{ fontWeight: 600, color: highlight ? '#60a5fa' : '#e8eeff' }}>{value}</span>
    </div>
  )
}

// ── STYLES ────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#03071a',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    position: 'relative' as const,
    overflow: 'hidden',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  } as React.CSSProperties,
  orbL: {
    position: 'absolute' as const, width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(45,108,255,0.10) 0%,transparent 70%)',
    filter: 'blur(80px)', top: -150, right: -100, pointerEvents: 'none' as const,
  } as React.CSSProperties,
  orbR: {
    position: 'absolute' as const, width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle,rgba(79,62,248,0.08) 0%,transparent 70%)',
    filter: 'blur(60px)', bottom: -100, left: -80, pointerEvents: 'none' as const,
  } as React.CSSProperties,
  logo: {
    width: 52, height: 52, borderRadius: 16,
    background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 900, fontSize: 22, color: '#fff', margin: '0 auto',
    boxShadow: '0 8px 28px rgba(45,108,255,0.4)',
  } as React.CSSProperties,
  heading: {
    fontFamily: "'Syne', system-ui, sans-serif",
    fontWeight: 800, color: '#e8eeff', margin: 0,
  } as React.CSSProperties,
  muted: { color: '#7a8bbf', margin: 0 } as React.CSSProperties,
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: '28px 28px 24px',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  } as React.CSSProperties,
  stepTitle: {
    fontFamily: "'Syne', system-ui, sans-serif",
    fontSize: 16, fontWeight: 700, color: '#e8eeff', marginBottom: 18,
  } as React.CSSProperties,
  label: {
    fontSize: 12, color: '#7a8bbf', display: 'block',
    marginBottom: 5, fontWeight: 500,
  } as React.CSSProperties,
  input: {
    width: '100%', padding: '10px 13px',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 11, fontSize: 13,
    background: 'rgba(255,255,255,0.04)',
    color: '#e8eeff', outline: 'none',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  } as React.CSSProperties,
  grid2: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
  } as React.CSSProperties,
  btnPrimary: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px 22px', background: 'linear-gradient(135deg,#2d6cff,#4f3ef8)',
    color: '#fff', border: 'none', borderRadius: 11, fontSize: 13,
    fontWeight: 600, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(45,108,255,0.35)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  } as React.CSSProperties,
  btnSecondary: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '10px 18px',
    background: 'rgba(255,255,255,0.05)',
    color: '#7a8bbf', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 11, fontSize: 13, cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  } as React.CSSProperties,
  infoBox: {
    padding: '12px 14px',
    background: 'rgba(96,165,250,0.08)',
    border: '1px solid rgba(96,165,250,0.2)',
    borderRadius: 12, marginBottom: 4,
  } as React.CSSProperties,
}