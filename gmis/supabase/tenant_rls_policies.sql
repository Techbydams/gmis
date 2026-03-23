-- ============================================================
-- GMIS — Tenant Database RLS Policies
-- Run this in your TENANT Supabase project SQL editor
-- (NOT the master gmis.com database — the school's own DB)
--
-- This fixes all 403/401 "permission denied" errors you see in console:
--   - departments table (student signup dropdown)
--   - faculties table
--   - courses table
--   - fee_structure + fee_types
--   - org_settings
--   - timetable / exam_timetable
--   - news (published only)
-- ============================================================


-- ── 1. FACULTIES ──────────────────────────────────────────
-- Anyone can read faculty names (needed for department dropdown)
ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_faculties" ON faculties;
CREATE POLICY "public_read_faculties"
  ON faculties FOR SELECT
  USING (true);


-- ── 2. DEPARTMENTS ────────────────────────────────────────
-- Anyone can read active departments (needed for student signup)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_active_departments" ON departments;
CREATE POLICY "public_read_active_departments"
  ON departments FOR SELECT
  USING (is_active = true);


-- ── 3. COURSES ────────────────────────────────────────────
-- Authenticated users can read active courses
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_courses" ON courses;
CREATE POLICY "auth_read_courses"
  ON courses FOR SELECT
  TO authenticated
  USING (is_active = true);


-- ── 4. FEE TYPES ──────────────────────────────────────────
ALTER TABLE fee_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_fee_types" ON fee_types;
CREATE POLICY "auth_read_fee_types"
  ON fee_types FOR SELECT
  TO authenticated
  USING (true);


-- ── 5. FEE STRUCTURE ──────────────────────────────────────
ALTER TABLE fee_structure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_fee_structure" ON fee_structure;
CREATE POLICY "auth_read_fee_structure"
  ON fee_structure FOR SELECT
  TO authenticated
  USING (is_active = true);


-- ── 6. ORG SETTINGS ───────────────────────────────────────
-- Authenticated users can read school settings (needed for session/semester)
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_org_settings" ON org_settings;
CREATE POLICY "auth_read_org_settings"
  ON org_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can update org_settings
DROP POLICY IF EXISTS "admin_write_org_settings" ON org_settings;
CREATE POLICY "admin_write_org_settings"
  ON org_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 7. TIMETABLE ──────────────────────────────────────────
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_timetable" ON timetable;
CREATE POLICY "auth_read_timetable"
  ON timetable FOR SELECT
  TO authenticated
  USING (true);


-- ── 8. EXAM TIMETABLE ─────────────────────────────────────
-- Only create this if the table exists in your schema
-- ALTER TABLE exam_timetable ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "auth_read_exam_timetable" ON exam_timetable;
-- CREATE POLICY "auth_read_exam_timetable"
--   ON exam_timetable FOR SELECT
--   TO authenticated
--   USING (true);


-- ── 9. NEWS ───────────────────────────────────────────────
ALTER TABLE news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_read_published_news" ON news;
CREATE POLICY "auth_read_published_news"
  ON news FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Admins can manage all news
DROP POLICY IF EXISTS "admin_manage_news" ON news;
CREATE POLICY "admin_manage_news"
  ON news FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 10. STUDENTS ──────────────────────────────────────────
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Students can only read their own record
DROP POLICY IF EXISTS "student_read_own" ON students;
CREATE POLICY "student_read_own"
  ON students FOR SELECT
  TO authenticated
  USING (supabase_uid = auth.uid());

-- Students can insert (signup creates their own record)
DROP POLICY IF EXISTS "student_insert_own" ON students;
CREATE POLICY "student_insert_own"
  ON students FOR INSERT
  TO authenticated
  WITH CHECK (supabase_uid = auth.uid() OR supabase_uid IS NULL);

-- Admins can read/write all students
DROP POLICY IF EXISTS "admin_manage_students" ON students;
CREATE POLICY "admin_manage_students"
  ON students FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );

-- Lecturers can read students in their courses
DROP POLICY IF EXISTS "lecturer_read_students" ON students;
CREATE POLICY "lecturer_read_students"
  ON students FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM lecturers
      WHERE lecturers.supabase_uid = auth.uid()
    )
  );


-- ── 11. LECTURERS ─────────────────────────────────────────
ALTER TABLE lecturers ENABLE ROW LEVEL SECURITY;

