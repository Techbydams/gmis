# Landing Page UI Tasks — 2026-04-13

## Task List

### 1. Theme Icon Fix (Nav) ✅ Done
- **Problem:** Nav theme toggle uses emoji (☀️/🌙) — looks unprofessional
- **Fix:** Replace with `<Icon name="ui-sun" />` / `<Icon name="ui-moon" />` from the Icon component
- **File:** `(landing)/index.tsx` line ~529

### 2. Trust Signals — Mobile Marquee Animation ✅ Done
- **Problem:** Trust signals are static on mobile; no animation
- **Fix:** Auto-scroll marquee left continuously using GSAP on web, CSS animation fallback
- Duplicate items to create seamless loop effect
- Slow, gentle scroll (not jarring)
- **File:** `(landing)/index.tsx` trust signals section

### 3. "What's Inside" — Creative Card Shuffle on Mobile ✅ Done
- **Problem:** Mobile bento grid just stacks cards vertically — generic look
- **Fix:** Creative GSAP card deck — fan/shuffle interaction
  - Cards appear in a deck/stack
  - User taps to cycle through cards with a shuffle animation (fly-out, fan, scatter)
  - NOT a standard swipe carousel
  - Use GSAP for creative transitions: rotation, 3D perspective, scatter-to-stack
- **File:** `(landing)/index.tsx` bento section

### 4. Persona Switcher — Layout Fix ✅ Done
- **Problem:** Persona switcher is "out of shape and box" — broken layout after recent update
- **Fix:** 
  - Tab row: ensure flex-wrap works and tabs don't break layout
  - Persona card: proper padding, consistent height, no overflow
  - On mobile: tabs should stack 2x2 grid or scroll horizontally
  - Feature pills: consistent width on mobile (full width), desktop (47%)
  - Icon + headline area should not wrap awkwardly
- **File:** `(landing)/index.tsx` persona section

### 5. Testimonials — Photo Avatars + Responsive Fix ✅ Done
- **Problem:** 
  - Only initials shown, no photos
  - Job/institution text goes out of frame on some cards
  - Slider not fully responsive
- **Fix:**
  - Add `image` field to TESTIMONIALS data with real photo URLs (from public sources like UI Avatars, DiceBear, or Unsplash portraits)
  - `<Image>` with fallback to initials if image fails to load or is null
  - Fix author section: use `flexShrink:1` on text container, `numberOfLines` prop
  - Mobile slider: card width = screen width minus padding, scroll snaps properly
  - Desktop: cards equal height with flexbox, text doesn't overflow
- **File:** `(landing)/index.tsx` testimonials section

---

## Status — completed 2026-04-13
- [x] Task 1: Theme icon fix — `<Icon name="ui-sun/ui-moon">`, added icon mappings to Icon.tsx
- [x] Task 2: Trust signals marquee — GSAP infinite marquee on mobile, duplicated array for seamless loop
- [x] Task 3: What's Inside card shuffle — MobileFeatureDeck component with GSAP deal + scatter-shuffle
- [x] Task 4: Persona switcher fix — 2×2 grid tabs on mobile, proper flex layout, no overflow
- [x] Task 5: Testimonials photo + responsive — pravatar.cc images with initials fallback, role/school on separate lines, scrollToOffset for FlatList
