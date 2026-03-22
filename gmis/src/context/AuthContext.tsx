// ============================================================
// GMIS — Auth Context (Fixed — role detection works for all)
// Admin, Lecturer and Student roles all correctly detected
// ============================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, getTenantClient } from '../lib/supabase'
import { useTenant } from './TenantContext'
import type { AuthUser } from '../types'

interface AuthContextType {
  user:             AuthUser | null
  loading:          boolean
  signIn:           (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMatric: (matric: string, password: string) => Promise<{ error: string | null }>
  signOut:          () => Promise<void>
  isAuthenticated:  boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  signIn: async () => ({ error: null }),
  signInWithMatric: async () => ({ error: null }),
  signOut: async () => {},
  isAuthenticated: false,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,    setUser]    = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { tenant, isMainPlatform, slug } = useTenant()

  const getClient = () => {
    if (isMainPlatform || !tenant) return supabase
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }

  useEffect(() => {
    const client = getClient()

    // Check existing session on load
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    // Listen for auth changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [tenant])

  // ── ROLE RESOLUTION ────────────────────────────────────
  // Priority order:
  // 1. Check admin_users table (most reliable for admins)
  // 2. Check lecturers table
  // 3. Check students table
  // 4. Fall back to metadata
  const resolveRole = async (uid: string, email: string, metadata: Record<string, any>) => {
    setLoading(true)

    // Platform admin (gmis.com)
    if (isMainPlatform) {
      setUser({ id: uid, email, role: 'platform_admin' })
      setLoading(false)
      return
    }

    const client = getClient()

    try {
      // Check all three tables in parallel for speed
      const [adminRes, lecturerRes, studentRes] = await Promise.all([
        client.from('admin_users').select('id, role').eq('supabase_uid', uid).maybeSingle(),
        client.from('lecturers').select('id').eq('supabase_uid', uid).maybeSingle(),
        client.from('students').select('id, status').eq('supabase_uid', uid).maybeSingle(),
      ])

      if (adminRes.data) {
        // User is an admin
        setUser({
          id:  uid,
          email,
          role: (adminRes.data.role === 'super_admin' ? 'admin' : adminRes.data.role) as AuthUser['role'],
          org_slug: slug || undefined,
        })
      } else if (lecturerRes.data) {
        // User is a lecturer
        setUser({ id: uid, email, role: 'lecturer', org_slug: slug || undefined })
      } else if (studentRes.data) {
        // User is a student
        setUser({ id: uid, email, role: 'student', org_slug: slug || undefined })
      } else {
        // Not in any table yet — check metadata as fallback
        // This handles newly created accounts before they're inserted in DB
        const metaRole = metadata?.role || 'student'
        setUser({ id: uid, email, role: metaRole as AuthUser['role'], org_slug: slug || undefined })
      }
    } catch (err) {
      console.error('Role resolution error:', err)
      // Fallback to metadata on DB error
      const metaRole = metadata?.role || 'student'
      setUser({ id: uid, email, role: metaRole as AuthUser['role'], org_slug: slug || undefined })
    } finally {
      setLoading(false)
    }
  }

  // ── SIGN IN WITH EMAIL ──────────────────────────────────
  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const client = getClient()

    const { data, error } = await client.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials'))
        return { error: 'Incorrect email or password. Please try again.' }
      if (error.message.includes('Email not confirmed'))
        return { error: 'Please verify your email first. Check your inbox.' }
      if (error.message.includes('Too many requests'))
        return { error: 'Too many attempts. Please wait a few minutes.' }
      return { error: error.message }
    }

    // Role will be resolved by the onAuthStateChange listener above
    return { error: null }
  }

  // ── SIGN IN WITH MATRIC ─────────────────────────────────
  const signInWithMatric = async (matric: string, password: string): Promise<{ error: string | null }> => {
    if (!tenant || !slug) return { error: 'School portal not found.' }

    const client = getClient()

    const { data: student, error: lookupError } = await client
      .from('students')
      .select('email')
      .eq('matric_number', matric.trim().toUpperCase())
      .maybeSingle()

    if (lookupError || !student?.email) {
      return { error: 'Matric number not found. Contact your registrar.' }
    }

    return await signIn(student.email, password)
  }

  // ── SIGN OUT ────────────────────────────────────────────
  const signOut = async () => {
    const client = getClient()
    await client.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signInWithMatric,
      signOut,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
