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
  const { tenant, tenantDb, isMainPlatform, slug } = useTenant()
  const resolveCounterRef = useRef(0)

  const client = useMemo(() => {
    if (isMainPlatform || !tenant) return supabase
    return getTenantClient(tenant.supabase_url, tenant.supabase_anon_key, slug!)
  }, [isMainPlatform, tenant, slug])

  useEffect(() => {
    client.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      else setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user) resolveRole(session.user.id, session.user.email!, session.user.user_metadata)
      else { setUser(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client])

  const resolveRole = async (uid: string, email: string, metadata: Record<string, unknown>) => {
    setLoading(true)
    const myCount = ++resolveCounterRef.current

    if (isMainPlatform) {
      if (myCount !== resolveCounterRef.current) return
      setUser({ id: uid, email, role: 'platform_admin' })
      setLoading(false); return
    }

    try {
      if (!tenantDb) return
      const [adminRes, lecturerRes, studentRes, parentRes] = await Promise.all([
        tenantDb.from('admin_users').select('id, role').eq('supabase_uid', uid).maybeSingle(),
        tenantDb.from('lecturers').select('id').eq('supabase_uid', uid).maybeSingle(),
        tenantDb.from('students').select('id, status').eq('supabase_uid', uid).maybeSingle(),
        tenantDb.from('students').select('id').eq('parent_supabase_uid', uid).limit(1),
      ])

      if (myCount !== resolveCounterRef.current) return

      const adminData   = adminRes.data   as any
      const lecData     = lecturerRes.data as any
      const studentData = studentRes.data  as any
      const parentData  = parentRes.data   as any[]

      if (adminData) {
        setUser({
          id: uid, email,
          role: (adminData.role === 'super_admin' ? 'admin' : adminData.role) as AuthUser['role'],
          org_slug: slug || undefined,
        })
      } else if (lecData) {
        setUser({ id: uid, email, role: 'lecturer', org_slug: slug || undefined })
      } else if (studentData) {
        setUser({ id: uid, email, role: 'student', org_slug: slug || undefined })
      } else if (parentData && parentData.length > 0) {
        setUser({ id: uid, email, role: 'parent', org_slug: slug || undefined })
      } else {
        const metaRole = (metadata?.role as string) || 'student'
        setUser({ id: uid, email, role: metaRole as AuthUser['role'], org_slug: slug || undefined })
      }
    } catch (err) {
      console.error('Role resolution error:', err)
      if (myCount !== resolveCounterRef.current) return
      const metaRole = (metadata?.role as string) || 'student'
      setUser({ id: uid, email, role: metaRole as AuthUser['role'], org_slug: slug || undefined })
    } finally {
      if (myCount === resolveCounterRef.current) setLoading(false)
    }
  }

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
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
      return { error: null }
    } catch {
      return { error: 'Network error. Please check your connection and try again.' }
    }
  }

  const signInWithMatric = async (matric: string, password: string): Promise<{ error: string | null }> => {
    if (!tenant || !slug) return { error: 'School portal not found.' }
    try {
      const { data: student, error: lookupError } = await client
        .from('students').select('email')
        .eq('matric_number', matric.trim().toUpperCase())
        .maybeSingle()
      if (lookupError) return { error: 'Could not verify matric number. Please try again.' }
      const s = student as any
      if (!s?.email) return { error: 'Matric number not found. Contact your registrar.' }
      return await signIn(s.email, password)
    } catch {
      return { error: 'Network error. Please check your connection and try again.' }
    }
  }

  const signOut = async () => {
    try { await client.auth.signOut() }
    catch (err) { console.error('Sign out error:', err) }
    finally { setUser(null) }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signInWithMatric, signOut, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
