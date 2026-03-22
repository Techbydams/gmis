// ============================================================
// GMIS — Supabase Master Client
// This connects to the PLATFORM-LEVEL Supabase project
// (tracks organizations, billing, feature toggles)
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

// This is the master database client — only used on gmis.com
// Each school has its own separate Supabase client (created dynamically)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ── TENANT CLIENT FACTORY ─────────────────────────────────
// Creates a Supabase client for a specific school's database
// Called when a user lands on schoolname.gmis.com

const tenantClients: Record<string, ReturnType<typeof createClient>> = {}

export const getTenantClient = (supabaseUrl: string, supabaseAnonKey: string, slug: string) => {
  // Cache clients so we don't recreate them on every render
  if (!tenantClients[slug]) {
    tenantClients[slug] = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: `gmis-auth-${slug}`,    // separate auth storage per school
      },
    })
  }
  return tenantClients[slug]
}

export default supabase
