-- ============================================================
-- GMIS — Tenant Database Setup SQL
-- Run this on a fresh Supabase project to provision a new institution.
--
-- Covers every table, constraint, function, trigger, seed data,
-- and RLS policy used by the GMIS tenant portal.
--
-- Usage:
--   1. Create a new Supabase project for the institution.
--   2. Open the SQL Editor and run this entire file.
--   3. Fill in org_settings with the institution's real data.
--   4. Update organizations table in the PLATFORM DB with the
--      new project's URL + anon key.
--
-- GMIS · A product of DAMS Technologies · gmis.app
-- ============================================================

-- Enable UUID extension (usually pre-enabled on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECTION 1 — CORE ACADEMIC STRUCTURE
-- ============================================================

-- ── Academic Sessions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR NOT NULL,              -- e.g. "2024/2025"
  start_year INT     NOT NULL,
  end_year   INT     NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT academic_sessions_years_check CHECK (end_year > start_year),
  CONSTRAINT academic_sessions_start_year_end_year_key UNIQUE (start_year, end_year)
);

-- ── Semesters ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS semesters (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  name       VARCHAR NOT NULL,             -- "First Semester", "Second Semester"
  start_date DATE,
  end_date   DATE,
  is_open    BOOLEAN DEFAULT FALSE,        -- registration window open
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT semesters_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  CONSTRAINT semesters_session_id_name_key UNIQUE (session_id, name)
);

