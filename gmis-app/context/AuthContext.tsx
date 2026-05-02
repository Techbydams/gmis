// ============================================================
// GMIS — Auth Context
// Faithful port of the Vite AuthContext.tsx.
//
// Key points from original:
// - resolveCounterRef prevents stale state from race conditions
// - Parent is detected via students.parent_supabase_uid
// - Column: supabase_uid (NOT user_id)
// - signInWithMatric is a separate method
// - admin_users.role can be 'super_admin' → maps to 'admin'
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, getTenantClient } from "@/lib/supabase";
import { cache } from "@/lib/cache";

const ROLE_CACHE_KEY = (uid: string) => `gmis:role:${uid}`;
const ROLE_CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
import { useTenant } from "@/context/TenantContext";
import type { AuthUser } from "@/types";

// ── Context shape — matches Vite version ──────────────────
interface AuthContextType {
  user:             AuthUser | null;
  loading:          boolean;
  isAuthenticated:  boolean;
  signIn:           (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithMatric: (matric: string, password: string) => Promise<{ error: string | null }>;
  signOut:          () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user:             null,
  loading:          true,
  isAuthenticated:  false,
  signIn:           async () => ({ error: null }),
  signInWithMatric: async () => ({ error: null }),
  signOut:          async () => {},
});

