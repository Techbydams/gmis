import { createClient } from '@supabase/supabase-js'

export const createTenantClient = (url: string, anonKey: string) => {
  return createClient(url, anonKey)
}