-- ── Faculties ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS faculties (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR NOT NULL,
  code       VARCHAR NOT NULL UNIQUE,      -- e.g. "FENS"
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Departments ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR NOT NULL,
  code       VARCHAR NOT NULL UNIQUE,      -- e.g. "CSC"
  faculty_id UUID REFERENCES faculties(id) ON DELETE SET NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Grading System ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS grading_system (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grade       VARCHAR NOT NULL UNIQUE,     -- "A", "B", "C", "D", "E", "F"
  min_score   NUMERIC NOT NULL,
  max_score   NUMERIC NOT NULL,
  grade_point NUMERIC NOT NULL,
  remark      VARCHAR,                     -- "Pass", "Fail", etc.
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT grading_system_range_check  CHECK (max_score >= min_score),
  CONSTRAINT grading_system_score_check  CHECK (min_score >= 0 AND max_score <= 100),
  CONSTRAINT grading_system_point_check  CHECK (grade_point >= 0 AND grade_point <= 5)
);

-- ── Fee Types ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_types (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR NOT NULL,   -- "Tuition", "Development Levy", etc.
  description          TEXT,
  paystack_subaccount  VARCHAR,            -- optional Paystack split code
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 2 — PEOPLE
-- ============================================================

-- ── Admin Users ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid        UUID UNIQUE,
  email               VARCHAR NOT NULL UNIQUE,
  full_name           VARCHAR NOT NULL,
  role                VARCHAR NOT NULL DEFAULT 'admin',
  is_active           BOOLEAN DEFAULT TRUE,
  profile_picture_url TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT admin_users_role_check CHECK (
    role = ANY (ARRAY['super_admin','admin','registrar','bursary'])
  )
);

-- ── Lecturers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecturers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid        UUID UNIQUE,
  email               VARCHAR NOT NULL UNIQUE,
  full_name           VARCHAR NOT NULL,
  staff_id            VARCHAR,
  department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  phone               VARCHAR,
  profile_photo       VARCHAR,
  profile_picture_url TEXT,
  specialization      VARCHAR,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── Students ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS students (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_uid          UUID UNIQUE,
  matric_number         VARCHAR NOT NULL UNIQUE,
  application_no        VARCHAR,
  email                 VARCHAR NOT NULL UNIQUE,
  email_verified        BOOLEAN DEFAULT FALSE,
  first_name            VARCHAR NOT NULL,
  last_name             VARCHAR NOT NULL,
  other_names           VARCHAR,
  date_of_birth         DATE,
  gender                VARCHAR,
  phone                 VARCHAR,
  address               TEXT,
  state_of_origin       VARCHAR,
  profile_photo         TEXT,
  profile_picture_url   TEXT,
  id_card_photo_url     TEXT,
  department_id         UUID REFERENCES departments(id) ON DELETE SET NULL,
  level                 VARCHAR NOT NULL DEFAULT '100',
  mode_of_entry         VARCHAR DEFAULT 'utme',
  entry_session         VARCHAR,
  entry_year            VARCHAR,
  current_session       VARCHAR,
  gpa                   NUMERIC(4,2) DEFAULT 0,
  cgpa                  NUMERIC(4,2) DEFAULT 0,
  status                VARCHAR DEFAULT 'pending',
  approved_at           TIMESTAMPTZ,
  id_card_printed       BOOLEAN DEFAULT FALSE,
  id_card_paid          BOOLEAN DEFAULT FALSE,
  parent_email          VARCHAR,
  parent_supabase_uid   UUID,             -- parent auth UID (no separate table)
  force_password_reset  BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT students_status_check CHECK (
    status = ANY (ARRAY['pending','active','suspended','graduated','withdrawn'])
  ),
  CONSTRAINT students_level_check CHECK (
    level = ANY (ARRAY['100','200','300','400','500','600'])
  ),
  CONSTRAINT students_gender_check CHECK (
    gender IS NULL OR lower(gender) = ANY (ARRAY['male','female','other','prefer not to say'])
  ),
  CONSTRAINT students_mode_of_entry_check CHECK (
    mode_of_entry = ANY (ARRAY['utme','direct_entry','transfer'])
  )
);

-- ============================================================
-- SECTION 3 — COURSES & REGISTRATION
-- ============================================================

-- ── Courses ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_code   VARCHAR NOT NULL UNIQUE,   -- "CSC 301"
  course_name   VARCHAR NOT NULL,
  credit_units  INT NOT NULL DEFAULT 2,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  level         VARCHAR,
  semester      VARCHAR,
  lecturer_id   UUID REFERENCES lecturers(id) ON DELETE SET NULL,
  description   TEXT,
  max_students  INT,
  session       VARCHAR,
  is_active     BOOLEAN DEFAULT TRUE,
  is_elective   BOOLEAN DEFAULT FALSE,
  is_general    BOOLEAN DEFAULT FALSE,     -- cross-departmental general studies
  published     BOOLEAN DEFAULT FALSE,
  is_locked     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT courses_level_check CHECK (
    level IS NULL OR level = ANY (ARRAY['100','200','300','400','500','600'])
  ),
  CONSTRAINT courses_semester_check CHECK (
    semester IS NULL OR lower(semester) = ANY (
      ARRAY['first','second','third','first semester','second semester','third semester']
    )
  )
);

-- ── Course → Departments (general courses span depts) ─────
CREATE TABLE IF NOT EXISTS course_departments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT course_departments_course_id_department_id_key UNIQUE (course_id, department_id)
);

-- ── Semester Registrations ────────────────────────────────
CREATE TABLE IF NOT EXISTS semester_registrations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session       VARCHAR NOT NULL,
  semester      VARCHAR NOT NULL,
  status        VARCHAR DEFAULT 'registered',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT semester_registrations_status_check CHECK (
    status = ANY (ARRAY['registered','dropped','completed'])
  ),
  CONSTRAINT semester_registrations_student_id_course_id_session_semeste_key
    UNIQUE (student_id, course_id, session, semester)
);

-- ── Course Edit Requests ──────────────────────────────────
CREATE TABLE IF NOT EXISTS course_edit_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES students(id),
  registration_id UUID REFERENCES semester_registrations(id),
  request_type    VARCHAR NOT NULL,       -- 'edit', 'add', 'drop'
  old_course_id   UUID REFERENCES courses(id),
  new_course_id   UUID REFERENCES courses(id),
  reason          TEXT,
  status          VARCHAR DEFAULT 'pending',
  reviewed_by     UUID REFERENCES admin_users(id),
  reviewed_at     TIMESTAMPTZ,
  session         VARCHAR,
  semester        VARCHAR,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT course_edit_requests_request_type_check CHECK (
    request_type = ANY (ARRAY['edit','add','drop'])
  ),
  CONSTRAINT course_edit_requests_status_check CHECK (
    status = ANY (ARRAY['pending','approved','rejected'])
  )
);

