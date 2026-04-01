// ============================================================
// GMIS — Supabase Master Client
// This connects to the PLATFORM-LEVEL Supabase project
// (tracks organizations, billing, feature toggles)
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { Database as MasterDB } from '../types/master'
import type { Database as TenantDB } from '../types/tenant'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!



if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  )
}

// This is the master database client — only used on gmis.com
// Each school has its own separate Supabase client (created dynamically)

export const supabase = createClient<MasterDB>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
})

// ── TENANT CLIENT FACTORY ─────────────────────────────────
// Creates a Supabase client for a specific school's database
// Called when a user lands on schoolname.gmis.com

type TenantClient = ReturnType<typeof createClient<TenantDB>>

const tenantClients: Record<string, TenantClient> = {}

export const getTenantClient = (supabaseUrl: string, supabaseAnonKey: string, slug: string) => {
  // Cache clients so we don't recreate them on every render
  if (!tenantClients[slug]) {
    tenantClients[slug] = createClient<TenantDB>(supabaseUrl, supabaseAnonKey, {
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
