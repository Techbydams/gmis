// ============================================================
// GMIS — Tenant Context
// Faithful port of the Vite TenantContext.tsx.
//
// Web:    reads subdomain from window.location (getTenantSlug)
// Native: reads stored slug from AsyncStorage
//
// Exposes the same shape as the Vite version:
//   { tenant, slug, loading, error, isMainPlatform, tenantDb }
//
// Schema: table = "organizations" (NOT organisations)
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, getTenantClient } from "@/lib/supabase";
import { getTenantSlug } from "@/lib/helpers";
import type { TenantInfo } from "@/types";

// ── Storage key (native only) ──────────────────────────────
const STORED_SLUG_KEY = "gmis:org_slug";

// ── Context shape — matches original Vite version ─────────
interface TenantContextType {
  tenant:          TenantInfo | null;
  slug:            string | null;
  loading:         boolean;
  error:           string | null;
  isMainPlatform:  boolean;
  tenantDb:        SupabaseClient | null;
  // Extra for native: set slug manually (from FindSchool screen)
  setTenantSlug:   (slug: string) => Promise<void>;
}

const TenantContext = createContext<TenantContextType>({
  tenant:         null,
  slug:           null,
  loading:        true,
  error:          null,
  isMainPlatform: true,
  tenantDb:       null,
  setTenantSlug:  async () => {},
});

// ── Provider ───────────────────────────────────────────────
export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant,   setTenant]   = useState<TenantInfo | null>(null);
  const [slug,     setSlug]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [tenantDb, setTenantDb] = useState<SupabaseClient | null>(null);

  // ── Core loader ────────────────────────────────────────
  const loadTenant = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select(`
          id, name, slug, logo_url, supabase_url, supabase_anon_key, status,
          org_feature_toggles ( is_enabled, features ( key ) )
        `)
        .eq("slug", s.toLowerCase().trim())
        .single();

      if (orgError || !org) {
        setError(`School "${s}" is not registered on GMIS.`);
        setLoading(false);
        return;
      }

      const o = org as any;

      // Status checks — mirrors Vite version exactly
      if (o.status === "locked") {
        setError(
          `The portal for "${o.name}" has been temporarily locked. Contact your school administrator.`
        );
        setLoading(false);
        return;
      }
      if (o.status === "suspended") {
        setError(
          `The portal for "${o.name}" has been suspended. Contact GMIS support.`
        );
        setLoading(false);
        return;
      }
      if (o.status !== "approved") {
        setError(
          `"${o.name}" is not yet approved on GMIS. Check back later.`
        );
        setLoading(false);
        return;
      }

      // Build tenant client
      const client = getTenantClient(o.supabase_url, o.supabase_anon_key, o.slug);
      setTenantDb(client);

      // Resolve feature flags
      const features: string[] = (o.org_feature_toggles || [])
        .filter((t: any) => t.is_enabled && t.features?.key)
        .map((t: any) => t.features.key as string);

      setTenant({
        slug:              o.slug,
        name:              o.name,
        logo_url:          o.logo_url ?? undefined,
        supabase_url:      o.supabase_url,
        supabase_anon_key: o.supabase_anon_key,
        status:            o.status,
        features,
      });

      setSlug(o.slug);

      // Persist for native (no subdomains)
      if (Platform.OS !== "web") {
        try {
          await AsyncStorage.setItem(STORED_SLUG_KEY, o.slug);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      console.error("Tenant load error:", err);
      setError("Failed to load school information. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Init on mount ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      // 1. Web: try subdomain
      const subdomain = getTenantSlug();
      if (subdomain) {
        await loadTenant(subdomain);
        return;
      }

      // 2. Native: try stored slug from AsyncStorage
      if (Platform.OS !== "web") {
        try {
          const stored = await AsyncStorage.getItem(STORED_SLUG_KEY);
          if (stored) {
            await loadTenant(stored);
            return;
          }
        } catch { /* storage unavailable */ }
      }

      // 3. No slug — main platform or school picker needed
      setLoading(false);
    }

    init();
  }, [loadTenant]);

  // ── Public setTenantSlug (called from FindSchool screen) ─
  const setTenantSlug = useCallback(
    async (s: string) => {
      await loadTenant(s);
    },
    [loadTenant]
  );

  // Slug is null when on main platform (gmis.app with no subdomain)
  const isMainPlatform = slug === null && !loading;

  return (
    <TenantContext.Provider
      value={{
        tenant,
        slug,
        loading,
        error,
        isMainPlatform,
        tenantDb,
        setTenantSlug,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────
export function useTenant(): TenantContextType {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}