-- ============================================================
-- SECTION 4 — RESULTS & GRADING
-- ============================================================

-- ── Results ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS results (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecturer_id  UUID REFERENCES lecturers(id),
  uploaded_by  UUID REFERENCES lecturers(id),
  session      VARCHAR NOT NULL,
  semester     VARCHAR NOT NULL,
  ca_score     NUMERIC(5,2),             -- Continuous Assessment
  exam_score   NUMERIC(5,2),            -- Examination score
  score        NUMERIC(5,2),            -- Total (ca + exam)
  grade        VARCHAR,                  -- "A", "B", "C", "D", "F"
  grade_point  NUMERIC(3,1),            -- 5.0, 4.0, 3.0, 2.0, 0.0
  remark       VARCHAR DEFAULT 'pending',
  published    BOOLEAN DEFAULT FALSE,    -- visible to student
  released_at  TIMESTAMPTZ,
  released_by  UUID,
  is_locked    BOOLEAN DEFAULT FALSE,    -- locked after submission
  is_submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT results_remark_check CHECK (
    remark = ANY (ARRAY['pass','fail','absent','incomplete','pending'])
  ),
  CONSTRAINT results_student_id_course_id_session_semester_key
    UNIQUE (student_id, course_id, session, semester)
);

-- ============================================================
-- SECTION 5 — TIMETABLE & ATTENDANCE
-- ============================================================

-- ── Class Timetable ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES lecturers(id),
  day_of_week VARCHAR NOT NULL,           -- "monday", "tuesday", …
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  venue       VARCHAR,
  session     VARCHAR,
  semester    VARCHAR,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT timetable_day_of_week_check CHECK (
    day_of_week = ANY (ARRAY['monday','tuesday','wednesday','thursday','friday','saturday'])
  )
);

-- ── Exam Timetable ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exam_timetable (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exam_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  venue        VARCHAR,
  session      VARCHAR,
  semester     VARCHAR,
  instructions TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── QR Codes (for attendance) ─────────────────────────────
CREATE TABLE IF NOT EXISTS qr_codes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES lecturers(id),
  class_date  DATE NOT NULL,
  venue       VARCHAR,
  expires_at  TIMESTAMPTZ NOT NULL,       -- QR is valid until this time
  used_count  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attendance Records ────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  qr_code_id  UUID,                       -- which QR was scanned
  class_date  DATE NOT NULL,
  status      VARCHAR DEFAULT 'present',
  session     VARCHAR,
  device_id   TEXT,                        -- device fingerprint (anti-proxy)
  device_hash VARCHAR,
  gps_lat     NUMERIC,
  gps_lng     NUMERIC,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT attendance_records_status_check CHECK (
    status = ANY (ARRAY['present','absent','late','excused'])
  ),
  CONSTRAINT attendance_records_student_id_course_id_class_date_key
    UNIQUE (student_id, course_id, class_date)
);

-- ============================================================
-- SECTION 6 — FEES & PAYMENTS
-- ============================================================

