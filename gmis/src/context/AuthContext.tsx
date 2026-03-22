// ============================================================
// GMIS — Auth Context
// Handles login/logout for both platform admins (gmis.com)
// and school users (estam.gmis.com)
// ============================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, getTenantClient } from '../lib/supabase'
import { useTenant } from './TenantContext'
import type { AuthUser } from '../types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithMatric: (matric: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signInWithMatric: async () => ({ error: null }),
  signOut: async () => {},
  isAuthenticated: false,
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { tenant, isMainPlatform, slug } = useTenant()

  // Get the right Supabase client (master or tenant)
  const getClient = () => {
    if (isMainPlatform || !tenant) return supabase
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }

  useEffect(() => {
    const client = getClient()

    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await client.auth.getSession()

      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email!)
      }
      setLoading(false)
    }

    checkSession()

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadUserProfile(session.user.id, session.user.email!)
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [tenant])

  const loadUserProfile = async (uid: string, email: string) => {
    // Determine role based on which DB we're in
    if (isMainPlatform) {
      // Platform admin
      setUser({ id: uid, email, role: 'platform_admin' })
    } else {
      // School user — check if student, lecturer or admin
      const client = getClient()

      // Check students table
      const { data: student } = await client
        .from('students')
        .select('id')
        .eq('supabase_uid', uid)
        .single()

      if (student) {
        setUser({ id: uid, email, role: 'student', org_slug: slug || undefined })
        return
      }

      // Check lecturers table
      const { data: lecturer } = await client
        .from('lecturers')
        .select('id')
        .eq('supabase_uid', uid)
        .single()

      if (lecturer) {
        setUser({ id: uid, email, role: 'lecturer', org_slug: slug || undefined })
        return
      }

      // Default to admin
      setUser({ id: uid, email, role: 'admin', org_slug: slug || undefined })
    }
  }

  // Sign in with email + password
  const signIn = async (email: string, password: string) => {
    const client = getClient()
    const { error } = await client.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  // Sign in with matric number (students only)
  // Matric number is stored as email alias in the format matric@slug.gmis.com
  const signInWithMatric = async (matric: string, password: string) => {
    if (!slug) return { error: 'No school detected' }

    // First find the student's email from their matric number
    const client = getClient()
    const { data: student, error: findError } = await client
      .from('students')
      .select('email')
      .eq('matric_number', matric.trim().toUpperCase())
      .single()

    if (findError || !student?.email) {
      return { error: 'Matric number not found. Contact your registrar.' }
    }

    // Now sign in with their email
    return await signIn(student.email, password)
  }

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
