// ============================================================
// GMIS — Design Token System
// Single source of truth for all visual constants.
// Never use raw numbers or hex values outside this file.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

// ── Brand ──────────────────────────────────────────────────
export const brand = {
  blue:          "#2d6cff",
  blueLight:     "#5b8fff",
  blueDark:      "#1a50d4",
  indigo:        "#4f3ef8",
  indigoDark:    "#3a2dd4",
  gold:          "#f0b429",
  goldDark:      "#c98e1a",
  cyan:          "#00d2ff",
  // Alpha variants — never use brand.blue + "22"
  blueAlpha5:    "rgba(45,108,255,0.05)",
  blueAlpha10:   "rgba(45,108,255,0.10)",
  blueAlpha15:   "rgba(45,108,255,0.15)",
  blueAlpha20:   "rgba(45,108,255,0.20)",
  blueAlpha30:   "rgba(45,108,255,0.30)",
  blueAlpha40:   "rgba(45,108,255,0.40)",
  blueAlpha50:   "rgba(45,108,255,0.50)",
  goldAlpha10:   "rgba(240,180,41,0.10)",
  goldAlpha15:   "rgba(240,180,41,0.15)",
  goldAlpha20:   "rgba(240,180,41,0.20)",
  indigoAlpha10: "rgba(79,62,248,0.10)",
  indigoAlpha15: "rgba(79,62,248,0.15)",
  indigoAlpha20: "rgba(79,62,248,0.20)",
  // Supplemental role colours — used in landing page persona cards
  emerald:        "#10b981",
  emeraldAlpha15: "rgba(16,185,129,0.15)",
  purple:         "#a855f7",
  purpleAlpha15:  "rgba(168,85,247,0.15)",
} as const;

// ── Dark theme ─────────────────────────────────────────────
export const dark = {
  bg: {
    primary:   "#03071a",
    secondary: "#060d1f",
    card:      "#0b1628",
    elevated:  "#0f2040",
    input:     "rgba(255,255,255,0.05)",
    hover:     "rgba(255,255,255,0.07)",
    overlay:   "rgba(0,0,0,0.80)",
  },
  text: {
    primary:   "#e8eeff",
    secondary: "#7a8bbf",
    muted:     "#3d4f7a",
    inverse:   "#03071a",
    link:      "#60a5fa",
  },
  border: {
    DEFAULT: "rgba(255,255,255,0.08)",
    subtle:  "rgba(255,255,255,0.05)",
    strong:  "rgba(255,255,255,0.15)",
    brand:   "rgba(45,108,255,0.40)",
  },
  status: {
    success:       "#4ade80",
    successBg:     "rgba(74,222,128,0.12)",
    successBorder: "rgba(74,222,128,0.25)",
    warning:       "#fbbf24",
    warningBg:     "rgba(251,191,36,0.12)",
    warningBorder: "rgba(251,191,36,0.25)",
    error:         "#f87171",
    errorBg:       "rgba(248,113,113,0.12)",
    errorBorder:   "rgba(248,113,113,0.25)",
    info:          "#60a5fa",
    infoBg:        "rgba(96,165,250,0.12)",
    infoBorder:    "rgba(96,165,250,0.25)",
  },
} as const;

// ── Light theme ────────────────────────────────────────────
export const light = {
  bg: {
    primary:   "#f0f4ff",
    secondary: "#e8eeff",
    card:      "#ffffff",
    elevated:  "#ffffff",
    input:     "rgba(0,0,0,0.04)",
    hover:     "rgba(0,0,0,0.06)",
    overlay:   "rgba(0,0,0,0.60)",
  },
  text: {
    primary:   "#0f172a",
    secondary: "#475569",
    muted:     "#64748b",   // was #94a3b8 — failed WCAG AA (2.8:1). #64748b = 4.6:1 ✅
    inverse:   "#ffffff",
    link:      "#2d6cff",
  },
  border: {
    DEFAULT: "rgba(0,0,0,0.08)",
    subtle:  "rgba(0,0,0,0.05)",
    strong:  "rgba(0,0,0,0.15)",
    brand:   "rgba(45,108,255,0.35)",
  },
  status: {
    success:       "#16a34a",
    successBg:     "rgba(22,163,74,0.10)",
    successBorder: "rgba(22,163,74,0.25)",
    warning:       "#b45309",
    warningBg:     "rgba(180,83,9,0.10)",
    warningBorder: "rgba(180,83,9,0.25)",
    error:         "#dc2626",
    errorBg:       "rgba(220,38,38,0.10)",
    errorBorder:   "rgba(220,38,38,0.25)",
    info:          "#2563eb",
    infoBg:        "rgba(37,99,235,0.10)",
    infoBorder:    "rgba(37,99,235,0.25)",
  },
} as const;