-- ── Fee Structure ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fee_structure (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fee_type_id        UUID NOT NULL REFERENCES fee_types(id) ON DELETE CASCADE,
  name               VARCHAR,
  description        TEXT,
  amount             NUMERIC(12,2) NOT NULL,
  session            VARCHAR NOT NULL,
  semester           VARCHAR,             -- NULL = applies to whole session
  level              VARCHAR,             -- NULL = applies to all levels
  department_id      UUID REFERENCES departments(id),  -- NULL = all depts
  payment_gateway_id UUID,
  is_active          BOOLEAN DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ── Payment Gateways ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_gateways (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gateway     VARCHAR NOT NULL UNIQUE,    -- 'paystack', 'flutterwave', etc.
  is_enabled  BOOLEAN DEFAULT FALSE,
  is_default  BOOLEAN DEFAULT FALSE,
  test_mode   BOOLEAN DEFAULT TRUE,
  credentials JSONB,                      -- {secret_key, public_key, ...}
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT payment_gateways_gateway_check CHECK (
    gateway = ANY (ARRAY['paystack','flutterwave','remita','interswitch','squad','custom'])
  )
);

-- ── Student Payments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type_id  UUID REFERENCES fee_types(id),
  amount       NUMERIC(12,2) NOT NULL,
  reference    VARCHAR NOT NULL UNIQUE,   -- our internal reference
  paystack_ref VARCHAR,                   -- gateway reference
  status       VARCHAR DEFAULT 'pending',
  session      VARCHAR,
  semester     VARCHAR,
  paid_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT student_payments_status_check CHECK (
    status = ANY (ARRAY['pending','success','failed','refunded'])
  )
);

-- ============================================================
-- SECTION 7 — COMMUNICATION & SOCIAL
-- ============================================================

-- ── Notifications ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL,           -- student or lecturer UID
  title           VARCHAR NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR DEFAULT 'info',
  action_url      VARCHAR,
  attachment_url  TEXT,
  attachment_type VARCHAR,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (
    type IS NULL OR type = ANY (ARRAY['info','warning','success','alert','result','payment','announcement','general'])
  ),
  CONSTRAINT notifications_attachment_type_check CHECK (
    attachment_type IS NULL OR attachment_type = ANY (ARRAY['image','pdf'])
  )
);

-- ── News / Announcements Board ────────────────────────────
CREATE TABLE IF NOT EXISTS news (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR NOT NULL,
  content      TEXT NOT NULL,
  image_url    VARCHAR,
  author_name  VARCHAR,
  is_published BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Announcements (targeted) ──────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title           VARCHAR NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR DEFAULT 'announcement',
  attachment_url  TEXT,
  attachment_type VARCHAR,
  target_audience VARCHAR DEFAULT 'all',  -- 'all', 'students', 'lecturers', 'level_100', …
  session         VARCHAR,
  is_published    BOOLEAN DEFAULT FALSE,
  created_by      UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT announcements_type_check CHECK (
    type = ANY (ARRAY['announcement','result','payment','alert','general','info'])
  ),
  CONSTRAINT announcements_attachment_type_check CHECK (
    attachment_type = ANY (ARRAY['image','pdf'])
  ),
  CONSTRAINT announcements_target_audience_check CHECK (
    target_audience = ANY (ARRAY['all','students','lecturers',
      'level_100','level_200','level_300','level_400','level_500','level_600'])
  )
);

-- ── Chat Messages (course group chat) ────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL,              -- student or lecturer UID
  receiver_id UUID,                       -- NULL = group message
  course_id   UUID REFERENCES courses(id),
  message     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Social Posts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  image_url      VARCHAR,
  likes_count    INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── Post Likes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT post_likes_post_id_student_id_key UNIQUE (post_id, student_id)
);

-- ── Post Comments ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 8 — ACADEMIC CALENDAR & ELECTIONS
-- ============================================================

-- ── Academic Calendar ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_calendar (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       VARCHAR NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  end_date    DATE,
  event_type  VARCHAR NOT NULL DEFAULT 'academic',
  session     VARCHAR,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT academic_calendar_event_type_check CHECK (
    event_type = ANY (ARRAY['academic','exam','registration','holiday','deadline','election'])
  )
);

-- ── Elections ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title            VARCHAR NOT NULL,
  description      TEXT,
  position         VARCHAR NOT NULL,      -- "SUG President", "Dept. Rep", etc.
  start_date       TIMESTAMPTZ NOT NULL,
  end_date         TIMESTAMPTZ NOT NULL,
  status           VARCHAR DEFAULT 'draft',
  scope            VARCHAR DEFAULT 'sug',
  department_id    UUID REFERENCES departments(id) ON DELETE SET NULL,
  nomination_open  BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT elections_status_check CHECK (
    status = ANY (ARRAY['draft','active','closed'])
  ),
  CONSTRAINT elections_scope_check CHECK (
    scope = ANY (ARRAY['sug','departmental'])
  )
);

