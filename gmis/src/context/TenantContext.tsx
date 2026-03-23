// ============================================================
// GMIS — Tenant Context
// FIXED:
//   - Null safety on org_feature_toggles → features join
//   - Error message improved for locked schools
//   - Slug detection is now stable on re-renders
// ============================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { getTenantSlug } from '../lib/helpers'
import type { TenantInfo } from '../types'

interface TenantContextType {
  tenant: TenantInfo | null
  slug: string | null
  loading: boolean
  error: string | null
  isMainPlatform: boolean
}

const TenantContext = createContext<TenantContextType>({
  tenant: null,
  slug: null,
  loading: true,
  error: null,
  isMainPlatform: true,
})

// Compute slug once at module level — it doesn't change during a session
const SLUG = getTenantSlug()
const IS_MAIN_PLATFORM = SLUG === null

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant,  setTenant]  = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

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
          .single()

        if (orgError || !org) {
          setError(`School "${SLUG}" is not registered on GMIS.`)
          setLoading(false)
          return
        }

        if (org.status === 'locked') {
          setError(`The portal for "${org.name}" has been temporarily locked. Please contact your school administrator.`)
          setLoading(false)
          return
        }

        if (org.status === 'suspended') {
          setError(`The portal for "${org.name}" has been suspended. Please contact GMIS support.`)
          setLoading(false)
          return
        }

        if (org.status !== 'approved') {
          setError(`"${org.name}" is not yet approved on GMIS. Please check back later.`)
          setLoading(false)
          return
        }

        // FIXED: Safe access on the features join — features can be null if
        // the feature record was deleted without removing the toggle
        const features: string[] = (org.org_feature_toggles || [])
          .filter((toggle: any) => toggle.is_enabled && toggle.features?.key)
          .map((toggle: any) => toggle.features.key as string)

        setTenant({
          slug:              org.slug,
          name:              org.name,
          logo_url:          org.logo_url,
          supabase_url:      org.supabase_url,
          supabase_anon_key: org.supabase_anon_key,
          status:            org.status,
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
  }, []) // slug is stable — no deps needed

  return (
    <TenantContext.Provider value={{
      tenant,
      slug:           SLUG,
      loading,
      error,
      isMainPlatform: IS_MAIN_PLATFORM,
    }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)