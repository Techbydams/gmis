// ============================================================
// GMIS — useResponsive Hook
//
// Breakpoints match standard device sizes.
// On mobile (< 768px): sidebar NEVER shows, bottom nav shows.
// On tablet (768–1023): sidebar NEVER shows, bottom nav shows.
// On desktop (>= 1024px): sidebar shows, bottom nav hidden.
//
// React Native: useWindowDimensions returns real screen px.
// Web: returns browser window width.
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

import { useWindowDimensions, Platform } from "react-native";
import { spacing } from "@/theme/tokens";

// ── Breakpoints ───────────────────────────────────────────
// These match standard device widths
const BP = {
  sm:  480,   // large phone (landscape)
  md:  768,   // tablet portrait
  lg:  1024,  // desktop / large tablet landscape
  xl:  1280,  // large desktop
} as const;

// ── Sidebar width ─────────────────────────────────────────
export const SIDEBAR_WIDTH = 260;

// ── Hook ──────────────────────────────────────────────────
export function useResponsive() {
  const { width } = useWindowDimensions();

  // On native (iOS/Android), the sidebar should NEVER show
  // regardless of orientation — use bottom nav always
  const isNative = Platform.OS !== "web";

  const isXs      = width < BP.sm;
  const isSm      = width >= BP.sm  && width < BP.md;
  const isMd      = width >= BP.md  && width < BP.lg;
  const isLg      = width >= BP.lg  && width < BP.xl;
  const isXl      = width >= BP.xl;

  const isPhone   = isXs || isSm;           // < 768px
  const isTablet  = isMd;                   // 768–1023px
  const isDesktop = isLg || isXl;           // >= 1024px

  // Mobile = phone or tablet (no sidebar)
  const isMobile = isPhone || isTablet;

  // Show sidebar ONLY on desktop web
  // Never on native, never on tablet/phone
  const showSidebar  = !isNative && isDesktop;
  const showBottomNav = isNative || isMobile;

  // Page padding scales with screen size
  const pagePadding = isXs ? spacing[4]
    : isSm  ? spacing[5]
    : isMd  ? spacing[6]
    : spacing[6];

  // Content max width for centered layouts
  const maxContentWidth = isXl ? 1200 : isLg ? 960 : "100%";

  // Grid columns
  const gridCols = isXs ? 1 : isSm ? 1 : isMd ? 2 : isLg ? 3 : 4;

  return {
    width,
    isXs, isSm, isMd, isLg, isXl,
    isPhone, isTablet, isDesktop,
    isMobile,
    isNative,
    showSidebar,
    showBottomNav,
    pagePadding,
    maxContentWidth,
    gridCols,
    sidebarWidth: SIDEBAR_WIDTH,
  };
}
