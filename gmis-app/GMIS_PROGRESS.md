# GMIS Build Progress

> Auto-maintained tracker. Open this first in every new chat session.
> Last updated: Step 5 — Login Screens complete

---

## Project Overview

- **Product:** GMIS (GRASP Management Information System)
- **Owner:** DamsTech — Adekoya Adam Opeyemi | DAMS Technologies, Cotonou
- **Purpose:** Multi-tenant SaaS academic portal for Nigerian universities
- **Also:** BSc final year project, ESTAM University, supervised by Mr. Joseph Oluwatobi Amedeifa
- **IDE:** Google Antigravity (VS Code fork, agent-first)
- **Repo branch:** `expo-migration` (main work) | `vite-stable` (original frozen)

---

## Tech Stack

| Layer     | Choice                                  |
| --------- | --------------------------------------- |
| Framework | Expo SDK 51 + React Native Web          |
| Routing   | Expo Router v3 (file-based)             |
| Styling   | StyleSheet.create() + design tokens     |
| Icons     | @expo/vector-icons Ionicons (NO emojis) |
| DB/Auth   | Supabase JS (dual client)               |
| Payments  | Paystack (per-school keys)              |
| Hosting   | Vercel (wildcard subdomain)             |

---

## Repository Structure

```
GMIS/
├── gmis/          ← original Vite app (frozen on vite-stable branch)
└── gmis-app/      ← Expo app (active — expo-migration branch)
```

---

## Critical Schema Facts

> MUST know before writing any DB query

- Table name: `organizations` (NOT `organisations`)
- Auth UID column: `supabase_uid` (NOT `user_id`) — on admin_users, lecturers, students
- Parent detection: `students.parent_supabase_uid` — NO separate parents table
- Admin role: `admin_users.role` can be `'super_admin'` → maps to `'admin'`
- Features: `org_feature_toggles` join → `features.key`
- TenantContext exposes: `tenant`, `tenantDb`, `slug`, `isMainPlatform`
- AuthContext exposes: `user`, `signIn`, `signInWithMatric`, `signOut`, `isAuthenticated`

---

## Design System Rules

> NEVER violate these in any new file

- All colours from `theme/tokens.ts` — no raw hex
- All spacing from `spacing[]` tokens — no raw numbers
- All radius from `radius[]` tokens
- Repeated layouts from `styles/shared.ts` (`layout.row`, `layout.fill`, etc.)
- Text always via `<Text variant color weight>` component
- Icons always via `<Icon name="...">` — never use emoji
- `brand.blueAlpha10` etc for opacity colours — never `brand.blue + "22"`

---

## DAMS Technologies Watermark

Every file must have this comment in the middle:

```
/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */
```

---

## Completed Steps

### ✅ Step 1 — Expo Scaffold

- Vite app frozen on `vite-stable` branch
- `gmis-app/` created with Expo SDK 51 + blank-typescript template
- NativeWind v4 configured
- Expo Router v3 configured
- All dependencies installed
- Folder structure created

### ✅ Step 2 — Design Token System + UI Library

**Files:** `theme/tokens.ts`, `theme/index.ts`
**Components:** Text, Button, Card, Input, Badge, Spinner, Avatar, EmptyState, StatCard, Divider, Icon
**Location:** `gmis-app/components/ui/`

### ✅ Step 2b — Shared Styles

**Files:** `styles/shared.ts`, `styles/index.ts`

- `layout` — row, fill, centred, etc.
- `iconBtn` — xs/sm/md/lg/xl
- `page` — scroll, section, cardRow

### ✅ Step 3 — AppShell + Navigation

**Files:**

- `components/layout/Sidebar.tsx` — desktop sidebar (lg+)
- `components/layout/BottomNav.tsx` — mobile bottom tabs
- `components/layout/PageHeader.tsx` — mobile top header
- `components/layout/DrawerOverlay.tsx` — mobile slide-in drawer
- `components/layout/AppShell.tsx` — responsive wrapper
- `components/layout/index.ts`

**Nav items defined for:** student (12), admin (12), lecturer (7), parent (5)
**Bottom nav (5 tabs each):** student, admin, lecturer, parent

### ✅ Step 4 — AuthContext + TenantContext + Supabase

**Files:**

- `lib/supabase.ts` — master client + cached tenant client factory
- `lib/helpers.ts` — isValidEmail, isValidMatric, isValidPassword, getTenantSlug, redirectToTenant
- `context/TenantContext.tsx` — subdomain → AsyncStorage → school picker
- `context/AuthContext.tsx` — metadata-first + parallel DB fallback, signInWithMatric
- `context/ThemeContext.tsx` — dark/light theme
- `types/index.ts` — AuthUser, Organization, TenantInfo, Student, Lecturer, AdminUser
- `app/_layout.tsx` — ThemeProvider + TenantProvider
- `app/(tenant)/_layout.tsx` — AuthProvider + auth gate
- `app/(platform)/_layout.tsx` — platform admin gate

### ✅ Step 5 — Login Screens

**Files delivered as zip: `gmis-step5.zip`**

Corrected from original Vite files:

- `context/AuthContext.tsx` — uses `supabase_uid`, `signInWithMatric`, parent via `students.parent_supabase_uid`
- `context/TenantContext.tsx` — uses `organizations` table, exposes `tenant`/`tenantDb`
- `lib/supabase.ts` — getTenantClient signature matches original (url, key, slug)
- `lib/helpers.ts` — all helper functions
- `types/index.ts` — AuthUser, TenantInfo, Organization with correct fields

