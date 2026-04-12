-- ============================================================
-- GMIS — Platform DB Security Fixes
-- Project: arbgvtpjcvfcckepdhef (gmis master)
--
-- Run this in the Platform Supabase SQL Editor.
-- Safe to re-run — all policies are dropped before recreation.
--
-- GMIS · A product of DAMS Technologies · gmis.app
-- ============================================================

-- ============================================================
-- FIX 1 — Enable RLS on all platform tables
-- ============================================================

ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_feature_toggles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE features               ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_payments           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FIX 2 — Drop all existing policies before recreating
--          (makes this script idempotent / safe to re-run)
-- ============================================================

-- organizations
DROP POLICY IF EXISTS public_read_approved_orgs ON organizations;
DROP POLICY IF EXISTS allow_org_registration    ON organizations;
DROP POLICY IF EXISTS allow_org_update          ON organizations;
DROP POLICY IF EXISTS allow_org_insert          ON organizations;

-- org_feature_toggles
DROP POLICY IF EXISTS public_read_feature_toggles ON org_feature_toggles;
DROP POLICY IF EXISTS allow_toggle_update         ON org_feature_toggles;
DROP POLICY IF EXISTS allow_toggle_upsert         ON org_feature_toggles;

-- organization_documents
DROP POLICY IF EXISTS allow_doc_select ON organization_documents;
DROP POLICY IF EXISTS allow_doc_insert ON organization_documents;
DROP POLICY IF EXISTS allow_doc_upload ON organization_documents;

-- audit_logs
DROP POLICY IF EXISTS allow_audit_insert ON audit_logs;
DROP POLICY IF EXISTS admin_read_audit   ON audit_logs;

-- subscription_plans
DROP POLICY IF EXISTS public_read_plans ON subscription_plans;

-- features
DROP POLICY IF EXISTS public_read_features ON features;

-- org_payments
DROP POLICY IF EXISTS admin_read_org_payments   ON org_payments;
DROP POLICY IF EXISTS admin_insert_org_payments ON org_payments;

-- platform_admins
DROP POLICY IF EXISTS admin_read_self ON platform_admins;

-- ============================================================
-- FIX 3 — organizations policies
-- ============================================================
-- The anon client must read org info to resolve tenant portals.
-- SELECT is restricted to 'approved' orgs, and only safe columns
-- (service key is hidden via the org_public view — see FIX 6).

-- Any anon/authenticated user can read approved orgs
CREATE POLICY public_read_approved_orgs ON organizations
  FOR SELECT
  USING (status = 'approved');

-- Institutions register themselves (status must start as 'pending',
-- and they must NEVER be allowed to set Supabase keys themselves)
CREATE POLICY allow_org_registration ON organizations
  FOR INSERT
  WITH CHECK (
    status               = 'pending'
    AND supabase_url         IS NULL
    AND supabase_service_key IS NULL
  );

-- Duplicate INSERT policy removed (allow_org_insert was identical to
-- allow_org_registration — only one INSERT policy needed)

-- Only platform admins (authenticated via Supabase Auth) can update orgs
CREATE POLICY allow_org_update ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid()
      AND   p.is_active    = TRUE
    )
  );

-- ============================================================
-- FIX 4 — org_feature_toggles policies
-- ============================================================

-- Any user can read feature toggles for approved orgs
-- (used by tenant portals to know which features are on)
CREATE POLICY public_read_feature_toggles ON org_feature_toggles
  FOR SELECT
  USING (
    org_id IN (SELECT id FROM organizations WHERE status = 'approved')
  );

-- Only platform admins can toggle features
CREATE POLICY allow_toggle_update ON org_feature_toggles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

CREATE POLICY allow_toggle_upsert ON org_feature_toggles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

-- ============================================================
-- FIX 5 — organization_documents, audit_logs, payments policies
-- ============================================================

-- Documents: institutions can upload (INSERT), admin sees all
CREATE POLICY allow_doc_select ON organization_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

CREATE POLICY allow_doc_insert ON organization_documents
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY allow_doc_upload ON organization_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

-- Audit logs: anyone authenticated can insert, only admins can read
CREATE POLICY allow_audit_insert ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY admin_read_audit ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

-- Subscription plans: public read (pricing page, registration form)
CREATE POLICY public_read_plans ON subscription_plans
  FOR SELECT
  USING (is_active = TRUE);

-- Features catalogue: public read
CREATE POLICY public_read_features ON features
  FOR SELECT
  USING (TRUE);

-- Org payments: platform admin only
CREATE POLICY admin_read_org_payments ON org_payments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

CREATE POLICY admin_insert_org_payments ON org_payments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM platform_admins p
      WHERE p.supabase_uid = auth.uid() AND p.is_active = TRUE
    )
  );

-- Platform admins table: each admin can only read their own row
CREATE POLICY admin_read_self ON platform_admins
  FOR SELECT
  USING (supabase_uid = auth.uid());

-- ============================================================
-- FIX 6 — Safe public view (hides supabase_service_key)
-- ============================================================
-- TenantContext queries this view instead of the full table.
-- Only safe columns are exposed — service key stays hidden.

CREATE OR REPLACE VIEW public.org_public AS
  SELECT
    id,
    name,
    slug,
    logo_url,
    supabase_url,
    supabase_anon_key,
    status,
    type,
    state,
    country
  FROM organizations
  WHERE status = 'approved';

GRANT SELECT ON public.org_public TO anon, authenticated;

-- Revoke direct table SELECT from anon/authenticated so they
-- are forced through the safe view and cannot read the service key
REVOKE SELECT ON organizations FROM anon, authenticated;

-- ============================================================
-- FIX 7 — Fix function search_path (prevents schema injection)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.provision_org_features(p_org_id UUID)
  RETURNS VOID
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO org_feature_toggles (org_id, feature_id, is_enabled)
  SELECT p_org_id, id, TRUE
  FROM features
  ON CONFLICT (org_id, feature_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_org_approved()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM provision_org_features(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Also fix trial expiry (was missing from the original function)
CREATE OR REPLACE FUNCTION public.auto_lock_overdue_orgs()
  RETURNS VOID
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Lock paid subscriptions that have expired
  UPDATE organizations
  SET
    status         = 'locked',
    locked_at      = NOW(),
    lock_reason    = 'Subscription payment overdue',
    payment_status = 'overdue'
  WHERE
    status         = 'approved'
    AND payment_status = 'paid'
    AND subscription_end < NOW();

  -- Lock trial orgs whose trial has expired (was missing before)
  UPDATE organizations
  SET
    status         = 'locked',
    locked_at      = NOW(),
    lock_reason    = 'Free trial expired',
    payment_status = 'overdue'
  WHERE
    status         = 'approved'
    AND payment_status = 'trial'
    AND trial_ends_at  < NOW();
END;
$$;

-- ============================================================
-- DONE — Manual steps still required after this script
-- ============================================================
-- 1. Enable "Leaked Password Protection":
--    Supabase Dashboard → Authentication → Settings →
--    Enable "Prevent use of leaked passwords"
--
-- 2. Set up pg_cron for nightly auto-lock:
--    a. Database → Extensions → enable pg_cron
--    b. Run: SELECT cron.schedule(
--              'lock-overdue-orgs',
--              '0 2 * * *',
--              'SELECT public.auto_lock_overdue_orgs()'
--            );
--
-- 3. Update TenantContext.tsx to query org_public instead of organizations:
--    .from("org_public").select("id,name,slug,logo_url,supabase_url,supabase_anon_key,status")
--    .eq("slug", s.toLowerCase().trim())
-- ============================================================
