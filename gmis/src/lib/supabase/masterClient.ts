import { createClient } from '@supabase/supabase-js'
import type { MasterDatabase as MasterDB } from '../../types/master'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!

export const supabase = createClient<MasterDB>(
  supabaseUrl,
  supabaseAnonKey
)