# GMIS UI/UX Redesign Roadmap

> Generated from the full frontend audit (April 2026).
> Work in `gmis-app/`. Each sprint is self-contained and shippable.

---

## Sprint Overview

| Sprint | Theme | Effort | Status |
|--------|-------|--------|--------|
| S1 | Critical fixes + token additions | ~1 day | ✅ Done |
| S2 | Skeleton loading system | ~2 days | ✅ Done |
| S3 | Animation & motion layer | ~2 days | 🟡 Partial (BottomNav, Drawer, Onboarding, Card press, Toast) |
| S4 | Component upgrades | ~2 days | ✅ Done |
| S5 | Screen redesigns | ~4 days | 🟡 Partial (Student + Admin dashboard, Login, Onboarding done) |
| S6 | Navigation polish | ~2 days | 🔲 Pending |
| S7 | Landing page redesign | ~3 days | 🔲 Pending |
| S8 | Accessibility audit | ~1 day | 🔲 Pending |

---

## Sprint 1 — Critical Fixes ✅

These are zero-risk, high-impact changes to existing files only.

### S1-1 — Light mode text contrast (WCAG fix) ✅
**File:** `theme/tokens.ts`

| Token | Before | After | Ratio before | Ratio after |
|-------|--------|-------|-------------|-------------|
| `light.text.muted` | `#94a3b8` | `#64748b` | ~2.8:1 ❌ | ~4.6:1 ✅ |

### S1-2 — New design tokens ✅
**File:** `theme/tokens.ts`

Added:
- `lineHeight` — `{ tight: 1.2, normal: 1.5, relaxed: 1.75, loose: 2.0 }`
- `zIndex` — `{ base: 0, card: 10, nav: 20, drawer: 30, modal: 40, toast: 50, tooltip: 60 }`
- `surface` — elevation layers 1–4 for dark theme
- `duration.instant` (0ms) and `duration.slower` (600ms)

---

## Sprint 2 — Skeleton Loading System ✅

Every data-fetching screen must show a skeleton on first load, never a blank screen.

### S2-1 — Skeleton base component ✅
**File:** `components/ui/Skeleton.tsx`

- Reanimated pulse (opacity 0.4 → 0.9 repeat, 900ms)
- Props: `width`, `height`, `radius`, `style`
- Respects `useReducedMotion` (static when true)

### S2-2 — Skeleton composite variants ✅
**File:** `components/ui/Skeleton.tsx` (same file, named exports)

| Export | Mimics |
|--------|--------|
| `SkeletonCard` | `<Card>` with title + body lines |
| `SkeletonStatCard` | `<StatCard>` with label + large number |
| `SkeletonListRow` | Avatar + two text lines (results, students list) |

### S2-3 — Wire skeletons into screens 🔲
**Files:** All screens that call `supabase` and show loading state.

Replace any `{loading && <Spinner />}` or `{loading && null}` with:
```tsx
if (loading) return <SkeletonDashboard />;  // or relevant variant
```

Priority order:
1. Student Dashboard
2. Results
3. Admin Dashboard
4. Approvals list
5. All remaining screens

---

## Sprint 3 — Animation & Motion ✅

All animations use `react-native-reanimated` (already installed). All are guarded by `useReducedMotion`.

### S3-1 — BottomNav spring indicator ✅
**File:** `components/layout/BottomNav.tsx`

Single animated pill that springs horizontally between tab positions when the active route changes. Uses `onLayout` to measure container width and derives pill X position from active index.

### S3-2 — DrawerOverlay slide-in ✅
**File:** `components/layout/DrawerOverlay.tsx`

- Panel: `translateX(-drawerWidth → 0)` with `withSpring` on mount
- Backdrop: `opacity(0 → 1)` with `withTiming(200ms)` on mount

### S3-3 — Page transition fade+slide 🔲
**Files:** `app/(tenant)/_layout.tsx`, `app/(tenant)/(student)/_layout.tsx`, etc.

Add to each `_layout.tsx`:
```tsx
// Entry: opacity 0→1 + translateY 8→0, 200ms ease-out
// Apply to the <Stack> screenOptions
```

### S3-4 — Card press scale feedback ✅
**File:** `components/ui/Card.tsx`
- Press-in: `scale(1.0 → 0.97)`, spring 400/20
- Release: spring back to 1.0, damping 15, stiffness 250
- Uses `Animated.View` wrapper + `onPressIn`/`onPressOut` on `TouchableOpacity`

### S3-5 — Notification/Toast slide-down ✅
**Files:** `components/ui/Toast.tsx` (new), wired into `app/_layout.tsx`
- Entry: `translateY(-80 → 0)` spring + opacity fade, 220ms
- Auto-dismiss after 3s with reverse animation
- `useToast()` hook — replace all local toast state in screens
- Variants: `success`, `error`, `warning`, `info`, `default`

---

## Sprint 4 — Component Upgrades ✅

### S4-1 — StatCard trend indicator ✅
### S4-2 — Button haptic feedback ✅ (`expo-haptics` optional graceful degradation)
### S4-3 — EmptyState variants ✅ (`default`, `error`, `offline`, `onboarding`)
### S4-4 — PageHeader breadcrumb ✅ (`breadcrumb?: string[]` renders `A › B` above title)