-- ── Election Candidates ───────────────────────────────────
CREATE TABLE IF NOT EXISTS election_candidates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id       UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES students(id),
  full_name         VARCHAR NOT NULL,
  manifesto         TEXT,
  photo_url         VARCHAR,
  nomination_status VARCHAR DEFAULT 'pending',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT election_candidates_nomination_status_check CHECK (
    nomination_status = ANY (ARRAY['pending','approved','rejected'])
  )
);

-- ── Election Votes ────────────────────────────────────────
-- UNIQUE on (election_id, voter_id) enforces one vote per student per election
CREATE TABLE IF NOT EXISTS election_votes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id  UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES election_candidates(id),
  voter_id     UUID NOT NULL REFERENCES students(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT election_votes_election_id_voter_id_key UNIQUE (election_id, voter_id)
);

-- ============================================================
-- SECTION 9 — CLEARANCE & SETTINGS
-- ============================================================

-- ── Student Clearance ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS clearance_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  department  VARCHAR NOT NULL,           -- "Library", "Bursary", "Dean", etc.
  status      VARCHAR DEFAULT 'pending',
  cleared_by  VARCHAR,
  notes       TEXT,
  session     VARCHAR,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT clearance_items_status_check CHECK (
    status = ANY (ARRAY['pending','cleared','rejected'])
  )
);

