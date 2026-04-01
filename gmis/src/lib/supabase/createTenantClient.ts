import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { TenantDatabase } from '@/types/tenant'

export const createTenantClient = (
  url: string,
  anonKey: string
): SupabaseClient<TenantDatabase> => {
  return createClient<TenantDatabase>(url, anonKey)
}