---

## Sprint 5 — Screen Redesigns 🔲

These are the highest-impact visible changes.

### S5-1 — Onboarding (3-step micro-flow) 🔲
**File:** `app/(onboarding)/index.tsx`

Replace single screen with a 3-step swipeable flow:
```
Step 1: Hero  — animated GMIS logo, brand gradient bg, Syne "Welcome to GMIS"
Step 2: Features — 3 animated bullet cards (Results, Payments, Timetable)
Step 3: Start — school search input + large CTA
```
Include: dot pagination indicator, Skip button, spring step transitions.

### S5-2 — Student Dashboard layout hierarchy 🔲
**File:** `app/(tenant)/(student)/dashboard.tsx`

New layout (replace current flat grid):
```
┌─────────────────────────────────────┐
│  Next Class Card — full width hero  │
│  Course + venue + live countdown    │
├──────────────┬──────────────────────┤
│  GPA StatCard│  Attendance StatCard  │
│  with trend  │  with trend           │
├──────────────┴──────────────────────┤
│  Quick Actions — 3×2 grid           │
├─────────────────────────────────────┤
│  Recent Notifications — scroll list │
└─────────────────────────────────────┘
```

### S5-3 — Login screen polish ✅
- Banner entrance animation (scale 0.92→1 spring + opacity)
- Sliding animated role tab pill (same pattern as BottomNav)
- Replaced local toast state with `useToast()`

### S5-4 — Admin dashboard metric grid ✅
- 2×2 `StatCard` grid layout (fixed rows, not rowWrap)
- `SkeletonDashboard` loading state
- Gold icon circle action tiles with `goldAlpha10` background

### S5-5 — Payments screen — balance prominence ✅
- Outstanding balance hero card with left accent bar + progress bar (filled %)
- `SkeletonDashboard` loading state
- `useToast()` replaces local toast state

### S5-6 — Results screen — grade visualization ✅
- Horizontal grade distribution bar chart (per-grade colour bars, count labels)
- Grade key integrated into distribution card (no duplicate)
- `SkeletonDashboard` loading state + `EmptyState` error variant

---

## Sprint 6 — Navigation Polish 🟡

### S6-1 — BottomSheet component ✅
**File:** `components/ui/BottomSheet.tsx`
- `visible` / `onClose` props, `snapHeight` optional
- Spring slide-up + backdrop fade using RN `Animated`
- Drag handle + safe area bottom padding
- `scrollable` prop wraps content in ScrollView
- Exported from `components/ui/index.ts`

### S6-1b — Wire BottomSheet into "More" screens 🔲
**Files:** `app/(tenant)/(student)/more.tsx`, `app/(tenant)/(admin)/more.tsx`, etc.

### S6-2 — Sidebar active state pill 🔲
**File:** `components/layout/Sidebar.tsx`

- Active item: full-width background pill (currently text colour only)
- Add section separator labels between nav groups

### S6-3 — Find School screen ✅
- Logo entrance animation (scale + fade)
- Animated sliding pill on Sign in / Register tabs
- Connecting screen: pulsing ring animation instead of Spinner

---

## Sprint 7 — Landing Page Redesign 🔲

**File:** `app/(landing)/index.tsx`

### Section order
```
1. Hero           — Headline + sub + 2 CTAs + product screenshot mockup
2. Social Proof   — "Used by X institutions" + logos
3. Personas       — Tab: Admin / Student / Lecturer / Parent feature bullets
4. How It Works   — 3-step numbered flow
5. Pricing        — 3-tier cards (Free / Pro / Enterprise)
6. Testimonials   — 2-col quote cards
7. CTA Banner     — "Ready to get started?" + Register CTA
8. Footer
```

### Design spec
- Background: near-black `#010510` alternating with `#070e1c` per section
- Hero headline: Syne Black 52px
- Hero CTA: brand blue with `box-shadow: 0 0 40px rgba(45,108,255,0.35)` glow
- Product screenshot: floating `Card elevated` with brand shadow, 3° tilt

---

## Sprint 8 — Accessibility Audit 🔲

### S8-1 — accessibilityLabel on all icon-only buttons
Grep for `<TouchableOpacity` with no `accessibilityLabel` and an `<Icon>` child.

### S8-2 — Form input labels
All `<Input>` usages must have `label` prop. No placeholder-only inputs.

### S8-3 — prefers-reduced-motion guard
All Reanimated animations must check `useReducedMotion()` and skip to final state if true.

### S8-4 — FlatList → FlashList migration
Replace all `FlatList` in screens with `@shopify/flash-list` (already installed).

### S8-5 — Focus management on web
After route transitions on web, move focus to the page heading (`<Text variant="heading">`).

---

## Dependency Order

```
S1 (tokens) → S2 (Skeleton) → S5 (screen redesigns use Skeleton)
S1 (tokens) → S3 (animations use new duration/zIndex tokens)
S4-2 (haptics) requires: npx expo install expo-haptics
S6-1 (BottomSheet) → S6-2 (More tab uses it)
S7 is independent — can be done any time
S8 runs last (audits completed work)
```
