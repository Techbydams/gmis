// ============================================================
// GMIS — Global TypeScript Types
// ============================================================

// ── ORGANIZATION ─────────────────────────────────────────
export interface Organization {
  id: string
  name: string
  slug: string                    // subdomain slug e.g. "estam"
  email: string
  phone?: string
  address?: string
  state?: string
  country: string
  website?: string
  logo_url?: string
  type: 'university' | 'polytechnic' | 'college' | 'monotechnic'
  year_founded?: number

  // Supabase tenant info (set after approval)
  supabase_project_id?: string
  supabase_url?: string
  supabase_anon_key?: string

  // Status
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'locked' | 'suspended'
  rejection_reason?: string
  approved_at?: string
  locked_at?: string
  lock_reason?: string

  // Subscription
  plan_id?: string
  subscription_start?: string
  subscription_end?: string
  payment_status: 'paid' | 'unpaid' | 'overdue' | 'trial'
  trial_ends_at?: string
  last_payment_at?: string

  // Admin contact
  admin_name?: string
  admin_email?: string
  admin_phone?: string

  created_at: string
  updated_at: string
}

// ── SUBSCRIPTION PLANS ────────────────────────────────────
export interface SubscriptionPlan {
  id: string
  name: string
  slug: string
  billing_cycle: 'monthly' | 'quarterly' | 'biannual' | 'yearly'
  price_ngn: number
  max_students: number
  max_lecturers: number
  description?: string
  is_active: boolean
  created_at: string
}

// ── FEATURES ─────────────────────────────────────────────
export interface Feature {
  id: string
  key: string                     // e.g. 'voting_system'
  label: string                   // e.g. 'Voting System'
  description?: string
  category: 'student' | 'admin' | 'lecturer'
  created_at: string
}

export interface OrgFeatureToggle {
  id: string
  org_id: string
  feature_id: string
  is_enabled: boolean
  toggled_by?: string
  toggled_at: string
}

// ── PLATFORM ADMIN ────────────────────────────────────────
export interface PlatformAdmin {
  id: string
  email: string
  full_name: string
  is_active: boolean
  last_login?: string
  created_at: string
}

// ── ORG DOCUMENTS ─────────────────────────────────────────
export interface OrgDocument {
  id: string
  org_id: string
  document_type: 'cac' | 'nuc_accreditation' | 'letterhead' | 'other'
  file_url: string
  file_name?: string
  verified: boolean
  notes?: string
  uploaded_at: string
}

// ── ORG REGISTRATION FORM ─────────────────────────────────
export interface OrgRegistrationForm {
  // Step 1 — Institution info
  name: string
  type: 'university' | 'polytechnic' | 'college' | 'monotechnic'
  slug: string
  year_founded?: number
  country: string
  state: string
  phone: string
  website?: string
  address?: string

  // Step 2 — Admin account
  admin_name: string
  admin_email: string
  admin_phone?: string
  password: string
  confirm_password: string

  // Step 3 — Documents (file uploads)
  documents: {
    cac?: File | null
    nuc?: File | null
    letterhead?: File | null
  }
}

// ── STUDENT (Tenant DB) ───────────────────────────────────
export interface Student {
  id: string
  supabase_uid?: string
  matric_number: string
  application_no?: string
  email?: string
  email_verified: boolean
  first_name: string
  last_name: string
  other_names?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other'
  phone?: string
  address?: string
  state_of_origin?: string
  profile_photo?: string
  department_id?: string
  level?: '100' | '200' | '300' | '400' | '500' | '600'
  mode_of_entry?: 'utme' | 'direct_entry' | 'transfer'
  entry_session?: string
  current_session?: string
  gpa: number
  cgpa: number
  status: 'pending' | 'active' | 'suspended' | 'graduated' | 'withdrawn'
  approved_at?: string
  id_card_printed: boolean
  id_card_paid: boolean
  created_at: string
  updated_at: string
}

// ── LECTURER (Tenant DB) ──────────────────────────────────
export interface Lecturer {
  id: string
  supabase_uid?: string
  email: string
  full_name: string
  staff_id?: string
  department_id?: string
  phone?: string
  profile_photo?: string
  specialization?: string
  is_active: boolean
  created_at: string
}

// ── DEPARTMENT ────────────────────────────────────────────
export interface Department {
  id: string
  name: string
  code: string
  faculty?: string
  created_at: string
}

// ── COURSE ────────────────────────────────────────────────
export interface Course {
  id: string
  course_code: string
  course_name: string
  credit_units: number
  department_id?: string
  level?: string
  semester: 'first' | 'second'
  lecturer_id?: string
  description?: string
  max_students: number
  session?: string
  is_active: boolean
  created_at: string
}

// ── RESULT ────────────────────────────────────────────────
export interface Result {
  id: string
  student_id: string
  course_id: string
  session: string
  semester: 'first' | 'second'
  ca_score: number
  exam_score: number
  total_score: number
  grade?: string
  grade_point?: number
  remark: 'pass' | 'fail' | 'absent' | 'incomplete'
  published: boolean
  uploaded_by?: string
  released_by?: string
  released_at?: string
  created_at: string
}

// ── PAYMENT ───────────────────────────────────────────────
export interface StudentPayment {
  id: string
  student_id: string
  fee_type_id: string
  amount: number
  reference: string
  paystack_ref?: string
  status: 'pending' | 'success' | 'failed'
  session: string
  semester?: string
  paid_at?: string
  created_at: string
}

// ── NOTIFICATION ──────────────────────────────────────────
export interface Notification {
  id: string
  user_id?: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'alert' | 'result' | 'payment'
  action_url?: string
  is_read: boolean
  created_at: string
}

// ── AUTH ──────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  role: 'student' | 'admin' | 'lecturer' | 'platform_admin' | 'parent'
  org_slug?: string
}

export interface TenantInfo {
  slug: string
  name: string
  logo_url?: string
  supabase_url: string
  supabase_anon_key: string
  status: string
  features: string[]             // list of enabled feature keys
}

// ── API RESPONSE ──────────────────────────────────────────
export interface ApiResponse<T> {
  data: T | null
  error: string | null
  success: boolean
}

// ── FORM ERRORS ───────────────────────────────────────────
export type FormErrors<T> = Partial<Record<keyof T, string>>