**New screens:**

- `app/(tenant)/login.tsx` — Student/Lecturer/Parent login (role tabs, matric/email toggle)
- `app/(tenant)/admin-login.tsx` — Admin-only login (gold accent, attempt counter)
- `app/find-school.tsx` — Find institution (search + redirect)

**Login screen architecture:**

- `/login` — Student + Lecturer + Parent (role switcher tabs)
- `/admin-login` — School admin only (gold theme, email only)
- `/(platform)/login` — Platform admin (uses master DB)
- `/find-school` — Find institution before login

---

## Pending Steps

### 🔲 Step 6 — Student Signup + Setup Account

Files needed: `StudentSignup.tsx`, `SetupAccount.tsx` (already uploaded)

- 3-step student signup form
- Lecturer self-activation flow
- Admin first-time setup

### 🔲 Step 7 — Student Dashboard + Core Pages

Files needed: student dashboard, results, timetable, payments

### 🔲 Step 8 — Admin Dashboard + Academic Setup

Files needed: admin dashboard, academic setup pages

### 🔲 Step 9 — Lecturer Portal

Files needed: lecturer pages

### 🔲 Step 10 — Chat, Social, Voting, GPA, Clearance

### 🔲 Step 11 — Parent Portal

### 🔲 Step 12 — AI Assistant

### 🔲 Step 13 — QR Attendance

### 🔲 Step 14 — Premium 3D Landing Page

### 🔲 Step 15 — Platform Admin (Billing, Org Management)

### 🔲 Step 16 — EAS Build (Android APK)

---

## Academic Project Details

- Student: Adekoya Adam Opeyemi | Matric: 24EF021030058
- Dept: Computer Science, Faculty of Science and Technology, ESTAM University
- Supervisor: Mr. Joseph Oluwatobi Amedeifa
- Title: "Design and Implementation of a Multi-User Academic Operations and Management System..."
- All 5 chapters written ✅ | Pending: TOC, List of Figures, List of Tables

---

## Key Files Shared by User

| File                  | Status                        |
| --------------------- | ----------------------------- |
| `SchoolLogin.tsx`     | ✅ Read — ported to Step 5    |
| `AdminLogin.tsx`      | ✅ Read — ported to Step 5    |
| `FindInstitution.tsx` | ✅ Read — ported to Step 5    |
| `AuthContext.tsx`     | ✅ Read — corrected + ported  |
| `TenantContext.tsx`   | ✅ Read — corrected + ported  |
| `StudentSignup.tsx`   | ✅ Uploaded — pending Step 6  |
| `SetupAccount.tsx`    | ✅ Uploaded — pending Step 6  |
| `ParentPortal.tsx`    | ✅ Uploaded — pending Step 11 |
| `PlatformAdmin.tsx`   | ✅ Uploaded — pending Step 15 |
| `OrgRegistration.tsx` | ✅ Uploaded — pending Step 15 |
| `Landing.tsx`         | ✅ Uploaded — pending Step 14 |
| `TenantError.tsx`     | ✅ Read — pending port        |
| `TenantLoading.tsx`   | ✅ Read — pending port        |

---

## Supabase Project

- Master project ref: `lwcwfofplegdgdsvwbus`
- Each school gets its own isolated Supabase project
- RLS disabled across all tables (dynamic PL/pgSQL loop)

---

## Antigravity Usage Rules

> Using Claude in Antigravity is safe BUT:
> NEVER let Antigravity modify these files:
>
> - `theme/tokens.ts`
> - `styles/shared.ts`
> - `components/ui/**`
> - `components/layout/**`
> - `context/AuthContext.tsx`
> - `context/TenantContext.tsx`
>   Use Antigravity for page-level logic only.

---

## ✅ Step 6 — Student Signup + Setup Account

**Files delivered as zip: `gmis-step6.zip`**

### New screens:

- `app/(tenant)/signup.tsx` — 3-step student signup (Account → Personal → Done)
- `app/(tenant)/setup.tsx` — Account setup (admin/lecturer/parent flows, `?role=` param)
- `app/(tenant)/components/SelectModal.tsx` — Cross-platform dropdown (replaces `<select>`)

### Key schema used:

- `departments` table: `id, name, code, faculties(name)`
- `students` insert: `supabase_uid, matric_number, email, first_name, last_name, gender, date_of_birth, phone, department_id, level, status:'pending', gpa:0, cgpa:0, id_card_printed:false, id_card_paid:false, parent_email, email_verified:false`
- Lecturer setup: finds `lecturers` by email + `is_active:true`, then updates `supabase_uid`
- Admin setup: verifies `admin_users` by email, then updates `supabase_uid`
- Parent setup: finds `students` by `parent_email`, then updates `parent_supabase_uid`

### Routing map so far:

| Route                           | Component                             |
| ------------------------------- | ------------------------------------- |
| `/find-school`                  | FindSchool                            |
| `/(tenant)/login`               | SchoolLogin (Student/Lecturer/Parent) |
| `/(tenant)/admin-login`         | AdminLogin                            |
| `/(tenant)/signup`              | StudentSignup                         |
| `/(tenant)/setup?role=admin`    | SetupAccount (admin)                  |
| `/(tenant)/setup?role=lecturer` | SetupAccount (lecturer)               |
| `/(tenant)/setup?role=parent`   | SetupAccount (parent)                 |
| `/(platform)/login`             | Platform admin login (pending)        |

### Next step: Step 7 — Student Dashboard

Need from you: your student dashboard file from Vite