// ── Grades ─────────────────────────────────────────────────
export const grades = {
  A: { dark: "#4ade80", light: "#16a34a" },
  B: { dark: "#60a5fa", light: "#2563eb" },
  C: { dark: "#fbbf24", light: "#b45309" },
  D: { dark: "#fb923c", light: "#c2410c" },
  E: { dark: "#f97316", light: "#9a3412" },
  F: { dark: "#f87171", light: "#dc2626" },
} as const;

// ── Role accents ───────────────────────────────────────────
export const roles = {
  student:  brand.blue,
  lecturer: "#10b981",
  admin:    brand.gold,
  parent:   "#a855f7",
} as const;

// ── Spacing scale (px) ─────────────────────────────────────
export const spacing = {
  0:   0,
  1:   4,
  2:   8,
  3:   12,
  4:   16,
  5:   20,
  6:   24,
  8:   32,
  10:  40,
  12:  48,
  16:  64,
  20:  80,
  24:  96,
} as const;

// ── Border radius ──────────────────────────────────────────
export const radius = {
  xs:    6,
  sm:    8,
  md:    12,
  lg:    16,
  xl:    20,
  "2xl": 24,
  "3xl": 32,
  full:  9999,
} as const;

// ── Font sizes ─────────────────────────────────────────────
export const fontSize = {
  "2xs": 10,
  xs:    11,
  sm:    12,
  base:  13,
  md:    14,
  lg:    16,
  xl:    18,
  "2xl": 20,
  "3xl": 24,
  "4xl": 28,
  "5xl": 36,
  "6xl": 48,
} as const;

// ── Font weights ───────────────────────────────────────────
export const fontWeight = {
  normal:    "400" as const,
  medium:    "500" as const,
  semibold:  "600" as const,
  bold:      "700" as const,
  extrabold: "800" as const,
  black:     "900" as const,
};

// ── Component size constants ───────────────────────────────
// Named layout constants — avoids magic numbers in components
export const sizes = {
  sidebarWidth:     260,
  headerHeight:     60,
  bottomNavHeight:  56,
  iconGridCell:     52,  // width of each cell in icon grids
  iconCircle:       88,  // large icon container e.g. EmptyState
  brandIconSize:    40,  // school brand icon in sidebar
  avatarTapTarget:  44,  // minimum tappable avatar size
  drawerWidth:      260,
} as const;

// ── Shadows ────────────────────────────────────────────────
export const shadows = {
  brand: {
    sm: { shadowColor: brand.blue, shadowOffset: { width: 0, height: 4  }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6  },
    md: { shadowColor: brand.blue, shadowOffset: { width: 0, height: 8  }, shadowOpacity: 0.35, shadowRadius: 28, elevation: 10 },
    lg: { shadowColor: brand.blue, shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.45, shadowRadius: 48, elevation: 16 },
  },
  soft: {
    sm: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,  elevation: 2 },
    md: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  },
} as const;

// ── Line height scale ──────────────────────────────────────
export const lineHeight = {
  tight:   1.2,   // headings, display text
  normal:  1.5,   // body text (WCAG minimum recommended)
  relaxed: 1.75,  // long-form content (descriptions, results)
  loose:   2.0,   // small labels that need breathing room
} as const;

// ── Z-index scale ──────────────────────────────────────────
// Use these to prevent z-index wars between layers.
export const zIndex = {
  base:    0,
  card:    10,
  nav:     20,
  drawer:  30,
  modal:   40,
  toast:   50,
  tooltip: 60,
} as const;

// ── Surface elevation layers (dark theme) ─────────────────
// Use in place of ad-hoc elevated bg values.
export const surface = {
  1: "#0b1628",   // lowest elevation — cards
  2: "#0f1e38",   // modals, drawers
  3: "#142547",   // tooltips, popovers
  4: "#1a2e58",   // highest — command palette, alerts
} as const;

// ── Animation durations ────────────────────────────────────
export const duration = {
  instant: 0,
  fast:    150,
  normal:  250,
  slow:    400,
  slower:  600,
} as const;

// ── Easing presets (CSS strings for web, descriptions for native) ─
export const easing = {
  standard: "ease-out",
  spring:   "cubic-bezier(0.34, 1.56, 0.64, 1)",
  linear:   "linear",
} as const;

// ── Gradients ──────────────────────────────────────────────
export const gradients = {
  brand:     [brand.blue,  brand.indigo] as const,
  gold:      [brand.gold,  "#f59e0b"]    as const,
  success:   ["#4ade80",   "#22c55e"]    as const,
  danger:    ["#f87171",   "#ef4444"]    as const,
  adminBlue: ["#1a3a8f",   "#0f2460"]    as const,
  darkBg:    [dark.bg.secondary, dark.bg.primary] as const,
} as const;