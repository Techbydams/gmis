# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What is GMIS

**GMIS (GRASP Management Information System)** is a multi-tenant academic SaaS platform built for Nigerian universities and polytechnics. Each institution gets its own isolated portal (e.g. `estam.gmis.app`) powered by a dedicated Supabase project. The app is cross-platform — React Native (iOS/Android) and web — built with Expo.

**Four role-based portals:**

| Role | Primary screens |
|------|----------------|
| **Student** | Dashboard, Results, Timetable, Payments, Courses, GPA Calculator, Clearance, Chat, Social, Voting, Calendar |
| **Lecturer** | Dashboard, My Courses, Grade Entry, Attendance (QR), Timetable, Handouts |
| **Admin** | Dashboard, Student Approvals, Academic Setup, Results Release, Fees, ID Cards, Elections, News |
| **Parent** | Dashboard, Child's Results, Fee Status, Attendance, Calendar |

Each portal shares the same codebase and navigation shell (`AppShell`); role is resolved at login by querying four tenant DB tables in parallel and selecting the matching record.

---

## Repository Structure

This monorepo has two sub-projects:

| Directory | Stack | Status |
|-----------|-------|--------|
| `gmis/` | React + Vite + React Router v7 + Tailwind | **Frozen** on `vite-stable` branch — do not touch |
| `gmis-app/` | Expo SDK 54 + React Native Web + Expo Router v6 | **Active** on `expo-migration` branch |

All new work happens in `gmis-app/`. The `gmis/` directory exists only as the reference source for porting logic.

---

## Commands

All commands must be run from `gmis-app/`:

```bash
cd gmis-app

# Start dev server (picks platform from flag or prompts)
npx expo start

# Start web only
npx expo start --web

# Start Android
npx expo start --android

# Start iOS
npx expo start --ios

# TypeScript type-check (no build tool, use tsc directly)
npx tsc --noEmit

# Install a new package (use npx expo install, not npm install — handles SDK version compat)
npx expo install <package>
```

For the legacy `gmis/` web app:
```bash
cd gmis
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint
```

---

## Architecture

### Platform Routing (`gmis-app/app/index.tsx`)

The entry point routes to different sections based on runtime context:

- **Native (iOS/Android):** `/(onboarding)` on first launch, `/(tenant)/login` on return
- **Web — `gmis.app` (no subdomain):** `/(landing)` marketing page
- **Web — `estam.gmis.app` (subdomain):** `/(tenant)/login` (school portal)
- **Web — `localhost`:** `/find-school` (dev school picker)

### Route Groups

```
app/
├── (landing)/     — Public marketing page (web only, no auth)
├── (onboarding)/  — Native first-launch flow
├── (platform)/    — Platform admin (master DB auth)
└── (tenant)/      — All school portals (auth-gated)
    ├── (student)/
    ├── (admin)/
    ├── (lecturer)/
    └── (parent)/
```

`(tenant)/_layout.tsx` is the auth gate. It wraps `<AuthProvider>` and redirects unauthenticated users to `/(tenant)/login`.

### Multi-Tenant Architecture

Each school is an isolated Supabase project. The `TenantContext` resolves the school from:
1. Subdomain (`estam.gmis.app` → slug `estam`) on web
2. AsyncStorage key `gmis:org_slug` on native

After resolution, `getTenantClient(url, key, slug)` in `lib/supabase.ts` returns a cached tenant-specific Supabase client. Always use `tenantDb` (from `useTenant()`) for school data queries — never use the master `supabase` client for tenant data.

### Auth Role Resolution (`context/AuthContext.tsx`)

After sign-in, role is resolved by parallel queries to four tenant tables:
- `admin_users` (column: `supabase_uid`) — role `'super_admin'` maps to `'admin'`
- `lecturers` (column: `supabase_uid`)
- `students` (column: `supabase_uid`)
- `students` (column: `parent_supabase_uid`) — parent detection, no separate parents table

Students log in with matric number via `signInWithMatric()` which looks up their email first.

### Context Hierarchy

```
SafeAreaProvider
└── ThemeProvider         (useTheme, useThemeColors)
    └── TenantProvider    (useTenant → tenant, tenantDb, slug)
        └── AuthProvider  (useAuth → user, signIn, signOut)   ← only inside (tenant)/_layout
```

