// ============================================================
// GMIS — Supabase Client
// Dual client: master DB (organizations, platform admin) +
// cached tenant client per school.
// Matches the original Vite lib/supabase.ts architecture.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

// ── Master client ──────────────────────────────────────────
// Connects to the master Supabase project.
// Used for: organizations registry, platform admin, billing.
const MASTER_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const MASTER_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase: SupabaseClient = createClient(MASTER_URL, MASTER_KEY, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  },
});

// ── Tenant client cache ────────────────────────────────────
// Each school has its own isolated Supabase project.
// We cache by supabase_url to avoid re-instantiating on every render.
// Cache key includes slug so dev environments with multiple schools
// on the same URL stay isolated.
const tenantClientCache = new Map<string, SupabaseClient>();

export function getTenantClient(
  supabaseUrl:  string,
  supabaseKey:  string,
  slug:         string
): SupabaseClient {
  const cacheKey = `${slug}:${supabaseUrl}`;
  const existing = tenantClientCache.get(cacheKey);
  if (existing) return existing;

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: false,
    },
  });

  tenantClientCache.set(cacheKey, client);
  return client;
}

// Called on logout to prevent cross-tenant data leaks
export function clearTenantClientCache(): void {
  tenantClientCache.clear();
}