// ── Provider ───────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { tenant, tenantDb, isMainPlatform, slug } = useTenant();

  // Prevents stale state from parallel role lookups (mirrors Vite version)
  const resolveCounterRef = useRef(0);

  // Choose which Supabase client to auth against
  const client = useMemo(() => {
    if (isMainPlatform || !tenant) return supabase;
    return getTenantClient(
      tenant.supabase_url,
      tenant.supabase_anon_key,
      slug!
    );
  }, [isMainPlatform, tenant, slug]);

  // ── Role resolution ──────────────────────────────────
  // Mirrors the Vite version exactly.
  // Column: supabase_uid (NOT user_id)
  // Parent: via students.parent_supabase_uid
  const resolveRole = async (
    uid:      string,
    email:    string,
    metadata: Record<string, unknown>
  ) => {
    setLoading(true);
    const myCount = ++resolveCounterRef.current;

    // Platform admin — no tenant DB needed
    if (isMainPlatform) {
      if (myCount !== resolveCounterRef.current) return;
      setUser({ id: uid, email, role: "platform_admin" });
      setLoading(false);
      return;
    }

    // ── Fast path: cached role (skips 4 DB queries on startup) ──
    try {
      const raw = await AsyncStorage.getItem(ROLE_CACHE_KEY(uid));
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.uid === uid && Date.now() - cached.ts < ROLE_CACHE_TTL) {
          if (myCount !== resolveCounterRef.current) return;
          setUser({ id: uid, email, role: cached.role, org_slug: cached.org_slug });
          setLoading(false);
          return;
        }
      }
    } catch {}

    try {
      if (!tenantDb) return;

      const [adminRes, lecturerRes, studentRes, parentRes] = await Promise.all([
        tenantDb
          .from("admin_users")
          .select("id, role")
          .eq("supabase_uid", uid)
          .maybeSingle(),
        tenantDb
          .from("lecturers")
          .select("id")
          .eq("supabase_uid", uid)
          .maybeSingle(),
        tenantDb
          .from("students")
          .select("id, status")
          .eq("supabase_uid", uid)
          .maybeSingle(),
        // Parent detection: look for a student whose parent_supabase_uid = uid
        tenantDb
          .from("students")
          .select("id")
          .eq("parent_supabase_uid", uid)
          .limit(1),
      ]);

      if (myCount !== resolveCounterRef.current) return;

      const adminData   = adminRes.data   as any;
      const lecData     = lecturerRes.data as any;
      const studentData = studentRes.data  as any;
      const parentData  = parentRes.data   as any[];

      let resolvedRole: AuthUser["role"];
      if (adminData) {
        resolvedRole = (adminData.role === "super_admin" ? "admin" : adminData.role) as AuthUser["role"];
      } else if (lecData) {
        resolvedRole = "lecturer";
      } else if (studentData) {
        resolvedRole = "student";
      } else if (parentData && parentData.length > 0) {
        resolvedRole = "parent";
      } else {
        resolvedRole = ((metadata?.role as string) || "student") as AuthUser["role"];
      }

      setUser({ id: uid, email, role: resolvedRole, org_slug: slug || undefined });
      // Save resolved role to AsyncStorage — used on next startup to skip DB queries
      AsyncStorage.setItem(ROLE_CACHE_KEY(uid), JSON.stringify({
        uid, role: resolvedRole, org_slug: slug || undefined, ts: Date.now(),
      })).catch(() => {});
    } catch (err) {
      console.error("Role resolution error:", err);
      if (myCount !== resolveCounterRef.current) return;
      // Fallback to metadata
      const metaRole = ((metadata?.role as string) || "student") as AuthUser["role"];
      setUser({ id: uid, email, role: metaRole, org_slug: slug || undefined });
      AsyncStorage.setItem(ROLE_CACHE_KEY(uid), JSON.stringify({
        uid, role: metaRole, org_slug: slug || undefined, ts: Date.now(),
      })).catch(() => {});
    } finally {
      if (myCount === resolveCounterRef.current) setLoading(false);
    }
  };

  // ── Session listener ──────────────────────────────────
  useEffect(() => {
    client.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          resolveRole(
            session.user.id,
            session.user.email!,
            session.user.user_metadata
          );
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    const { data: { subscription } } = client.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          resolveRole(
            session.user.id,
            session.user.email!,
            session.user.user_metadata
          );
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  // ── signIn ────────────────────────────────────────────
  const signIn = async (
    email:    string,
    password: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await client.auth.signInWithPassword({
        email:    email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials"))
          return { error: "Incorrect email or password. Please try again." };
        if (error.message.includes("Email not confirmed"))
          return { error: "Please verify your email first. Check your inbox." };
        if (error.message.includes("Too many requests"))
          return { error: "Too many attempts. Please wait a few minutes." };
        return { error: error.message };
      }

      return { error: null };
    } catch {
      return { error: "Network error. Please check your connection and try again." };
    }
  };

  // ── signInWithMatric ──────────────────────────────────
  // Looks up the student's email by matric number, then signs in normally
  const signInWithMatric = async (
  matric:   string,
  password: string
): Promise<{ error: string | null }> => {
  if (!tenant || !slug) return { error: "School portal not found." };

  try {
    const normalizedMatric = matric.trim().toUpperCase();
    console.log(`[GMIS] signInWithMatric: looking up "${normalizedMatric}" in tenant "${slug}"`);
    
    // ✅ USE THE RPC FUNCTION INSTEAD (bypasses RLS safely)
    const { data: results, error: lookupError } = await client
      .rpc('lookup_student_by_matric', { p_matric: normalizedMatric });

    console.log(`[GMIS] signInWithMatric lookup result:`, { 
      found: !!results && results.length > 0, 
      error: lookupError?.message,
      results 
    });

    if (lookupError)
      return { error: "Could not verify matric number. Please try again." };

    if (!results || results.length === 0 || !results[0]?.email)
      return { error: "Matric number not found. Contact your registrar." };

    const student = results[0];
    return await signIn(student.email, password);
  } catch (err) {
    console.error("signInWithMatric error:", err);
    return { error: "Network error. Please check your connection and try again." };
  }
};

  // ── signOut ───────────────────────────────────────────
  const signOut = async () => {
    const currentUid = user?.id;
    try {
      await client.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      if (currentUid) AsyncStorage.removeItem(ROLE_CACHE_KEY(currentUid)).catch(() => {});
      // NOTE: Do NOT call clearTenantClientCache() here.
      // AuthContext.client is a useMemo reference tied to [isMainPlatform, tenant, slug].
      // If the cache is cleared, the next getTenantClient() call (e.g. in dashboard) creates
      // a NEW client instance with no session — while signIn() still writes to the OLD memo
      // reference. This causes all post-login DB queries to run unauthenticated (RLS blocks → 0).
      // auth.signOut() already invalidates the session on the current client; the cache entry
      // can remain in place so the next login reuses the same instance.
      cache.flush(); // clear all cached screen data on logout
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        signIn,
        signInWithMatric,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
