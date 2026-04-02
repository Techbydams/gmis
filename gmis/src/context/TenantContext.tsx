import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, getTenantClient } from '../lib/supabase'
import { getTenantSlug } from '../lib/helpers'
import type { TenantInfo } from '../types'

interface TenantContextType {
  tenant:         TenantInfo | null
  slug:           string | null
  loading:        boolean
  error:          string | null
  isMainPlatform: boolean
  tenantDb:       any | null
}

const TenantContext = createContext<TenantContextType>({
  tenant: null, slug: null, loading: true,
  error: null, isMainPlatform: true, tenantDb: null,
})

const SLUG             = getTenantSlug()
const IS_MAIN_PLATFORM = SLUG === null

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant,   setTenant]   = useState<TenantInfo | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [tenantDb, setTenantDb] = useState<any | null>(null)

  useEffect(() => {
    if (IS_MAIN_PLATFORM) { setLoading(false); return }

    const loadTenant = async () => {
      try {
        setLoading(true); setError(null)

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select(`
            id, name, slug, logo_url, supabase_url, supabase_anon_key, status,
            org_feature_toggles ( is_enabled, features ( key ) )
          `)
          .eq('slug', SLUG)
          .single()

        if (orgError || !org) {
          setError(`School "${SLUG}" is not registered on GMIS.`)
          setLoading(false); return
        }

        const o = org as any

        if (o.status === 'locked') {
          setError(`The portal for "${o.name}" has been temporarily locked. Contact your school administrator.`)
          setLoading(false); return
        }
        if (o.status === 'suspended') {
          setError(`The portal for "${o.name}" has been suspended. Contact GMIS support.`)
          setLoading(false); return
        }
        if (o.status !== 'approved') {
          setError(`"${o.name}" is not yet approved on GMIS. Check back later.`)
          setLoading(false); return
        }

        const client = getTenantClient(o.supabase_url!, o.supabase_anon_key!, o.slug)
        setTenantDb(client)

        const features: string[] = (o.org_feature_toggles || [])
          .filter((t: any) => t.is_enabled && t.features?.key)
          .map((t: any) => t.features.key as string)

        setTenant({
          slug:              o.slug,
          name:              o.name,
          logo_url:          o.logo_url ?? undefined,
          supabase_url:      o.supabase_url!,
          supabase_anon_key: o.supabase_anon_key!,
          status:            o.status,
          features,
        })
      } catch (err) {
        console.error('Tenant load error:', err)
        setError('Failed to load school information. Please refresh the page.')
      } finally {
        setLoading(false)
      }
    }

    loadTenant()
  }, [])

  return (
    <TenantContext.Provider value={{
      tenant, slug: SLUG, loading, error,
      isMainPlatform: IS_MAIN_PLATFORM, tenantDb,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)