-- ── Org Settings (one row per institution) ────────────────
CREATE TABLE IF NOT EXISTS org_settings (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_name             VARCHAR,
  school_logo             VARCHAR,
  school_address          TEXT,
  school_phone            VARCHAR,
  school_email            VARCHAR,
  current_session         VARCHAR,        -- "2024/2025"
  current_semester        VARCHAR,        -- "First Semester"
  allow_self_registration BOOLEAN DEFAULT TRUE,
  registration_open       BOOLEAN DEFAULT FALSE,
  require_fee_before_reg  BOOLEAN DEFAULT FALSE,
  id_card_template        TEXT,           -- base64 or URL of ID card template
  paystack_public_key     VARCHAR,        -- ⚠ Move to payment_gateways
  paystack_secret_key     VARCHAR,        -- ⚠ SECURITY: encrypt or move to vault
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SECTION 10 — FUNCTIONS
-- ============================================================

-- ── update_updated_at (timestamp trigger) ─────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog          -- prevents search_path injection
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── lock_result_on_submit ─────────────────────────────────
-- Automatically locks a result row when it is first submitted
-- by a lecturer, preventing any further edits.
CREATE OR REPLACE FUNCTION public.lock_result_on_submit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only fire when submitted_at transitions from NULL → a value
  IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL THEN
    NEW.is_locked = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- ── calculate_gpa ─────────────────────────────────────────
-- Returns the GPA for a student for a given session + semester.
-- Only counts published results with a valid grade_point.
-- Uses the Nigerian 5-point scale.
CREATE OR REPLACE FUNCTION public.calculate_gpa(
  p_student_id UUID,
  p_session    VARCHAR,
  p_semester   VARCHAR
)
  RETURNS NUMERIC
  LANGUAGE plpgsql
  SET search_path = public, pg_catalog
AS $$
DECLARE
  v_total_points NUMERIC := 0;
  v_total_units  INT     := 0;
BEGIN
  SELECT
    COALESCE(SUM(r.grade_point * c.credit_units), 0),
    COALESCE(SUM(c.credit_units), 0)
  INTO v_total_points, v_total_units
  FROM results r
  JOIN courses c ON r.course_id = c.id
  WHERE r.student_id = p_student_id
    AND r.session    = p_session
    AND r.semester   = p_semester
    AND r.published  = TRUE
    AND r.grade_point IS NOT NULL;

  IF v_total_units = 0 THEN RETURN 0; END IF;
  RETURN ROUND(v_total_points / v_total_units, 2);
END;
$$;

-- ============================================================
-- SECTION 11 — TRIGGERS
-- ============================================================

-- ── Results: lock on submit ───────────────────────────────
DROP TRIGGER IF EXISTS auto_lock_results ON results;
CREATE TRIGGER auto_lock_results
  BEFORE UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION lock_result_on_submit();

-- ── Results: updated_at ───────────────────────────────────
DROP TRIGGER IF EXISTS t_results ON results;
CREATE TRIGGER t_results
  BEFORE UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Lecturers: updated_at ─────────────────────────────────
DROP TRIGGER IF EXISTS t_lecturers ON lecturers;
CREATE TRIGGER t_lecturers
  BEFORE UPDATE ON lecturers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Students: updated_at ──────────────────────────────────
DROP TRIGGER IF EXISTS t_students ON students;
CREATE TRIGGER t_students
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Org Settings: updated_at ──────────────────────────────
DROP TRIGGER IF EXISTS t_org_settings ON org_settings;
CREATE TRIGGER t_org_settings
  BEFORE UPDATE ON org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── News: updated_at ──────────────────────────────────────
DROP TRIGGER IF EXISTS t_news ON news;
CREATE TRIGGER t_news
  BEFORE UPDATE ON news
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Announcements: updated_at ─────────────────────────────
DROP TRIGGER IF EXISTS t_announcements ON announcements;
CREATE TRIGGER t_announcements
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── Payment Gateways: updated_at ──────────────────────────
DROP TRIGGER IF EXISTS t_payment_gateways ON payment_gateways;
CREATE TRIGGER t_payment_gateways
  BEFORE UPDATE ON payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SECTION 12 — INDEXES (performance)
-- ============================================================

-- Students
CREATE INDEX IF NOT EXISTS idx_students_matric    ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_email     ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_uid       ON students(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_students_status    ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_dept      ON students(department_id);

-- Lecturers
CREATE INDEX IF NOT EXISTS idx_lecturers_uid      ON lecturers(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_lecturers_dept     ON lecturers(department_id);

-- Results
CREATE INDEX IF NOT EXISTS idx_results_student    ON results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_course     ON results(course_id);
CREATE INDEX IF NOT EXISTS idx_results_session    ON results(session, semester);
CREATE INDEX IF NOT EXISTS idx_results_published  ON results(published);

-- Semester Registrations
CREATE INDEX IF NOT EXISTS idx_semreg_student     ON semester_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_semreg_course      ON semester_registrations(course_id);

-- Attendance
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_course  ON attendance_records(course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON attendance_records(class_date);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- Social
CREATE INDEX IF NOT EXISTS idx_posts_student      ON social_posts(student_id);

-- Elections
CREATE INDEX IF NOT EXISTS idx_votes_election     ON election_votes(election_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter        ON election_votes(voter_id);

-- Courses
CREATE INDEX IF NOT EXISTS idx_courses_dept       ON courses(department_id);
CREATE INDEX IF NOT EXISTS idx_courses_session    ON courses(session, semester);

-- Chat
CREATE INDEX IF NOT EXISTS idx_chat_course        ON chat_messages(course_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender        ON chat_messages(sender_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_student   ON student_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status    ON student_payments(status);

-- ============================================================
-- SECTION 13 — SEED DATA
-- ============================================================

-- ── Grading System (Nigerian 5-point scale) ───────────────
INSERT INTO grading_system (grade, min_score, max_score, grade_point, remark) VALUES
  ('A',  70, 100, 5.0, 'Excellent'),
  ('B',  60,  69, 4.0, 'Good'),
  ('C',  50,  59, 3.0, 'Average'),
  ('D',  45,  49, 2.0, 'Below Average'),
  ('E',  40,  44, 1.0, 'Pass'),
  ('F',   0,  39, 0.0, 'Fail')
ON CONFLICT (grade) DO NOTHING;

-- ── Default Org Settings Row ──────────────────────────────
-- Fill in with institution's real data after running this script.
INSERT INTO org_settings (
  school_name, current_session, current_semester,
  allow_self_registration, registration_open
) VALUES (
  'Institution Name',
  '2024/2025',
  'First Semester',
  TRUE,
  FALSE
) ON CONFLICT DO NOTHING;

-- ── Default Current Academic Session ─────────────────────
INSERT INTO academic_sessions (name, start_year, end_year, is_current) VALUES
  ('2024/2025', 2024, 2025, TRUE)
ON CONFLICT (start_year, end_year) DO NOTHING;

-- ── Default Semesters ─────────────────────────────────────
WITH sess AS (SELECT id FROM academic_sessions WHERE start_year = 2024 LIMIT 1)
INSERT INTO semesters (session_id, name, is_current, is_open)
SELECT s.id, sem.name, sem.is_current, FALSE
FROM sess s,
  (VALUES
    ('First Semester',  TRUE),
    ('Second Semester', FALSE)
  ) AS sem(name, is_current)
ON CONFLICT (session_id, name) DO NOTHING;

-- ── Paystack Payment Gateway (disabled by default) ────────
INSERT INTO payment_gateways (gateway, is_enabled, is_default, test_mode, credentials) VALUES
  ('paystack', FALSE, TRUE, TRUE, '{"public_key": "", "secret_key": ""}')
ON CONFLICT (gateway) DO NOTHING;

-- ============================================================
-- SECTION 14 — ROW LEVEL SECURITY
-- ============================================================
-- NOTE: GMIS uses application-level auth (app/_layout.tsx AuthGate)
-- as the primary access control layer. Each institution has its own
-- isolated Supabase project. RLS provides a second layer of defence.
--
-- Enabling RLS below closes the gap where the anon key alone could
-- be used to query tables via the REST API without going through
-- the app. All policies require auth.uid() to be valid.

-- Enable RLS on all tables
ALTER TABLE faculties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_departments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_edit_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE results                ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable              ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_timetable         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_codes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_types              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structure          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_gateways       ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE news                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_calendar      ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE semesters              ENABLE ROW LEVEL SECURITY;
ALTER TABLE elections              ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_candidates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clearance_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE grading_system         ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements          ENABLE ROW LEVEL SECURITY;

-- ── Public read (any authenticated user) ─────────────────
-- Faculties, departments, courses, timetable: all users can read
CREATE POLICY auth_read_faculties     ON faculties        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_departments   ON departments      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_courses       ON courses          FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);
CREATE POLICY auth_read_timetable     ON timetable        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_exam_tt       ON exam_timetable   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_calendar      ON academic_calendar FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_sessions      ON academic_sessions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_semesters     ON semesters        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_grades        ON grading_system   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_news          ON news             FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = TRUE);
CREATE POLICY auth_read_announcements ON announcements    FOR SELECT USING (auth.uid() IS NOT NULL AND is_published = TRUE);
CREATE POLICY auth_read_fee_types     ON fee_types        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_fee_structure ON fee_structure    FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);
CREATE POLICY auth_read_elections     ON elections        FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_candidates    ON election_candidates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_org_settings  ON org_settings     FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_read_qr            ON qr_codes         FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);
CREATE POLICY auth_read_course_depts  ON course_departments FOR SELECT USING (auth.uid() IS NOT NULL);

-- ── Students: own row only, admin sees all ────────────────
CREATE POLICY student_read_own     ON students FOR SELECT
  USING (supabase_uid = auth.uid());
CREATE POLICY student_insert_self  ON students FOR INSERT
  WITH CHECK (supabase_uid = auth.uid());
-- Admin and lecturer can read students (needed for grade entry, attendance)
CREATE POLICY admin_all_students   ON students FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid() AND a.is_active = TRUE)
    OR
    EXISTS (SELECT 1 FROM lecturers  l WHERE l.supabase_uid = auth.uid() AND l.is_active = TRUE)
  );

-- ── Results: student sees own published, lecturer manages ─
CREATE POLICY student_read_own_published_results ON results FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid())
    AND published = TRUE
  );