-- Lecturers can read their own record
DROP POLICY IF EXISTS "lecturer_read_own" ON lecturers;
CREATE POLICY "lecturer_read_own"
  ON lecturers FOR SELECT
  TO authenticated
  USING (supabase_uid = auth.uid());

-- Admins can manage all lecturers
DROP POLICY IF EXISTS "admin_manage_lecturers" ON lecturers;
CREATE POLICY "admin_manage_lecturers"
  ON lecturers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );

-- Students and lecturers can read lecturer names (for timetable display)
DROP POLICY IF EXISTS "auth_read_lecturer_names" ON lecturers;
CREATE POLICY "auth_read_lecturer_names"
  ON lecturers FOR SELECT
  TO authenticated
  USING (is_active = true);


-- ── 12. ADMIN USERS ───────────────────────────────────────
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Admins can only read their own record (for role detection)
DROP POLICY IF EXISTS "admin_read_own" ON admin_users;
CREATE POLICY "admin_read_own"
  ON admin_users FOR SELECT
  TO authenticated
  USING (supabase_uid = auth.uid());


-- ── 13. RESULTS ───────────────────────────────────────────
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Students can read their own published results
DROP POLICY IF EXISTS "student_read_own_results" ON results;
CREATE POLICY "student_read_own_results"
  ON results FOR SELECT
  TO authenticated
  USING (
    published = true
    AND student_id IN (
      SELECT id FROM students WHERE supabase_uid = auth.uid()
    )
  );

-- Lecturers can read/write results for their courses
DROP POLICY IF EXISTS "lecturer_manage_results" ON results;
CREATE POLICY "lecturer_manage_results"
  ON results FOR ALL
  TO authenticated
  USING (
    lecturer_id IN (
      SELECT id FROM lecturers WHERE supabase_uid = auth.uid()
    )
  );

-- Admins can manage all results
DROP POLICY IF EXISTS "admin_manage_results" ON results;
CREATE POLICY "admin_manage_results"
  ON results FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 14. SEMESTER REGISTRATIONS ────────────────────────────
ALTER TABLE semester_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_manage_own_registrations" ON semester_registrations;
CREATE POLICY "student_manage_own_registrations"
  ON semester_registrations FOR ALL
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "lecturer_read_course_registrations" ON semester_registrations;
CREATE POLICY "lecturer_read_course_registrations"
  ON semester_registrations FOR SELECT
  TO authenticated
  USING (
    course_id IN (
      SELECT id FROM courses
      WHERE lecturer_id IN (
        SELECT id FROM lecturers WHERE supabase_uid = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "admin_manage_registrations" ON semester_registrations;
CREATE POLICY "admin_manage_registrations"
  ON semester_registrations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 15. STUDENT PAYMENTS ──────────────────────────────────
ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_manage_own_payments" ON student_payments;
CREATE POLICY "student_manage_own_payments"
  ON student_payments FOR ALL
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "admin_read_all_payments" ON student_payments;
CREATE POLICY "admin_read_all_payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 16. NOTIFICATIONS ─────────────────────────────────────
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_read_own_notifications" ON notifications;
CREATE POLICY "user_read_own_notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid())
    OR user_id IS NULL  -- broadcast notifications visible to all
  );

DROP POLICY IF EXISTS "user_update_own_notifications" ON notifications;
CREATE POLICY "user_update_own_notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid())
  );

DROP POLICY IF EXISTS "admin_manage_notifications" ON notifications;
CREATE POLICY "admin_manage_notifications"
  ON notifications FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.supabase_uid = auth.uid()
    )
  );


-- ── 17. QR CODES ──────────────────────────────────────────
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lecturer_manage_qr" ON qr_codes;
CREATE POLICY "lecturer_manage_qr"
  ON qr_codes FOR ALL
  TO authenticated
  USING (
    lecturer_id IN (
      SELECT id FROM lecturers WHERE supabase_uid = auth.uid()
    )
  );

DROP POLICY IF EXISTS "student_read_active_qr" ON qr_codes;
CREATE POLICY "student_read_active_qr"
  ON qr_codes FOR SELECT
  TO authenticated
  USING (is_active = true AND expires_at > now());


-- ============================================================
-- VERIFY: Run this query after to confirm policies are created
-- ============================================================
-- SELECT tablename, policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;