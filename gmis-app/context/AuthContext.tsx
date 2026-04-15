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
import { supabase, getTenantClient, clearTenantClientCache } from "@/lib/supabase";
import { cache } from "@/lib/cache";
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

      if (adminData) {
        setUser({
          id:       uid,
          email,
          // super_admin maps to 'admin' role
          role:     (adminData.role === "super_admin" ? "admin" : adminData.role) as AuthUser["role"],
          org_slug: slug || undefined,
        });
      } else if (lecData) {
        setUser({ id: uid, email, role: "lecturer", org_slug: slug || undefined });
      } else if (studentData) {
        setUser({ id: uid, email, role: "student", org_slug: slug || undefined });
      } else if (parentData && parentData.length > 0) {
        setUser({ id: uid, email, role: "parent", org_slug: slug || undefined });
      } else {
        // Fallback to metadata role (set at signup)
        const metaRole = (metadata?.role as string) || "student";
        setUser({
          id: uid, email,
          role: metaRole as AuthUser["role"],
          org_slug: slug || undefined,
        });
      }
    } catch (err) {
      console.error("Role resolution error:", err);
      if (myCount !== resolveCounterRef.current) return;
      // Fallback to metadata
      const metaRole = (metadata?.role as string) || "student";
      setUser({
        id: uid, email,
        role: metaRole as AuthUser["role"],
        org_slug: slug || undefined,
      });
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
      
      const { data: student, error: lookupError } = await client
        .from("students")
        .select("email, matric_number")
        .eq("matric_number", normalizedMatric)
        .maybeSingle();

      console.log(`[GMIS] signInWithMatric lookup result:`, { 
        found: !!student, 
        hasEmail: !!student?.email,
        error: lookupError?.message,
        student 
      });

      if (lookupError)
        return { error: "Could not verify matric number. Please try again." };

      const s = student as any;
      if (!s?.email)
        return { error: "Matric number not found. Contact your registrar." };

      return await signIn(s.email, password);
    } catch {
      return { error: "Network error. Please check your connection and try again." };
    }
  };

  // ── signOut ───────────────────────────────────────────
  const signOut = async () => {
    try {
      await client.auth.signOut();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setUser(null);
      clearTenantClientCache();
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