CREATE POLICY lecturer_manage_results ON results FOR ALL
  USING (
    lecturer_id IN (SELECT id FROM lecturers WHERE supabase_uid = auth.uid())
    AND is_locked = FALSE
  );
CREATE POLICY admin_all_results ON results FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── Semester registrations: student manages own ───────────
CREATE POLICY student_manage_own_regs ON semester_registrations FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY admin_all_regs ON semester_registrations FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── Student payments: student manages own ────────────────
CREATE POLICY student_manage_own_payments ON student_payments FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY admin_read_payments ON student_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── Notifications: own only ───────────────────────────────
CREATE POLICY auth_read_notifications ON notifications FOR ALL
  USING (user_id = auth.uid());

-- ── Admin writes ──────────────────────────────────────────
CREATE POLICY admin_write_courses     ON courses       FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_faculties   ON faculties     FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_depts       ON departments   FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_fees        ON fee_structure FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_timetable   ON timetable     FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_lecturers   ON lecturers     FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_all_news          ON news          FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_manage_elections  ON elections     FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));
CREATE POLICY admin_write_org_settings ON org_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── Admin users: self read only (no anon listing) ─────────
CREATE POLICY admins_read_self   ON admin_users FOR SELECT
  USING (supabase_uid = auth.uid());
