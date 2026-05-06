-- =============================================================
-- GMIS — DB Fixes
-- Run this in the TENANT Supabase project SQL editor
-- (project: lwcwfofplegdgdsvwbus)
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX 1: Add 'rejected' to students status check constraint
--
-- Root cause: students_status_check only allows
-- ('pending','active','suspended','graduated','withdrawn')
-- Admin's "Reject" button writes status='rejected' → constraint
-- violation → "Failed to reject." toast.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_status_check CHECK (
    status = ANY (ARRAY[
      'pending',
      'active',
      'suspended',
      'graduated',
      'withdrawn',
      'rejected'        -- ← added
    ])
  );


-- ─────────────────────────────────────────────────────────────
-- FIX 2: Link a parent user to their ward (test data)
--
-- Parents are identified by students.parent_supabase_uid.
-- If a parent logs in and sees "No wards found", it means no
-- student row has their auth UID in that column.
--
-- Steps:
--   1. Create a parent user in Authentication → Users in the
--      Supabase dashboard (use their email + password).
--   2. Copy the UUID from the "UID" column.
--   3. Replace the placeholder below and run this query.
-- ─────────────────────────────────────────────────────────────

-- Example (replace both values with real ones):
-- UPDATE public.students
--   SET parent_supabase_uid = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
--   WHERE matric_number = 'CSC/2022/001';

-- To see all students without a linked parent:
-- SELECT id, first_name, last_name, matric_number, parent_supabase_uid
-- FROM public.students
-- ORDER BY created_at DESC;
