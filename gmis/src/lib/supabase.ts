// ============================================================
// GMIS — Supabase Clients
// FIX: getTenantClient typed as `any` to prevent
// PostgrestVersion mismatch causing all tables to type as never
// ============================================================
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.'
  )
}

// Master database client — only used on gmis.app (platform level)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ── TENANT CLIENT FACTORY ─────────────────────────────────
// Creates a Supabase client for a specific school's database.
// Typed as `any` intentionally — tenant DBs have no generated
// types, so strict typing causes every table to resolve as `never`.
const tenantClients: Record<string, any> = {}

export const getTenantClient = (
  tenantUrl: string,
  tenantAnonKey: string,
  slug: string,
): any => {
  if (!tenantClients[slug]) {
    tenantClients[slug] = createClient(tenantUrl, tenantAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: `gmis-auth-${slug}`,
      },
    })
  }
  return tenantClients[slug]
}

export default supabase