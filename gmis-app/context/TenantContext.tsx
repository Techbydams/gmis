// ============================================================
// GMIS — Tenant Context (FIXED)
//
// KEY FIX: Added setTenantFromOrg() method.
// When find-school already has the org object (including
// supabase_url + supabase_anon_key), we skip the second
// DB query entirely. This eliminates the infinite spinner
// caused by the second query failing or being slow.
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
import type { TenantInfo, Organization } from "@/types";

const STORED_SLUG_KEY  = "gmis:org_slug";
const STORED_ORG_KEY   = (slug: string) => `gmis:org_cache:${slug}`;
const ORG_CACHE_TTL    = 60 * 60 * 1000; // 1 hour

interface TenantContextType {
  tenant:          TenantInfo | null;
  slug:            string | null;
  loading:         boolean;
  error:           string | null;
  isMainPlatform:  boolean;
  tenantDb:        SupabaseClient | null;
  // Expo Router alias — same as tenantDb
  tenantClient:    SupabaseClient | null;
  // Set tenant by slug (re-queries DB)
  setTenantSlug:   (slug: string) => Promise<void>;
  // Set tenant directly from org object — NO second DB query
  setTenantFromOrg: (org: Organization) => Promise<void>;
  clearTenant:     () => void;
}

const TenantContext = createContext<TenantContextType>({
  tenant: null, slug: null, loading: true,
  error: null, isMainPlatform: true,
  tenantDb: null, tenantClient: null,
  setTenantSlug: async () => {},
  setTenantFromOrg: async () => {},
  clearTenant: () => {},
});

// ── Provider ───────────────────────────────────────────────
export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant,   setTenant]   = useState<TenantInfo | null>(null);
  const [slug,     setSlug]     = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [tenantDb, setTenantDb] = useState<SupabaseClient | null>(null);

  // ── Set tenant directly from org object ───────────────
  // Use this when you already have the org data.
  // Avoids a second DB round-trip.
  const setTenantFromOrg = useCallback(async (org: Organization) => {
    if (!org.supabase_url || !org.supabase_anon_key) {
      setError(`School portal not fully configured. Contact your admin.`);
      return;
    }

    if (org.status === "locked") {
      setError(`The portal for "${org.name}" has been temporarily locked.`);
      return;
    }
    if (org.status === "suspended") {
      setError(`The portal for "${org.name}" has been suspended.`);
      return;
    }
    if (org.status !== "approved") {
      setError(`"${org.name}" is not yet approved on GMIS.`);
      return;
    }

    const client = getTenantClient(org.supabase_url, org.supabase_anon_key, org.slug);
    setTenantDb(client);
    setTenant({
      slug:              org.slug,
      name:              org.name,
      logo_url:          org.logo_url ?? undefined,
      supabase_url:      org.supabase_url,
      supabase_anon_key: org.supabase_anon_key,
      status:            org.status,
      features:          [],
    });
    setSlug(org.slug);
    setError(null);

    // Persist for native
    if (Platform.OS !== "web") {
      try { await AsyncStorage.setItem(STORED_SLUG_KEY, org.slug); } catch {}
    }
  }, []);

  // ── Set tenant by slug (queries DB) ───────────────────
  const loadTenant = useCallback(async (s: string) => {
    setLoading(true);
    setError(null);

    // ── Fast path: use cached org if fresh ──────────────
    try {
      const raw = await AsyncStorage.getItem(STORED_ORG_KEY(s));
      if (raw) {
        const cached = JSON.parse(raw) as Organization & { _ts: number };
        if (cached._ts && Date.now() - cached._ts < ORG_CACHE_TTL) {
          await setTenantFromOrg(cached);
          setLoading(false);
          // Refresh cache in background — no await
          supabase
            .from("org_public")
            .select("id, name, slug, logo_url, supabase_url, supabase_anon_key, status")
            .eq("slug", s.toLowerCase().trim())
            .maybeSingle()
            .then(({ data: fresh }) => {
              if (fresh) AsyncStorage.setItem(STORED_ORG_KEY(s), JSON.stringify({ ...fresh, _ts: Date.now() })).catch(() => {});
            });
          return;
        }
      }
    } catch {}

    // ── Slow path: DB query ──────────────────────────────
    try {
      const { data: org, error: orgError } = await supabase
        .from("org_public")
        .select("id, name, slug, logo_url, supabase_url, supabase_anon_key, status")
        .eq("slug", s.toLowerCase().trim())
        .maybeSingle();

      if (orgError) {
        console.error("TenantContext loadTenant error:", orgError);
        setError(`Could not load school info. Check your connection.`);
        setLoading(false);
        return;
      }

      if (!org) {
        setError(`School "${s}" is not registered on GMIS.`);
        setLoading(false);
        return;
      }

      await setTenantFromOrg(org as Organization);
      // Save to cache
      AsyncStorage.setItem(STORED_ORG_KEY(s), JSON.stringify({ ...org, _ts: Date.now() })).catch(() => {});
    } catch (err) {
      console.error("TenantContext exception:", err);
      setError("Failed to load school information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [setTenantFromOrg]);

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // Web: try subdomain
      if (Platform.OS === "web") {
        const subdomain = getTenantSlug();
        if (subdomain) {
          await loadTenant(subdomain);
          return;
        }
        // No subdomain (gmis.app or localhost) — not a tenant page
        setLoading(false);
        return;
      }

      // Native: try stored slug
      try {
        const stored = await AsyncStorage.getItem(STORED_SLUG_KEY);
        if (stored) {
          await loadTenant(stored);
          return;
        }
      } catch {}

      setLoading(false);
    }

    init();
  }, [loadTenant]);

  const setTenantSlug = useCallback(
    async (s: string) => { await loadTenant(s); },
    [loadTenant]
  );

  const clearTenant = useCallback(() => {
    setTenant(null);
    setTenantDb(null);
    setSlug(null);
    setError(null);
    try { AsyncStorage.removeItem(STORED_SLUG_KEY); } catch {}
  }, []);

  const isMainPlatform = !slug && !loading;

  return (
    <TenantContext.Provider value={{
      tenant, slug, loading, error,
      isMainPlatform,
      tenantDb,
      tenantClient: tenantDb,   // alias
      setTenantSlug,
      setTenantFromOrg,
      clearTenant,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be inside <TenantProvider>");
  return ctx;
}
