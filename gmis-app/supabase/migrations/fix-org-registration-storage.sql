-- ============================================================
-- GMIS Platform DB — Organization Registration Support
-- Run this in the PLATFORM Supabase project dashboard
-- Project ref: arbgvtpjcvfcckepdhef
-- ============================================================
-- Fixes "upload section" on the Register Your Institution page.
-- The registration flow is unauthenticated (anon), so we need:
--   1. org-documents storage bucket (public reads, anon uploads)
--   2. organization_documents table with anon insert policy
-- ============================================================

-- ── 1. Create storage bucket ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-documents',
  'org-documents',
  true,
  5242880,   -- 5 MB per file
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public            = true,
  file_size_limit   = 5242880,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- ── 2. Storage RLS policies ───────────────────────────────────
-- Allow anonymous users to upload (registration is pre-auth)
DROP POLICY IF EXISTS "anon_upload_org_docs"  ON storage.objects;
DROP POLICY IF EXISTS "public_read_org_docs"  ON storage.objects;

CREATE POLICY "anon_upload_org_docs" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'org-documents');

CREATE POLICY "public_read_org_docs" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'org-documents');

-- Allow service role full access (for platform admin review)
DROP POLICY IF EXISTS "service_all_org_docs" ON storage.objects;
CREATE POLICY "service_all_org_docs" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'org-documents')
  WITH CHECK (bucket_id = 'org-documents');

-- ── 3. Create organization_documents table ────────────────────
CREATE TABLE IF NOT EXISTS public.organization_documents (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type text        NOT NULL CHECK (document_type IN ('cac', 'nuc', 'letterhead')),
  file_url      text        NOT NULL,
  file_name     text        NOT NULL,
  created_at    timestamptz DEFAULT now()
);

-- ── 4. RLS on organization_documents ──────────────────────────
ALTER TABLE public.organization_documents ENABLE ROW LEVEL SECURITY;

-- Anon can insert (registration flow)
DROP POLICY IF EXISTS "anon_insert_org_docs"   ON public.organization_documents;
DROP POLICY IF EXISTS "service_all_org_docs_t" ON public.organization_documents;

CREATE POLICY "anon_insert_org_docs" ON public.organization_documents
  FOR INSERT TO anon
  WITH CHECK (true);

-- Service role full access (platform admin)
CREATE POLICY "service_all_org_docs_t" ON public.organization_documents
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
