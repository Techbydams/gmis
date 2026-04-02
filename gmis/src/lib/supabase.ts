// ============================================================
// GMIS — Supabase Clients
// FIX: Removed type parameters from createClient to prevent
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
// Creates a Supabase client for a specific school's database
// Called when a user lands on schoolname.gmis.app
const tenantClients: Record<string, ReturnType<typeof createClient>> = {}

export const getTenantClient = (
  tenantUrl: string,
  tenantAnonKey: string,
  slug: string,
) => {
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