---

## Critical Database Schema Facts

Always verify before writing queries:

- Table: `organizations` (not `organisations`)
- Auth UID column: `supabase_uid` (not `user_id`) — on `admin_users`, `lecturers`, `students`
- Parent: stored as `students.parent_supabase_uid` — no separate `parents` table
- Admin role value: `'super_admin'` exists and must be mapped to `'admin'`
- Features: `org_feature_toggles` join table → `features.key`
- Master Supabase project ref: `lwcwfofplegdgdsvwbus`
- RLS is disabled on all tenant tables (replaced by application-level auth gate)

---

## Design System Rules — Non-Negotiable

**Never violate these when writing any screen or component:**

1. **Colors** — only from `theme/tokens.ts`. No raw hex strings.
2. **Spacing** — only `spacing[n]` from tokens. No raw numbers.
3. **Border radius** — only `radius.xs/sm/md/lg/xl/2xl/3xl/full` from tokens.
4. **Opacity colors** — use `brand.blueAlpha10` etc. Never `brand.blue + "22"`.
5. **Text** — always `<Text variant="..." color="..." weight="...">`. Never raw `<RNText>`.
6. **Icons** — always `<Icon name="...">` (Ionicons wrapper). Never emoji as icons.
7. **Layout utilities** — use `layout.row`, `layout.fill`, `layout.centred` etc. from `styles/shared.ts`.
8. **Theming** — `useTheme()` for `isDark`, `useThemeColors()` for the color palette.

### File Watermark

Every file in `gmis-app/` must include this comment block:

```ts
/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */
```

---

## Path Aliases (`gmis-app/tsconfig.json`)

`@/` maps to `gmis-app/`:

```ts
@/components/ui     → gmis-app/components/ui
@/components/layout → gmis-app/components/layout
@/context/*         → gmis-app/context/*
@/lib/*             → gmis-app/lib/*
@/theme/*           → gmis-app/theme/*
@/types/*           → gmis-app/types/*
@/styles/*          → gmis-app/styles/*
```

---

## Files Managed by Design System — Do Not Refactor

These files are considered finalized. Only modify for bug fixes or additions — never structural refactoring:

- `theme/tokens.ts` — all design tokens
- `styles/shared.ts` — layout utilities
- `components/ui/**` — the entire UI component library
- `components/layout/**` — AppShell, Sidebar, BottomNav, PageHeader, DrawerOverlay
- `context/AuthContext.tsx`
- `context/TenantContext.tsx`

---

## Environment Variables (`gmis-app/.env`)

```
EXPO_PUBLIC_SUPABASE_URL=        # Master Supabase project URL
EXPO_PUBLIC_SUPABASE_ANON_KEY=   # Master Supabase anon key
```

Tenant credentials are loaded at runtime from the `organizations` table — not from env vars.

---

## Key Utilities

| File | Purpose |
|------|---------|
| `lib/supabase.ts` | `supabase` (master client), `getTenantClient(url,key,slug)`, `clearTenantClientCache()` |
| `lib/helpers.ts` | `isValidEmail`, `isValidMatric`, `isValidPassword`, `getTenantSlug()`, `redirectToTenant()` |
| `lib/responsive.ts` | `useResponsive()` → `showSidebar`, `showBottomNav`, `gridCols`, `pagePadding` |
| `lib/grading.ts` | GPA / CGPA calculation helpers |

---

## Current Build Progress

Last completed: **Step 6 — Student Signup + Setup Account**

Screens fully implemented: `find-school`, `(tenant)/login`, `(tenant)/admin-login`, `(tenant)/signup`, `(tenant)/setup`, plus partial student/admin dashboard shells.

**Pending steps (in order):** Step 7 Student Dashboard → Step 8 Admin Dashboard → Step 9 Lecturer Portal → Step 10 Chat/Social/Voting/GPA/Clearance → Step 11 Parent Portal → Step 12 AI Assistant → Step 13 QR Attendance → Step 14 Landing Page (3D) → Step 15 Platform Admin → Step 16 EAS Build.

When picking up a pending step, port the equivalent screen from `gmis/src/` as the reference implementation.
