// ============================================================
// GMIS — Shared Types
// Matches the actual Supabase schema exactly.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

// ── Auth roles ─────────────────────────────────────────────
export type UserRole =
  | "student"
  | "lecturer"
  | "admin"
  | "parent"
  | "platform_admin";

// ── Auth user (resolved after login) ──────────────────────
// Matches the AuthUser shape from the original Vite AuthContext
export interface AuthUser {
  id:       string;        // Supabase auth UID
  email:    string;
  role:     UserRole;
  org_slug?: string;       // which school this user belongs to
}

// ── Master DB — Organization ───────────────────────────────
// Table: organizations (note: NOT organisations)
export interface Organization {
  id:                string;
  name:              string;
  slug:              string;           // e.g. "estam"
  type?:             string;           // university, polytechnic, college
  logo_url?:         string | null;
  supabase_url:      string;
  supabase_anon_key: string;
  status:            "pending" | "approved" | "locked" | "suspended";
  features?:         string[];         // resolved from org_feature_toggles
}

// ── TenantInfo (subset of Organization used in TenantContext) ──
export interface TenantInfo {
  slug:              string;
  name:              string;
  logo_url?:         string;
  supabase_url:      string;
  supabase_anon_key: string;
  status:            string;
  features:          string[];
}

// ── Tenant DB — Student ────────────────────────────────────
// Column: supabase_uid (NOT user_id)
export interface Student {
  id:             string;
  supabase_uid:   string;
  matric_number:  string;
  full_name:      string;
  email:          string;
  department_id:  string;
  level:          number;
  status:         "pending" | "active" | "suspended";
  parent_supabase_uid?: string | null;   // parent's auth UID stored here
  avatar_url?:    string | null;
  created_at:     string;
}

// ── Tenant DB — Lecturer ───────────────────────────────────
// Column: supabase_uid (NOT user_id)
export interface Lecturer {
  id:           string;
  supabase_uid: string;
  staff_id:     string;
  full_name:    string;
  email:        string;
  is_active:    boolean;
  department_id?: string | null;
  avatar_url?:  string | null;
  created_at:   string;
}

// ── Tenant DB — Admin ──────────────────────────────────────
// Column: supabase_uid (NOT user_id)
// role can be 'super_admin' or 'admin' — both resolve to 'admin'
export interface AdminUser {
  id:           string;
  supabase_uid: string;
  role:         "admin" | "super_admin";
  full_name:    string;
  email:        string;
  created_at:   string;
}
