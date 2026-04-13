# GMIS Security Remediation — April 2026
Source: GMIS_Security_Review.docx

---

## Final Status

| ID | Severity | Vulnerability | Status | How Fixed |
|----|----------|---------------|--------|-----------|
| V-01 | CRITICAL | Supabase RLS Disabled on All Tables | ✅ FIXED | Migration `security_enable_rls_all_tables_and_policies` |
| V-02 | CRITICAL | service_role Key Exposure | ✅ SAFE | Keys are in `.env.local` (gitignored), not `EXPO_PUBLIC_` prefixed — never in client bundle |
| V-03 | HIGH | Multi-Tenant IDOR / Data Isolation | ✅ FIXED | All policies scope by `auth.uid()` / `auth.email()` — no client-supplied tenant IDs trusted |
| V-04 | HIGH | Broken Access Control (Role RLS) | ✅ FIXED | Role-based policies on all 34 tables. Also fixed two critical permissive INSERT policies |
| V-05 | HIGH | Missing HTTP Security Headers | ✅ FIXED | `vercel.json` — added CSP, HSTS, Permissions-Policy, changed X-Frame-Options to DENY |
| V-06 | MEDIUM | Weak Auth / No Rate Limiting | ⚠️ PARTIAL | Leaked password protection needs dashboard action (see below) |
| V-07 | MEDIUM | Push Notification Misconfiguration | ⚠️ DEFERRED | Resolve before EAS production build (noted in CLAUDE.md pending steps) |
| V-08 | MEDIUM | Input Validation / XSS / Injection | ⚠️ DEFERRED | Supabase PostgREST uses parameterized queries. DOMPurify for social/chat: add before launch |
| V-09 | LOW | Verbose Error Messages | ⚠️ DEFERRED | UX fix — replace "GPA: 0.00 / Fail" with neutral state before launch |
| V-FUNC | WARN | Function search_path Mutable | ✅ FIXED | All 3 functions fixed + legacy varchar overload of `calculate_gpa` dropped |
| V-VIEW | ERROR | SECURITY DEFINER view `org_public` | ✅ FIXED | Recreated with `security_invoker = true` on platform DB |

---

## What Was Done — Migrations Applied

### Tenant DB (`lwcwfofplegdgdsvwbus`)

**Migration 1: `security_enable_rls_all_tables_and_policies`**
- Enabled RLS on all 34 public tables (was 0/34 before)
- Added new RLS policies for 18 tables that had none:
  - `academic_calendar`, `academic_sessions`, `announcements`
  - `attendance_records` — student reads own, lecturer reads all, admin full access
  - `chat_messages` — users see only messages they sent/received
  - `clearance_items` — student reads own, admin manages
  - `course_departments`, `course_edit_requests`
  - `election_candidates` — students self-nominate only
  - `election_votes` — **ballot secrecy enforced**: students read only their own vote
  - `elections`, `exam_timetable`, `grading_system`
  - `payment_gateways` — **admin-only** (contains credentials column)
  - `post_comments`, `post_likes`, `semesters`, `social_posts`
- Added `UNIQUE(election_id, voter_id)` constraint on `election_votes` to prevent double voting

**Migration 2: `security_fix_function_search_paths`**
- Fixed `SET search_path = public` on: `update_updated_at`, `lock_result_on_submit`, `calculate_gpa`

**Migration 3: `security_fix_permissive_insert_policies`**
- **CRITICAL FIX**: `admin_users.admins_can_insert` — was `WITH CHECK (true)`, now only existing admins can create new admins
- **CRITICAL FIX**: `students.student_insert_self` — was `WITH CHECK (true)`, now enforces `supabase_uid = auth.uid()`
- Re-applied `calculate_gpa` with correct search_path

**Migration 4: `security_drop_legacy_calculate_gpa_overload`**
- Dropped old `calculate_gpa(uuid, varchar, varchar)` overload that had no search_path
- New `calculate_gpa(uuid, text, text)` handles both (varchar auto-casts to text)

### Platform DB (`arbgvtpjcvfcckepdhef`)

**Migration: `security_fix_security_definer_view`**
- Dropped and recreated `org_public` view with `security_invoker = true`
- View now respects the `public_read_approved_orgs` RLS policy on organizations
- No sensitive data was exposed (anon keys are public by design; service keys are never in this table)

### Code: `gmis-app/vercel.json`

Added missing security headers:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com data:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.anthropic.com;
  img-src 'self' data: blob: https://*.supabase.co https://i.pravatar.cc;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self';
Changed X-Frame-Options: SAMEORIGIN → DENY
```

---

## Manual Actions Required (Dashboard)

### 1. Enable Leaked Password Protection — BOTH projects
> Supabase Dashboard → Authentication → Settings → Password → Enable "Leaked password protection"
> This checks new passwords against HaveIBeenPwned.org before accepting them.
> Do this for: `lwcwfofplegdgdsvwbus` AND `arbgvtpjcvfcckepdhef`

### 2. Set Minimum Password Length
> Supabase Dashboard → Authentication → Settings → Password → Set minimum length to 8+

### 3. Enable Rate Limiting on Auth
> Supabase Dashboard → Authentication → Rate Limits → Configure per-IP limits on sign-in attempts

### 4. Rotate service_role keys if ever exposed
> Supabase Dashboard → Settings → API → Rotate service_role key
> Only needed if keys were ever stored in a client-accessible location. Current state: SAFE.

---

## Remaining Pre-Launch Checklist (Code)

- [ ] Fix push notification Android config error (V-07) before EAS build
- [ ] Add DOMPurify or equivalent sanitization to social feed and chat render (V-08)
- [ ] Replace "GPA: 0.00 / Fail" with "No results yet" state (V-09)
- [ ] Consider formal penetration test before onboarding additional institutions
