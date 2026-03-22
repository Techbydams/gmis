// ============================================================
// GMIS — Tenant Context
// Detects which school's subdomain we're on and loads
// that school's info from the master database
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

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const slug = getTenantSlug()
  const isMainPlatform = slug === null

  useEffect(() => {
    if (isMainPlatform) {
      // We're on gmis.com — no tenant to load
      setLoading(false)
      return
    }

    const loadTenant = async () => {
      try {
        setLoading(true)
        setError(null)

        // Look up this school in the master database by slug
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
              features (key),
              is_enabled
            )
          `)
          .eq('slug', slug)
          .eq('status', 'approved')
          .single()

        if (orgError || !org) {
          setError(`School "${slug}" not found or not yet approved on GMIS.`)
          setLoading(false)
          return
        }

        // Build list of enabled feature keys
        const features: string[] = (org.org_feature_toggles || [])
          .filter((toggle: any) => toggle.is_enabled)
          .map((toggle: any) => toggle.features?.key)
          .filter(Boolean)

        setTenant({
          slug: org.slug,
          name: org.name,
          logo_url: org.logo_url,
          supabase_url: org.supabase_url,
          supabase_anon_key: org.supabase_anon_key,
          status: org.status,
          features,
        })
      } catch (err) {
        setError('Failed to load school information. Please try again.')
        console.error('Tenant load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadTenant()
  }, [slug, isMainPlatform])

  return (
    <TenantContext.Provider value={{ tenant, slug, loading, error, isMainPlatform }}>
      {children}
    </TenantContext.Provider>
  )
}

export const useTenant = () => useContext(TenantContext)
