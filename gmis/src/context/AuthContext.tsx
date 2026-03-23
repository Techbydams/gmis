// ============================================================
// GMIS — Auth Context
// FIXED:
//   - resolveRole() race condition with cancellation flag
//   - getClient() memoised to avoid re-creation every render
//   - signInWithMatric() wrapped in try/catch
//   - No more manual navigate() on login — RoleRedirect in App handles it
//   - Auth state listener properly cleaned up
// ============================================================

import {
  createContext, useContext, useState, useEffect,
  useRef, useMemo, ReactNode,
} from 'react'
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

  // Track in-flight role resolution so stale ones don't overwrite fresh ones
  const resolveCounterRef = useRef(0)

  // Memoize the client so it doesn't get recreated on every render
  const client = useMemo(() => {
    if (isMainPlatform || !tenant) return supabase
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [isMainPlatform, tenant, slug])

  useEffect(() => {
    // Check existing session on mount
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      } else {
        setLoading(false)
      }
    }).catch(() => setLoading(false))

    // Listen for auth state changes
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  // ── ROLE RESOLUTION ────────────────────────────────────
  // Uses a counter to cancel stale calls if a newer one fires before this completes
  const resolveRole = async (
    uid: string,
    email: string,
    metadata: Record<string, unknown>,
  ) => {
    setLoading(true)
    const myCount = ++resolveCounterRef.current

    // Platform admin (gmis.com)
    if (isMainPlatform) {
      if (myCount !== resolveCounterRef.current) return
      setUser({ id: uid, email, role: 'platform_admin' })
      setLoading(false)
      return
    }

    try {
      // Check all three role tables in parallel for speed
      const [adminRes, lecturerRes, studentRes] = await Promise.all([
        client.from('admin_users').select('id, role').eq('supabase_uid', uid).maybeSingle(),
        client.from('lecturers').select('id').eq('supabase_uid', uid).maybeSingle(),
        client.from('students').select('id, status').eq('supabase_uid', uid).maybeSingle(),
      ])

      // Bail out if a newer resolveRole() call has started
      if (myCount !== resolveCounterRef.current) return

      if (adminRes.data) {
        setUser({
          id:  uid,
          email,
          role: (adminRes.data.role === 'super_admin' ? 'admin' : adminRes.data.role) as AuthUser['role'],
          org_slug: slug || undefined,
        })
      } else if (lecturerRes.data) {
        setUser({ id: uid, email, role: 'lecturer', org_slug: slug || undefined })
      } else if (studentRes.data) {
        setUser({ id: uid, email, role: 'student', org_slug: slug || undefined })
      } else {
        // Not in any table yet (new account) — fall back to metadata
        const metaRole = (metadata?.role as string) || 'student'
        setUser({
          id: uid, email,
          role: metaRole as AuthUser['role'],
          org_slug: slug || undefined,
        })
      }
    } catch (err) {
      console.error('Role resolution error:', err)
      if (myCount !== resolveCounterRef.current) return
      // Fallback to metadata on DB error
      const metaRole = (metadata?.role as string) || 'student'
      setUser({
        id: uid, email,
        role: metaRole as AuthUser['role'],
        org_slug: slug || undefined,
      })
    } finally {
      if (myCount === resolveCounterRef.current) {
        setLoading(false)
      }
    }
  }

  // ── SIGN IN WITH EMAIL ──────────────────────────────────
  const signIn = async (
    email: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await client.auth.signInWithPassword({
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

      // Role is resolved by onAuthStateChange listener — no manual navigate needed
      return { error: null }
    } catch (err) {
      return { error: 'Network error. Please check your connection and try again.' }
    }
  }

  // ── SIGN IN WITH MATRIC ─────────────────────────────────
  const signInWithMatric = async (
    matric: string,
    password: string,
  ): Promise<{ error: string | null }> => {
    if (!tenant || !slug) return { error: 'School portal not found.' }

    try {
      const { data: student, error: lookupError } = await client
        .from('students')
        .select('email')
        .eq('matric_number', matric.trim().toUpperCase())
        .maybeSingle()

      if (lookupError) {
        console.error('Matric lookup error:', lookupError)
        return { error: 'Could not verify matric number. Please try again.' }
      }

      if (!student?.email) {
        return { error: 'Matric number not found. Contact your registrar.' }
      }

      return await signIn(student.email, password)
    } catch (err) {
      return { error: 'Network error. Please check your connection and try again.' }
    }
  }

  // ── SIGN OUT ────────────────────────────────────────────
  const signOut = async () => {
    try {
      await client.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      setUser(null)
    }
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