CREATE POLICY admins_can_insert  ON admin_users FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY admins_update_own  ON admin_users FOR UPDATE
  USING (supabase_uid = auth.uid());

-- ── Payment gateways: admin only ─────────────────────────
-- SECURITY: credentials JSONB contains secret keys — restrict tightly
CREATE POLICY admin_manage_gateways ON payment_gateways FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── QR codes: lecturer manages, student reads active ──────
CREATE POLICY lecturer_manage_qr ON qr_codes FOR ALL
  USING (lecturer_id IN (SELECT id FROM lecturers WHERE supabase_uid = auth.uid()));
CREATE POLICY student_read_active_qr ON qr_codes FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND is_active = TRUE
    AND expires_at > NOW()
  );

-- ── Attendance: student marks own, admin/lecturer reads ───
CREATE POLICY student_mark_attendance ON attendance_records FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY admin_read_attendance   ON attendance_records FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()
    UNION ALL
    SELECT 1 FROM lecturers   l WHERE l.supabase_uid = auth.uid()
  ));
CREATE POLICY student_read_own_attendance ON attendance_records FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));

-- ── Social: auth users can read, students post ────────────
CREATE POLICY auth_read_posts     ON social_posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY student_write_post  ON social_posts FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY student_delete_own_post ON social_posts FOR DELETE
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY auth_read_likes     ON post_likes    FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_manage_likes   ON post_likes    FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY auth_read_comments  ON post_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_manage_comments ON post_comments FOR ALL
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));

-- ── Chat: participants only ───────────────────────────────
CREATE POLICY auth_read_chat  ON chat_messages FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY auth_send_chat  ON chat_messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── Clearance: student reads own, admin manages ───────────
CREATE POLICY student_read_clearance ON clearance_items FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY admin_manage_clearance ON clearance_items FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users a WHERE a.supabase_uid = auth.uid()));

-- ── Elections: student votes ──────────────────────────────
CREATE POLICY student_vote ON election_votes FOR INSERT
  WITH CHECK (voter_id IN (SELECT id FROM students WHERE supabase_uid = auth.uid()));
CREATE POLICY student_read_votes ON election_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================
-- DONE
-- ============================================================
-- Next steps:
-- 1. Update org_settings with institution's real name, email, logo
-- 2. Set the correct current_session and current_semester
-- 3. Add faculties and departments
-- 4. Create the first super_admin user via Supabase Auth, then
--    insert a row into admin_users with that supabase_uid
-- 5. Configure payment_gateways with Paystack credentials
-- 6. Update the PLATFORM DB organizations record with this project's
--    supabase_url and supabase_anon_key
-- ============================================================
