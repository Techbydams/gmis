import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { getTenantSlug } from '../lib/helpers'
import type { TenantInfo } from '../types'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { TenantDatabase } from '../types/tenant'

interface TenantContextType {
  tenant: TenantInfo | null
  slug: string | null
  loading: boolean
  error: string | null
  isMainPlatform: boolean
  tenantDb: SupabaseClient<TenantDatabase> | null
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  slug: null,
  loading: true,
  error: null,
  isMainPlatform: true,
  tenantDb: null,
})

const SLUG = getTenantSlug()
const IS_MAIN_PLATFORM = SLUG === null

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant,  setTenant]  = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tenantDb, setTenantDb] = useState<SupabaseClient<TenantDatabase> | null>(null)

  useEffect(() => {
    if (IS_MAIN_PLATFORM) {
      setLoading(false)
      return
    }

    const loadTenant = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select(`
            id,
            name,
            slug,
            logo_url,
            supabase_url,
            supabase_anon_key,
            status,
            org_feature_toggles (
              is_enabled,
              features (
                key
              )
            )
          `)
          .eq('slug', SLUG)
          .single() as any

        if (orgError || !org) {
          setError(`School "${SLUG}" is not registered on GMIS.`)
          setLoading(false)
          return
        }

        const orgData = org as {
          id: string
          name: string
          slug: string
          logo_url: string | null
          supabase_url: string | null
          supabase_anon_key: string | null
          status: string | null
          org_feature_toggles: Array<{ is_enabled: boolean | null; features: { key: string } | null }>
        }

        if (orgData.status === 'locked') {
          setError(`The portal for "${orgData.name}" has been temporarily locked. Please contact your school administrator.`)
          setLoading(false)
          return
        }

        if (orgData.status === 'suspended') {
          setError(`The portal for "${orgData.name}" has been suspended. Please contact GMIS support.`)
          setLoading(false)
          return
        }

        if (orgData.status !== 'approved') {
          setError(`"${orgData.name}" is not yet approved on GMIS. Please check back later.`)
          setLoading(false)
          return
        }

        const client = createClient<TenantDatabase>(orgData.supabase_url!, orgData.supabase_anon_key!)
        setTenantDb(client)

        const features: string[] = (orgData.org_feature_toggles || [])
          .filter((toggle: any) => toggle.is_enabled && toggle.features?.key)
          .map((toggle: any) => toggle.features.key as string)

        setTenant({
          slug:              orgData.slug,
          name:              orgData.name,
          logo_url:          orgData.logo_url ?? undefined,
          supabase_url:      orgData.supabase_url!,
          supabase_anon_key: orgData.supabase_anon_key!,
          status:            orgData.status,
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
      tenant,
      slug:           SLUG,
      loading,
      error,
      isMainPlatform: IS_MAIN_PLATFORM,
      tenantDb,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
